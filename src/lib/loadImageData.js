import cornerstone from 'cornerstone-core';
import getSliceIndex from './data/getSliceIndex.js';
import insertSlice from './data/insertSlice.js';

const resolveStack = [];

async function testLoadAndCacheImage(imageId) {
  const latency = Math.floor(Math.random() * 10000);

  return new Promise(resolve => {
    setTimeout(() => resolve(cornerstone.loadAndCacheImage(imageId)), latency);
  });
}

// TODO: If we attempt to load multiple imageDataObjects at once this will break.
export default function loadImageDataProgressively(imageDataObject) {
  if (imageDataObject.loaded) {
    // Returning instantly resolved promise as good to go.
    return new Promise(resolve => {
      resolve();
    });
  } else if (imageDataObject.isLoading) {
    // Returning promise to be resolved by other process as loading.
    return new Promise(resolve => {
      resolveStack.push(resolve);
    });
  }

  return new Promise((resolve, reject) => {
    const { imageIds, vtkImageData, metaDataMap, zAxis } = imageDataObject;
    //const loadImagePromises = imageIds.map(cornerstone.loadAndCacheImage);
    const loadImagePromises = imageIds.map(testLoadAndCacheImage);

    imageDataObject.isLoading = true;

    let numberOfSlices = imageIds.length;

    let slicesInserted = 0;

    let resolved = false;

    const insertPixelData = image => {
      const { imagePositionPatient } = metaDataMap.get(image.imageId);
      const sliceIndex = getSliceIndex(zAxis, imagePositionPatient);

      insertSlice(vtkImageData, sliceIndex, image);

      slicesInserted++;

      console.log(slicesInserted);

      //if (!resolved) {
      if (slicesInserted === numberOfSlices) {
        imageDataObject.isLoading = false;
        imageDataObject.loaded = true;
        console.log('LOADED');
        /*
        while (resolveStack.length) {
          resolveStack.pop()();
        }
        */

        //resolved = true;

        //resolve();
      }
    };

    loadImagePromises.forEach(promise => {
      promise.then(insertPixelData).catch(error => {
        console.error(error);
        reject(error);
      });
    });

    console.log('RESOLVING');

    resolve();

    // TODO: Investigate progressive loading. Right now the UI gets super slow because
    // we are rendering and decoding simultaneously. We might want to use fewer web workers
    // for the decoding tasks.
  });
}

/*
export default function loadImageData(imageDataObject) {
  return loadImageDataProgressively(imageDataObject).then();
}
*/
