export const setGlobalOpacity = (labelmap, colorLUT, opacity) => {
  if (colorLUT) {
    // TODO -> It seems to crash if you set it higher than 256??
    const numColors = Math.min(256, colorLUT.length);

    for (let i = 0; i < numColors; i++) {
      //for (let i = 0; i < colorLUT.length; i++) {
      const color = colorLUT[i];
      labelmap.cfun.addRGBPoint(
        i,
        color[0] / 255,
        color[1] / 255,
        color[2] / 255
      );

      // Set the opacity per label.
      const segmentOpacity = (color[3] / 255) * opacity;
      labelmap.ofun.addPointLong(i, segmentOpacity, 0.5, 1.0);
    }
  }
};

export default setGlobalOpacity;
