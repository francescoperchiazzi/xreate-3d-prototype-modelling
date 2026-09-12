let imageToolRuntime = null;
const originalDataUrls = Object.create(null);

export function configure(opts) {
  imageToolRuntime = {
    ...(imageToolRuntime || {}),
    ...(opts || {}),
  };
  return imageToolRuntime;
}

export function getImageToolRuntime() {
  return imageToolRuntime || null;
}

export function getCanvasSize() {
  const size = Number(getImageToolRuntime()?.canvasSize);
  return Number.isFinite(size) && size > 0 ? size : 1024;
}

export function createSquareCanvas(size = getCanvasSize()) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function getActiveImageLayer() {
  try {
    const layer = getImageToolRuntime()?.getActiveLayer?.() || null;
    return layer || null;
  } catch (_) {
    return null;
  }
}

export function armUndoSnapshot() {
  try { getImageToolRuntime()?.armProjectUndoSnapshot?.(); } catch (_) {}
}

export function markDirty() {
  try { getImageToolRuntime()?.markDirty?.(); } catch (_) {}
}

export function createLayerCanvas(layer, size = getCanvasSize()) {
  if (!layer || !layer.imageBitmap) return null;
  const canvas = createSquareCanvas(size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(layer.imageBitmap, 0, 0, size, size);
  return { canvas, ctx };
}

export function rememberOriginalDataUrl(key, dataUrl) {
  if (!originalDataUrls[key] && dataUrl) {
    originalDataUrls[key] = dataUrl;
  }
  return originalDataUrls[key] || null;
}

export function getOriginalDataUrl(key) {
  return originalDataUrls[key] || null;
}

export function clearOriginalDataUrl(key) {
  delete originalDataUrls[key];
}

export function updateLayerFromCanvas(layer, canvas) {
  if (!layer || !canvas) return Promise.resolve(null);
  return createImageBitmap(canvas).then((bmp) => {
    layer.imageBitmap = bmp;
    layer.imageDataUrl = canvas.toDataURL('image/png');
    try { getImageToolRuntime()?.drawBaseLayer?.(); } catch (_) {}
    try { getImageToolRuntime()?.requestApplyTexture?.(true); } catch (_) {}
    markDirty();
    return layer;
  }).catch(() => null);
}

export function restoreLayerFromDataUrl(layer, dataUrl) {
  if (!layer || !dataUrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img).then((bmp) => {
        layer.imageBitmap = bmp;
        layer.imageDataUrl = dataUrl;
        try { getImageToolRuntime()?.drawBaseLayer?.(); } catch (_) {}
        try { getImageToolRuntime()?.requestApplyTexture?.(true); } catch (_) {}
        markDirty();
        resolve(layer);
      }).catch(() => resolve(null));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
