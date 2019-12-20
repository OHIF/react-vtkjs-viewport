import sum from './sum.js';
import diff from './diff.js';
import mean from './mean.js';
import realsApproximatelyEqual from './realsApproximatelyEqual.js';
import boundsToCorners from './boundsToCorners';
import clamp from './clamp';

// TODO: Use a library for this?
const math = {
  sum,
  diff,
  mean,
  realsApproximatelyEqual,
  clamp,
  boundsToCorners,
};

export { math };
