import React, { Component } from 'react';
import PropTypes from 'prop-types';
//import debounce from 'lodash.debounce';
import './VTKViewport.css';
const EVENT_RESIZE = 'resize';

import vtkGenericRenderWindow from 'vtk.js/Sources/Rendering/Misc/GenericRenderWindow';

// TODO: Is there one in VTK.js for this?
import CustomSliceInteractorStyle from './vtkCustomSliceInteractor.js';
import VTKRenderWindow from './VTKRenderWindow';

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
    renderWindowData: []
  };

  static propTypes = {
    renderWindowData: PropTypes.arrayOf(PropTypes.object).isRequired
  };

  // TODO: This is here as a placeholder for later if we decide to try
  // to have multiple render windows inside a single canvas
  createRenderWindowScope = (container, type = vtkGenericRenderWindow) => {
    const scopedRenderWindow = type.newInstance();

    return scopedRenderWindow;
  };

  static linkInteractors(scope1, scope2) {
    const i1 = scope1.renderWindow.getInteractor();
    const i2 = scope2.renderWindow.getInteractor();
    const sync = {};

    let src = null;

    function linkOneWay(from, to) {
      from.onStartAnimation(() => {
        if (!src) {
          src = from;
          to.requestAnimation(sync);
        }
      });

      from.onEndAnimation(() => {
        if (src === from) {
          src = null;
          to.cancelAnimation(sync);
          // roughly wait for widgetManager.capture() to finish
          setTimeout(to.render, 1000);
        }
      });
    }

    linkOneWay(i1, i2);
    linkOneWay(i2, i1);
  }

  static linkAllInteractors(renderWindows) {
    if (renderWindows.length < 2) {
      return;
    }

    for (let i = 0; i < renderWindows.length - 1; i++) {
      for (let j = i + 1; j < renderWindows.length; j++) {
        VTKViewport.linkInteractors(renderWindows[i], renderWindows[j]);
      }
    }
  }

  render() {
    const scopes = [];
    const contents = this.props.renderWindowData.map((data, index) => {
      const scopedRenderWindow = this.createRenderWindowScope(this.container);
      scopes.push({
        renderWindow: scopedRenderWindow
      });

      return (
        <VTKRenderWindow
          key={index}
          {...data}
          scopedRenderWindow={scopedRenderWindow}
        />
      );
    });

    // TODO: Not sure if this should be in the render function
    VTKViewport.linkAllInteractors(scopes);

    return (
      <div
        className={'VTKViewport'}
        ref={input => {
          this.container = input;
        }}
      >
        {contents}
      </div>
    );
  }
}

export default VTKViewport;
