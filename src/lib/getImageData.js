import { Vector3 } from 'cornerstone-math';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';

import buildMetadata from './data/buildMetadata.js';
import imageDataCache from './data/imageDataCache.js';
import sortDatasetsByImagePosition from './data/sortDatasetsByImagePosition.js';

export default function getImageData(imageIds, displaySetInstanceUid) {
  const cachedImageDataObject = imageDataCache.get(displaySetInstanceUid);

  if (cachedImageDataObject) {
    return cachedImageDataObject;
  }

  const { metaData0, metaDataMap, imageMetaData0 } = buildMetadata(imageIds);

  const { rowCosines, columnCosines } = metaData0;
  const rowCosineVec = new Vector3(rowCosines[0], rowCosines[1], rowCosines[2]);
  const colCosineVec = new Vector3(
    columnCosines[0],
    columnCosines[1],
    columnCosines[2]
  );

  const scanAxisNormal = new Vector3(
    rowCosines[0],
    rowCosines[1],
    rowCosines[2]
  ).cross(colCosineVec);

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

  const direction = [
    rowCosineVec.x,
    rowCosineVec.y,
    rowCosineVec.z,
    colCosineVec.x,
    colCosineVec.y,
    colCosineVec.z,
    scanAxisNormal.x,
    scanAxisNormal.y,
    scanAxisNormal.z,
  ];

  const acquistionDirection = _getAcquisitionDirection(scanAxisNormal);

  console.log(rowCosineVec);
  console.log(colCosineVec);
  console.log(scanAxisNormal);
  console.log(acquistionDirection);

  switch (acquistionDirection) {
    case 'sagittal':
      imageData.setDimensions(zVoxels, xVoxels, yVoxels);
      imageData.setSpacing(zSpacing, xSpacing, ySpacing);
      break;
    case 'coronal':
      imageData.setDimensions(xVoxels, zVoxels, yVoxels);
      imageData.setSpacing(xSpacing, zSpacing, ySpacing);
      break;
    case 'axial':
      imageData.setDimensions(xVoxels, yVoxels, zVoxels);
      imageData.setSpacing(xSpacing, ySpacing, zSpacing);
      break;
  }

  imageData.setOrigin(...origin);
  imageData.getPointData().setScalars(scalarArray);

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
    acquistionDirection,
    loaded: false,
  };

  imageDataCache.set(displaySetInstanceUid, imageDataObject);

  return imageDataObject;
}

const sagittal = new Vector3(1, 0, 0);
const coronal = new Vector3(0, 1, 0);
const axial = new Vector3(0, 0, 1);

function _getAcquisitionDirection(zDirection) {
  const zAbs = new Vector3(
    Math.abs(zDirection.x),
    Math.abs(zDirection.y),
    Math.abs(zDirection.z)
  );

  // Get the direction of the acquisition.
  const dotProducts = [
    zAbs.dot(sagittal), // z . Sagittal
    zAbs.dot(coronal), // z . Coronal
    zAbs.dot(axial), // z . Axial
  ];

  const directionIndex = dotProducts.indexOf(Math.max(...dotProducts));

  const acquisitionDirections = ['sagittal', 'coronal', 'axial'];

  return acquisitionDirections[directionIndex];
}
