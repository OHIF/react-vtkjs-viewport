import { Vector3 } from 'cornerstone-math';

export default function computeSliceOrderPositions(
  scanAxisNormal,
  imageMetaDataMap
) {
  // See https://github.com/dcmjs-org/dcmjs/blob/4849ed50db8788741c2773b3d9c75cc52441dbcb/src/normalizers.js#L167
  // TODO: Find a way to make this code generic to dcmjs?
  const datasets = Array.from(imageMetaDataMap.values());

  // TODO: How do we determine a reference?
  const referenceDataset = datasets[0];

  const refIppVec = new Vector3(...referenceDataset.imagePositionPatient);

  const distanceDatasetPairs = datasets.map(function(dataset) {
    const ippVec = new Vector3(...dataset.imagePositionPatient);
    const positionVector = refippVec.clone().subtract(ippVec);
    const distance = positionVector.dot(scanAxisNormal);

    distanceDatasetPairs.push([distance, dataset]);
  });

  distanceDatasetPairs.sort(function(a, b) {
    return b[0] - a[0];
  });

  const distances = distanceDatasetPairs.map(a => a[0]);

  return {
    spacing: mean(diff(distances)),
    origin: referenceDataset[0].imagePositionPatient
  };
}
