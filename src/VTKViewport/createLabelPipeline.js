import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import setGlobalOpacity from './setGlobalOpacity';

export default function createLabelPipeline(
  backgroundImageData,
  paintFilterLabelMapImageData,
  options,
  useSampleDistance = false
) {
  let labelMapData;
  let {
    colorLUT,
    globalOpacity,
    visible,
    renderOutline,
    outlineThickness,
  } = options;

  if (visible === undefined) {
    visible = false;
  }

  if (globalOpacity === undefined) {
    globalOpacity = 1.0;
  }

  if (outlineThickness === undefined) {
    outlineThickness = 3;
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
  labelMap.ofun.addPointLong(0, 0, 0.5, 1.0);
  labelMap.ofun.addPointLong(1, 1.0, 0.5, 1.0);

  // Set up labelMap color and opacity mapping
  if (colorLUT) {
    setGlobalOpacity(labelMap, colorLUT, globalOpacity);
  } else {
    // Some default.
    labelMap.cfun.addRGBPoint(1, 1, 0, 0); // label '1' will be red
    labelMap.cfun.addRGBPoint(2, 0, 1, 0); // label '2' will be green
    labelMap.cfun.addRGBPoint(3, 0, 1, 1); // label '3' will be blue
    labelMap.ofun.addPointLong(1, 0.5, 0.5, 1.0); // All labels half opacity
  }

  labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
  labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);
  labelMap.actor.getProperty().setInterpolationTypeToNearest();

  if (renderOutline) {
    labelMap.actor.getProperty().setUseLabelOutline(true);
    labelMap.actor.getProperty().setLabelOutlineThickness(outlineThickness);
  }

  labelMap.ofun.setClamping(false);
  labelMap.actor.getProperty().setScalarOpacityUnitDistance(0, 0.1);
  labelMap.actor.getProperty().setUseGradientOpacity(0, false);

  return labelMap;
}
