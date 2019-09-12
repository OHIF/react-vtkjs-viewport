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
      button: 1
    }
  );
  model.panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 1,
    shift: true
  });

  // TODO: The inherited zoom manipulator does not appear to be working?
  model.zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance({
    button: 3
  });
  model.scrollManipulator = vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false
  });

  function updateScrollManipulator() {
    const range = publicAPI.getSliceRange();
    model.scrollManipulator.removeScrollListener();
    model.scrollManipulator.setScrollListener(
      range[0],
      range[1],
      1,
      publicAPI.getSlice,
      publicAPI.setSlice
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
      Math.round(callData.position.y)
    ];
    const renderer = callData.pokedRenderer;

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
  };

  publicAPI.setRotate = ({
    renderWindow,
    slicePlaneXRotation = 0,
    slicePlaneYRotation = 0,
    slicePlaneNormal,
    sliceViewUp = [0, 1, 0],
    viewRotation = 0
  }) => {
    model.renderWindow = renderWindow;
    model.slicePlaneXRotation = slicePlaneXRotation;
    model.slicePlaneYRotation = slicePlaneYRotation;
    model.slicePlaneNormal = slicePlaneNormal;
    model.sliceViewUp = sliceViewUp;
    model.viewRotation = viewRotation;

    model.cachedSlicePlane = [...slicePlaneNormal];
    model.cachedSliceViewUp = [...sliceViewUp];
  };

  publicAPI.rotateFromMouse = pos => {
    const dx = Math.floor(pos[0] - model.rotateStartPos[0]);
    const dy = Math.floor(pos[1] - model.rotateStartPos[1]);
    let slicePlaneXRotation = model.slicePlaneXRotation + dx;
    let slicePlaneYRotation = model.slicePlaneYRotation + dy;

    slicePlaneXRotation = Math.max(
      model.min,
      Math.min(model.max, slicePlaneXRotation)
    );
    slicePlaneYRotation = Math.max(
      model.min,
      Math.min(model.max, slicePlaneYRotation)
    );

    if (
      model.slicePlaneXRotation === slicePlaneXRotation &&
      model.slicePlaneYRotation === slicePlaneYRotation
    ) {
      return;
    }

    const onRotateChanging = publicAPI.getOnRotateChanging();
    if (onRotateChanging) {
      onRotateChanging({
        xPos: pos[0],
        yPos: pos[1],
        rotateXStartPos: model.rotateStartPos[0],
        rotateYStartPos: model.rotateStartPos[1],
        dx,
        dy,
        slicePlaneXRotation,
        slicePlaneYRotation
      });
    }

    publicAPI.rotate({ slicePlaneXRotation, slicePlaneYRotation });

    model.rotateStartPos[0] = Math.round(pos[0]);
    model.rotateStartPos[1] = Math.round(pos[1]);
  };

  publicAPI.rotate = ({ slicePlaneXRotation, slicePlaneYRotation }) => {
    model.slicePlaneXRotation = slicePlaneXRotation;
    model.slicePlaneYRotation = slicePlaneYRotation;

    const input = {
      slicePlaneNormal: model.slicePlaneNormal,
      sliceViewUp: model.sliceViewUp,
      sliceXRot: model.slicePlaneXRotation,
      sliceYRot: model.slicePlaneYRotation,
      viewRotation: model.viewRotation
    };

    // rotate around the vector of the cross product of the plane and viewup as the X component
    let sliceXRot = [];
    vec3.cross(sliceXRot, input.sliceViewUp, input.slicePlaneNormal);
    vec3.normalize(sliceXRot, sliceXRot);

    // rotate the viewUp vector as the Y component
    let sliceYRot = model.sliceViewUp;
    const planeMat = mat4.create();

    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(input.sliceYRot),
      sliceYRot
    );
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(input.sliceXRot),
      sliceXRot
    );
    vec3.transformMat4(
      model.cachedSlicePlane,
      model.slicePlaneNormal,
      planeMat
    );

    // Rotate the viewUp in 90 degree increments
    const viewRotQuat = quat.create();
    // Use - degrees since the axis of rotation should really be the direction of projection, which is the negative of the plane normal
    quat.setAxisAngle(
      viewRotQuat,
      model.cachedSlicePlane,
      degrees2radians(-input.viewRotation)
    );
    quat.normalize(viewRotQuat, viewRotQuat);

    // rotate the ViewUp with the x and z rotations
    const xQuat = quat.create();
    quat.setAxisAngle(xQuat, sliceXRot, degrees2radians(input.sliceXRot));
    quat.normalize(xQuat, xQuat);
    const viewUpQuat = quat.create();
    quat.add(viewUpQuat, xQuat, viewRotQuat);
    vec3.transformQuat(model.cachedSliceViewUp, model.sliceViewUp, viewRotQuat);

    // update the view's slice
    // FIXME: Store/remember the slice currently looked at, so you rotate around that location instead of the volume center

    const renderWindow = model.renderWindow;
    renderWindow
      .getInteractor()
      .getInteractorStyle()
      .setSliceNormal(model.cachedSlicePlane, model.cachedSliceViewUp);

    renderWindow.render();

    const onRotateChanged = publicAPI.getOnRotateChanged();
    if (onRotateChanged) {
      onRotateChanged({
        slicePlaneXRotation: model.slicePlaneXRotation,
        slicePlaneYRotation: model.slicePlaneYRotation
      });
    }
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
  slicePlaneXRotation: 0,
  slicePlaneYRotation: 0,
  sliceViewUp: [0, 1, 0],
  viewRotation: 0
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, [
    'volumeMapper',
    'onRotateChanged',
    'onRotateChanging'
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
