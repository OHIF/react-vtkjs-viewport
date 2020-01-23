import vtkjsToolsMPRPanManipulator from './wrappedManipulators/vtkjsToolsMPRPanManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRPanManipulatorMixin';

const vtkMPRPanManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRPanManipulator,
};

export default vtkMPRPanManipulatorMixin;
