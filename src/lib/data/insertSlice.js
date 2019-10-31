/**
 *
 * @param {Object} imageData - The vtkImageData
 * @param {*} sliceIndex - The index of the slice you are inserting.
 * @param {*} acquistionDirection - The acquistion direction of the slice.
 * @param {*} image The cornerstone image to pull pixel data data from.
 * @param {*} modality The modality of the image.
 * @param {*} modalitySpecificScalingParameters Specific scaling paramaters for this modality. E.g. Patient weight.
 */
export default function insertSlice(
  imageData,
  sliceIndex,
  acquistionDirection,
  image,
  modality,
  modalitySpecificScalingParameters
) {
  const scalars = imageData.getPointData().getScalars();
  const scalarData = scalars.getData();

  const scalingFunction = _getScalingFunction(
    modality,
    image,
    modalitySpecificScalingParameters
  );

  const vtkImageDimensions = imageData.getDimensions();

  let minAndMax;

  switch (acquistionDirection) {
    case 'coronal':
      minAndMax = insertCoronalSlice(
        image,
        sliceIndex,
        vtkImageDimensions,
        scalarData,
        scalingFunction
      );
      break;
    case 'sagittal':
      minAndMax = insertSagittalSlice(
        image,
        sliceIndex,
        vtkImageDimensions,
        scalarData,
        scalingFunction
      );
      break;
    case 'axial':
      minAndMax = insertAxialSlice(
        image,
        sliceIndex,
        scalarData,
        scalingFunction
      );
      break;
  }

  return minAndMax;
}

/**
 *
 * @param {object} image The cornerstone image to pull pixel data data from.
 * @param {number} xIndex The x index of axially oriented vtk volume to put the sagital slice.
 * @param {number[]} vtkImageDimensions The dimensions of the axially oriented vtk volume.
 * @param {number[]} scalarData The data array for the axially oriented vtk volume.
 * @param {function} scalingFunction The modality specific scaling function.
 *
 * @returns {object} The min and max pixel values in the inserted slice.
 */
function insertSagittalSlice(
  image,
  xIndex,
  vtkImageDimensions,
  scalarData,
  scalingFunction
) {
  const pixels = image.getPixelData();
  const { rows, columns } = image;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  const vtkImageDimensionsX = vtkImageDimensions[0];
  const vtkImageDimensionsY = vtkImageDimensions[1];
  const vtkImageDimensionsZ = vtkImageDimensions[2];

  const axialSliceLength = vtkImageDimensionsX * vtkImageDimensionsY;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const yPos = vtkImageDimensionsY - col;
      const zPos = vtkImageDimensionsZ - row;

      const destIdx =
        zPos * axialSliceLength + yPos * vtkImageDimensionsX + xIndex;

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

/**
 *
 * @param {object} image The cornerstone image to pull pixel data data from.
 * @param {number} yIndex The y index of axially oriented vtk volume to put the coronal slice.
 * @param {number[]} vtkImageDimensions The dimensions of the axially oriented vtk volume.
 * @param {number[]} scalarData The data array for the axially oriented vtk volume.
 * @param {function} scalingFunction The modality specific scaling function.
 *
 * @returns {object} The min and max pixel values in the inserted slice.
 */
function insertCoronalSlice(
  image,
  yIndex,
  vtkImageDimensions,
  scalarData,
  scalingFunction
) {
  const pixels = image.getPixelData();
  const { rows, columns } = image;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  const vtkImageDimensionsX = vtkImageDimensions[0];
  const vtkImageDimensionsY = vtkImageDimensions[1];
  const vtkImageDimensionsZ = vtkImageDimensions[2];

  const axialSliceLength = vtkImageDimensionsX * vtkImageDimensionsY;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const xPos = col;
      const yPos = yIndex;
      const zPos = vtkImageDimensionsZ - row;

      const destIdx =
        zPos * axialSliceLength + yPos * vtkImageDimensionsX + xPos;

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

/**
 *
 * @param {object} image The cornerstone image to pull pixel data data from.
 * @param {number} zIndex The z index of axially oriented vtk volume to put the axial slice.
 * @param {number[]} scalarData The data array for the axially oriented vtk volume.
 * @param {function} scalingFunction The modality specific scaling function.
 *
 * @returns {object} The min and max pixel values in the inserted slice.
 */
function insertAxialSlice(image, zIndex, scalarData, scalingFunction) {
  const pixels = image.getPixelData();
  const sliceLength = pixels.length;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex++) {
    const destIdx = pixelIndex + zIndex * sliceLength;
    const pixel = pixels[pixelIndex];
    const pixelValue = scalingFunction(pixel);

    if (pixelValue > max) {
      max = pixelValue;
    } else if (pixelValue < min) {
      min = pixelValue;
    }

    scalarData[destIdx] = pixelValue;
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
