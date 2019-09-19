import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';

function computeSlicingModeForAP(viewOrientation) {
  switch (viewOrientation) {
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
  }
}

function computeSlicingModeForIS(viewOrientation) {
  switch (viewOrientation) {
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
  }
}

function computeSlicingModeForLR(viewOrientation) {
  switch (viewOrientation) {
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
  }
}

export function computeSlicingMode(imageOrientation, viewOrientation) {
  switch (imageOrientation) {
    case 'A':
    case 'P':
      return computeSlicingModeForAP(viewOrientation);
    case 'I':
    case 'S':
      return computeSlicingModeForIS(viewOrientation);
    case 'L':
    case 'R':
      return computeSlicingModeForLR(viewOrientation);
  }
}
