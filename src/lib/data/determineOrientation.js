// Based on David Clunie's various postings
// on the dicom google groupd.
export default function determineOrientation(v) {
  let axis;
  const oX = v.x < 0 ? 'R' : 'L';
  const oY = v.y < 0 ? 'A' : 'P';
  const oZ = v.z < 0 ? 'I' : 'S';

  const aX = Math.abs(v.x);
  const aY = Math.abs(v.y);
  const aZ = Math.abs(v.z);
  const obliqueThreshold = 0.8;
  if (aX > obliqueThreshold && aX > aY && aX > aZ) {
    axis = oX;
  } else if (aY > obliqueThreshold && aY > aX && aY > aZ) {
    axis = oY;
  } else if (aZ > obliqueThreshold && aZ > aX && aZ > aY) {
    axis = oZ;
  }

  return axis;
}
