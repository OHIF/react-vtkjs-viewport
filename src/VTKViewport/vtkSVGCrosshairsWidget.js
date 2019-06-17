import macro from 'vtk.js/Sources/macro';

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

function vtkSVGCrosshairsWidget(publicAPI, model) {
  model.classHierarchy.push('vtkSVGCrosshairsWidget');
  model.widgetId = `vtkSVGCrosshairsWidget-${instanceId++}`;

  publicAPI.render = (svgContainer, scale) => {
    const node = getWidgetNode(svgContainer, model.widgetId);
    const { point, strokeColor, strokeWidth, strokeDashArray, padding } = model;
    if (point[0] === null || point[1] === null) {
      return;
    }

    const width = parseInt(svgContainer.getAttribute('width'), 10);
    const height = parseInt(svgContainer.getAttribute('height'), 10);
    const widthScale = svgContainer.getBoundingClientRect().width / width;
    const heightScale = svgContainer.getBoundingClientRect().height / height;
    const widthClient = svgContainer.getBoundingClientRect().width;
    const heightClient = svgContainer.getBoundingClientRect().height;

    const p = point.slice();
    p[0] = point[0] * scale;
    p[1] = height - point[1] * scale;

    const left = [0, height / scale / 2];
    const top = [width / scale / 2, 0];
    const right = [width / scale, height / scale / 2];
    const bottom = [width / scale / 2, height / scale];
    node.innerHTML = `
<g id="container" fill-opacity="1" stroke-dasharray="none" stroke="none" stroke-opacity="1" fill="none">
 <g>
 <!-- TODO: Why is this <svg> necessary?? </svg> If I don't include it, nothing renders !-->
 <svg version="1.1" viewBox="0 0 ${width} ${height}" width=${width} height=${height} style="width: 100%; height: 100%">
 <!-- Top !-->
  <line
    x1="${p[0]}"
    y1="${top[1]}"
    x2="${p[0]}"
    y2="${p[1] - padding}"
    stroke="${strokeColor}"
    stroke-dasharray="${strokeDashArray}"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="${strokeWidth}"
  ></line>
  <!-- Right !-->
  <line
    x1="${right[0]}"
    y1="${p[1]}"
    x2="${p[0] + padding}"
    y2="${p[1]}"
    stroke-dasharray="${strokeDashArray}"
    stroke="${strokeColor}"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width=${strokeWidth}
  ></line>
  <!-- Bottom !-->
  <line
    x1="${p[0]}"
    y1="${bottom[1]}"
    x2="${p[0]}"
    y2="${p[1] + padding}"
    stroke-dasharray="${strokeDashArray}"
    stroke="${strokeColor}"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width=${strokeWidth}
  ></line>
  <!-- Left !-->
  <line
    x1="${left[0]}"
    y1="${p[1]}"
    x2="${p[0] - padding}"
    y2="${p[1]}"
    stroke-dasharray="${strokeDashArray}"
    stroke="${strokeColor}"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width=${strokeWidth}
  ></line>
 </g>
</g>
      `;
  };
}

// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  point: [null, null],
  strokeColor: '#00ff00',
  strokeWidth: 1,
  strokeDashArray: '',
  padding: 20,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['widgetId']);
  macro.setGet(publicAPI, model, [
    'strokeColor',
    'strokeWidth',
    'strokeDashArray',
  ]);
  macro.setGetArray(publicAPI, model, ['point', 'padding'], 2);

  vtkSVGCrosshairsWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkSVGCrosshairsWidget');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
