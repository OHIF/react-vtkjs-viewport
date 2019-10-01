import { vec3, mat4 } from 'gl-matrix';
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
  }

  getEventWindow = () => {
    return this.eventWindow;
  };

  rotate = (dThetaX, dThetaY) => {
    validateNumber(dThetaX);
    validateNumber(dThetaY);

    let xAxis = [];
    vec3.cross(xAxis, this._state.viewUp, this._state.sliceNormal);
    vec3.normalize(xAxis, xAxis);

    let yAxis = this._state.viewUp;
    // rotate around the vector of the cross product of the
    // plane and viewup as the X component

    const sliceNormal = [];
    const sliceViewUp = [];

    const planeMat = mat4.create();

    //Rotate around the vertical (slice-up) vector
    mat4.rotate(planeMat, planeMat, degrees2radians(dThetaY), yAxis);

    //Rotate around the horizontal (screen-x) vector
    mat4.rotate(planeMat, planeMat, degrees2radians(dThetaX), xAxis);

    vec3.transformMat4(sliceNormal, this._state.sliceNormal, planeMat);
    vec3.transformMat4(sliceViewUp, this._state.viewUp, planeMat);

    this._state.sliceNormal = sliceNormal;
    this._state.viewUp = sliceViewUp;

    var event = new CustomEvent(EVENTS.VIEWPORT_ROTATED, {
      detail: {
        sliceNormal,
        sliceViewUp,
        dThetaX,
        dThetaY,
      },
      bubbles: true,
      cancelable: true,
    });

    this.eventWindow.dispatchEvent(event);
  };

  setOrientation = (sliceNormal, viewUp = [0, 1, 0]) => {
    this._state.sliceNormal = sliceNormal;
    this._state.viewUp = viewUp;
  };

  getViewUp = () => {
    return this._state.viewUp;
  };

  getSliceNormal = () => {
    return this._state.sliceNormal;
  };

  getReadOnlyViewPort = () => {
    const readOnlyState = JSON.parse(JSON.stringify(this._state));

    Object.freeze(readOnlyState);

    return readOnlyState;
  };
}
