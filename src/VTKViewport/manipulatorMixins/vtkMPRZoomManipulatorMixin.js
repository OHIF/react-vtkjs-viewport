import vtkjsToolsMPRZoomManipulator from './wrappedManipulators/vtkjsToolsMPRZoomManipulator';

// ----------------------------------------------------------------------------
// vtkMPRZoomManipulatorMixin methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRZoomManipulatorMixin';

const vtkMPRZoomManipulatorMixin = {
  manipulatorName,
  manipulator: vtkjsToolsMPRZoomManipulator,
};

export default vtkMPRZoomManipulatorMixin;
