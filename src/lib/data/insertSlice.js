import computeImageDataIncrements from './computeImageDataIncrements.js';
import computeIndex from './computeIndex.js';
import cornerstone from 'cornerstone-core';

// insert the slice at the z index location.
export default function insertSlice(imageData, index, image) {
  const pixels = image.getPixelData();
  const pixelScalingFunction = _getScalingFunctionForModality(image);

  const datasetDefinition = imageData.get('extent', 'spacing', 'origin');
  const scalars = imageData.getPointData().getScalars();
  const increments = computeImageDataIncrements(imageData, 1); // TODO number of components.
  const scalarData = scalars.getData();
  const indexXYZ = [0, 0, index];
  let pixelIndex = 0;

  for (let row = 0; row <= datasetDefinition.extent[3]; row++) {
    indexXYZ[1] = row;
    for (let col = 0; col <= datasetDefinition.extent[1]; col++) {
      indexXYZ[0] = col;

      const destIdx = computeIndex(
        datasetDefinition.extent,
        increments,
        indexXYZ
      );
      const pixel = pixels[pixelIndex];

      scalarData[destIdx] = pixelScalingFunction(pixel);

      pixelIndex++;
    }
  }
  imageData.modified();
}

function _getScalingFunctionForModality(image) {
  const patientStudyModule = cornerstone.metaData.get(
    'patientStudyModule',
    image.imageId
  );
  const seriesModule = cornerstone.metaData.get(
    'generalSeriesModule',
    image.imageId
  );

  const { slope, intercept } = image;

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
      _fracToDec(seriesAcquisitionTime.fractionalSeconds || 0) +
      seriesAcquisitionTime.seconds +
      seriesAcquisitionTime.minutes * 60 +
      seriesAcquisitionTime.hours * 60 * 60;
    const injectionStartTimeInSeconds =
      _fracToDec(startTime.fractionalSeconds) +
      startTime.seconds +
      startTime.minutes * 60 +
      startTime.hours * 60 * 60;
    const durationInSeconds =
      acquisitionTimeInSeconds - injectionStartTimeInSeconds;
    const correctedDose =
      totalDose * Math.exp((-durationInSeconds * Math.log(2)) / halfLife);

    return _getSUV.bind(null, slope, intercept, patientWeight, correctedDose);
  }

  return _getModalityScaledPixel.bind(null, slope, intercept);
}

function _getSUV(slope, intercept, patientWeight, correctedDose, pixel) {
  const modalityPixelValue = pixel * slope + intercept;

  return (1000 * modalityPixelValue * patientWeight) / correctedDose;
}

function _getModalityScaledPixel(slope, intercept, pixel) {
  return pixel * slope + intercept;
}

/**
 * Returns a decimal value given a fractional value.
 * @private
 * @method
 * @name _fracToDec
 *
 * @param  {number} fractionalValue The value to convert.
 * @returns {number}                 The value converted to decimal.
 */
function _fracToDec(fractionalValue) {
  return parseFloat(`.${fractionalValue}`);
}
