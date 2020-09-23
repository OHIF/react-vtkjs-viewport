import macro from 'vtk.js/Sources/macro';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';

let instanceId = 1;

function getWidgetNode(svgContainer, widgetId) {
  let node = svgContainer.querySelector(`#${widgetId}`);
  if (!node) {
    node = document.createElement('g');
    node.setAttribute('id', widgetId);
    svgContainer.appendChild(node);
  }
  return node;
}

// ----------------------------------------------------------------------------

function vtkSVGRotatableCrosshairsWidget(publicAPI, model) {
  model.classHierarchy.push('vtkSVGRotatableCrosshairsWidget');
  model.widgetId = `vtkSVGRotatableCrosshairsWidget-${instanceId++}`;

  publicAPI.render = (svgContainer, scale) => {
    const node = getWidgetNode(svgContainer, model.widgetId);
    const {
      point,
      strokeColors,
      strokeWidth,
      strokeDashArray,
      apis,
      apiIndex,
    } = model;
    if (point[0] === null || point[1] === null) {
      return;
    }

    debugger;

    const width = parseInt(svgContainer.getAttribute('width'), 10);
    const height = parseInt(svgContainer.getAttribute('height'), 10);
    // Unused
    // const widthScale = svgContainer.getBoundingClientRect().width / width;
    // const heightScale = svgContainer.getBoundingClientRect().height / height;
    // const widthClient = svgContainer.getBoundingClientRect().width;
    // const heightClient = svgContainer.getBoundingClientRect().height;

    const p = point.slice();
    p[0] = point[0] * scale;
    p[1] = height - point[1] * scale;

    const left = 0;
    const top = 0;
    const right = width / scale;
    const bottom = height / scale;

    const lines = [
      {
        points: [
          { x: p[0], y: top },
          { x: p[0], y: bottom },
        ],
        color: null,
      },
      {
        points: [
          { x: left, y: p[1] },
          { x: right, y: p[1] },
        ],
        color: null,
      },
    ];

    const thisApi = apis[apiIndex];

    let lineIndex = 0;

    console.log(`this: ${apiIndex}`);

    for (let i = 0; i < apis.length; i++) {
      if (i !== apiIndex) {
        const api = apis[i];

        lines[lineIndex].color = strokeColors[i];
        lineIndex++; // Temp to test.

        console.log(`line: ${i}`);
      }
    }

    debugger;

    if (model.display) {
      node.innerHTML = `
      <g id="container" fill-opacity="1" stroke-dasharray="none" stroke="none" stroke-opacity="1" fill="none">
       <g>
       <!-- TODO: Why is this <svg> necessary?? </svg> If I don't include it, nothing renders !-->
       <svg version="1.1" viewBox="0 0 ${width} ${height}" width=${width} height=${height} style="width: 100%; height: 100%">
       <!-- First Line!-->
        <line
          x1="${lines[0].points[0].x}"
          y1="${lines[0].points[0].y}"
          x2="${lines[0].points[1].x}"
          y2="${lines[0].points[1].y}"
          stroke="${lines[0].color}"
          stroke-dasharray="${strokeDashArray}"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="${strokeWidth}"
        ></line>
        <!-- Second Line !-->
        <line
        x1="${lines[1].points[0].x}"
        y1="${lines[1].points[0].y}"
        x2="${lines[1].points[1].x}"
        y2="${lines[1].points[1].y}"
          stroke-dasharray="${strokeDashArray}"
          stroke="${lines[1].color}"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width=${strokeWidth}
        ></line>
        <circle cx="${bottom - 20}" cy="${left + 20}" r="10" fill="${
        strokeColors[apiIndex]
      }" />
      </g>
            `;
    } else {
      node.innerHTML = '';
    }
  };

  publicAPI.resetCrosshairs = (apis, apiIndex) => {
    const api = apis[apiIndex];

    if (!api.svgWidgets.rotatableCrosshairsWidget) {
      // If we aren't using the crosshairs widget, bail out early.
      return;
    }

    // Get viewport and get its center.
    const renderer = api.genericRenderWindow.getRenderer();
    const view = renderer.getRenderWindow().getViews()[0];
    const dims = view.getViewportSize(renderer);
    const dPos = vtkCoordinate.newInstance();

    dPos.setCoordinateSystemToDisplay();

    dPos.setValue(0.5 * dims[0], 0.5 * dims[1], 0);
    let worldPos = dPos.getComputedWorldValue(renderer);

    const camera = renderer.getActiveCamera();
    const directionOfProjection = camera.getDirectionOfProjection();
    const halfSlabThickness = api.getSlabThickness() / 2;

    // Add half of the slab thickness to the world position, such that we select
    //The center of the slice.

    for (let i = 0; i < worldPos.length; i++) {
      worldPos[i] += halfSlabThickness * directionOfProjection[i];
    }

    publicAPI.moveCrosshairs(worldPos, apis);
  };

  publicAPI.moveCrosshairs = (worldPos, apis) => {
    if (worldPos === undefined || apis === undefined) {
      console.error(
        'worldPos, apis must be defined in order to update crosshairs.'
      );
    }

    // Set camera focal point to world coordinate for linked views
    apis.forEach((api, viewportIndex) => {
      api.set('cachedCrosshairWorldPosition', worldPos);

      // We are basically doing the same as getSlice but with the world coordinate
      // that we want to jump to instead of the camera focal point.
      // I would rather do the camera adjustment directly but I keep
      // doing it wrong and so this is good enough for now.
      const renderWindow = api.genericRenderWindow.getRenderWindow();

      const istyle = renderWindow.getInteractor().getInteractorStyle();
      const sliceNormal = istyle.getSliceNormal();
      const transform = vtkMatrixBuilder
        .buildFromDegree()
        .identity()
        .rotateFromDirections(sliceNormal, [1, 0, 0]);

      const mutatedWorldPos = worldPos.slice();
      transform.apply(mutatedWorldPos);
      const slice = mutatedWorldPos[0];

      istyle.setSlice(slice);

      renderWindow.render();

      const renderer = api.genericRenderWindow.getRenderer();
      const wPos = vtkCoordinate.newInstance();
      wPos.setCoordinateSystemToWorld();
      wPos.setValue(...worldPos);

      const displayPosition = wPos.getComputedDisplayValue(renderer);

      const { svgWidgetManager } = api;
      api.svgWidgets.rotatableCrosshairsWidget.setPoint(
        displayPosition[0],
        displayPosition[1]
      );

      svgWidgetManager.render();
    });
  };

  publicAPI.updateCrosshairForApi = api => {
    if (!api.svgWidgets.rotatableCrosshairsWidget) {
      // If we aren't using the crosshairs widget, bail out early.
      return;
    }

    const renderer = api.genericRenderWindow.getRenderer();
    let cachedCrosshairWorldPosition = api.get('cachedCrosshairWorldPosition');

    const wPos = vtkCoordinate.newInstance();
    wPos.setCoordinateSystemToWorld();
    wPos.setValue(...cachedCrosshairWorldPosition);

    const doubleDisplayPosition = wPos.getComputedDoubleDisplayValue(renderer);

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

    publicAPI.moveCrosshairs(worldPos, [api]);
  };
}

// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  point: [null, null],
  apis: [null, null, null],
  strokeColors: ['#e83a0e', '#ede90c', '#07e345'],
  strokeWidth: 2,
  strokeDashArray: '',
  display: true,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['widgetId']);
  macro.setGet(publicAPI, model, [
    'strokeWidth',
    'strokeDashArray',
    'display',
    'apiIndex',
  ]);

  macro.setGetArray(publicAPI, model, ['point'], 2);
  macro.setGetArray(publicAPI, model, ['apis', 'strokeColors'], 3);

  vtkSVGRotatableCrosshairsWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkSVGRotatableCrosshairsWidget'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
