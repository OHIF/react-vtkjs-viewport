import React from 'react';
import { Component } from 'react';
import {
  View2D,
  getImageData,
  loadImageData,
  vtkInteractorStyleMPRRotate,
} from '@vtk-viewport';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

import { api } from 'dicomweb-client';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import './initCornerstone.js';

window.cornerstoneWADOImageLoader = cornerstoneWADOImageLoader;

//const url = 'http://localhost:44301/wadors'
//const url = 'http://localhost:8080/dcm4chee-arc/aets/DCM4CHEE/rs'
const url = 'https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs';
const client = new api.DICOMwebClient({ url });
const studyInstanceUID =
  // '1.3.6.1.4.1.14519.5.2.1.2744.7002.271803936741289691489150315969';
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.373729467545468642229382466905';
const ctSeriesInstanceUID =
  // '1.3.6.1.4.1.14519.5.2.1.2744.7002.453958960749354309542907936863'
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.182837959725425690842769990419';
const petSeriesInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.117357550898198415937979788256';
const searchInstanceOptions = {
  studyInstanceUID,
};

const min = 0;
const max = 360;
const volumeData = [
  {
    slicePlaneNormal: [0, 0, 1],
    sliceViewUp: [0, -1, 0],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0,
  },
  {
    slicePlaneNormal: [1, 0, 0],
    sliceViewUp: [0, 0, 1],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0,
  },
  {
    slicePlaneNormal: [0, 1, 0],
    sliceViewUp: [0, 0, 1],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0,
  },
];

function createStudyImageIds(baseUrl, studySearchOptions) {
  const SOP_INSTANCE_UID = '00080018';
  const SERIES_INSTANCE_UID = '0020000E';

  return new Promise((resolve, reject) => {
    client.retrieveStudyMetadata(studySearchOptions).then(instances => {
      const imageIds = instances.map(metaData => {
        const imageId =
          `wadors:` +
          baseUrl +
          '/studies/' +
          studyInstanceUID +
          '/series/' +
          metaData[SERIES_INSTANCE_UID].Value[0] +
          '/instances/' +
          metaData[SOP_INSTANCE_UID].Value[0] +
          '/frames/1';

        cornerstoneWADOImageLoader.wadors.metaDataManager.add(
          imageId,
          metaData
        );

        return imageId;
      });

      resolve(imageIds);
    }, reject);
  });
}

const imageIdPromise = createStudyImageIds(url, searchInstanceOptions);

function loadDataset(imageIds, displaySetInstanceUid) {
  return new Promise((resolve, reject) => {
    const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

    loadImageData(imageDataObject).then(() => {
      resolve(imageDataObject.vtkImageData);
    });
  });
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

function createCT2dPipeline(imageData) {
  const { actor } = createActorMapper(imageData);
  const cfun = vtkColorTransferFunction.newInstance();
  /*
    0: { description: 'Soft tissue', window: 400, level: 40 },
  1: { description: 'Lung', window: 1500, level: -600 },
  2: { description: 'Liver', window: 150, level: 90 },
  3: { description: 'Bone', window: 2500, level: 480 },
  4: { description: 'Brain', window: 80, level: 40 },*/
  const preset = vtkColorMaps.getPresetByName('Grayscale');
  cfun.applyColorMap(preset);
  cfun.setMappingRange(-360, 440);

  actor.getProperty().setRGBTransferFunction(0, cfun);

  return actor;
}

class VTKMPRRotateExample extends Component {
  state = {
    volumes: [],
    rotation: [],
  };

  async componentDidMount() {
    this.apis = [];

    // const reader = vtkHttpDataSetReader.newInstance({
    //   fetchGzip: true,
    // });
    // const volumeActor = vtkVolume.newInstance();
    // const volumeMapper = vtkVolumeMapper.newInstance();

    // volumeActor.setMapper(volumeMapper);

    // reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
    //   const data = reader.getOutputData();
    //   volumeMapper.setInputData(data);

    //   this.setState({
    //     volumes: [volumeActor]
    //   });
    // });

    const imageIds = await imageIdPromise;
    let ctImageIds = imageIds.filter(imageId =>
      imageId.includes(ctSeriesInstanceUID)
    );

    const ctImageDataPromise = loadDataset(ctImageIds, 'ctDisplaySet');
    const promises = [ctImageDataPromise];

    Promise.all(promises).then(([ctImageData, petImageData]) => {
      const ctVol = createCT2dPipeline(ctImageData);

      // const ctVolVR = createCT3dPipeline(
      //   ctImageData,
      //   this.state.ctTransferFunctionPresetId
      // )
      // const petVolVR = createPET3dPipeline(
      //   petImageData,
      //   this.state.petColorMapId
      // )

      this.setState({
        volumes: [ctVol],
        rotation: [
          {
            x: 0,
            y: 0,
          },
          {
            x: 0,
            y: 0,
          },
          {
            x: 0,
            y: 0,
          },
        ],
        // volumes: [ctVol, petVol],
        // volumeRenderingVolumes: [ctVolVR, petVolVR],
      });
    });
  }

  storeApi = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      const renderWindow = api.genericRenderWindow.getRenderWindow();

      // TODO: This is a hacky workaround because disabling the vtkInteractorStyleMPRSlice is currently
      // broken. The camera.onModified is never removed.
      renderWindow
        .getInteractor()
        .getInteractorStyle()
        .setVolumeMapper(null);

      const istyle = vtkInteractorStyleMPRRotate.newInstance();
      //const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();

      renderWindow.getInteractor().setInteractorStyle(istyle);
      istyle.setVolumeMapper(api.volumes[0]);

      // renderWindow.render();
      istyle.setRotate({
        renderWindow,
        slicePlaneXRotation: volumeData[viewportIndex].slicePlaneXRotation,
        slicePlaneYRotation: volumeData[viewportIndex].slicePlaneYRotation,
        slicePlaneNormal: volumeData[viewportIndex].slicePlaneNormal,
        sliceViewUp: volumeData[viewportIndex].sliceViewUp,
        viewRotation: volumeData[viewportIndex].viewRotation,
      });

      istyle.setMinMax(min, max);
      istyle.rotate({ slicePlaneXRotation: 0, slicePlaneYRotation: 0 });
    };
  };

  handleChangeX = (index, event) => {
    volumeData[index].slicePlaneXRotation = event.target.value;

    const rotation = this.state.rotation;

    rotation[index].x = event.target.value;

    this.setState({ rotation });

    this.updateRotate(index);
  };

  handleChangeY = (index, event) => {
    volumeData[index].slicePlaneYRotation = event.target.value;

    const rotation = this.state.rotation;

    rotation[index].y = event.target.value;

    this.setState({ rotation });

    this.updateRotate(index);
  };

  updateRotate = index => {
    const api = this.apis[index];
    const renderWindow = api.genericRenderWindow.getRenderWindow();

    const istyle = renderWindow.getInteractor().getInteractorStyle();

    istyle.rotate({
      slicePlaneXRotation: volumeData[index].slicePlaneYRotation,
      slicePlaneYRotation: volumeData[index].slicePlaneXRotation,
    });
  };

  getSliceXRotation = index => {
    return volumeData[index].slicePlaneXRotation;
  };
  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return <h4>Loading...</h4>;
    }

    return (
      <>
        <div className="row">
          <div className="col-xs-12">
            <p>
              This example demonstrates how to use the MPR Rotate manipulator.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[0].slicePlaneXRotation}
                onChange={event => {
                  this.handleChangeX(0, event);
                }}
              />
              <span>{this.state.rotation[0].x}</span>
            </div>
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[0].slicePlaneYRotation}
                onChange={event => {
                  this.handleChangeY(0, event);
                }}
              />
              <span>{this.state.rotation[0].y}</span>
            </div>
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(0)} />
          </div>
          <div className="col-xs-12 col-sm-6">
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[1].slicePlaneXRotation}
                onChange={event => {
                  this.handleChangeX(1, event);
                }}
              />
              <span>{this.state.rotation[1].x}</span>
            </div>
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[1].slicePlaneYRotation}
                onChange={event => {
                  this.handleChangeY(1, event);
                }}
              />
              <span>{this.state.rotation[1].y}</span>
            </div>
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(1)} />
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[2].slicePlaneXRotation}
                onChange={event => {
                  this.handleChangeX(2, event);
                }}
              />
              <span>{this.state.rotation[2].x}</span>
            </div>
            <div>
              <input
                className="rotate"
                type="range"
                min={min}
                max={max}
                step="1"
                defaultValue={volumeData[2].slicePlaneYRotation}
                onChange={event => {
                  this.handleChangeY(2, event);
                }}
              />
              <span>{this.state.rotation[2].y}</span>
            </div>
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(2)} />
          </div>
        </div>
      </>
    );
  }
}

export default VTKMPRRotateExample;
