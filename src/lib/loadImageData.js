import { loadImageDataProgressively } from './data/loadImageDataProgressively.js';

export default function loadImageData(imageDataObject, callbacks, cornerstone) {
  return loadImageDataProgressively(
    imageDataObject.imageIds,
    imageDataObject.vtkImageData,
    imageDataObject.metaDataMap,
    imageDataObject.zAxis,
    callbacks,
    cornerstone
  ).then(() => {
    imageDataObject.loaded = true;
  });
}
