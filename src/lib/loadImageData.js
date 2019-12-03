import cornerstone from 'cornerstone-core';
import insertSlice from './data/insertSlice.js';
import getPatientWeightAndCorrectedDose from './data/getPatientWeightAndCorrectedDose.js';

// TODO: If we attempt to load multiple imageDataObjects at once this will break.
export default function loadImageDataProgressively(imageDataObject) {
  if (imageDataObject.loaded || imageDataObject.isLoading) {
    // Returning instantly resolved promise as good to go.
    // Returning promise to be resolved by other process as loading.
    return;
  }

  const {
    imageIds,
    vtkImageData,
    metaDataMap,
    sortedDatasets,
  } = imageDataObject;
  const loadImagePromises = imageIds.map(cornerstone.loadAndCacheImage);
  const imageId0 = imageIds[0];

  const seriesModule = cornerstone.metaData.get(
    'generalSeriesModule',
    imageId0
  );

  // If no seriesModule is present will default to linear scaling function.
  const modality = seriesModule && seriesModule.modality;
  let modalitySpecificScalingParameters;

  if (modality === 'PT') {
    modalitySpecificScalingParameters = getPatientWeightAndCorrectedDose(
      imageId0
    );
  }

  imageDataObject.isLoading = true;

  // This is straight up a hack: vtkjs cries when you feed it data with a range of zero.
  // So lets set the first voxel to 1, which will be replaced when the first image comes in.
  const scalars = vtkImageData.getPointData().getScalars();
  const scalarData = scalars.getData();

  scalarData[0] = 1;

  const range = {
    max: Number.NEGATIVE_INFINITY,
    min: Number.POSITIVE_INFINITY,
  };

  const numberOfFrames = imageIds.length;
  let numberProcessed = 0;

  const reRenderFraction = numberOfFrames / 5;
  let reRenderTarget = reRenderFraction;

  const insertPixelData = image => {
    return new Promise(resolve => {
      const { imagePositionPatient } = metaDataMap.get(image.imageId);

      const sliceIndex = sortedDatasets.findIndex(
        dataset => dataset.imagePositionPatient === imagePositionPatient
      );

      const { max, min } = insertSlice(
        vtkImageData,
        sliceIndex,
        image,
        modality,
        modalitySpecificScalingParameters
      );

      if (max > range.max) {
        range.max = max;
      }

      if (min < range.min) {
        range.min = min;
      }

      const dataArray = vtkImageData.getPointData().getScalars();

      dataArray.setRange(range, 1);
      numberProcessed++;

      if (numberProcessed > reRenderTarget) {
        reRenderTarget += reRenderFraction;

        vtkImageData.modified();

        // rerender
      }

      resolve(numberProcessed);
    });
  };

  const insertPixelDataPromises = [];

  loadImagePromises.forEach(promise => {
    const insertPixelDataPromise = promise.then(insertPixelData);

    insertPixelDataPromises.push(insertPixelDataPromise);
  });

  Promise.all(insertPixelDataPromises).then(() => {
    imageDataObject.isLoading = false;
    imageDataObject.loaded = true;

    vtkImageData.modified();
  });

  imageDataObject.insertPixelDataPromises = insertPixelDataPromises;
}
