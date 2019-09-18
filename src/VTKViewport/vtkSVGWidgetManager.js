import macro from 'vtk.js/Sources/macro';

const { vtkErrorMacro } = macro;
let instanceId = 1;

function createSVGRoot(id) {
  const el = document.createElement('svg');
  el.setAttribute('id', id);
  el.setAttribute(
    'style',
    'position: absolute; top: 0; left: 0; width: 100%; height: 100%;'
  );
  el.setAttribute('version', '1.1');
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  return el;
}

// ----------------------------------------------------------------------------

function vtkSVGWidgetManager(publicAPI, model) {
  model.classHierarchy.push('vtkSVGWidgetManager');
  model.widgetId = `vtkSVGWidgetManager-${instanceId++}`;
  model.svgRootNode = createSVGRoot(model.widgetId);
  model.widgets = [];

  publicAPI.setRenderer = renderer => {
    const renderWindow = renderer.getRenderWindow();
    const interactor = renderWindow.getInteractor();
    model.openGLRenderWindow = interactor.getView();
    publicAPI.setContainer(model.openGLRenderWindow.getReferenceByName('el'));
  };

  publicAPI.setContainer = el => {
    if (model.container && model.container !== el) {
      // Remove canvas from previous container
      if (model.svgRootNode.parentNode === model.container) {
        model.container.removeChild(model.svgRootNode);
      } else {
        vtkErrorMacro('Error: SVG parent node does not match container');
      }
    }

    if (model.container !== el) {
      model.container = el;
      if (model.container) {
        model.container.appendChild(model.svgRootNode);
      }

      // Trigger modified()
      publicAPI.modified();
    }
  };

  publicAPI.getSize = () => model.openGLRenderWindow.getSize();

  publicAPI.addWidget = svgWidget => {
    if (model.widgets.indexOf(svgWidget) === -1) {
      model.widgets.push(svgWidget);
    }
    publicAPI.render();
  };

  publicAPI.removeWidget = svgWidget => {
    const id = svgWidget.getWidgetId();
    const widgetNode = model.svgRootNode.querySelector(`#${id}`);
    model.svgRootNode.removeChild(widgetNode);
    const index = model.widgets.indexOf(svgWidget);
    if (index !== -1) {
      model.widgets.splice(index, 1);
    }
    publicAPI.render();
  };

  publicAPI.render = () => {
    if (model.svgRootNode) {
      // TODO: Not sure this is the best approach but it seems to be
      // making things smoother. Updating the DOM seemed to be
      // the performance bottleneck for the crosshairs tool
      requestAnimationFrame(() => {
        const { scale } = model;
        const [width, height] = publicAPI.getSize();
        model.svgRootNode.setAttribute(
          'viewBox',
          `0 0 ${width * scale} ${height * scale}`
        );
        model.svgRootNode.setAttribute('width', `${width * scale}`);
        model.svgRootNode.setAttribute('height', `${height * scale}`);
        for (let i = 0; i < model.widgets.length; i++) {
          model.widgets[i].render(model.svgRootNode, model.scale);
        }
      });
    }
  };
}

// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  scale: 0.5,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['container']);
  macro.setGet(publicAPI, model, ['scale']);
  vtkSVGWidgetManager(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkSVGWidgetManager');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
