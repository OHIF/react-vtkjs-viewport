import Constants from 'vtk.js/Sources/Rendering/Core/InteractorStyle/Constants';
import vtkInteractorStyleTrackballCamera from 'vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera';
import macro from 'vtk.js/Sources/macro';

const { States } = Constants;

const SlicingMode = {
  I: 0,
  J: 1,
  K: 2
};

// from gl-matrix
function transformMat3(a, m) {
  const out = [0, 0, 0];
  let x = a[0],
    y = a[1],
    z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}

function vtkCustomSliceInteractorStyle(publicAPI, model) {
  model.classHierarchy.push('vtkCustomSliceInteractorStyle');
  model.wlStartPos = [0, 0];
  model.zoomStartPos = [0, 0];
  publicAPI.handleStartMouseWheel = callData => {
    publicAPI.startSlice();
  };
  publicAPI.handleEndMouseWheel = callData => {
    publicAPI.endSlice();
  };
  publicAPI.handleMouseWheel = callData => {
    const renderer = callData.pokedRenderer;
    const camera = renderer.getActiveCamera();
    const dims = model.currentImage.getDimensions();
    const newSlice = Math.min(
      // negate spinY, since scrolling up is negative, and scrolling down is positive
      Math.max(0, model.slice - callData.spinY),
      // ignore last slice
      dims[model.slicingMode] - 1
    );
    publicAPI.setSlice(Math.round(newSlice));
    publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
  };
  const superHandleLeftButtonPress = publicAPI.handleLeftButtonPress;
  publicAPI.handleLeftButtonPress = callData => {
    model.wlStartPos[0] = callData.position.x;
    model.wlStartPos[1] = callData.position.y;
    if (!callData.shiftKey && !callData.controlKey) {
      const property = model.currentProperty;
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
  const superHandleLeftButtonRelease = publicAPI.handleLeftButtonRelease;
  publicAPI.handleLeftButtonRelease = callData => {
    if (model.state === States.IS_WINDOW_LEVEL) {
      publicAPI.endWindowLevel();
    } else if (superHandleLeftButtonRelease) {
      superHandleLeftButtonRelease(callData);
    }
  };
  const superHandleRightButtonPress = publicAPI.handleRightButtonPress;
  publicAPI.handleRightButtonPress = callData => {
    model.zoomStartPos[0] = callData.position.x;
    model.zoomStartPos[1] = callData.position.y;
    if (!callData.shiftKey && !callData.controlKey) {
      model.initialAngle = callData.pokedRenderer
        .getActiveCamera()
        .getViewAngle();
      publicAPI.startCameraPose();
    } else if (superHandleRightButtonPress) {
      superHandleRightButtonPress(callData);
    }
  };
  const superHandleRightButtonRelease = publicAPI.handleRightButtonRelease;
  publicAPI.handleRightButtonRelease = callData => {
    if (model.state === States.IS_CAMERA_POSE) {
      publicAPI.endCameraPose();
    } else if (superHandleRightButtonRelease) {
      superHandleRightButtonRelease(callData);
    }
  };
  const superHandleMouseMove = publicAPI.handleMouseMove;
  publicAPI.handleMouseMove = callData => {
    const pos = [callData.position.x, callData.position.y];
    const renderer = callData.pokedRenderer;
    if (model.state === States.IS_WINDOW_LEVEL) {
      publicAPI.windowLevel(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    } else if (model.state === States.IS_CAMERA_POSE) {
      publicAPI.zoom(renderer, pos);
      publicAPI.invokeInteractionEvent({ type: 'InteractionEvent' });
    } else {
      superHandleMouseMove(callData);
    }
  };
  publicAPI.windowLevel = (renderer, pos) => {
    const rwi = model.interactor;
    if (model.currentProperty) {
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
      model.currentProperty
        .getRGBTransferFunction(0)
        .setMappingRange(lower, upper);
    }
  };
  publicAPI.zoom = (renderer, pos) => {
    const camera = renderer.getActiveCamera();
    const dy = (pos[1] - model.zoomStartPos[1]) / 10.0;
    const newAngle = Math.max(1, Math.min(179, model.initialAngle + dy));
    camera.setViewAngle(newAngle);
  };
  publicAPI.setCurrentVolumeNumber = i => {
    const renderer = model.interactor.getCurrentRenderer();
    if (!renderer) {
      return;
    }
    model.currentVolumeNumber = i;
    function propMatch(j, prop, targetIndex) {
      return prop.isA('vtkVolume') && j === targetIndex && prop.getPickable();
    }
    const props = renderer.getViewProps();
    let targetIndex = i;
    if (i < 0) {
      targetIndex += props.length;
    }
    let prop = null;
    let foundProp = false;
    for (let j = 0; j < props.length && !foundProp; j++) {
      if (propMatch(j, props[j], targetIndex)) {
        foundProp = true;
        prop = props[j];
      }
    }
    if (prop) {
      model.currentProperty = prop.getProperty();
      model.currentImage = prop.getMapper().getInputData();
    }
  };
  publicAPI.setSlice = slice => {
    if (slice !== model.slice) {
      const sliceDelta = slice - model.slice;
      model.slice = slice;
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      const spacing = model.currentImage.getSpacing();
      const direction = model.currentImage.getDirection();
      const worldSpacing = transformMat3(spacing, direction);
      const delta = sliceDelta * worldSpacing[model.slicingMode];
      const pos = camera.getPosition();
      const fp = camera.getFocalPoint();
      const dop = camera.getDirectionOfProjection();
      const deltaV = [delta * dop[0], delta * dop[1], delta * dop[2]];
      pos[0] += deltaV[0];
      pos[1] += deltaV[1];
      pos[2] += deltaV[2];
      fp[0] += deltaV[0];
      fp[1] += deltaV[1];
      fp[2] += deltaV[2];
      camera.setPosition(...pos);
      camera.setFocalPoint(...fp);
      publicAPI.modified();
    }
  };
  publicAPI.setSlicingMode = (mode, force = false) => {
    if (force || (mode !== model.slicingMode && mode >= 0 && mode < 3)) {
      model.slicingMode = mode;
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      const bounds = model.currentImage.getBounds();
      const dims = model.currentImage.getDimensions();
      const dop = [0, 0, 0];
      dop[mode] = 1;
      const boundsCenter = [
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2
      ];
      let viewUp = [0, 0, 1];
      if (mode === 2) {
        // switch viewUp to Y if viewing down Z axis
        viewUp = [0, 1, 0];
      }
      let widthAxis = 0;
      // get perpendicular to dop and viewup, assuming those vects are axis-aligned.
      for (let i = 0; i < 3; i++) {
        if (dop[i] === 0 && viewUp[i] === 0) {
          widthAxis = i;
          break;
        }
      }
      const viewWidth = bounds[2 * widthAxis + 1] - bounds[2 * widthAxis];
      const angle = 90;
      // dist from camera to fp
      const d = viewWidth / (2 * Math.tan((angle / 360) * Math.PI));
      const fp = boundsCenter.slice();
      fp[mode] = bounds[2 * mode]; // 0 slice
      const pos = fp.slice();
      pos[mode] -= d; // distance from camera to focal point is d
      // move to current slice
      const spacing = model.currentImage.getSpacing();
      const direction = model.currentImage.getDirection();
      const worldSpacing = transformMat3(spacing, direction);
      fp[mode] += model.slice * worldSpacing[mode];
      camera.setPosition(...pos);
      camera.setFocalPoint(...fp);
      camera.setViewUp(...viewUp);
      camera.setViewAngle(angle);
      camera.setClippingRange(d, d + 1);
    }
  };
}
const INITIAL_VALUES = {
  slice: 0,
  slicingMode: SlicingMode.K,
  autoAdjustCameraClippingRange: false
};
function extend(publicAPI, model, initialValues) {
  Object.assign(model, INITIAL_VALUES, initialValues || {});
  vtkInteractorStyleTrackballCamera.extend(
    publicAPI,
    model,
    initialValues || {}
  );
  macro.setGet(publicAPI, model, ['slicingMode']);
  macro.get(publicAPI, model, ['slice']);
  vtkCustomSliceInteractorStyle(publicAPI, model);
}

const newInstance = macro.newInstance(extend, 'vtkCustomSliceInteractorStyle');

const CustomSliceInteractorStyle = { newInstance, extend, SlicingMode };

export default CustomSliceInteractorStyle;
