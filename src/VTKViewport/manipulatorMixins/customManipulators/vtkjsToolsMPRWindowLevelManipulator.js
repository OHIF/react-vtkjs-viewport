import macro from 'vtk.js/Sources/macro';
import vtkCompositeCameraManipulator from 'vtk.js/Sources/Interaction/Manipulators/CompositeCameraManipulator';
import vtkCompositeMouseManipulator from 'vtk.js/Sources/Interaction/Manipulators/CompositeMouseManipulator';
import dispatchEvent from '../../../helpers/dispatchEvent.js';
import EVENTS from '../../../events';
import {
  toWindowLevel,
  toLowHighRange,
} from '../../../lib/windowLevelRangeConverter';

function vtkjsToolsMPRWindowLevelManipulator(publicAPI, model) {
  // Set our className
  const manipulatorClassName = 'vtkjsToolsMPRWindowLevelManipulator';

  model.classHierarchy.push(manipulatorClassName);
  model.wlStartPos = [0, 0];

  publicAPI.onButtonDown = (interactor, renderer, position) => {
    if (!model.viewportData) {
      return;
    }
    model.wlStartPos[0] = position.x;
    model.wlStartPos[1] = position.y;

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
    }
  };

  publicAPI.onMouseMove = (interactor, renderer, position) => {
    if (!model.viewportData) {
      return;
    }

    debugger;

    const range = model.volumeActor
      .getMapper()
      .getInputData()
      .getPointData()
      .getScalars()
      .getRange();
    const imageDynamicRange = range[1] - range[0];
    const multiplier =
      Math.round(imageDynamicRange / 1024) * publicAPI.getLevelScale();
    const dx = Math.round((position.x - model.wlStartPos[0]) * multiplier);
    const dy = Math.round((position.y - model.wlStartPos[1]) * multiplier);

    let windowWidth = model.levels.windowWidth + dx;
    let windowCenter = model.levels.windowCenter - dy;

    windowWidth = Math.max(0.01, windowWidth);

    if (
      model.windowWidth === windowWidth &&
      model.windowCenter === windowCenter
    ) {
      return;
    }

    setWindowLevel(windowWidth, windowCenter);

    model.wlStartPos[0] = Math.round(position.x);
    model.wlStartPos[1] = Math.round(position.y);

    // TODO -> Deal with synchronisation and callbacks in general.
    // TODO
    // const onLevelsChanged = publicAPI.getOnLevelsChanged();
    // if (onLevelsChanged) {
    //   onLevelsChanged({ windowCenter, windowWidth });
    // }

    const eventWindow = model.viewportData.getEventWindow();
  };

  publicAPI.setVolumeActor = volumeActor => {
    model.volumeActor = volumeActor;
  };

  function setWindowLevel(windowWidth, windowCenter) {
    const lowHigh = toLowHighRange(windowWidth, windowCenter);

    model.levels.windowWidth = windowWidth;
    model.levels.windowCenter = windowCenter;

    model.volumeActor
      .getProperty()
      .getRGBTransferFunction(0)
      .setMappingRange(lowHigh.lower, lowHigh.upper);
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = { levelScale: 1 };

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  macro.obj(publicAPI, model);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['viewportData', 'levelScale']);

  // Object specific methods
  vtkjsToolsMPRWindowLevelManipulator(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkjsToolsMPRWindowLevelManipulator'
);

export default Object.assign({ newInstance, extend });
