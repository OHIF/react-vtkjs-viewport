import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import { vec3, mat4 } from 'gl-matrix';
import { degrees2radians } from '../lib/math/angles.js';

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

  function onInteractiveRotationChanged() {
    const onChanged = publicAPI.getOnInteractiveRotateChanged();
    if (onChanged) {
      onChanged({
        horizontalRotation: model.horizontalRotation,
        verticalRotation: model.verticalRotation,
      });
    }
  }

  function updateScrollManipulator() {
    model.scrollManipulator.removeScrollListener();
    model.scrollManipulator.setScrollListener(
      -MAX_SAFE_INTEGER,
      MAX_SAFE_INTEGER,
      1,
      () => model.horizontalRotation,
      horizontalRotation => {
        horizontalRotation %= 360;

        publicAPI.setRotation({
          horizontalRotation,
          verticalRotation: model.verticalRotation,
        });

        onInteractiveRotationChanged();
      }
    );
  }

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    updateScrollManipulator();
  }

  function validateNumber(numberValue) {
    if (
      typeof numberValue === 'number' &&
      numberValue === Number(numberValue) &&
      Number.isFinite(numberValue)
    ) {
      return;
    }

    throw `Invalid number ${numberValue}`;
  }
  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = [
      Math.round(callData.position.x),
      Math.round(callData.position.y),
    ];

    if (model.state === States.IS_ROTATE) {
      publicAPI.rotateFromMouse(pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }
  };

  publicAPI.setPlaneView = (initialNormal, initialViewUp) => {
    model.initialViewUp = initialViewUp;
    model.initialNormal = initialNormal;

    publicAPI.setSliceNormal(initialNormal, initialViewUp);
  };

  publicAPI.rotateFromMouse = pos => {
    const dx = Math.floor(pos[0] - model.rotateStartPos[0]);
    const dy = Math.floor(pos[1] - model.rotateStartPos[1]);
    let horizontalRotation = model.horizontalRotation + dx;
    let verticalRotation = model.verticalRotation + dy;

    horizontalRotation %= 360;
    verticalRotation %= 360;

    if (
      model.horizontalRotation === horizontalRotation &&
      model.verticalRotation === verticalRotation
    ) {
      return;
    }

    publicAPI.setRotation({ horizontalRotation, verticalRotation });

    model.rotateStartPos[0] = Math.round(pos[0]);
    model.rotateStartPos[1] = Math.round(pos[1]);

    onInteractiveRotationChanged();
  };

  publicAPI.getRotation = () => {
    return {
      horizontalRotation: model.horizontalRotation,
      verticalRotation: model.verticalRotation,
    };
  };

  publicAPI.setRotation = ({
    horizontalRotation = 0,
    verticalRotation = 0,
  }) => {
    validateNumber(horizontalRotation);
    validateNumber(verticalRotation);

    model.horizontalRotation = horizontalRotation;
    model.verticalRotation = verticalRotation;

    const { initialNormal, initialViewUp } = model;

    // rotate around the vector of the cross product of the plane and viewup as the X component
    let sliceXRot = [];
    vec3.cross(sliceXRot, initialViewUp, initialNormal);
    vec3.normalize(sliceXRot, sliceXRot);

    const planeMat = mat4.create();

    // Rotate around the vertical (slice-up) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(-horizontalRotation),
      initialViewUp
    );

    // Rotate around the horizontal (screen-x) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(-verticalRotation),
      sliceXRot
    );

    vec3.transformMat4(model.cachedSlicePlane, initialNormal, planeMat);
    vec3.transformMat4(model.cachedSliceViewUp, initialViewUp, planeMat);

    publicAPI.setSliceNormal(model.cachedSlicePlane, model.cachedSliceViewUp);
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

  setManipulators();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  cachedSlicePlane: [],
  cachedSliceViewUp: [],
  rotateStartPos: [0, 0],
  horizontalRotation: 0,
  verticalRotation: 0,
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
