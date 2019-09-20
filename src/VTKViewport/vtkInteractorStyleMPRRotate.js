import macro from 'vtk.js/Sources/macro';
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import { quat, vec3, mat4 } from 'gl-matrix';
import { degrees2radians } from '../lib/math/angles.js';

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

  model.trackballManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance(
    {
      button: 1,
    }
  );
  model.panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 1,
    shift: true,
  });

  model.scrollManipulator = vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false,
  });

  function updateScrollManipulator() {
    model.scrollManipulator.removeScrollListener();
    model.scrollManipulator.setScrollListener(
      model.min,
      model.max,
      1,
      () => model.horizontalRotation,
      horizontalRotation => {
        publicAPI.rotate({
          horizontalRotation,
          verticalRotation: model.verticalRotation,
        });
      }
    );
  }

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.trackballManipulator);
    publicAPI.addMouseManipulator(model.panManipulator);
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    updateScrollManipulator();
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

  publicAPI.setMinMax = (min, max) => {
    model.min = min;
    model.max = max;
    updateScrollManipulator();
  };

  publicAPI.setRotate = ({
    renderWindow,
    horizontalRotation = 0,
    verticalRotation = 0,
    slicePlaneNormal = [0, 0, 1],
    sliceViewUp = [0, 1, 0],
    viewRotation = 0,
  }) => {
    model.renderWindow = renderWindow;
    model.horizontalRotation = horizontalRotation;
    model.verticalRotation = verticalRotation;
    model.slicePlaneNormal = slicePlaneNormal;
    model.sliceViewUp = sliceViewUp;
    model.viewRotation = viewRotation;

    model.cachedSlicePlane = [...slicePlaneNormal];
    model.cachedSliceViewUp = [...sliceViewUp];
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

    const onRotateChanged = publicAPI.getOnInteractiveRotateChanged();
    if (onRotateChanged) {
      onRotateChanged({
        horizontalRotation: model.horizontalRotation,
        verticalRotation: model.verticalRotation,
      });
    }
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
    model.horizontalRotation = horizontalRotation;
    model.verticalRotation = verticalRotation;

    const { slicePlaneNormal, sliceViewUp } = model;

    // rotate around the vector of the cross product of the plane and viewup as the X component
    let sliceXRot = [];
    vec3.cross(sliceXRot, sliceViewUp, slicePlaneNormal);
    vec3.normalize(sliceXRot, sliceXRot);

    const planeMat = mat4.create();

    // Rotate around the vertical (slice-up) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(horizontalRotation),
      sliceViewUp
    );

    // Rotate around the horizontal (screen-x) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(verticalRotation),
      sliceXRot
    );

    vec3.transformMat4(model.cachedSlicePlane, slicePlaneNormal, planeMat);
    vec3.transformMat4(model.cachedSliceViewUp, sliceViewUp, planeMat);

    // // Rotate the viewUp in 90 degree increments
    // const viewRotQuat = quat.create();
    // // Use - degrees since the axis of rotation should really be the direction of projection, which is the negative of the plane normal
    // quat.setAxisAngle(
    //   viewRotQuat,
    //   model.cachedSlicePlane,
    //   degrees2radians(-input.viewRotation)
    // );
    // quat.normalize(viewRotQuat, viewRotQuat);

    // // rotate the ViewUp with the x and z rotations
    // const xQuat = quat.create();
    // quat.setAxisAngle(xQuat, sliceXRot, degrees2radians(input.sliceXRot));
    // quat.normalize(xQuat, xQuat);
    // const viewUpQuat = quat.create();
    // quat.add(viewUpQuat, xQuat, viewRotQuat);
    // vec3.transformQuat(model.cachedSliceViewUp, model.sliceViewUp, viewRotQuat);

    // update the view's slice
    // FIXME: Store/remember the slice currently looked at, so you rotate around that location instead of the volume center

    const renderWindow = model.renderWindow;
    renderWindow
      .getInteractor()
      .getInteractorStyle()
      .setSliceNormal(model.cachedSlicePlane, model.cachedSliceViewUp);

    renderWindow.render();
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
  rotateStartPos: [],
  min: -89,
  max: 89,
  horizontalRotation: 0,
  verticalRotation: 0,
  sliceViewUp: [0, 1, 0],
  viewRotation: 0,
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
