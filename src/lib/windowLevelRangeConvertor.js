export function toWindowLevel(low, high) {
  const windowWidth = Math.abs(low - high);
  const windowCenter = low + windowWidth / 2;

  return { windowWidth, windowCenter };
}

export function toLowHighRange(windowWidth, windowCenter) {
  const lower = windowCenter - windowWidth / 2.0;
  const upper = windowCenter + windowWidth / 2.0;

  return { lower, upper };
}
