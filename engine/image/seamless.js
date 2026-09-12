import {
  armUndoSnapshot,
  clearOriginalDataUrl,
  createLayerCanvas,
  getActiveImageLayer,
  getOriginalDataUrl,
  rememberOriginalDataUrl,
  restoreLayerFromDataUrl,
  updateLayerFromCanvas,
} from './runtime.js';

export function makeSeamless(blendWidth = 32) {
  const layer = getActiveImageLayer();
  if (!layer || !layer.imageBitmap) return Promise.resolve(null);

  rememberOriginalDataUrl('seamless', layer.imageDataUrl);
  armUndoSnapshot();

  const source = createLayerCanvas(layer);
  if (!source || !source.ctx) return Promise.resolve(null);

  const tempCanvas = source.canvas;
  const tempCtx = source.ctx;
  const sourceImage = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const targetImage = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
  const srcData = sourceImage.data;
  const dstData = targetImage.data;
  const w = tempCanvas.width;
  const h = tempCanvas.height;
  const safeBlendWidth = Math.max(1, blendWidth);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const mx = w - x - 1;
      const my = h - y - 1;
      const idxTopLeft = (y * w + mx) * 4;
      const idxBottomLeft = (my * w + x) * 4;
      const idxBottomRight = (my * w + mx) * 4;
      const hFactor = Math.min(1, Math.min(x, w - x) / safeBlendWidth);
      const vFactor = Math.min(1, Math.min(y, h - y) / safeBlendWidth);

      for (let c = 0; c < 4; c++) {
        const orig = srcData[idx + c];
        const hm = srcData[idxTopLeft + c];
        const vm = srcData[idxBottomLeft + c];
        const bm = srcData[idxBottomRight + c];
        const hBlend = orig * hFactor + hm * (1 - hFactor);
        const vBlend = orig * vFactor + vm * (1 - vFactor);
        const bBlend = orig * hFactor * vFactor + bm * (1 - hFactor * vFactor);
        dstData[idx + c] = Math.round(hBlend * 0.33 + vBlend * 0.33 + bBlend * 0.34);
      }
    }
  }

  tempCtx.putImageData(targetImage, 0, 0);
  return updateLayerFromCanvas(layer, tempCanvas);
}

export function resetSeamless() {
  const original = getOriginalDataUrl('seamless');
  if (!original) return Promise.resolve(null);
  const layer = getActiveImageLayer();
  if (!layer) return Promise.resolve(null);
  armUndoSnapshot();
  return restoreLayerFromDataUrl(layer, original).then((result) => {
    clearOriginalDataUrl('seamless');
    return result;
  });
}
