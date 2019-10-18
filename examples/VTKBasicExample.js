import React from 'react';
import { Component } from 'react';
import {
  View2D,
  vtkInteractorStyleMPRWindowLevel,
  invertVolume,
} from '@vtk-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

// The data here is read from an unscaled *.vti, so we translate our windowCenter.
const PRESETS = {
  BONE: {
    windowWidth: 100,
    windowCenter: 500 + 1024,
  },
  HEAD: {
    windowWidth: 1000,
    windowCenter: 300 + 1024,
  },
};
class VTKBasicExample extends Component {
  state = {
    volumes: [],
    levels: {},
  };

  componentDidMount() {
    this.apis = [];

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

  setWLPreset = preset => {
    const voi = PRESETS[preset];

    const volume = this.state.volumes[0];
    const rgbTransferFunction = volume.getProperty().getRGBTransferFunction(0);

    this.state.volume;

    const low = voi.windowCenter - voi.windowWidth / 2;
    const high = voi.windowCenter + voi.windowWidth / 2;

    rgbTransferFunction.setMappingRange(low, high);

    this.setState({
      levels: { windowWidth: voi.windowWidth, windowCenter: voi.windowCenter },
    });
    this.updateAllViewports();
  };

  invert = () => {
    const volume = this.state.volumes[0];

    invertVolume(volume, this.updateAllViewports);
  };

  updateAllViewports = () => {
    Object.keys(this.apis).forEach(viewportIndex => {
      const api = this.apis[viewportIndex];

      api.genericRenderWindow.getRenderWindow().render();
    });
  };

  saveRenderWindow = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      const apis = this.apis;

      if (viewportIndex === 1) {
        const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();

        const callbacks = {
          setOnLevelsChanged: voi => {
            const { windowWidth, windowCenter } = voi;
            const levels = this.state.levels || {};

            apis.forEach(api => {
              const renderWindow = api.genericRenderWindow.getRenderWindow();

              api.updateVOI(windowWidth, windowCenter);
              renderWindow.render();
            });

            levels.windowCenter = windowCenter;
            levels.windowWidth = windowWidth;

            this.setState({
              levels,
            });
          },
        };

        api.setInteractorStyle({ istyle, callbacks });
      }
    };
  };

  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return <h4>Loading...</h4>;
    }

    return (
      <div className="row">
        <div className="col-xs-12">
          <p>
            This example demonstrates how to use the <code>onCreated</code> prop
            to obtain access to the VTK render window for one or more component.
            It also shows how to provide an array of vtkVolumes to the component
            for rendering. When we change the RGB Transfer Function for the
            volume using the Window/Level and Invert buttons, we can see that
            this is applied inside both components.
          </p>
        </div>
        <div className="col-xs-12">
          <h5>Set a Window/Level Preset</h5>
          <div className="btn-group">
            <button
              className="btn btn-primary"
              onClick={() => this.setWLPreset('BONE')}
            >
              Bone
            </button>
            <button
              className="btn btn-primary"
              onClick={() => this.setWLPreset('HEAD')}
            >
              Head
            </button>
            <button className="btn btn-primary" onClick={() => this.invert()}>
              Invert
            </button>
          </div>
          <span>WW: {this.state.levels.windowWidth}</span>
          <span>WC: {this.state.levels.windowCenter}</span>
        </div>
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.saveRenderWindow(0)}
          />
        </div>
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.saveRenderWindow(1)}
          />
        </div>
      </div>
    );
  }
}

export default VTKBasicExample;
