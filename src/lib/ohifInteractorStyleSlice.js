import macro from 'vtk.js/Sources/macro';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkConstants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants.js';
import vtkInteractorStyleTrackballCamera from 'vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera';

/**
 * Class inherits from InteractorStyle.
 * Handles events in render window.
 * @param publicAPI
 * @param model - instance data.
 */
function ohifInteractorStyleSlice(publicAPI, model) {
  const States = vtkConstants.States;

  // Set our className
  model.classHierarchy.push('ohifInteractorStyleSlice');
  macro.setGet(publicAPI, model, ['directionalProperties']);
  macro.setGet(publicAPI, model, ['lastCameraPosition']);
  macro.setGet(publicAPI, model, ['viewDirection']);
  macro.setGet(publicAPI, model, ['displaySet']);

  publicAPI.setLastCameraPosition(undefined);
  publicAPI.setDisplaySet(undefined);

  // Public API methods

  /**
   * handleMouseDolly: "Dolly" the camera based on mouse position.
   *
   * @param renderer
   * @param position
   */
  publicAPI.handleMouseDolly = (renderer, position) => {
    const dy = position.y - model.previousPosition.y;
    const rwi = model.interactor;
    const center = rwi.getView().getViewportCenter(renderer);
    const dyf = (model.motionFactor * dy) / center[1];
    // Negate. OHIF uses the opposite paradigm
    //
    let negDyf = -dyf;
    publicAPI.dollyByFactor(renderer, 1.1 ** negDyf);
  };

  publicAPI.superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = callData.position;
    const renderer = callData.pokedRenderer;

    switch (model.state) {
      case States.IS_WINDOW_LEVEL:
        publicAPI.windowLevel(renderer, pos);
        publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
        break;
      case States.IS_DOLLY:
        publicAPI.handleMouseDolly(renderer, pos);
        publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
        break;
      default:
        break;
    }
    publicAPI.setLastCameraPosition(renderer.getActiveCamera().getPosition());

    publicAPI.superHandleMouseMove(callData);
  };

  /**
   * On middle button press, we start Pan.
   * @param callData
   */
  publicAPI.handleMiddleButtonPress = callData => {
    publicAPI.startPan();
  };

  /**
   * on middle button release, we end Pan.
   * @param callData
   */
  publicAPI.handleMiddleButtonRelease = callData => {
    publicAPI.endPan();
  };

  publicAPI.superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  /**
   * handleLeftButtonPress: window / level, Slice start if we are in Slicing Mode (wheel).
   * @param callData
   */
  publicAPI.handleLeftButtonPress = callData => {
    const pos = callData.position;
    if (!callData.shiftKey && !callData.controlKey) {
      model.windowLevelStartPosition[0] = pos.x;
      model.windowLevelStartPosition[1] = pos.y;
      // Get the last (the topmost) image
      publicAPI.setCurrentImageNumber(model.currentImageNumber);
      const property = model.currentImageProperty;
      if (property) {
        model.windowLevelInitial[0] = property.getColorWindow();
        model.windowLevelInitial[1] = property.getColorLevel();
      }
      publicAPI.startWindowLevel();
    } else if (model.interactionMode === 'IMAGE_SLICING') {
      model.lastSlicePosition = pos.y;
      publicAPI.startSlice();
    } else {
      // The rest of the button + key combinations remain the same
      publicAPI.superHandleLeftButtonPress(callData);
    }
  };

  publicAPI.superHandleLeftButtonRelease = publicAPI.handleLeftButtonRelease;

  /**
   * handle Left Button release
   */
  publicAPI.handleLeftButtonRelease = () => {
    switch (model.state) {
      case States.IS_WINDOW_LEVEL:
        publicAPI.endWindowLevel();
        break;
      case States.IS_SLICE:
        publicAPI.endSlice();
        break;
      default:
        publicAPI.superHandleLeftButtonRelease();
        break;
    }
  };

  publicAPI.superHandleRightButtonPress = publicAPI.handleRightButtonPress;
  /**
   * handleRightButtonPress: save our position, startDolly.
   * @param callData
   */
  publicAPI.handleRightButtonPress = callData => {
    const pos = callData.position;
    model.previousPosition = pos;
    publicAPI.startDolly();
  };

  publicAPI.superHandleRightButtonRelease = publicAPI.handleRightButtonRelease;
  /**
   * handleRightButtonRelease: uses default vtk behavior.
   */
  publicAPI.handleRightButtonRelease = () => {
    switch (model.state) {
      case States.IS_WINDOW_LEVEL:
        publicAPI.endWindowLevel();
        break;
      case States.IS_SLICE:
        publicAPI.endSlice();
        break;
      case States.IS_DOLLY:
        publicAPI.endDolly();
        break;
      default:
        publicAPI.superHandleRightButtonRelease();
        break;
    }
  };

  /**
   *  handleStartMouseWheel : calls startSlice()
   * @param callData
   */
  publicAPI.handleStartMouseWheel = callData => {
    publicAPI.startSlice();
  };

  /**
   * handleEndMouseWheel: calls endSlice()
   */
  publicAPI.handleEndMouseWheel = () => {
    publicAPI.endSlice();
  };

  /**
   * handleMouseWheel.
   * @param callData
   */
  publicAPI.handleMouseWheel = callData => {
    let increment = 0;
    if (callData.spinY < 0) {
      increment = 1;
    } else {
      increment = -1;
    }
    publicAPI.moveSliceByWheel(increment);
  };

  /**
   * moveSliceByWhell; move the slicing location
   * @param increment
   */
  publicAPI.moveSliceByWheel = increment => {
    let slice = publicAPI.findSlice();
    let props = publicAPI.getDirectionalProperties();

    if (slice) {
      const renderer = model.interactor.getCurrentRenderer();
      renderer.getActiveCamera().setParallelProjection(true);

      let mode = slice.getMapper().getSlicingMode();
      let currentPosition = undefined;
      let newPos = undefined;
      let worldPos = undefined;
      switch (mode) {
        case vtkImageMapper.SlicingMode.Z:
          currentPosition = props.currentZIndex * props.zSpacing;
          newPos = currentPosition + props.zSpacing * increment;
          worldPos = props.zPositions[props.currentZIndex];
          break;
        case vtkImageMapper.SlicingMode.Y:
          currentPosition = props.currentYIndex * props.ySpacing;
          newPos = currentPosition + props.ySpacing * increment;
          worldPos = props.yPositions[props.currentYIndex];
          break;
        case vtkImageMapper.SlicingMode.X:
          currentPosition = props.currentXIndex * props.xSpacing;
          newPos = currentPosition + props.xSpacing * increment;
          worldPos = props.xPositions[props.currentXIndex];
          break;
      }

      if (newPos < 0) {
        newPos = 0.0;
      }

      slice.getMapper().setSlicingMode(mode);
      let idx = slice.getMapper().getSliceAtPosition(newPos);

      let idxCount = undefined;
      switch (mode) {
        case vtkImageMapper.SlicingMode.Z:
          props.currentZIndex = idx;
          slice.getMapper().setZSlice(idx);
          idxCount = props.zPositions.length;
          break;
        case vtkImageMapper.SlicingMode.Y:
          props.currentYIndex = idx;
          slice.getMapper().setYSlice(idx);
          idxCount = props.yPositions.length;
          break;
        case vtkImageMapper.SlicingMode.X:
          props.currentXIndex = idx;
          slice.getMapper().setXSlice(idx);
          idxCount = props.xPositions.length;
          break;
      }

      if (publicAPI.getLastCameraPosition() != undefined) {
        let pos = publicAPI.getLastCameraPosition();
        renderer.getActiveCamera().setPosition(pos[0], pos[1], pos[2]);
      } else {
        renderer.resetCamera();
      }

      let viewDirection = publicAPI.getViewDirection();
      let displaySet = publicAPI.getDisplaySet();
      let w = model.currentImageProperty.getColorWindow();
      let l = model.currentImageProperty.getColorLevel();
      publicAPI.invokeInteractionEvent({
        type: 'InteractionEvent',
        wheelData: {
          viewDirection: viewDirection,
          displaySet: displaySet,
          sliceIndex: idx,
          sliceCount: idxCount,
          window: w,
          level: l,
        },
      });

      renderer.getRenderWindow().render();
    }
  };

  /**
   * windowLevel: used VTK's default 8 bit window level.
   * TODO make similar to OHIF
   * @param renderer
   * @param position
   */
  publicAPI.windowLevel = (renderer, position) => {
    model.windowLevelCurrentPosition[0] = position.x;
    model.windowLevelCurrentPosition[1] = position.y;
    const rwi = model.interactor;

    if (model.currentImageProperty) {
      const size = rwi.getView().getViewportSize(renderer);

      const mWindow = model.windowLevelInitial[0];
      const level = model.windowLevelInitial[1];

      // Compute normalized delta
      let dx =
        ((model.windowLevelCurrentPosition[0] -
          model.windowLevelStartPosition[0]) *
          4.0) /
        size[0];
      let dy =
        ((model.windowLevelStartPosition[1] -
          model.windowLevelCurrentPosition[1]) *
          4.0) /
        size[1];

      // Scale by current values
      if (Math.abs(mWindow) > 0.01) {
        dx *= mWindow;
      } else {
        dx *= mWindow < 0 ? -0.01 : 0.01;
      }
      if (Math.abs(level) > 0.01) {
        dy *= level;
      } else {
        dy *= level < 0 ? -0.01 : 0.01;
      }

      // Abs so that direction does not flip
      if (mWindow < 0.0) {
        dx *= -1;
      }
      if (level < 0.0) {
        dy *= -1;
      }

      // Compute new mWindow level
      let newWindow = dx + mWindow;
      const newLevel = level - dy;

      if (newWindow < 0.01) {
        newWindow = 0.01;
      }

      model.currentImageProperty.setColorWindow(newWindow);
      model.currentImageProperty.setColorLevel(newLevel);
      let viewDirection = publicAPI.getViewDirection();
      let displaySet = publicAPI.getDisplaySet();
      publicAPI.invokeInteractionEvent({
        type: 'InteractionEvent',
        windowLevelData: {
          viewDirection: viewDirection,
          displaySet: displaySet,
          window: newWindow,
          level: newLevel,
        },
      });
    }
  };

  /**
    // This is a way of dealing with images as if they were layers.
    // It looks through the renderer's list of props and sets the
    // interactor ivars from the Nth image that it finds.  You can
    // also use negative numbers, i.e. -1 will return the last image,
    // -2 will return the second-to-last image, etc.
    */
  publicAPI.setCurrentImageNumber = i => {
    const renderer = model.interactor.getCurrentRenderer();
    if (!renderer) {
      return;
    }
    model.currentImageNumber = i;

    function propMatch(prop) {
      if (prop.isA('vtkImageSlice')) {
        return true;
      }
      return false;
    }

    const props = renderer.getViewProps();

    let imageProp = null;
    let foundImageProp = false;
    for (let j = 0; j < props.length && !foundImageProp; j++) {
      if (propMatch(props[j])) {
        foundImageProp = true;
        imageProp = props[j];
        break;
      }
    }

    if (imageProp) {
      model.currentImageProperty = imageProp.getProperty();
    }
  };

  /**
   * Anticipationg that more actors will be in the Scene,
   * we look for ours.
   * @returns {*}
   */
  publicAPI.findSlice = () => {
    function propMatch(prop) {
      if (prop.isA('vtkImageSlice')) {
        return true;
      }
      return false;
    }
    const renderer = model.interactor.getCurrentRenderer();
    if (!renderer) {
      return;
    }
    const props = renderer.getViewProps();

    let imageProp = null;
    let foundImageProp = false;
    for (let j = 0; j < props.length && !foundImageProp; j++) {
      if (propMatch(props[j])) {
        foundImageProp = true;
        imageProp = props[j];
        break;
      }
    }

    if (imageProp) {
      model.currentImageProperty = imageProp.getProperty();
    }
    return imageProp;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  windowLevelStartPosition: [0, 0],
  windowLevelCurrentPosition: [0, 0],
  lastSlicePosition: 0,
  windowLevelInitial: [1, 0.5],
  currentImageProperty: 0,
  currentImageNumber: -1,
  interactionMode: 'IMAGE_SLICE',
  xViewRightVector: [0, 1, 0],
  xViewUpVector: [0, 0, -1],
  yViewRightVector: [1, 0, 0],
  yViewUpVector: [0, 0, -1],
  zViewRightVector: [1, 0, 0],
  zViewUpVector: [0, 1, 0],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleTrackballCamera.extend(publicAPI, model, initialValues);

  // Create get-set macros
  macro.setGet(publicAPI, model, ['interactionMode']);

  // For more macro methods, see "Sources/macro.js"

  // Object specific methods
  ohifInteractorStyleSlice(publicAPI, model, initialValues);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'ohifInteractorStyleSlice'
);

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
