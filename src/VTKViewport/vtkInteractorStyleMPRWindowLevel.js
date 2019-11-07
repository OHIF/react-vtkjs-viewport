import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import {
  toWindowLevel,
  toLowHighRange,
} from '../lib/windowLevelRangeConverter';

const { States } = Constants;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkInteractorStyleMPRWindowLevel methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleMPRWindowLevel(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleMPRWindowLevel');

  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = [callData.position.x, callData.position.y];

    if (model.state === States.IS_WINDOW_LEVEL) {
      publicAPI.windowLevelFromMouse(pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }
  };

  publicAPI.windowLevelFromMouse = pos => {
    const range = model.volumeActor
      .getMapper()
      .getInputData()
      .getPointData()
      .getScalars()
      .getRange();
    const imageDynamicRange = range[1] - range[0];
    const multiplier =
      Math.round(imageDynamicRange / 1024) * publicAPI.getLevelScale();
    const dx = Math.round((pos[0] - model.wlStartPos[0]) * multiplier);
    const dy = Math.round((pos[1] - model.wlStartPos[1]) * multiplier);

    let windowWidth = model.levels.windowWidth + dx;
    let windowCenter = model.levels.windowCenter - dy;

    windowWidth = Math.max(0.01, windowWidth);

    if (
      model.windowWidth === windowWidth &&
      model.windowCenter === windowCenter
    ) {
      return;
    }

    publicAPI.setWindowLevel(windowWidth, windowCenter);

    model.wlStartPos[0] = Math.round(pos[0]);
    model.wlStartPos[1] = Math.round(pos[1]);

    const onLevelsChanged = publicAPI.getOnLevelsChanged();
    if (onLevelsChanged) {
      onLevelsChanged({ windowCenter, windowWidth });
    }
  };

  publicAPI.getWindowLevel = () => {
    const range = model.volumeActor
      .getProperty()
      .getRGBTransferFunction(0)
      .getMappingRange()
      .slice();
    return toWindowLevel(...range);
  };

  publicAPI.setWindowLevel = (windowWidth, windowCenter) => {
    const lowHigh = toLowHighRange(windowWidth, windowCenter);

    model.levels.windowWidth = windowWidth;
    model.levels.windowCenter = windowCenter;

    model.volumeActor
      .getProperty()
      .getRGBTransferFunction(0)
      .setMappingRange(lowHigh.lower, lowHigh.upper);
  };

  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    model.wlStartPos[0] = callData.position.x;
    model.wlStartPos[1] = callData.position.y;
    if (!callData.shiftKey && !callData.controlKey) {
      const property = model.volumeActor.getProperty();
      if (property) {
        model.initialMRange = property
          .getRGBTransferFunction(0)
          .getMappingRange()
          .slice();

        model.levels = toWindowLevel(
          model.initialMRange[0],
          model.initialMRange[1]
        );

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

const DEFAULT_VALUES = {
  wlStartPos: [0, 0],
  levelScale: 1,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['onLevelsChanged', 'levelScale']);

  // Object specific methods
  vtkInteractorStyleMPRWindowLevel(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkInteractorStyleMPRWindowLevel'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
