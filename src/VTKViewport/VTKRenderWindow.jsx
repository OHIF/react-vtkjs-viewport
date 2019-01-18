import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import debounce from 'lodash.debounce';
import './VTKViewport.css';
const EVENT_RESIZE = 'resize';

import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';

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

class VTKViewport extends Component {
  static defaultProps = {
    background: [0, 0, 0],
    vtkVolumeActors: [],
    vtkActors: [],
    widgets: []
  };

  static propTypes = {
    background: PropTypes.arrayOf(PropTypes.number).isRequired,
    vtkVolumeActors: PropTypes.arrayOf(PropTypes.object).isRequired,
    interactorStyle: PropTypes.string,
    widgets: PropTypes.arrayOf(PropTypes.object)
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

  addWidgets() {
    const renderer = this.scopedRenderWindow.getRenderer();

    const { widgets } = this.props;
    if (!widgets.length) {
      return;
    }

    const widgetManager = vtkWidgetManager.newInstance();
    widgetManager.setRenderer(renderer);

    widgets.forEach(widget => {
      widgetManager.addWidget(widget.vtkWidget, widget.viewType);
    });

    // TODO: Allow the developer to send in the active
    widgetManager.grabFocus(widgets[0].vtkWidget);
    widgetManager.disablePicking();
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
    //renderer.getActiveCamera().setViewUp(0, 0, 1);

    const { vtkVolumeActors, vtkActors } = this.props;

    vtkVolumeActors.forEach(actor => {
      renderer.addVolume(actor);
    });

    vtkActors.forEach(actor => {
      renderer.addActor(actor);
    });

    const renderWindow = this.scopedRenderWindow.getRenderWindow();
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

  setVTKInteractorStyle(style = 'slice', renderWindow, actors) {
    if (!actors.length) {
      return;
    }

    const interactor = renderWindow.getInteractor();

    if (style === 'slice') {
      // use our custom style
      const istyle = CustomSliceInteractorStyle.newInstance();
      istyle.setCurrentVolumeNumber(0); // background volume
      istyle.setSlicingMode(1, true); // force set slice mode
      istyle.setSlice(40);

      interactor.setInteractorStyle(istyle);
    } else if (style === 'rotate') {
      // Use the vtk standard style with custom settings
      const renderer = this.scopedRenderWindow.getRenderer();

      renderer.resetCamera();

      const istyle = vtkInteractorStyleMPRSlice.newInstance();
      interactor.setInteractorStyle(istyle);

      const actor = actors[0];
      const mapper = actor.getMapper();

      // set interactor style volume mapper after mapper sets input data
      istyle.setVolumeMapper(mapper);
      istyle.setSliceNormal(0, 0, 1);

      const range = istyle.getSliceRange();
      istyle.setSlice((range[0] + range[1]) / 2);
    } else {
      throw new Error(`setVTKInteractorStyle: bad style '${style}'`);
    }
  }
}

export default VTKViewport;
