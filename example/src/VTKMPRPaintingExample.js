import React from 'react';
import { Component } from 'react';

import { VTKMPRViewport } from 'react-vtkjs-viewport';
import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';

class VTKMPRPaintingExample extends Component {
  state = {
    data: null,
    focusedWidgetId: null
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

  setWidget = (event) => {
    const widgetId = event.target.value;
    debugger;
    if (widgetId === 'rotate') {
      this.setState({
        focusedWidgetId: null
      });
    } else {
      this.setState({
        focusedWidgetId: widgetId
      });
    }
  }

  render() {
    return (<React.Fragment>
      <div>
        <label>
          <input type="radio"
                 value="rotate"
                 name="widget"
                 onChange={this.setWidget}
                 checked={this.state.focusedWidgetId === null}
          /> Rotate
        </label>
        <label>
          <input type="radio"
                 value="PaintWidget"
                 name="widget"
                 onChange={this.setWidget}
                 checked={this.state.focusedWidgetId === 'PaintWidget'}
          />
          Paint
        </label>
      </div>
      {this.state.data &&
      <VTKMPRViewport
        inputData={this.state.data}
        background={[0.1, 0.1, 0.1]}
        focusedWidgetId={this.state.focusedWidgetId}
      />
      }
    </React.Fragment>);
  }
}

export default VTKMPRPaintingExample;
