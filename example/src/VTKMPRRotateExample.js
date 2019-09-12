import React from 'react';
import { Component } from 'react';
import {
  View2D, 
  vtkInteractorStyleMPRRotate
} from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

const volumeData = [
  {
    slicePlaneNormal: [0, 0, 1],
    sliceViewUp: [0, -1, 0],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0
  }, {
    slicePlaneNormal: [1, 0, 0],
    sliceViewUp: [0, 0, 1],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0,
  }, {
    slicePlaneNormal: [0, 1, 0],
    sliceViewUp: [0, 0, 1],
    slicePlaneXRotation: 0,
    slicePlaneYRotation: 0,
    viewRotation: 0,
  }
]

class VTKMPRRotateExample extends Component {
  state = {
    volumes: []
  }

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
        volumes: [volumeActor]
      });
    });
  }

  storeApi = (viewportIndex) => {
    return (api) => {
      this.apis[viewportIndex] = api;
      
      const renderWindow = api.genericRenderWindow.getRenderWindow()
      
      // TODO: This is a hacky workaround because disabling the vtkInteractorStyleMPRSlice is currently
      // broken. The camera.onModified is never removed.
      renderWindow.getInteractor().getInteractorStyle().setVolumeMapper(null)

      const istyle = vtkInteractorStyleMPRRotate.newInstance();
      //const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();
      
      renderWindow.getInteractor().setInteractorStyle(istyle)
      istyle.setVolumeMapper(api.volumes[0])

      // renderWindow.render();
      istyle.setRotate({renderWindow,
        slicePlaneXRotation: volumeData[viewportIndex].slicePlaneXRotation,
        slicePlaneYRotation: volumeData[viewportIndex].slicePlaneYRotation, 
        slicePlaneNormal: volumeData[viewportIndex].slicePlaneNormal, 
        sliceViewUp: volumeData[viewportIndex].sliceViewUp, 
        viewRotation: volumeData[viewportIndex].viewRotation});

      istyle.rotate({ slicePlaneXRotation: 0, slicePlaneYRotation: 0 });
    }
  }

  render() {
    if (!this.state.volumes || !this.state.volumes.length) {
      return <h4>Loading...</h4>
    }

    return (<>
    <div className="row">
      <div className="col-xs-12">
        <p>This example demonstrates how to use the MPR Rotate manipulator.</p>
      </div>
      </div>
      <div className="row">
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.storeApi(0)}
          />
        </div>
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.storeApi(1)}
          />
        </div>
      </div>
      <div className="row">
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.storeApi(2)}
          />
        </div>
      </div>
    </>
    );
  }
}

export default VTKMPRRotateExample;
