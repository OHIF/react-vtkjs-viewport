import macro from 'vtk.js/Sources/macro';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';

const MAX_SAFE_INTEGER = 2147483647;

// ----------------------------------------------------------------------------
// vtkMouseRangeManipulator methods
// ----------------------------------------------------------------------------

function vtkMouseRangeRotateManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkMouseRangeRotateManipulator');

  function updateScollListener() {
    publicAPI.setScrollListener(
      -MAX_SAFE_INTEGER,
      MAX_SAFE_INTEGER,
      1,
      () => 0,
      dThetaY => {
        let thetaY = dThetaY % 360;

        model.viewportData.rotateRelative(0, thetaY);

        // onInteractiveRotationChanged();
      }
    );
  }

  publicAPI.setViewportData = viewportData => {
    model.viewportData = viewportData;

    if (viewportData) {
      updateScollListener();
    } else {
      publicAPI.removeScrollListener();
    }
  };
  publicAPI.getViewportData = () => {
    return model.viewportData;
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
  vtkMouseRangeManipulator.extend(publicAPI, model, initialValues);

  // Object specific methods
  vtkMouseRangeRotateManipulator(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkMouseRangeRotateManipulator'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
