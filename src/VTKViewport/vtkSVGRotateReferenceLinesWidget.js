import macro from 'vtk.js/Sources/macro';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';

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
// ---------------------------------------------------------------------------
// Credit to: https://codepen.io/enxaneta/pen/QdOprr
const SVG_NS = 'http://www.w3.org/2000/svg';

function rotateVec(vec, angle) {
  const [x, y] = vec;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.cos(angle);
  return [x * cosAngle - y * sinAngle, x * sinAngle + y * cosAngle];
}

function Element(o, index, svg, onUpdated, renderer, sliceNormal) {
  this.g = document.createElementNS(SVG_NS, 'g');
  this.g.setAttributeNS(null, 'id', index);
  svg.appendChild(this.g);

  o.parent = this.g;

  this.el = drawElement(o);
  this.a = 0;
  this.tagName = o.tagName;
  this.onUpdated = onUpdated;
  this.elRect = this.el.getBoundingClientRect();
  this.svgRect = svg.getBoundingClientRect();
  this.Left = this.elRect.left - this.svgRect.left;
  this.Right = this.elRect.right - this.svgRect.left;
  this.Top = this.elRect.top - this.svgRect.top;
  this.Bottom = this.elRect.bottom - this.svgRect.top;

  this.LT = {
    x: this.Left,
    y: this.Top,
  };
  this.RT = {
    x: this.Right,
    y: this.Top,
  };
  this.LB = {
    x: this.Left,
    y: this.Bottom,
  };
  this.RB = {
    x: this.Right,
    y: this.Bottom,
  };
  this.o = {
    x: 0,
    y: 0,
  };

  this.A = Math.atan2(this.elRect.height / 2, this.elRect.width / 2);

  const radius = 15;
  const leftMid = {
    properties: {
      cx: this.LT.x,
      cy: this.LT.y,
      r: radius,
      fill: '#3CAEA3',
    },
    parent: this.g,
    tagName: 'circle',
  };

  this.el.style.cursor = 'move';

  this.lt = drawElement(leftMid);
  this.lt.style.cursor = 'alias';

  this.update = function(triggerUpdate = true) {
    const deg = 180 / Math.PI;
    const element = this;

    const cx = element.LT.x + element.elRect.width / 2;
    const cy = element.LT.y + element.elRect.height / 2;
    const transf = `translate(${element.o.x}, ${
      element.o.y
    }) rotate(${element.a * deg}, ${cx}, ${cy})`;
    this.el.setAttribute('transform', transf);
    this.lt.setAttribute('transform', transf);

    if (this.onUpdated && triggerUpdate === true) {
      const point = [element.o.x + cx, element.o.y + cy];
      const origin = getWorldCoordFromDisplay(point, renderer);
      const p2display = rotateVec([cx, cy], element.a);
      const p1 = getWorldCoordFromDisplay([element.o.x, element.o.y], renderer);
      const p2 = getWorldCoordFromDisplay(p2display, renderer);
      const vector = [];
      vtkMath.subtract(p2, p1, vector);
      vtkMath.normalize(vector);
      console.warn(vector);

      const normalToRefLine = [];
      vtkMath.cross(sliceNormal, vector, normalToRefLine);

      vtkMath.normalize(normalToRefLine);

      element.onUpdated({
        origin,
        normal: normalToRefLine,
      });
    }
  };
}

function setupListeners(svg, elements) {
  // EVENTS
  let dragging = false;
  let rotating = false;

  const delta = {
    x: 0,
    y: 0,
  };

  svg.addEventListener(
    'mousedown',
    function(evt) {
      const index = parseInt(evt.target.parentElement.id) - 1;

      if (evt.target.tagName == elements[index].tagName) {
        dragging = index + 1;
        const offset = getMousePosition(svg, evt);
        delta.x = elements[index].o.x - offset.x;
        delta.y = elements[index].o.y - offset.y;
      }

      if (evt.target.tagName == 'circle') {
        rotating = parseInt(evt.target.parentElement.id);
      }

      evt.preventDefault();
      evt.stopPropagation();
    },
    false
  );

  svg.addEventListener(
    'mouseup',
    function(evt) {
      rotating = false;
      dragging = false;

      evt.preventDefault();
      evt.stopPropagation();
    },
    false
  );

  svg.addEventListener(
    'mouseleave',
    function(evt) {
      rotating = false;
      dragging = false;

      evt.preventDefault();
      evt.stopPropagation();
    },
    false
  );

  svg.addEventListener(
    'mousemove',
    function(evt) {
      const m = getMousePosition(svg, evt);
      let index;

      if (dragging) {
        index = dragging - 1;
        elements[index].o.x = m.x + delta.x;
        elements[index].o.y = m.y + delta.y;
        elements[index].update();
      }

      if (rotating) {
        index = rotating - 1;
        elements[index].a =
          Math.atan2(elements[index].o.y - m.y, elements[index].o.x - m.x) -
          elements[index].A;
        elements[index].update();
      }

      evt.preventDefault();
      evt.stopPropagation();
    },
    false
  );
}

function getMousePosition(svg, evt) {
  if (evt.touches) {
    evt = evt.touches[0];
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.round(evt.clientX - rect.left),
    y: Math.round(evt.clientY - rect.top),
  };
}

function drawElement(o) {
  /*
  const o = {
    properties : {
    x1:100, y1:220, x2:220, y2:70},
    parent:document.querySelector("svg"),
    tagName:'line'
  }
  */
  const el = document.createElementNS(SVG_NS, o.tagName);
  for (let name in o.properties) {
    if (o.properties.hasOwnProperty(name)) {
      el.setAttribute(name, o.properties[name]);
    }
  }
  o.parent.appendChild(el);
  return el;
}

function getDisplayCoordFromWorld(point, renderer) {
  const dPos = vtkCoordinate.newInstance();
  dPos.setCoordinateSystemToWorld();
  dPos.setValue(...point);
  return dPos.getComputedDisplayValue(renderer);
}

function getWorldCoordFromDisplay(point, renderer) {
  const dPos = vtkCoordinate.newInstance();
  dPos.setCoordinateSystemToDisplay();
  dPos.setValue(...point);
  return dPos.getComputedWorldValue(renderer);
}

function getRectObjFromPlane({ point, normal, viewUp }, renderer) {
  const width = 150;
  const height = 150;
  const [x, y] = getDisplayCoordFromWorld(point, renderer);
  const rect = {
    properties: {
      fill: '#20639B',
      x,
      y,
      width,
      height: 10,
    },
    tagName: 'rect',
  };

  return rect;
}

// ----------------------------------------------------------------------------

function vtkSVGRotateReferenceLinesWidget(publicAPI, model) {
  model.classHierarchy.push('vtkSVGRotateReferenceLinesWidget');
  model.widgetId = `vtkSVGRotateReferenceLinesWidget-${instanceId++}`;
  model.setup = false;

  publicAPI.render = (svgContainer, scale) => {
    const node = getWidgetNode(svgContainer, model.widgetId);
    const { point, strokeColor, strokeWidth, strokeDashArray, padding } = model;
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
    console.warn('SETUP InnerHTML');
    node.innerHTML = `
<g id="container" fill-opacity="1" stroke-dasharray="none" stroke="none" stroke-opacity="1" fill="none">
 <g>
 <!-- TODO: Why is this <svg> necessary?? </svg> If I don't include it, nothing renders !-->
 <svg class='object-container' version="1.1" viewBox="0 0 ${width} ${height}" width=${width} height=${height} style="width: 100%; height: 100%">
 </g>
</g>
      `;

    const svg = document.querySelector(`#${model.widgetId} .object-container`);
    const planes = publicAPI.getPlanes();
    const genericRenderWindow = publicAPI.getRenderWindow();
    const renderer = genericRenderWindow.getRenderer();
    const renderWindow = genericRenderWindow.getRenderWindow();
    const istyle = renderWindow.getInteractor().getInteractorStyle();
    const sliceNormal = istyle.getSliceNormal();
    const objects = planes.map(plane => getRectObjFromPlane(plane, renderer));
    const callbacks = publicAPI.getCallbacks();

    model.elements = objects.map((object, i) => {
      const el = new Element(
        objects[i],
        i + 1,
        svg,
        callbacks[i],
        renderer,
        sliceNormal
      );
      const triggerUpdateCallback = false;
      el.update(triggerUpdateCallback);

      return el;
    });

    // TODO: This is re-attaching event handlers way too frequently
    // Calling render removed / re-adds the DOM elements so we need
    // new handlers. We should move the handlers to the higher part of the
    // DOM that isn't removed on rerender.
    setupListeners(svg, model.elements);
  };
}

// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  point: [100, 100],
  callbacks: [],
  planes: [],
  renderWindow: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  macro.obj(publicAPI, model);
  macro.get(publicAPI, model, ['widgetId']);
  macro.setGetArray(publicAPI, model, ['point'], 2);

  macro.setGet(publicAPI, model, ['callbacks', 'planes', 'renderWindow']);

  vtkSVGRotateReferenceLinesWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkSVGRotateReferenceLinesWidget'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
