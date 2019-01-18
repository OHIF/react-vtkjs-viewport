import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import debounce from 'lodash.debounce';
import './VTKViewport.css';
const EVENT_RESIZE = 'resize';

import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';
import vtkInteractorStyleTrackballCamera from 'vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera';
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
    vtkVolumeActors: []
  };

  static propTypes = {
    background: PropTypes.arrayOf(PropTypes.number).isRequired,
    vtkVolumeActors: PropTypes.arrayOf(PropTypes.object).isRequired
  };

  componentDidMount() {
    const { background, vtkVolumeActors } = this.props;
    const genericRenderWindow = vtkGenericRenderWindow.newInstance({
      background
    });

    genericRenderWindow.setContainer(this.container);

    this.genericRenderWindow = genericRenderWindow;

    this.addActors();

    const renderWindow = genericRenderWindow.getRenderWindow();
    renderWindow.render();

    this.interactorStyle = 'rotate';

    this.setVTKInteractorStyle(
      this.interactorStyle,
      renderWindow,
      vtkVolumeActors
    );
  }

  addActors = () => {
    const renderer = this.genericRenderWindow.getRenderer();
    renderer.resetCamera();
    renderer.getActiveCamera().setViewUp(0, 0, 1);

    const { vtkVolumeActors } = this.props;

    vtkVolumeActors.forEach(actor => {
      renderer.addVolume(actor);
    });

    const renderWindow = this.genericRenderWindow.getRenderWindow();
    renderWindow.render();

    this.setVTKInteractorStyle(
      this.interactorStyle,
      renderWindow,
      vtkVolumeActors
    );
  };

  componentDidUpdate(prevProps) {
    if (this.props.vtkVolumeActors !== prevProps.vtkVolumeActors) {
      this.addActors();
    }
  }

  render() {
    return (
      <div
        className={'VTKViewport'}
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
      const renderer = this.genericRenderWindow.getRenderer();

      renderer.resetCamera();
      renderer.getActiveCamera().setViewUp(0, 0, 1);

      const bounds = actors[0].getBounds();
      const center = [
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2
      ];
      const position = center.slice();
      position[1] -= 4.25 * (-bounds[2] - center[1]);

      renderer.getActiveCamera().setPosition(...position);
      renderer.getActiveCamera().setFocalPoint(...center);
      renderer.updateLightsGeometryToFollowCamera();

      const istyle = vtkInteractorStyleTrackballCamera.newInstance();
      istyle.get().autoAdjustCameraClippingRange = false;

      console.warn('Hard coding clipping range');
      renderer.getActiveCamera().setClippingRange([645, 647]);

      interactor.setInteractorStyle(istyle);
    } else {
      throw new Error(`setVTKInteractorStyle: bad style '${style}'`);
    }
  }
}

export default VTKViewport;
