export function buildMetadata(displaySet) {
  // Retrieve the Cornerstone imageIds from the display set
  // TODO: In future, we want to get the metadata independently from Cornerstone
  const imageIds = displaySet.images.map(image => image.getImageId());
  const bitsAllocated = displaySet.images[0]._instance.bitAllocated;
  const bitsStored = displaySet.images[0]._instance.bitsStored;
  const samplesPerPixel = displaySet.images[0]._instance.samplesPerPixel;
  const highBit = displaySet.images[0]._instance.highBit;
  const photometricInterpretation =
    displaySet.images[0]._instance.photometricInterpretation;
  const pixelRepresentation =
    displaySet.images[0]._instance.pixelRepresentation;

  // Compute the image size and spacing given the meta data we already have available.
  const metaDataMap = new Map();
  imageIds.forEach(imageId => {
    // TODO: Retrieve this from somewhere other than Cornerstone
    const metaData = cornerstone.metaData.get('imagePlaneModule', imageId);
    metaDataMap.set(imageId, metaData);
  });

  return {
    metaData0: metaDataMap.values().next().value,
    metaDataMap,
    imageIds,
    imageMetaData0: {
      bitsAllocated,
      bitsStored,
      samplesPerPixel,
      highBit,
      photometricInterpretation,
      pixelRepresentation
    }
  };
}
