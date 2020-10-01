import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';
import vtkSVGWidgetManager from './vtkSVGWidgetManager';

import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { createSub } from '../lib/createSub.js';
import realsApproximatelyEqual from '../lib/math/realsApproximatelyEqual';
import createLabelPipeline from './createLabelPipeline';
import { uuidv4 } from './../helpers';
import setGlobalOpacity from './setGlobalOpacity';

const minSlabThickness = 0.1; // TODO -> Should this be configurable or not?

export default class View2D extends Component {
  static propTypes = {
    volumes: PropTypes.array.isRequired,
    actors: PropTypes.array,
    painting: PropTypes.bool.isRequired,
    paintFilterBackgroundImageData: PropTypes.object,
    paintFilterLabelMapImageData: PropTypes.object,
    onPaint: PropTypes.func,
    onPaintStart: PropTypes.func,
    onPaintEnd: PropTypes.func,
    dataDetails: PropTypes.object,
    onCreated: PropTypes.func,
    onDestroyed: PropTypes.func,
    orientation: PropTypes.object,
    labelmapRenderingOptions: PropTypes.object,
  };

  static defaultProps = {
    painting: false,
    labelmapRenderingOptions: {
      visible: true,
      renderOutline: true,
      segmentsDefaultProperties: [],
      onNewSegmentationRequested: () => { }
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
    this.interactorStyleSubs = [];
    this.state = {
      voi: this.getVOI(props.volumes[0])
    };

    this.apiProperties = {};
  }

  updatePaintbrush() {
    const manip = this.paintWidget.getManipulator();
    const handle = this.paintWidget.getWidgetState().getHandle();
    const camera = this.paintRenderer.getActiveCamera();
    const normal = camera.getDirectionOfProjection();
    manip.setNormal(...normal);
    manip.setOrigin(...camera.getFocalPoint());
    handle.rotateFromDirections(handle.getDirection(), normal);
  }

  componentDidMount() {
    // Tracking ID to tie emitted events to this component
    const uid = uuidv4();

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
    const oglrw = this.genericRenderWindow.getOpenGLRenderWindow();

    // add paint renderer
    this.paintRenderer = vtkRenderer.newInstance();
    this.renderWindow.addRenderer(this.paintRenderer);
    this.renderWindow.setNumberOfLayers(2);
    this.paintRenderer.setLayer(1);
    this.paintRenderer.setInteractive(false);

    // update view node tree so that vtkOpenGLHardwareSelector can access
    // the vtkOpenGLRenderer instance.
    oglrw.buildPass(true);

    const istyle = vtkInteractorStyleMPRSlice.newInstance();
    this.renderWindow.getInteractor().setInteractorStyle(istyle);

    const inter = this.renderWindow.getInteractor();
    const updateCameras = () => {
      const baseCamera = this.renderer.getActiveCamera();
      const paintCamera = this.paintRenderer.getActiveCamera();

      const position = baseCamera.getReferenceByName('position');
      const focalPoint = baseCamera.getReferenceByName('focalPoint');
      const viewUp = baseCamera.getReferenceByName('viewUp');
      const viewAngle = baseCamera.getReferenceByName('viewAngle');

      paintCamera.set({
        position,
        focalPoint,
        viewUp,
        viewAngle,
      });
    };
    // TODO unsubscribe from this before component unmounts.
    inter.onAnimation(updateCameras);
    updateCameras();

    this.widgetManager.disablePicking();
    this.widgetManager.setRenderer(this.paintRenderer);
    this.paintWidget = vtkPaintWidget.newInstance();
    this.paintWidget.setRadius(radius);
    this.paintFilter = vtkPaintFilter.newInstance();
    this.paintFilter.setLabel(label);
    this.paintFilter.setRadius(radius);

    // trigger pipeline update
    this.componentDidUpdate({});

    // must be added AFTER the data volume is added so that this can be rendered in front
    if (this.labelmap && this.labelmap.actor) {
      this.renderer.addVolume(this.labelmap.actor);
    }

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

    // Set orientation based on props
    if (this.props.orientation) {
      const { orientation } = this.props;

      istyle.setSliceOrientation(orientation.sliceNormal, orientation.viewUp);
    } else {
      istyle.setSliceNormal(0, 0, 1);
    }

    const camera = this.renderer.getActiveCamera();

    camera.setParallelProjection(true);
    this.renderer.resetCamera();

    istyle.setVolumeActor(this.props.volumes[0]);
    const range = istyle.getSliceRange();
    istyle.setSlice((range[0] + range[1]) / 2);

    istyle.onModified(() => {
      this.updatePaintbrush();
    });
    this.updatePaintbrush();

    const svgWidgetManager = vtkSVGWidgetManager.newInstance();

    svgWidgetManager.setRenderer(this.renderer);
    svgWidgetManager.setScale(1);

    this.svgWidgetManager = svgWidgetManager;

    // TODO: Not sure why this is necessary to force the initial draw
    this.genericRenderWindow.resize();

    const boundUpdateVOI = this.updateVOI.bind(this);
    const boundGetOrienation = this.getOrientation.bind(this);
    const boundSetInteractorStyle = this.setInteractorStyle.bind(this);
    const boundGetSlabThickness = this.getSlabThickness.bind(this);
    const boundSetSlabThickness = this.setSlabThickness.bind(this);
    const boundAddSVGWidget = this.addSVGWidget.bind(this);
    const boundGetApiProperty = this.getApiProperty.bind(this);
    const boundSetApiProperty = this.setApiProperty.bind(this);
    const boundSetSegmentRGB = this.setSegmentRGB.bind(this);
    const boundSetSegmentRGBA = this.setSegmentRGBA.bind(this);
    const boundSetSegmentAlpha = this.setSegmentAlpha.bind(this);
    const boundUpdateImage = this.updateImage.bind(this);
    const boundSetSegmentVisibility = this.setSegmentVisibility.bind(this);
    const boundSetGlobalOpacity = this.setGlobalOpacity.bind(this);
    const boundSetVisibility = this.setVisibility.bind(this);
    const boundSetOutlineThickness = this.setOutlineThickness.bind(this);
    const boundOutlineRendering = this.setOutlineRendering.bind(this);
    const boundRequestNewSegmentation = this.requestNewSegmentation.bind(this);

    this.svgWidgets = {};

    if (this.props.onCreated) {
      /**
       * Note: The contents of this Object are
       * considered part of the API contract
       * we make with consumers of this component.
       */
      const api = {
        uid, // Tracking id available on `api`
        genericRenderWindow: this.genericRenderWindow,
        widgetManager: this.widgetManager,
        svgWidgetManager: this.svgWidgetManager,
        addSVGWidget: boundAddSVGWidget,
        container: this.container.current,
        widgets,
        svgWidgets: this.svgWidgets,
        filters,
        actors,
        volumes,
        _component: this,
        updateImage: boundUpdateImage,
        updateVOI: boundUpdateVOI,
        getOrientation: boundGetOrienation,
        setInteractorStyle: boundSetInteractorStyle,
        getSlabThickness: boundGetSlabThickness,
        setSlabThickness: boundSetSlabThickness,
        setSegmentRGB: boundSetSegmentRGB,
        setSegmentRGBA: boundSetSegmentRGBA,
        setSegmentAlpha: boundSetSegmentAlpha,
        setSegmentVisibility: boundSetSegmentVisibility,
        setGlobalOpacity: boundSetGlobalOpacity,
        setVisibility: boundSetVisibility,
        setOutlineThickness: boundSetOutlineThickness,
        setOutlineRendering: boundOutlineRendering,
        requestNewSegmentation: boundRequestNewSegmentation,
        get: boundGetApiProperty,
        set: boundSetApiProperty,
        type: 'VIEW2D',
      };

      this.props.onCreated(api);
    }
  }

  getApiProperty(propertyName) {
    return this.apiProperties[propertyName];
  }

  setApiProperty(propertyName, value) {
    this.apiProperties[propertyName] = value;
  }

  addSVGWidget(widget, name) {
    const { svgWidgetManager } = this;

    svgWidgetManager.addWidget(widget);
    svgWidgetManager.render();

    this.svgWidgets[name] = widget;
  }

  getSlabThickness() {
    const renderWindow = this.genericRenderWindow.getRenderWindow();
    const currentIStyle = renderWindow.getInteractor().getInteractorStyle();

    if (currentIStyle.getSlabThickness) {
      return currentIStyle.getSlabThickness();
    }
  }

  setSlabThickness(slabThickness) {
    const renderWindow = this.genericRenderWindow.getRenderWindow();
    const istyle = renderWindow.getInteractor().getInteractorStyle();

    if (istyle.setSlabThickness) {
      istyle.setSlabThickness(slabThickness);

      if (this.props.paintFilterLabelMapImageData) {
        const labelmapActor = this.labelmap.actor;

        if (realsApproximatelyEqual(slabThickness, minSlabThickness)) {
          if (
            labelmapActor.getVisibility() !==
            this.props.labelmapRenderingOptions.visible
          ) {
            labelmapActor.setVisibility(
              this.props.labelmapRenderingOptions.visible
            );
          }
        } else {
          labelmapActor.setVisibility(false);
        }
      }
    }

    renderWindow.render();
  }

  updateImage() {
    const renderWindow = this.genericRenderWindow.getRenderWindow();

    renderWindow.render();
  }

  setInteractorStyle({ istyle, callbacks = {}, configuration = {} }) {
    const { volumes } = this.props;
    const renderWindow = this.genericRenderWindow.getRenderWindow();
    const currentIStyle = renderWindow.getInteractor().getInteractorStyle();

    // unsubscribe from previous iStyle's callbacks.
    while (this.interactorStyleSubs.length) {
      this.interactorStyleSubs.pop().unsubscribe();
    }

    let currentViewport;
    if (currentIStyle.getViewport && istyle.getViewport) {
      currentViewport = currentIStyle.getViewport();
    }

    const slabThickness = this.getSlabThickness();
    const interactor = renderWindow.getInteractor();

    interactor.setInteractorStyle(istyle);

    // TODO: Not sure why this is required the second time this function is called
    istyle.setInteractor(interactor);

    if (currentViewport) {
      istyle.setViewport(currentViewport);
    }

    if (istyle.getVolumeActor() !== volumes[0]) {
      if (slabThickness && istyle.setSlabThickness) {
        istyle.setSlabThickness(slabThickness);
      }

      istyle.setVolumeActor(volumes[0]);
    }

    // Add appropriate callbacks
    Object.keys(callbacks).forEach(key => {
      if (typeof istyle[key] === 'function') {
        const subscription = istyle[key](callbacks[key]);

        if (subscription && typeof subscription.unsubscribe === 'function') {
          this.interactorStyleSubs.push(subscription);
        }
      }
    });

    // Set Configuration
    if (configuration) {
      istyle.set(configuration);
    }

    renderWindow.render();
  }

  updateVOI(windowWidth, windowCenter) {
    this.setState({ voi: { windowWidth, windowCenter } });
  }

  getOrientation() {
    return this.props.orientation;
  }

  setSegmentRGBA(segmentIndex, [red, green, blue, alpha]) {
    this.setSegmentRGB(segmentIndex, [red, green, blue]);
    this.setSegmentAlpha(segmentIndex, alpha);
  }

  setGlobalOpacity(globalOpacity) {
    const { labelmap } = this;
    const colorLUT = this.props.labelmapRenderingOptions.colorLUT;
    setGlobalOpacity(labelmap, colorLUT, globalOpacity);
  }

  setVisibility(visible) {
    const { labelmap } = this;
    labelmap.actor.setVisibility(visible);
  }

  setOutlineThickness(outlineThickness) {
    const { labelmap } = this;
    labelmap.actor.getProperty().setLabelOutlineThickness(outlineThickness);
  }

  setOutlineRendering(renderOutline) {
    const { labelmap } = this;
    labelmap.actor.getProperty().setUseLabelOutline(renderOutline);
  }

  requestNewSegmentation() {
    this.props.labelmapRenderingOptions.onNewSegmentationRequested();
  }

  setSegmentRGB(segmentIndex, [red, green, blue]) {
    const { labelmap } = this;

    labelmap.cfun.addRGBPoint(segmentIndex, red / 255, green / 255, blue / 255);
  }

  setSegmentVisibility(segmentIndex, isVisible) {
    this.setSegmentAlpha(segmentIndex, isVisible ? 255 : 0);
  }

  setSegmentAlpha(segmentIndex, alpha) {
    const { labelmap } = this;
    let { globalOpacity } = this.props.labelmapRenderingOptions;

    if (globalOpacity === undefined) {
      globalOpacity = 1.0;
    }

    const segmentOpacity = (alpha / 255) * globalOpacity;

    labelmap.ofun.addPointLong(segmentIndex, segmentOpacity, 0.5, 1.0);
  }

  componentDidUpdate(prevProps) {
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

    if (
      !prevProps.paintFilterBackgroundImageData &&
      this.props.paintFilterBackgroundImageData
    ) {
      // re-render if data has updated
      this.subs.data.sub(
        this.props.paintFilterBackgroundImageData.onModified(() => {
          this.genericRenderWindow.resize();
          this.renderWindow.render();
        })
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

      // Remove actors.
      if (this.labelmap && this.labelmap.actor) {
        this.renderer.removeVolume(this.labelmap.actor);

        if (this.api) {
          const { actors } = this.api;

          const index = actors.findIndex(
            actor => actor === this.labelmap.actor
          );

          if (index !== -1) {
            actors.splice(index, 1);
          }
        }
      }

      const labelmapImageData = this.props.paintFilterLabelMapImageData;

      const labelmap = createLabelPipeline(
        this.props.paintFilterBackgroundImageData,
        labelmapImageData,
        this.props.labelmapRenderingOptions
      );

      this.labelmap = labelmap;

      this.props.labelmapRenderingOptions.segmentsDefaultProperties
        .forEach((properties, segmentNumber) => {
          if (properties) {
            this.setSegmentVisibility(segmentNumber, properties.visible);
          }
        });

      // Add actors.
      if (this.labelmap && this.labelmap.actor) {
        this.renderer.addVolume(this.labelmap.actor);

        if (this.api) {
          this.api.actors = this.api.actors.concat(this.labelmap.actor);
        }
      }

      labelmap.mapper.setInputConnection(this.paintFilter.getOutputPort());

      // You can update the labelmap externally just by calling modified()
      this.paintFilter.setLabelMap(labelmapImageData);
      this.subs.labelmap.sub(
        labelmapImageData.onModified(() => {
          labelmap.mapper.modified();

          this.renderWindow.render();
        })
      );

      this.genericRenderWindow.resize();
    }

    if (
      prevProps.labelmapRenderingOptions &&
      prevProps.labelmapRenderingOptions.visible !==
      this.props.labelmapRenderingOptions.visible
    ) {
      this.labelmap.actor.setVisibility(
        prevProps.labelmapRenderingOptions.visible
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

        this.genericRenderWindow.resize();
      } else if (this.viewWidget) {
        this.widgetManager.releaseFocus();
        this.widgetManager.removeWidget(this.paintWidget);
        this.widgetManager.disablePicking();

        this.subs.paintStart.unsubscribe();
        this.subs.paint.unsubscribe();
        this.subs.paintEnd.unsubscribe();
        this.viewWidget = null;

        this.genericRenderWindow.resize();
      }
    }
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

  getVOI = actor => {
    // Note: This controls window/level

    // TODO: Make this work reactively with onModified...
    const rgbTransferFunction = actor.getProperty().getRGBTransferFunction(0);
    const range = rgbTransferFunction.getMappingRange();
    const windowWidth = Math.abs(range[1] - range[0]);
    const windowCenter = range[0] + windowWidth / 2;

    return {
      windowCenter,
      windowWidth,
    };
  };

  render() {
    if (!this.props.volumes || !this.props.volumes.length) {
      return null;
    }

    const style = { width: '100%', height: '100%', position: 'relative' };
    const voi = this.state.voi;

    return (
      <div style={style}>
        <div ref={this.container} style={style} />
        <ViewportOverlay {...this.props.dataDetails} voi={voi} />
      </div>
    );
  }
}
