// Based on vtkImageData.cxx (vtkDataset)
export default function computeIndex(extent, incs, xyz) {
  return (
    ((xyz[0] - extent[0]) * incs[0] +
      (xyz[1] - extent[2]) * incs[1] +
      (xyz[2] - extent[4]) * incs[2]) |
    0
  )
}
