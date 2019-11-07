import React from 'react';
import { Component } from 'react';
import {
  View2D,
  getImageData,
  loadImageData,
  vtkInteractorStyleMPRCrosshairs,
  vtkSVGCrosshairsWidget,
} from '@vtk-viewport';
import { api as dicomwebClientApi } from 'dicomweb-client';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

const url = 'https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs';
const studyInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.373729467545468642229382466905';
const ctSeriesInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.182837959725425690842769990419';
const searchInstanceOptions = {
  studyInstanceUID,
};

function loadDataset(imageIds, displaySetInstanceUid) {
  const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

  loadImageData(imageDataObject);
  return imageDataObject;
}

function createStudyImageIds(baseUrl, studySearchOptions) {
  const SOP_INSTANCE_UID = '00080018';
  const SERIES_INSTANCE_UID = '0020000E';

  const client = new dicomwebClientApi.DICOMwebClient({ url });

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

class VTKCrosshairsExample extends Component {
  state = {
    volumes: [],
  };

  async componentDidMount() {
    this.apis = [];

    const imageIds = await createStudyImageIds(url, searchInstanceOptions);

    let ctImageIds = imageIds.filter(imageId =>
      imageId.includes(ctSeriesInstanceUID)
    );

    const ctImageDataObject = loadDataset(ctImageIds, 'ctDisplaySet');

    Promise.all(ctImageDataObject.insertPixelDataPromises).then(() => {
      const ctImageData = ctImageDataObject.vtkImageData;

      const range = ctImageData
        .getPointData()
        .getScalars()
        .getRange();

      const mapper = vtkVolumeMapper.newInstance();
      const ctVol = vtkVolume.newInstance();
      const rgbTransferFunction = ctVol.getProperty().getRGBTransferFunction(0);

      mapper.setInputData(ctImageData);
      mapper.setMaximumSamplesPerRay(2000);
      rgbTransferFunction.setRange(range[0], range[1]);
      ctVol.setMapper(mapper);

      this.setState({
        volumes: [ctVol],
      });
    });
  }

  storeApi = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      const apis = this.apis;
      const renderWindow = api.genericRenderWindow.getRenderWindow();

      // Add svg widget
      api.addSVGWidget(
        vtkSVGCrosshairsWidget.newInstance(),
        'crosshairsWidget'
      );

      const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();

      // add istyle
      api.setInteractorStyle({
        istyle,
        configuration: { apis, apiIndex: viewportIndex },
      });

      // set blend mode to MIP.
      const mapper = api.volumes[0].getMapper();
      if (mapper.setBlendModeToMaximumIntensity) {
        mapper.setBlendModeToMaximumIntensity();
      }

      api.setSlabThickness(0.1);

      renderWindow.render();
    };
  };

  handleSlabThicknessChange(evt) {
    const value = evt.target.value;
    const valueInMM = value / 10;
    const apis = this.apis;

    apis.forEach(api => {
      const renderWindow = api.genericRenderWindow.getRenderWindow();

      api.setSlabThickness(valueInMM);
      renderWindow.render();
    });
  }

  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return <h4>Loading...</h4>;
    }

    return (
      <>
        <div className="row">
          <div className="col-xs-4">
            <p>
              This example demonstrates how to use the Crosshairs manipulator.
            </p>
            <label htmlFor="set-slab-thickness">SlabThickness: </label>
            <input
              id="set-slab-thickness"
              type="range"
              name="points"
              min="1"
              max="5000"
              onChange={this.handleSlabThicknessChange.bind(this)}
            />
          </div>
        </div>
        <div className="row">
          <div className="col-sm-4">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(0)}
              orientation={{ sliceNormal: [0, 1, 0], viewUp: [0, 0, 1] }}
            />
          </div>
          <div className="col-sm-4">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(1)}
              orientation={{ sliceNormal: [1, 0, 0], viewUp: [0, 0, 1] }}
            />
          </div>
          <div className="col-sm-4">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(2)}
              orientation={{ sliceNormal: [0, 0, 1], viewUp: [0, -1, 0] }}
            />
          </div>
        </div>
      </>
    );
  }
}

export default VTKCrosshairsExample;
