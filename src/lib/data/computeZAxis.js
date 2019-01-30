import { mean } from '../math/mean.js';
import { diff } from '../math/diff.js';

// given the text orientation, determine the index (0,1,2)
// of the z axis
function determineOrientationIndex(orientation) {
  var o = orientation;
  var index = undefined;
  switch (o) {
    case 'A':
    case 'P':
      index = 1;
      break;
    case 'L':
    case 'R':
      index = 0;
      break;
    case 'S':
    case 'I':
      index = 2;
      break;
    default:
      console.assert(false, ' OBLIQUE NOT SUPPORTED');
      break;
  }
  return index;
}

// Given the orientation, determine the coordinates of the z axis
// i.e. the z axis per the DICOM xray or other device relative to the
// patient. Also, determine the average spacing along that axis, and
// return the index (0,1,2) of the z axis.
export function computeZAxis(orientation, metaData) {
  const ippArray = [];
  let index = determineOrientationIndex(orientation);

  for (var value of metaData.values()) {
    let ipp = value.imagePositionPatient;
    if (index === 0) {
      ippArray.push(ipp[0]);
    } else if (index === 1) {
      ippArray.push(ipp[1]);
    } else {
      ippArray.push(ipp[2]);
    }
  }

  ippArray.sort(function(a, b) {
    return a - b;
  });

  const meanSpacing = mean(diff(ippArray));

  var obj = {
    spacing: meanSpacing,
    positions: ippArray,
    xyzIndex: index
  };
  return obj;
}
