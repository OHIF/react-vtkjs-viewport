import React, { Component } from 'react';
import VTKBasicExample from './VTKBasicExample.js';

export default class App extends Component {
  render () {
    const style = {
      'height': '512px'
    };

    return (
      <div className="container">
      <div className="row">
        <h2>VTK React Viewport Component</h2>
      </div>
        <div className="row">
          <div className='col-xs-12 col-lg-6'>
            <h4>What is this?</h4>
            <p>This is a set of re-usable components for displaying data with <a href="https://github.com/Kitware/vtk-js" target="_blank" rel="noopener noreferrer">VTK.js.</a>
            </p>
          </div>
          <div className='col-xs-12 col-lg-6' style={style}>
            <VTKBasicExample/>
          </div>
        </div>
      </div>
    )
  }
}
