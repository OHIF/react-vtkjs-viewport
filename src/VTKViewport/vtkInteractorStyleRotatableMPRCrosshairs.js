import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';

const { States } = Constants;

const operations = {
  ROTATE_CROSSHAIRS: 0,
  MOVE_CROSSHAIRS: 1,
  PAN: 2,
};

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkInteractorStyleRotatableMPRCrosshairs methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleRotatableMPRCrosshairs(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleRotatableMPRCrosshairs');

  function selectOpperation(callData) {
    // TODO:
    // Click on line -> start a rotate of the other planes.
    // Click on the center, drag crosshairs.
    model.operation = { type: operations.MOVE_CROSSHAIRS };
    // What is the fallback? Pan? Do nothing for now.
  }

  function performOperation(callData) {
    const { operation } = model;
    const { type } = operation;

    switch (type) {
      case operations.MOVE_CROSSHAIRS:
        moveCrosshairs(callData);
        break;
      case operations.ROTATE_CROSSHAIRS:
        rotateCrosshairs(callData);
        break;
      case operations.PAN:
        pan(callData);
        break;
    }
  }

  function moveCrosshairs(callData) {
    const { apis, apiIndex } = model;
    const api = apis[apiIndex];

    const pos = callData.position;
    const renderer = callData.pokedRenderer;

    const dPos = vtkCoordinate.newInstance();
    dPos.setCoordinateSystemToDisplay();

    dPos.setValue(pos.x, pos.y, 0);
    let worldPos = dPos.getComputedWorldValue(renderer);

    const camera = renderer.getActiveCamera();
    const directionOfProjection = camera.getDirectionOfProjection();

    const halfSlabThickness = api.getSlabThickness() / 2;

    // Add half of the slab thickness to the world position, such that we select
    // The center of the slice.

    for (let i = 0; i < worldPos.length; i++) {
      worldPos[i] += halfSlabThickness * directionOfProjection[i];
    }

    api.svgWidgets.rotatableCrosshairsWidget.moveCrosshairs(
      worldPos,
      apis,
      apiIndex
    );

    publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
  }

  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    if (model.state === States.IS_WINDOW_LEVEL) {
      performOperation(callData);
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }
  };

  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    if (!callData.shiftKey && !callData.controlKey) {
      if (model.volumeActor) {
        selectOpperation(callData);
        performOperation(callData);

        publicAPI.startWindowLevel();
      }
    } else if (superHandleLeftButtonPress) {
      superHandleLeftButtonPress(callData);
    }
  };

  publicAPI.superHandleLeftButtonRelease = publicAPI.handleLeftButtonRelease;
  publicAPI.handleLeftButtonRelease = () => {
    switch (model.state) {
      case States.IS_WINDOW_LEVEL:
        model.operation = null;
        publicAPI.endWindowLevel();
        break;

      default:
        publicAPI.superHandleLeftButtonRelease();
        break;
    }
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = { operation: null };

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, [
    'callback',
    'apis',
    'apiIndex',
    'onScroll',
    'operation',
  ]);

  // Object specific methods
  vtkInteractorStyleRotatableMPRCrosshairs(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkInteractorStyleRotatableMPRCrosshairs'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });