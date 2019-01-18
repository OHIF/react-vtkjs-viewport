const { vtkImageMapper } = vtk.Rendering.Core;

function computeSlicingModeForAP(viewOrientation) {
  switch (viewOrientation) {
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
      break;
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
      break;
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
      break;
  }
}

function computeSlicingModeForIS(viewOrientation) {
  switch (viewOrientation) {
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
      break;
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
      break;
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
      break;
  }
}

function computeSlicingModeForLR(viewOrientation) {
  switch (viewOrientation) {
    case 'L':
    case 'R':
      return vtkImageMapper.SlicingMode.X;
      break;
    case 'I':
    case 'S':
      return vtkImageMapper.SlicingMode.Z;
      break;
    case 'A':
    case 'P':
      return vtkImageMapper.SlicingMode.Y;
      break;
  }
}

export function computeSlicingMode(imageOrientation, viewOrientation) {
  switch (imageOrientation) {
    case 'A':
    case 'P':
      return computeSlicingModeForAP(viewOrientation);
      break;
    case 'I':
    case 'S':
      return computeSlicingModeForIS(viewOrientation);
      break;
    case 'L':
    case 'R':
      return computeSlicingModeForLR(viewOrientation);
      break;
  }
}
