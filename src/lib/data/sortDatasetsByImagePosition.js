import { vec3 } from 'gl-matrix';

/**
 *
 * @param {*} scanAxisNormal - [x, y, z] array or gl-matrix vec3
 * @param {*} imageMetaDataMap - one of the results from BuildMetadata()
 */
export default function sortDatasetsByImagePosition(
  scanAxisNormal,
  imageMetaDataMap
) {
  // See https://github.com/dcmjs-org/dcmjs/blob/4849ed50db8788741c2773b3d9c75cc52441dbcb/src/normalizers.js#L167
  // TODO: Find a way to make this code generic?

  const datasets = Array.from(imageMetaDataMap.values());
  const referenceDataset = datasets[0];

  const distanceDatasetPairs = datasets.map(function(dataset) {
    const positionVector = vec3.sub(
      [],
      referenceDataset.imagePositionPatient,
      dataset.imagePositionPatient
    );
    const distance = vec3.dot(positionVector, scanAxisNormal);

    return {
      distance,
      dataset,
    };
  });

  distanceDatasetPairs.sort(function(a, b) {
    return b.distance - a.distance;
  });

  const sortedDatasets = distanceDatasetPairs.map(a => a.dataset);
  const distances = distanceDatasetPairs.map(a => a.distance);

  // TODO: The way we calculate spacing determines how the volume shows up if
  // we have missing slices.
  // - Should we just bail out for now if missing slices are present?
  //const spacing = mean(diff(distances));
  const spacing = Math.abs(distances[1] - distances[0]);

  return {
    spacing,
    origin: distanceDatasetPairs[0].dataset.imagePositionPatient,
    sortedDatasets,
  };
}
