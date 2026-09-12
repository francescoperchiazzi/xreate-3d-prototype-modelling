function warnSurfaceCanvas(stage, err) {
  console.warn('[surface-canvas]', stage, err);
}

export function pointInPolygon(x, y, pts) {
  if (!Array.isArray(pts) || pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInIsland(x, y, island) {
  if (!island) return false;
  if (island.type === 'rect') return x >= island.x && x <= (island.x + island.w) && y >= island.y && y <= (island.y + island.h);
  if (island.type === 'circle') {
    const dx = x - island.cx;
    const dy = y - island.cy;
    return (dx * dx + dy * dy) <= (island.r * island.r);
  }
  return false;
}

export function ensureLayerPickCanvas(layer) {
  const bmp = layer?.imageBitmap || null;
  if (!bmp) return null;
  let c = layer._pickCanvas || null;
  let ctx = layer._pickCtx || null;
  const sameSource = layer._pickSource === bmp;
  if (!c || !ctx || c.width !== bmp.width || c.height !== bmp.height || !sameSource) {
    c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0);
    layer._pickCanvas = c;
    layer._pickCtx = ctx;
    layer._pickSource = bmp;
  }
  return ctx;
}

export function layerAlphaAtLocal(layer, lx, ly) {
  if (!layer || !layer.imageBitmap) return 0;
  const bmp = layer.imageBitmap;
  const ix = Math.floor(lx + bmp.width / 2);
  const iy = Math.floor(ly + bmp.height / 2);
  if (ix < 0 || iy < 0 || ix >= bmp.width || iy >= bmp.height) return 0;
  const ctx = ensureLayerPickCanvas(layer);
  if (!ctx) return 255;
  try { return ctx.getImageData(ix, iy, 1, 1).data[3] || 0; } catch (err) {
    warnSurfaceCanvas('alpha-pick fallback', err);
    return 255;
  }
}

export function pickLayerIndexAtTexPos(ctx) {
  const layers = ctx?.getCurrentLayers ? ctx.getCurrentLayers() : [];
  if (!layers.length) return -1;
  const islands = ctx?.getIslandsForUvMode ? ctx.getIslandsForUvMode() : [];
  for (let idx = layers.length - 1; idx >= 0; idx--) {
    const layer = layers[idx];
    if (!layer || layer.visible === false || !layer.imageBitmap) continue;
    const clipId = layer.clippingIslandId || null;
    if (clipId) {
      const island = islands.find((i) => i && i.id === clipId) || null;
      if (!pointInIsland(ctx.x, ctx.y, island)) continue;
    }
    const pts = Array.isArray(layer?.polygonMaskPoints) ? layer.polygonMaskPoints : null;
    if (pts && pts.length >= 3 && !pointInPolygon(ctx.x, ctx.y, pts)) continue;
    const m = ctx.affineFromCanvasTransform(layer.transform || { x: 0, y: 0, scale: 1, rot: 0, ratio: 1 });
    const inv = ctx.affineInvert(m);
    if (!inv) continue;
    const lx = inv.a * ctx.x + inv.c * ctx.y + inv.e;
    const ly = inv.b * ctx.x + inv.d * ctx.y + inv.f;
    const w = layer.imageBitmap.width;
    const h = layer.imageBitmap.height;
    if (lx < -w / 2 || lx > w / 2 || ly < -h / 2 || ly > h / 2) continue;
    if (layerAlphaAtLocal(layer, lx, ly) > 12) return idx;
  }
  return -1;
}

function scheduleSurfaceDraw(ctx) {
  const refs = ctx?.refs || {};
  if (!refs) return false;
  refs._surfaceDrawDirty = true;
  if (refs._surfaceDrawRaf) return true;
  refs._surfaceDrawRaf = requestAnimationFrame(() => {
    refs._surfaceDrawRaf = 0;
    if (!refs._surfaceDrawDirty) return;
    refs._surfaceDrawDirty = false;
    try { ctx.commitActiveLayerTransform && ctx.commitActiveLayerTransform(); } catch (err) { warnSurfaceCanvas('commit active layer transform failed', err); }
    try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (err) { warnSurfaceCanvas('draw base layer failed', err); }
    try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (err) { warnSurfaceCanvas('apply texture failed', err); }
  });
  return true;
}

function pointerKey(event) {
  return (event && event.pointerId !== undefined) ? String(event.pointerId) : null;
}

function rememberTouchPointer(refs, event) {
  if (!refs || !event || event.pointerType !== 'touch') return 0;
  if (!refs.surfaceTouchPointers) refs.surfaceTouchPointers = new Map();
  const key = pointerKey(event);
  if (key === null) return refs.surfaceTouchPointers.size;
  refs.surfaceTouchPointers.set(key, { x: event.clientX, y: event.clientY });
  return refs.surfaceTouchPointers.size;
}

function forgetTouchPointer(refs, event) {
  if (!refs?.surfaceTouchPointers || !event || event.pointerType !== 'touch') return 0;
  const key = pointerKey(event);
  if (key !== null) refs.surfaceTouchPointers.delete(key);
  return refs.surfaceTouchPointers.size;
}

function touchDistance(refs) {
  const points = Array.from(refs?.surfaceTouchPointers?.values?.() || []);
  if (points.length < 2) return 0;
  const [a, b] = points;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function touchMidpoint(refs) {
  const points = Array.from(refs?.surfaceTouchPointers?.values?.() || []);
  if (points.length < 2) return null;
  const [a, b] = points;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function beginPinch(refs) {
  const distance = touchDistance(refs);
  if (!distance || !refs?.imageTransform) return false;
  refs.surfacePinchActive = true;
  refs.surfacePinchStartDistance = distance;
  refs.surfacePinchStartScale = Number(refs.imageTransform.scale) || 1;
  refs.surfacePinchStartMidpoint = touchMidpoint(refs);
  refs.surfacePinchStartX = Number(refs.imageTransform.x) || 0;
  refs.surfacePinchStartY = Number(refs.imageTransform.y) || 0;
  // A two-finger gesture replaces the one-finger drag.  This prevents the
  // first finger from translating the texture while the second finger starts
  // the scale gesture, which was the visible iPad "glitch".
  refs.canvasDragActive = false;
  refs.canvasDragPointerId = null;
  refs.draggingImage = false;
  return true;
}

function updatePinch(ctx) {
  const refs = ctx?.refs || {};
  if (!refs.surfacePinchActive || !refs.imageTransform) return false;
  const distance = touchDistance(refs);
  if (!distance || !refs.surfacePinchStartDistance) return false;
  const baseCanvas = ctx?.baseCanvas || null;
  const midpoint = touchMidpoint(refs);
  const nextScale = Math.max(0.05, Math.min(20, refs.surfacePinchStartScale * (distance / refs.surfacePinchStartDistance)));
  refs.imageTransform.scale = nextScale;
  // A two-finger gesture has two independent, useful components: the distance
  // zooms, while moving its midpoint pans the texture.  This also makes a
  // parallel two-finger drag a reliable pan on iPhone and iPad.
  if (baseCanvas && midpoint && refs.surfacePinchStartMidpoint) {
    const rect = baseCanvas.getBoundingClientRect();
    const size = Number(ctx?.canvasSize) || 1024;
    const sx = size / Math.max(1, rect.width);
    const sy = size / Math.max(1, rect.height);
    refs.imageTransform.x = refs.surfacePinchStartX + (midpoint.x - refs.surfacePinchStartMidpoint.x) * sx;
    refs.imageTransform.y = refs.surfacePinchStartY + (midpoint.y - refs.surfacePinchStartMidpoint.y) * sy;
  }
  try { ctx?.onScaleChanged && ctx.onScaleChanged(nextScale, Number(ctx?.canvasSize) || 1024); } catch (err) { warnSurfaceCanvas('pinch scale control update failed', err); }
  try { ctx?.updateTransformUi && ctx.updateTransformUi(); } catch (err) { warnSurfaceCanvas('pinch transform UI update failed', err); }
  scheduleSurfaceDraw({
    refs,
    commitActiveLayerTransform: ctx?.commitActiveLayerTransform,
    drawBaseLayer: ctx?.drawBaseLayer,
    requestApplyTexture: ctx?.requestApplyTexture,
  });
  return true;
}

export function onCanvasPointerDown(ctx) {
  const e = ctx?.event || null;
  const refs = ctx?.refs || {};
  if (!e || (e.button !== undefined && e.button !== 0)) return false;
  const baseCanvas = ctx?.baseCanvas || null;
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;
  if (!baseCanvas) return false;
  const touchCount = rememberTouchPointer(refs, e);
  if (e.isTrusted && baseCanvas.setPointerCapture && e.pointerId !== undefined) {
    try { baseCanvas.setPointerCapture(e.pointerId); } catch (err) { warnSurfaceCanvas('set pointer capture failed', err); }
  }
  if (touchCount >= 2) {
    beginPinch(refs);
    try { e.preventDefault(); } catch (_) {}
    return true;
  }
  const rect = baseCanvas.getBoundingClientRect();
  const sx = (rect.width > 0) ? (CANVAS_SIZE / rect.width) : 1;
  const sy = (rect.height > 0) ? (CANVAS_SIZE / rect.height) : 1;
  const px = (e.clientX - rect.left) * sx;
  const py = (e.clientY - rect.top) * sy;
  const picked = (typeof ctx.pickLayerIndexAtTexPos === 'function' ? ctx.pickLayerIndexAtTexPos : pickLayerIndexAtTexPos)({
    x: px,
    y: py,
    getCurrentLayers: ctx.getCurrentLayers,
    getIslandsForUvMode: ctx.getIslandsForUvMode,
    affineFromCanvasTransform: ctx.affineFromCanvasTransform,
    affineInvert: ctx.affineInvert,
  });
  if (picked >= 0 && picked !== refs.activeLayerIndex) {
    try { ctx.setActiveLayer && ctx.setActiveLayer(picked); } catch (err) { warnSurfaceCanvas('set active layer failed', err); }
    // Selecting from the canvas replaces the LayerSession snapshot. Refresh
    // the local gesture refs before recording a drag, otherwise the wrapper
    // below can write the old layer back after this event and move/scale it.
    try { ctx.syncRefsFromHost && ctx.syncRefsFromHost(); } catch (err) { warnSurfaceCanvas('refresh selected layer failed', err); }
    // A picking gesture must never also become a drag.  Aside from avoiding an
    // accidental jump, this gives the selected layer one complete event cycle
    // to hydrate its bitmap and transform before it can be moved.
    refs.canvasDragActive = false;
    refs.canvasDragPointerId = null;
    refs.draggingImage = false;
    refs.prevImagePointer = null;
    return true;
  }
  refs.canvasDragActive = true;
  refs.canvasDragPointerId = (e.pointerId !== undefined) ? e.pointerId : null;
  refs.canvasDragStartClient = { x: e.clientX, y: e.clientY };
  refs.draggingImage = false;
  refs.prevImagePointer = { x: e.clientX, y: e.clientY };
  return true;
}

export function onCanvasPointerMove(ctx) {
  const e = ctx?.event || null;
  const refs = ctx?.refs || {};
  if (!e) return false;
  if (e.pointerType === 'touch') {
    rememberTouchPointer(refs, e);
    if (refs.surfaceTouchPointers?.size >= 2) {
      const changed = updatePinch(ctx);
      if (changed) {
        try { e.preventDefault(); } catch (_) {}
      }
      return changed;
    }
  }
  if (refs.canvasDragActive && !refs.draggingImage) {
    const dx0 = e.clientX - refs.canvasDragStartClient.x;
    const dy0 = e.clientY - refs.canvasDragStartClient.y;
    if ((dx0 * dx0 + dy0 * dy0) >= 9) {
      refs.draggingImage = true;
      refs.prevImagePointer = { x: e.clientX, y: e.clientY };
    } else {
      return false;
    }
  }
  if (!refs.draggingImage) return false;
  const baseCanvas = ctx?.baseCanvas || null;
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;
  if (!baseCanvas || !refs.imageTransform) return false;
  const rect = baseCanvas.getBoundingClientRect();
  const sx = CANVAS_SIZE / rect.width;
  const sy = CANVAS_SIZE / rect.height;
  const dx = (e.clientX - refs.prevImagePointer.x) * sx;
  const dy = (e.clientY - refs.prevImagePointer.y) * sy;
  refs.imageTransform.x += dx;
  refs.imageTransform.y += dy;
  refs.prevImagePointer = { x: e.clientX, y: e.clientY };
  scheduleSurfaceDraw({
    refs,
    commitActiveLayerTransform: ctx?.commitActiveLayerTransform,
    drawBaseLayer: ctx?.drawBaseLayer,
    requestApplyTexture: ctx?.requestApplyTexture,
  });
  return true;
}

export function onCanvasPointerUp(ctx) {
  const e = ctx?.event || null;
  const refs = ctx?.refs || {};
  const baseCanvas = ctx?.baseCanvas || null;
  const remainingTouches = forgetTouchPointer(refs, e);
  if (refs.surfacePinchActive && remainingTouches < 2) {
    refs.surfacePinchActive = false;
    refs.surfacePinchStartDistance = 0;
    refs.surfacePinchStartScale = 0;
    refs.surfacePinchStartMidpoint = null;
  }
  refs.canvasDragActive = false;
  refs.canvasDragPointerId = null;
  refs.draggingImage = false;
  if (baseCanvas && baseCanvas.releasePointerCapture && e?.pointerId !== undefined && baseCanvas.hasPointerCapture?.(e.pointerId)) {
    try { baseCanvas.releasePointerCapture(e.pointerId); } catch (err) { warnSurfaceCanvas('release pointer capture failed', err); }
  }
  return true;
}

export function installCanvasInteractions(ctx) {
  const baseCanvas = ctx?.baseCanvas || null;
  if (!baseCanvas || baseCanvas.dataset.boundSurfaceCanvasRuntime === '1') return false;
  const syncRefsFromHost = (typeof ctx?.syncRefsFromHost === 'function') ? ctx.syncRefsFromHost : null;
  const syncHostFromRefs = (typeof ctx?.syncHostFromRefs === 'function') ? ctx.syncHostFromRefs : null;
  const refs = ctx?.refs || {};

  const runWithSync = (fn) => (event) => {
    try { syncRefsFromHost && syncRefsFromHost(); } catch (err) { warnSurfaceCanvas('sync refs from host failed', err); }
    try { fn(event); } catch (err) { warnSurfaceCanvas('canvas interaction failed', err); }
    try { syncHostFromRefs && syncHostFromRefs(); } catch (err) { warnSurfaceCanvas('sync refs to host failed', err); }
  };

  baseCanvas.dataset.boundSurfaceCanvasRuntime = '1';
  baseCanvas.addEventListener('pointerdown', runWithSync((event) => {
    onCanvasPointerDown({
      event,
      refs,
      baseCanvas,
      canvasSize: ctx?.canvasSize,
      getCurrentLayers: ctx?.getCurrentLayers,
      getIslandsForUvMode: ctx?.getIslandsForUvMode,
      affineFromCanvasTransform: ctx?.affineFromCanvasTransform,
      affineInvert: ctx?.affineInvert,
      setActiveLayer: ctx?.setActiveLayer,
      syncRefsFromHost,
    });
  }));
  baseCanvas.addEventListener('pointermove', runWithSync((event) => {
    onCanvasPointerMove({
      event,
      refs,
      baseCanvas,
      canvasSize: ctx?.canvasSize,
      commitActiveLayerTransform: ctx?.commitActiveLayerTransform,
      drawBaseLayer: ctx?.drawBaseLayer,
      requestApplyTexture: ctx?.requestApplyTexture,
      updateTransformUi: ctx?.updateTransformUi,
      onScaleChanged: ctx?.onScaleChanged,
    });
  }));
  baseCanvas.addEventListener('pointerup', runWithSync((event) => {
    onCanvasPointerUp({ event, refs, baseCanvas });
  }));
  baseCanvas.addEventListener('pointercancel', runWithSync((event) => {
    onCanvasPointerUp({ event, refs, baseCanvas });
  }));
  baseCanvas.addEventListener('wheel', runWithSync((event) => {
    const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;
    if (!refs.imageTransform) return;
    const delta = Math.sign(event.deltaY);
    const factor = delta > 0 ? 0.95 : 1.05;
    refs.imageTransform.scale = Math.max(0.05, Math.min(20.0, refs.imageTransform.scale * factor));
    try { ctx?.onScaleChanged && ctx.onScaleChanged(refs.imageTransform.scale, CANVAS_SIZE); } catch (err) { warnSurfaceCanvas('scale control update failed', err); }
    try { ctx?.updateTransformUi && ctx.updateTransformUi(); } catch (err) { warnSurfaceCanvas('transform UI update failed', err); }
    scheduleSurfaceDraw({
      refs,
      commitActiveLayerTransform: ctx?.commitActiveLayerTransform,
      drawBaseLayer: ctx?.drawBaseLayer,
      requestApplyTexture: ctx?.requestApplyTexture,
      updateTransformUi: ctx?.updateTransformUi,
      onScaleChanged: ctx?.onScaleChanged,
    });
    try { event.preventDefault(); } catch (err) { warnSurfaceCanvas('prevent wheel default failed', err); }
  }), { passive: false });
  return true;
}
