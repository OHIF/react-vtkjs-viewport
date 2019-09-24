/**
 * @param {vtkVolume} volume A vtkVolume object to invert
 * @param {()=>void|{render:()=>void}} [rendering] - A function to render the volume after
 * being inverted or a RenderWindow object. Can be null.
 * @returns void
 */
export default (volume, rendering = null) => {
  if (!volume) {
    return;
  }

  const rgbTransferFunction = volume.getProperty().getRGBTransferFunction(0);
  const size = rgbTransferFunction.getSize();

  for (let index = 0; index < size; index++) {
    const nodeValue1 = [];

    rgbTransferFunction.getNodeValue(index, nodeValue1);

    nodeValue1[1] = 1 - nodeValue1[1];
    nodeValue1[2] = 1 - nodeValue1[2];
    nodeValue1[3] = 1 - nodeValue1[3];

    rgbTransferFunction.setNodeValue(index, nodeValue1);
  }

  if (rendering instanceof Function) {
    rendering();
  } else if (rendering && rendering.render) {
    rendering.render();
  }
};
