import { computeImageDataIncrements } from './computeImageDataIncrements.js';
import { computeIndex } from './computeIndex.js';

// insert the slice at the z index location.
export function insertSlice(imageData, pixels, index) {
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
      scalarData[destIdx] = pixels[pixelIndex++];
    }
  }
  imageData.modified();
}
