import { vec3 } from 'gl-matrix';

export default function isAntiParallel(originalVector, referenceVector) {
  vec3.normalize(originalVector, originalVector);
  vec3.normalize(referenceVector, referenceVector);
  return vec3.dot(originalVector, referenceVector) === -1;
}
