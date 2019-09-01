import cornerstone from 'cornerstone-core';

export default function buildMetadata(imageIds) {
  // Retrieve the Cornerstone imageIds from the display set
  // TODO: In future, we want to get the metadata independently from Cornerstone
  const imagePixelMetaData = cornerstone.metaData.get(
    'imagePixelModule',
    imageIds[0]
  );

  //const numberOfFrames = cornerstone.metaData.get('numberOfFrames', imageIds[0]);

  const {
    pixelRepresentation,
    bitsAllocated,
    bitsStored,
    highBit,
    photometricInterpretation,
    samplesPerPixel
  } = imagePixelMetaData;

  // Compute the image size and spacing given the meta data we already have available.
  const metaDataMap = new Map();
  imageIds.forEach(imageId => {
    // TODO: Retrieve this from somewhere other than Cornerstone
    const metaData = cornerstone.metaData.get('imagePlaneModule', imageId);

    // The map uses the imageId inside loadImageData to sort the imageIds
    metaData.imageId = imageId;

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
