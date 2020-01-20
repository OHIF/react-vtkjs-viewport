import vtkMatrixBuilder from 'vtk.js/Sources/Common/Core/MatrixBuilder';
import vtkMouseRangeManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseRangeManipulator';

// ----------------------------------------------------------------------------
// vtkMPRScrollManipulator methods
// ----------------------------------------------------------------------------

const manipulatorName = 'vtkMPRScrollManipulator';

const vtkMPRScrollManipulatorMixin = {
  manipulatorName,
  manipulator: vtkMouseRangeManipulator,
  registerAPI: (manipulatorInstance, publicAPI, model) => {
    publicAPI.onUpdateScrollManipulator((publicAPI, model) => {
      const range = publicAPI.getSliceRange();

      manipulatorInstance.removeScrollListener();
      // The Scroll listener has min, max, step, and getValue setValue as params.
      // Internally, it checks that the result of the GET has changed, and only calls SET if it is new.
      manipulatorInstance.setScrollListener(
        range[0],
        range[1],
        1,
        publicAPI.getSlice,
        publicAPI.scrollToSlice
      );
    });

    publicAPI.getSlice = () => {
      const renderer = model.interactor.getCurrentRenderer();
      const camera = renderer.getActiveCamera();
      const sliceNormal = publicAPI.getSliceNormal();

      // Get rotation matrix from normal to +X (since bounds is aligned to XYZ)
      const transform = vtkMatrixBuilder
        .buildFromDegree()
        .identity()
        .rotateFromDirections(sliceNormal, [1, 0, 0]);

      const fp = camera.getFocalPoint();
      transform.apply(fp);
      return fp[0];
    };

    // Only run the onScroll callback if called from scrolling,
    // preventing manual setSlice calls from triggering the CB.
    publicAPI.scrollToSlice = slice => {
      const vtkScrollEvent = new CustomEvent('vtkscrollevent', {
        detail: { uid: publicAPI.getUid() },
      });
      window.dispatchEvent(vtkScrollEvent);

      const slicePoint = publicAPI.setSlice(slice);

      // run Callback
      const onScroll = publicAPI.getOnScroll();
      if (onScroll) {
        onScroll({
          slicePoint,
        });
      }
    };

    // TODO -> We need to think of a more generic way to do this for all widget types eventually.
    // TODO -> We certainly need to be able to register stuff like this for different annotations.
    // Should probably fire an event to some annotation service.
    model.onScroll = () => {
      const { apis, apiIndex } = model;

      if (apis && apis[apiIndex] && apis[apiIndex].type === 'VIEW2D') {
        // Check whether crosshairs should be updated.
        // TODO -> Nuke this, emit an event that crosshairs should listen to.

        const api = apis[apiIndex];

        if (!api.svgWidgets.crosshairsWidget) {
          // If we aren't using the crosshairs widget, bail out early.
          return;
        }

        const renderer = api.genericRenderWindow.getRenderer();
        let cachedCrosshairWorldPosition = api.get(
          'cachedCrosshairWorldPosition'
        );

        const wPos = vtkCoordinate.newInstance();
        wPos.setCoordinateSystemToWorld();
        wPos.setValue(cachedCrosshairWorldPosition);

        const doubleDisplayPosition = wPos.getComputedDoubleDisplayValue(
          renderer
        );

        const dPos = vtkCoordinate.newInstance();
        dPos.setCoordinateSystemToDisplay();

        dPos.setValue(doubleDisplayPosition[0], doubleDisplayPosition[1], 0);
        let worldPos = dPos.getComputedWorldValue(renderer);

        const camera = renderer.getActiveCamera();
        const directionOfProjection = camera.getDirectionOfProjection();
        const halfSlabThickness = api.getSlabThickness() / 2;

        // Add half of the slab thickness to the world position, such that we select
        //The center of the slice.

        for (let i = 0; i < worldPos.length; i++) {
          worldPos[i] += halfSlabThickness * directionOfProjection[i];
        }

        api.svgWidgets.crosshairsWidget.moveCrosshairs(
          worldPos,
          apis,
          apiIndex
        );
      }
    };
  },
};

export default vtkMPRScrollManipulatorMixin;
