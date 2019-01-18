import React from 'react';
import { Component } from 'react';
import VTKViewport from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';

class VTKBasicExample extends Component {
  state = {
    vtkVolumeActors: []
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

    this.setState({
      vtkActors: [imageActorI, imageActorJ, imageActorK]
    });
  }

  componentWillMount() {
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });
    const actor = vtkVolume.newInstance();
    const mapper = vtkVolumeMapper.newInstance();

    actor.setMapper(mapper);

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      mapper.setInputData(data);

      this.setState({
        vtkVolumeActors: [actor]
      });

      this.addSliceViews(data);
    });
  }

  render() {
    return (<React.Fragment>
      <VTKViewport
        background={[0.2,0,0]}
        interactorStyle={'rotate'}
        vtkVolumeActors={this.state.vtkVolumeActors}
      />
      <VTKViewport
        background={[0,0,0.2]}
        vtkActors={this.state.vtkActors}/>
    </React.Fragment>);
  }
}

export default VTKBasicExample;
