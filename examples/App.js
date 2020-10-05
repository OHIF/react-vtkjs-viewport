/* eslint-disable react/prop-types */
import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link, Switch } from 'react-router-dom';
import VTKBasicExample from './VTKBasicExample.js';
import VTKFusionExample from './VTKFusionExample.js';
import VTKMPRPaintingExample from './VTKMPRPaintingExample.js';
import VTKCornerstonePaintingSyncExample from './VTKCornerstonePaintingSyncExample.js';
import VTKLoadImageDataExample from './VTKLoadImageDataExample.js';
import VTKCrosshairsExample from './VTKCrosshairsExample.js';
import VTKRotatableCrosshairsExample from './VTKRotatableCrosshairsExample.js';
import VTKMPRRotateExample from './VTKMPRRotateExample.js';
import VTKVolumeRenderingExample from './VTKVolumeRenderingExample.js';

function LinkOut({ href, text }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

function ExampleEntry({ title, url, text, screenshotUrl }) {
  return (
    <div>
      <h5>
        <Link to={url}>{title}</Link>
      </h5>
      <p>{text}</p>
      <hr />
    </div>
  );
}

function Index() {
  const style = {
    height: '512px',
  };

  const examples = [
    {
      title: 'Basic Usage',
      url: '/basic',
      text:
        'How to use the component to render an array of vtkVolumes and manipulate their RGB Transfer Functions.',
    },
    {
      title: 'Image Fusion',
      url: '/fusion',
      text:
        'Demonstrates how to display two volumes simultaneously with different transfer functions for PET/CT Fusion.',
    },
    {
      title: 'Volume Rendering',
      url: '/volume-rendering',
      text: 'Demonstrates how to perform volume rendering for a CT volume.',
    },
    {
      title: 'Image Segmentation via Paint Widget',
      url: '/painting',
      text:
        'Demonstrates how to enable the painting tools in both 2D and 3D views of the data. Image data for the underlying labelmap is rendered in both components simultaneously.',
    },
    {
      title: 'Syncing VTK Labelmap with Cornerstone Brush Tool Data',
      url: '/cornerstone-sync-painting',
      text:
        'Demonstrates how to set up a labelmap volume which can be edited in both VTK.js and Cornerstone simultaneously using a shared ArrayBuffer.',
    },
    {
      title: 'MPR Crosshairs Example',
      url: '/crosshairs',
      text:
        'Demonstrates how to set up the Crosshairs interactor style and SVG Widget',
    },
    {
      title: 'MPR Rotatable Crosshairs Example',
      url: '/rotatable-crosshairs',
      text:
        'Demonstrates how to set up the Rotatable Crosshairs interactor style and SVG Widget',
    },
    {
      title: 'MPR Rotate Example',
      url: '/rotate',
      text: 'Demonstrates how to set up the MPR Rotate interactor style',
    },
    {
      title: 'LoadImageData Example',
      url: '/cornerstone-load-image-data',
      text:
        'Generating vtkjs imagedata from cornerstone images and displaying them in a VTK viewport.',
    },
  ];

  const exampleComponents = examples.map(e => {
    return <ExampleEntry key={e.title} {...e} />;
  });

  return (
    <div className="container">
      <div className="row">
        <h1>VTK React Viewport Component</h1>
      </div>
      <div className="row">
        <div className="col-xs-12 col-lg-6">
          <h4>What is this?</h4>
          <p>
            This is a set of re-usable components for displaying data with{' '}
            <LinkOut
              href={'https://github.com/Kitware/vtk-js'}
              text={'VTK.js'}
            />
            .
          </p>
          <h4>Why does it exist?</h4>
          <p>
            To provide a simple starting point for developers that wish to build
            applications on top of VTK.js.
          </p>
        </div>

        <div className="col-xs-12 col-lg-12" style={style}>
          <h3>Examples</h3>
          {exampleComponents}
        </div>
      </div>
    </div>
  );
}

function Example(props) {
  return (
    <div className="container">
      <h5>
        <Link to="/">Back to Examples</Link>
      </h5>
      {props.children}
    </div>
  );
}

function AppRouter() {
  console.warn('approuter');

  // TODO: There is definitely a better way to do this
  const basic = () => Example({ children: <VTKBasicExample /> });
  const fusion = () => Example({ children: <VTKFusionExample /> });
  const painting = () => Example({ children: <VTKMPRPaintingExample /> });
  const loadImage = () => Example({ children: <VTKLoadImageDataExample /> });
  const synced = () =>
    Example({ children: <VTKCornerstonePaintingSyncExample /> });
  const crosshairs = () => Example({ children: <VTKCrosshairsExample /> });
  const rotatableCrosshairs = () =>
    Example({ children: <VTKRotatableCrosshairsExample /> });
  const rotateMPR = () => Example({ children: <VTKMPRRotateExample /> });
  const volumeRendering = () =>
    Example({ children: <VTKVolumeRenderingExample /> });

  return (
    <Router>
      <Switch>
        <Route exact path="/" component={Index} />
        <Route exact path="/basic/" render={basic} />
        <Route exact path="/fusion/" render={fusion} />
        <Route exact path="/painting" render={painting} />
        <Route exact path="/cornerstone-sync-painting" render={synced} />
        <Route exact path="/crosshairs" render={crosshairs} />
        <Route
          exact
          path="/rotatable-crosshairs"
          render={rotatableCrosshairs}
        />
        <Route exact path="/rotate" render={rotateMPR} />
        <Route exact path="/volume-rendering" render={volumeRendering} />
        <Route exact path="/cornerstone-load-image-data" render={loadImage} />
        <Route exact component={Index} />
      </Switch>
    </Router>
  );
}

export default class App extends Component {
  render() {
    return <AppRouter />;
  }
}
