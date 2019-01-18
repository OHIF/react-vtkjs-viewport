import { buildMetadata } from './data/buildMetadata.js';
import { determineOrientation } from './data/determineOrientation.js';
import { computeZAxis } from './data/computeZAxis.js';

export function getImageData(displaySet) {
  const { displaySetInstanceUid } = displaySet;
  const { imageDataCache } = OHIF.plugins.VTKDataCache;
  const cachedImageDataObject = imageDataCache.get(displaySetInstanceUid);

  if (cachedImageDataObject) {
    return cachedImageDataObject;
  }

  const { metaData0, metaDataMap, imageIds, imageMetaData0 } = buildMetadata(
    displaySet
  );
  const { rowCosines, columnCosines } = metaData0;
  const crossProduct = columnCosines.crossVectors(columnCosines, rowCosines);
  const orientation = determineOrientation(crossProduct);
  const zAxis = computeZAxis(orientation, metaDataMap);
  const xSpacing = metaData0.columnPixelSpacing;
  const ySpacing = metaData0.rowPixelSpacing;
  const zSpacing = zAxis.spacing;
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

      break;

    case 16:
      if (signed) {
        pixelArray = new Int16Array(xVoxels * yVoxels * zVoxels);
      } else {
        pixelArray = new Uint16Array(xVoxels * yVoxels * zVoxels);
      }

      break;
  }

  const scalarArray = vtk.Common.Core.vtkDataArray.newInstance({
    name: 'Pixels',
    numberOfComponents: 1,
    values: pixelArray
  });

  const imageData = vtk.Common.DataModel.vtkImageData.newInstance();

  imageData.setDimensions([xVoxels, yVoxels, zVoxels]);
  imageData.setSpacing([xSpacing, ySpacing, zSpacing]);
  imageData.getPointData().setScalars(scalarArray);

  const imageDataObject = {
    imageIds,
    metaData0,
    dimensions: [xVoxels, yVoxels, zVoxels],
    spacing: [xSpacing, ySpacing, zSpacing],
    orientation,
    vtkImageData: imageData,
    metaDataMap,
    zAxis,
    loaded: false
  };

  imageDataCache.set(displaySetInstanceUid, imageDataObject);

  return imageDataObject;
}
