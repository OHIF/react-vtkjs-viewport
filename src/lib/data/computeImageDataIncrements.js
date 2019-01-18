// Based on vtkImageData.cxx (vtkDataset)
export function computeImageDataIncrements(imageData, numberOfComponents) {
  const datasetDefinition = imageData.get('extent', 'spacing', 'origin');
  const inc = [0, 0, 0];
  let incr = numberOfComponents;

  for (let idx = 0; idx < 3; ++idx) {
    inc[idx] = incr;
    incr *=
      datasetDefinition.extent[idx * 2 + 1] -
      datasetDefinition.extent[idx * 2] +
      1;
  }

  return inc;
}
