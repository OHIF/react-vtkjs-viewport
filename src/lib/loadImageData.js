import cornerstone from 'cornerstone-core';
import getSliceIndex from './data/getSliceIndex.js';
import insertSlice from './data/insertSlice.js';

function loadImageDataProgressively(
  imageIds,
  imageData,
  metaDataMap,
  sortedDatasets
) {
  // TODO: Use cornerstoneTools requestPoolManager instead of launching all request simultaneously
  const loadImagePromises = imageIds.map(cornerstone.loadAndCacheImage);

  const insertPixelData = image => {
    const { imagePositionPatient } = metaDataMap.get(image.imageId);
    const sliceIndex = getSliceIndex(sortedDatasets, imagePositionPatient);
    const pixels = image.getPixelData();
    const { slope, intercept } = image;
    const numPixels = pixels.length;

    // TODO: Sometimes after scaling from stored pixel value to modality
    // pixel value, the result is negative. In this case, we need to use a
    // signed array. I've hardcoded Int16 for now but I guess we can try to
    // figure out if Int8 is also an option.
    const modalityPixelsOrSUV = new Int16Array(numPixels);

    const patientStudyModule = cornerstone.metaData.get(
      'patientStudyModule',
      image.imageId
    );
    const seriesModule = cornerstone.metaData.get(
      'generalSeriesModule',
      image.imageId
    );

    if (!patientStudyModule) {
      throw new Error('patientStudyModule metadata is required');
    }

    if (!seriesModule) {
      throw new Error('seriesModule metadata is required');
    }

    const modality = seriesModule.modality;

    if (modality === 'PT') {
      const patientWeight = patientStudyModule.patientWeight; // In kg

      if (!patientWeight) {
        throw new Error(
          'patientWeight must be present in patientStudyModule for modality PT'
        );
      }

      const petSequenceModule = cornerstone.metaData.get(
        'petIsotopeModule',
        image.imageId
      );

      if (!petSequenceModule) {
        throw new Error('petSequenceModule metadata is required');
      }

      // TODO:
      // - Update this to match the SUV logic provided here:
      //   https://github.com/salimkanoun/fijiPlugins/blob/master/Pet_Ct_Viewer/src/SUVDialog.java
      // - Test with PET datasets from various providers to ensure SUV is correct
      const radiopharmaceuticalInfo = petSequenceModule.radiopharmaceuticalInfo;
      const startTime = radiopharmaceuticalInfo.radiopharmaceuticalStartTime;
      const totalDose = radiopharmaceuticalInfo.radionuclideTotalDose;
      const halfLife = radiopharmaceuticalInfo.radionuclideHalfLife;
      const seriesAcquisitionTime = seriesModule.seriesTime;

      if (!startTime || !totalDose || !halfLife || !seriesAcquisitionTime) {
        throw new Error(
          'The required radiopharmaceutical information was not present.'
        );
      }

      const acquisitionTimeInSeconds =
        fracToDec(seriesAcquisitionTime.fractionalSeconds || 0) +
        seriesAcquisitionTime.seconds +
        seriesAcquisitionTime.minutes * 60 +
        seriesAcquisitionTime.hours * 60 * 60;
      const injectionStartTimeInSeconds =
        fracToDec(startTime.fractionalSeconds) +
        startTime.seconds +
        startTime.minutes * 60 +
        startTime.hours * 60 * 60;
      const durationInSeconds =
        acquisitionTimeInSeconds - injectionStartTimeInSeconds;
      const correctedDose =
        totalDose * Math.exp((-durationInSeconds * Math.log(2)) / halfLife);

      for (let i = 0; i < numPixels; i++) {
        const modalityPixelValue = pixels[i] * slope + intercept;
        const suv = (1000 * modalityPixelValue * patientWeight) / correctedDose;
        modalityPixelsOrSUV[i] = suv;
      }
    } else {
      for (let i = 0; i < numPixels; i++) {
        modalityPixelsOrSUV[i] = pixels[i] * slope + intercept;
      }
    }

    insertSlice(imageData, modalityPixelsOrSUV, sliceIndex);
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
  const imageIds = imageDataObject.sortedDatasets.map(dataset => {
    return dataset.imageId;
  });

  return loadImageDataProgressively(
    imageIds,
    imageDataObject.vtkImageData,
    imageDataObject.metaDataMap,
    imageDataObject.sortedDatasets
  ).then(() => {
    imageDataObject.loaded = true;
  });
}
