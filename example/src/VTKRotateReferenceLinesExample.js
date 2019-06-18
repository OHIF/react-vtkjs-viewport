import React from 'react';
import { Component } from 'react';
import {
  View2D,
  vtkInteractorStyleMPRWindowLevel,
  vtkSVGWidgetManager,
  vtkSVGRotateReferenceLinesWidget,
} from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
// import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
// import vtkMath from 'vtk.js/Sources/Common/Core/Math';

function getRefLineCallback(api) {
  // These are returned in world coordinates
  return ({ origin, normal }) => {
    console.log(normal);
    // Set camera focal point to world coordinate
    const renderWindow = api.genericRenderWindow.getRenderWindow();
    const istyle = renderWindow.getInteractor().getInteractorStyle();
    const transform = vtkMatrixBuilder
      .buildFromDegree()
      .identity()
      .rotateFromDirections(normal, [1, 0, 0]);

    const mutatedWorldPos = origin.slice();
    transform.apply(mutatedWorldPos);
    const slice = mutatedWorldPos[0];

    istyle.setSliceNormal(...normal);
    istyle.setSlice(slice);

    renderWindow.render();
  };
}

function getPlaneForView(api) {
  const renderer = api.genericRenderWindow.getRenderer();
  const renderWindow = api.genericRenderWindow.getRenderWindow();
  const camera = renderer.getActiveCamera();
  const istyle = renderWindow.getInteractor().getInteractorStyle();

  return {
    point: camera.getFocalPoint(),
    viewUp: camera.getViewUp(),
    normal: istyle.getSliceNormal(),
  };
}

function setupOnCameraModified(
  api,
  mprWidget,
  viewportIndex,
  svgWidgetManager
) {
  const renderWindow = api.genericRenderWindow.getRenderWindow();
  const istyle = renderWindow.getInteractor().getInteractorStyle();

  istyle.onModified(() => {
    console.warn('istyle being modified!');
    const plane = getPlaneForView(api);
    const planes = mprWidget.getPlanes();

    planes[viewportIndex] = plane;
    mprWidget.setPlanes(planes);

    //svgWidgetManager.render();
  });
}

class VTKRotateReferenceLinesExample extends Component {
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

      const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();

      renderWindow.getInteractor().setInteractorStyle(istyle);
      istyle.setVolumeMapper(api.volumes[0]);

      const svgWidgetManager = vtkSVGWidgetManager.newInstance();
      svgWidgetManager.setRenderer(renderer);
      svgWidgetManager.setScale(1);

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

      if (viewportIndex === 1) {
        const mprRefLinesWidget = vtkSVGRotateReferenceLinesWidget.newInstance();
        mprRefLinesWidget.setCallbacks([getRefLineCallback(this.apis[0])]);

        setupOnCameraModified(
          this.apis[0],
          mprRefLinesWidget,
          0,
          svgWidgetManager
        );

        const plane = getPlaneForView(this.apis[0]);

        mprRefLinesWidget.setRenderWindow(api.genericRenderWindow);
        mprRefLinesWidget.setPlanes([plane]);

        svgWidgetManager.addWidget(mprRefLinesWidget);

        svgWidgetManager.render();
        api.svgWidgetManager = svgWidgetManager;

        api.svgWidgets = {
          mprRefLinesWidget,
        };
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
        {/*<div className="row">
          <div className="col-xs-12 col-sm-6">
            <View2D
              volumes={this.state.volumes}
              onCreated={this.storeApi(2)}
            />
          </div>
        </div>*/}
      </>
    );
  }
}

export default VTKRotateReferenceLinesExample;
