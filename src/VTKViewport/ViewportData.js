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

function areInitialRotationValues(horizontalRotation, verticalRotation) {
  return horizontalRotation === 0 && verticalRotation === 0;
}

function createNewViewportData() {
  return {
    horizontalRotation: 0,
    verticalRotation: 0,
    initialViewUp: [0, 1, 0],
    initialSliceNormal: [0, 0, 1],
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

  getHRotation = () => {
    return this._state.horizontalRotation;
  };

  getVRotation = () => {
    return this._state.verticalRotation;
  };

  rotate = (horizontalRotation, verticalRotation) => {
    validateNumber(horizontalRotation);
    validateNumber(verticalRotation);

    if (
      !areInitialRotationValues(horizontalRotation, verticalRotation) &&
      this._state.horizontalRotation === horizontalRotation &&
      this._state.verticalRotation === verticalRotation
    ) {
      return;
    }

    // rotate around the vector of the cross product of the
    // plane and viewup as the X component
    const sliceXRot = [];
    const sliceNormal = [];
    const sliceViewUp = [];

    vec3.cross(
      sliceXRot,
      this._state.initialViewUp,
      this._state.initialSliceNormal
    );
    vec3.normalize(sliceXRot, sliceXRot);

    const planeMat = mat4.create();

    // Rotate around the vertical (slice-up) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(-horizontalRotation),
      this._state.initialViewUp
    );

    // Rotate around the horizontal (screen-x) vector
    mat4.rotate(
      planeMat,
      planeMat,
      degrees2radians(-verticalRotation),
      sliceXRot
    );

    vec3.transformMat4(sliceNormal, this._state.initialSliceNormal, planeMat);
    vec3.transformMat4(sliceViewUp, this._state.initialViewUp, planeMat);

    this._state.horizontalRotation = horizontalRotation;
    this._state.verticalRotation = verticalRotation;
    this._state.sliceNormal = sliceNormal;
    this._state.sliceViewUp = sliceViewUp;

    var event = new CustomEvent(EVENTS.VIEWPORT_ROTATED, {
      detail: {
        horizontalRotation,
        verticalRotation,
        sliceNormal,
        sliceViewUp,
      },
      bubbles: true,
      cancelable: true,
    });

    this.eventWindow.dispatchEvent(event);
  };

  getInitialViewUp = () => {
    return this._state.initialViewUp;
  };

  getInitialSliceNormal = () => {
    return this._state.initialSliceNormal;
  };

  setInitialOrientation = (initialSliceNormal, initialViewUp = [0, 1, 0]) => {
    this._state.initialSliceNormal = initialSliceNormal;
    this._state.initialViewUp = initialViewUp;
  };

  getviewUp = () => {
    return this._state.viewUp;
  };

  getsliceNormal = () => {
    return this._state.sliceNormal;
  };

  // this.setOrientation = (viewUp, sliceNormal) => {
  //   state.viewUp = viewUp;
  //   state.sliceNormal = sliceNormal;
  // };

  getReadOnlyViewPort = () => {
    const readOnlyState = JSON.parse(JSON.stringify(this._state));

    Object.freeze(readOnlyState);

    return readOnlyState;
  };
}
