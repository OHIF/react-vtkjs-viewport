import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import { vec3, mat4 } from 'gl-matrix';
import { degrees2radians } from '../lib/math/angles.js';
import ViewportData from './ViewportData.js';

const { States } = Constants;
const MAX_SAFE_INTEGER = 2147483647;

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
    const camera = renderer.getActiveCamera();

    let xAxis = [];
    vec3.cross(xAxis, viewport.getViewUp(), viewport.getSliceNormal());
    vec3.normalize(xAxis, xAxis);

    let yAxis = viewport.getViewUp();

    viewport.rotate(xAxis, dThetaX, yAxis, dThetaY);

    model.rotateStartPos[0] = Math.round(pos[0]);
    model.rotateStartPos[1] = Math.round(pos[1]);
  };

  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    model.rotateStartPos[0] = Math.round(callData.position.x);
    model.rotateStartPos[1] = Math.round(callData.position.y);
    if (!callData.shiftKey && !callData.controlKey) {
      const property = model.volumeMapper.getProperty();
      if (property) {
        publicAPI.startRotate();
      }
    } else if (superHandleLeftButtonPress) {
      superHandleLeftButtonPress(callData);
    }
  };

  const superSetVolumeMapper = publicAPI.setVolumeMapper;
  publicAPI.setVolumeMapper = mapper => {
    if (superSetVolumeMapper(mapper)) {
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      if (mapper) {
        // prevent zoom manipulator from messing with our focal point
        camera.setFreezeFocalPoint(true);
      } else {
        camera.setFreezeFocalPoint(false);
      }
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

  macro.setGet(publicAPI, model, [
    'volumeMapper',
    'onInteractiveRotateChanged',
  ]);

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
