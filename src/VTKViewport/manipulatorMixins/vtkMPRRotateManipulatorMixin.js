import vtkjsToolsMPRRotateManipulator from './customManipulators/vtkjsToolsMPRRotateManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRRotateManipulator';

const vtkMPRRotateManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRRotateManipulator,
};

export default vtkMPRRotateManipulatorMixin;
