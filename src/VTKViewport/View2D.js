import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';

import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { createSub } from '../lib/createSub.js';
import createLabelPipeline from './createLabelPipeline';

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
    interactorStyleVolumeMapper: PropTypes.object,
    dataDetails: PropTypes.object,
    onCreated: PropTypes.func,
    onDestroyed: PropTypes.func,
    orientation: PropTypes.object,
  };

  static defaultProps = {
    painting: false,
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
    this.state = {
      voi: this.getVOI(props.volumes[0]),
    };
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

    /*
    TODO: Enable normal orthogonal slicing / window level as default instead of
    rotation tool

    const istyle = CustomSliceInteractorStyle.newInstance();
    this.istyle = istyle
    this.renderWindow.getInteractor().setInteractorStyle(istyle)
    istyle.setCurrentVolumeNumber(0); // background volume
    istyle.setSlicingMode(1, true); // force set slice mode

    interactor.setInteractorStyle(istyle);
    */

    /*
    TODO: Use for maintaining clipping range for MIP

    const interactor = this.renderWindow.getInteractor();
    //const clippingRange = renderer.getActiveCamera().getClippingRange();

    interactor.onAnimation(() => {
      renderer.getActiveCamera().setClippingRange(...r);
    });*/

    const istyleVolumeMapper =
      this.props.interactorStyleVolumeMapper ||
      this.props.volumes[0].getMapper();

    // Set orientation based on props
    if (this.props.orientation) {
      const { orientation } = this.props;

      istyle.setSliceNormal(...orientation.sliceNormal);
      istyle.setViewUp(...orientation.viewUp);
    } else {
      istyle.setSliceNormal(0, 0, 1);
    }

    istyle.setVolumeMapper(istyleVolumeMapper);
    const range = istyle.getSliceRange();
    istyle.setSlice((range[0] + range[1]) / 2);

    istyle.onModified(() => {
      this.updatePaintbrush();
    });
    this.updatePaintbrush();

    // TODO: Not sure why this is necessary to force the initial draw
    this.genericRenderWindow.resize();

    const boundUpdateVOI = this.updateVOI.bind(this);
    const boundGetOrienation = this.getOrientation.bind(this);

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
        _component: this,
        updateVOI: boundUpdateVOI,
        getOrientation: boundGetOrienation,
      };

      this.props.onCreated(api);
    }
  }

  updateVOI(windowWidth, windowCenter) {
    this.setState({ voi: { windowWidth, windowCenter } });
  }

  getOrientation() {
    return this.props.orientation;
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
        labelmapImageData
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
  }

  componentWillUnmount() {
    Object.keys(this.subs).forEach(k => {
      this.subs[k].unsubscribe();
    });

    if (this.props.onDestroyed) {
      this.props.onDestroyed();
    }
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
