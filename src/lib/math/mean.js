import { sum } from './sum.js';

export function mean(array) {
  return sum(array) / array.length;
}
