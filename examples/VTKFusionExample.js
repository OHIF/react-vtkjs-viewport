import React from 'react';
import { Component } from 'react';
import { getImageData, loadImageData, View2D, View3D } from '@vtk-viewport';
import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import { api } from 'dicomweb-client';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import './initCornerstone.js';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';

import presets from './presets.js';

window.cornerstoneWADOImageLoader = cornerstoneWADOImageLoader;

const url = 'https://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs';
//const url = 'http://localhost:8080/dcm4chee-arc/aets/DCM4CHEE/rs'
const client = new api.DICOMwebClient({ url });
const studyInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.373729467545468642229382466905';
const ctSeriesInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.182837959725425690842769990419';
const petSeriesInstanceUID =
  '1.3.6.1.4.1.14519.5.2.1.2744.7002.886851941687931416391879144903';
const searchInstanceOptions = {
  studyInstanceUID,
};

function createActorMapper(imageData) {
  const mapper = vtkVolumeMapper.newInstance();
  mapper.setInputData(imageData);

  const actor = vtkVolume.newInstance();
  actor.setMapper(mapper);

  return {
    actor,
    mapper,
  };
}

function createCT2dPipeline(imageData) {
  const { actor } = createActorMapper(imageData);
  const cfun = vtkColorTransferFunction.newInstance();
  /*
    0: { description: 'Soft tissue', window: 400, level: 40 },
  1: { description: 'Lung', window: 1500, level: -600 },
  2: { description: 'Liver', window: 150, level: 90 },
  3: { description: 'Bone', window: 2500, level: 480 },
  4: { description: 'Brain', window: 80, level: 40 },*/
  const preset = vtkColorMaps.getPresetByName('Grayscale');
  cfun.applyColorMap(preset);
  cfun.setMappingRange(-360, 440);

  actor.getProperty().setRGBTransferFunction(0, cfun);

  return actor;
}

function createPET2dPipeline(imageData, petColorMapId) {
  const { actor, mapper } = createActorMapper(imageData);
  mapper.setSampleDistance(5.0);

  const cfun = vtkColorTransferFunction.newInstance();
  const preset = vtkColorMaps.getPresetByName(petColorMapId);
  cfun.applyColorMap(preset);
  cfun.setMappingRange(0, 5);

  actor.getProperty().setRGBTransferFunction(0, cfun);

  // Create scalar opacity function
  const ofun = vtkPiecewiseFunction.newInstance();
  ofun.addPoint(0, 0.0);
  ofun.addPoint(0.1, 0.9);
  ofun.addPoint(5, 1.0);

  actor.getProperty().setScalarOpacity(0, ofun);

  return actor;
}

function getShiftRange(colorTransferArray) {
  // Credit to paraview-glance
  // https://github.com/Kitware/paraview-glance/blob/3fec8eeff31e9c19ad5b6bff8e7159bd745e2ba9/src/components/controls/ColorBy/script.js#L133

  // shift range is original rgb/opacity range centered around 0
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < colorTransferArray.length; i += 4) {
    min = Math.min(min, colorTransferArray[i]);
    max = Math.max(max, colorTransferArray[i]);
  }

  const center = (max - min) / 2;

  return {
    shiftRange: [-center, center],
    min,
    max,
  };
}

function applyPointsToPiecewiseFunction(points, range, pwf) {
  const width = range[1] - range[0];
  const rescaled = points.map(([x, y]) => [x * width + range[0], y]);

  pwf.removeAllPoints();
  rescaled.forEach(([x, y]) => pwf.addPoint(x, y));

  return rescaled;
}

function applyPointsToRGBFunction(points, range, cfun) {
  const width = range[1] - range[0];
  const rescaled = points.map(([x, r, g, b]) => [
    x * width + range[0],
    r,
    g,
    b,
  ]);

  cfun.removeAllPoints();
  rescaled.forEach(([x, r, g, b]) => cfun.addRGBPoint(x, r, g, b));

  return rescaled;
}

function applyPreset(actor, preset) {
  // Create color transfer function
  const colorTransferArray = preset.colorTransfer
    .split(' ')
    .splice(1)
    .map(parseFloat);

  const { shiftRange } = getShiftRange(colorTransferArray);
  let min = shiftRange[0];
  const width = shiftRange[1] - shiftRange[0];

  // TODO: Something about the rescaling is still very wrong
  const shift = shiftRange[0];
  min += shift;

  const cfun = vtkColorTransferFunction.newInstance();
  const normColorTransferValuePoints = [];
  for (let i = 0; i < colorTransferArray.length; i += 4) {
    let value = colorTransferArray[i];
    const r = colorTransferArray[i + 1];
    const g = colorTransferArray[i + 2];
    const b = colorTransferArray[i + 3];

    value = (value - min) / width;
    normColorTransferValuePoints.push([value, r, g, b]);
  }

  applyPointsToRGBFunction(normColorTransferValuePoints, shiftRange, cfun);

  actor.getProperty().setRGBTransferFunction(0, cfun);

  // Create scalar opacity function
  const scalarOpacityArray = preset.scalarOpacity
    .split(' ')
    .splice(1)
    .map(parseFloat);

  const ofun = vtkPiecewiseFunction.newInstance();
  const normPoints = [];
  for (let i = 0; i < scalarOpacityArray.length; i += 2) {
    let value = scalarOpacityArray[i];
    const opacity = scalarOpacityArray[i + 1];

    value = (value - min) / width;

    normPoints.push([value, opacity]);
  }

  applyPointsToPiecewiseFunction(normPoints, shiftRange, ofun);

  actor.getProperty().setScalarOpacity(0, ofun);

  const [
    gradientMinValue,
    gradientMinOpacity,
    gradientMaxValue,
    gradientMaxOpacity,
  ] = preset.gradientOpacity
    .split(' ')
    .splice(1)
    .map(parseFloat);

  actor.getProperty().setUseGradientOpacity(0, true);
  actor.getProperty().setGradientOpacityMinimumValue(0, gradientMinValue);
  actor.getProperty().setGradientOpacityMinimumOpacity(0, gradientMinOpacity);
  actor.getProperty().setGradientOpacityMaximumValue(0, gradientMaxValue);
  actor.getProperty().setGradientOpacityMaximumOpacity(0, gradientMaxOpacity);

  if (preset.interpolation === '1') {
    actor.getProperty().setInterpolationTypeToFastLinear();
    //actor.getProperty().setInterpolationTypeToLinear()
  }

  const ambient = parseFloat(preset.ambient);
  //const shade = preset.shade === '1'
  const diffuse = parseFloat(preset.diffuse);
  const specular = parseFloat(preset.specular);
  const specularPower = parseFloat(preset.specularPower);

  //actor.getProperty().setShade(shade)
  actor.getProperty().setAmbient(ambient);
  actor.getProperty().setDiffuse(diffuse);
  actor.getProperty().setSpecular(specular);
  actor.getProperty().setSpecularPower(specularPower);
}

function createCT3dPipeline(imageData, ctTransferFunctionPresetId) {
  const { actor, mapper } = createActorMapper(imageData);
  const sampleDistance =
    0.7 *
    Math.sqrt(
      imageData
        .getSpacing()
        .map(v => v * v)
        .reduce((a, b) => a + b, 0)
    );

  mapper.setSampleDistance(sampleDistance);

  const preset = presets.find(
    preset => preset.id === ctTransferFunctionPresetId
  );

  applyPreset(actor, preset);

  actor.getProperty().setScalarOpacityUnitDistance(0, 2.5);

  return actor;
}

function createPET3dPipeline(imageData, petColorMapId) {
  const { actor, mapper } = createActorMapper(imageData);
  const sampleDistance =
    0.7 *
    Math.sqrt(
      imageData
        .getSpacing()
        .map(v => v * v)
        .reduce((a, b) => a + b, 0)
    );

  mapper.setSampleDistance(sampleDistance);

  // Apply colormap
  const cfun = vtkColorTransferFunction.newInstance();
  const preset = vtkColorMaps.getPresetByName(petColorMapId);
  cfun.applyColorMap(preset);
  cfun.setMappingRange(0, 5);

  actor.getProperty().setRGBTransferFunction(0, cfun);

  // Create scalar opacity function
  const ofun = vtkPiecewiseFunction.newInstance();
  ofun.addPoint(0.0, 0.0);
  ofun.addPoint(0.1, 0.1);
  ofun.addPoint(5, 0.2);

  actor.getProperty().setScalarOpacity(0, ofun);
  actor.getProperty().setScalarOpacityUnitDistance(0, 2.5);

  return actor;
}

function createStudyImageIds(baseUrl, studySearchOptions) {
  const SOP_INSTANCE_UID = '00080018';
  const SERIES_INSTANCE_UID = '0020000E';

  return new Promise((resolve, reject) => {
    client.retrieveStudyMetadata(studySearchOptions).then(instances => {
      const imageIds = instances.map(metaData => {
        const imageId =
          `wadors:` +
          baseUrl +
          '/studies/' +
          studyInstanceUID +
          '/series/' +
          metaData[SERIES_INSTANCE_UID].Value[0] +
          '/instances/' +
          metaData[SOP_INSTANCE_UID].Value[0] +
          '/frames/1';

        cornerstoneWADOImageLoader.wadors.metaDataManager.add(
          imageId,
          metaData
        );

        return imageId;
      });

      resolve(imageIds);
    }, reject);
  });
}

const imageIdPromise = createStudyImageIds(url, searchInstanceOptions);

function loadDataset(imageIds, displaySetInstanceUid) {
  return new Promise((resolve, reject) => {
    const imageDataObject = getImageData(imageIds, displaySetInstanceUid);

    loadImageData(imageDataObject).then(() => {
      resolve(imageDataObject.vtkImageData);
    });
  });
}

class VTKFusionExample extends Component {
  state = {
    volumes: null,
    volumeRenderingVolumes: null,
    ctTransferFunctionPresetId: 'vtkMRMLVolumePropertyNode4',
    petColorMapId: 'hsv',
  };

  async componentDidMount() {
    this.components = {};

    const imageIds = await imageIdPromise;
    let ctImageIds = imageIds.filter(imageId =>
      imageId.includes(ctSeriesInstanceUID)
    );
    //ctImageIds = ctImageIds.slice(0, ctImageIds.length / 4)

    let petImageIds = imageIds.filter(imageId =>
      imageId.includes(petSeriesInstanceUID)
    );
    petImageIds = petImageIds.slice(0, petImageIds.length / 4);

    const ctImageDataPromise = loadDataset(ctImageIds, 'ctDisplaySet');
    const petImageDataPromise = loadDataset(petImageIds, 'petDisplaySet');
    const promises = [ctImageDataPromise, petImageDataPromise];

    Promise.all(promises).then(([ctImageData, petImageData]) => {
      const ctVol = createCT2dPipeline(ctImageData);
      const petVol = createPET2dPipeline(
        petImageData,
        this.state.petColorMapId
      );

      const ctVolVR = createCT3dPipeline(
        ctImageData,
        this.state.ctTransferFunctionPresetId
      );
      const petVolVR = createPET3dPipeline(
        petImageData,
        this.state.petColorMapId
      );

      this.setState({
        volumes: [ctVol, petVol],
        volumeRenderingVolumes: [ctVolVR, petVolVR],
      });
    });
  }

  saveComponentReference = viewportIndex => {
    return component => {
      this.components[viewportIndex] = component;
    };
  };

  handleChangeCTTransferFunction = event => {
    const ctTransferFunctionPresetId = event.target.value;
    const preset = presets.find(
      preset => preset.id === ctTransferFunctionPresetId
    );

    const actor = this.state.volumeRenderingVolumes[0];

    applyPreset(actor, preset);

    this.setState({
      ctTransferFunctionPresetId,
    });
  };

  handleChangePETColorMapId = event => {
    const petColorMapId = event.target.value;
    const actor2d = this.state.volumes[1];
    const actor3d = this.state.volumeRenderingVolumes[1];

    const preset = vtkColorMaps.getPresetByName(petColorMapId);

    [actor2d, actor3d].forEach(actor => {
      if (!actor) {
        return;
      }

      const cfun = actor.getProperty().getRGBTransferFunction(0);

      // TODO: Looks like this is returned by reference and mutated when
      // applyColorMap is run, so we are copying the array with .slice().
      // - Bit surprised we have to do this though. I wonder where else this is
      // causing issues
      const cRange = cfun.getMappingRange().slice();
      cfun.applyColorMap(preset);

      const newCfun = vtkColorTransferFunction.newInstance();
      newCfun.applyColorMap(preset);
      newCfun.setMappingRange(cRange[0], cRange[1]);

      // TODO: Why doesn't mutating the current RGBTransferFunction work?
      actor.getProperty().setRGBTransferFunction(0, newCfun);
    });

    this.setState({
      petColorMapId,
    });

    this.rerenderAll();
  };

  rerenderAll = () => {
    // Update all render windows, since the automatic re-render might not
    // happen if the viewport is not currently using the painting widget
    Object.keys(this.components).forEach(viewportIndex => {
      const renderWindow = this.components[
        viewportIndex
      ].genericRenderWindow.getRenderWindow();

      renderWindow.render();
    });
  };

  render() {
    if (!this.state.volumes) {
      return <h4>Loading...</h4>;
    }

    const ctTransferFunctionPresetOptions = presets.map(preset => {
      return (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      );
    });

    const petColorMapPresetOptions = vtkColorMaps.rgbPresetNames.map(preset => {
      return (
        <option key={preset} value={preset}>
          {preset}
        </option>
      );
    });

    return (
      <div className="row">
        <div className="col-xs-12">
          <h1>Image Fusion</h1>
          <p>
            This example demonstrates how to use both the 2D and 3D components
            to display multiple volumes simultaneously. A PET volume is overlaid
            on a CT volume and controls are provided to update the CT Volume
            Rendering presets (manipulating scalar opacity, gradient opacity,
            RGB transfer function, etc...) and the PET Colormap (i.e. RGB
            Transfer Function).
          </p>
          <p>
            Images are retrieved via DICOMWeb from a publicly available server
            and constructed into <code>vtkImageData</code> volumes before they
            are provided to the component. When each slice arrives, its pixel
            data is dumped into the proper location in the volume array.
          </p>
        </div>
        <div className="col-xs-12">
          <div>
            <label htmlFor="select_PET_colormap">PET Colormap: </label>
            <select
              id="select_PET_colormap"
              value={this.state.petColorMapId}
              onChange={this.handleChangePETColorMapId}
            >
              {petColorMapPresetOptions}
            </select>
          </div>
          <div>
            <label htmlFor="select_CT_xfer_fn">
              CT Transfer Function Preset (for Volume Rendering):{' '}
            </label>
            <select
              id="select_CT_xfer_fn"
              value={this.state.ctTransferFunctionPresetId}
              onChange={this.handleChangeCTTransferFunction}
            >
              {ctTransferFunctionPresetOptions}
            </select>
          </div>
        </div>
        <hr />
        <div className="col-xs-12 col-sm-6">
          <View2D
            volumes={this.state.volumes}
            onCreated={this.saveComponentReference(0)}
          />
        </div>
        <div className="col-xs-12 col-sm-6">
          <View3D
            volumes={this.state.volumeRenderingVolumes}
            onCreated={this.saveComponentReference(1)}
          />
        </div>
      </div>
    );
  }
}

export default VTKFusionExample;
