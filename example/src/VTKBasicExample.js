import React from 'react';
import { PureComponent } from 'react';
//import PropTypes from 'prop-types';
import VTKViewport from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';

class VTKBasicExample extends PureComponent {
  state = {
    vtkActors: []
  }

  componentWillMount() {
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });

    // Create color and opacity transfer functions
    const ctfun = vtkColorTransferFunction.newInstance();
    ctfun.addRGBPoint(0, 85 / 255.0, 0, 0);
    ctfun.addRGBPoint(95, 1.0, 1.0, 1.0);
    ctfun.addRGBPoint(225, 0.66, 0.66, 0.5);
    ctfun.addRGBPoint(255, 0.3, 1.0, 0.5);

    const ofun = vtkPiecewiseFunction.newInstance();
    ofun.addPoint(0.0, 0.0);
    ofun.addPoint(255.0, 1.0);

    const actor = vtkVolume.newInstance();
    actor.getProperty().setRGBTransferFunction(0, ctfun);
    actor.getProperty().setScalarOpacity(0, ofun);
    actor.getProperty().setScalarOpacityUnitDistance(0, 3.0);
    actor.getProperty().setInterpolationTypeToLinear();
    actor.getProperty().setUseGradientOpacity(0, true);
    actor.getProperty().setGradientOpacityMinimumValue(0, 2);
    actor.getProperty().setGradientOpacityMinimumOpacity(0, 0.0);
    actor.getProperty().setGradientOpacityMaximumValue(0, 20);
    actor.getProperty().setGradientOpacityMaximumOpacity(0, 1.0);
    actor.getProperty().setShade(true);
    actor.getProperty().setAmbient(0.2);
    actor.getProperty().setDiffuse(0.7);
    actor.getProperty().setSpecular(0.3);
    actor.getProperty().setSpecularPower(8.0);

    reader.setUrl('/LIDC2.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();
      const mapper = vtkVolumeMapper.newInstance();

      mapper.setSampleDistance(1.1);
      mapper.setInputData(data);

      actor.setMapper(mapper);

      this.setState({
        vtkActors: [actor]
      });
    });
  }

  render() {
    return (
      <VTKViewport vtkActors={this.state.vtkActors}/>
    );
  }
}

export default VTKBasicExample;
