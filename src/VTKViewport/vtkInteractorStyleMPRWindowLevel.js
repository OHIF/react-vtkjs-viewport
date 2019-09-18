import macro from 'vtk.js/Sources/macro';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';
import vtkInteractorStyleMPRSlice from './vtkInteractorStyleMPRSlice.js';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import {
  toWindowLevel,
  toLowHighRange,
} from '../lib/windowLevelRangeConvertor';

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

    if (model.state === States.IS_WINDOW_LEVEL) {
      publicAPI.windowLevelFromMouse(pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    }

    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
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

        // NOTE: Disabling this because it makes it more difficult to switch
        // interactor styles. Need to find a better way to do this!
        //publicAPI.setSliceNormal(...publicAPI.getSliceNormal());
      } else {
        camera.setFreezeFocalPoint(false);
      }
    }
  };

  publicAPI.windowLevelFromMouse = pos => {
    const dx = Math.floor(pos[0] - model.wlStartPos[0]);
    const dy = Math.floor(pos[1] - model.wlStartPos[1]);

    let windowWidth = model.levels.windowWidth + dx;
    let windowCenter = model.levels.windowCenter + dy;

    windowWidth = Math.max(0.01, windowWidth);

    if (
      model.windowWidth === windowWidth &&
      model.windowCenter === windowCenter
    ) {
      return;
    }

    publicAPI.windowLevel(windowWidth, windowCenter);

    model.wlStartPos[0] = Math.round(pos[0]);
    model.wlStartPos[1] = Math.round(pos[1]);
  };

  publicAPI.windowLevel = (windowWidth, windowCenter) => {
    const lowHigh = toLowHighRange(windowWidth, windowCenter);

    model.levels.windowWidth = windowWidth;
    model.levels.windowCenter = windowCenter;

    model.volumeMapper
      .getProperty()
      .getRGBTransferFunction(0)
      .setMappingRange(lowHigh.lower, lowHigh.upper);

    const onLevelsChanged = publicAPI.getOnLevelsChanged();
    if (onLevelsChanged) {
      onLevelsChanged({ windowCenter, windowWidth });
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

        model.levels = toWindowLevel(
          model.initialMRange[0],
          model.initialMRange[1]
        );

        publicAPI.startWindowLevel();
      }
    } else if (superHandleLeftButtonPress) {
      superHandleLeftButtonPress(callData);
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

const DEFAULT_VALUES = {
  wlStartPos: [],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleMPRSlice.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['volumeMapper', 'onLevelsChanged']);

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
