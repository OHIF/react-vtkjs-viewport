import macro from 'vtk.js/Sources/macro';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';
import vtkInteractorStyleMPRSlice from 'vtk.js/Sources/Interaction/Style/InteractorStyleMPRSlice';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';

const { States } = Constants;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkInteractorStyleMPRWindowLevel methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleMPRWindowLevel(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleMPRWindowLevel');
  model.wlStartPos = [0, 0];

  model.trackballManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance(
    {
      button: 1,
    }
  );
  model.panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 1,
    shift: true,
  });

  // TODO: The inherited zoom manipulator does not appear to be working?
  model.zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance({
    button: 3,
  });
  model.scrollManipulator = vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false,
  });

  function updateScrollManipulator() {
    const range = publicAPI.getSliceRange();
    model.scrollManipulator.removeScrollListener();
    model.scrollManipulator.setScrollListener(
      range[0],
      range[1],
      1,
      publicAPI.getSlice,
      publicAPI.setSlice
    );
  }

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.trackballManipulator);
    publicAPI.addMouseManipulator(model.panManipulator);
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    updateScrollManipulator();
  }

  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = [callData.position.x, callData.position.y];
    const renderer = callData.pokedRenderer;

    if (model.state === States.IS_WINDOW_LEVEL) {
      publicAPI.windowLevel(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }
  };

  publicAPI.windowLevel = (renderer, pos) => {
    const rwi = model.interactor;
    if (model.volumeMapper) {
      const size = rwi.getView().getViewportSize(renderer);
      const win = model.initialMRange[1] - model.initialMRange[0];
      const level = (model.initialMRange[0] + model.initialMRange[1]) / 2.0;
      let dx = ((pos[0] - model.wlStartPos[0]) * 4.0) / size[0];
      let dy = ((pos[1] - model.wlStartPos[1]) * 4.0) / size[1];
      if (Math.abs(win) > 0.01) {
        dx *= win;
      } else {
        dx *= win < 0 ? -0.01 : 0.01;
      }
      if (Math.abs(level) > 0.01) {
        dy *= level;
      } else {
        dy *= level < 0 ? -0.01 : 0.01;
      }
      if (win < 0.0) {
        dx *= -1;
      }
      if (level < 0.0) {
        dy *= -1;
      }
      const newWin = Math.max(0.01, dx + win);
      const newLevel = level - dy;
      const lower = newLevel - newWin / 2.0;
      const upper = newLevel + newWin / 2.0;
      model.volumeMapper
        .getProperty()
        .getRGBTransferFunction(0)
        .setMappingRange(lower, upper);
    }
  };

  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    model.wlStartPos[0] = callData.position.x;
    model.wlStartPos[1] = callData.position.y;
    if (!callData.shiftKey && !callData.controlKey) {
      const property = model.volumeMapper.getProperty();
      if (property) {
        model.initialMRange = property
          .getRGBTransferFunction(0)
          .getMappingRange()
          .slice();
        publicAPI.startWindowLevel();
      }
    } else if (superHandleLeftButtonPress) {
      superHandleLeftButtonPress(callData);
    }
  };

  const superSetVolumeMapper = publicAPI.setVolumeMapper;
  publicAPI.setVolumeMapper = mapper => {
    if (superSetVolumeMapper(mapper)) {
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      if (mapper) {
        // prevent zoom manipulator from messing with our focal point
        camera.setFreezeFocalPoint(true);
      } else {
        camera.setFreezeFocalPoint(false);
      }
    }
  };

  publicAPI.superHandleLeftButtonRelease = publicAPI.handleLeftButtonRelease;
  publicAPI.handleLeftButtonRelease = () => {
    switch (model.state) {
      case States.IS_WINDOW_LEVEL:
        publicAPI.endWindowLevel();
        break;

      default:
        publicAPI.superHandleLeftButtonRelease();
        break;
    }
  };

  setManipulators();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['volumeMapper']);

  // Object specific methods
  vtkInteractorStyleMPRWindowLevel(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkInteractorStyleMPRWindowLevel'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
