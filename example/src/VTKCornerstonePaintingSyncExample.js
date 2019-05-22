import React from 'react'
import { Component } from 'react'

import { View2D, getImageData, loadImageData } from 'react-vtkjs-viewport'
import CornerstoneViewport from 'react-cornerstone-viewport'
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData'
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray'
import cornerstone from 'cornerstone-core'
import cornerstoneTools from 'cornerstone-tools'
import './initCornerstone.js'
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper'
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume'

const { EVENTS } = cornerstoneTools
window.cornerstoneTools = cornerstoneTools;

function setupSyncedBrush(imageDataObject, element) {
  // Create buffer the size of the 3D volume
  const dimensions = imageDataObject.dimensions
  const width = dimensions[0]
  const height = dimensions[1]
  const depth = dimensions[2]
  const numVolumePixels = width * height * depth

  // If you want to load a segmentation labelmap, you would want to load
  // it into this array at this point.
  const threeDimensionalPixelData = new Uint8ClampedArray(numVolumePixels)

  const buffer = threeDimensionalPixelData.buffer

  // Slice buffer into 2d-sized pieces, which are added to Cornerstone ToolData
  const toolType = 'brush'
  const segmentationIndex = 0
  const imageIds = imageDataObject.imageIds
  if (imageIds.length !== depth) {
    throw new Error('Depth should match the number of imageIds')
  }

  const { globalImageIdSpecificToolStateManager } = cornerstoneTools

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i]
    const byteOffset = width * height * i
    const length = width * height
    const slicePixelData = new Uint8ClampedArray(buffer, byteOffset, length)

    const toolData = []
    toolData[segmentationIndex] = {
      pixelData: slicePixelData,
      invalidated: true,
    }

    const toolState =
      globalImageIdSpecificToolStateManager.saveImageIdToolState(imageId) || {}

    toolState[toolType] = {
      data: toolData,
    }

    globalImageIdSpecificToolStateManager.restoreImageIdToolState(
      imageId,
      toolState
    )
  }

  // Create VTK Image Data with buffer as input
  const labelMap = vtkImageData.newInstance()

  // right now only support 256 labels
  const dataArray = vtkDataArray.newInstance({
    numberOfComponents: 1, // labelmap with single component
    values: threeDimensionalPixelData,
  })

  labelMap.getPointData().setScalars(dataArray)
  labelMap.setDimensions(...dimensions)
  labelMap.setSpacing(...imageDataObject.vtkImageData.getSpacing())
  labelMap.setOrigin(...imageDataObject.vtkImageData.getOrigin())
  labelMap.setDirection(...imageDataObject.vtkImageData.getDirection())

  return labelMap
}

function createActorMapper(imageData) {
  const mapper = vtkVolumeMapper.newInstance()
  mapper.setInputData(imageData)

  const actor = vtkVolume.newInstance()
  actor.setMapper(mapper)

  return {
    actor,
    mapper,
  }
}

const ROOT_URL =
  window.location.hostname === 'localhost'
    ? window.location.host
    : window.location.hostname

const imageIds = [
  //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.10.dcm',
  //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.11.dcm',
  //'dicomweb://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.12.dcm',
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.1.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.2.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.3.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.4.dcm`,
  `dicomweb://${ROOT_URL}/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032221.5.dcm`,
]

// Pre-retrieve the images for demo purposes
// Note: In a real application you wouldn't need to do this
// since you would probably have the image metadata ahead of time.
// In this case, we preload the images so the WADO Image Loader can
// read and store all of their metadata and subsequently the 'getImageData'
// can run properly (it requires metadata).
const promises = imageIds.map(imageId => {
  return cornerstone.loadAndCacheImage(imageId)
})

const BaseBrushTool = cornerstoneTools.import('base/BaseBrushTool')

class VTKCornerstonePaintingSyncExample extends Component {
  state = {
    volumes: null,
    vtkImageData: null,
    cornerstoneViewportData: null,
    focusedWidgetId: null,
    isSetup: false
  }

  componentDidMount() {
    this.components = {}
    this.cornerstoneElements = {}

    Promise.all(promises).then(
      () => {
        const displaySetInstanceUid = '12345'
        const cornerstoneViewportData = {
          stack: {
            imageIds,
            currentImageIdIndex: 0,
          },
          displaySetInstanceUid,
        }

        const imageDataObject = getImageData(imageIds, displaySetInstanceUid)
        const labelMapInputData = setupSyncedBrush(imageDataObject)

        this.onMeasurementModified = event => {
          if (event.type !== EVENTS.MEASUREMENT_MODIFIED) {
            return
          }

          labelMapInputData.modified()

          this.rerenderAllVTKViewports()
        }

        loadImageData(imageDataObject).then(() => {
          const { actor } = createActorMapper(imageDataObject.vtkImageData)
          this.setState({
            vtkImageData: imageDataObject.vtkImageData,
            volumes: [actor],
            cornerstoneViewportData,
            labelMapInputData,
          })
        })
      },
      error => {
        throw new Error(error)
      }
    )
  }

  invalidateBrush = () => {
    const element = this.cornerstoneElements[0]
    const enabledElement = cornerstone.getEnabledElement(element)
    const enabledElementUid = enabledElement.uuid

    // Note: This calls updateImage internally
    // TODO: Find out why it's not very quick to update...
    BaseBrushTool.invalidateBrushOnEnabledElement(enabledElementUid)
  }

  rerenderAllVTKViewports = () => {
    // TODO: Find out why this is not quick to update either
    Object.keys(this.components).forEach(viewportIndex => {
      const renderWindow = this.components[
        viewportIndex
      ].genericRenderWindow.getRenderWindow()

      renderWindow.render()
    })
  }

  saveComponentReference = viewportIndex => {
    return component => {
      this.components[viewportIndex] = component

      const paintFilter = component.filters[0]

      paintFilter.setRadius(10)
    }
  }

  saveCornerstoneElements = viewportIndex => {
    return event => {
      this.cornerstoneElements[viewportIndex] = event.detail.element
    }
  }

  setWidget = event => {
    const widgetId = event.target.value

    if (widgetId === 'rotate') {
      this.setState({
        focusedWidgetId: null,
      })
    } else {
      this.setState({
        focusedWidgetId: widgetId,
      })
    }
  }

  render() {
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
            Both components are displaying the same labelmap UInt8Array. For
            VTK, it has been encapsulated in a vtkDataArray and then a
            vtkImageData Object. For Cornerstone Tools, it is accessed by
            reference and index for each of the 2D slices.
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
                onPaint={this.invalidateBrush}
                onCreated={this.saveComponentReference(0)}
              />
            )}
          </div>
          <div className="col-xs-12 col-sm-6" style={{ height: '512px' }}>
            {this.state.cornerstoneViewportData && (
              <CornerstoneViewport
                activeTool={'Brush'}
                viewportData={this.state.cornerstoneViewportData}
                onMeasurementModified={this.onMeasurementModified}
                onElementEnabled={this.saveCornerstoneElements(0)}
              />
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default VTKCornerstonePaintingSyncExample
