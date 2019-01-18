import { computeSlicingMode } from './computeSlicingMode.js';
import { computeCamera } from './computeCamera.js';

export function changeView(renderer, imageMapper, viewOrientation) {
  const renderWindow = fullScreenRenderWindow.getRenderWindow();
  const renderer = fullScreenRenderWindow.getRenderer();
  const mode = computeSlicingMode(scanDirection, viewOrientation);

  imageMapper.setSlicingMode(mode);
  renderer.setActiveCamera(renderer.makeCamera());

  computeCamera(scanDirection, value, renderer.getActiveCamera());

  renderer.resetCamera();
  renderer.resetCameraClippingRange();

  renderWindow.getInteractor().setInteractorStyle(interactorStyle);
  renderWindow.render();
}
