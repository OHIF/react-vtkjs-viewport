import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import { vec2, vec3, quat } from 'gl-matrix';

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
    const thisApi = apis[apiIndex];
    let { position } = callData;

    const { rotatableCrosshairsWidget } = thisApi.svgWidgets;

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

    const { svgWidgetManager } = thisApi;
    const size = svgWidgetManager.getSize();
    const scale = svgWidgetManager.getScale();
    const height = size[1];

    // Map to the click point to the same coords as the SVG.
    const p = { x: position.x * scale, y: height - position.y * scale };

    const distanceFromFirstLine = distanceFromLine(lines[0], p); //position);
    const distanceFromSecondLine = distanceFromLine(lines[1], p); //;

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
    const areaOfTriangle = Math.abs(
      (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2
    );

    // And area also equals 1/2 base * height, where height is the distance!
    // So:
    const base = vec2.distance([a.x, a.y], [b.x, b.y]);
    const height = (2.0 * areaOfTriangle) / base;

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
    const thisApi = apis[apiIndex];

    const { rotatableCrosshairsWidget } = thisApi.svgWidgets;

    const point = rotatableCrosshairsWidget.getPoint();

    let pointToPreviousPosition = [];
    let pointToNewPosition = [];

    // Get vector from center of crosshairs to previous position.
    vec2.subtract(
      pointToPreviousPosition,
      [prevPosition.x, prevPosition.y],
      point
    );

    // Get vector from center of crosshairs to new position.
    vec2.subtract(pointToNewPosition, [newPosition.x, newPosition.y], point);

    // Get angle of rotation from previous reference line position to the new position.
    let angle = vec2.angle(pointToPreviousPosition, pointToNewPosition);

    // Use the determinant to find the sign of the angle.
    const determinant =
      pointToNewPosition[0] * pointToPreviousPosition[1] -
      pointToNewPosition[1] * pointToPreviousPosition[0];

    if (determinant < 0) {
      angle *= -1;
    }

    // Axis is the opposite direction of the plane normal for this API.
    const sliceNormal = thisApi.getSliceNormal();
    const axis = [-sliceNormal[0], -sliceNormal[1], -sliceNormal[2]];

    // Rotate other apis
    apis.forEach((api, index) => {
      if (index !== apiIndex) {
        // get normal and viewUp.

        const sliceNormalForApi = api.getSliceNormal();
        const viewUpForApi = api.getViewUp();

        const newSliceNormalForApi = [];
        const newViewUpForApi = [];

        const rotationQuat = quat.create();

        quat.setAxisAngle(rotationQuat, axis, angle);
        quat.normalize(rotationQuat, rotationQuat);

        // rotate the ViewUp with the rotation
        vec3.transformQuat(newViewUpForApi, viewUpForApi, rotationQuat);
        vec3.transformQuat(
          newSliceNormalForApi,
          sliceNormalForApi,
          rotationQuat
        );

        api.setOrientation(newSliceNormalForApi, newViewUpForApi);
      }
    });

    // Move crosshairs.
    const renderer = callData.pokedRenderer;
    const dPos = vtkCoordinate.newInstance();
    dPos.setCoordinateSystemToDisplay();

    dPos.setValue(point[0], point[1], 0);
    let worldPos = dPos.getComputedWorldValue(renderer);

    const camera = renderer.getActiveCamera();
    const directionOfProjection = camera.getDirectionOfProjection();

    const halfSlabThickness = thisApi.getSlabThickness() / 2;

    // Add half of the slab thickness to the world position, such that we select
    // The center of the slice.

    for (let i = 0; i < worldPos.length; i++) {
      worldPos[i] += halfSlabThickness * directionOfProjection[i];
    }

    thisApi.svgWidgets.rotatableCrosshairsWidget.moveCrosshairs(
      worldPos,
      apis,
      apiIndex
    );

    operation.prevPosition = newPosition;
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
