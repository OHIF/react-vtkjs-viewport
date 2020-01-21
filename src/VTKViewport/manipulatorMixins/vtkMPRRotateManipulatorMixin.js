import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRScrollManipulator';

const vtkMPRScrollManipulatorMixin = {
  manipulatorName,
  manipulator: vtkMouseRangeManipulator,
  registerAPI: (manipulatorInstance, publicAPI, model) => {
    // TODO
  },
};

export default vtkMPRScrollManipulatorMixin;
