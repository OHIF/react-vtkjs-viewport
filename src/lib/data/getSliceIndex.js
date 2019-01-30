import { bsearch } from '../math/bsearch.js';
import { compareReals } from '../math/compareReals.js';

export function getSliceIndex(zAxis, imagePositionPatient) {
  const x = imagePositionPatient[0];
  const y = imagePositionPatient[1];
  const z = imagePositionPatient[2];

  let sliceIndex = 0;
  if (zAxis.xyzIndex == 0) {
    sliceIndex = bsearch(zAxis.positions, x, compareReals);
  } else if (zAxis.xyzIndex == 1) {
    sliceIndex = bsearch(zAxis.positions, y, compareReals);
  } else {
    sliceIndex = bsearch(zAxis.positions, z, compareReals);
  }

  return sliceIndex;
}
