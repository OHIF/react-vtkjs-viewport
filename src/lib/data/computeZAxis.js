import { mean } from '../math/mean.js';
import { diff } from '../math/diff.js';

// given the text orientation, determine the index (0,1,2)
// of the z axis
function determineOrientationIndex(orientation) {
  switch (orientation) {
    case 'A':
    case 'P':
      return 1;
    case 'L':
    case 'R':
      return 0;
    case 'S':
    case 'I':
      return 2;
    default:
      throw new Error('Oblique acquisitions are not currently supported.');
  }
}

// Given the orientation, determine the coordinates of the z axis
// i.e. the z axis per the DICOM xray or other device relative to the
// patient. Also, determine the average spacing along that axis, and
// return the index (0,1,2) of the z axis.
export default function computeZAxis(orientation, metaData) {
  const xyzIndex = determineOrientationIndex(orientation);
  const ippArray = Array.from(metaData.values()).map(value => {
    return {
      z: value.imagePositionPatient[xyzIndex],
      imagePositionPatient: value.imagePositionPatient,
    };
  });

  ippArray.sort(function(a, b) {
    return a.z - b.z;
  });

  const positions = ippArray.map(a => a.z);

  return {
    spacing: mean(diff(positions)),
    positions,
    origin: ippArray[0].imagePositionPatient,
    xyzIndex,
  };
}
