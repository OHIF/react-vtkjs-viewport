import { getSliceIndex } from './getSliceIndex.js';
import { insertSlice } from './insertSlice.js';

function callAllCallbacks(callbacks) {
  callbacks.forEach(callback => {
    callback.func(callback.view);
  });
}

export function loadImageDataProgressively(
  imageIds,
  imageData,
  metaDataMap,
  zAxis,
  callbacks = []
) {
  const loadImagePromises = imageIds.map(imageId =>
    cornerstone.loadAndCacheImage(imageId)
  );

  loadImagePromises.forEach(promise => {
    promise
      .then(image => {
        const imageMetaData = metaDataMap.get(image.imageId);
        const sliceIndex = getSliceIndex(
          zAxis,
          imageMetaData.imagePositionPatient
        );
        const pixels = image.getPixelData();

        insertSlice(imageData, pixels, sliceIndex);
        callAllCallbacks(callbacks);
      })
      .catch(error => {
        throw new Error(error);
      });
  });

  return Promise.all(loadImagePromises).then(() => {
    callAllCallbacks(callbacks);
  });
}
