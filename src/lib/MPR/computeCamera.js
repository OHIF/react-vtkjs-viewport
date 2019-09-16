function computeCameraForAP(viewOrientation, camera) {
  switch (viewOrientation) {
    case 'A':
    case 'P':
      camera.elevation(-90);
      break;

    case 'I':
    case 'S':
      camera.azimuth(180);
      camera.roll(180);
      break;
    case 'L':
    case 'R':
      camera.azimuth(90);
      camera.roll(-90);
      break;
  }
}

function computeCameraForIS(viewOrientation, camera) {
  switch (viewOrientation) {
    case 'A':
    case 'P':
      camera.elevation(-90);
      break;

    case 'I':
    case 'S':
      camera.azimuth(180);
      camera.roll(180);
      break;
    case 'L':
    case 'R':
      camera.azimuth(90);
      camera.roll(-90);
      break;
  }
}

function computeCameraForLR(viewOrientation, camera) {
  switch (viewOrientation) {
    case 'A':
    case 'P':
      camera.elevation(-90);
      break;

    case 'I':
    case 'S':
      camera.azimuth(180);
      camera.roll(180);
      break;
    case 'L':
    case 'R':
      camera.azimuth(90);
      camera.roll(-90);
      break;
  }
}

export function computeCamera(imageOrientation, viewOrientation, camera) {
  switch (imageOrientation) {
    case 'A':
    case 'P':
      return computeCameraForAP(viewOrientation, camera);
    case 'I':
    case 'S':
      return computeCameraForIS(viewOrientation, camera);
    case 'L':
    case 'R':
      return computeCameraForLR(viewOrientation, camera);
  }

  camera.setParallelProjection(true);
}
