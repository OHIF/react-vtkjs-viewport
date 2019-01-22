import React, { Component } from 'react';
import PropTypes from 'prop-types';
import VTKViewport from '../VTKViewport/VTKViewport';

import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';

class VTKMPRViewport extends Component {
  state = {
    renderWindowData: []
  };

  static defaultProps = {
    background: [0, 0, 0]
  };

  static propTypes = {
    background: PropTypes.arrayOf(PropTypes.number).isRequired,
    inputData: PropTypes.object.isRequired
  };

  componentDidMount() {
    const { inputData, background } = this.props;

    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeMapper.setInputData(inputData);
    volumeActor.setMapper(volumeMapper);

    const radius = 10;
    const paintWidget = vtkPaintWidget.newInstance();
    paintWidget.setRadius(radius);

    paintWidget.setColor([1, 0, 0]);

    // Paint filter
    const paintFilter = vtkPaintFilter.newInstance();

    const labelMap = {
      actor: vtkVolume.newInstance(),
      mapper: vtkVolumeMapper.newInstance(),
      cfun: vtkColorTransferFunction.newInstance(),
      ofun: vtkPiecewiseFunction.newInstance()
    };

    // labelmap pipeline
    labelMap.actor.setMapper(labelMap.mapper);
    labelMap.mapper.setInputConnection(paintFilter.getOutputPort());

    // set up labelMap color and opacity mapping
    labelMap.cfun.addRGBPoint(1, 0, 0, 1); // label "1" will be blue
    labelMap.ofun.addPoint(0, 0); // our background value, 0, will be invisible
    labelMap.ofun.addPoint(1, 1); // all values above 1 will be fully opaque

    labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
    labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);

    // update paint filter
    paintFilter.setBackgroundImage(inputData);
    // don't set to 0, since that's our empty label color from our pwf
    paintFilter.setLabel(1);
    paintFilter.setRadius(radius);
    // set custom threshold
    const threshold = 1;
    paintFilter.setVoxelFunc((bgValue, label, idx) => {
      if (bgValue > threshold) {
        return label;
      }
      return null;
    });

    const interactorOnModified = interactorStyle => {
      console.log('interactorOnModified');

      const position = [0, 0, 0];
      const normal = interactorStyle.getSliceNormal();
      const slice = interactorStyle.getSlice();

      console.log(`normal: ${normal}`);
      console.log(`slice: ${slice}`);

      // Obtain position
      const origin = interactorStyle.getSliceNormal().slice();
      vtkMath.multiplyScalar(origin, slice);
      paintWidget.getManipulator().setOrigin(origin);

      // The PlaneWidget exposes a 'manipulator' which is a circle
      // displayed over the viewport. It's location is set in IJK
      // coordinates
      const inverted = interactorStyle.getSliceNormal().slice();
      vtkMath.multiplyScalar(inverted, -1);
      paintWidget.getManipulator().setNormal(inverted);

      const handle = paintWidget.getWidgetState().getHandle();
      handle.rotateFromDirections(handle.getDirection(), inverted);
    };

    const paintWidgetSetup = {
      vtkWidget: paintWidget,
      viewType: ViewTypes.SLICE,
      callbacks: {
        onStartInteractionEvent: () => {
          paintFilter.startStroke();
          paintFilter.addPoint(paintWidget.getWidgetState().getTrueOrigin());
        },
        onInteractionEvent: widgetHandle => {
          if (widgetHandle.getPainting()) {
            paintFilter.addPoint(paintWidget.getWidgetState().getTrueOrigin());
          }
        },
        onEndInteractionEvent: () => {
          paintFilter.endStroke();
        }
      }
    };

    const renderWindowData = this.state.renderWindowData;
    renderWindowData[0] = {
      background,
      interactorStyle: {
        name: 'rotate',
        callbacks: {
          onModified: interactorOnModified
        }
      },
      vtkVolumeActors: [volumeActor, labelMap.actor],
      widgets: [paintWidgetSetup]
    };

    this.setState({
      renderWindowData
    });
  }

  render() {
    return <VTKViewport renderWindowData={this.state.renderWindowData} />;
  }
}

export default VTKMPRViewport;
