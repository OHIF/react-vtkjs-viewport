/**
 * Install the renderer into the Viewport
 *
 * @param volumeViewer
 * @param actor
 */
export function installVTKViewer(volumeViewer, actor) {
  const renderer = volumeViewer.getRenderer();
  const renderWindow = volumeViewer.getRenderWindow();

  renderer.addVolume(actor);
  renderer.resetCamera();
  renderer.updateLightsGeometryToFollowCamera();

  renderWindow.render();
}
