import cornerstone from 'cornerstone-core';

// insert the slice at the z index location.
export default function insertSlice(
  imageData,
  sliceIndex,
  image,
  modality,
  modalitySpecificScalingParameters
) {
  const pixels = image.getPixelData();
  const { rows, columns } = image;
  const scalars = imageData.getPointData().getScalars();
  const scalarData = scalars.getData();
  const sliceLength = pixels.length;
  let pixelIndex = 0;

  const scalingFunction = _getScalingFunction(
    modality,
    image,
    modalitySpecificScalingParameters
  );

  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const destIdx = pixelIndex + sliceIndex * sliceLength;
      const pixel = pixels[pixelIndex];
      const pixelValue = scalingFunction(pixel);

      if (pixelValue > max) {
        max = pixelValue;
      } else if (pixelValue < min) {
        min = pixelValue;
      }

      scalarData[destIdx] = pixelValue;
      pixelIndex++;
    }
  }

  return { min, max };
}

function _getScalingFunction(
  modality,
  image,
  modalitySpecificScalingParameters
) {
  const { slope, intercept } = image;

  if (modality === 'PT') {
    const { patientWeight, correctedDose } = modalitySpecificScalingParameters;
    return pixel => {
      const modalityPixelValue = pixel * slope + intercept;

      return (1000 * modalityPixelValue * patientWeight) / correctedDose;
    };
  } else {
    return pixel => {
      return pixel * slope + intercept;
    };
  }
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
