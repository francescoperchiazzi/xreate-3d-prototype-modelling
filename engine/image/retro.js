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

export function applyRetroEffect(pixelation = 8, colorDepthBits = 5, ditheringAmount = 0.3) {
  const layer = getActiveImageLayer();
  if (!layer || !layer.imageBitmap) return Promise.resolve(null);

  rememberOriginalDataUrl('retro', layer.imageDataUrl);
  armUndoSnapshot();

  const source = createLayerCanvas(layer);
  if (!source || !source.ctx) return Promise.resolve(null);

  const tempCanvas = source.canvas;
  const tempCtx = source.ctx;
  let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

  if (pixelation > 1) {
    const pixelSize = Math.max(1, pixelation);
    const smallWidth = Math.ceil(tempCanvas.width / pixelSize);
    const smallHeight = Math.ceil(tempCanvas.height / pixelSize);
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallCtx = smallCanvas.getContext('2d');
    if (smallCtx) {
      smallCtx.imageSmoothingEnabled = false;
      smallCtx.drawImage(tempCanvas, 0, 0, smallWidth, smallHeight);
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(smallCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
      imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }
  }

  const data = imageData.data;
  const colorLevels = Math.max(2, Math.pow(2, colorDepthBits));
  const scale = 255 / (colorLevels - 1);
  const width = tempCanvas.width;
  const height = tempCanvas.height;
  const ditherData = new Float32Array(data.length);

  for (let i = 0; i < data.length; i++) ditherData[i] = data[i];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const oldPixel = ditherData[idx + c];
        let newPixel = Math.round(oldPixel / scale) * scale;
        newPixel = oldPixel + (newPixel - oldPixel) * ditheringAmount;
        ditherData[idx + c] = newPixel;
        const quantError = oldPixel - newPixel;

        if (x + 1 < width) ditherData[idx + 4 + c] += (quantError * 7) / 16;
        if (y + 1 < height) {
          if (x - 1 >= 0) ditherData[idx + width * 4 - 4 + c] += (quantError * 3) / 16;
          ditherData[idx + width * 4 + c] += (quantError * 5) / 16;
          if (x + 1 < width) ditherData[idx + width * 4 + 4 + c] += quantError / 16;
        }

        data[idx + c] = Math.max(0, Math.min(255, Math.round(newPixel)));
      }
    }
  }

  tempCtx.putImageData(imageData, 0, 0);
  return updateLayerFromCanvas(layer, tempCanvas);
}

export function resetRetroEffect() {
  const original = getOriginalDataUrl('retro');
  if (!original) return Promise.resolve(null);
  const layer = getActiveImageLayer();
  if (!layer) return Promise.resolve(null);
  armUndoSnapshot();
  return restoreLayerFromDataUrl(layer, original).then((result) => {
    clearOriginalDataUrl('retro');
    return result;
  });
}
