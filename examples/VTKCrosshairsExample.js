import React from 'react';
import { Component } from 'react';
import {
  View2D,
  vtkInteractorStyleMPRCrosshairs,
  vtkSVGCrosshairsWidget,
} from '@vtk-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

class VTKCrosshairsExample extends Component {
  state = {
    volumes: [],
  };

  componentDidMount() {
    this.apis = [];

    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });
    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeActor.setMapper(volumeMapper);

    reader.setUrl('/vmhead2-large.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      const range = data
        .getPointData()
        .getScalars()
        .getRange();

      const rgbTransferFunction = volumeActor
        .getProperty()
        .getRGBTransferFunction(0);

      rgbTransferFunction.setRange(range[0], range[1]);

      volumeMapper.setInputData(data);

      this.setState({
        volumes: [volumeActor],
      });
    });
  }

  storeApi = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      const apis = this.apis;
      const renderWindow = api.genericRenderWindow.getRenderWindow();

      api.addSVGWidget(
        vtkSVGCrosshairsWidget.newInstance(),
        'crosshairsWidget'
      );

      const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();

      api.setInteractorStyle({
        istyle,
        configuration: { apis, apiIndex: viewportIndex },
      });

      renderWindow.render();
    };
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
              This example demonstrates how to use the Crosshairs manipulator.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(2)}
              orientation={{ sliceNormal: [0, 1, 0], viewUp: [0, 0, 1] }}
            />
          </div>
          <div className="col-xs-12 col-sm-6">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(1)}
              orientation={{ sliceNormal: [1, 0, 0], viewUp: [0, 0, 1] }}
            />
          </div>
        </div>

        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(0)}
              orientation={{ sliceNormal: [0, 0, 1], viewUp: [0, -1, 0] }}
            />
          </div>
        </div>
      </>
    );
  }
}

export default VTKCrosshairsExample;
