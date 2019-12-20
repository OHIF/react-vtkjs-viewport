import macro from 'vtk.js/Sources/macro';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import ViewportData from './ViewportData';
import EVENTS from '../events';

const { States } = Constants;

// ----------------------------------------------------------------------------
// Global methods
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// vtkInteractorStyleMPRSlice methods
// ----------------------------------------------------------------------------

function vtkInteractorStyleMPRSlice(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkInteractorStyleMPRSlice');

  model.trackballManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance(
    {
      button: 1,
    }
  );
  model.panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance({
    button: 2,
  });
  model.zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance({
    button: 3,
  });

  model.scrollManipulator = vtkMouseRangeManipulator.newInstance({
    scrollEnabled: true,
    dragEnabled: false,
  });

  // cache for sliceRange
  const cache = {
    sliceNormal: [0, 0, 0],
    sliceRange: [0, 0],
    sliceCenter: [],
  };

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.trackballManipulator);
    publicAPI.addMouseManipulator(model.panManipulator);
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    updateScrollManipulator();
  }

  function onRotateChanged(event) {
    setSliceNormalInternal(event.detail.sliceNormal);
    setViewUpInternal(event.detail.sliceViewUp);
  }

  function setViewUpInternal(viewUp) {
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();
    camera.setViewUp(...viewUp);
  }

  publicAPI.setViewport = viewportData => {
    if (model.viewportData) {
      const oldWindow = model.viewportData.getEventWindow();

      oldWindow.removeEventListener(EVENTS.VIEWPORT_ROTATED, onRotateChanged);
    }

    model.viewportData = viewportData;

    if (model.scrollManipulator.setViewportData) {
      // scroll manipulator is the custom MouseRangeRotate manipulator
      model.scrollManipulator.setViewportData(viewportData);
    }

    if (viewportData) {
      setSliceNormalInternal(viewportData.getCurrentSliceNormal());
      setViewUpInternal(viewportData.getCurrentViewUp());

      viewportData
        .getEventWindow()
        .addEventListener(EVENTS.VIEWPORT_ROTATED, onRotateChanged);
    }
  };

  let cameraSub = null;
  let interactorSub = null;
  const superSetInteractor = publicAPI.setInteractor;
  publicAPI.setInteractor = interactor => {
    superSetInteractor(interactor);

    if (cameraSub) {
      cameraSub.unsubscribe();
      cameraSub = null;
    }

    if (interactorSub) {
      interactorSub.unsubscribe();
      interactorSub = null;
    }

    if (interactor) {
      const renderer = interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();

      cameraSub = camera.onModified(() => {
        updateScrollManipulator();
        publicAPI.modified();
      });

      interactorSub = interactor.onAnimation(() => {
        camera.setThicknessFromFocalPoint(model.slabThickness);
      });

      const eventWindow = model.interactor.getContainer();

      publicAPI.setViewport(new ViewportData(eventWindow));
    } else {
      publicAPI.setViewport(null);
    }
  };

  // TODO -> When we want a modular framework we'll have to rethink all this.
  // TODO -> We need to think of a more generic way to do this for all widget types eventually.
  // TODO -> We certainly need to be able to register widget types on instantiation.
  function handleButtonPress() {
    const { apis, apiIndex } = model;

    if (apis && apis[apiIndex] && apis[apiIndex].type === 'VIEW2D') {
      publicAPI.startPan();

      const api = apis[apiIndex];

      api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
    }
  }

  publicAPI.handleMiddleButtonPress = macro.chain(
    publicAPI.handleMiddleButtonPress,
    handleButtonPress
  );

  publicAPI.handleRightButtonPress = macro.chain(
    publicAPI.handleRightButtonPress,
    handleButtonPress
  );

  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    if (superHandleMouseMove) {
      superHandleMouseMove(callData);
    }

    if (model.state === States.IS_PAN) {
      const { apis, apiIndex } = model;
      const api = apis[apiIndex];

      api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
    }
  };

  function handleButtonRelease(superButtonRelease) {
    if (model.state === States.IS_PAN) {
      publicAPI.endPan();
      const { apis, apiIndex } = model;
      const api = apis[apiIndex];

      api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
    }

    superButtonRelease();
  }

  publicAPI.superHandleMiddleButtonRelease =
    publicAPI.handleMiddleButtonRelease;
  publicAPI.handleMiddleButtonRelease = () => {
    handleButtonRelease(publicAPI.superHandleMiddleButtonRelease);
  };

  publicAPI.superHandleRightButtonRelease = publicAPI.handleRightButtonRelease;
  publicAPI.handleRightButtonRelease = () => {
    handleButtonRelease(publicAPI.superHandleRightButtonRelease);
  };

  publicAPI.getViewUp = () => {
    if (model.volumeActor && model.interactor) {
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();

      return camera.getViewUp();
    }

    return [0, 0, 0];
  };

  publicAPI.setViewUp = (...viewUp) => {
    const viewportData = publicAPI.getViewport();

    if (viewportData) {
      viewportData.setOrientation(viewportData.getSliceNormal(), viewUp);
    }

    setViewUpInternal(viewUp);
  };

  publicAPI.setSlabThickness = slabThickness => {
    model.slabThickness = slabThickness;

    // Update the camera clipping range if the slab
    // thickness property is changed
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();
    camera.setThicknessFromFocalPoint(slabThickness);
  };

  setManipulators();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  slabThickness: 0.1,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleManipulator.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['onScroll']);
  macro.get(publicAPI, model, [
    'slabThickness',
    'volumeActor',
    'apis',
    'apiIndex',
  ]);

  // Object specific methods
  vtkInteractorStyleMPRSlice(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkInteractorStyleMPRSlice'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });

// TODO: work with VTK to change the internal formatting of arrays.
function vec9toMat3(vec9) {
  if (vec9.length !== 9) {
    throw Error('Array not length 9');
  }
  //prettier-ignore
  return [
    [vec9[0], vec9[1], vec9[2]],
    [vec9[3], vec9[4], vec9[5]],
    [vec9[6], vec9[7], vec9[8]],
  ];
}
