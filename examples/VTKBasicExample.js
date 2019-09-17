import React from 'react';
import { Component } from 'react';
import { View2D, vtkInteractorStyleMPRWindowLevel } from '@vtk-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';

const PRESETS = {
  BONE: {
    windowWidth: 100,
    windowCenter: 500,
  },
  HEAD: {
    windowWidth: 1000,
    windowCenter: 300,
  },
};
class VTKBasicExample extends Component {
  state = {
    volumes: [],
  };

  componentDidMount() {
    this.components = {};

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
    const low = voi.windowCenter - voi.windowWidth / 2;
    const high = voi.windowCenter + voi.windowWidth / 2;

    rgbTransferFunction.setMappingRange(low, high);

    this.updateAllViewports();
  };

  updateAllViewports = () => {
    Object.keys(this.components).forEach(viewportIndex => {
      const component = this.components[viewportIndex];

      component.genericRenderWindow.getRenderWindow().render();
    });
  };

  linkInteractors(renderWindow1, renderWindow2) {
    const i1 = renderWindow1.getInteractor();
    const i2 = renderWindow2.getInteractor();
    const sync = {};

    let src = null;

    function linkOneWay(from, to) {
      from.onStartAnimation(() => {
        if (!src) {
          src = from;
          to.requestAnimation(sync);
        }
      });

      from.onEndAnimation(() => {
        if (src === from) {
          src = null;
          to.cancelAnimation(sync);
          // roughly wait for widgetManager.capture() to finish
          setTimeout(to.render, 1000);
        }
      });
    }

    linkOneWay(i1, i2);
    linkOneWay(i2, i1);
  }

  linkAllInteractors(renderWindows) {
    if (renderWindows.length < 2) {
      return;
    }

    for (let i = 0; i < renderWindows.length - 1; i++) {
      for (let j = i + 1; j < renderWindows.length; j++) {
        this.linkInteractors(renderWindows[i], renderWindows[j]);
      }
    }
  }

  saveRenderWindow = viewportIndex => {
    return component => {
      this.components[viewportIndex] = component;

      if (viewportIndex === 1) {
        const renderWindow = component.genericRenderWindow.getRenderWindow();

        // TODO: This is a hacky workaround because disabling the vtkInteractorStyleMPRSlice is currently
        // broken. The camera.onModified is never removed.
        renderWindow
          .getInteractor()
          .getInteractorStyle()
          .setVolumeMapper(null);

        const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();

        renderWindow.getInteractor().setInteractorStyle(istyle);
        istyle.setVolumeMapper(component.volumes[0]);

        const renderWindows = Object.values(this.components).map(a =>
          a.genericRenderWindow.getRenderWindow()
        );
        this.linkAllInteractors(renderWindows);
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
            volume using the Window/Level buttons, we can see that this is
            applied inside both components.
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
          </div>
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
