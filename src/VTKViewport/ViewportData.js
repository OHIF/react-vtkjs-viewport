import { vec3, mat4, quat } from 'gl-matrix';
import { degrees2radians } from '../lib/math/angles.js';
import EVENTS from '../events.js';

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

function createNewViewportData() {
  return {
    viewUp: [0, 1, 0],
    sliceNormal: [0, 0, 1],
  };
}

export default class {
  _state = null;
  eventWindow;
  constructor(eventWindow, state = null) {
    this.eventWindow = eventWindow;

    if (this._state === null) {
      this._state = createNewViewportData();
    } else {
      this._state = JSON.parse(JSON.stringify(state));
    }

    // copy the state to a cache, so we can modify internally,
    // but remember the original values for absolute rotations
    this._state.cache = {
      ...this._state,
    };
  }

  getEventWindow = () => {
    return this.eventWindow;
  };

  _rotate = (viewUp, sliceNormal, dThetaX, dThetaY, dThetaZ = 0) => {
    validateNumber(dThetaX);
    validateNumber(dThetaY);
    validateNumber(dThetaZ);

    let xAxis = [];
    vec3.cross(xAxis, viewUp, sliceNormal);
    vec3.normalize(xAxis, xAxis);

    let yAxis = viewUp;
    // rotate around the vector of the cross product of the
    // plane and viewup as the X component

    const nSliceNormal = [];
    const nViewUp = [];

    const planeMat = mat4.create();

    // Rotate around the vertical (slice-up) vector
    mat4.rotate(planeMat, planeMat, degrees2radians(dThetaY), yAxis);

    // Rotate around the horizontal (screen-x) vector
    mat4.rotate(planeMat, planeMat, degrees2radians(dThetaX), xAxis);

    vec3.transformMat4(nSliceNormal, sliceNormal, planeMat);
    vec3.transformMat4(nViewUp, viewUp, planeMat);

    if (dThetaZ !== 0) {
      // Rotate the viewUp in 90 degree increments
      const zRotQuat = quat.create();
      // Use negative degrees clockwise rotation since the axis should really be the direction of projection, which is the negative of the plane normal
      quat.setAxisAngle(zRotQuat, nSliceNormal, degrees2radians(-dThetaZ));
      quat.normalize(zRotQuat, zRotQuat);

      // rotate the ViewUp with the z rotation
      vec3.transformQuat(nViewUp, nViewUp, zRotQuat);
    }

    this._state.cache.sliceNormal = nSliceNormal;
    this._state.cache.viewUp = nViewUp;

    var event = new CustomEvent(EVENTS.VIEWPORT_ROTATED, {
      detail: {
        sliceNormal: nSliceNormal,
        sliceViewUp: nViewUp,
        dThetaX,
        dThetaY,
        dThetaZ,
      },
      bubbles: true,
      cancelable: true,
    });

    this.eventWindow.dispatchEvent(event);
  };

  rotateAbsolute = (dThetaX, dThetaY, dThetaZ = 0) => {
    this._rotate(
      this._state.viewUp,
      this._state.sliceNormal,
      dThetaX,
      dThetaY,
      dThetaZ
    );
  };
  rotateRelative = (dThetaX, dThetaY, dThetaZ = 0) => {
    this._rotate(
      this._state.cache.viewUp,
      this._state.cache.sliceNormal,
      dThetaX,
      dThetaY,
      dThetaZ
    );
  };

  setOrientation = (sliceNormal, viewUp = [0, 1, 0]) => {
    this._state.sliceNormal = [...sliceNormal];
    this._state.viewUp = [...viewUp];
    this._state.cache.sliceNormal = [...sliceNormal];
    this._state.cache.viewUp = [...viewUp];
  };

  getViewUp = () => {
    return this._state.viewUp;
  };

  getSliceNormal = () => {
    return this._state.sliceNormal;
  };

  getCurrentViewUp = () => {
    return this._state.cache.viewUp;
  };

  getCurrentSliceNormal = () => {
    return this._state.cache.sliceNormal;
  };

  getReadOnlyViewPort = () => {
    const readOnlyState = JSON.parse(JSON.stringify(this._state));

    Object.freeze(readOnlyState);

    return readOnlyState;
  };
}
