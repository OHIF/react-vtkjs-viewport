import { computeSlicingMode } from './computeSlicingMode.js';
import { computeCamera } from './computeCamera.js';

// TODO: More than a few undefined here, and renderer is defined twice?
// NOTE: switched internal `renderer` to `rendererPrime` so eslint can parse
export function changeView(renderer, imageMapper, viewOrientation) {
  const renderWindow = fullScreenRenderWindow.getRenderWindow();
  const rendererPrime = fullScreenRenderWindow.getRenderer();
  const mode = computeSlicingMode(scanDirection, viewOrientation);

  imageMapper.setSlicingMode(mode);
  rendererPrime.setActiveCamera(rendererPrime.makeCamera());

  computeCamera(scanDirection, value, rendererPrime.getActiveCamera());

  rendererPrime.resetCamera();
  rendererPrime.resetCameraClippingRange();

  renderWindow.getInteractor().setInteractorStyle(interactorStyle);
  renderWindow.render();
}
