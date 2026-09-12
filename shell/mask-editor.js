// Responsibility: own the polygon mask modal, canvas rendering, and mask interaction bindings.
// Reads from: DOM and callbacks passed from the legacy runtime.
// Writes to: mask modal DOM state, in-memory polygon points, and selected layer mask data.
// Exposes to: window.XR.__modules.ShellMaskEditor

const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const CANVAS_SIZE = (opts && typeof opts.CANVAS_SIZE === 'number') ? opts.CANVAS_SIZE : 1024;
  const getEditorBg = (opts && typeof opts.getEditorBg === 'function') ? opts.getEditorBg : (() => '#000000');
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const ensureLayersOnPart = (opts && typeof opts.ensureLayersOnPart === 'function') ? opts.ensureLayersOnPart : (() => {});
  const getIslandsForUvMode = (opts && typeof opts.getIslandsForUvMode === 'function') ? opts.getIslandsForUvMode : (() => []);
  const getSelectedIslandId = (opts && typeof opts.getSelectedIslandId === 'function') ? opts.getSelectedIslandId : (() => null);
  const drawLayerBitmapToCtx = (opts && typeof opts.drawLayerBitmapToCtx === 'function') ? opts.drawLayerBitmapToCtx : (() => {});
  const openModal = (opts && typeof opts.openModal === 'function') ? opts.openModal : null;
  const closeModal = (opts && typeof opts.closeModal === 'function') ? opts.closeModal : null;
  const mutateProject = (opts && typeof opts.mutateProject === 'function') ? opts.mutateProject : ((fn) => { if (typeof fn === 'function') fn(); });
  const drawBaseLayer = (opts && typeof opts.drawBaseLayer === 'function') ? opts.drawBaseLayer : (() => {});
  const renderUvOverlay = (opts && typeof opts.renderUvOverlay === 'function') ? opts.renderUvOverlay : (() => {});
  const requestApplyTexture = (opts && typeof opts.requestApplyTexture === 'function') ? opts.requestApplyTexture : (() => {});
  const renderLayerListUI = (opts && typeof opts.renderLayerListUI === 'function') ? opts.renderLayerListUI : (() => {});

  const state = {
    maskReturnFocusEl: null,
    maskModalState: null,
    editingLayerIndex: -1,
    panX: 0,
    panY: 0,
    zoom: 1,
    panning: false,
    moved: false,
    prevX: 0,
    prevY: 0,
    points: [],
    dragPointIndex: -1,
    dragRect: null,
    dragSx: 1,
    dragSy: 1,
    toolMode: 'edit',
    dragMode: '',
    undoStack: [],
    baseDiag: 0,
    scaleStart: null,
    activePointerId: null,
    touchPointers: new Map(),
    pinchActive: false,
    pinchKind: '',
    pinchStartDistance: 0,
    pinchStartMidpoint: null,
    pinchStartTexturePoint: null,
    pinchStartZoom: 1,
    pinchStartPoints: null,
    pinchCenter: null,
  };

  function getCanvasEl() {
    return document.getElementById('maskCanvas');
  }

  function getCanvasCtx() {
    const canvas = getCanvasEl();
    if (!canvas) return null;
    try {
      return canvas.getContext('2d');
    } catch (_) {
      return null;
    }
  }

  // Mask coordinates are authored in the 1024px texture space whereas the
  // modal preview is 720×520px.  Starting at 1:1 cropped the source by design
  // and forced users to zoom out/in before they could inspect a complete UV.
  function fitMaskView() {
    const canvas = getCanvasEl();
    if (!canvas) return;
    // The visible modal canvas can be reduced by browser chrome and its tool
    // rows after the drawing buffer has been sized. Keep a generous inset so
    // the first fit always shows the whole image instead of maximizing it.
    const padding = Math.max(48, Math.floor(Math.min(canvas.width, canvas.height) * 0.12));
    const availableWidth = Math.max(1, canvas.width - padding * 2);
    const availableHeight = Math.max(1, canvas.height - padding * 2);
    const part = getSelectedPart();
    const layer = (part && Array.isArray(part.layers) && state.editingLayerIndex >= 0)
      ? part.layers[state.editingLayerIndex]
      : null;
    if (layer?.imageBitmap?.width && layer?.imageBitmap?.height) {
      // Fit the rendered image bounds, rather than the 1024px technical UV
      // canvas. The old calculation centred the UV canvas, which left a
      // transformed rectangular image apparently too low and cropped.
      const transform = layer.transform || {};
      const scale = Math.max(0.0001, Number(transform.scale) || 1);
      const ratio = Math.max(0.0001, Number(transform.ratio) || 1);
      const radians = (Number(transform.rot) || 0) * Math.PI / 180;
      const imageWidth = layer.imageBitmap.width * scale * ratio;
      const imageHeight = layer.imageBitmap.height * scale;
      const boundWidth = Math.abs(imageWidth * Math.cos(radians)) + Math.abs(imageHeight * Math.sin(radians));
      const boundHeight = Math.abs(imageWidth * Math.sin(radians)) + Math.abs(imageHeight * Math.cos(radians));
      state.zoom = Math.min(1, availableWidth / Math.max(1, boundWidth), availableHeight / Math.max(1, boundHeight));
      const centerX = CANVAS_SIZE / 2 + (Number(transform.x) || 0);
      const centerY = CANVAS_SIZE / 2 + (Number(transform.y) || 0);
      state.panX = canvas.width / 2 - centerX * state.zoom;
      state.panY = canvas.height / 2 - centerY * state.zoom;
    } else {
      state.zoom = Math.min(1, availableWidth / CANVAS_SIZE, availableHeight / CANVAS_SIZE);
      state.panX = (canvas.width - CANVAS_SIZE * state.zoom) / 2;
      state.panY = (canvas.height - CANVAS_SIZE * state.zoom) / 2;
    }
    updateMaskViewUi();
  }

  // The modal's flex layout reaches its final canvas size only after it is
  // visible. Fitting again on the next two frames prevents a first-open crop
  // when toolbars or browser chrome changed the available preview area.
  function fitMaskViewAfterOpen(layerIndex) {
    const fitAndRender = () => {
      if (state.editingLayerIndex !== layerIndex) return;
      fitMaskView();
      renderPolygonMaskEditor();
    };
    fitAndRender();
    const raf = (typeof window !== 'undefined') ? window.requestAnimationFrame : null;
    if (typeof raf !== 'function') return;
    raf(() => raf(fitAndRender));
  }

  function updateMaskViewUi() {
    const el = document.getElementById('maskViewZoomVal');
    if (el) el.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  // This zoom changes only the modal preview. It deliberately does not touch
  // layer transforms or polygon coordinates, which remain in texture space.
  function zoomMaskView(factor) {
    const canvas = getCanvasEl();
    if (!canvas) return;
    const oldZoom = Math.max(0.0001, state.zoom);
    const nextZoom = Math.max(0.2, Math.min(6.0, oldZoom * factor));
    if (nextZoom === oldZoom) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const textureAtCenter = maskScreenToTex(centerX, centerY);
    state.zoom = nextZoom;
    state.panX = centerX - textureAtCenter.x * nextZoom;
    state.panY = centerY - textureAtCenter.y * nextZoom;
    updateMaskViewUi();
    renderPolygonMaskEditor();
  }

  function getModalEl() {
    return document.getElementById('maskModal');
  }

  function cloneMaskPoints(pts) {
    if (!Array.isArray(pts)) return [];
    return pts.map((p) => ({ x: p.x, y: p.y }));
  }

  function getMaskBounds(pts) {
    if (!Array.isArray(pts) || !pts.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      const x = (p && typeof p.x === 'number' && isFinite(p.x)) ? p.x : 0;
      const y = (p && typeof p.y === 'number' && isFinite(p.y)) ? p.y : 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
  }

  function maskDiagFromPoints(pts) {
    const b = getMaskBounds(pts);
    if (!b) return 0;
    const dx = b.maxX - b.minX;
    const dy = b.maxY - b.minY;
    const d = Math.sqrt(dx * dx + dy * dy);
    return (isFinite(d) && d > 0) ? d : 0;
  }

  function maskGetPointerPos(e) {
    const canvas = getCanvasEl();
    if (!canvas) return { x: 0, y: 0 };
    const r = (state.panning && state.dragRect) ? state.dragRect : canvas.getBoundingClientRect();
    const sx = (state.panning && state.dragRect) ? state.dragSx : ((r.width > 0) ? (canvas.width / r.width) : 1);
    const sy = (state.panning && state.dragRect) ? state.dragSy : ((r.height > 0) ? (canvas.height / r.height) : 1);
    return {
      x: (e.clientX - r.left) * sx,
      y: (e.clientY - r.top) * sy,
    };
  }

  function rememberMaskTouch(e) {
    if (!e || e.pointerType !== 'touch' || e.pointerId === undefined) return 0;
    state.touchPointers.set(String(e.pointerId), { x: e.clientX, y: e.clientY });
    return state.touchPointers.size;
  }

  function forgetMaskTouch(e) {
    if (!e || e.pointerType !== 'touch' || e.pointerId === undefined) return state.touchPointers.size;
    state.touchPointers.delete(String(e.pointerId));
    return state.touchPointers.size;
  }

  function maskTouchPair() {
    const pts = Array.from(state.touchPointers.values());
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
  }

  function maskTouchDistance() {
    const pair = maskTouchPair();
    if (!pair) return 0;
    const dx = pair[1].x - pair[0].x;
    const dy = pair[1].y - pair[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function maskTouchMidpoint() {
    const pair = maskTouchPair();
    if (!pair) return null;
    return { x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 };
  }

  function resetMaskPinch() {
    state.pinchActive = false;
    state.pinchKind = '';
    state.pinchStartDistance = 0;
    state.pinchStartMidpoint = null;
    state.pinchStartTexturePoint = null;
    state.pinchStartZoom = state.zoom;
    state.pinchStartPoints = null;
    state.pinchCenter = null;
  }

  function clearMaskDrag() {
    state.panning = false;
    state.moved = false;
    state.activePointerId = null;
    state.dragPointIndex = -1;
    state.dragMode = '';
    state.scaleStart = null;
    state.dragRect = null;
    state.dragSx = 1;
    state.dragSy = 1;
  }

  // Pinching has a direct meaning in Select: resize the finished mask around
  // its centre. In Edit it instead zooms the view, preserving the authored
  // polygon. Both behaviours keep the midpoint under the fingers.
  function beginMaskPinch(canvas) {
    const distance = maskTouchDistance();
    const midpoint = maskTouchMidpoint();
    if (!distance || !midpoint) return false;
    const rect = canvas?.getBoundingClientRect?.() || null;
    const sx = (canvas?.width && rect?.width) ? (canvas.width / rect.width) : 1;
    const sy = (canvas?.height && rect?.height) ? (canvas.height / rect.height) : 1;
    const screenMidpoint = {
      x: (midpoint.x - (rect?.left || 0)) * sx,
      y: (midpoint.y - (rect?.top || 0)) * sy,
    };
    state.pinchActive = true;
    state.pinchStartDistance = distance;
    state.pinchStartMidpoint = screenMidpoint;
    state.pinchStartZoom = state.zoom;
    state.pinchStartTexturePoint = maskScreenToTex(screenMidpoint.x, screenMidpoint.y);
    state.panning = false;
    state.moved = true;
    state.dragMode = 'pinch';
    state.dragPointIndex = -1;
    state.scaleStart = null;
    const canScaleMask = state.toolMode === 'select' && Array.isArray(state.points) && state.points.length >= 2;
    if (canScaleMask) {
      const b = getMaskBounds(state.points);
      state.pinchKind = 'mask-scale';
      state.pinchCenter = b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
      state.pinchStartPoints = cloneMaskPoints(state.points);
      pushMaskUndo();
    } else {
      state.pinchKind = 'view-zoom';
    }
    try { canvas?.classList?.add('is-dragging'); } catch (_) {}
    return true;
  }

  function updateMaskPinch(canvas) {
    if (!state.pinchActive || !state.pinchStartDistance) return false;
    const distance = maskTouchDistance();
    const midpoint = maskTouchMidpoint();
    if (!distance || !midpoint) return false;
    const factor = Math.max(0.2, Math.min(6, distance / state.pinchStartDistance));
    if (state.pinchKind === 'mask-scale' && state.pinchStartPoints && state.pinchCenter) {
      state.points = cloneMaskPoints(state.pinchStartPoints);
      scaleMaskPoints(factor, state.pinchCenter);
      updateMaskScaleUi();
    } else {
      const rect = canvas?.getBoundingClientRect?.() || null;
      const sx = (canvas?.width && rect?.width) ? (canvas.width / rect.width) : 1;
      const sy = (canvas?.height && rect?.height) ? (canvas.height / rect.height) : 1;
      const currentMidpoint = {
        x: (midpoint.x - (rect?.left || 0)) * sx,
        y: (midpoint.y - (rect?.top || 0)) * sy,
      };
      state.zoom = Math.max(0.2, Math.min(6, state.pinchStartZoom * factor));
      const texturePoint = state.pinchStartTexturePoint || maskScreenToTex(currentMidpoint.x, currentMidpoint.y);
      state.panX = currentMidpoint.x - texturePoint.x * state.zoom;
      state.panY = currentMidpoint.y - texturePoint.y * state.zoom;
      updateMaskViewUi();
    }
    renderPolygonMaskEditor();
    return true;
  }

  function maskScreenToTex(x, y) {
    return {
      x: (x - state.panX) / state.zoom,
      y: (y - state.panY) / state.zoom,
    };
  }

  function updateMaskScaleUi() {
    const el = document.getElementById('maskScaleVal');
    if (!el) return;
    const d = maskDiagFromPoints(state.points);
    if (!state.baseDiag || !d) {
      el.textContent = '—';
      return;
    }
    const pct = Math.max(1, Math.min(999, Math.round((d / state.baseDiag) * 100)));
    el.textContent = pct + '%';
  }

  function pushMaskUndo() {
    state.undoStack.push(cloneMaskPoints(state.points));
    if (state.undoStack.length > 64) state.undoStack.shift();
  }

  function renderPolygonMaskEditor() {
    const canvas = getCanvasEl();
    const ctx = getCanvasCtx();
    if (!canvas || !ctx) return;
    if (state.editingLayerIndex < 0) return;
    const part = getSelectedPart();
    if (!part) return;
    ensureLayersOnPart(part);
    const layers = part.layers || [];
    const layer = layers[state.editingLayerIndex] || null;
    if (!layer) return;

    const w = canvas.width;
    const h = canvas.height;
    const editorBg = getEditorBg();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = editorBg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
    ctx.fillStyle = editorBg;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (layer.imageBitmap) {
      ctx.save();
      drawLayerBitmapToCtx(ctx, layer);
      ctx.restore();
    }

    if (Array.isArray(state.points) && state.points.length) {
      // WebKit does not reliably preserve an even-odd inverse path after a
      // mask is reopened. Highlighting the selected area keeps the original
      // image intact and works consistently across touch browsers.
      if (state.points.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(state.points[0].x, state.points[0].y);
        for (let i = 1; i < state.points.length; i += 1) ctx.lineTo(state.points[i].x, state.points[i].y);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 150, 0, 0.10)';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.restore();
      }

      ctx.strokeStyle = 'rgba(255, 150, 0, 0.95)';
      ctx.lineWidth = Math.max(1, 2 / state.zoom);
      ctx.beginPath();
      ctx.moveTo(state.points[0].x, state.points[0].y);
      for (let i = 1; i < state.points.length; i += 1) ctx.lineTo(state.points[i].x, state.points[i].y);
      if (state.points.length >= 3) ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 150, 0, 0.95)';
      for (const p of state.points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, 4 / state.zoom), 0, Math.PI * 2);
        ctx.fill();
      }

      if (state.toolMode === 'select' && state.points.length >= 2) {
        const b = getMaskBounds(state.points);
        if (b) {
          const r0 = Math.max(4, 10 / Math.max(0.25, state.zoom));
          ctx.strokeStyle = 'rgba(245, 240, 232, 0.55)';
          ctx.lineWidth = Math.max(1, 1.5 / state.zoom);
          ctx.setLineDash([Math.max(3, 6 / state.zoom), Math.max(3, 6 / state.zoom)]);
          ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(245, 240, 232, 0.85)';
          const corners = [
            { x: b.minX, y: b.minY },
            { x: b.maxX, y: b.minY },
            { x: b.maxX, y: b.maxY },
            { x: b.minX, y: b.maxY },
          ];
          for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, r0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
    ctx.restore();
  }

  function undoMaskAction() {
    if (!state.undoStack.length) return;
    state.points = state.undoStack.pop();
    setMaskTool(state.toolMode);
    renderPolygonMaskEditor();
    updateMaskScaleUi();
  }

  function scaleMaskPoints(factor, anchor) {
    if (!Array.isArray(state.points) || state.points.length < 2) return;
    const f = (typeof factor === 'number' && isFinite(factor)) ? factor : 1;
    if (Math.abs(f - 1) < 1e-6) return;
    const a = (anchor && typeof anchor.x === 'number' && typeof anchor.y === 'number')
      ? anchor
      : (() => {
          const b = getMaskBounds(state.points);
          return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
        })();
    for (const p of state.points) {
      p.x = a.x + (p.x - a.x) * f;
      p.y = a.y + (p.y - a.y) * f;
    }
  }

  function getMaskPresetIslandForLayer(layer) {
    try {
      const islands = getIslandsForUvMode();
      if (!islands || !islands.length) return null;
      const part = getSelectedPart();
      const id = (layer && layer.clippingIslandId)
        ? layer.clippingIslandId
        : (part && part.selectedIslandId)
          ? part.selectedIslandId
          : getSelectedIslandId();
      if (!id) return null;
      return islands.find((i) => i && i.id === id) || null;
    } catch (_) {
      return null;
    }
  }

  function setMaskTool(next) {
    const canSelect = Array.isArray(state.points) && state.points.length >= 2;
    // Selection operates on a bounding box. Without two points there is no
    // target, so the UI must never offer a dead selection mode.
    const mode = (next === 'select' && canSelect) ? 'select' : 'edit';
    state.toolMode = mode;
    const btnSel = document.getElementById('maskModeSelect');
    const btnEdit = document.getElementById('maskModeEdit');
    if (btnSel) {
      btnSel.classList.toggle('is-active', mode === 'select');
      btnSel.disabled = !canSelect;
      btnSel.setAttribute('aria-disabled', canSelect ? 'false' : 'true');
    }
    if (btnEdit) btnEdit.classList.toggle('is-active', mode === 'edit');
    if (btnSel) btnSel.setAttribute('aria-pressed', mode === 'select' ? 'true' : 'false');
    if (btnEdit) btnEdit.setAttribute('aria-pressed', mode === 'edit' ? 'true' : 'false');
    const canvas = getCanvasEl();
    if (canvas) {
      canvas.classList.toggle('is-mode-select', mode === 'select');
      canvas.classList.toggle('is-mode-edit', mode === 'edit');
    }
    const sDown = document.getElementById('maskScaleDown');
    const sUp = document.getElementById('maskScaleUp');
    const sReset = document.getElementById('maskScaleReset');
    const selectActions = document.getElementById('maskSelectActions');
    if (selectActions) selectActions.dataset.mode = mode;
    for (const el of [sDown, sUp, sReset]) {
      if (!el) continue;
      if (mode === 'select' && canSelect) el.removeAttribute('disabled');
      else el.setAttribute('disabled', 'true');
    }
    const help = document.getElementById('maskHelp');
    if (help) {
      help.textContent = !canSelect
        ? 'EDIT — add at least two points to unlock Select. Then Select lets you move or scale the finished mask.'
        : (mode === 'select')
        ? 'SELECT — move or resize the finished mask. Use the Select controls above, drag corner handles, or use the wheel to scale. Canvas View controls never change the mask.'
        : 'EDIT — click to add points or drag a point to refine the outline. Quick presets create a starting mask and then switch to Select. Use Canvas View to zoom the preview.';
    }
  }

  function setMaskPointsToPreset(kind) {
    if (state.editingLayerIndex < 0) return;
    const part = getSelectedPart();
    if (!part) return;
    ensureLayersOnPart(part);
    const layers = part.layers || [];
    const layer = layers[state.editingLayerIndex] || null;
    if (!layer) return;

    const island = getMaskPresetIslandForLayer(layer);
    let cx = CANVAS_SIZE / 2;
    let cy = CANVAS_SIZE / 2;
    let half = CANVAS_SIZE * 0.22;
    let r = CANVAS_SIZE * 0.22;
    if (island) {
      if (island.type === 'rect') {
        cx = island.x + island.w / 2;
        cy = island.y + island.h / 2;
        half = Math.max(6, Math.min(island.w, island.h) * 0.45);
        r = Math.max(6, Math.min(island.w, island.h) * 0.45);
      } else if (island.type === 'circle') {
        cx = island.cx;
        cy = island.cy;
        half = Math.max(6, island.r * 0.9);
        r = Math.max(6, island.r * 0.9);
      }
    }

    const clampPt = (x, y) => ({
      x: Math.max(0, Math.min(CANVAS_SIZE, x)),
      y: Math.max(0, Math.min(CANVAS_SIZE, y)),
    });

    if (kind === 'square') {
      pushMaskUndo();
      state.points = [
        clampPt(cx - half, cy - half),
        clampPt(cx + half, cy - half),
        clampPt(cx + half, cy + half),
        clampPt(cx - half, cy + half),
      ];
      state.baseDiag = maskDiagFromPoints(state.points);
      // A preset has produced a complete editable mask.  Switch directly to
      // Select so the visible scale controls work immediately instead of
      // looking broken until the user discovers the separate mode toggle.
      setMaskTool('select');
      renderPolygonMaskEditor();
      updateMaskScaleUi();
      return;
    }

    if (kind === 'circle') {
      pushMaskUndo();
      const segments = 24;
      const pts = [];
      for (let i = 0; i < segments; i += 1) {
        const a = (-Math.PI / 2) + (i * Math.PI * 2) / segments;
        pts.push(clampPt(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
      }
      state.points = pts;
      state.baseDiag = maskDiagFromPoints(state.points);
      setMaskTool('select');
      renderPolygonMaskEditor();
      updateMaskScaleUi();
    }
  }

  function openPolygonMaskModal(idx) {
    const part = getSelectedPart();
    if (!part) return;
    ensureLayersOnPart(part);
    const layers = part.layers || [];
    const layer = layers[idx] || null;
    if (!layer) return;
    const canvas = getCanvasEl();
    const modal = getModalEl();
    state.maskReturnFocusEl = document.activeElement;
    state.editingLayerIndex = idx;
    const pts = (layer && Array.isArray(layer.polygonMaskPoints)) ? layer.polygonMaskPoints : null;
    state.points = pts ? pts.map((p) => ({ x: p.x, y: p.y })) : [];
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.panning = false;
    state.moved = false;
    state.dragMode = '';
    state.dragPointIndex = -1;
    state.undoStack = [cloneMaskPoints(state.points)];
    state.scaleStart = null;
    state.activePointerId = null;
    state.touchPointers.clear();
    resetMaskPinch();
    state.baseDiag = maskDiagFromPoints(state.points);
    setMaskTool('edit');
    if (modal && openModal) {
      if (state.maskModalState) closeModal && closeModal(state.maskModalState);
      state.maskModalState = openModal(modal, {
        initialFocusEl: canvas,
        returnFocusEl: state.maskReturnFocusEl,
        onRequestClose: closePolygonMaskModal,
      });
    }
    if (canvas) fitMaskViewAfterOpen(idx);
    else renderPolygonMaskEditor();
    updateMaskScaleUi();
  }

  function closePolygonMaskModal() {
    const modal = getModalEl();
    if (state.maskModalState && closeModal) {
      const st = state.maskModalState;
      state.maskModalState = null;
      closeModal(st);
    } else if (modal && closeModal) {
      closeModal(modal);
    }
    state.maskReturnFocusEl = null;
    state.editingLayerIndex = -1;
    state.panning = false;
    state.moved = false;
    state.activePointerId = null;
    state.touchPointers.clear();
    resetMaskPinch();
  }

  function applyPolygonMaskModal() {
    const part = getSelectedPart();
    if (!part) return;
    ensureLayersOnPart(part);
    const layers = part.layers || [];
    const layer = (state.editingLayerIndex >= 0 && state.editingLayerIndex < layers.length) ? layers[state.editingLayerIndex] : null;
    if (!layer) {
      closePolygonMaskModal();
      return;
    }
    mutateProject(() => {
      layer.polygonMaskPoints = (Array.isArray(state.points) && state.points.length >= 3) ? state.points.map((p) => ({ x: p.x, y: p.y })) : null;
      if (layer.polygonMaskPoints && layer.maskLinked === undefined) layer.maskLinked = true;
      closePolygonMaskModal();
      drawBaseLayer();
      renderUvOverlay();
      requestApplyTexture(true);
      renderLayerListUI();
    });
  }

  function bindControls() {
    if (document.documentElement.dataset.xrMaskEditorBound === '1') return;
    document.documentElement.dataset.xrMaskEditorBound = '1';

    const modal = getModalEl();
    const canvas = getCanvasEl();
    const maskModeSelectBtn = document.getElementById('maskModeSelect');
    const maskModeEditBtn = document.getElementById('maskModeEdit');
    const maskPresetSquareBtn = document.getElementById('maskPresetSquare');
    const maskPresetCircleBtn = document.getElementById('maskPresetCircle');
    const maskUndoBtn = document.getElementById('maskUndo');
    const maskClearBtn = document.getElementById('maskClear');
    const maskCancelBtn = document.getElementById('maskCancel');
    const maskApplyBtn = document.getElementById('maskApply');
    const maskScaleDownBtn = document.getElementById('maskScaleDown');
    const maskScaleUpBtn = document.getElementById('maskScaleUp');
    const maskScaleResetBtn = document.getElementById('maskScaleReset');
    const maskViewZoomOutBtn = document.getElementById('maskViewZoomOut');
    const maskViewZoomInBtn = document.getElementById('maskViewZoomIn');
    const maskViewFitBtn = document.getElementById('maskViewFit');

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePolygonMaskModal();
      });
    }
    if (maskPresetSquareBtn) maskPresetSquareBtn.addEventListener('click', () => setMaskPointsToPreset('square'));
    if (maskPresetCircleBtn) maskPresetCircleBtn.addEventListener('click', () => setMaskPointsToPreset('circle'));
    if (maskCancelBtn) maskCancelBtn.addEventListener('click', () => closePolygonMaskModal());
    if (maskApplyBtn) maskApplyBtn.addEventListener('click', () => applyPolygonMaskModal());
    if (maskClearBtn) maskClearBtn.addEventListener('click', () => {
      pushMaskUndo();
      state.points = [];
      state.baseDiag = 0;
      setMaskTool(state.toolMode);
      renderPolygonMaskEditor();
      updateMaskScaleUi();
    });
    if (maskUndoBtn) maskUndoBtn.addEventListener('click', () => undoMaskAction());
    if (maskModeSelectBtn) maskModeSelectBtn.addEventListener('click', () => setMaskTool('select'));
    if (maskModeEditBtn) maskModeEditBtn.addEventListener('click', () => setMaskTool('edit'));
    if (maskScaleDownBtn) maskScaleDownBtn.addEventListener('click', () => {
      if (!Array.isArray(state.points) || state.points.length < 2) return;
      pushMaskUndo();
      scaleMaskPoints(0.9);
      renderPolygonMaskEditor();
      updateMaskScaleUi();
    });
    if (maskScaleUpBtn) maskScaleUpBtn.addEventListener('click', () => {
      if (!Array.isArray(state.points) || state.points.length < 2) return;
      pushMaskUndo();
      scaleMaskPoints(1.1);
      renderPolygonMaskEditor();
      updateMaskScaleUi();
    });
    if (maskScaleResetBtn) maskScaleResetBtn.addEventListener('click', () => {
      if (!Array.isArray(state.points) || state.points.length < 2) return;
      const cur = maskDiagFromPoints(state.points);
      if (!state.baseDiag || !cur) return;
      pushMaskUndo();
      scaleMaskPoints(state.baseDiag / cur);
      renderPolygonMaskEditor();
      updateMaskScaleUi();
    });
    if (maskViewZoomOutBtn) maskViewZoomOutBtn.addEventListener('click', () => zoomMaskView(1 / 1.2));
    if (maskViewZoomInBtn) maskViewZoomInBtn.addEventListener('click', () => zoomMaskView(1.2));
    if (maskViewFitBtn) maskViewFitBtn.addEventListener('click', () => {
      fitMaskView();
      renderPolygonMaskEditor();
    });

    if (!canvas) return;
    canvas.addEventListener('contextmenu', (e) => {
      if (state.editingLayerIndex < 0) return;
      if (state.toolMode !== 'edit') return;
      e.preventDefault();
      undoMaskAction();
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (state.editingLayerIndex < 0) return;
      if (e.pointerType === 'touch') {
        const touchCount = rememberMaskTouch(e);
        if (touchCount >= 2) {
          e.preventDefault();
          beginMaskPinch(canvas);
          return;
        }
      }
      if (state.activePointerId !== null) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      try {
        state.dragRect = canvas.getBoundingClientRect();
        state.dragSx = (state.dragRect.width > 0) ? (canvas.width / state.dragRect.width) : 1;
        state.dragSy = (state.dragRect.height > 0) ? (canvas.height / state.dragRect.height) : 1;
      } catch (_) {
        state.dragRect = null;
        state.dragSx = 1;
        state.dragSy = 1;
      }
      const p = maskGetPointerPos(e);
      const t = maskScreenToTex(p.x, p.y);
      const wantsPan = (e.button === 1) || !!e.shiftKey;
      if (wantsPan) {
        state.dragMode = 'pan';
      } else if (state.toolMode === 'select' && Array.isArray(state.points) && state.points.length) {
        const b = getMaskBounds(state.points);
        if (b) {
          const hr = Math.max(10, 18 / Math.max(0.25, state.zoom));
          const corners = [
            { x: b.minX, y: b.minY },
            { x: b.maxX, y: b.minY },
            { x: b.maxX, y: b.maxY },
            { x: b.minX, y: b.maxY },
          ];
          let hitHandle = false;
          for (const c of corners) {
            const dx = t.x - c.x;
            const dy = t.y - c.y;
            if ((dx * dx + dy * dy) <= (hr * hr)) {
              hitHandle = true;
              break;
            }
          }
          if (hitHandle) {
            pushMaskUndo();
            const cx = (b.minX + b.maxX) / 2;
            const cy = (b.minY + b.maxY) / 2;
            const ddx = t.x - cx;
            const ddy = t.y - cy;
            const d0 = Math.max(0.001, Math.sqrt(ddx * ddx + ddy * ddy));
            state.scaleStart = { center: { x: cx, y: cy }, dist: d0, pts: cloneMaskPoints(state.points) };
            state.dragMode = 'scale';
          } else {
            pushMaskUndo();
            state.dragMode = 'move';
          }
        } else {
          state.dragMode = 'pan';
        }
      } else {
        let hit = -1;
        if (Array.isArray(state.points) && state.points.length) {
          const hitR = Math.max(6, 12 / Math.max(0.25, state.zoom));
          for (let i = 0; i < state.points.length; i += 1) {
            const mp = state.points[i];
            const dx = t.x - mp.x;
            const dy = t.y - mp.y;
            if ((dx * dx + dy * dy) <= (hitR * hitR)) {
              hit = i;
              break;
            }
          }
        }
        if (hit >= 0 && state.toolMode === 'edit') {
          pushMaskUndo();
          state.dragMode = 'point';
        } else {
          state.dragMode = 'pan';
        }
        state.dragPointIndex = (state.dragMode === 'point') ? hit : -1;
      }
      state.panning = true;
      state.activePointerId = e.pointerId;
      canvas.classList.add('is-dragging');
      state.moved = false;
      state.prevX = p.x;
      state.prevY = p.y;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        rememberMaskTouch(e);
        if (state.pinchActive) {
          e.preventDefault();
          updateMaskPinch(canvas);
          return;
        }
      }
      if (!state.panning || e.pointerId !== state.activePointerId) return;
      e.preventDefault();
      const p = maskGetPointerPos(e);
      const dx = p.x - state.prevX;
      const dy = p.y - state.prevY;
      if (Math.abs(dx) + Math.abs(dy) > 1) state.moved = true;
      if (state.dragMode === 'point' && state.dragPointIndex >= 0) {
        const t = maskScreenToTex(p.x, p.y);
        if (isFinite(t.x) && isFinite(t.y) && Array.isArray(state.points) && state.dragPointIndex < state.points.length && state.points[state.dragPointIndex]) {
          state.points[state.dragPointIndex].x = t.x;
          state.points[state.dragPointIndex].y = t.y;
        }
      } else if (state.dragMode === 'scale') {
        if (state.scaleStart && state.scaleStart.pts && state.scaleStart.center) {
          const tt = maskScreenToTex(p.x, p.y);
          const dx0 = tt.x - state.scaleStart.center.x;
          const dy0 = tt.y - state.scaleStart.center.y;
          const d1 = Math.max(0.001, Math.sqrt(dx0 * dx0 + dy0 * dy0));
          const f = Math.max(0.2, Math.min(6.0, d1 / Math.max(0.001, state.scaleStart.dist)));
          state.points = cloneMaskPoints(state.scaleStart.pts);
          scaleMaskPoints(f, state.scaleStart.center);
          updateMaskScaleUi();
        }
      } else if (state.dragMode === 'move') {
        if (Array.isArray(state.points) && state.points.length) {
          const tx = dx / Math.max(0.0001, state.zoom);
          const ty = dy / Math.max(0.0001, state.zoom);
          for (const mp of state.points) {
            mp.x = (typeof mp.x === 'number' && isFinite(mp.x)) ? (mp.x + tx) : tx;
            mp.y = (typeof mp.y === 'number' && isFinite(mp.y)) ? (mp.y + ty) : ty;
          }
        } else {
          state.panX += dx;
          state.panY += dy;
        }
      } else {
        state.panX += dx;
        state.panY += dy;
      }
      state.prevX = p.x;
      state.prevY = p.y;
      renderPolygonMaskEditor();
    });
    const endPan = (e) => {
      const remainingTouches = forgetMaskTouch(e);
      if (state.pinchActive) {
        e.preventDefault();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (remainingTouches < 2) {
          resetMaskPinch();
          clearMaskDrag();
          canvas.classList.remove('is-dragging');
        }
        renderPolygonMaskEditor();
        return;
      }
      if (!state.panning || e.pointerId !== state.activePointerId) return;
      e.preventDefault();
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      // A cancelled Safari touch can contain a stale coordinate. It is an
      // aborted gesture, never a request to add or close a mask polygon.
      if (e.type === 'pointercancel') {
        clearMaskDrag();
        canvas.classList.remove('is-dragging');
        renderPolygonMaskEditor();
        return;
      }
      canvas.classList.remove('is-dragging');
      const p = maskGetPointerPos(e);
      if (state.toolMode === 'edit' && !state.moved && state.dragMode !== 'point') {
        const t = maskScreenToTex(p.x, p.y);
        const x = t.x;
        const y = t.y;
        if (isFinite(x) && isFinite(y) && state.dragMode === 'pan') {
          if (!Array.isArray(state.points)) state.points = [];
          if (state.points.length >= 3) {
            const dx0 = x - state.points[0].x;
            const dy0 = y - state.points[0].y;
            const d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
            if (d0 <= Math.max(8, 14 / Math.max(0.25, state.zoom))) {
              clearMaskDrag();
              applyPolygonMaskModal();
              return;
            }
          }
          pushMaskUndo();
          state.points.push({ x, y });
          if (!state.baseDiag && state.points.length >= 2) state.baseDiag = maskDiagFromPoints(state.points);
          setMaskTool(state.toolMode);
          updateMaskScaleUi();
        }
      }
      clearMaskDrag();
      renderPolygonMaskEditor();
    };
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);
    canvas.addEventListener('wheel', (e) => {
      if (state.editingLayerIndex < 0) return;
      e.preventDefault();
      const p = maskGetPointerPos(e);
      if (state.toolMode === 'select' && !e.shiftKey) {
        if (!Array.isArray(state.points) || state.points.length < 2) return;
        pushMaskUndo();
        const t = maskScreenToTex(p.x, p.y);
        const factor = Math.max(0.85, Math.min(1.15, Math.exp(-e.deltaY * 0.001)));
        scaleMaskPoints(factor, t);
        renderPolygonMaskEditor();
        updateMaskScaleUi();
        return;
      }
      const before = maskScreenToTex(p.x, p.y);
      const factor = Math.exp(-e.deltaY * 0.001);
      const nextZoom = Math.max(0.2, Math.min(6.0, state.zoom * factor));
      state.zoom = nextZoom;
      state.panX = p.x - before.x * state.zoom;
      state.panY = p.y - before.y * state.zoom;
      updateMaskViewUi();
      renderPolygonMaskEditor();
    }, { passive: false });
  }

  return {
    openPolygonMaskModal,
    closePolygonMaskModal,
    applyPolygonMaskModal,
    renderPolygonMaskEditor,
    fitMaskView,
    zoomMaskView,
    setMaskTool,
    setMaskPointsToPreset,
    updateMaskScaleUi,
    bindControls,
  };
}

XR.__modules.ShellMaskEditor = XR.__modules.ShellMaskEditor || {};
XR.__modules.ShellMaskEditor.create = create;
