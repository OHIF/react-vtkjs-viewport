export default function diff(array) {
  let resultArray = [];
  for (let i = 1; i < array.length; i++) {
    resultArray.push(array[i] - array[i - 1]);
  }
  return resultArray;
}
