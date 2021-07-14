import React from 'react';
import { Component } from 'react';
import { View2D, vtkInteractorStyleMPRRotate } from '@vtk-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';
import vtkAnnotatedCubeActor from 'vtk.js/Sources/Rendering/Core/AnnotatedCubeActor';

import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import './initCornerstone.js';

window.cornerstoneWADOImageLoader = cornerstoneWADOImageLoader;

const voi = {
  windowWidth: 1000,
  windowCenter: 300 + 1024,
};

class VTKMPRRotateExample extends Component {
  state = {
    volumes: [],
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
      });
    });
  }

  addCubeWidget(api) {
    // ----------------------------------------------------------------------------
    // Standard rendering code setup
    // ----------------------------------------------------------------------------

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
  }

  storeApi = api => {
    const istyle = vtkInteractorStyleMPRRotate.newInstance();

    this.apis = [api];
    this.addCubeWidget(api);
    api.setInteractorStyle({ istyle });

    const volume = api.volumes[0];
    const rgbTransferFunction = volume.getProperty().getRGBTransferFunction(0);

    const low = voi.windowCenter - voi.windowWidth / 2;
    const high = voi.windowCenter + voi.windowWidth / 2;

    rgbTransferFunction.setMappingRange(low, high);

    const renderWindow = api.genericRenderWindow.getRenderWindow();

    renderWindow.render();
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
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi}
              orientation={{ sliceNormal: [1, 0, 0], viewUp: [0, 0, -1] }}
            />
          </div>
        </div>
      </>
    );
  }
}

export default VTKMPRRotateExample;
