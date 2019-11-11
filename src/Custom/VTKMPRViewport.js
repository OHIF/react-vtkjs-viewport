import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { createSub } from '../lib/createSub.js';

function createPipeline() {
  const data = {
    mapper: vtkVolumeMapper.newInstance(),
    actor: vtkVolume.newInstance(),
  };

  data.actor.setMapper(data.mapper);

  return data;
}

function createLabelPipeline() {
  const labelMap = {
    actor: vtkVolume.newInstance(),
    mapper: vtkVolumeMapper.newInstance(),
    cfun: vtkColorTransferFunction.newInstance(),
    ofun: vtkPiecewiseFunction.newInstance(),
  };

  // labelmap pipeline
  labelMap.actor.setMapper(labelMap.mapper);

  // set up labelMap color and opacity mapping
  labelMap.cfun.addRGBPoint(1, 0, 0, 1); // label "1" will be blue
  labelMap.ofun.addPoint(0, 0); // our background value, 0, will be invisible
  labelMap.ofun.addPoint(1, 1); // all values above 1 will be fully opaque

  labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
  labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);

  return labelMap;
}

export default class VtkMpr extends Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    painting: PropTypes.bool.isRequired,
    labelmap: PropTypes.object,
    onPaint: PropTypes.func,
    onPaintStart: PropTypes.func,
    onPaintEnd: PropTypes.func,
    sliceNormal: PropTypes.array.isRequired,
    dataDetails: PropTypes.object,
  };

  static defaultProps = {
    painting: false,
    sliceNormal: [0, 0, 1],
  };

  constructor(props) {
    super(props);

    this.genericRenderWindow = null;
    this.widgetManager = vtkWidgetManager.newInstance();
    this.container = React.createRef();
    this.subs = {
      interactor: createSub(),
      data: createSub(),
      labelmap: createSub(),
      paint: createSub(),
      paintStart: createSub(),
      paintEnd: createSub(),
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

  updatePaintbrush() {
    const manip = this.paintWidget.getManipulator();
    manip.setNormal(
      ...this.renderWindow
        .getInteractor()
        .getInteractorStyle()
        .getSliceNormal()
    );
    manip.setOrigin(...this.renderer.getActiveCamera().getFocalPoint());
  }

  componentDidMount() {
    this.genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0, 0, 0],
    });

    this.genericRenderWindow.setContainer(this.container.current);

    this.renderer = this.genericRenderWindow.getRenderer();
    this.renderWindow = this.genericRenderWindow.getRenderWindow();

    const istyle = vtkInteractorStyleMPRSlice.newInstance();
    this.istyle = istyle;
    this.renderWindow.getInteractor().setInteractorStyle(istyle);

    this.pipeline = createPipeline();
    this.labelPipeline = createLabelPipeline();

    this.widgetManager.setRenderer(this.renderer);
    this.paintWidget = vtkPaintWidget.newInstance();

    this.paintFilter = vtkPaintFilter.newInstance();
    this.paintFilter.setLabel(1);
    this.paintFilter.setRadius(10);
    this.labelPipeline.mapper.setInputConnection(
      this.paintFilter.getOutputPort()
    );

    // trigger pipeline update
    this.componentDidUpdate({});

    // must be added AFTER the data volume is added so that this can be rendered in front
    this.renderer.addVolume(this.labelPipeline.actor);

    istyle.setVolumeActor(this.pipeline.actor);
    istyle.setSliceNormal([0, 0, 1]);
    const range = istyle.getSliceRange();
    istyle.setSlice((range[0] + range[1]) / 2);

    istyle.onModified(() => {
      this.updatePaintbrush();
    });
    this.updatePaintbrush();

    // TODO: Not sure why this is necessary to force the initial draw
    this.genericRenderWindow.resize();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.data !== this.props.data) {
      if (this.props.data && !this.props.data.isA('vtkImageData')) {
        console.warn('Data to <Vtk2D> is not image data');
      } else {
        this.updatePipeline();

        if (!prevProps.data && this.props.data) {
          this.renderer.addVolume(this.pipeline.actor);

          // re-render if data has updated
          this.subs.data.sub(
            this.props.data.onModified(() => this.renderWindow.render())
          );
          this.paintFilter.setBackgroundImage(this.props.data);
        } else if (prevProps.data && !this.props.data) {
          this.paintFilter.setBackgroundImage(null);
          this.renderer.removeVolume(this.pipeline.actor);
          this.subs.data.unsubscribe();
        }

        this.renderWindow.render();
      }
    }

    if (prevProps.labelmap !== this.props.labelmap && this.props.labelmap) {
      this.subs.labelmap.unsubscribe();
      // You can update the labelmap externally just by calling modified()
      this.paintFilter.setLabelMap(this.props.labelmap);
      this.subs.labelmap.sub(
        this.props.labelmap.onModified(() => {
          this.labelPipeline.mapper.modified();
          this.renderWindow.render();
        })
      );
    }

    if (prevProps.painting !== this.props.painting) {
      if (this.props.painting) {
        this.viewWidget = this.widgetManager.addWidget(
          this.paintWidget,
          ViewTypes.SLICE
        );
        this.subs.paintStart.sub(
          this.viewWidget.onStartInteractionEvent(() => {
            this.paintFilter.startStroke();
            this.paintFilter.addPoint(
              this.paintWidget.getWidgetState().getTrueOrigin()
            );
            if (this.props.onPaintStart) {
              this.props.onPaintStart();
            }
          })
        );
        this.subs.paint.sub(
          this.viewWidget.onInteractionEvent(() => {
            if (this.viewWidget.getPainting()) {
              this.paintFilter.addPoint(
                this.paintWidget.getWidgetState().getTrueOrigin()
              );
              if (this.props.onPaint) {
                this.props.onPaint();
              }
            }
          })
        );
        this.subs.paintEnd.sub(
          this.viewWidget.onEndInteractionEvent(() => {
            const strokeBufferPromise = this.paintFilter.endStroke();

            if (this.props.onPaintEnd) {
              strokeBufferPromise.then(strokeBuffer => {
                this.props.onPaintEnd(strokeBuffer);
              });
            }
          })
        );

        this.widgetManager.grabFocus(this.paintWidget);
        this.widgetManager.enablePicking();
      } else if (this.viewWidget) {
        this.widgetManager.releaseFocus();
        this.widgetManager.removeWidget(this.paintWidget);
        this.widgetManager.disablePicking();

        this.subs.paintStart.unsubscribe();
        this.subs.paint.unsubscribe();
        this.subs.paintEnd.unsubscribe();
        this.viewWidget = null;
      }
    }

    if (prevProps.sliceNormal !== this.props.sliceNormal) {
      const istyle = this.istyle;
      istyle.setSliceNormal([...this.props.sliceNormal]);

      const range = istyle.getSliceRange();
      istyle.setSlice((range[0] + range[1]) / 2);

      this.renderWindow.render();
    }
  }

  componentWillUnmount() {
    Object.keys(this.subs).forEach(k => {
      this.subs[k].unsubscribe();
    });
  }

  render() {
    const style = { width: '100%', height: '100%' };

    let voi = {
      windowCenter: 0,
      windowWidth: 0,
    };
    if (this.pipeline) {
      const actor = this.pipeline.actor;

      // Note: This controls window/level
      const rgbTransferFunction = actor.getProperty().getRGBTransferFunction(0);
      const range = rgbTransferFunction.getMappingRange();
      const windowWidth = range[0] + range[1];
      const windowCenter = range[0] + windowWidth / 2;

      voi = {
        windowCenter,
        windowWidth,
      };
    }

    return (
      <div style={style}>
        <div ref={this.container} style={style} />
        <ViewportOverlay {...this.props.dataDetails} voi={voi} />
      </div>
    );
  }
}
