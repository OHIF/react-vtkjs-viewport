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
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';
import vtkAnnotatedCubeActor from 'vtk.js/Sources/Rendering/Core/AnnotatedCubeActor';
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
    horizontalRotation: 0,
    verticalRotation: 0,
    viewRotation: 0,
  },
  {
    slicePlaneNormal: [1, 0, 0],
    sliceViewUp: [0, 0, 1],
    horizontalRotation: 0,
    verticalRotation: 0,
    viewRotation: 0,
  },
  {
    slicePlaneNormal: [0, 1, 0],
    sliceViewUp: [0, 0, 1],
    horizontalRotation: 0,
    verticalRotation: 0,
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

    this.loadFromVti();
  }

  /**
   * This is not working. The volume is not being updated/rendered.
   */
  loadSelectedVolume() {
    const selected = document.getElementById('select_volume').value;

    if (selected === '0') {
      this.loadFromVti();
    } else {
      this.loadFromWadors().then(() => {
        for (var index = 0; index < this.apis.length; index++) {
          const api = this.apis[index];
          const renderWindow = api.genericRenderWindow.getRenderWindow();

          renderWindow.render();
        }
      });
    }
  }

  async loadFromWadors() {
    const imageIds = await imageIdPromise;
    let ctImageIds = imageIds.filter(imageId =>
      imageId.includes(ctSeriesInstanceUID)
    );

    const ctImageDataPromise = loadDataset(ctImageIds, 'ctDisplaySet');
    const promises = [ctImageDataPromise];

    return new Promise((resolve, reject) => {
      Promise.all(promises).then(([ctImageData, petImageData]) => {
        const ctVol = createCT2dPipeline(ctImageData);

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
        });

        resolve();
      });
    });
  }

  loadFromVti() {
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });
    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeActor.setMapper(volumeMapper);

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      volumeMapper.setInputData(data);

      this.setState({
        volumes: [volumeActor],
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
      });
    });
  }

  addWidget(index) {
    this.apis.orientations = this.apis.orientations || [];
    // ----------------------------------------------------------------------------
    // Standard rendering code setup
    // ----------------------------------------------------------------------------

    const api = this.apis[index];
    const renderer = api.genericRenderWindow.getRenderer();
    const renderWindow = api.genericRenderWindow.getRenderWindow();

    // ----------------------------------------------------------------------------
    // Example code
    // ----------------------------------------------------------------------------

    // TODO: reaplce +X, -X, +Y, -Y, +Z, -Z with  A, P, L, R, S, I

    // create axes
    const axes = vtkAnnotatedCubeActor.newInstance();
    axes.setDefaultStyle({
      text: '+X',
      fontStyle: 'bold',
      fontFamily: 'Arial',
      fontColor: 'black',
      fontSizeScale: res => res / 2,
      faceColor: '#0000ff',
      faceRotation: 0,
      edgeThickness: 0.1,
      edgeColor: 'black',
      resolution: 400,
    });
    // axes.setXPlusFaceProperty({ text: '+X' });
    axes.setXMinusFaceProperty({
      text: '-X',
      faceColor: '#ffff00',
      faceRotation: 90,
      fontStyle: 'italic',
    });
    axes.setYPlusFaceProperty({
      text: '+Y',
      faceColor: '#00ff00',
      fontSizeScale: res => res / 4,
    });
    axes.setYMinusFaceProperty({
      text: '-Y',
      faceColor: '#00ffff',
      fontColor: 'white',
    });
    axes.setZPlusFaceProperty({
      text: '+Z',
      edgeColor: 'yellow',
    });
    axes.setZMinusFaceProperty({
      text: '-Z',
      faceRotation: 45,
      edgeThickness: 0,
    });

    // create orientation widget
    const orientationWidget = vtkOrientationMarkerWidget.newInstance({
      actor: axes,
      interactor: renderWindow.getInteractor(),
    });
    orientationWidget.setEnabled(true);
    orientationWidget.setViewportCorner(
      vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
    );
    orientationWidget.setViewportSize(0.15);
    orientationWidget.setMinPixelSize(100);
    orientationWidget.setMaxPixelSize(300);

    orientationWidget.updateMarkerOrientation();

    renderer.resetCamera();
    renderWindow.render();

    this.apis.orientations[index] = orientationWidget;
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

      // api.volumes[0].getMapper().setBlendModeToMaximumIntensity();
      // istyle.setSlabThickness(30);

      istyle.setRotate({
        renderWindow,
        horizontalRotation: volumeData[viewportIndex].horizontalRotation,
        verticalRotation: volumeData[viewportIndex].verticalRotation,
        slicePlaneNormal: volumeData[viewportIndex].slicePlaneNormal,
        sliceViewUp: volumeData[viewportIndex].sliceViewUp,
        viewRotation: volumeData[viewportIndex].viewRotation,
      });

      istyle.setMinMax(min, max);

      istyle.setOnInteractiveRotateChanged(
        ({ horizontalRotation, verticalRotation }) => {
          const rotation = this.state.rotation;

          rotation[viewportIndex].x = horizontalRotation;
          rotation[viewportIndex].y = verticalRotation;

          this.setState({ rotation });
        }
      );

      this.addWidget(viewportIndex);

      istyle.setRotation({ horizontalRotation: 0, verticalRotation: 0 });

      this.apis.orientations[viewportIndex].updateMarkerOrientation();
    };
  };

  handleChangeX = (index, event) => {
    volumeData[index].horizontalRotation = event.target.value;

    const rotation = this.state.rotation;

    rotation[index].x = event.target.value;

    this.setState({ rotation });

    this.updateRotate(index);
  };

  handleChangeY = (index, event) => {
    volumeData[index].verticalRotation = event.target.value;

    const rotation = this.state.rotation;

    rotation[index].y = event.target.value;

    this.setState({ rotation });

    this.updateRotate(index);
  };

  updateRotate = index => {
    const api = this.apis[index];
    const renderWindow = api.genericRenderWindow.getRenderWindow();

    const istyle = renderWindow.getInteractor().getInteractorStyle();

    istyle.setRotation({
      horizontalRotation: volumeData[index].horizontalRotation,
      verticalRotation: volumeData[index].verticalRotation,
    });

    this.apis.orientations[index].updateMarkerOrientation();
  };

  getSliceXRotation = index => {
    return volumeData[index].horizontalRotation;
  };
  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return <h4>Loading...</h4>;
    }

    const columns = [];

    for (let index = 0; index < volumeData.length; index++) {
      columns.push(
        <div key={index.toString()} className="col-xs-12 col-sm-6">
          <div>
            <input
              className="rotate"
              type="range"
              min={min}
              max={max}
              step="1"
              value={this.state.rotation[index].x}
              onChange={event => {
                this.handleChangeX(index, event);
              }}
            />
            <span>{this.state.rotation[index].x}</span>
          </div>
          <div>
            <input
              className="rotate"
              type="range"
              min={min}
              max={max}
              step="1"
              value={this.state.rotation[index].y}
              onChange={event => {
                this.handleChangeY(index, event);
              }}
            />
            <span>{this.state.rotation[index].y}</span>
          </div>
          <View2D
            volumes={this.state.volumes}
            onCreated={this.storeApi(index)}
          />
        </div>
      );
    }

    return (
      <>
        <div className="row">
          <div className="col-xs-12">
            <p>
              This example demonstrates how to use the MPR Rotate manipulator.
            </p>
            {/* <div>
              <label htmlFor="select_volume">Select Volume: </label>
              <select
                id="select_volume"
                onChange={() => this.loadSelectedVolume()}
              >
                <option value="0">headsq.vti (small)</option>
                <option value="1">Full Body (large)</option>
              </select>
            </div> */}
          </div>
        </div>
        <div className="row">{columns}</div>
      </>
    );
  }
}

export default VTKMPRRotateExample;
