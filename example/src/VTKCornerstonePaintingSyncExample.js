import React from 'react';
import { Component } from 'react';

import { VTKMPRViewport, VTK3DViewport, getImageData, loadImageData } from 'react-vtkjs-viewport';
import CornerstoneViewport from 'react-cornerstone-viewport';
import vtkImageData from "vtk.js/Sources/Common/DataModel/ImageData";
import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray";
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import './initCornerstone.js';

const { EVENTS } = cornerstoneTools;

window.cornerstoneTools = cornerstoneTools;

function setupSyncedBrush(imageDataObject, element) {
  // Create buffer the size of the 3D volume
  const dimensions = imageDataObject.dimensions;
  const width = dimensions[0];
  const height = dimensions[1];
  const depth = dimensions[2];
  const numVolumePixels = width * height * depth;
  const threeDimensionalPixelData = new Uint8ClampedArray(numVolumePixels);
  const buffer = threeDimensionalPixelData.buffer;

  // Slice buffer into 2d-sized pieces, which are added to Cornerstone ToolData
  const toolType = 'brush';
  const segmentationIndex = 0;
  const imageIds = imageDataObject.imageIds;
  if (imageIds.length !== depth) {
    throw new Error("Depth should match the number of imageIds");
  }

  const { globalImageIdSpecificToolStateManager } = cornerstoneTools;

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i];
    const byteOffset = width * height * i;
    const length = width * height;
    const slicePixelData = new Uint8ClampedArray(buffer, byteOffset, length);

    const toolData = [];
    toolData[segmentationIndex] = {
      pixelData: slicePixelData,
      invalidated: true
    };

    const toolState = globalImageIdSpecificToolStateManager.saveImageIdToolState(imageId) || {};

    toolState[toolType] = {
      data: toolData
    };

    globalImageIdSpecificToolStateManager.restoreImageIdToolState(imageId, toolState);
  }


  // Create VTK Image Data with buffer as input
  const labelMap = vtkImageData.newInstance();

  labelMap.setDimensions(...dimensions);

  // right now only support 256 labels
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1, // labelmap with single component
    values: threeDimensionalPixelData,
  });
  labelMap.getPointData().setScalars(dataArray);
  labelMap.setSpacing(...imageDataObject.vtkImageData.getSpacing());
  labelMap.setOrigin(...imageDataObject.vtkImageData.getOrigin());
  labelMap.setDirection(...imageDataObject.vtkImageData.getDirection());

  return labelMap;
}

  // Find a way to call .modified() on the Mapper when Cornerstone paints
  // When VTK paints, find a way to call cornerstone.updateImage()

let ROOT_URL = 'localhost:3000';

const imageIds = [
    //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.10.dcm',
  //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.11.dcm',
  //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.12.dcm',
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.1.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.2.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.3.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.4.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.5.dcm`
];

// Pre-retrieve the images for demo purposes
// Note: In a real application you wouldn't need to do this
// since you would probably have the image metadata ahead of time.
// In this case, we preload the images so the WADO Image Loader can
// read and store all of their metadata and subsequently the 'getImageData'
// can run properly (it requires metadata).
const promises = imageIds.map((imageId) => {
  return cornerstone.loadAndCacheImage(imageId);
});

/*
    cornerstone: PropTypes.object.isRequired,
    cornerstoneTools: PropTypes.object.isRequired,
    children: PropTypes.node,
    activeTool: PropTypes.string,


    ewportData: PropTypes.object.isRequired,
    measurementsAddedOrRemoved: PropTypes.func,
    measurementsChanged: PropTypes.func,
    isActive: PropTypes.bool.isRequired,
    cornerstoneOptions: PropTypes.object,
    setViewportActive: PropTypes.func,
    setViewportSpecificData: PropTypes.func,
    clearViewportSpecificData: PropTypes.func,
    layout: PropTypes.object,
    cineToolData: PropTypes.object
 */

const BaseBrushTool = cornerstoneTools.import('base/BaseBrushTool');

class VTKCornerstonePaintingSyncExample extends Component {
  state = {
    vtkImageData: null,
    cornerstoneViewportData: null,
    focusedWidgetId: null
  }

  componentDidMount() {
    this.vtkViewportRef = React.createRef();

    Promise.all(promises).then(() => {
      const displaySetInstanceUid = '12345';
      const cornerstoneViewportData = {
        stack: {
          imageIds,
          currentImageIdIndex: 0
        },
        displaySetInstanceUid
      };

      this.setState({
        cornerstoneViewportData
      });

      const imageDataObject = getImageData(imageIds, displaySetInstanceUid, cornerstone);

      const doneLoadingCallback = () => {
        this.setState({
          vtkImageData: imageDataObject.vtkImageData,
        });
      };
      const callbacks = [
        doneLoadingCallback
      ];

      loadImageData(imageDataObject, callbacks, cornerstone);


      // Create paintFilter with imagedata as label map
      // When cornerstone draws, ask for a refresh from VTK and vice versa
      const labelMapInputData = setupSyncedBrush(imageDataObject);

      this.onMeasurementModified = (event) => {
        if (event.type !== EVENTS.MEASUREMENT_MODIFIED) {
          return;
        }

        console.log('measurementsChanged');

        labelMapInputData.modified();
      }

      this.setState({
        labelMapInputData
      });
    }, error => {
      throw new Error(error);
    });

    this.paintWidgetCallbacks = {
      onStartInteractionEvent: () => {},
      onInteractionEvent: () => {
        console.log('onInteractionEvent');

        const enabledElement = cornerstone.getEnabledElements()[0];
        const enabledElementUid = enabledElement.uuid;
        BaseBrushTool.invalidateBrushOnEnabledElement(enabledElementUid);
      },
      onEndInteractionEvent: () => {
        //console.log(this.state.labelMapInputData);
        //debugger;
      }
    }
  }

  invalidateBrush() {
    console.log('onInteractionEvent');

    const enabledElement = cornerstone.getEnabledElements()[0];
    const enabledElementUid = enabledElement.uuid;
    BaseBrushTool.invalidateBrushOnEnabledElement(enabledElementUid);
  }

  setWidget = (event) => {
    const widgetId = event.target.value;

    if (widgetId === 'rotate') {
      this.setState({
        focusedWidgetId: null
      });
    } else {
      this.setState({
        focusedWidgetId: widgetId
      });
    }
  }

  render() {
    return (<React.Fragment>
      <div>
        <label>
          <input type="radio"
                 value="rotate"
                 name="widget"
                 onChange={this.setWidget}
                 checked={this.state.focusedWidgetId === null}
          /> Rotate
        </label>
        <label>
          <input type="radio"
                 value="PaintWidget"
                 name="widget"
                 onChange={this.setWidget}
                 checked={this.state.focusedWidgetId === 'PaintWidget'}
          />
          Paint
        </label>
      </div>
      <div className="col-xs-6">
        {this.state.vtkImageData &&
        <VTKMPRViewport
          data={this.state.vtkImageData}
          labelmap={this.state.labelMapInputData}
          painting={this.state.focusedWidgetId === 'PaintWidget'}
          onPaint={this.invalidateBrush}
        />
        }
      </div>
      <div className="col-xs-6" style={{height: '512px'}}>
        {this.state.cornerstoneViewportData &&
          <CornerstoneViewport
            cornerstone={cornerstone}
            cornerstoneTools={cornerstoneTools}
            activeTool={'Brush'}
            viewportData={this.state.cornerstoneViewportData}
            onMeasurementModified={this.onMeasurementModified}
          />
        }
      </div>
      <div className="col-xs-6">
        {this.state.vtkImageData &&
        <VTK3DViewport
          data={this.state.labelMapInputData}
        />
        }
      </div>    </React.Fragment>);
  }
}

export default VTKCornerstonePaintingSyncExample;
