import computeImageDataIncrements from './computeImageDataIncrements.js';
import computeIndex from './computeIndex.js';
import cornerstone from 'cornerstone-core';

// insert the slice at the z index location.
export default function insertSlice(imageData, index, image) {
  console.log('JAMESAPETTS INSERT SLICE');

  const pixels = image.getPixelData();
  const numPixels = pixels.length;

  // TODO: Sometimes after scaling from stored pixel value to modality
  // pixel value, the result is negative. In this case, we need to use a
  // signed array. I've hardcoded Int16 for now but I guess we can try to
  // figure out if Int8 is also an option.
  const modalityPixelsOrSUV = new Int16Array(numPixels);

  const scalingParameters = _calculateScalingParametersForModality(image);

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

      scalarData[destIdx] = _getModalityPixelsOrSUV(pixel, scalingParameters);

      pixelIndex++;
    }
  }
  imageData.modified();
}

function _calculateScalingParametersForModality(image) {
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

  const scalingParameters = {
    slope: image.slope,
    intercept: image.intercept,
    modality,
  };

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

    scalingParameters.patientWeight = patientWeight;
    scalingParameters.correctedDose = correctedDose;
  }

  return scalingParameters;
}

function _getModalityPixelsOrSUV(pixel, scalingParameters) {
  if (scalingParameters.modality === 'PT') {
    const {
      slope,
      intercept,
      patientWeight,
      correctedDose,
    } = scalingParameters;

    const modalityPixelValue = pixel * slope + intercept;
    const suv = (1000 * modalityPixelValue * patientWeight) / correctedDose;
    return suv;
  }

  const { slope, intercept } = scalingParameters;

  return pixel * slope + intercept;
}
