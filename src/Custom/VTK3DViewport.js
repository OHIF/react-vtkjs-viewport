import React from 'react';

import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

import { createSub } from './util';

function createPipeline() {
  const mapper = vtkVolumeMapper.newInstance();
  const actor = vtkVolume.newInstance();
  actor.setMapper(mapper);

  const cfun = vtkColorTransferFunction.newInstance();
  const ofun = vtkPiecewiseFunction.newInstance();

  // set up labelMap color and opacity mapping
  cfun.addRGBPoint(1, 0, 0, 1); // label "1" will be blue
  ofun.addPoint(0, 0); // our background value, 0, will be invisible
  ofun.addPoint(1, 1); // all values above 1 will be fully opaque

  actor.getProperty().setRGBTransferFunction(0, cfun);
  actor.getProperty().setScalarOpacity(0, ofun);

  return { mapper, actor };
}

export default class VtkMpr extends React.Component {
  constructor(props) {
    super(props);

    this.fullScreenRenderer = null;
    this.widgetManager = vtkWidgetManager.newInstance();
    this.container = React.createRef();
    this.subs = {
      data: createSub()
    };
  }

  updatePipeline() {
    const { mapper } = this.pipeline;

    if (this.props.data) {
      mapper.setInputData(this.props.data);
    } else {
      mapper.setInputData(null);
    }
  }

  componentDidMount() {
    this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
      rootContainer: this.container.current,
      containerStyle: {}
    });
    this.renderer = this.fullScreenRenderer.getRenderer();
    this.renderWindow = this.fullScreenRenderer.getRenderWindow();

    this.pipeline = createPipeline();

    this.widgetManager.setRenderer(this.renderer);

    // trigger pipeline update
    this.componentDidUpdate({});
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data) {
      if (this.props.data && !this.props.data.isA('vtkImageData')) {
        console.warn('Data to <Vtk2D> is not image data');
      } else {
        this.updatePipeline();

        if (!prevProps.data && this.props.data) {
          this.renderer.addVolume(this.pipeline.actor);
          this.renderer.resetCamera();
          // re-render if data has updated
          this.subs.data.sub(
            this.props.data.onModified(() => {
              this.pipeline.mapper.modified();
              this.renderWindow.render();
            })
          );
        } else if (prevProps.data && !this.props.data) {
          this.renderer.removeVolume(this.pipeline.actor);
          this.subs.data.unsubscribe();
        }

        this.renderWindow.render();
      }
    }
  }

  componentWillUnmount() {
    Object.keys(this.subs).forEach(k => {
      this.subs[k].unsubscribe();
    });
  }

  render() {
    return <div ref={this.container} />;
  }
}
