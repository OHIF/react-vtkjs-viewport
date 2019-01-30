import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import debounce from 'lodash.debounce';
import './VTKViewport.css';
const EVENT_RESIZE = 'resize';

import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';

// TODO: Is there one in VTK.js for this?
import CustomSliceInteractorStyle from './vtkCustomSliceInteractor.js';

/* One ultimate experiment might be to use one large render window for all viewports
   which just sits behind the layout in html and renders each viewport based on the position
   and size of the 'viewport'

- Render window is the large div
- renderer is each smaller viewport


Plugin could take in an array of render windows
- Each render window has a set of coordinates (top, left, width, height)
- Each render window has a set of *actors* to populate the scene
- Each render window has an interactor

vtkRenderWindows: [
  {
    position: {top, left, width, height},
    actors: ['CT', 'SEG'],
    interactorStyle: '',
  }
]
*/

class VTKRenderWindow extends Component {
  static defaultProps = {
    background: [0, 0, 0],
    vtkVolumeActors: [],
    vtkActors: [],
    widgets: []
  };

  static propTypes = {
    background: PropTypes.arrayOf(PropTypes.number).isRequired,
    vtkVolumeActors: PropTypes.arrayOf(PropTypes.object).isRequired,
    interactorStyle: PropTypes.object,
    widgets: PropTypes.arrayOf(PropTypes.object),
    focusedWidgetId: PropTypes.string
  };

  componentDidMount() {
    const { background, vtkVolumeActors, scopedRenderWindow } = this.props;
    this.scopedRenderWindow = scopedRenderWindow;
    scopedRenderWindow.resize();
    scopedRenderWindow.setBackground(background);

    // TODO: Later on we can try to return null from this component and instead
    // have the parent draw all the windows in one canvas
    scopedRenderWindow.setContainer(this.container);

    const renderWindow = scopedRenderWindow.getRenderWindow();
    renderWindow.render();

    this.renderWindow = renderWindow;

    this.addActors();
    this.addWidgets();
  }

  setFocusedWidget = () => {
    const { focusedWidgetId, widgets } = this.props;
    if (focusedWidgetId === null) {
      this.widgetManager.releaseFocus();
    }

    const focusedWidget = widgets.find(widget => widget.id === focusedWidgetId);
    if (focusedWidget) {
      this.widgetManager.grabFocus(focusedWidget.vtkWidget);
    }
  };

  addWidgets() {
    const renderer = this.scopedRenderWindow.getRenderer();

    const { widgets } = this.props;
    if (!widgets.length) {
      return;
    }

    const widgetManager = vtkWidgetManager.newInstance();
    this.widgetManager = widgetManager;
    widgetManager.setRenderer(renderer);

    widgets.forEach(widget => {
      const widgetHandle = widgetManager.addWidget(
        widget.vtkWidget,
        widget.viewType
      );

      if (widget.callbacks) {
        Object.keys(widget.callbacks).forEach(name => {
          const callback = widget.callbacks[name];

          widgetHandle[name](() => callback(widgetHandle));
        });
      }
    });

    // TODO: Allow the developer to send in the active
    this.setFocusedWidget();

    //widgetManager.disablePicking();
  }

  setInteractorStyleFromProps = () => {
    if (this.props.interactorStyle) {
      this.setVTKInteractorStyle(
        this.props.interactorStyle,
        this.renderWindow,
        this.props.vtkVolumeActors
      );
    }
  };

  addActors = () => {
    const renderer = this.scopedRenderWindow.getRenderer();

    const { vtkVolumeActors, vtkActors } = this.props;

    vtkVolumeActors.forEach(actor => {
      renderer.addVolume(actor);
    });

    vtkActors.forEach(actor => {
      renderer.addActor(actor);
    });

    const renderWindow = this.scopedRenderWindow.getRenderWindow();
    this.renderWindow = renderWindow;
    renderWindow.render();

    renderer.resetCamera();
    renderer.resetCameraClippingRange();

    this.setInteractorStyleFromProps();
  };

  componentDidUpdate(prevProps) {
    if (
      this.props.vtkVolumeActors !== prevProps.vtkVolumeActors ||
      this.props.vtkActors !== prevProps.vtkActors
    ) {
      this.addActors();
    }

    if (this.props.focusedWidgetId !== prevProps.focusedWidgetId) {
      this.setFocusedWidget();
    }
  }

  render() {
    // TODO: Later on we can try to return null from this component and instead
    // have the parent draw all the windows in one canvas
    return (
      <div
        className={'VTKRenderWindow'}
        ref={input => {
          this.container = input;
        }}
      />
    );
  }

  setVTKInteractorStyle(interactorObj, renderWindow, actors) {
    if (!actors.length) {
      return;
    }

    const style = interactorObj.name;
    const interactor = renderWindow.getInteractor();
    let istyle;

    if (style === 'slice') {
      // use our custom style
      istyle = CustomSliceInteractorStyle.newInstance();
      istyle.setCurrentVolumeNumber(0); // background volume
      istyle.setSlicingMode(1, true); // force set slice mode

      interactor.setInteractorStyle(istyle);
    } else if (style === 'rotate') {
      istyle = vtkInteractorStyleMPRSlice.newInstance();
      interactor.setInteractorStyle(istyle);

      const actor = actors[0];
      const mapper = actor.getMapper();

      // Set interactor style volume mapper after mapper sets input data
      istyle.setVolumeMapper(mapper);
    }

    if (interactorObj.callbacks) {
      Object.keys(interactorObj.callbacks).forEach(name => {
        const callback = interactorObj.callbacks[name];

        istyle[name](() => callback(istyle));
      });

      // This is a bit hacky, but we need to run some setup to ensure painting
      // works properly before any interaction with the camera in MPR view.
      // There might be a better way to include this code.
      const ON_MODIFIED = 'onModified';
      if (Object.keys(interactorObj.callbacks).includes(ON_MODIFIED)) {
        interactorObj.callbacks[ON_MODIFIED](istyle);
      }
    }
  }
}

export default VTKRenderWindow;
