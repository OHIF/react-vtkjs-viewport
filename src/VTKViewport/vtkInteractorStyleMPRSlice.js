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

function boundsToCorners(bounds) {
  return [
    [bounds[0], bounds[2], bounds[4]],
    [bounds[0], bounds[2], bounds[5]],
    [bounds[0], bounds[3], bounds[4]],
    [bounds[0], bounds[3], bounds[5]],
    [bounds[1], bounds[2], bounds[4]],
    [bounds[1], bounds[2], bounds[5]],
    [bounds[1], bounds[3], bounds[4]],
    [bounds[1], bounds[3], bounds[5]],
  ];
}

// ----------------------------------------------------------------------------

function clamp(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

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

  publicAPI.updateScrollManipulator = () => {
    const range = publicAPI.getSliceRange();
    model.scrollManipulator.removeScrollListener();
    // The Scroll listener has min, max, step, and getValue setValue as params.
    // Internally, it checks that the result of the GET has changed, and only calls SET if it is new.
    model.scrollManipulator.setScrollListener(
      range[0],
      range[1],
      1,
      publicAPI.getSlice,
      publicAPI.scrollToSlice
    );
  };

  function setManipulators() {
    publicAPI.removeAllMouseManipulators();
    publicAPI.addMouseManipulator(model.trackballManipulator);
    publicAPI.addMouseManipulator(model.panManipulator);
    publicAPI.addMouseManipulator(model.zoomManipulator);
    publicAPI.addMouseManipulator(model.scrollManipulator);
    publicAPI.updateScrollManipulator();
  }

  function isCameraViewInitialized(camera) {
    const dist = camera.getDistance();

    return (
      typeof dist === 'number' && dist === Number(dist) && Number.isFinite(dist)
    );
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

  // in world space
  function setSliceNormalInternal(normal) {
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();

    //copy arguments for internal editing so we don't cause sideeffects
    const _normal = [...normal];

    if (model.volumeActor) {
      vtkMath.normalize(_normal);

      let center = camera.getFocalPoint();
      let dist = camera.getDistance();
      let angle = camera.getViewAngle();

      if (!isCameraViewInitialized(camera)) {
        const bounds = model.volumeActor.getMapper().getBounds();
        // diagonal will be used as "width" of camera scene
        const diagonal = Math.sqrt(
          vtkMath.distance2BetweenPoints(
            [bounds[0], bounds[2], bounds[4]],
            [bounds[1], bounds[3], bounds[5]]
          )
        );

        // center will be used as initial focal point
        center = [
          (bounds[0] + bounds[1]) / 2.0,
          (bounds[2] + bounds[3]) / 2.0,
          (bounds[4] + bounds[5]) / 2.0,
        ];

        angle = 90;

        // distance from camera to focal point
        dist = diagonal / (2 * Math.tan((angle / 360) * Math.PI));
      }

      const cameraPos = [
        center[0] - _normal[0] * dist,
        center[1] - _normal[1] * dist,
        center[2] - _normal[2] * dist,
      ];

      camera.setPosition(...cameraPos);
      camera.setDistance(dist);
      // should be set after pos and distance
      camera.setDirectionOfProjection(..._normal);
      camera.setViewAngle(angle);

      camera.setThicknessFromFocalPoint(model.slabThickness);

      publicAPI.setCenterOfRotation(center);
    }
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

  publicAPI.getViewport = () => model.viewportData;

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
        publicAPI.updateScrollManipulator();
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
  function handleButtonPress(callData) {
    const { apis, apiIndex } = model;

    if (apis && apis[apiIndex] && apis[apiIndex].type === 'VIEW2D') {
      publicAPI.startPan();

      const api = apis[apiIndex];

      if (api.svgWidgets.crosshairsWidget) {
        api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
      }
      if (api.svgWidgets.rotatableCrosshairsWidget) {
        updateRotatableCrosshairs(callData);
      }
    }
  }

  function updateRotatableCrosshairs() {
    const { apis, apiIndex } = model;
    const thisApi = apis[apiIndex];
    const { rotatableCrosshairsWidget } = thisApi.svgWidgets;
    const worldPos = thisApi.get('cachedCrosshairWorldPosition');

    rotatableCrosshairsWidget.moveCrosshairs(worldPos, apis, apiIndex);
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

    const { apis, apiIndex } = model;
    const thisApi = apis[apiIndex];

    // This stops the clipping range being randomly reset.
    const renderer = thisApi.genericRenderWindow.getRenderer();
    const camera = renderer.getActiveCamera();

    camera.setThicknessFromFocalPoint(model.slabThickness);

    if (model.state === States.IS_PAN) {
      const { apis, apiIndex } = model;
      const api = apis[apiIndex];

      // TODO -> This is kinda bad but the only way with the current setup.
      if (api.svgWidgets.crosshairsWidget) {
        api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
      }
      if (api.svgWidgets.rotatableCrosshairsWidget) {
        updateRotatableCrosshairs(callData);
      }
    }
  };

  function handleButtonRelease(superButtonRelease, callData) {
    if (model.state === States.IS_PAN) {
      publicAPI.endPan();
      const { apis, apiIndex } = model;
      const api = apis[apiIndex];

      if (api.svgWidgets.crosshairsWidget) {
        api.svgWidgets.crosshairsWidget.updateCrosshairForApi(api);
      }
      if (api.svgWidgets.rotatableCrosshairsWidget) {
        updateRotatableCrosshairs(callData);
      }
    }

    superButtonRelease();
  }

  publicAPI.superHandleMiddleButtonRelease =
    publicAPI.handleMiddleButtonRelease;
  publicAPI.handleMiddleButtonRelease = callData => {
    handleButtonRelease(publicAPI.superHandleMiddleButtonRelease, callData);
  };

  publicAPI.superHandleRightButtonRelease = publicAPI.handleRightButtonRelease;
  publicAPI.handleRightButtonRelease = callData => {
    handleButtonRelease(publicAPI.superHandleRightButtonRelease, callData);
  };

  publicAPI.setVolumeActor = actor => {
    model.volumeActor = actor;
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();
    if (actor) {
      // prevent zoom manipulator from messing with our focal point
      camera.setFreezeFocalPoint(true);

      const viewportData = publicAPI.getViewport();

      if (viewportData) {
        setSliceNormalInternal(viewportData.getCurrentSliceNormal());
        setViewUpInternal(viewportData.getCurrentViewUp());
      }

      publicAPI.updateScrollManipulator();
      // NOTE: Disabling this because it makes it more difficult to switch
      // interactor styles. Need to find a better way to do this!
      //publicAPI.setSliceNormal(...publicAPI.getSliceNormal());
    } else {
      camera.setFreezeFocalPoint(false);
    }
  };

  publicAPI.getSlice = () => {
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();
    const sliceNormal = publicAPI.getSliceNormal();

    // Get rotation matrix from normal to +X (since bounds is aligned to XYZ)
    const transform = vtkMatrixBuilder
      .buildFromDegree()
      .identity()
      .rotateFromDirections(sliceNormal, [1, 0, 0]);

    const fp = camera.getFocalPoint();
    transform.apply(fp);
    return fp[0];
  };

  // Only run the onScroll callback if called from scrolling,
  // preventing manual setSlice calls from triggering the CB.
  publicAPI.scrollToSlice = slice => {
    // Dispatch custom event
    const vtkScrollEvent = new CustomEvent('vtkscrollevent', {
      detail: { uid: publicAPI.getUid() },
    });
    window.dispatchEvent(vtkScrollEvent);

    const slicePoint = publicAPI.setSlice(slice);

    // run Callback
    const onScroll = publicAPI.getOnScroll();
    if (onScroll) {
      onScroll({
        slicePoint,
      });
    }
  };

  model.onScroll = () => {
    const { apis, apiIndex } = model;

    // TODO -> We need to think of a more generic way to do this for all widget types eventually.
    // TODO -> We certainly need to be able to register stuff like this.
    if (apis && apis[apiIndex] && apis[apiIndex].type === 'VIEW2D') {
      // Check whether crosshairs should be updated.

      const api = apis[apiIndex];

      if (
        !api.svgWidgets.crosshairsWidget &&
        !api.svgWidgets.rotatableCrosshairsWidget
      ) {
        // If we aren't using the crosshairs widget, bail out early.
        return;
      }

      const renderer = api.genericRenderWindow.getRenderer();
      let cachedCrosshairWorldPosition = api.get(
        'cachedCrosshairWorldPosition'
      );

      if (cachedCrosshairWorldPosition === undefined) {
        // Crosshairs not initilised.
        return;
      }

      const wPos = vtkCoordinate.newInstance();
      wPos.setCoordinateSystemToWorld();
      wPos.setValue(...cachedCrosshairWorldPosition);

      const doubleDisplayPosition = wPos.getComputedDoubleDisplayValue(
        renderer
      );

      const dPos = vtkCoordinate.newInstance();
      dPos.setCoordinateSystemToDisplay();

      dPos.setValue(doubleDisplayPosition[0], doubleDisplayPosition[1], 0);
      let worldPos = dPos.getComputedWorldValue(renderer);

      const camera = renderer.getActiveCamera();
      const directionOfProjection = camera.getDirectionOfProjection();
      const halfSlabThickness = api.getSlabThickness() / 2;

      // Add half of the slab thickness to the world position, such that we select
      //The center of the slice.

      for (let i = 0; i < worldPos.length; i++) {
        worldPos[i] += halfSlabThickness * directionOfProjection[i];
      }

      if (api.svgWidgets.crosshairsWidget) {
        api.svgWidgets.crosshairsWidget.moveCrosshairs(
          worldPos,
          apis,
          apiIndex
        );
      }
      if (api.svgWidgets.rotatableCrosshairsWidget) {
        api.svgWidgets.rotatableCrosshairsWidget.moveCrosshairs(
          worldPos,
          apis,
          apiIndex
        );
      }
    }
  };

  publicAPI.setSlice = slice => {
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();

    if (model.volumeActor) {
      const range = publicAPI.getSliceRange();
      const bounds = model.volumeActor.getMapper().getBounds();

      const clampedSlice = clamp(slice, ...range);

      let cameraOffset = [0, 0, 0];
      if (cache.sliceCenter.length) {
        const oldPos = camera.getFocalPoint();
        vtkMath.subtract(oldPos, cache.sliceCenter, cameraOffset);
      }

      const center = [
        (bounds[0] + bounds[1]) / 2.0,
        (bounds[2] + bounds[3]) / 2.0,
        (bounds[4] + bounds[5]) / 2.0,
      ];

      const distance = camera.getDistance();
      const dop = camera.getDirectionOfProjection();
      vtkMath.normalize(dop);

      const midPoint = (range[1] + range[0]) / 2.0;
      const zeroPoint = [
        center[0] - dop[0] * midPoint,
        center[1] - dop[1] * midPoint,
        center[2] - dop[2] * midPoint,
      ];
      const slicePoint = [
        zeroPoint[0] + dop[0] * clampedSlice,
        zeroPoint[1] + dop[1] * clampedSlice,
        zeroPoint[2] + dop[2] * clampedSlice,
      ];

      // Cache the center for comparison to calculate the next camera offset
      cache.sliceCenter = [...slicePoint];

      const cameraPos = [
        slicePoint[0] - dop[0] * distance,
        slicePoint[1] - dop[1] * distance,
        slicePoint[2] - dop[2] * distance,
      ];

      vtkMath.add(slicePoint, cameraOffset, slicePoint);
      vtkMath.add(cameraPos, cameraOffset, cameraPos);

      camera.setPosition(...cameraPos);
      camera.setFocalPoint(...slicePoint);
      return slicePoint;
    }
  };

  publicAPI.getSliceRange = () => {
    if (model.volumeActor) {
      const sliceNormal = publicAPI.getSliceNormal();

      if (
        sliceNormal[0] === cache.sliceNormal[0] &&
        sliceNormal[1] === cache.sliceNormal[1] &&
        sliceNormal[2] === cache.sliceNormal[2]
      ) {
        return cache.sliceRange;
      }

      const bounds = model.volumeActor.getMapper().getBounds();
      const points = boundsToCorners(bounds);

      // Get rotation matrix from normal to +X (since bounds is aligned to XYZ)
      const transform = vtkMatrixBuilder
        .buildFromDegree()
        .identity()
        .rotateFromDirections(sliceNormal, [1, 0, 0]);

      points.forEach(pt => transform.apply(pt));

      // range is now maximum X distance
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < 8; i++) {
        const x = points[i][0];
        if (x > maxX) {
          maxX = x;
        }
        if (x < minX) {
          minX = x;
        }
      }

      cache.sliceNormal = sliceNormal;
      cache.sliceRange = [minX, maxX];
      return cache.sliceRange;
    }
    return [0, 0];
  };

  // Slice normal is just camera DOP
  publicAPI.getSliceNormal = () => {
    if (model.volumeActor && model.interactor) {
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      return camera.getDirectionOfProjection();
    }
    return [0, 0, 0];
  };

  publicAPI.setSliceNormal = (...normal) => {
    const viewportData = publicAPI.getViewport();

    if (viewportData) {
      viewportData.setOrientation(normal, viewportData.getCurrentViewUp());
    }

    setSliceNormalInternal(normal);
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

  publicAPI.setSliceOrientation = (normal, viewUp) => {
    const viewportData = publicAPI.getViewport();

    if (viewportData) {
      viewportData.setOrientation(normal, viewUp);
    }

    setSliceNormalInternal(normal);
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

  publicAPI.setUid = uid => {
    model.uid = uid;
  };

  publicAPI.getUid = () => {
    return model.uid;
  };

  setManipulators();
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  slabThickness: 0.1,
  uid: '',
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

// Returns new instance factory, takes initial values object
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
