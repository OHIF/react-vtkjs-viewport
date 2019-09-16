import React from 'react';
import { Component } from 'react';
import {
  View2D,
  vtkInteractorStyleMPRCrosshairs,
  vtkSVGWidgetManager,
  vtkSVGCrosshairsWidget,
} from '@vtk-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';

function getCrosshairCallbackForIndex(apis, index) {
  return ({ worldPos }) => {
    // Set camera focal point to world coordinate for linked views
    apis.forEach((api, viewportIndex) => {
      if (viewportIndex !== index) {
        // We are basically doing the same as getSlice but with the world coordinate
        // that we want to jump to instead of the camera focal point.
        // I would rather do the camera adjustment directly but I keep
        // doing it wrong and so this is good enough for now.
        const renderWindow = api.genericRenderWindow.getRenderWindow();

        const istyle = renderWindow.getInteractor().getInteractorStyle();
        const sliceNormal = istyle.getSliceNormal();
        const transform = vtkMatrixBuilder
          .buildFromDegree()
          .identity()
          .rotateFromDirections(sliceNormal, [1, 0, 0]);

        const mutatedWorldPos = worldPos.slice();
        transform.apply(mutatedWorldPos);
        const slice = mutatedWorldPos[0];

        istyle.setSlice(slice);

        renderWindow.render();
      }

      const renderer = api.genericRenderWindow.getRenderer();
      const wPos = vtkCoordinate.newInstance();
      wPos.setCoordinateSystemToWorld();
      wPos.setValue(worldPos);

      const displayPosition = wPos.getComputedDisplayValue(renderer);
      const { svgWidgetManager } = api;
      api.svgWidgets.crosshairsWidget.setPoint(
        displayPosition[0],
        displayPosition[1]
      );
      svgWidgetManager.render();
    });
  };
}

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

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      volumeMapper.setInputData(data);

      this.setState({
        volumes: [volumeActor],
      });
    });
  }

  storeApi = viewportIndex => {
    return api => {
      this.apis[viewportIndex] = api;

      const renderWindow = api.genericRenderWindow.getRenderWindow();
      const renderer = api.genericRenderWindow.getRenderer();
      const camera = renderer.getActiveCamera();

      // TODO: This is a hacky workaround because disabling the vtkInteractorStyleMPRSlice is currently
      // broken. The camera.onModified is never removed.
      renderWindow
        .getInteractor()
        .getInteractorStyle()
        .setVolumeMapper(null);

      const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();

      renderWindow.getInteractor().setInteractorStyle(istyle);
      istyle.setVolumeMapper(api.volumes[0]);

      istyle.setCallback(
        getCrosshairCallbackForIndex(this.apis, viewportIndex)
      );

      const svgWidgetManager = vtkSVGWidgetManager.newInstance();
      svgWidgetManager.setRenderer(renderer);
      svgWidgetManager.setScale(1);

      const crosshairsWidget = vtkSVGCrosshairsWidget.newInstance();

      svgWidgetManager.addWidget(crosshairsWidget);
      svgWidgetManager.render();

      api.svgWidgetManager = svgWidgetManager;
      api.svgWidgets = {
        crosshairsWidget,
      };

      switch (viewportIndex) {
        default:
        case 0:
          //Axial
          istyle.setSliceNormal(0, 0, 1);
          camera.setViewUp(0, -1, 0);

          break;
        case 1:
          // sagittal
          istyle.setSliceNormal(1, 0, 0);
          camera.setViewUp(0, 0, 1);
          break;
        case 2:
          // Coronal
          istyle.setSliceNormal(0, 1, 0);
          camera.setViewUp(0, 0, 1);
          break;
      }

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
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(0)} />
          </div>
          <div className="col-xs-12 col-sm-6">
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(1)} />
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-6">
            <View2D volumes={this.state.volumes} onCreated={this.storeApi(2)} />
          </div>
        </div>
      </>
    );
  }
}

export default VTKCrosshairsExample;
