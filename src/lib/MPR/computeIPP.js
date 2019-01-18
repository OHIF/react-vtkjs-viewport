/**
 * Compute imagePositionPatient in each direction for each step along
 * the x, y, and z directions in a volume.
 *
 * @param imageDataObject
 * @return {{x: Array, y: Array, z: Array}}
 */
export function computeIPP(imageDataObject) {
  const { metaData0, spacing, dimensions } = imageDataObject;
  const x = [];
  const y = [];
  const z = [];

  for (let i = 0; i < dimensions[0]; i++) {
    x.push(metaData0.imagePositionPatient.x + i * spacing[0]);
  }

  for (let i = 0; i < dimensions[1]; i++) {
    y.push(metaData0.imagePositionPatient.y + i * spacing[1]);
  }

  for (let i = 0; i < dimensions[2]; i++) {
    z.push(metaData0.imagePositionPatient.z + i * spacing[2]);
  }

  return {
    x,
    y,
    z
  };
}
