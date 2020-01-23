import vtkjsToolsMPRWindowLevelManipulator from './customManipulators/vtkjsToolsMPRWindowLevelManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRWindowLevelManipulator';

const vtkMPRWindowLevelManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRWindowLevelManipulator,
};

export default vtkMPRWindowLevelManipulatorMixin;
