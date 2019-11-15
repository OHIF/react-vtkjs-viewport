import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

export default function createLabelPipeline(
  backgroundImageData,
  paintFilterLabelMapImageData,
  options,
  useSampleDistance = false
) {
  let labelMapData;
  let { colorLUT, globalOpacity, visible } = options;

  if (visible === undefined) {
    visible = false;
  }

  if (globalOpacity === undefined) {
    globalOpacity = 1.0;
  }

  if (paintFilterLabelMapImageData) {
    labelMapData = paintFilterLabelMapImageData;
  } else {
    // Create a labelmap image the same dimensions as our background volume.
    labelMapData = vtkImageData.newInstance(
      backgroundImageData.get('spacing', 'origin', 'direction')
    );
    labelMapData.setDimensions(backgroundImageData.getDimensions());
    labelMapData.computeTransforms();

    const values = new Uint8Array(backgroundImageData.getNumberOfPoints());
    const dataArray = vtkDataArray.newInstance({
      numberOfComponents: 1, // labelmap with single component
      values,
    });
    labelMapData.getPointData().setScalars(dataArray);
  }

  const mapper = vtkVolumeMapper.newInstance();
  if (useSampleDistance) {
    const sampleDistance =
      0.7 *
      Math.sqrt(
        labelMapData
          .getSpacing()
          .map(v => v * v)
          .reduce((a, b) => a + b, 0)
      );

    mapper.setSampleDistance(sampleDistance);
  }

  const labelMap = {
    actor: vtkVolume.newInstance(),
    mapper,
    cfun: vtkColorTransferFunction.newInstance(),
    ofun: vtkPiecewiseFunction.newInstance(),
  };

  // labelmap pipeline
  labelMap.actor.setMapper(labelMap.mapper);
  labelMap.actor.setVisibility(visible);
  labelMap.ofun.addPoint(0, 0);

  // set up labelMap color and opacity mapping
  if (colorLUT) {
    // TODO -> It seems to crash if you set it higher than 256??
    const numColors = Math.min(256, colorLUT.length);

    for (let i = 0; i < numColors; i++) {
      //for (let i = 0; i < colorLUT.length; i++) {
      const color = colorLUT[i];
      labelMap.cfun.addRGBPoint(
        i,
        color[0] / 255,
        color[1] / 255,
        color[2] / 255
      );

      const segmentOpacity = (color[3] / 255) * globalOpacity;
      labelMap.ofun.addPointLong(i, segmentOpacity, 0.5, 1.0);
    }
  } else {
    // Some default.
    labelMap.cfun.addRGBPoint(1, 1, 0, 0); // label '1' will be red
    labelMap.cfun.addRGBPoint(2, 0, 1, 0); // label '2' will be green
    labelMap.cfun.addRGBPoint(3, 0, 1, 1); // label '3' will be blue
  }

  labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
  labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);

  labelMap.actor.getProperty().setInterpolationTypeToNearest();
  labelMap.actor.getProperty().setScalarOpacityUnitDistance(0, 0.1);
  labelMap.actor.getProperty().setUseGradientOpacity(0, false);

  return labelMap;
}
