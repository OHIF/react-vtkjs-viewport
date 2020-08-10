import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';

import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { createSub } from '../lib/createSub.js';
import createLabelPipeline from './createLabelPipeline';

export default class View3D extends Component {
  static propTypes = {
    volumes: PropTypes.array,
    actors: PropTypes.array,
    painting: PropTypes.bool.isRequired,
    paintFilterBackgroundImageData: PropTypes.object,
    paintFilterLabelMapImageData: PropTypes.object,
    onPaint: PropTypes.func,
    onPaintStart: PropTypes.func,
    onPaintEnd: PropTypes.func,
    sliceNormal: PropTypes.array.isRequired,
    dataDetails: PropTypes.object,
    onCreated: PropTypes.func,
    onDestroyed: PropTypes.func,
    labelmapRenderingOptions: PropTypes.object,
  };

  static defaultProps = {
    painting: false,
    sliceNormal: [0, 0, 1],
    labelmapRenderingOptions: {
      visible: true,
      renderOutline: false,
    },
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

  componentDidMount() {
    this.genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0, 0, 0],
    });

    this.genericRenderWindow.setContainer(this.container.current);

    let widgets = [];
    let filters = [];
    let actors = [];
    let volumes = [];

    const radius = 5;
    const label = 1;

    this.renderer = this.genericRenderWindow.getRenderer();
    this.renderWindow = this.genericRenderWindow.getRenderWindow();

    this.widgetManager.disablePicking();
    this.widgetManager.setRenderer(this.renderer);
    this.paintWidget = vtkPaintWidget.newInstance();
    this.paintWidget.setRadius(radius);
    this.paintFilter = vtkPaintFilter.newInstance();
    this.paintFilter.setLabel(label);
    this.paintFilter.setRadius(radius);

    // trigger pipeline update
    this.componentDidUpdate({});

    if (this.props.actors) {
      actors = actors.concat(this.props.actors);
    }

    if (this.labelmap && this.labelmap.actor) {
      actors = actors.concat(this.labelmap.actor);
    }

    if (this.props.volumes) {
      volumes = volumes.concat(this.props.volumes);
    }

    filters = [this.paintFilter];
    widgets = [this.paintWidget];

    // must be added AFTER the data volume is added so that this can be rendered in front
    if (this.labelmap && this.labelmap.actor) {
      this.renderer.addVolume(this.labelmap.actor);
    }

    this.renderer.resetCamera();
    this.renderer.updateLightsGeometryToFollowCamera();

    // TODO: Not sure why this is necessary to force the initial draw
    this.genericRenderWindow.resize();

    if (this.props.onCreated) {
      /**
       * Note: The contents of this Object are
       * considered part of the API contract
       * we make with consumers of this component.
       */
      const api = {
        genericRenderWindow: this.genericRenderWindow,
        widgetManager: this.widgetManager,
        container: this.container.current,
        widgets,
        filters,
        actors,
        volumes,
        type: 'VIEW3D',
        _component: this, // Backdoor still open for now whilst the API isn't as mature as View2D.
      };

      this.props.onCreated(api);
    }
  }

  componentDidUpdate(prevProps) {
    console.time('View3D componentDidUpdate');
    if (prevProps.volumes !== this.props.volumes) {
      this.props.volumes.forEach(volume => {
        if (!volume.isA('vtkVolume')) {
          console.warn('Data to <Vtk2D> is not vtkVolume data');
        }
      });

      if (this.props.volumes.length) {
        this.props.volumes.forEach(this.renderer.addVolume);
      } else {
        // TODO: Remove all volumes
      }

      this.renderWindow.render();
    }

    if (prevProps.actors !== this.props.actors && this.props.actors) {
      this.props.actors.forEach(actor => {
        if (!actor.isA('vtkActor')) {
          console.warn('Data to <Vtk2D> is not vtkActor data');
        }
      });

      if (this.props.actors.length) {
        this.props.actors.forEach(this.renderer.addActor);
      } else {
        // TODO: Remove all actors
      }

      this.renderWindow.render();
    }

    if (
      !prevProps.paintFilterBackgroundImageData &&
      this.props.paintFilterBackgroundImageData
    ) {
      // re-render if data has updated
      this.subs.data.sub(
        this.props.paintFilterBackgroundImageData.onModified(() =>
          this.renderWindow.render()
        )
      );
      this.paintFilter.setBackgroundImage(
        this.props.paintFilterBackgroundImageData
      );
    } else if (
      prevProps.paintFilterBackgroundImageData &&
      !this.props.paintFilterBackgroundImageData
    ) {
      this.paintFilter.setBackgroundImage(null);
      this.subs.data.unsubscribe();
    }

    if (
      prevProps.paintFilterLabelMapImageData !==
        this.props.paintFilterLabelMapImageData &&
      this.props.paintFilterLabelMapImageData
    ) {
      this.subs.labelmap.unsubscribe();

      const labelmapImageData = this.props.paintFilterLabelMapImageData;
      const labelmap = createLabelPipeline(
        this.props.paintFilterBackgroundImageData,
        labelmapImageData,
        this.props.labelmapRenderingOptions,
        false
      );

      this.labelmap = labelmap;

      labelmap.mapper.setInputConnection(this.paintFilter.getOutputPort());

      // You can update the labelmap externally just by calling modified()
      this.paintFilter.setLabelMap(labelmapImageData);
      this.subs.labelmap.sub(
        labelmapImageData.onModified(() => {
          labelmap.mapper.modified();

          this.renderWindow.render();
        })
      );
    }

    if (prevProps.painting !== this.props.painting) {
      if (this.props.painting) {
        console.time('turnOnPainting');
        this.viewWidget = this.widgetManager.addWidget(
          this.paintWidget,
          ViewTypes.VOLUME
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
        console.timeEnd('turnOnPainting');
      } else if (this.viewWidget) {
        console.time('turnOffPainting');
        this.widgetManager.releaseFocus();
        this.widgetManager.removeWidget(this.paintWidget);
        this.widgetManager.disablePicking();

        this.subs.paintStart.unsubscribe();
        this.subs.paint.unsubscribe();
        this.subs.paintEnd.unsubscribe();
        this.viewWidget = null;
        console.timeEnd('turnOffPainting');
      }
    }

    console.timeEnd('View3D componentDidUpdate');
  }

  componentWillUnmount() {
    Object.keys(this.subs).forEach(k => {
      this.subs[k].unsubscribe();
    });

    if (this.props.onDestroyed) {
      this.props.onDestroyed();
    }

    this.genericRenderWindow.delete();
  }

  render() {
    if (!this.props.volumes && !this.props.actors) {
      return null;
    }

    const style = { width: '100%', height: '100%', position: 'relative' };

    let voi = {
      windowCenter: 0,
      windowWidth: 0,
    };

    if (this.pipeline) {
      const actor = this.props.volumes[0];

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
