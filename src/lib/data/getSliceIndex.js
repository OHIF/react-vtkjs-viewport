import { bsearch } from '../math/bsearch.js';
import { compareReals } from '../math/compareReals.js';

export default function getSliceIndex(zAxis, imagePositionPatient) {
  const position = imagePositionPatient[zAxis.xyzIndex];

  return bsearch(zAxis.positions, position, compareReals);
}
