import React from 'react';
import { Component } from 'react';

import { View2D, getImageData, loadImageData } from '@vtk-viewport';
import CornerstoneViewport from 'react-cornerstone-viewport';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import './initCornerstone.js';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';

const { EVENTS } = cornerstoneTools;
window.cornerstoneTools = cornerstoneTools;

const segmentationModule = cornerstoneTools.getModule('segmentation');

const voi = {
  windowCenter: 35,
  windowWidth: 80,
};

function setupSyncedBrush(imageDataObject) {
  // Create buffer the size of the 3D volume
  const dimensions = imageDataObject.dimensions;
  const width = dimensions[0];
  const height = dimensions[1];
  const depth = dimensions[2];
  const numVolumePixels = width * height * depth;

  // If you want to load a segmentation labelmap, you would want to load
  // it into this array at this point.
  const threeDimensionalPixelData = new Float32Array(numVolumePixels);

  const buffer = threeDimensionalPixelData.buffer;
  const imageIds = imageDataObject.imageIds;
  const numberOfFrames = imageIds.length;

  if (numberOfFrames !== depth) {
    throw new Error('Depth should match the number of imageIds');
  }

  // Use Float32Arrays in cornerstoneTools for interoperability.
  segmentationModule.configuration.arrayType = 1;

  segmentationModule.setters.labelmap3DByFirstImageId(
    imageIds[0],
    buffer,
    0,
    [],
    numberOfFrames,
    undefined,
    0
  );

  // Create VTK Image Data with buffer as input
  const labelMap = vtkImageData.newInstance();

  // right now only support 256 labels
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1, // labelmap with single component
    values: threeDimensionalPixelData,
  });

  labelMap.getPointData().setScalars(dataArray);
  labelMap.setDimensions(...dimensions);
  labelMap.setSpacing(...imageDataObject.vtkImageData.getSpacing());
  labelMap.setOrigin(...imageDataObject.vtkImageData.getOrigin());
  labelMap.setDirection(...imageDataObject.vtkImageData.getDirection());

  return labelMap;
}

function createActorMapper(imageData) {
  const mapper = vtkVolumeMapper.newInstance();
  mapper.setInputData(imageData);

  const actor = vtkVolume.newInstance();
  actor.setMapper(mapper);

  return {
    actor,
    mapper,
  };
}

const ROOT_URL =
  window.location.hostname === 'localhost'
    ? window.location.host
    : window.location.hostname;

const imageIds = [
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.1.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.2.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.3.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.4.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.5.dcm`,
];

class VTKCornerstonePaintingSyncExample extends Component {
  state = {
    volumes: null,
    vtkImageData: null,
    cornerstoneViewportData: null,
    focusedWidgetId: null,
    isSetup: false,
  };

  componentDidMount() {
    this.apis = [];
    this.cornerstoneElements = {};

    // Pre-retrieve the images for demo purposes
    // Note: In a real application you wouldn't need to do this
    // since you would probably have the image metadata ahead of time.
    // In this case, we preload the images so the WADO Image Loader can
    // read and store all of their metadata and subsequently the 'getImageData'
    // can run properly (it requires metadata).
    const promises = imageIds.map(imageId => {
      return cornerstone.loadAndCacheImage(imageId);
    });

    Promise.all(promises).then(() => {
      const displaySetInstanceUid = '12345';
      const cornerstoneViewportData = {
        stack: {
          imageIds,
          currentImageIdIndex: 0,
        },
        displaySetInstanceUid,
      };

      const imageDataObject = getImageData(imageIds, displaySetInstanceUid);
      const labelMapInputData = setupSyncedBrush(imageDataObject);

      this.onMeasurementsChanged = event => {
        if (event.type !== EVENTS.LABELMAP_MODIFIED) {
          return;
        }

        labelMapInputData.modified();

        this.rerenderAllVTKViewports();
      };

      loadImageData(imageDataObject);

      const onAllPixelDataInsertedCallback = () => {
        const { actor } = createActorMapper(imageDataObject.vtkImageData);

        const rgbTransferFunction = actor
          .getProperty()
          .getRGBTransferFunction(0);

        const low = voi.windowCenter - voi.windowWidth / 2;
        const high = voi.windowCenter + voi.windowWidth / 2;

        rgbTransferFunction.setMappingRange(low, high);

        this.setState({
          vtkImageData: imageDataObject.vtkImageData,
          volumes: [actor],
          cornerstoneViewportData,
          labelMapInputData,
          colorLUT: segmentationModule.getters.colorLUT(0),
          globalOpacity: segmentationModule.configuration.fillAlpha,
          outlineThickness: segmentationModule.configuration.outlineThickness,
        });
      };

      imageDataObject.onAllPixelDataInserted(onAllPixelDataInsertedCallback);
    });
  }

  onPaintEnd = strokeBuffer => {
    const element = this.cornerstoneElements[0];
    const enabledElement = cornerstone.getEnabledElement(element);
    const { getters, setters } = cornerstoneTools.getModule('segmentation');
    const labelmap3D = getters.labelmap3D(element);
    const stackState = cornerstoneTools.getToolState(element, 'stack');
    const { rows, columns } = enabledElement.image;

    if (!stackState || !labelmap3D) {
      return;
    }

    const stackData = stackState.data[0];
    const numberOfFrames = stackData.imageIds.length;
    const segmentIndex = labelmap3D.activeSegmentIndex;

    for (let i = 0; i < numberOfFrames; i++) {
      let labelmap2D = labelmap3D.labelmaps2D[i];

      if (labelmap2D && labelmap2D.segmentsOnLabelmap.includes(segmentIndex)) {
        continue;
      }

      const frameLength = rows * columns;
      const byteOffset = frameLength * i;
      const strokeArray = new Uint8Array(strokeBuffer, byteOffset, frameLength);

      const strokeOnFrame = strokeArray.some(element => element === 1);

      if (!strokeOnFrame) {
        continue;
      }

      if (labelmap2D) {
        labelmap2D.segmentsOnLabelmap.push(segmentIndex);
      } else {
        labelmap2D = getters.labelmap2DByImageIdIndex(
          labelmap3D,
          i,
          rows,
          columns
        );
      }
    }

    cornerstone.updateImage(element);
  };

  rerenderAllVTKViewports = () => {
    // TODO: Find out why this is not quick to update either
    Object.keys(this.apis).forEach(viewportIndex => {
      const renderWindow = this.apis[
        viewportIndex
      ].genericRenderWindow.getRenderWindow();

      renderWindow.render();
    });
  };

  saveApiReference = api => {
    this.apis = [api];

    api.updateVOI(voi.windowWidth, voi.windowCenter);

    const paintFilter = api.filters[0];

    paintFilter.setRadius(10);
  };

  saveCornerstoneElements = viewportIndex => {
    return event => {
      this.cornerstoneElements[viewportIndex] = event.detail.element;
    };
  };

  setWidget = event => {
    const widgetId = event.target.value;

    if (widgetId === 'rotate') {
      this.setState({
        focusedWidgetId: null,
      });
    } else {
      this.setState({
        focusedWidgetId: widgetId,
      });
    }
  };

  render() {
    const { globalOpacity, colorLUT, outlineThickness } = this.state;

    return (
      <div className="row">
        <div className="col-xs-12">
          <h1>Syncing VTK Labelmap with Cornerstone Brush Tool Data</h1>
          <p>
            This example demonstrates how to keep painting in VTK, which is
            performed in 3D, in sync with Cornerstone's tool data, which is
            accessed in 2D.
          </p>
          <p>
            Both components are displaying the same labelmap UInt16Array. For
            VTK, it has been encapsulated in a vtkDataArray and then a
            vtkImageData Object. For Cornerstone Tools, the Uint16Array is
            accessed through helpers based on the actively displayed image stack
            and the index of the currently displayed image
          </p>
          <p>
            <strong>Note:</strong> The PaintWidget (circle on hover) is not
            currently visible in the 2D VTK View component.
          </p>
          <hr />
        </div>
        <div className="col-xs-12">
          <div className="col-xs-12">
            <label>
              <input
                type="radio"
                value="rotate"
                name="widget"
                onChange={this.setWidget}
                checked={this.state.focusedWidgetId === null}
              />{' '}
              Rotate
            </label>
            <label>
              <input
                type="radio"
                value="PaintWidget"
                name="widget"
                onChange={this.setWidget}
                checked={this.state.focusedWidgetId === 'PaintWidget'}
              />
              Paint
            </label>
          </div>
          <div className="col-xs-12 col-sm-6">
            {this.state.volumes && (
              <View2D
                volumes={this.state.volumes}
                paintFilterBackgroundImageData={this.state.vtkImageData}
                paintFilterLabelMapImageData={this.state.labelMapInputData}
                painting={this.state.focusedWidgetId === 'PaintWidget'}
                onPaintEnd={this.onPaintEnd}
                orientation={{ sliceNormal: [0, 0, 1], viewUp: [0, -1, 0] }}
                onCreated={this.saveApiReference}
                labelmapRenderingOptions={{
                  colorLUT,
                  globalOpacity,
                  outlineThickness,
                  segmentsDefaultProperties: [],
                  visible: true,
                  renderOutline: true,
                }}
              />
            )}
          </div>

          <div className="col-xs-12 col-sm-6" style={{ height: '512px' }}>
            {this.state.cornerstoneViewportData && (
              <CornerstoneViewport
                activeTool={'Brush'}
                availableTools={[
                  { name: 'Brush', mouseButtonMasks: [1] },
                  { name: 'StackScrollMouseWheel' },
                  { name: 'StackScrollMultiTouch' },
                ]}
                viewportData={this.state.cornerstoneViewportData}
                onMeasurementsChanged={this.onMeasurementsChanged}
                onElementEnabled={this.saveCornerstoneElements(0)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default VTKCornerstonePaintingSyncExample;
