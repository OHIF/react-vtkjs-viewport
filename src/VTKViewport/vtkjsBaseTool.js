import macro from 'vtk.js/Sources/macro';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import ViewportData from './ViewportData';
import EVENTS from '../events';

// Examples -> We would probably wrap these with vtkjs tools functionality.

import { math } from '../lib/math';

const { States } = Constants;

const { boundsToCorners, clamp } = math;

// NOTE:
// Basic idea:
// - Instantiate a new class when you want to change manipulators, this reduces the
//   complexity of the controller.
// - Pass a set of manipulators that will register sequentially. i.e. macro.chain?

function vtkjsBaseTool(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vkjsBaseTool');

  // React-vtkjs-viewport specific cache
  model.cache = {
    sliceNormal: [0, 0, 0],
    sliceRange: [0, 0],
    sliceCenter: [],
  };

  /*================================*/
  // Core react-vtkjs-viewport API. //
  /*================================*/

  // const superHandleMouseMove = publicAPI.handleMouseMove;
  // publicAPI.handleMouseMove = callData => {
  //   superHandleMouseMove(callData);

  //   console.log(model.state);

  //   if (model.state === States.IS_PAN) {
  //     const eventWindow = model.viewportData.getEventWindow();

  //     debugger;

  //     dispatchEvent(eventWindow, EVENTS.PAN_DRAG, { position });
  //   }
  // };

  publicAPI.setUid = uid => {
    model.uid = uid;
  };

  publicAPI.getUid = () => {
    return model.uid;
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

  publicAPI.setViewport = viewportData => {
    if (model.viewportData) {
      const oldWindow = model.viewportData.getEventWindow();

      oldWindow.removeEventListener(EVENTS.VIEWPORT_ROTATED, onRotateChanged);
    }

    model.viewportData = viewportData;

    Object.keys(model.manipulatorInstances).forEach(key => {
      const manipulator = model.manipulatorInstances[key];

      if (typeof manipulator.setViewportData === 'function') {
        //debugger;
        manipulator.setViewportData(viewportData);
      }
    });

    if (viewportData) {
      setSliceNormalInternal(viewportData.getCurrentSliceNormal());
      setViewUpInternal(viewportData.getCurrentViewUp());

      viewportData
        .getEventWindow()
        .addEventListener(EVENTS.VIEWPORT_ROTATED, onRotateChanged);
    }
  };

  publicAPI.setSliceNormal = (...normal) => {
    const viewportData = publicAPI.getViewport();

    if (viewportData) {
      viewportData.setOrientation(normal, viewportData.getCurrentViewUp());
    }

    setSliceNormalInternal(normal);
  };

  publicAPI.setSliceOrientation = (normal, viewUp) => {
    const viewportData = publicAPI.getViewport();

    if (viewportData) {
      viewportData.setOrientation(normal, viewUp);
    }

    setSliceNormalInternal(normal);
    setViewUpInternal(viewUp);
  };

  publicAPI.getViewport = () => model.viewportData;

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

      Object.keys(model.manipulatorInstances).forEach(key => {
        const manipulator = model.manipulatorInstances[key];

        if (typeof manipulator.setVolumeActor === 'function') {
          //debugger;
          manipulator.setVolumeActor(actor);
        }
      });

      publicAPI.updateScrollManipulator();
    } else {
      camera.setFreezeFocalPoint(false);
    }
  };

  publicAPI.getSliceRange = () => {
    if (model.volumeActor) {
      const sliceNormal = publicAPI.getSliceNormal();
      const { cache } = model;

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

  publicAPI.setSlice = slice => {
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();

    if (model.volumeActor) {
      const range = publicAPI.getSliceRange();
      const bounds = model.volumeActor.getMapper().getBounds();
      const { cache } = model;

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

  /*===================================*/
  // Private react-vtkjs-viewport API. //
  /*===================================*/

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

  publicAPI.setSlabThickness = slabThickness => {
    model.slabThickness = slabThickness;

    // Update the camera clipping range if the slab
    // thickness property is changed
    const renderer = model.interactor.getCurrentRenderer();
    const camera = renderer.getActiveCamera();
    camera.setThicknessFromFocalPoint(slabThickness);
  };

  function isCameraViewInitialized(camera) {
    const dist = camera.getDistance();

    return (
      typeof dist === 'number' && dist === Number(dist) && Number.isFinite(dist)
    );
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// TODO -> Make manipulators and pass them here.

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorStyleManipulator.extend(publicAPI, model, initialValues);

  macro.get(publicAPI, model, [
    'volumeActor',
    'slabThickness',
    'apis',
    'apiIndex',
  ]);

  // Object specific methods
  vtkjsBaseTool(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkjsBaseTool');

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
