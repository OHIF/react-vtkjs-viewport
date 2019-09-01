export default function getSliceIndex(
  distanceDatasetPairs,
  imagePositionPatient
) {
  return distanceDatasetPairs.findIndex(pair => {
    return pair.dataset.imagePositionPatient === imagePositionPatient;
  });
}
