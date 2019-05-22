import React, { Component } from 'react';
import PropTypes from 'prop-types';
import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
//import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import vtkPaintFilter from 'vtk.js/Sources/Filters/General/PaintFilter';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { createSub } from '../lib/createSub.js';

// TODO: mostly duplicated in view3d...
function createLabelPipeline(
  backgroundImageData,
  paintFilterLabelMapImageData
) {
  let labelMapData;

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
  labelMap.cfun.addRGBPoint(0, 1, 0, 2); // label "1" will be blue
  labelMap.cfun.addRGBPoint(0, 0, 1, 3); // label "1" will be blue
  labelMap.ofun.addPoint(0, 0);
  labelMap.ofun.addPoint(1, 0.5);

  labelMap.actor.getProperty().setRGBTransferFunction(0, labelMap.cfun);
  labelMap.actor.getProperty().setScalarOpacity(0, labelMap.ofun);
  labelMap.actor.getProperty().setInterpolationTypeToNearest();

  return labelMap;
}

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
  }

  updatePaintbrush() {
    const manip = this.paintWidget.getManipulator();
    const camera = this.renderer.getActiveCamera();
    manip.setNormal(...camera.getDirectionOfProjection());
    manip.setOrigin(...camera.getFocalPoint());
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

    const istyle = vtkInteractorStyleMPRSlice.newInstance();
    this.istyle = istyle;
    this.renderWindow.getInteractor().setInteractorStyle(istyle);

    this.widgetManager.setRenderer(this.renderer);
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

    const istyleVolumeMapper =
      this.props.interactorStyleVolumeMapper ||
      this.props.volumes[0].getMapper();

    istyle.setVolumeMapper(istyleVolumeMapper);
    istyle.setSliceNormal(0, 0, 1);
    const range = istyle.getSliceRange();
    istyle.setSlice((range[0] + range[1]) / 2);

    istyle.onModified(() => {
      this.updatePaintbrush();
    });
    this.updatePaintbrush();

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
        _component: this,
      };

      this.props.onCreated(api);
    }
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
            this.paintFilter.endStroke();
            if (this.props.onPaintEnd) {
              this.props.onPaintEnd();
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
    const windowWidth = range[0] + range[1];
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

    const style = { width: '100%', height: '100%' };

    const voi = this.getVOI(this.props.volumes[0]);

    return (
      <div style={style}>
        <div ref={this.container} style={style} />
        <ViewportOverlay {...this.props.dataDetails} voi={voi} />
      </div>
    );
  }
}
