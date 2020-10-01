import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkInteractorStyleImage from 'vtk.js/Sources/Interaction/Style/InteractorStyleImage';
import vtkSVGWidgetManager from './vtkSVGWidgetManager';
import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { createSub } from '../lib/createSub.js';
import { uuidv4 } from './../helpers';

export default class View2DImageMapper extends Component {
  static propTypes = {
    actors: PropTypes.array,
    labelmapActors: PropTypes.array,
    dataDetails: PropTypes.object,
    onCreated: PropTypes.func,
    onDestroyed: PropTypes.func,
    orientation: PropTypes.string.isRequired,
  };

  static defaultProps = { orientation: 'K' };

  constructor(props) {
    super(props);

    this.genericRenderWindow = null;
    this.widgetManager = vtkWidgetManager.newInstance();
    this.container = React.createRef();
    this.subs = {
      interactor: createSub(),
      data: createSub(),
      labelmap: createSub(),
    };
    this.interactorStyleSubs = [];
    this.state = {
      voi: this.getVOI(props.actors[0]),
    };

    this.apiProperties = {};
  }

  componentDidMount() {
    // Tracking ID to tie emitted events to this component
    const uid = uuidv4();

    this.genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background: [0, 0, 0],
    });

    this.genericRenderWindow.setContainer(this.container.current);
    this.renderWindow = this.genericRenderWindow.getRenderWindow();

    let widgets = [];
    let filters = [];
    let actors = this.props.actors;
    let labelmapActors = this.props.labelmapActors;

    const renderer = this.genericRenderWindow.getRenderer();

    this.renderer = renderer;
    this.renderWindow = this.genericRenderWindow.getRenderWindow();
    const oglrw = this.genericRenderWindow.getOpenGLRenderWindow();

    // Add labelmap only renderer so we can interact with source data
    this.labelmapRenderer = vtkRenderer.newInstance();

    const labelmapRenderer = this.labelmapRenderer;

    this.renderWindow.addRenderer(this.labelmapRenderer);
    this.renderWindow.setNumberOfLayers(2);
    labelmapRenderer.setLayer(1);
    labelmapRenderer.setInteractive(false);

    // update view node tree so that vtkOpenGLHardwareSelector can access
    // the vtkOpenGLRenderer instance.
    oglrw.buildPass(true);

    const iStyle = vtkInteractorStyleImage.newInstance();

    iStyle.setInteractionMode('IMAGE_SLICING');
    this.renderWindow.getInteractor().setInteractorStyle(iStyle);

    const inter = this.renderWindow.getInteractor();
    const updateCameras = () => {
      const baseCamera = this.renderer.getActiveCamera();
      const labelmapCamera = this.labelmapRenderer.getActiveCamera();

      const position = baseCamera.getReferenceByName('position');
      const focalPoint = baseCamera.getReferenceByName('focalPoint');
      const viewUp = baseCamera.getReferenceByName('viewUp');
      const viewAngle = baseCamera.getReferenceByName('viewAngle');

      labelmapCamera.set({
        position,
        focalPoint,
        viewUp,
        viewAngle,
      });
    };
    // TODO unsubscribe from this before component unmounts.
    inter.onAnimation(updateCameras);

    this.widgetManager.disablePicking();
    this.widgetManager.setRenderer(this.labelmapRenderer);

    // Add all actors to renderer
    actors.forEach(actor => {
      renderer.addViewProp(actor);
    });

    labelmapActors.forEach(actor => {
      labelmapRenderer.addViewProp(actor);
    });

    let sliceMode;

    const imageActor = actors[0];
    const imageMapper = imageActor.getMapper();
    const actorVTKImageData = imageMapper.getInputData();
    const dimensions = actorVTKImageData.getDimensions();

    let dimensionsOfSliceDirection;

    const { orientation } = this.props;

    // Use orientation prob to set slice direction
    switch (orientation) {
      case 'I':
        sliceMode = vtkImageMapper.SlicingMode.I;
        dimensionsOfSliceDirection = dimensions[0];
        break;
      case 'J':
        sliceMode = vtkImageMapper.SlicingMode.J;
        dimensionsOfSliceDirection = dimensions[1];
        break;
      case 'K':
        sliceMode = vtkImageMapper.SlicingMode.K;
        dimensionsOfSliceDirection = dimensions[2];
        break;
    }

    // Set source data
    actors.forEach(actor => {
      // Set slice orientation/mode and camera view
      actor.getMapper().setSlicingMode(sliceMode);

      // Set middle slice.
      actor.getMapper().setSlice(Math.floor(dimensionsOfSliceDirection / 2));
    });

    // Set labelmaps
    labelmapActors.forEach(actor => {
      // Set slice orientation/mode and camera view
      actor.getMapper().setSlicingMode(sliceMode);

      // Set middle slice.
      actor.getMapper().setSlice(Math.floor(dimensionsOfSliceDirection / 2));
    });

    // Update slices of labelmaps when source data slice changed
    imageMapper.onModified(() => {
      labelmapActors.forEach(actor => {
        actor.getMapper().setSlice(imageMapper.getSlice());
      });
    });

    // Set up camera

    const camera = this.renderer.getActiveCamera();

    camera.setParallelProjection(true);

    // set 2D camera position
    this.setCamera(sliceMode, renderer, actorVTKImageData);

    const svgWidgetManager = vtkSVGWidgetManager.newInstance();

    svgWidgetManager.setRenderer(this.renderer);
    svgWidgetManager.setScale(1);

    this.svgWidgetManager = svgWidgetManager;

    // TODO: Not sure why this is necessary to force the initial draw
    this.renderer.resetCamera();
    this.labelmapRenderer.resetCamera();
    this.genericRenderWindow.resize();

    updateCameras();

    this.renderWindow.render();

    const boundUpdateVOI = this.updateVOI.bind(this);
    const boundGetOrienation = this.getOrientation.bind(this);
    const boundSetInteractorStyle = this.setInteractorStyle.bind(this);
    const boundAddSVGWidget = this.addSVGWidget.bind(this);
    const boundGetApiProperty = this.getApiProperty.bind(this);
    const boundSetApiProperty = this.setApiProperty.bind(this);
    const boundSetCamera = this.setCamera.bind(this);
    const boundUpdateImage = this.updateImage.bind(this);

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
        _component: this,
        updateImage: boundUpdateImage,
        updateVOI: boundUpdateVOI,
        getOrientation: boundGetOrienation,
        setInteractorStyle: boundSetInteractorStyle,
        setCamera: boundSetCamera,
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

  updateImage() {
    const renderWindow = this.genericRenderWindow.getRenderWindow();

    renderWindow.render();
  }

  setInteractorStyle({ istyle, callbacks = {}, configuration = {} }) {
    // TODO -> we may have different interactor styles here.
    // const { volumes } = this.props;
    // const renderWindow = this.genericRenderWindow.getRenderWindow();
    // const currentIStyle = renderWindow.getInteractor().getInteractorStyle();
    // // unsubscribe from previous iStyle's callbacks.
    // while (this.interactorStyleSubs.length) {
    //   this.interactorStyleSubs.pop().unsubscribe();
    // }
    // let currentViewport;
    // if (currentIStyle.getViewport && istyle.getViewport) {
    //   currentViewport = currentIStyle.getViewport();
    // }
    // const slabThickness = this.getSlabThickness();
    // const interactor = renderWindow.getInteractor();
    // interactor.setInteractorStyle(istyle);
    // // TODO: Not sure why this is required the second time this function is called
    // istyle.setInteractor(interactor);
    // if (currentViewport) {
    //   istyle.setViewport(currentViewport);
    // }
    // if (istyle.getVolumeActor() !== volumes[0]) {
    //   if (slabThickness && istyle.setSlabThickness) {
    //     istyle.setSlabThickness(slabThickness);
    //   }
    //   istyle.setVolumeActor(volumes[0]);
    // }
    // // Add appropriate callbacks
    // Object.keys(callbacks).forEach(key => {
    //   if (typeof istyle[key] === 'function') {
    //     const subscription = istyle[key](callbacks[key]);
    //     if (subscription && typeof subscription.unsubscribe === 'function') {
    //       this.interactorStyleSubs.push(subscription);
    //     }
    //   }
    // });
    // // Set Configuration
    // if (configuration) {
    //   istyle.set(configuration);
    // }
    // renderWindow.render();
  }

  updateVOI(windowWidth, windowCenter) {
    this.setState({ voi: { windowWidth, windowCenter } });
  }

  getOrientation() {
    return this.props.orientation;
  }

  setCamera(sliceMode, renderer, data) {
    const ijk = [0, 0, 0];
    const position = [0, 0, 0];
    const focalPoint = [0, 0, 0];
    data.indexToWorldVec3(ijk, focalPoint);
    ijk[sliceMode] = 1;
    data.indexToWorldVec3(ijk, position);
    renderer.getActiveCamera().set({ focalPoint, position });
    renderer.resetCamera();
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
    const windowCenter = actor.getProperty().getColorLevel();
    const windowWidth = actor.getProperty().getColorWindow();

    return {
      windowCenter,
      windowWidth,
    };
  };

  render() {
    if (!this.props.actors || !this.props.actors.length) {
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
