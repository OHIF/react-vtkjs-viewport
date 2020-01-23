import React from 'react';
import { Component } from 'react';
import PropTypes from 'prop-types';
import { View2D, View3D } from '@vtk-viewport';

import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

function createVolumeRenderingActor(imageData) {
  const mapper = vtkVolumeMapper.newInstance();
  mapper.setInputData(imageData);

  const actor = vtkVolume.newInstance();
  actor.setMapper(mapper);

  const rgbTransferFunction = actor.getProperty().getRGBTransferFunction(0);
  const range = imageData
    .getPointData()
    .getScalars()
    .getRange();
  rgbTransferFunction.setMappingRange(range[0], range[1]);

  // create color and opacity transfer functions
  const cfun = vtkColorTransferFunction.newInstance();
  cfun.addRGBPoint(range[0], 0.4, 0.2, 0.0);
  cfun.addRGBPoint(range[1], 1.0, 1.0, 1.0);

  const ofun = vtkPiecewiseFunction.newInstance();
  ofun.addPoint(0.0, 0.0);
  ofun.addPoint(1000.0, 0.3);
  ofun.addPoint(6000.0, 0.9);

  actor.getProperty().setRGBTransferFunction(0, cfun);
  actor.getProperty().setScalarOpacity(0, ofun);
  actor.getProperty().setScalarOpacityUnitDistance(0, 4.5);
  actor.getProperty().setInterpolationTypeToLinear();
  actor.getProperty().setUseGradientOpacity(0, true);
  actor.getProperty().setGradientOpacityMinimumValue(0, 15);
  actor.getProperty().setGradientOpacityMinimumOpacity(0, 0.0);
  actor.getProperty().setGradientOpacityMaximumValue(0, 100);
  actor.getProperty().setGradientOpacityMaximumOpacity(0, 1.0);
  actor.getProperty().setAmbient(0.7);
  actor.getProperty().setDiffuse(0.7);
  actor.getProperty().setSpecular(0.3);
  actor.getProperty().setSpecularPower(8.0);

  return actor;
}

/**
 * Create a labelmap image with the same dimensions as our background volume.
 *
 * @param backgroundImageData vtkImageData
 */
function createLabelMapImageData(backgroundImageData) {
  const labelMapData = vtkImageData.newInstance(
    backgroundImageData.get('spacing', 'origin', 'direction')
  );
  labelMapData.setDimensions(backgroundImageData.getDimensions());
  labelMapData.computeTransforms();

  const values = new Float32Array(backgroundImageData.getNumberOfPoints());
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1, // labelmap with single component
    values,
  });
  labelMapData.getPointData().setScalars(dataArray);

  return labelMapData;
}

class VTKMPRPaintingExample extends Component {
  state = {
    volumes: null,
    volumeRenderingVolumes: null,
    focusedWidgetId: null,
    paintFilterBackgroundImageData: null,
    paintFilterLabelMapImageData: null,
    threshold: 1500,
  };

  static propTypes = {
    volumes: PropTypes.array,
    focusedWidgetId: PropTypes.string,
  };

  componentDidMount() {
    this.apis = [];

    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });
    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeActor.setMapper(volumeMapper);

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      volumeMapper.setInputData(data);

      const rgbTransferFunction = volumeActor
        .getProperty()
        .getRGBTransferFunction(0);
      rgbTransferFunction.setMappingRange(500, 3000);

      const labelMapImageData = createLabelMapImageData(data);
      const volumeRenderingActor = createVolumeRenderingActor(data);

      this.setState({
        volumes: [volumeActor],
        volumeRenderingVolumes: [volumeRenderingActor],
        paintFilterBackgroundImageData: data,
        paintFilterLabelMapImageData: labelMapImageData,
      });
    });
  }

  setWidget = event => {
    const widgetId = event.target.value;

    if (widgetId === 'rotate') {
      this.setState({
        focusedWidgetId: null,
      });
    } else {
      this.setState({
        focusedWidgetId: widgetId,
      });
    }
  };

  setThreshold = event => {
    if (!event.target.value) {
      return;
    }

    const threshold = parseFloat(event.target.value);

    this.setThresholdFromValue(threshold);
  };

  setThresholdFromValue = threshold => {
    Object.keys(this.apis).forEach(viewportIndex => {
      const paintFilter = this.apis[viewportIndex].filters[0];

      paintFilter.setVoxelFunc((bgValue, idx) => {
        return bgValue[0] > threshold;
      });
    });

    this.setState({
      threshold,
    });
  };

  clearLabelMap = () => {
    const labelMapImageData = this.state.paintFilterLabelMapImageData;
    const numberOfPoints = labelMapImageData.getNumberOfPoints();
    const values = new Float32Array(numberOfPoints);
    const dataArray = vtkDataArray.newInstance({
      numberOfComponents: 1, // labelmap with single component
      values,
    });

    labelMapImageData.getPointData().setScalars(dataArray);
    labelMapImageData.modified();

    this.rerenderAllViewports();
  };

  saveApiReference = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      this.setThresholdFromValue(this.state.threshold);
    };
  };

  rerenderAllViewports = () => {
    // Update all render windows, since the automatic re-render might not
    // happen if the viewport is not currently using the painting widget
    Object.keys(this.apis).forEach(viewportIndex => {
      const renderWindow = this.apis[
        viewportIndex
      ].genericRenderWindow.getRenderWindow();

      renderWindow.render();
    });
  };

  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return null;
    }

    return (
      <div className="row">
        <div className="col-xs-12">
          <h1>Image Segmentation via Paint Widget</h1>
          <p>
            This example demonstrates how to use VTK&apos;s PaintWidget and
            PaintFilter to perform manual segmentation.
          </p>
          <p>
            The painting tools can be toggled on/off. When painting is off,
            multiplanar reformatting rotation through the volume is enabled.
          </p>
          <p>
            Both components are displaying the same labelmap passed in as a{' '}
            <code>vtkImageData</code> object. Painting in one component will
            update the labelmap in the other view, even though each maintains
            their own instances and configurations of the PaintWidget,
            PaintFilter, and VolumeMappers required for interaction and
            rendering.
          </p>
          <p>
            A &quot;Clear label map&quot; button is provided to demonstrate how
            to interact with the labelmap externally from the components, e.g.
            to load a previously-created segmentation map.
          </p>
          <p>
            <strong>Note:</strong> The PaintWidget (circle on hover) is not
            currently visible in the 2D View component.
          </p>
          <hr />
        </div>
        <div className="col-xs-12">
          <label>
            <input
              type="radio"
              value="rotate"
              name="widget"
              onChange={this.setWidget}
              checked={this.state.focusedWidgetId === null}
            />{' '}
            Rotate
          </label>
          <label>
            <input
              type="radio"
              value="PaintWidget"
              name="widget"
              onChange={this.setWidget}
              checked={this.state.focusedWidgetId === 'PaintWidget'}
            />
            Paint
          </label>
          <button className="btn btn-danger" onClick={this.clearLabelMap}>
            Clear label map
          </button>
          <label>
            <input
              type="number"
              step={100}
              value={this.state.threshold}
              name="paint-threshold"
              onChange={this.setThreshold}
            />
            Threshold
          </label>
        </div>
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            paintFilterBackgroundImageData={
              this.state.paintFilterBackgroundImageData
            }
            paintFilterLabelMapImageData={
              this.state.paintFilterLabelMapImageData
            }
            onCreated={this.saveApiReference(0)}
            painting={this.state.focusedWidgetId === 'PaintWidget'}
          />
        </div>
        {
          <div className="col-xs-12 col-sm-6">
            <View3D
              volumes={this.state.volumeRenderingVolumes}
              paintFilterBackgroundImageData={
                this.state.paintFilterBackgroundImageData
              }
              paintFilterLabelMapImageData={
                this.state.paintFilterLabelMapImageData
              }
              onCreated={this.saveApiReference(1)}
              painting={this.state.focusedWidgetId === 'PaintWidget'}
            />
          </div>
        }
      </div>
    );
  }
}

export default VTKMPRPaintingExample;
