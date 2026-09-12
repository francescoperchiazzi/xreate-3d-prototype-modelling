const runtimeState = {
  textureApplyRaf: 0,
  textureApplySilent: true,
  textureApplyCtx: null,
};

let configured = null;

function defaultTransform(transform) {
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
    ...(transform || {}),
  };
}

export function configure(ctx) {
  configured = (ctx && typeof ctx === 'object') ? ctx : null;
  return configured;
}

function prepareCtx(ctx) {
  const base = configured;
  if (!base) return { merged: ctx || null, base: null };
  try { base.syncRefsFromHost && base.syncRefsFromHost(); } catch (_) {}
  const merged = { ...(base || {}), ...(ctx || {}) };
  const runtimeRefs = (base.refs && typeof base.refs === 'object') ? base.refs : ((ctx && ctx.refs) || {});
  if (ctx && ctx.refs && runtimeRefs !== ctx.refs) {
    try { Object.assign(runtimeRefs, ctx.refs); } catch (_) {}
  }
  merged.refs = runtimeRefs;
  return { merged, base };
}

function finalizeCtx(base) {
  if (!base) return;
  try { base.syncHostFromRefs && base.syncHostFromRefs(); } catch (_) {}
}

export function drawLayerBitmapToCtx(ctx) {
  const layer = arguments[1];
  const opts = arguments[2] || {};
  if (!ctx || !layer || !layer.imageBitmap) return false;
  const CANVAS_SIZE = Number(opts.canvasSize) || 1024;
  const documentRef = opts.document || document;
  ctx.save();
  const t = defaultTransform(layer.transform);
  const cx = CANVAS_SIZE / 2 + (t.x || 0);
  const cy = CANVAS_SIZE / 2 + (t.y || 0);
  ctx.translate(cx, cy);
  ctx.rotate(((t.rot || 0) * Math.PI) / 180);
  const s = (typeof t.scale === 'number' && isFinite(t.scale)) ? t.scale : 1;
  const ratio = (typeof t.ratio === 'number' && isFinite(t.ratio)) ? t.ratio : 1;
  const tileOn = !!t.tile;
  const tileScale = (typeof t.tileScale === 'number' && isFinite(t.tileScale)) ? t.tileScale : 1;
  const tileAnchor = (t.tileAnchor === 'topleft' || t.tileAnchor === 'top-left') ? 'topleft' : 'center';
  const tileRepeat = (t.tileRepeat === 'mirror') ? 'mirror' : 'repeat';
  const sx = (tileOn ? (s * tileScale) : s) * ratio;
  const sy = tileOn ? (s * tileScale) : s;
  ctx.scale(sx, sy);
  ctx.imageSmoothingEnabled = true;
  const w = layer.imageBitmap.width;
  const h = layer.imageBitmap.height;
  if (tileOn) {
    let src = layer.imageBitmap;
    if (tileRepeat === 'mirror') {
      if (!layer._tileMirrorCanvas) layer._tileMirrorCanvas = documentRef.createElement('canvas');
      const c = layer._tileMirrorCanvas;
      const needW = w * 2;
      const needH = h * 2;
      if (c.width !== needW) c.width = needW;
      if (c.height !== needH) c.height = needH;
      if (c.width === needW && c.height === needH) {
        const cctx = c.getContext('2d');
        if (cctx) {
          cctx.setTransform(1, 0, 0, 1, 0, 0);
          cctx.clearRect(0, 0, needW, needH);
          cctx.drawImage(layer.imageBitmap, 0, 0, w, h);
          cctx.save(); cctx.translate(needW, 0); cctx.scale(-1, 1); cctx.drawImage(layer.imageBitmap, 0, 0, w, h); cctx.restore();
          cctx.save(); cctx.translate(0, needH); cctx.scale(1, -1); cctx.drawImage(layer.imageBitmap, 0, 0, w, h); cctx.restore();
          cctx.save(); cctx.translate(needW, needH); cctx.scale(-1, -1); cctx.drawImage(layer.imageBitmap, 0, 0, w, h); cctx.restore();
          src = c;
        }
      }
    }
    const pattern = ctx.createPattern(src, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      if (tileAnchor === 'topleft') ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);
      else ctx.translate(-w / 2, -h / 2);
      ctx.fillRect(-CANVAS_SIZE * 2, -CANVAS_SIZE * 2, CANVAS_SIZE * 4, CANVAS_SIZE * 4);
    } else {
      ctx.drawImage(layer.imageBitmap, -w / 2, -h / 2, w, h);
    }
  } else {
    ctx.drawImage(layer.imageBitmap, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
  return true;
}

export function drawBaseLayer(ctx) {
  const refs = ctx?.refs || {};
  const baseCtx = ctx?.baseCtx || null;
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;
  if (!baseCtx) return false;
  baseCtx.save();
  baseCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const sel = ctx?.getSelectedPart ? ctx.getSelectedPart() : null;
  const project = ctx?.getProject ? ctx.getProject() : null;
  const wantsAlphaBg = !!(sel && sel.type === 'plane' && project && project.textureMode !== 'shared');
  if (!wantsAlphaBg) {
    baseCtx.fillStyle = ctx?.editorBg || '#000';
    baseCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  const layers = ctx?.getCurrentLayers ? ctx.getCurrentLayers() : [];
  for (const layer of layers) {
    if (!layer || layer.visible === false || !layer.imageBitmap) continue;
    const pts = Array.isArray(layer?.polygonMaskPoints) ? layer.polygonMaskPoints : null;
    const hasPolyMask = !!(pts && pts.length >= 3);
    if (hasPolyMask) {
      if (!refs.maskTmpCanvas) {
        refs.maskTmpCanvas = (ctx?.document || document).createElement('canvas');
        refs.maskTmpCanvas.width = CANVAS_SIZE;
        refs.maskTmpCanvas.height = CANVAS_SIZE;
        refs.maskTmpCtx = refs.maskTmpCanvas.getContext('2d');
      }
      if (!refs.maskTmpCtx) continue;
      refs.maskTmpCtx.save();
      refs.maskTmpCtx.setTransform(1, 0, 0, 1, 0, 0);
      refs.maskTmpCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      refs.maskTmpCtx.globalCompositeOperation = 'source-over';
      refs.maskTmpCtx.fillStyle = '#fff';
      refs.maskTmpCtx.beginPath();
      refs.maskTmpCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) refs.maskTmpCtx.lineTo(pts[i].x, pts[i].y);
      refs.maskTmpCtx.closePath();
      refs.maskTmpCtx.fill();
      refs.maskTmpCtx.globalCompositeOperation = 'source-in';
      refs.maskTmpCtx.save();
      drawLayerBitmapToCtx(refs.maskTmpCtx, layer, { canvasSize: CANVAS_SIZE, document: ctx?.document || document });
      refs.maskTmpCtx.restore();
      refs.maskTmpCtx.restore();

      baseCtx.save();
      baseCtx.globalAlpha = (typeof layer.opacity === 'number') ? layer.opacity : 1.0;
      baseCtx.globalCompositeOperation = layer.blendMode || 'source-over';
      baseCtx.drawImage(refs.maskTmpCanvas, 0, 0);
      baseCtx.restore();
      continue;
    }
    baseCtx.save();
    baseCtx.globalAlpha = (typeof layer.opacity === 'number') ? layer.opacity : 1.0;
    baseCtx.globalCompositeOperation = layer.blendMode || 'source-over';
    drawLayerBitmapToCtx(baseCtx, layer, { canvasSize: CANVAS_SIZE, document: ctx?.document || document });
    baseCtx.restore();
  }
  baseCtx.restore();
  refs.baseLayerRevision = (Number(refs.baseLayerRevision) || 0) + 1;
  if (project) project._baseLayerRevision = refs.baseLayerRevision;
  return true;
}

export function updateComposite(ctx) {
  const compositeCtx = ctx?.compositeCtx || null;
  const baseCanvas = ctx?.baseCanvas || null;
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;
  if (!compositeCtx || !baseCanvas) return false;
  compositeCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  compositeCtx.drawImage(baseCanvas, 0, 0);
  return true;
}

export function partHasAnyVisibleLayerImage(part) {
  if (!part) return false;
  const layers = Array.isArray(part.layers) ? part.layers : [];
  for (const l of layers) {
    if (!l || l.visible === false) continue;
    if (l.imageBitmap) return true;
  }
  return !!part.imageBitmap;
}

export function ensureSrgbTexture(ctx) {
  const tex = ctx?.texture || null;
  if (!tex) return false;
  const THREE = ctx?.THREE || window.THREE;
  const renderer = ctx?.renderer || null;
  try {
    if ('colorSpace' in tex && 'SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    if ('LinearMipmapLinearFilter' in THREE) {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
    }
    const maxAniso = (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 0;
    if (maxAniso > 0) tex.anisotropy = Math.min(8, maxAniso);
    tex.needsUpdate = true;
  } catch (_) {}
  return true;
}

export function applyTexture(ctx) {
  const prepared = prepareCtx(ctx);
  const nextCtx = prepared.merged || ctx || {};
  try {
    const refs = nextCtx?.refs || {};
    const currentMesh = nextCtx?.getCurrentMesh ? nextCtx.getCurrentMesh() : null;
    const project = nextCtx?.getProject ? nextCtx.getProject() : null;
    if (!currentMesh) return false;
    const ctxMarkedPartId = nextCtx && nextCtx.__markSelectedPartId != null ? String(nextCtx.__markSelectedPartId) : null;
    const livePart = nextCtx?.getSelectedPart ? nextCtx.getSelectedPart() : null;
    const livePartId = livePart ? String(livePart.id) : null;
    if (ctxMarkedPartId != null && ctxMarkedPartId !== livePartId) {
      return false;
    }
    updateComposite(nextCtx);
    const part = livePart;
    const shapeList = nextCtx?.getShapeList ? nextCtx.getShapeList() : [];
    const hasAnyImage = (project && project.textureMode === 'shared')
      ? shapeList.some((p) => partHasAnyVisibleLayerImage(p))
      : partHasAnyVisibleLayerImage(part);
    if (!hasAnyImage) {
      if (project && project.textureMode === 'shared') {
        for (const p of shapeList) {
          if (p && p._mesh && p._mesh.material) {
            p._mesh.material.map = null;
            p._mesh.material.needsUpdate = true;
          }
        }
      } else if (currentMesh.material) {
        currentMesh.material.map = null;
        currentMesh.material.needsUpdate = true;
      }
      try { nextCtx.syncVisibleToSelectedPart && nextCtx.syncVisibleToSelectedPart(); } catch (_) {}
      try { nextCtx.updateUVPreview && nextCtx.updateUVPreview(); } catch (_) {}
      if (!nextCtx?.silent) {
        try { nextCtx.setStatusKey && nextCtx.setStatusKey('status_texture_applied', 'ok'); } catch (_) {}
        setTimeout(() => { try { nextCtx.setStatus && nextCtx.setStatus('', ''); } catch (_) {} }, 2000);
      }
      return true;
    }
    const THREE = nextCtx?.THREE || window.THREE;
    if (project && project.textureMode === 'shared') {
      if (!project._sharedTexture) {
        project._sharedTexture = new THREE.CanvasTexture(nextCtx.compositeCanvas);
        ensureSrgbTexture({ texture: project._sharedTexture, THREE, renderer: nextCtx?.renderer || null });
      } else project._sharedTexture.needsUpdate = true;
      refs.drawingTexture = project._sharedTexture;
      for (const p of shapeList) {
        if (p && p._mesh && p._mesh.material) {
          p._mesh.material.map = refs.drawingTexture;
        try { nextCtx.applyMaterialFlagsForPart && nextCtx.applyMaterialFlagsForPart(p, p._mesh.material); } catch (err) { console.error('[texture] applying shared material flags failed', { partId: p.id, err }); }
          p._mesh.material.needsUpdate = true;
        }
        if (p && p._compositeCtx && p._compositeCanvas) {
          try {
            p._compositeCtx.clearRect(0, 0, nextCtx.canvasSize, nextCtx.canvasSize);
            p._compositeCtx.drawImage(nextCtx.compositeCanvas, 0, 0);
          } catch (_) {}
        }
      }
    } else if (part) {
      if (part._compositeCtx && part._compositeCanvas) {
        part._compositeCtx.clearRect(0, 0, nextCtx.canvasSize, nextCtx.canvasSize);
        part._compositeCtx.drawImage(nextCtx.compositeCanvas, 0, 0);
      }
      if (!part._texture) {
        part._texture = new THREE.CanvasTexture(part._compositeCanvas || nextCtx.compositeCanvas);
        ensureSrgbTexture({ texture: part._texture, THREE, renderer: nextCtx?.renderer || null });
      } else part._texture.needsUpdate = true;
      refs.drawingTexture = part._texture;
      if (currentMesh.material) {
        currentMesh.material.map = refs.drawingTexture;
        try { nextCtx.applyMaterialFlagsForPart && nextCtx.applyMaterialFlagsForPart(part, currentMesh.material); } catch (err) { console.error('[texture] applying material flags failed', { partId: part.id, err }); }
        currentMesh.material.needsUpdate = true;
      }
    } else {
      if (!refs.drawingTexture) {
        refs.drawingTexture = new THREE.CanvasTexture(nextCtx.compositeCanvas);
        ensureSrgbTexture({ texture: refs.drawingTexture, THREE, renderer: nextCtx?.renderer || null });
      } else refs.drawingTexture.needsUpdate = true;
      if (currentMesh.material) {
        currentMesh.material.map = refs.drawingTexture;
        try { nextCtx.applyMaterialFlagsForPart && nextCtx.applyMaterialFlagsForPart(part, currentMesh.material); } catch (err) { console.error('[texture] refreshing material flags failed', { partId: part.id, err }); }
        currentMesh.material.needsUpdate = true;
      }
    }
    try { nextCtx.syncVisibleToSelectedPart && nextCtx.syncVisibleToSelectedPart(); } catch (_) {}
    try { nextCtx.updateUVPreview && nextCtx.updateUVPreview(); } catch (_) {}
    try { nextCtx.markViewportDirty && nextCtx.markViewportDirty(30); } catch (_) {}
    if (!nextCtx?.silent) {
      try { nextCtx.setStatusKey && nextCtx.setStatusKey('status_texture_applied', 'ok'); } catch (_) {}
      setTimeout(() => { try { nextCtx.setStatus && nextCtx.setStatus('', ''); } catch (_) {} }, 2000);
    }
    return true;
  } finally {
    finalizeCtx(prepared.base);
  }
}

export function requestApplyTexture(ctx) {
  const prepared = prepareCtx(ctx);
  const nextCtx = prepared.merged || ctx || {};
  const nextMarkedId = (() => {
    try {
      const sp = nextCtx?.getSelectedPart ? nextCtx.getSelectedPart() : null;
      return sp ? String(sp.id) : null;
    } catch (_) { return null; }
  })();
  nextCtx.__markSelectedPartId = nextMarkedId;
  runtimeState.textureApplySilent = !!(runtimeState.textureApplySilent && nextCtx?.silent);
  const prevMarkedId = runtimeState.textureApplyCtx && runtimeState.textureApplyCtx.__markSelectedPartId != null
    ? String(runtimeState.textureApplyCtx.__markSelectedPartId)
    : null;
  const selectedPartChanged = prevMarkedId != null && nextMarkedId != null && prevMarkedId !== nextMarkedId;
  if (!runtimeState.textureApplyCtx || selectedPartChanged) {
    runtimeState.textureApplyCtx = nextCtx;
  } else {
    runtimeState.textureApplyCtx = {
      ...runtimeState.textureApplyCtx,
      ...nextCtx,
      refs: nextCtx?.refs || runtimeState.textureApplyCtx.refs || {},
      __markSelectedPartId: nextMarkedId,
    };
  }
  finalizeCtx(prepared.base);
  if (runtimeState.textureApplyRaf) return false;
  runtimeState.textureApplyRaf = requestAnimationFrame(() => {
    runtimeState.textureApplyRaf = 0;
    const silent = runtimeState.textureApplySilent;
    runtimeState.textureApplySilent = true;
    const next = runtimeState.textureApplyCtx || {};
    runtimeState.textureApplyCtx = null;
    applyTexture({ ...next, silent });
  });
  return true;
}
