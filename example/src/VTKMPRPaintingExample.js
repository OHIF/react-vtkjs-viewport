import React from 'react';
import { Component } from 'react';

import { VTKMPRViewport } from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';

class VTKMPRPaintingExample extends Component {
  state = {
    data: null
  }

  componentWillMount() {
    const reader = vtkHttpDataSetReader.newInstance({
      fetchGzip: true,
    });

    reader.setUrl('/headsq.vti', { loadData: true }).then(() => {
      const data = reader.getOutputData();

      this.setState({
        data
      });
    });
  }

  render() {
    return (<React.Fragment>
      {this.state.data &&
      <VTKMPRViewport
        inputData={this.state.data}
        background={[0.1, 0.1, 0.1]}
      />
      }
    </React.Fragment>);
  }
}

export default VTKMPRPaintingExample;
