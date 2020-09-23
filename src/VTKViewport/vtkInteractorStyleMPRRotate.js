import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';

const { States } = Constants;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkInteractorStyleMPRRotate methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleMPRRotate(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleMPRRotate');
  model.wlStartPos = [0, 0];

  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = [
      Math.round(callData.position.x),
      Math.round(callData.position.y),
    ];
    const renderer = callData.pokedRenderer;

    if (model.state === States.IS_ROTATE) {
      publicAPI.rotateFromMouse(pos, renderer);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }
  };

  publicAPI.rotateFromMouse = (pos, renderer) => {
    const rwi = model.interactor;
    const size = rwi.getView().getViewportSize(renderer);
    const xSensitivity = 100.0 / size[0];
    const ySensitivity = 100.0 / size[1];
    const dThetaX = -((pos[1] - model.rotateStartPos[1]) * ySensitivity);
    const dThetaY = -((pos[0] - model.rotateStartPos[0]) * xSensitivity);
    const viewport = publicAPI.getViewport();

    viewport.rotateRelative(dThetaX, dThetaY);

    model.rotateStartPos[0] = Math.round(pos[0]);
    model.rotateStartPos[1] = Math.round(pos[1]);

    const { apis, apiIndex } = model;
    const api = apis[apiIndex];

    if (
      !api.svgWidgets.crosshairsWidget &&
      !api.svgWidgets.rotatableCrosshairsWidget
    ) {
      // If we aren't using the crosshairs widget, bail out early.
      return;
    }

    //const renderer = api.genericRenderWindow.getRenderer();
    let cachedCrosshairWorldPosition = api.get('cachedCrosshairWorldPosition');

    if (cachedCrosshairWorldPosition === undefined) {
      // Crosshairs not initilised.
      return;
    }

    const wPos = vtkCoordinate.newInstance();
    wPos.setCoordinateSystemToWorld();
    wPos.setValue(...cachedCrosshairWorldPosition);

    const doubleDisplayPosition = wPos.getComputedDoubleDisplayValue(renderer);

    const dPos = vtkCoordinate.newInstance();
    dPos.setCoordinateSystemToDisplay();

    dPos.setValue(doubleDisplayPosition[0], doubleDisplayPosition[1], 0);
    let worldPos = dPos.getComputedWorldValue(renderer);

    const camera = renderer.getActiveCamera();
    const directionOfProjection = camera.getDirectionOfProjection();
    const halfSlabThickness = api.getSlabThickness() / 2;

    // Add half of the slab thickness to the world position, such that we select
    //The center of the slice.

    for (let i = 0; i < worldPos.length; i++) {
      worldPos[i] += halfSlabThickness * directionOfProjection[i];
    }

    if (api.svgWidgets.crosshairsWidget) {
      api.svgWidgets.crosshairsWidget.moveCrosshairs(worldPos, apis, apiIndex);
    }
    if (api.svgWidgets.rotatableCrosshairsWidget) {
      api.svgWidgets.rotatableCrosshairsWidget.moveCrosshairs(
        worldPos,
        apis,
        apiIndex
      );
    }
  };

  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    model.rotateStartPos[0] = Math.round(callData.position.x);
    model.rotateStartPos[1] = Math.round(callData.position.y);
    if (!callData.shiftKey && !callData.controlKey) {
      const property = model.volumeActor.getProperty();
      if (property) {
        publicAPI.startRotate();
      }
    } else if (superHandleLeftButtonPress) {
      superHandleLeftButtonPress(callData);
    }
  };

  publicAPI.superHandleLeftButtonRelease = publicAPI.handleLeftButtonRelease;
  publicAPI.handleLeftButtonRelease = () => {
    switch (model.state) {
      case States.IS_ROTATE:
        publicAPI.endRotate();
        break;

      default:
        publicAPI.superHandleLeftButtonRelease();
        break;
    }
  };

  // setManipulators();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  rotateStartPos: [0, 0],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['onInteractiveRotateChanged']);

  // Object specific methods
  vtkInteractorStyleMPRRotate(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkInteractorStyleMPRRotate'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
