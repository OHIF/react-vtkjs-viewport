import cornerstone from 'cornerstone-core';
import getSliceIndex from './data/getSliceIndex.js';
import insertSlice from './data/insertSlice.js';

function loadImageDataProgressively(imageIds, imageData, metaDataMap, zAxis) {
  const loadImagePromises = imageIds.map(cornerstone.loadAndCacheImage);

  const insertPixelData = image => {
    const { imagePositionPatient } = metaDataMap.get(image.imageId);
    const sliceIndex = getSliceIndex(zAxis, imagePositionPatient);

    insertSlice(imageData, sliceIndex, image);
  };

  loadImagePromises.forEach(promise => {
    promise.then(insertPixelData).catch(error => {
      console.error(error);
      //throw new Error(error);
    });
  });

  // TODO: Investigate progressive loading. Right now the UI gets super slow because
  // we are rendering and decoding simultaneously. We might want to use fewer web workers
  // for the decoding tasks.

  //return loadImagePromises[0];
  return Promise.all(loadImagePromises);
}

/**
 * Returns a decimal value given a fractional value.
 * @private
 * @method
 * @name fracToDec
 *
 * @param  {number} fractionalValue The value to convert.
 * @returns {number}                 The value converted to decimal.
 */
function fracToDec(fractionalValue) {
  return parseFloat(`.${fractionalValue}`);
}

export default function loadImageData(imageDataObject) {
  return loadImageDataProgressively(
    imageDataObject.imageIds,
    imageDataObject.vtkImageData,
    imageDataObject.metaDataMap,
    imageDataObject.zAxis
  ).then(() => {
    imageDataObject.loaded = true;
  });
}
