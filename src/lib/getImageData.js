import { vec3 } from 'gl-matrix';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';

import buildMetadata from './data/buildMetadata.js';
import imageDataCache from './data/imageDataCache.js';
import sortDatasetsByImagePosition from './data/sortDatasetsByImagePosition.js';

//Tolerance for ImageOrientationPatient
const iopTolerance = 1e-6;

export default function getImageData(imageIds, displaySetInstanceUid) {
  const cachedImageDataObject = imageDataCache.get(displaySetInstanceUid);

  if (cachedImageDataObject) {
    return cachedImageDataObject;
  }

  const { metaData0, metaDataMap, imageMetaData0 } = buildMetadata(imageIds);

  let { rowCosines, columnCosines } = metaData0;

  //correct for the 32bit float header issue before orthogonalizing
  //https://github.com/OHIF/Viewers/issues/2847
  for (let i = 0; i < rowCosines.length; i++) {
    if (Math.abs(rowCosines[i]) < iopTolerance) {
      rowCosines[i] = 0;
    }
    if (Math.abs(columnCosines[i]) < iopTolerance) {
      columnCosines[i] = 0;
    }
  }
  const rowCosineVec = vec3.fromValues(...rowCosines);
  const colCosineVec = vec3.fromValues(...columnCosines);
  const scanAxisNormal = vec3.cross([], rowCosineVec, colCosineVec);

  let direction = [rowCosineVec, colCosineVec, scanAxisNormal];
  vtkMath.orthogonalize3x3(direction, direction);

  //setDirection expects orthogonal matrix
  const orthogonalizedDirection = [
    ...direction[0],
    ...direction[1],
    ...direction[2],
  ];

  const { spacing, origin, sortedDatasets } = sortDatasetsByImagePosition(
    scanAxisNormal,
    metaDataMap
  );

  const xSpacing = metaData0.columnPixelSpacing;
  const ySpacing = metaData0.rowPixelSpacing;
  const zSpacing = spacing;
  const xVoxels = metaData0.columns;
  const yVoxels = metaData0.rows;
  const zVoxels = metaDataMap.size;
  const signed = imageMetaData0.pixelRepresentation === 1;
  const multiComponent = metaData0.numberOfComponents > 1;

  // TODO: Support numberOfComponents = 3 for RGB?
  if (multiComponent) {
    throw new Error('Multi component image not supported by this plugin.');
  }

  let pixelArray;
  switch (imageMetaData0.bitsAllocated) {
    case 8:
      if (signed) {
        throw new Error(
          '8 Bit signed images are not yet supported by this plugin.'
        );
      } else {
        throw new Error(
          '8 Bit unsigned images are not yet supported by this plugin.'
        );
      }

    case 16:
      pixelArray = new Float32Array(xVoxels * yVoxels * zVoxels);

      break;
  }

  const scalarArray = vtkDataArray.newInstance({
    name: 'Pixels',
    numberOfComponents: 1,
    values: pixelArray,
  });

  const imageData = vtkImageData.newInstance();
  imageData.setDimensions(xVoxels, yVoxels, zVoxels);
  imageData.setSpacing(xSpacing, ySpacing, zSpacing);
  imageData.setDirection(orthogonalizedDirection);
  imageData.setOrigin(...origin);
  imageData.getPointData().setScalars(scalarArray);

  const _publishPixelDataInserted = count => {
    imageDataObject.subscriptions.onPixelDataInserted.forEach(callback => {
      callback(count);
    });
  };

  const _publishPixelDataInsertedError = error => {
    imageDataObject.subscriptions.onPixelDataInsertedError.forEach(callback => {
      callback(error);
    });
  };

  const _publishAllPixelDataInserted = () => {
    imageDataObject.subscriptions.onAllPixelDataInserted.forEach(callback => {
      callback();
    });
    imageDataObject.isLoading = false;
    imageDataObject.loaded = true;
    imageDataObject.vtkImageData.modified();

    // Remove all subscriptions on completion.
    imageDataObject.subscriptions = {
      onPixelDataInserted: [],
      onPixelDataInsertedError: [],
      onAllPixelDataInserted: [],
    };
  };

  const imageDataObject = {
    imageIds,
    metaData0,
    imageMetaData0,
    dimensions: [xVoxels, yVoxels, zVoxels],
    spacing: [xSpacing, ySpacing, zSpacing],
    origin,
    direction,
    vtkImageData: imageData,
    metaDataMap,
    sortedDatasets,
    loaded: false,
    subscriptions: {
      onPixelDataInserted: [],
      onPixelDataInsertedError: [],
      onAllPixelDataInserted: [],
    },
    onPixelDataInserted: callback => {
      imageDataObject.subscriptions.onPixelDataInserted.push(callback);
    },
    onPixelDataInsertedError: callback => {
      imageDataObject.subscriptions.onPixelDataInsertedError.push(callback);
    },
    onAllPixelDataInserted: callback => {
      imageDataObject.subscriptions.onAllPixelDataInserted.push(callback);
    },
    _publishPixelDataInserted,
    _publishAllPixelDataInserted,
    _publishPixelDataInsertedError,
  };

  imageDataCache.set(displaySetInstanceUid, imageDataObject);

  return imageDataObject;
}
