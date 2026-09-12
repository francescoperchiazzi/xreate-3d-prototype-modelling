function layerTransform() {
  return { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat' };
}

export function ensureUvCheckerAsset(ctx) {
  const refs = ctx?.refs || {};
  if (refs.uvCheckerCanvas && refs.uvCheckerDataUrl) return true;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) return false;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, size, size);
  const cells = 16;
  const cell = size / cells;
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const t = ((x + y) % 2) ? 0.92 : 0.76;
      const hue = ((x / (cells - 1)) * 260 + (y / (cells - 1)) * 80) % 360;
      c.fillStyle = `hsl(${hue} 70% ${Math.round(t * 100)}%)`;
      c.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  c.strokeStyle = 'rgba(0,0,0,0.28)';
  c.lineWidth = 1;
  for (let i = 0; i <= cells; i += 1) {
    const p = i * cell;
    c.beginPath();
    c.moveTo(p, 0);
    c.lineTo(p, size);
    c.stroke();
    c.beginPath();
    c.moveTo(0, p);
    c.lineTo(size, p);
    c.stroke();
  }
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  c.lineWidth = 3;
  c.strokeRect(2, 2, size - 4, size - 4);
  c.fillStyle = 'rgba(10,9,8,0.85)';
  c.font = '700 18px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const letters = 'ABCDEFGHJKLMNPQR';
  for (let i = 0; i < cells; i += 1) {
    const ch = letters[i % letters.length];
    c.fillText(ch, (i + 0.5) * cell, 0.5 * cell);
    c.fillText(String(i + 1), 0.5 * cell, (i + 0.5) * cell);
  }
  c.fillStyle = 'rgba(255,255,255,0.82)';
  c.font = '800 18px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  c.fillText('(0,0)', 2.5 * cell, 2.5 * cell);
  refs.uvCheckerCanvas = canvas;
  refs.uvCheckerDataUrl = (() => {
    try { return canvas.toDataURL('image/png'); } catch (_) { return null; }
  })();
  return !!refs.uvCheckerCanvas;
}

export async function createUvCheckerBitmap(ctx) {
  const refs = ctx?.refs || {};
  try { ensureUvCheckerAsset({ refs }); } catch (_) {}
  if (!refs.uvCheckerCanvas) return null;
  try {
    const bmp = await createImageBitmap(refs.uvCheckerCanvas, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'default' });
    return { bmp, dataUrl: refs.uvCheckerDataUrl || null };
  } catch (_) {
    return null;
  }
}

export function isUvCheckerApplied(ctx) {
  const refs = ctx?.refs || {};
  try { ensureUvCheckerAsset({ refs }); } catch (_) {}
  const shapes = ctx?.getShapeList ? ctx.getShapeList() : [];
  if (!Array.isArray(shapes) || !shapes.length) return false;
  for (const s of shapes) {
    if (!s || !Array.isArray(s.layers) || !s.layers.length) continue;
    for (const l of s.layers) {
      if (!l) continue;
      if (refs.uvCheckerDataUrl && l.imageDataUrl === refs.uvCheckerDataUrl) return true;
    }
  }
  return false;
}

export function hydrateLayerBitmapIfNeeded(ctx) {
  const layer = ctx?.layer || null;
  const part = ctx?.part || null;
  if (!layer || layer.imageBitmap || !layer.imageDataUrl || layer._hydratingBitmap) return false;
  layer._hydratingBitmap = true;
  const layerId = layer.id;
  const partId = part ? part.id : null;
  const dataUrl = layer.imageDataUrl;
  (async () => {
    try {
      let bmp = null;
      try { bmp = await ctx.loadImageFromDataUrl(dataUrl); } catch (_) { bmp = null; }
      if (!bmp || layer.id !== layerId) return;
      layer.imageBitmap = bmp;
      if (part && part.id === partId) part.imageBitmap = bmp;
      const active = ctx.getActiveLayer ? ctx.getActiveLayer() : null;
      if (active && active.id === layerId) {
        ctx.refs.imageBitmap = bmp;
        try { ctx.commitRefs && ctx.commitRefs(ctx.refs); } catch (_) {}
        try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
        try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
        try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
        try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
        try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      }
    } finally {
      layer._hydratingBitmap = false;
    }
  })();
  return true;
}

export async function loadImageFromFile(ctx) {
  const file = ctx?.file || null;
  if (!file || !file.type || !file.type.startsWith('image/')) return false;
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) {
    return false;
  }
  try { ctx.armProjectUndoSnapshot && ctx.armProjectUndoSnapshot(); } catch (_) {}
  try {
    const dataUrl = await new Promise((resolve) => {
      try {
        const fr = new FileReader();
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(file);
      } catch (_) {
        resolve(null);
      }
    });
    const bmp = await createImageBitmap(file, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'default' });
    try { ctx.addImageAsLayer && ctx.addImageAsLayer(bmp, dataUrl); } catch (_) {}
    try { ctx.fitImageToCanvas && ctx.fitImageToCanvas(); } catch (_) {}
    try { ctx.setStatusKey && ctx.setStatusKey('status_image_loaded', 'ok'); } catch (_) {}
    try { ctx.showToast && ctx.showToast(ctx.tr ? ctx.tr('toast_image_mapped') : 'Image mapped', 'success'); } catch (_) {}
    setTimeout(() => { try { ctx.setStatus && ctx.setStatus('', ''); } catch (_) {} }, 1500);
    return true;
  } catch (_) {
    try { ctx.setStatusKey && ctx.setStatusKey('status_image_load_failed', ''); } catch (_) {}
    return false;
  }
}

export function fitImageToCanvas(ctx) {
  const refs = ctx?.refs || {};
  const layer = ctx?.getActiveLayer ? ctx.getActiveLayer() : null;
  const canvasSize = Number(ctx?.canvasSize) || 1024;
  if (!layer || !layer.imageBitmap) return false;
  refs.imageBitmap = layer.imageBitmap;
  const ratio = (typeof refs.imageTransform?.ratio === 'number' && isFinite(refs.imageTransform.ratio)) ? refs.imageTransform.ratio : 1;
  const maxDim = Math.max(refs.imageBitmap.width * Math.max(0.001, ratio), refs.imageBitmap.height);
  const scale = (canvasSize * 0.86) / maxDim;
  refs.imageTransform.x = 0;
  refs.imageTransform.y = 0;
  refs.imageTransform.scale = Math.max(0.05, Math.min(20.0, scale));
  refs.imageTransform.rot = 0;
  try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
  try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
  try { ctx.commitActiveLayerTransform && ctx.commitActiveLayerTransform(); } catch (_) {}
  try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
  try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
  return true;
}

export function fillImageToCanvas(ctx) {
  const refs = ctx?.refs || {};
  const layer = ctx?.getActiveLayer ? ctx.getActiveLayer() : null;
  const canvasSize = Number(ctx?.canvasSize) || 1024;
  if (!layer || !layer.imageBitmap) return false;
  refs.imageBitmap = layer.imageBitmap;
  const ratio = (typeof refs.imageTransform?.ratio === 'number' && isFinite(refs.imageTransform.ratio)) ? refs.imageTransform.ratio : 1;
  const w = (refs.imageBitmap.width || 1) * Math.max(0.001, ratio);
  const h = refs.imageBitmap.height || 1;
  const rotDeg = (typeof refs.imageTransform?.rot === 'number' && isFinite(refs.imageTransform.rot)) ? refs.imageTransform.rot : 0;
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const rotW = Math.abs(w * c) + Math.abs(h * s);
  const rotH = Math.abs(w * s) + Math.abs(h * c);
  const scale = Math.max(canvasSize / Math.max(1, rotW), canvasSize / Math.max(1, rotH));
  refs.imageTransform.x = 0;
  refs.imageTransform.y = 0;
  refs.imageTransform.scale = Math.max(0.05, Math.min(20.0, scale));
  try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
  try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
  try { ctx.commitActiveLayerTransform && ctx.commitActiveLayerTransform(); } catch (_) {}
  try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
  try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
  return true;
}

export function removeUvCheckerFromAllShapes(ctx) {
  const refs = ctx?.refs || {};
  try { ensureUvCheckerAsset({ refs }); } catch (_) {}
  const shapes = ctx?.getShapeList ? ctx.getShapeList() : [];
  const project = ctx?.getProject ? ctx.getProject() : null;
  if (!Array.isArray(shapes) || !shapes.length) return false;
  const selectedId = project?.selectedId || null;
  let changed = false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      for (const s of shapes) {
        if (!s || !Array.isArray(s.layers) || !s.layers.length) continue;
        const before = s.layers.length;
        s.layers = s.layers.filter((l) => !(l && refs.uvCheckerDataUrl && l.imageDataUrl === refs.uvCheckerDataUrl));
        if (s.layers.length !== before) changed = true;
        if (!s.layers.length) {
          s.activeLayerIndex = 0;
          s.imageBitmap = null;
          s.imageDataUrl = null;
          s.imageTransform = layerTransform();
        } else {
          const ai = (typeof s.activeLayerIndex === 'number' && isFinite(s.activeLayerIndex)) ? s.activeLayerIndex : 0;
          s.activeLayerIndex = Math.max(0, Math.min(ai, s.layers.length - 1));
        }
      }
    });
  } catch (_) {}
  if (changed) {
    try {
      if (selectedId) ctx.setSelectedPart && ctx.setSelectedPart(selectedId, { silent: true });
      const part = ctx.getSelectedPart ? ctx.getSelectedPart() : null;
      if (part) ctx.setActiveLayer && ctx.setActiveLayer(part.activeLayerIndex || 0);
      ctx.drawBaseLayer && ctx.drawBaseLayer();
      ctx.requestApplyTexture && ctx.requestApplyTexture(true);
      ctx.renderLayerListUI && ctx.renderLayerListUI();
    } catch (_) {}
  }
  return changed;
}

export async function applyUvCheckerToAllShapes(ctx) {
  const refs = ctx?.refs || {};
  try { ensureUvCheckerAsset({ refs }); } catch (_) {}
  if (!refs.uvCheckerCanvas) return false;
  const shapes = ctx?.getShapeList ? ctx.getShapeList() : [];
  const project = ctx?.getProject ? ctx.getProject() : null;
  const prevId = project?.selectedId || null;
  const bmpById = new Map();
  for (const s of shapes) {
    if (!s) continue;
    try {
      const bmp = await createImageBitmap(refs.uvCheckerCanvas, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'default' });
      bmpById.set(s.id, bmp);
    } catch (_) {}
  }
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      for (const s of shapes) {
        if (!s) continue;
        const bmp = bmpById.get(s.id) || null;
        ctx.ensureLayersOnPart && ctx.ensureLayersOnPart(s);
        s.layers = [{
          id: ctx.newLayerId ? ctx.newLayerId() : `layer_${Date.now()}`,
          label: 'UV Checker',
          imageBitmap: bmp,
          imageDataUrl: refs.uvCheckerDataUrl,
          transform: layerTransform(),
          visible: true,
          clippingIslandId: null,
          polygonMaskPoints: null,
          maskLinked: true,
          opacity: 1.0,
          blendMode: 'source-over',
        }];
        s.activeLayerIndex = 0;
        s.imageBitmap = bmp;
        s.imageDataUrl = refs.uvCheckerDataUrl;
        s.imageTransform = layerTransform();
      }
    });
  } catch (_) {}
  for (const s of shapes) {
    if (!s) continue;
    try { ctx.setSelectedPart && ctx.setSelectedPart(s.id, { silent: true, skipApplyTexture: true }); } catch (_) {}
    try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
    try { ctx.applyTexture && ctx.applyTexture(true); } catch (_) {}
  }
  if (prevId) try { ctx.setSelectedPart && ctx.setSelectedPart(prevId, { silent: true }); } catch (_) {}
  return true;
}

export async function applyUvChecker(ctx) {
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) {
    return false;
  }
  try { ctx.armProjectUndoSnapshot && ctx.armProjectUndoSnapshot(); } catch (_) {}
  const asset = await (ctx.createUvCheckerBitmap ? ctx.createUvCheckerBitmap() : createUvCheckerBitmap({ refs: ctx?.refs || {} }));
  if (!asset || !asset.bmp) {
    try { ctx.setStatusKey && ctx.setStatusKey('status_image_load_failed', ''); } catch (_) {}
    return false;
  }
  try { ctx.addImageAsLayer && ctx.addImageAsLayer(asset.bmp, asset.dataUrl); } catch (_) {}
  try { ctx.fitImageToCanvas && ctx.fitImageToCanvas(); } catch (_) {}
  try { ctx.setStatusKey && ctx.setStatusKey('uv_checker_loaded_status', 'ok'); } catch (_) {}
  setTimeout(() => { try { ctx.setStatus && ctx.setStatus('', ''); } catch (_) {} }, 1500);
  return true;
}
