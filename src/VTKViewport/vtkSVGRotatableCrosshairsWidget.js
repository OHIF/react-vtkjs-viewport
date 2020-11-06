import macro from 'vtk.js/Sources/macro';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import liangBarksyClip from '../helpers/liangBarksyClip';
import { vec2, vec3 } from 'gl-matrix';
import { projectVector2D } from 'vtk.js/Sources/Common/Core/Math';

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

  model.calculateReferenceLines = (apiIndex, point) => {
    const { strokeColors, apis } = model;
    if (point[0] === null || point[1] === null) {
      return;
    }

    const thisApi = apis[apiIndex];

    const { svgWidgetManager } = thisApi;
    const [width, height] = svgWidgetManager.getSize();
    const scale = svgWidgetManager.getScale();

    const p = point.slice();

    p[0] = point[0] * scale;
    p[1] = height - point[1] * scale;

    const left = 0;
    const top = 0;
    const right = width / scale;
    const bottom = height / scale;

    const quarterSmallestDimension = Math.min(width, height) / 4;

    // A "far" distance for line clipping algorithm.
    const farDistance = Math.sqrt(bottom * bottom + right * right);

    // TODO -> Move this calculation logic to the update function
    // And then save the values so we can grab them with another func.
    const referenceLines = [];

    const crosshairWorldPosition = apis[apiIndex].get(
      'cachedCrosshairWorldPosition'
    );

    const { rotatableCrosshairsWidget } = thisApi.svgWidgets;

    const oldReferenceLines = rotatableCrosshairsWidget.getReferenceLines();

    for (let i = 0; i < apis.length; i++) {
      if (i !== apiIndex) {
        const api = apis[i];

        const viewUp = api.getViewUp();
        const sliceNormal = api.getSliceNormal();

        let xAxis = [];

        vec3.cross(xAxis, viewUp, sliceNormal);
        vec3.normalize(xAxis, xAxis);

        // get a point in the plane.
        // Need a distant world position or we get rounding errors when mapping to screen and don't get nice right angles.
        const referenceWorldPointInPlane = [
          crosshairWorldPosition[0] + (viewUp[0] + xAxis[0]) * 1000000,
          crosshairWorldPosition[1] + (viewUp[1] + xAxis[1]) * 1000000,
          crosshairWorldPosition[2] + (viewUp[2] + xAxis[2]) * 1000000,
        ];

        // thisApi as we want to map it to the displayPosition of THIS api.
        const renderer = thisApi.genericRenderWindow.getRenderer();
        const wPos = vtkCoordinate.newInstance();
        wPos.setCoordinateSystemToWorld();
        wPos.setValue(...referenceWorldPointInPlane);

        const doubleDisplayPosition = wPos.getComputedDoubleDisplayValue(
          renderer
        );

        // convert to svg coordinates:

        const doubleSVGPosition = [
          doubleDisplayPosition[0] * scale,
          height - doubleDisplayPosition[1] * scale,
        ];

        let unitVectorFromCenter = [];
        vec2.subtract(unitVectorFromCenter, p, doubleSVGPosition);
        vec2.normalize(unitVectorFromCenter, unitVectorFromCenter);

        const distantPoint = [
          p[0] + unitVectorFromCenter[0] * farDistance,
          p[1] + unitVectorFromCenter[1] * farDistance,
        ];

        const negativeDistantPoint = [
          p[0] - unitVectorFromCenter[0] * farDistance,
          p[1] - unitVectorFromCenter[1] * farDistance,
        ];

        liangBarksyClip(negativeDistantPoint, distantPoint, [
          left, //xmin
          top, // ymin
          right, // xmax
          bottom, // ymax
        ]);

        const oldReferenceLine = oldReferenceLines.find(
          refLine => refLine && refLine.apiIndex === i
        );

        let lineSelected = false;
        let rotateSelected = false;
        let lineActive = false;

        if (oldReferenceLine) {
          lineSelected = oldReferenceLine.selected;
          rotateSelected = oldReferenceLine.rotateHandles.selected;
          lineActive = oldReferenceLine.active;
        }

        const firstRotateHandle = {
          x: p[0] + quarterSmallestDimension * unitVectorFromCenter[0],
          y: p[1] + quarterSmallestDimension * unitVectorFromCenter[1],
        };

        const secondRotateHandle = {
          x: p[0] - quarterSmallestDimension * unitVectorFromCenter[0],
          y: p[1] - quarterSmallestDimension * unitVectorFromCenter[1],
        };

        const referenceLine = {
          points: [
            { x: negativeDistantPoint[0], y: negativeDistantPoint[1] },
            {
              x: distantPoint[0],
              y: distantPoint[1],
            },
          ],
          rotateHandles: {
            selected: rotateSelected,
            points: [firstRotateHandle, secondRotateHandle],
          },
          color: strokeColors[i],
          apiIndex: i,
          selected: lineSelected,
          active: lineActive,
        };

        referenceLines.push(referenceLine);
      }
    }

    rotatableCrosshairsWidget.setReferenceLines(
      referenceLines[0],
      referenceLines[1]
    );
  };

  publicAPI.render = (svgContainer, scale) => {
    const node = getWidgetNode(svgContainer, model.widgetId);
    let {
      point,
      strokeColors,
      strokeWidth,
      strokeDashArray,
      rotateHandleRadius,
      apis,
      apiIndex,
      selectedStrokeWidth,
    } = model;
    if (point[0] === null || point[1] === null) {
      return;
    }

    const thisApi = apis[apiIndex];
    const referenceLines = thisApi.svgWidgets.rotatableCrosshairsWidget.getReferenceLines();

    const width = parseInt(svgContainer.getAttribute('width'), 10);
    const height = parseInt(svgContainer.getAttribute('height'), 10);

    const left = 0;
    const bottom = height / scale;

    // split up lines.

    const p = point.slice();

    p[0] = point[0] * scale;
    p[1] = height - point[1] * scale;

    const [firstLine, secondLine] = referenceLines;

    const {
      points: firstLineRotateHandles,
      selected: firstLineRotateSelected,
    } = firstLine.rotateHandles;
    const {
      points: secondLineRotateHandles,
      selected: secondLineRotateSelected,
    } = secondLine.rotateHandles;

    const [firstLinePart1, firstLinePart2] = model.getSplitReferenceLine(
      firstLine,
      p
    );
    const [secondLinePart1, secondLinePart2] = model.getSplitReferenceLine(
      secondLine,
      p
    );

    const firstLineStrokeColor = strokeColors[firstLine.apiIndex];
    const secondLineStrokeColor = strokeColors[secondLine.apiIndex];

    const firstLineStrokeWidth =
      firstLine.selected || firstLine.active
        ? selectedStrokeWidth
        : strokeWidth;
    const secondLineStrokeWidth =
      secondLine.selected || secondLine.active
        ? selectedStrokeWidth
        : strokeWidth;

    const firstLineRotateWidth = firstLineRotateSelected
      ? selectedStrokeWidth
      : strokeWidth;
    const secondLineRotateWidth = secondLineRotateSelected
      ? selectedStrokeWidth
      : strokeWidth;

    const firstLineShowCrosshairs =
      firstLine.selected || firstLineRotateSelected;
    const secondLineShowCrosshairs =
      secondLine.selected || secondLineRotateSelected;

    const firstLineRotateHandleRadius = firstLineShowCrosshairs
      ? rotateHandleRadius
      : 0;

    const secondLineRotateHandleRadius = secondLineShowCrosshairs
      ? rotateHandleRadius
      : 0;

    const firstLineRotateHandleFill = firstLineRotateSelected
      ? referenceLines[0].color
      : 'none';

    const secondLineRotateHandleFill = secondLineRotateSelected
      ? referenceLines[1].color
      : 'none';

    if (model.display) {
      node.innerHTML = `
      <g id="container" fill-opacity="1" stroke-dasharray="none" stroke="none" stroke-opacity="1" fill="none">
       <g>
       <svg version="1.1" viewBox="0 0 ${width} ${height}" width=${width} height=${height} style="width: 100%; height: 100%">
        <g

          stroke="${firstLineStrokeColor}"
          stroke-dasharray="${strokeDashArray}"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="${firstLineStrokeWidth}"
        >
        <!-- First Line part 1!-->
          <line
            x1="${firstLinePart1[0].x}"
            y1="${firstLinePart1[0].y}"
            x2="${firstLinePart1[1].x}"
            y2="${firstLinePart1[1].y}"
          ></line>
          <!-- First Line part 2!-->
          <line
            x1="${firstLinePart2[0].x}"
            y1="${firstLinePart2[0].y}"
            x2="${firstLinePart2[1].x}"
            y2="${firstLinePart2[1].y}"
          ></line>
        </g>
        <g
          stroke="${referenceLines[0].color}"
          stroke-dasharray="${strokeDashArray}"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="${firstLineRotateWidth}"
        >
            <!--First line rotateHandle 0 -->
            <circle cx="${firstLineRotateHandles[0].x}" cy="${
        firstLineRotateHandles[0].y
      }" r="${firstLineRotateHandleRadius}" fill="${firstLineRotateHandleFill}" />
            <!--First line rotateHandle 1 -->
            <circle cx="${firstLineRotateHandles[1].x}" cy="${
        firstLineRotateHandles[1].y
      }" r="${firstLineRotateHandleRadius}" fill="${firstLineRotateHandleFill}" />
        </g>
        <g
          stroke-dasharray="${strokeDashArray}"
          stroke="${secondLineStrokeColor}"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width=${secondLineStrokeWidth}
        >
          <!-- Second Line part 1 !-->
          <line
            x1="${secondLinePart1[0].x}"
            y1="${secondLinePart1[0].y}"
            x2="${secondLinePart1[1].x}"
            y2="${secondLinePart1[1].y}"
          ></line>
          <!-- Second Line part 2 !-->
          <line
            x1="${secondLinePart2[0].x}"
            y1="${secondLinePart2[0].y}"
            x2="${secondLinePart2[1].x}"
            y2="${secondLinePart2[1].y}"
          ></line>
      </g>
      <g
        stroke-dasharray="${strokeDashArray}"
        stroke="${referenceLines[1].color}"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width=${secondLineRotateWidth}
      >
        <!--Second line rotateHandle 0 -->
        <circle cx="${secondLineRotateHandles[0].x}" cy="${
        secondLineRotateHandles[0].y
      }" r="${secondLineRotateHandleRadius}" fill="${secondLineRotateHandleFill}" />
        <!--Second line rotateHandle 1 -->
        <circle cx="${secondLineRotateHandles[1].x}" cy="${
        secondLineRotateHandles[1].y
      }" r="${secondLineRotateHandleRadius}" fill="${secondLineRotateHandleFill}" />
      </g>
      <circle cx="${width - 20}" cy="${20}" r="10" fill="${
        strokeColors[apiIndex]
      }" />
      </g>

      `;
    } else {
      node.innerHTML = '';
    }
  };

  model.getSplitReferenceLine = (referenceLine, center) => {
    const { centerRadius } = model;

    const lineDirection = [];
    vec2.subtract(
      lineDirection,
      [referenceLine.points[1].x, referenceLine.points[1].y],
      [referenceLine.points[0].x, referenceLine.points[0].y]
    );
    vec2.normalize(lineDirection, lineDirection);

    const linePart1 = [
      {
        x: center[0] + lineDirection[0] * centerRadius,
        y: center[1] + lineDirection[1] * centerRadius,
      },
      referenceLine.points[1],
    ];
    const linePart2 = [
      {
        x: center[0] - lineDirection[0] * centerRadius,
        y: center[1] - lineDirection[1] * centerRadius,
      },
      referenceLine.points[0],
    ];

    return [linePart1, linePart2];
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
    apis.forEach((api, apiIndex) => {
      api.set('cachedCrosshairWorldPosition', worldPos);
      if (api.get('initialCachedCrosshairWorldPosition') === undefined) {
        api.set('initialCachedCrosshairWorldPosition', worldPos);
      }

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

      const displayPosition = wPos.getComputedDoubleDisplayValue(renderer);

      const { svgWidgetManager } = api;
      api.svgWidgets.rotatableCrosshairsWidget.setPoint(
        displayPosition[0],
        displayPosition[1]
      );

      model.calculateReferenceLines(apiIndex, displayPosition);

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
  referenceLines: [null, null],
  strokeColors: ['#e83a0e', '#ede90c', '#07e345'],
  strokeWidth: 1,
  rotateHandleRadius: 5,
  selectedStrokeWidth: 3,
  centerRadius: 20,
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
    'selectedStrokeWidth',
    'strokeDashArray',
    'display',
    'apiIndex',
    'referenceLines',
    'centerRadius',
  ]);

  macro.setGetArray(publicAPI, model, ['point', 'referenceLines'], 2);
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
