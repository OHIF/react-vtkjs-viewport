import macro from 'vtk.js/Sources/macro';
import vtkInteractorObserver from 'vtk.js/Sources/Rendering/Core/InteractorObserver';

/**
 * vtkInteractorObserverClass.
 * @param publicAPI
 * @param model
 */
function ohifInteractorObserver(publicAPI, model) {
  model.classHierarchy.push('ohifInteractorObserver');

  macro.setGet(publicAPI, model, ['pluginInstanceData']);

  /**
   * Part of the interface for interactorObserver
   * @param evt
   */
  publicAPI.handleStartInteractionEvent = evt => {};

  /**
   * handleInteractionEvent: if wheelData or windowLevelData,
   * call the plugin to update the UI and any other methods.
   * @param evt
   */
  publicAPI.handleInteractionEvent = evt => {
    let data = publicAPI.getPluginInstanceData();
    const isWheelEvent = !!evt.wheelData;
    const isWindowLevelEvent = !!evt.windowLevelData;
    if (isWheelEvent) {
      data.plugin.updateViewportText(evt.wheelData);
    } else if (isWindowLevelEvent) {
      data.plugin.updateWindowLevelText(evt.windowLevelData);
    }
  };

  /**
   * Part of the interface for interactorObserver.
   * @param evt
   */
  publicAPI.handleEndInteractionEvent = evt => {};
}

const DEFAULT_VALUES = {
  enabled: true,
  interactor: null,
  priority: 0.0,
  processEvents: true,
  subscribedEvents: [],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkInteractorObserver.extend(publicAPI, model, initialValues);

  // Object specific methods
  ohifInteractorObserver(publicAPI, model, initialValues);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'ohifInteractorObserver');

// ----------------------------------------------------------------------------

export default Object.assign({ newInstance, extend });
