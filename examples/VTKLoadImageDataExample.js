import React from 'react';
import { Component } from 'react';

import { View2D, getImageData, loadImageData } from '@vtk-viewport';
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import './initCornerstone.js';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';

window.cornerstoneTools = cornerstoneTools;

const ORIENTATION = {
  AXIAL: {
    slicePlaneNormal: [0, 0, 1],
    sliceViewUp: [0, -1, 0],
  },
  SAGITTAL: {
    slicePlaneNormal: [1, 0, 0],
    sliceViewUp: [0, 0, 1],
  },
  CORONAL: {
    slicePlaneNormal: [0, 1, 0],
    sliceViewUp: [0, 0, 1],
  },
};

const voi = {
  // In SUV as this example uses a PET
  windowCenter: 2.5,
  windowWidth: 2.5,
};

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

function shuffleImageNames(imageNames) {
  for (let index = imageNames.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * index);
    const temporaryValue = imageNames[index];
    imageNames[index] = imageNames[randomIndex];
    imageNames[randomIndex] = temporaryValue;
  }
}

function getImageIds() {
  const ROOT_URL =
    'https://s3.amazonaws.com/IsomicsPublic/SampleData/QIN-H%2BN-0139/PET-sorted/';

  const imageNames = [];

  for (let i = 1; i < 546; i++) {
    imageNames.push('PET_HeadNeck_0-' + i + '.dcm');
  }

  // Shuffle the image names to test that src/lib/data/sortDatasetsByImagePosition.js works.
  shuffleImageNames(imageNames);

  return imageNames.map(name => `dicomweb:${ROOT_URL}${name}`);
}

class VTKLoadImageDataExample extends Component {
  state = {
    volumes: null,
    vtkImageData: null,
    cornerstoneViewportData: null,
    focusedWidgetId: null,
    isSetup: false,
  };

  componentDidMount() {
    this.components = {};
    this.cornerstoneElements = {};

    const imageIds = getImageIds();

    // Pre-retrieve the images for demo purposes
    // Note: In a real application you wouldn't need to do this
    // since you would probably have the image metadata ahead of time.
    // In this case, we preload the images so the WADO Image Loader can
    // read and store all of their metadata and subsequently the 'getImageData'
    // can run properly (it requires metadata).
    const promises = imageIds.map(imageId => {
      return cornerstone.loadAndCacheImage(imageId);
    });

    Promise.all(promises).then(
      () => {
        const displaySetInstanceUid = '12345';
        const cornerstoneViewportData = {
          stack: {
            imageIds,
            currentImageIdIndex: 0,
          },
          displaySetInstanceUid,
        };

        const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

        loadImageData(imageDataObject);

        const onPixelDataInsertedCallback = numberProcessed => {
          const percentComplete = Math.floor(
            (numberProcessed * 100) / imageIds.length
          );

          console.log(`Processing: ${percentComplete}%`);
        };

        imageDataObject.onPixelDataInserted(onPixelDataInsertedCallback);

        const { actor } = createActorMapper(imageDataObject.vtkImageData);

        this.imageDataObject = imageDataObject;

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
        });
      },
      error => {
        throw new Error(error);
      }
    );
  }

  storeApi = orientation => {
    return api => {
      const renderWindow = api.genericRenderWindow.getRenderWindow();
      const istyle = renderWindow.getInteractor().getInteractorStyle();

      const { slicePlaneNormal, sliceViewUp } = ORIENTATION[orientation];

      istyle.setSliceOrientation(slicePlaneNormal, sliceViewUp);

      const onPixelDataInsertedCallback = () => {
        renderWindow.render();
      };

      this.imageDataObject.onPixelDataInserted(onPixelDataInsertedCallback);

      renderWindow.render();
    };
  };

  render() {
    return (
      <div className="row">
        <div className="col-xs-12">
          <h1>Loading a cornerstone displayset into vtkjs</h1>
          <p>
            The example demonstrates loading cornerstone images already
            available in the application into a vtkjs viewport.
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
          </div>
          <div className="col-xs-12 col-sm-6">
            {this.state.volumes && (
              <>
                <div className="col-xs-12 col-sm-6">
                  <View2D
                    volumes={this.state.volumes}
                    onCreated={this.storeApi('AXIAL')}
                  />
                </div>
                <div className="col-xs-12 col-sm-6">
                  <View2D
                    volumes={this.state.volumes}
                    onCreated={this.storeApi('SAGITTAL')}
                  />
                </div>
                <div className="col-xs-12 col-sm-6">
                  <View2D
                    volumes={this.state.volumes}
                    onCreated={this.storeApi('CORONAL')}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default VTKLoadImageDataExample;
