import React from 'react';
import { Component } from 'react';
import VTKViewport from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import vtkPaintWidget from 'vtk.js/Sources/Widgets/Widgets3D/PaintWidget';

class VTKBasicExample extends Component {
  state = {
    renderWindowData: []
  }

  addSliceViews = (data) => {
    const imageActorI = vtkImageSlice.newInstance();
    const imageActorJ = vtkImageSlice.newInstance();
    const imageActorK = vtkImageSlice.newInstance();

    const imageMapperK = vtkImageMapper.newInstance();
    imageMapperK.setInputData(data);
    imageMapperK.setKSlice(30);
    imageActorK.setMapper(imageMapperK);

    const imageMapperJ = vtkImageMapper.newInstance();
    imageMapperJ.setInputData(data);
    imageMapperJ.setJSlice(30);
    imageActorJ.setMapper(imageMapperJ);

    const imageMapperI = vtkImageMapper.newInstance();
    imageMapperI.setInputData(data);
    imageMapperI.setISlice(30);
    imageActorI.setMapper(imageMapperI);

    const dataRange = data
      .getPointData()
      .getScalars()
      .getRange();
    //const extent = data.getExtent();

    const level = (dataRange[0] + dataRange[1]) / 2;
    const window = dataRange[0] + dataRange[1];

    imageActorI.getProperty().setColorLevel(level);
    imageActorJ.getProperty().setColorLevel(level);
    imageActorK.getProperty().setColorLevel(level);

    imageActorI.getProperty().setColorWindow(window);
    imageActorJ.getProperty().setColorWindow(window);
    imageActorK.getProperty().setColorWindow(window);

    const renderWindowData = this.state.renderWindowData;
    const paintWidget = vtkPaintWidget.newInstance();
    paintWidget.setRadius(30);
    paintWidget.setColor([1,0,0]);

    renderWindowData.push({
      background: [0,0,0],
      vtkActors: [imageActorI, imageActorJ, imageActorK],
      widgets: [{
        vtkWidget: paintWidget,
        viewType: ViewTypes.VOLUME
      }]
    })

    this.setState({
      renderWindowData
    });
  }

  componentWillMount() {
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });
    const volumeActor = vtkVolume.newInstance();
    const volumeMapper = vtkVolumeMapper.newInstance();

    volumeActor.setMapper(volumeMapper);

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      volumeMapper.setInputData(data);

      const paintWidget = vtkPaintWidget.newInstance();
      paintWidget.setRadius(30);
      paintWidget.setColor([1,0,0]);

      const renderWindowData = this.state.renderWindowData;
      renderWindowData[0] = {
        background: [1,1,1],
        //interactorStyle: 'rotate',
        vtkVolumeActors: [volumeActor],
        widgets: [{
          vtkWidget: paintWidget,
          viewType: ViewTypes.VOLUME
        }]
      };

      this.setState({
        renderWindowData
      });

      this.addSliceViews(data);
    });
  }

  render() {
    return (<React.Fragment>
      <VTKViewport
        renderWindowData={this.state.renderWindowData}
      />
    </React.Fragment>);
  }
}

export default VTKBasicExample;
