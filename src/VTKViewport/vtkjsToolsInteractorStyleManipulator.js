import macro from 'vtk.js/Sources/macro';
import vtkjsBaseTool from './vtkjsBaseTool';

// Examples -> We would probably wrap these with vtkjs tools functionality.
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';

//import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import CONSTANTS from './constants';

const { INTERACTION_TYPES } = CONSTANTS;

//const { States } = Constants;

// NOTE:
// Basic idea:
// - Instantiate a new class when you want to change manipulators, this reduces the
//   complexity of the controller.
// - Pass a set of manipulators that will register sequentially. i.e. macro.chain?

function vtkjsToolsInteractorStyleManipulator(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkjsToolsInteractorStyleManipulator');

  // React-vtkjs-viewport specific cache
  model.cache = {
    sliceNormal: [0, 0, 0],
    sliceRange: [0, 0],
    sliceCenter: [],
  };

  const callbacks = {
    setViewportData: [],
    updateScrollManipulator: [],
  };

  // TODO -> I really can't find a better way to do this as objects become immutable in post.
  // TODO: Can we cover enough bases such that the base class doesn't need to be updated
  // with new callback lists all the time?
  // TODO: Is there any way we can make this more flexible.
  publicAPI.onSetViewportData = callback => {
    callbacks.setViewportData.push(callback);
  };

  publicAPI.setViewportData = viewportData => {
    callbacks.setViewportData.forEach(callback =>
      callback(viewportData, publicAPI, model)
    );
  };

  publicAPI.onUpdateScrollManipulator = callback => {
    callbacks.updateScrollManipulator.push(callback);
  };

  publicAPI.updateScrollManipulator = () => {
    callbacks.updateScrollManipulator.forEach(callback =>
      callback(publicAPI, model)
    );
  };

  const { manipulators } = model;

  model.manipulatorInstances = {};

  publicAPI.removeAllMouseManipulators();

  manipulators.forEach(manipulatorMixin => {
    const { vtkManipulatorMixin, type, configuration } = manipulatorMixin;

    if (!vtkManipulatorMixin) {
      throw new Error(
        'Manipulator configuration must contain a vtkManipulatorMixin.'
      );
    }

    const { manipulator, manipulatorName, registerAPI } = vtkManipulatorMixin;
    const manipulatorInstance = addManipulator(
      manipulator,
      configuration,
      type,
      manipulatorName
    );

    if (typeof registerAPI === 'function') {
      registerAPI(manipulatorInstance, publicAPI, model, configuration);
    }
  });

  publicAPI.onInteractionEvent(e => {
    // NOTE: InteractorStyleManipulator emits:
    // onInteractionEventStart,
    // onInteractionEvent (drag)
    // onInteractionEventEnd
    //
    // These are useful but they don't contain any information other than the event name.
    //debugger;
  });

  publicAPI.init = volumeActor => {
    publicAPI.setVolumeActor(volumeActor);
    const { manipulators } = model;

    manipulators.forEach(manipulator => {
      const { vtkManipulatorMixin } = manipulator;

      if (
        vtkManipulatorMixin &&
        typeof vtkManipulatorMixin.init === 'function'
      ) {
        const { manipulatorName, init } = vtkManipulatorMixin;
        const manipulatorInstance = model.manipulatorInstances[manipulatorName];

        init(manipulatorInstance, publicAPI, model);
      }
    });
  };

  function addManipulator(manipulator, configuration, type, name) {
    const manipulatorInstance = manipulator.newInstance(configuration);

    model.manipulatorInstances[name] = manipulatorInstance;

    switch (type) {
      case INTERACTION_TYPES.MOUSE:
        publicAPI.addMouseManipulator(manipulatorInstance);
        break;
      case INTERACTION_TYPES.KEYBOARD:
        publicAPI.addKeyboardManipulator(manipulatorInstance);
        break;
      default:
        throw new Error(`unrecognised manipulator type: ${type}`);
    }

    return manipulatorInstance;
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  manipulators: [
    {
      vtkManipulatorMixin: {
        manipulator: vtkMouseCameraTrackballPanManipulator,
        manipulatorName: 'vtkMouseCameraTrackballPanManipulator',
      },
      type: INTERACTION_TYPES.MOUSE,
      configuration: { button: 1 },
    },
    {
      vtkManipulatorMixin: {
        manipulator: vtkMouseCameraTrackballZoomManipulator,
        manipulatorName: 'vtkMouseCameraTrackballZoomManipulator',
      },
      type: INTERACTION_TYPES.MOUSE,
      configuration: { button: 2 },
    },
    {
      vtkManipulatorMixin: {
        manipulator: vtkMouseCameraTrackballRotateManipulator,
        manipulatorName: 'vtkMouseCameraTrackballRotateManipulator',
      },
      type: INTERACTION_TYPES.MOUSE,
      configuration: { button: 3 },
    },
  ],
};

// TODO -> Make manipulators and pass them here.

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkjsBaseTool.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['onInteractiveRotateChanged', 'onScroll']);
  // Object specific methods
  vtkjsToolsInteractorStyleManipulator(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkjsToolsInteractorStyleManipulator'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
