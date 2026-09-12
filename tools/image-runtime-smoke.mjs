const canvases = [];
globalThis.document = {
  createElement: () => {
    const canvas = {
      width: 0,
      height: 0,
      toDataURL: () => 'data:image/png;base64,updated',
      getContext: () => ({ drawImage() {} }),
    };
    canvases.push(canvas);
    return canvas;
  },
};
globalThis.createImageBitmap = async (canvas) => ({ source: canvas });

const runtime = await import('../engine/image/runtime.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let dirtyCalls = 0;
let baseDrawCalls = 0;
let textureRequests = 0;
runtime.configure({
  canvasSize: 48,
  getActiveLayer: () => ({ id: 'layer-a' }),
  markDirty: () => { dirtyCalls += 1; },
  drawBaseLayer: () => { baseDrawCalls += 1; },
  requestApplyTexture: () => { textureRequests += 1; },
});
assert(runtime.getCanvasSize() === 48, 'configured canvas size was not retained');
assert(runtime.getActiveImageLayer()?.id === 'layer-a', 'active layer authority was not retained');
runtime.rememberOriginalDataUrl('retro', 'data:image/png;base64,original');
runtime.rememberOriginalDataUrl('retro', 'data:image/png;base64,replacement');
assert(runtime.getOriginalDataUrl('retro') === 'data:image/png;base64,original', 'original image URL was overwritten');

const layer = { imageBitmap: { width: 4, height: 4 } };
const updated = await runtime.updateLayerFromCanvas(layer, canvases[0] || document.createElement('canvas'));
assert(updated === layer && layer.imageDataUrl.endsWith('updated'), 'canvas update did not replace the layer bitmap');
assert(dirtyCalls === 1 && baseDrawCalls === 1 && textureRequests === 1, 'image update skipped an injected lifecycle authority');
runtime.clearOriginalDataUrl('retro');
assert(runtime.getOriginalDataUrl('retro') === null, 'original image URL was not cleared');

console.log('image-runtime: PASS');
