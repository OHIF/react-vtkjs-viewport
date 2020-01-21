import vtkjsToolsMPRPanManipulator from './wrappedManipulators/vtkjsToolsMPRPanManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRPanManipulatorMixin';

const vtkMPRPanManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRPanManipulator,
  registerAPI: (manipulatorInstance, publicAPI, model) => {
    // TODO
    // Pass in configuration Configuration
    //

    debugger;
  },
};

export default vtkMPRPanManipulatorMixin;
