import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import { vec2 } from 'gl-matrix';

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
    const { apis, apiIndex, lineGrabDistance } = model;
    const api = apis[apiIndex];
    const { position } = callData;

    const { rotatableCrosshairsWidget } = api.svgWidgets;

    if (!rotatableCrosshairsWidget) {
      throw new Error(
        'Must use rotatable crosshair svg widget with this istyle.'
      );
    }

    const lines = rotatableCrosshairsWidget.getReferenceLines();
    const point = rotatableCrosshairsWidget.getPoint();
    const centerRadius = rotatableCrosshairsWidget.getCenterRadius();

    const distanceFromCenter = vec2.distance(point, [position.x, position.y]);

    if (distanceFromCenter < centerRadius) {
      // Click on center -> move the crosshairs.
      model.operation = { type: operations.MOVE_CROSSHAIRS };

      return;
    }

    const distanceFromFirstLine = distanceFromLine(lines[0], position);
    const distanceFromSecondLine = distanceFromLine(lines[1], position);

    if (
      distanceFromFirstLine <= lineGrabDistance ||
      distanceFromSecondLine <= lineGrabDistance
    ) {
      // Click on line -> start a rotate of the other planes.

      model.operation = {
        type: operations.ROTATE_CROSSHAIRS,
        closeLine: distanceFromFirstLine < distanceFromSecondLine ? 0 : 1,
        prevPosition: position,
      };

      return;
    }

    // What is the fallback? Pan? Do nothing for now.
    model.operation = { type: null };
  }

  function distanceFromLine(line, point) {
    const [a, b] = line.points;
    const c = point;

    // Get area from all 3 points...
    const areOfTriangle = Math.abs(
      (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
    );

    // And area also equals 1/2 base * height, where height is the distance!
    // So:
    const base = vec2.distance([a.x, a.y], [b.x, b.y]);
    const height = (2.0 * areOfTriangle) / base;

    // Note we don't have to worry about finite line length
    // As the lines go across the whole canvas.

    return height;
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

  function rotateCrosshairs(callData) {
    const { operation } = model;
    const { prevPosition } = operation;

    const newPosition = callData.position;

    if (newPosition.x === prevPosition.x && newPosition.y === prevPosition.y) {
      // No change, exit early.
      return;
    }

    const { apis, apiIndex } = model;
    const api = apis[apiIndex];

    const { rotatableCrosshairsWidget } = api.svgWidgets;

    const point = rotatableCrosshairsWidget.getPoint();

    let pointToPreviousPosition = [];
    let pointToNewPosition = [];

    debugger;

    vec2.subtract(
      pointToPreviousPosition,
      [prevPosition.x, prevPosition.y],
      point
    );

    vec2.subtract(pointToNewPosition, [newPosition.x, newPosition.y], point);

    const angle = vec2.angle(pointToPreviousPosition, pointToNewPosition);

    debugger;
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
        model.operation = { type: null };
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

const DEFAULT_VALUES = { operation: { type: null }, lineGrabDistance: 12 };

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
    'lineGrabDistance',
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
