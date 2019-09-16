import { getImageData } from './getImageData.js';
import loadImageData from './loadImageData.js';
import { logMemoryUsage } from './logMemoryUsage.js';
import { math } from './math/index.js';
import { MPR } from './MPR/index.js';
import { switchToMPRMode } from './switchToMPRMode.js';
import ohifInteractorStyleSlice from './ohifInteractorStyleSlice.js';
import ohifInteractorObserver from './ohifInteractorObserver.js';
import throttle from './throttle.js';

const VTKUtils = {
  getImageData,
  loadImageData,
  logMemoryUsage,
  math,
  MPR,
  ohifInteractorStyleSlice,
  switchToMPRMode,
  ohifInteractorObserver,
  throttle,
};

// TODO: this probably isn't the best thing to do here
window.VTKUtils = VTKUtils;
