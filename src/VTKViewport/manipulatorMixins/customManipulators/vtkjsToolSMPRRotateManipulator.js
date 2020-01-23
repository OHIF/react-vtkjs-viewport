import macro from 'vtk.js/Sources/macro';
import vtkCompositeCameraManipulator from 'vtk.js/Sources/Interaction/Manipulators/CompositeCameraManipulator';
import vtkCompositeMouseManipulator from 'vtk.js/Sources/Interaction/Manipulators/CompositeMouseManipulator';
import dispatchEvent from '../../../helpers/dispatchEvent.js';
import EVENTS from '../../../events';

function vtkjsToolsMPRRotateManipulator(publicAPI, model) {
  // Set our className
  const manipulatorClassName = 'vtkjsToolsMPRRotateManipulator';

  model.classHierarchy.push(manipulatorClassName);
  model.rotateStartPos = [0, 0];

  publicAPI.onButtonDown = (interactor, renderer, position) => {
    if (!model.viewportData) {
      return;
    }

    model.rotateStartPos[0] = Math.round(position.x);
    model.rotateStartPos[1] = Math.round(position.y);
  };

  publicAPI.onMouseMove = (interactor, renderer, position) => {
    if (!model.viewportData) {
      return;
    }

    const pos = [Math.round(position.x), Math.round(position.y)];
    const size = interactor.getView().getViewportSize(renderer);
    const xSensitivity = 100.0 / size[0];
    const ySensitivity = 100.0 / size[1];
    const dThetaX = -((pos[1] - model.rotateStartPos[1]) * ySensitivity);
    const dThetaY = -((pos[0] - model.rotateStartPos[0]) * xSensitivity);

    model.viewportData.rotateRelative(dThetaX, dThetaY);

    model.rotateStartPos[0] = Math.round(pos[0]);
    model.rotateStartPos[1] = Math.round(pos[1]);

    // TODO -> How do we deal with other states that may do pan? Should that ever happen?
    const eventWindow = model.viewportData.getEventWindow();

    dispatchEvent(eventWindow, EVENTS.IMAGE_RENDERED, {
      interactor,
      renderer,
      mosuePosition: { x: position.x, y: position.y },
      manipulatorClassName,
    });
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  macro.obj(publicAPI, model);
  vtkCompositeCameraManipulator.extend(publicAPI, model, initialValues);
  vtkCompositeMouseManipulator.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['viewportData']);

  // Object specific methods
  vtkjsToolsMPRRotateManipulator(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkjsToolsMPRRotateManipulator'
);

export default Object.assign({ newInstance, extend });
