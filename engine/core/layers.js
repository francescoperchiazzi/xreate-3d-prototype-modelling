function projectStateApi(ctx) {
  return ctx?.projectState || null;
}

function defaultTransform(base, ctx) {
  const api = projectStateApi(ctx);
  if (api && typeof api.createLayer === 'function') {
    return api.createLayer({ transform: base || null }).transform;
  }
  return {
    x: 0,
    y: 0,
    scale: 1,
    rot: 0,
    ratio: 1,
    tile: false,
    tileScale: 1,
    tileAnchor: 'center',
    tileRepeat: 'repeat',
    ...(base || {}),
  };
}

function ensureLayers(part, ensureLayersOnPart) {
  try { ensureLayersOnPart && ensureLayersOnPart(part); } catch (_) {}
  return Array.isArray(part?.layers) ? part.layers : [];
}

function syncProjectStore(ctx, reason, part, refs = null) {
  try {
    ctx?.projectStore?.sync?.(null, reason);
    ctx?.projectStore?.assertMirror?.(null, refs, reason);
  } catch (err) {
    console.error('[layers] project-store sync failed', { reason, partId: part?.id || null, err });
  }
}

export function getCurrentLayers(ctx) {
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return [];
  const api = projectStateApi(ctx);
  if (api && typeof api.getLayers === 'function') {
    try { return api.getLayers(part); } catch (_) {}
  }
  return ensureLayers(part, ctx?.ensureLayersOnPart || null);
}

export function getActiveLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  const layers = getCurrentLayers(ctx);
  if (!layers.length) return null;
  // The selected volume owns the active layer. Session refs are only a
  // rendering cache and can briefly lag behind a row click or canvas pick.
  const requested = Number.isFinite(part?.activeLayerIndex)
    ? part.activeLayerIndex
    : refs.activeLayerIndex;
  const idx = Math.max(0, Math.min(Number(requested) || 0, layers.length - 1));
  return layers[idx] || null;
}

function moveLinkedMaskWithTransform(layer, previous, next, ctx) {
  const points = Array.isArray(layer?.polygonMaskPoints) ? layer.polygonMaskPoints : null;
  if (layer?.maskLinked === false || !points || points.length < 3) return false;
  const fromTransform = ctx?.affineFromCanvasTransform || null;
  const invert = ctx?.affineInvert || null;
  const multiply = ctx?.affineMul || null;
  if (!fromTransform || !invert || !multiply) return false;
  try {
    const previousMatrix = fromTransform(previous);
    const nextMatrix = fromTransform(next);
    const inversePrevious = invert(previousMatrix);
    const delta = inversePrevious ? multiply(nextMatrix, inversePrevious) : null;
    if (!delta) return false;
    for (const point of points) {
      const x = (typeof point?.x === 'number' && isFinite(point.x)) ? point.x : 0;
      const y = (typeof point?.y === 'number' && isFinite(point.y)) ? point.y : 0;
      const nextX = delta.a * x + delta.c * y + delta.e;
      const nextY = delta.b * x + delta.d * y + delta.f;
      if (isFinite(nextX) && isFinite(nextY)) {
        point.x = nextX;
        point.y = nextY;
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}

function keepMaskedScaleAnchor(layer, previous, next, ctx) {
  const points = Array.isArray(layer?.polygonMaskPoints) ? layer.polygonMaskPoints : null;
  if (!points || points.length < 3 || previous.scale === next.scale) return false;
  const fromTransform = ctx?.affineFromCanvasTransform || null;
  const invert = ctx?.affineInvert || null;
  if (!fromTransform || !invert) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return false;
  try {
    const anchor = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const inversePrevious = invert(fromTransform(previous));
    const nextMatrix = fromTransform(next);
    if (!inversePrevious || !nextMatrix) return false;
    const localX = inversePrevious.a * anchor.x + inversePrevious.c * anchor.y + inversePrevious.e;
    const localY = inversePrevious.b * anchor.x + inversePrevious.d * anchor.y + inversePrevious.f;
    const nextX = nextMatrix.a * localX + nextMatrix.c * localY + nextMatrix.e;
    const nextY = nextMatrix.b * localX + nextMatrix.d * localY + nextMatrix.f;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return false;
    next.x = (Number(next.x) || 0) + anchor.x - nextX;
    next.y = (Number(next.y) || 0) + anchor.y - nextY;
    return true;
  } catch (_) {
    return false;
  }
}

export function commitActiveLayerTransform(ctx) {
  const refs = ctx?.refs || {};
  const getSelectedPart = ctx?.getSelectedPart || null;
  const markDirty = ctx?.markDirty || null;
  const part = getSelectedPart ? getSelectedPart() : null;
  const layers = getCurrentLayers({ getSelectedPart: () => part, ensureLayersOnPart: ctx?.ensureLayersOnPart, projectState: ctx?.projectState });
  if (!part || !layers.length) return false;
  const index = Math.max(0, Math.min(Number(part.activeLayerIndex) || 0, layers.length - 1));
  const layer = layers[index] || null;
  if (!layer) return false;
  const prev = defaultTransform(layer.transform, ctx);
  const next = defaultTransform(refs.imageTransform, ctx);
  keepMaskedScaleAnchor(layer, prev, next, ctx);
  try {
    const changed = (
      prev.x !== next.x ||
      prev.y !== next.y ||
      prev.scale !== next.scale ||
      prev.rot !== next.rot ||
      prev.ratio !== next.ratio ||
      prev.tile !== next.tile ||
      prev.tileScale !== next.tileScale ||
      prev.tileAnchor !== next.tileAnchor ||
      prev.tileRepeat !== next.tileRepeat
    );
    if (changed) {
      try { markDirty && markDirty(); } catch (_) {}
    }
  } catch (_) {}
  layer.transform = next;
  refs.imageTransform = { ...next };
  // Canvas gestures write to refs first and reach this path without going
  // through updateActiveLayerTransform, so preserve their linked masks here.
  moveLinkedMaskWithTransform(layer, prev, next, ctx);
  if (part) {
    part.imageTransform = { ...layer.transform };
    part.imageBitmap = layer.imageBitmap || null;
    part.activeLayerIndex = index;
    refs.activeLayerIndex = index;
    try { ctx?.editorStore?.syncSelectionShadow?.(part, { legacyTransform: refs.imageTransform }); } catch (err) { console.error('[layers] shadow-store sync failed', { partId: part.id, err }); }
    try {
      ctx?.projectStore?.sync?.(null, 'layer/commit-transform');
      ctx?.projectStore?.assertMirror?.(null, refs, 'layer/commit-transform');
    } catch (err) { console.error('[layers] project-store sync failed', { partId: part.id, err }); }
  }
  return true;
}

// The shell must not mutate its cached imageTransform object directly: selection
// can change between UI events. Resolve the selected part and layer at the
// command boundary, then replace the transform with a fresh object.
export function updateActiveLayerTransform(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) {
    debugEvent('layer.transform.skipped', { reason: 'no-selected-part' });
    return null;
  }
  const layers = getCurrentLayers({ getSelectedPart: () => part, ensureLayersOnPart: ctx?.ensureLayersOnPart, projectState: ctx?.projectState });
  if (!layers.length) {
    debugEvent('layer.transform.skipped', { reason: 'no-layers', partId: part.id });
    return null;
  }
  const index = Math.max(0, Math.min(Number(part.activeLayerIndex) || 0, layers.length - 1));
  const layer = layers[index];
  const patch = (ctx?.patch && typeof ctx.patch === 'object') ? ctx.patch : {};
  const previous = defaultTransform(layer.transform, ctx);
  const next = defaultTransform({ ...previous, ...patch }, ctx);
  keepMaskedScaleAnchor(layer, previous, next, ctx);
  moveLinkedMaskWithTransform(layer, previous, next, ctx);
  layer.transform = next;
  part.imageTransform = { ...next };
  part.activeLayerIndex = index;
  refs.activeLayerIndex = index;
  refs.imageTransform = { ...next };
  refs.imageBitmap = layer.imageBitmap || null;
  try { ctx?.editorStore?.syncSelectionShadow?.(part, { legacyTransform: refs.imageTransform }); } catch (err) { console.error('[layers] shadow-store update failed', { partId: part.id, err }); }
  try {
    ctx?.projectStore?.sync?.(null, 'layer/update-transform');
    ctx?.projectStore?.assertMirror?.(null, refs, 'layer/update-transform');
  } catch (err) { console.error('[layers] project-store update sync failed', { partId: part.id, err }); }
  debugEvent('layer.transform.updated', { partId: part.id, layerId: layer.id || null, index, patch, transform: refs.imageTransform });
  return refs.imageTransform;
}

export function syncVisibleToSelectedPart(ctx) {
  const refs = ctx?.refs || {};
  const getSelectedPart = ctx?.getSelectedPart || null;
  const ensureLayersOnPart = ctx?.ensureLayersOnPart || null;
  const commit = ctx?.commitActiveLayerTransform || null;
  const part = getSelectedPart ? getSelectedPart() : null;
  if (!part) return false;
  try { ensureLayersOnPart && ensureLayersOnPart(part); } catch (_) {}
  try {
    if (typeof commit === 'function') commit();
    else commitActiveLayerTransform(ctx);
  } catch (_) {}
  part.activeLayerIndex = Number.isFinite(refs.activeLayerIndex) ? refs.activeLayerIndex : 0;
  part.selectedIslandId = null;
  syncProjectStore(ctx, 'layer/sync-visible', part, refs);
  return true;
}

export function setActiveLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) {
    debugEvent('layer.select.skipped', { reason: 'no-selected-part' });
    return false;
  }
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  if (!layers.length) {
    refs.activeLayerIndex = 0;
    part.activeLayerIndex = 0;
    refs.imageBitmap = null;
    refs.imageTransform = defaultTransform(null, ctx);
    try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
    try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
    try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
    syncProjectStore(ctx, 'layer/set-active-empty', part, refs);
    return true;
  }
  const nextIdx = (api && typeof api.setActiveLayerIndex === 'function')
    ? api.setActiveLayerIndex(part, ctx?.idx)
    : Math.max(0, Math.min(ctx?.idx || 0, layers.length - 1));
  const clampedNext = Number.isFinite(nextIdx) ? Math.max(0, Math.min(nextIdx, layers.length - 1)) : 0;
  refs.activeLayerIndex = clampedNext;
  part.activeLayerIndex = clampedNext;
  const layer = layers[clampedNext] || null;
  refs.imageBitmap = layer ? (layer.imageBitmap || null) : null;
  refs.imageTransform = defaultTransform(layer?.transform, ctx);
  try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
  try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
  try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
  try { ctx.hydrateLayerBitmapIfNeeded && ctx.hydrateLayerBitmapIfNeeded(layer, part); } catch (_) {}
  syncProjectStore(ctx, 'layer/set-active', part, refs);
  debugEvent('layer.select.success', { partId: part.id, index: clampedNext, layerId: layer?.id || null, layerCount: layers.length });
  return true;
}

export function toggleLayerVisibility(ctx) {
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  const layer = layers[ctx?.idx] || null;
  if (!layer) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      if (api && typeof api.toggleLayerVisibility === 'function') api.toggleLayerVisibility(part, ctx.idx);
      else layer.visible = !layer.visible;
      try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
      try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/toggle-visibility', part, ctx?.refs || null);
    });
  } catch (_) {}
  return true;
}

export function clearLayerPolygonMask(ctx) {
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  const layer = layers[ctx?.idx] || null;
  if (!layer) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      if (api && typeof api.clearLayerPolygonMask === 'function') api.clearLayerPolygonMask(part, ctx.idx);
      else layer.polygonMaskPoints = null;
      try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
      try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/clear-polygon-mask', part, ctx?.refs || null);
    });
  } catch (_) {}
  return true;
}

export function duplicateLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  const src = layers[ctx?.idx] || null;
  if (!src) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      const dataUrl = src.imageDataUrl || (ctx.imageBitmapToPngDataUrlForSave ? ctx.imageBitmapToPngDataUrlForSave(src.imageBitmap || null) : null);
      if (api && typeof api.duplicateLayer === 'function') {
        api.duplicateLayer(part, ctx.idx, {
          label: `${String(src.label || `Layer ${ctx.idx + 1}`)} copy`,
          imageDataUrl: dataUrl || null,
        });
      } else {
        layers.push({
          id: String(Date.now()),
          label: `${String(src.label || `Layer ${ctx.idx + 1}`)} copy`,
          imageBitmap: src.imageBitmap || null,
          imageDataUrl: dataUrl || null,
          transform: defaultTransform(src.transform, ctx),
          visible: !(src.visible === false),
          clippingIslandId: src.clippingIslandId || null,
          polygonMaskPoints: Array.isArray(src.polygonMaskPoints) ? src.polygonMaskPoints.map((p) => ({ x: p.x, y: p.y })) : null,
          maskLinked: !(src.maskLinked === false),
          opacity: (typeof src.opacity === 'number') ? src.opacity : 1.0,
          blendMode: src.blendMode || 'source-over',
        });
        part.activeLayerIndex = layers.length - 1;
      }
      refs.activeLayerIndex = part.activeLayerIndex || (layers.length - 1);
      try { ctx.setActiveLayer && ctx.setActiveLayer(refs.activeLayerIndex); } catch (_) {}
      try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
      try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/duplicate', part, refs);
    });
  } catch (_) {}
  return true;
}

export function renameLayer(ctx) {
  const part = ctx?.part || null;
  const api = projectStateApi(ctx);
  if (!part) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      if (api && typeof api.renameLayer === 'function') api.renameLayer(part, ctx.idx, ctx.name);
      else {
        const layer = (part.layers || [])[ctx.idx] || null;
        if (!layer) return;
        const next = String(ctx.name || '').trim();
        if (next) layer.label = next;
        else delete layer.label;
      }
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/rename', part, ctx?.refs || null);
    });
  } catch (_) {}
  return true;
}

export function deleteLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  if (ctx?.idx < 0 || ctx?.idx >= layers.length) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      if (api && typeof api.deleteLayer === 'function') api.deleteLayer(part, ctx.idx);
      else layers.splice(ctx.idx, 1);
      refs.activeLayerIndex = (api && typeof api.getActiveLayerIndex === 'function')
        ? api.getActiveLayerIndex(part)
        : (layers.length ? Math.max(0, Math.min(refs.activeLayerIndex || 0, layers.length - 1)) : 0);
      try { ctx.setActiveLayer && ctx.setActiveLayer(refs.activeLayerIndex); } catch (_) {}
      try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
      try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/delete', part, refs);
    });
  } catch (_) {}
  return true;
}

export function moveLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  const layers = (api && typeof api.getLayers === 'function')
    ? api.getLayers(part)
    : ensureLayers(part, ctx?.ensureLayersOnPart || null);
  const target = ctx?.idx + ctx?.delta;
  if (ctx?.idx < 0 || ctx?.idx >= layers.length) return false;
  if (target < 0 || target >= layers.length) return false;
  try {
    ctx.mutateProject && ctx.mutateProject(() => {
      if (api && typeof api.moveLayer === 'function') api.moveLayer(part, ctx.idx, ctx.delta);
      else {
        const tmp = layers[ctx.idx];
        layers[ctx.idx] = layers[target];
        layers[target] = tmp;
        if ((refs.activeLayerIndex || 0) === ctx.idx) refs.activeLayerIndex = target;
        else if ((refs.activeLayerIndex || 0) === target) refs.activeLayerIndex = ctx.idx;
        part.activeLayerIndex = refs.activeLayerIndex || 0;
      }
      refs.activeLayerIndex = (api && typeof api.getActiveLayerIndex === 'function')
        ? api.getActiveLayerIndex(part)
        : refs.activeLayerIndex;
      try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
      try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
      try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
      syncProjectStore(ctx, 'layer/move', part, refs);
    });
  } catch (_) {}
  return true;
}

export function addImageAsLayer(ctx) {
  const refs = ctx?.refs || {};
  const part = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  if (!part) return false;
  const api = projectStateApi(ctx);
  try {
    ctx.ensureLayersOnPart && ctx.ensureLayersOnPart(part);
  } catch (_) {}
  let index = 0;
  let layer = null;
  if (api && typeof api.addLayer === 'function') {
    const result = api.addLayer(part, {
      label: `Layer ${(part.layers?.length || 0) + 1}`,
      imageBitmap: ctx.bmp || null,
      imageDataUrl: ctx.dataUrl || null,
      transform: defaultTransform(null, ctx),
    });
    layer = result?.layer || null;
    index = result?.index || 0;
  } else {
    if (!Array.isArray(part.layers)) part.layers = [];
    layer = {
      id: String(Date.now()),
      label: `Layer ${part.layers.length + 1}`,
      imageBitmap: ctx.bmp || null,
      imageDataUrl: ctx.dataUrl || null,
      transform: defaultTransform(null, ctx),
      visible: true,
      clippingIslandId: null,
      polygonMaskPoints: null,
      maskLinked: true,
      opacity: 1,
      blendMode: 'source-over',
    };
    part.layers.push(layer);
    index = part.layers.length - 1;
    part.activeLayerIndex = index;
  }
  refs.activeLayerIndex = index;
  refs.imageBitmap = layer?.imageBitmap || null;
  refs.imageTransform = defaultTransform(layer?.transform, ctx);
  try { ctx.updateTransformUi && ctx.updateTransformUi(); } catch (_) {}
  try { ctx.syncImageSliderControlsFromTransform && ctx.syncImageSliderControlsFromTransform(); } catch (_) {}
  try { ctx.drawBaseLayer && ctx.drawBaseLayer(); } catch (_) {}
  try { ctx.requestApplyTexture && ctx.requestApplyTexture(true); } catch (_) {}
  try { ctx.renderLayerListUI && ctx.renderLayerListUI(); } catch (_) {}
  try { ctx.markDirty && ctx.markDirty(); } catch (_) {}
  syncProjectStore(ctx, 'layer/add-image', part, refs);
  return true;
}
import { event as debugEvent } from '../debug/event-log.js';
