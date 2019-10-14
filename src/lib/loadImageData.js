import cornerstone from 'cornerstone-core';
import getSliceIndex from './data/getSliceIndex.js';
import insertSlice from './data/insertSlice.js';

const resolveStack = [];

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

  const { imageIds, vtkImageData, metaDataMap, zAxis } = imageDataObject;
  const loadImagePromises = imageIds.map(cornerstone.loadAndCacheImage);
  //let numberOfSlices = imageIds.length;
  //let slicesInserted = 0;

  const insertPixelData = image => {
    return new Promise(resolve => {
      const { imagePositionPatient } = metaDataMap.get(image.imageId);
      const sliceIndex = getSliceIndex(zAxis, imagePositionPatient);

      insertSlice(vtkImageData, sliceIndex, image);

      resolve();
    });
  };

  return new Promise((resolve, reject) => {
    imageDataObject.isLoading = true;

    const insertPixelDataPromises = [];

    loadImagePromises.forEach(promise => {
      const insertPixelDataPromise = promise.then(insertPixelData);

      insertPixelDataPromises.push(insertPixelDataPromise);
    });

    Promise.all(insertPixelDataPromises).then(() => {
      imageDataObject.isLoading = false;
      imageDataObject.loaded = true;
      console.log('LOADED');
      while (resolveStack.length) {
        resolveStack.pop()();
      }
    });

    resolve(insertPixelDataPromises);

    // TODO: Investigate progressive loading. Right now the UI gets super slow because
    // we are rendering and decoding simultaneously. We might want to use fewer web workers
    // for the decoding tasks.
    //
    // Update: Had some success with this locally. But it completely freezes up when stuck
    // In an app like OHIF. There seems to be many small calls made to various vtk functions.
    // Putting it aside for now, but a progressive loader still shows promise.
  });
}
