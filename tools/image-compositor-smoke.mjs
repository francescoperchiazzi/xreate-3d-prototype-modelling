import {
  applyTexture,
  configure,
  ensureSrgbTexture,
  partHasAnyVisibleLayerImage,
} from '../engine/image/compositor.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class CanvasTexture {
  constructor(image) {
    this.image = image;
    this.needsUpdate = false;
  }
}

const THREE = {
  CanvasTexture,
  SRGBColorSpace: 'srgb',
  LinearMipmapLinearFilter: 'mipmap',
  LinearFilter: 'linear',
};
const texture = { colorSpace: null };
ensureSrgbTexture({ texture, THREE, renderer: { capabilities: { getMaxAnisotropy: () => 16 } } });
assert(texture.colorSpace === 'srgb' && texture.anisotropy === 8, 'sRGB texture configuration was incomplete');
assert(partHasAnyVisibleLayerImage({ layers: [{ imageBitmap: {} }] }), 'visible bitmap layer was not detected');
assert(!partHasAnyVisibleLayerImage({ layers: [{ visible: false, imageBitmap: {} }] }), 'hidden bitmap layer was treated as visible');

const drawCalls = [];
const compositeCtx = { clearRect() {}, drawImage: (...args) => drawCalls.push(args) };
const part = {
  id: 'part-a',
  layers: [{ imageBitmap: { width: 16, height: 16 } }],
  _compositeCanvas: {},
  _compositeCtx: compositeCtx,
};
const material = {};
const marks = [];
configure(null);
const applied = applyTexture({
  silent: true,
  THREE,
  canvasSize: 64,
  compositeCtx,
  compositeCanvas: {},
  baseCanvas: {},
  getCurrentMesh: () => ({ material }),
  getSelectedPart: () => part,
  getProject: () => ({ textureMode: 'per-shape' }),
  getShapeList: () => [part],
  refs: {},
  markViewportDirty: (frames) => marks.push(frames),
});
assert(applied, 'texture application did not complete');
assert(material.map === part._texture && material.needsUpdate, 'texture was not assigned to the selected material');
assert(marks.length === 1 && marks[0] === 30, 'viewport redraw authority was not invoked');
assert(drawCalls.length >= 2, 'composite texture canvases were not refreshed');

console.log('image-compositor: PASS');
