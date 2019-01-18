import { loadImageDataProgressively } from './data/loadImageDataProgressively.js';

export function loadImageData(imageDataObject, callbacks) {
  return loadImageDataProgressively(
    imageDataObject.imageIds,
    imageDataObject.vtkImageData,
    imageDataObject.metaDataMap,
    imageDataObject.zAxis,
    callbacks
  ).then(() => {
    imageDataObject.loaded = true;
  });
}
