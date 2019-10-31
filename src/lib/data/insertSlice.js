// Insert the slice at the correct location in the volume.
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
      minAndMax = insertCoronal(
        image,
        sliceIndex,
        vtkImageDimensions[0],
        vtkImageDimensions[1],
        scalarData,
        scalingFunction
      );
      break;
    case 'sagittal':
      minAndMax = insertSagittal(
        image,
        sliceIndex,
        vtkImageDimensions[0],
        vtkImageDimensions[1],
        scalarData,
        scalingFunction
      );
      break;
    case 'axial':
      minAndMax = insertAxial(image, sliceIndex, scalarData, scalingFunction);
      break;
  }

  return minAndMax;
}

function insertSagittal(
  image,
  xIndex,
  vtkImageDimensionsX,
  vtkImageDimensionsY,
  scalarData,
  scalingFunction
) {
  const pixels = image.getPixelData();
  const { rows, columns } = image;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  //const vtkImageDimensionsX = vtkImageDimensions[0];
  // const vtkImageDimensionsY = vtkImageDimensions[1];

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      // xIndex === x
      // row === z
      // (vtkImageDimensionsY - col) === y
      // or col === y ?

      // in general destIdx === z * (vktImageDimensions.x * vtkImageDimensions.y) + y * vtkImageDimensions.x + x

      const destIdx =
        row * (vtkImageDimensionsX * vtkImageDimensionsY) +
        col * vtkImageDimensionsX +
        xIndex;

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

function insertCoronal(
  image,
  yIndex,
  vtkImageDimensionsX,
  vtkImageDimensionsY,
  scalarData,
  scalingFunction
) {
  const pixels = image.getPixelData();
  const { rows, columns } = image;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  //const vtkImageDimensionsX = vtkImageDimensions[0];
  // const vtkImageDimensionsY = vtkImageDimensions[1];

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      // yIndex === y
      // row === z
      // col === x

      // in general destIdx === z * (vktImageDimensions.x * vtkImageDimensions.y) + y * vtkImageDimensions.x + x

      const destIdx =
        row * (vtkImageDimensionsX * vtkImageDimensionsY) +
        yIndex * vtkImageDimensionsX +
        col;

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

function insertAxial(image, zIndex, scalarData, scalingFunction) {
  const pixels = image.getPixelData();
  const sliceLength = pixels.length;

  let pixelIndex = 0;
  let max = scalingFunction(pixels[pixelIndex]);
  let min = max;

  //for (let row = 0; row <= rows; row++) {
  //  for (let col = 0; col <= columns; col++) {
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
  //pixelIndex++;
  //  }
  //}

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
