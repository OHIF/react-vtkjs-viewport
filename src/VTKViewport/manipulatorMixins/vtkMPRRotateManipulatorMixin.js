import vtkjsToolsMPRRotateManipulator from './customManipulators/vtkjsToolSMPRRotateManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRRotateManipulator';

const vtkMPRRotateManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRRotateManipulator,
};

export default vtkMPRRotateManipulatorMixin;
