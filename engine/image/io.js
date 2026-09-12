const undoBitmapPngCache = typeof WeakMap === 'function' ? new WeakMap() : null;
const canvasPngCache = typeof WeakMap === 'function' ? new WeakMap() : null;
const pendingUndoBitmaps = typeof WeakSet === 'function' ? new WeakSet() : null;

export function imageBitmapToPngDataUrlForSave(bitmap, opts = {}) {
  try {
    if (!bitmap) return null;
    const canvasSize = Number(opts.canvasSize) || 1024;
    const c = (opts.document || document).createElement('canvas');
    const bw = Math.max(1, bitmap.width || canvasSize);
    const bh = Math.max(1, bitmap.height || canvasSize);
    const maxDim = Math.max(bw, bh);
    const limit = 2048;
    const s = (maxDim > limit) ? (limit / maxDim) : 1;
    c.width = Math.max(1, Math.round(bw * s));
    c.height = Math.max(1, Math.round(bh * s));
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch (_) {
    return null;
  }
}

export async function loadImageFromDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const src = String(dataUrl);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    if (!/^data:/i.test(src) && !/^blob:/i.test(src)) {
      try { el.crossOrigin = 'anonymous'; } catch (_) {}
    }
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image load failed'));
    el.src = src;
  });
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(img); } catch (_) {}
  }
  return img;
}

export async function drawDataUrlToCanvas(dataUrl, ctx, opts = {}) {
  if (!dataUrl || !ctx) return false;
  let img = null;
  try { img = await loadImageFromDataUrl(dataUrl); } catch (_) { img = null; }
  if (!img) return false;
  const canvasSize = Number(opts.canvasSize) || 1024;
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
  return true;
}

function serializeBitmapToPngDataUrl(bitmap, opts = {}) {
  if (!bitmap) return null;
  const canvasSize = Number(opts.canvasSize) || 1024;
  const limit = Number(opts.limit) || 1024;
  const doc = opts.document || document;
  const c = doc.createElement('canvas');
  const bw = Math.max(1, bitmap.width || canvasSize);
  const bh = Math.max(1, bitmap.height || canvasSize);
  const maxDim = Math.max(bw, bh);
  const s = (maxDim > limit) ? (limit / maxDim) : 1;
  c.width = Math.max(1, Math.round(bw * s));
  c.height = Math.max(1, Math.round(bh * s));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

function getUndoBitmapCachedPngDataUrl(bitmap) {
  if (!undoBitmapPngCache || !bitmap) return null;
  const cached = undoBitmapPngCache.get(bitmap) || null;
  if (!cached) return null;
  if (typeof cached === 'string') return cached;
  if (cached && typeof cached === 'object') {
    const w = bitmap.width || 0;
    const h = bitmap.height || 0;
    if (cached.w === w && cached.h === h && typeof cached.url === 'string') return cached.url;
  }
  return null;
}

export function canvasToPngDataUrl(canvas, opts = {}) {
  try {
    if (!canvas) return null;
    const compositeCanvas = opts.compositeCanvas || null;
    const rev = Number.isFinite(opts.baseLayerRevision) ? opts.baseLayerRevision : 0;
    if (canvasPngCache && canvas === compositeCanvas) {
      const c = canvasPngCache.get(canvas) || null;
      if (c && c.rev === rev && typeof c.url === 'string') return c.url;
    }
    const perf = opts.performance || performance;
    const t0 = (perf && typeof perf.now === 'function') ? perf.now() : 0;
    const out = canvas.toDataURL('image/png');
    const t1 = (perf && typeof perf.now === 'function') ? perf.now() : 0;
    const dt = t1 - t0;
    if (dt > 500) {
      try { (opts.warn || console.warn)('Slow canvas serialization (PNG data URL): ' + Math.round(dt) + 'ms'); } catch (_) {}
    }
    if (canvasPngCache && canvas === compositeCanvas && out) {
      try { canvasPngCache.set(canvas, { rev, url: out }); } catch (_) {}
    }
    return out;
  } catch (_) {
    return null;
  }
}

export function getUndoLayerImageRef(layer, opts = {}) {
  if (!layer) return null;
  const internUndoAsset = opts.internUndoAsset || (() => null);
  const internUndoAssetAsync = opts.internUndoAssetAsync || (() => null);
  const doc = opts.document || document;
  const canvasSize = Number(opts.canvasSize) || 1024;
  if (layer.imageRef && layer._undoImageBitmap === layer.imageBitmap && layer._undoImageDataUrl === layer.imageDataUrl) return layer.imageRef;
  const dataUrlDirect = (layer.imageDataUrl && typeof layer.imageDataUrl === 'string') ? layer.imageDataUrl : null;
  if (dataUrlDirect) {
    const ref = internUndoAsset(dataUrlDirect);
    layer.imageRef = ref;
    layer._undoImageBitmap = layer.imageBitmap || null;
    layer._undoImageDataUrl = layer.imageDataUrl || null;
    return ref;
  }
  const bmp = layer.imageBitmap || null;
  if (!bmp) return null;
  const cached = getUndoBitmapCachedPngDataUrl(bmp);
  if (cached) {
    const ref = internUndoAsset(cached);
    layer.imageRef = ref;
    layer._undoImageBitmap = bmp;
    layer._undoImageDataUrl = null;
    return ref;
  }

  const ref = internUndoAssetAsync(() => {
    try {
      return new Promise((resolve) => {
        const c = serializeBitmapToPngDataUrl(bmp, { document: doc, canvasSize, limit: 1024 });
        if (!c || typeof c.toBlob !== 'function') { resolve(null); return; }
        c.toBlob((blob) => {
          try {
            if (!blob) { resolve(null); return; }
            const r = new FileReader();
            r.onloadend = () => {
              try {
                const url = (typeof r.result === 'string') ? r.result : null;
                if (undoBitmapPngCache && url) undoBitmapPngCache.set(bmp, { url, w: bmp.width || 0, h: bmp.height || 0 });
                resolve(url || null);
              } catch (_) { resolve(null); }
            };
            r.readAsDataURL(blob);
          } catch (_) { resolve(null); }
        }, 'image/png');
      });
    } catch (_) {
      return Promise.resolve(null);
    }
  });
  layer.imageRef = ref;
  layer._undoImageBitmap = bmp;
  layer._undoImageDataUrl = null;
  return ref;
}

export function getUndoCompositeRef(shape, baseRev, opts = {}) {
  if (!shape) return null;
  const internUndoAsset = opts.internUndoAsset || (() => null);
  const internUndoAssetAsync = opts.internUndoAssetAsync || (() => null);
  const r = Number.isFinite(baseRev) ? baseRev : 0;
  if (!shape._undoCompositeRefs) shape._undoCompositeRefs = new Map();
  const byRev = shape._undoCompositeRefs;
  try {
    const existing = byRev.get(r) || null;
    if (existing) return existing;
  } catch (_) {}
  const cached = (canvasPngCache && shape._compositeCanvas) ? (canvasPngCache.get(shape._compositeCanvas) || null) : null;
  if (cached && cached.rev === r && typeof cached.url === 'string') {
    const ref = internUndoAsset(cached.url);
    try { byRev.set(r, ref); } catch (_) {}
    return ref;
  }

  const ref = internUndoAssetAsync(() => {
    try {
      const canvas = shape._compositeCanvas;
      if (!canvas || typeof canvas.toBlob !== 'function') return Promise.resolve(null);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          try {
            if (!blob) { resolve(null); return; }
            const rr = new FileReader();
            rr.onloadend = () => {
              try {
                const url = (typeof rr.result === 'string') ? rr.result : null;
                try { if (url && canvasPngCache) canvasPngCache.set(canvas, { rev: r, url }); } catch (_) {}
                resolve(url || null);
              } catch (_) { resolve(null); }
            };
            rr.readAsDataURL(blob);
          } catch (_) { resolve(null); }
        }, 'image/png');
      });
    } catch (_) {
      return Promise.resolve(null);
    }
  });
  try { byRev.set(r, ref); } catch (_) {}
  return ref;
}

export function imageBitmapToPngDataUrl(bitmap, opts = {}) {
  try {
    if (!bitmap) return null;
    const cached = getUndoBitmapCachedPngDataUrl(bitmap);
    if (cached) return cached;
    try {
      if (undoBitmapPngCache && pendingUndoBitmaps && !pendingUndoBitmaps.has(bitmap)) {
        pendingUndoBitmaps.add(bitmap);
        const c0 = serializeBitmapToPngDataUrl(bitmap, { document: opts.document || document, canvasSize: Number(opts.canvasSize) || 1024, limit: 1024 });
        if (c0 && typeof c0.toBlob === 'function') {
          c0.toBlob((blob) => {
            try {
              if (!blob) return;
              const r = new FileReader();
              r.onloadend = () => {
                try {
                  const url = (typeof r.result === 'string') ? r.result : null;
                  if (undoBitmapPngCache && url) undoBitmapPngCache.set(bitmap, { url, w: bitmap.width || 0, h: bitmap.height || 0 });
                } catch (_) {}
              };
              r.readAsDataURL(blob);
            } catch (_) {}
          }, 'image/png');
        }
      }
    } catch (_) {}
    const c = serializeBitmapToPngDataUrl(bitmap, { document: opts.document || document, canvasSize: Number(opts.canvasSize) || 1024, limit: 1024 });
    if (!c) return null;
    const out = c.toDataURL('image/png');
    if (undoBitmapPngCache && out) undoBitmapPngCache.set(bitmap, { url: out, w: bitmap.width || 0, h: bitmap.height || 0 });
    return out;
  } catch (_) {
    return null;
  }
}
