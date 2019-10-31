// eps is up to you to determine based on your application.
export default function realsApproximatelyEqual(a, b, eps = 0.00001) {
  return Math.abs(a - b) < eps;
}
