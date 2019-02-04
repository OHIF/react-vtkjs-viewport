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

  return { mapper, actor };
}

export default class Vtk3D extends React.Component {
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

    if (prevProps.colorMap !== this.props.colorMap) {
      if (this.props.colorMap) {
        const cfun = vtkColorTransferFunction.newInstance();

        Object.keys(this.props.colorMap).forEach(label => {
          const color = this.props.colorMap[label];
          cfun.addRGBPoint(label, ...color);
        });
        this.pipeline.actor.getProperty().setRGBTransferFunction(0, cfun);
      } else {
        this.pipeline.actor.getProperty().setRGBTransferFunction(0, null);
      }
    }

    if (prevProps.opacityMap !== this.props.opacityMap) {
      if (this.props.opacityMap) {
        const ofun = vtkPiecewiseFunction.newInstance();

        Object.keys(this.props.opacityMap).forEach(label => {
          const opacity = this.props.opacityMap[label];
          ofun.addPoint(label, opacity);
        });
        this.pipeline.actor.getProperty().setScalarOpacity(0, ofun);
      } else {
        this.pipeline.actor.getProperty().setScalarOpacity(0, null);
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
