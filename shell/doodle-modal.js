const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function bindOnce(el, key, eventName, handler, options) {
  if (!el || typeof handler !== 'function') return;
  if (el[key]) return;
  el[key] = true;
  el.addEventListener(eventName, handler, options);
}

function resolveEditorModalApi(config) {
  if (config.api) return config.api;
  const mod = XR?.__modules?.ShellEditorModals || null;
  if (!mod || typeof mod.createDoodleModal !== 'function') return null;
  try {
    config.api = mod.createDoodleModal({
      modal: config.modal,
      closeTargets: [config.closeBtn, config.cancelBtn],
      onOpen: () => {
        config.setStep(1);
        config.resetState();
        config.applyModeUi();
        config.setToolMode('draw');
        config.applySnapUi();
        try { config.refreshToolAvailability && config.refreshToolAvailability(); } catch (_) {}
      },
      onClose: () => {
        try { if (config.bmp && typeof config.bmp.close === 'function') config.bmp.close(); } catch (_) {}
        config.bmp = null;
      },
    });
    return config.api;
  } catch (_) {
    return null;
  }
}

export function create(opts) {
  const existing = XR.__modules.ShellDoodleModal && XR.__modules.ShellDoodleModal._instance;
  if (existing) return existing;

  const t = (opts && typeof opts.t === 'function') ? opts.t : ((key) => String(key));
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : t;
  const showToast = (opts && typeof opts.showToast === 'function') ? opts.showToast : ((msg, type) => {
    try { XR?.showToast?.(msg, type); } catch (_) {}
  });

  const modal = document.getElementById('doodleModal');
  if (!modal) return null;
  const closeBtn = document.getElementById('doodleClose');
  const step1 = document.getElementById('doodleStep1');
  const step2 = document.getElementById('doodleStep2');
  const step1Ind = document.getElementById('doodleStep1Ind');
  const step2Ind = document.getElementById('doodleStep2Ind');
  const pickFile = document.getElementById('doodlePickFile');
  const pickCamera = document.getElementById('doodlePickCamera');
  const skipImage = document.getElementById('doodleSkipImage');
  const fileInput = document.getElementById('doodleFileInput');
  const cameraInput = document.getElementById('doodleCameraInput');
  const backBtn = document.getElementById('doodleBack');
  const cancelBtn = document.getElementById('doodleCancel');
  const applyBtn = document.getElementById('doodleApply');
  const applyHint = document.getElementById('doodleApplyHint');
  const undoBtn = document.getElementById('doodleUndoPoint');
  const clearBtn = document.getElementById('doodleClearPoints');
  const snapBtn = document.getElementById('doodleSnap');
  const toolDrawBtn = document.getElementById('doodleToolDraw');
  const toolMoveBtn = document.getElementById('doodleToolMove');
  const toolHintEl = document.getElementById('doodleToolHint');
  const scaleDownBtn = document.getElementById('doodleScaleDown');
  const scaleUpBtn = document.getElementById('doodleScaleUp');
  const scaleResetBtn = document.getElementById('doodleScaleReset');
  const scaleCenterBtn = document.getElementById('doodleScaleCenter');
  const scaleValEl = document.getElementById('doodleScaleVal');
  const helpEl = document.getElementById('doodleHelp');
  const modePolygonBtn = document.getElementById('doodleModePolygon');
  const modeMirrorBtn = document.getElementById('doodleModeMirror');
  const modeRevolveBtn = document.getElementById('doodleModeRevolve');
  const modeCaptionEl = document.getElementById('doodleModeCaption');
  const canvas = document.getElementById('doodleCanvas');
  const errorEl = document.getElementById('doodleError');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const w = canvas && canvas.width ? canvas.width : 720;
  const h = canvas && canvas.height ? canvas.height : 520;

  const config = {
    modal,
    closeBtn,
    cancelBtn,
    api: null,
    bmp: null,
    setStep: null,
    resetState: null,
    applyModeUi: null,
    setToolMode: null,
    applySnapUi: null,
  };

  let imgRect = null;
  let imgShiftX = 0;
  let imgShiftY = 0;
  let imgScale = 1;
  let points = [];
  let polyOkCached = false;
  let polyOkCachedCount = 0;
  let closed = false;
  let panX = 0;
  let panY = 0;
  let zoom = 1;
  let panning = false;
  let moved = false;
  let prevX = 0;
  let prevY = 0;
  let dragMode = '';
  // Pointer events are delivered once per contact.  A second finger or a
  // pointer cancellation must never be interpreted as another Doodle point.
  // iOS can issue pointercancel while a browser gesture begins, which used to
  // commit a stale coordinate through endPan().
  let activePointerId = null;
  let pointerGestureCancelled = false;
  let hoverPt = null;
  let doodleMode = 'polygon';
  let snapMode = 0;
  let toolMode = 'draw';
  let dragRect = null;
  let dragSx = 1;
  let dragSy = 1;
  let step1Status = 'pending';
  const usesHalfCanvas = () => doodleMode === 'mirror' || doodleMode === 'revolve';

  function applyModeUi() {
    const isPoly = doodleMode === 'polygon';
    const isMirror = doodleMode === 'mirror';
    if (modePolygonBtn) {
      modePolygonBtn.classList.toggle('is-active', isPoly);
      modePolygonBtn.setAttribute('aria-selected', isPoly ? 'true' : 'false');
    }
    if (modeMirrorBtn) {
      modeMirrorBtn.classList.toggle('is-active', isMirror);
      modeMirrorBtn.setAttribute('aria-selected', isMirror ? 'true' : 'false');
    }
    if (modeRevolveBtn) { const on = doodleMode === 'revolve'; modeRevolveBtn.classList.toggle('is-active', on); modeRevolveBtn.setAttribute('aria-selected', on ? 'true' : 'false'); }
    if (modeCaptionEl) modeCaptionEl.textContent = isPoly ? t('doodle_mode_caption_polygon') : (isMirror ? 'Trace the left outer contour from the axis to the axis; XReate closes one symmetric solid.' : t('doodle_mode_caption_mirror'));
    if (helpEl) helpEl.textContent = isPoly ? t('doodle_step2_help') : (isMirror ? 'Trace one left-side contour between the centre-line endpoints. It becomes one mirrored solid.' : t('doodle_step2_help_mirror'));
  }

  function applyToolUi() {
    const isDraw = toolMode === 'draw';
    if (toolDrawBtn) {
      toolDrawBtn.classList.toggle('is-active', isDraw);
      toolDrawBtn.setAttribute('aria-selected', isDraw ? 'true' : 'false');
    }
    if (toolMoveBtn) {
      toolMoveBtn.classList.toggle('is-active', !isDraw);
      toolMoveBtn.setAttribute('aria-selected', isDraw ? 'false' : 'true');
    }
    try { if (canvas) canvas.style.cursor = isDraw ? 'crosshair' : 'grab'; } catch (_) {}
  }

  function refreshToolAvailability() {
    const hasBmp = !!(config.bmp && (config.bmp.width > 0 || config.bmp.height > 0));
    if (toolMoveBtn) {
      if (hasBmp) {
        toolMoveBtn.classList.remove('is-disabled');
        toolMoveBtn.removeAttribute('disabled');
        toolMoveBtn.setAttribute('aria-disabled', 'false');
        toolMoveBtn.removeAttribute('tabindex');
      } else {
        toolMoveBtn.classList.add('is-disabled');
        toolMoveBtn.setAttribute('disabled', '');
        toolMoveBtn.setAttribute('aria-disabled', 'true');
        toolMoveBtn.setAttribute('tabindex', '-1');
      }
    }
    if (!hasBmp && toolMode === 'move') {
      toolMode = 'draw';
      applyToolUi();
    }
    if (toolHintEl) {
      toolHintEl.classList.toggle('is-hidden', !!hasBmp);
    }
  }

  function setToolMode(next) {
    const wantMove = next === 'move';
    const hasBmp = !!(config.bmp && (config.bmp.width > 0 || config.bmp.height > 0));
    if (wantMove && !hasBmp) {
      try { showToast(tr('doodle_tool_move_disabled'), 'warning'); } catch (_) {}
      toolMode = 'draw';
    } else {
      toolMode = wantMove ? 'move' : 'draw';
    }
    applyToolUi();
    render();
  }

  // Camera captures can be 12–48 MP. Drawing that source repeatedly on every
  // touch frame makes iPhone/iPad pointer delivery visibly laggy, even though
  // the trace canvas itself is only 720×520. Keep a high enough source for
  // tracing but bound the bitmap work to a mobile-safe size.
  async function normalizeTraceBitmap(bitmap) {
    const source = bitmap || null;
    const sw = Number(source?.width) || 0;
    const sh = Number(source?.height) || 0;
    const maxDimension = 2048;
    if (!source || !sw || !sh || Math.max(sw, sh) <= maxDimension) return source;
    const scale = maxDimension / Math.max(sw, sh);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));
    let scratch = null;
    try {
      scratch = (typeof OffscreenCanvas === 'function')
        ? new OffscreenCanvas(dw, dh)
        : document.createElement('canvas');
      scratch.width = dw;
      scratch.height = dh;
      const scratchCtx = scratch.getContext('2d', { alpha: true });
      if (!scratchCtx) return source;
      scratchCtx.drawImage(source, 0, 0, dw, dh);
      const output = (typeof createImageBitmap === 'function')
        ? await createImageBitmap(scratch)
        : scratch;
      try { if (output !== source && typeof source.close === 'function') source.close(); } catch (_) {}
      return output;
    } catch (_) {
      return source;
    }
  }

  function fitImageRect() {
    if (!config.bmp) { imgRect = null; return; }
    const iw = config.bmp.width || 1;
    const ih = config.bmp.height || 1;
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    // Half-canvas construction modes use a world origin at the visual centre
    // line. A source placed with the polygon coordinates would land one half
    // canvas too far right, which is why Mirror appeared decentered.
    if (usesHalfCanvas()) {
      imgRect = { x: -dw / 2, y: (h - dh) / 2, w: dw, h: dh };
    } else {
      imgRect = { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
    }
  }

  function resetImageTransform() {
    imgShiftX = 0;
    imgShiftY = 0;
    imgScale = 1;
    fitImageRect();
    render();
  }

  function centerImageInContainer() {
    if (!config.bmp) { imgShiftX = 0; imgShiftY = 0; render(); return; }
    if (!imgRect) fitImageRect();
    if (!imgRect) return;
    const cx = imgRect.x + imgRect.w / 2;
    const cy = imgRect.y + imgRect.h / 2;
    const z = Math.max(0.0001, zoom);
    const targetX = w * 0.5;
    const targetY = h * 0.5;
    imgShiftX = ((targetX - panX) / z) - cx;
    imgShiftY = ((targetY - panY) / z) - cy;
    render();
  }

  function applySnapUi() {
    if (!snapBtn) return;
    const key = (snapMode === 5) ? 'doodle_snap_5'
      : (snapMode === 15) ? 'doodle_snap_15'
      : (snapMode === 45) ? 'doodle_snap_45'
      : (snapMode === 90) ? 'doodle_snap_90'
      : 'doodle_snap_off';
    snapBtn.textContent = t(key);
    try { snapBtn.setAttribute('aria-pressed', snapMode ? 'true' : 'false'); } catch (_) {}
  }

  function toggleSnap() {
    snapMode = (snapMode === 0) ? 5 : (snapMode === 5) ? 15 : (snapMode === 15) ? 45 : (snapMode === 45) ? 90 : 0;
    applySnapUi();
    render();
  }

  function snapPoint(p, anchor) {
    if (!p || !anchor || !snapMode) return p;
    const step = (snapMode === 5) ? (Math.PI / 36)
      : (snapMode === 15) ? (Math.PI / 12)
      : (snapMode === 45) ? (Math.PI / 4)
      : (Math.PI / 2);
    const dx = p.x - anchor.x;
    const dy = p.y - anchor.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!isFinite(d) || d < 1e-6) return p;
    const a0 = Math.atan2(dy, dx);
    const a1 = Math.round(a0 / step) * step;
    return { x: anchor.x + Math.cos(a1) * d, y: anchor.y + Math.sin(a1) * d };
  }

  function simplifyRdp(pts, eps) {
    if (!Array.isArray(pts) || pts.length < 3) return Array.isArray(pts) ? pts.slice(0) : [];
    const e = Math.max(0.000001, Number(eps) || 0);
    const e2 = e * e;
    const keep = new Uint8Array(pts.length);
    keep[0] = 1;
    keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    const segDist2 = (p, a, b) => {
      const ax = a.x, ay = a.y;
      const bx = b.x, by = b.y;
      const px = p.x, py = p.y;
      const dx = bx - ax;
      const dy = by - ay;
      const denom = dx * dx + dy * dy;
      if (denom < 1e-12) {
        const ox = px - ax;
        const oy = py - ay;
        return ox * ox + oy * oy;
      }
      let t0 = ((px - ax) * dx + (py - ay) * dy) / denom;
      if (t0 < 0) t0 = 0;
      else if (t0 > 1) t0 = 1;
      const cx = ax + t0 * dx;
      const cy = ay + t0 * dy;
      const ox = px - cx;
      const oy = py - cy;
      return ox * ox + oy * oy;
    };
    while (stack.length) {
      const pair = stack.pop();
      const i0 = pair[0];
      const i1 = pair[1];
      const a = pts[i0];
      const b = pts[i1];
      let maxD = -1;
      let idx = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const d2 = segDist2(pts[i], a, b);
        if (d2 > maxD) { maxD = d2; idx = i; }
      }
      if (idx >= 0 && maxD > e2) {
        keep[idx] = 1;
        stack.push([i0, idx], [idx, i1]);
      }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  function simplifyPolygonPoints(pts) {
    if (!Array.isArray(pts) || pts.length < 4) return Array.isArray(pts) ? pts.slice(0) : [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const x = Number(p && p.x);
      const y = Number(p && p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const dx = maxX - minX;
    const dy = maxY - minY;
    const diag = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy));
    const eps = diag * 0.002;
    const out = simplifyRdp(pts, eps);
    return out.length >= 3 ? out : pts.slice(0);
  }

  function setDoodleMode(next) {
    doodleMode = (next === 'revolve') ? 'revolve' : (next === 'mirror' ? 'mirror' : 'polygon');
    closed = false;
    points = [];
    hoverPt = null;
    zoom = 1;
    panX = usesHalfCanvas() ? (w * 0.5) : 0;
    panY = 0;
    if (scaleValEl) scaleValEl.textContent = '100%';
    resetImageTransform();
    applyModeUi();
    setToolMode('draw');
    updateValidityUi();
    render();
  }

  function applyStepIndicator(el, status, isActive) {
    if (!el) return;
    el.classList.toggle('is-active', !!isActive);
    el.classList.toggle('is-completed', status === 'completed');
    el.classList.toggle('is-skipped', status === 'skipped');
    const numEl = el.querySelector('.xr-doodle-step__num');
    const chkEl = el.querySelector('.xr-doodle-step__check');
    const done = (status === 'completed');
    if (numEl) numEl.style.display = done ? 'none' : '';
    if (chkEl) chkEl.style.display = done ? '' : 'none';
    if (isActive) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  }

  function setStep(n) {
    const on2 = (n === 2);
    if (step1) step1.hidden = on2;
    if (step2) step2.hidden = !on2;
    applyStepIndicator(step1Ind, on2 ? step1Status : 'pending', !on2);
    applyStepIndicator(step2Ind, on2 ? 'pending' : (step1Status !== 'pending' ? 'pending' : 'pending'), on2);
    if (on2) {
      try { canvas && canvas.focus && canvas.focus(); } catch (_) {}
    } else {
      try { pickFile && pickFile.focus && pickFile.focus(); } catch (_) {}
    }
  }

  function screenToWorld(x, y) {
    return { x: (x - panX) / Math.max(0.0001, zoom), y: (y - panY) / Math.max(0.0001, zoom) };
  }

  function getCanvasPos(e) {
    const r = (panning && dragRect) ? dragRect : canvas.getBoundingClientRect();
    const sx = (panning && dragRect) ? dragSx : (r.width > 0 ? (canvas.width / r.width) : 1);
    const sy = (panning && dragRect) ? dragSy : (r.height > 0 ? (canvas.height / r.height) : 1);
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  // The builders normalize a Polygon's longest side to 1 metre. Mirror
  // profiles normalize their height to 2 metres. Show that contract directly
  // in the drawing space instead of making the student infer it from pixels.
  function getOutputScaleLabel() {
    if (!Array.isArray(points) || !points.length) return 'OUTPUT SCALE · add points to estimate the final model';
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const point of points) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    const spanX = Math.max(0.0001, maxX - minX);
    const spanY = Math.max(0.0001, maxY - minY);
    if (usesHalfCanvas()) {
      const halfHeight = spanY / 2;
      const maxRadius = Math.max(0, ...points.map((point) => Math.max(0, -Number(point?.x || 0))));
      const diameter = (maxRadius / Math.max(0.0001, halfHeight)) * 2;
      return `OUTPUT SCALE · H 2.00 m · Ø ${diameter.toFixed(2)} m`;
    }
    const largest = Math.max(spanX, spanY);
    return `OUTPUT SCALE · W ${(spanX / largest).toFixed(2)} m · H ${(spanY / largest).toFixed(2)} m · D 0.50 m`;
  }

  function drawModelScaleReference() {
    if (!ctx) return;
    const x = 16;
    const y = h - 20;
    // This is a one-metre ruler in drawing-space units.  It must participate
    // in the canvas zoom so its visible length remains truthful beside the
    // grid and reference image rather than being a fixed HUD decoration.
    const ruler = 100 * zoom;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(10, 9, 8, 0.78)';
    ctx.fillRect(8, h - 52, Math.min(w - 16, Math.max(180, ruler + 250)), 44);
    ctx.strokeStyle = 'rgba(232, 226, 214, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + ruler, y);
    ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
    ctx.moveTo(x + ruler / 2, y - 3); ctx.lineTo(x + ruler / 2, y + 3);
    ctx.moveTo(x + ruler, y - 5); ctx.lineTo(x + ruler, y + 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232, 226, 214, 0.96)';
    ctx.font = '700 10px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0', x, y - 7);
    ctx.fillText('0.5 m', x + ruler / 2 - 13, y - 7);
    ctx.fillText('1 m', x + ruler - 16, y - 7);
    ctx.font = '600 10px "IBM Plex Sans", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(getOutputScaleLabel(), x + ruler + 14, y - 5);
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0908';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, panX, panY);
    if (!config.bmp && doodleMode !== 'revolve') {
      const gridSize = 40;
      const gridMajor = 5;
      const left = -panX / zoom - gridSize * 2;
      const right = (-panX + w) / zoom + gridSize * 2;
      const top = -panY / zoom - gridSize * 2;
      const bottom = (-panY + h) / zoom + gridSize * 2;
      ctx.lineWidth = Math.max(0.5, 1 / Math.max(0.25, zoom));
      ctx.strokeStyle = 'rgba(232, 226, 214, 0.08)';
      ctx.beginPath();
      for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }
      for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232, 226, 214, 0.18)';
      ctx.beginPath();
      const majorSize = gridSize * gridMajor;
      for (let x = Math.floor(left / majorSize) * majorSize; x <= right; x += majorSize) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }
      for (let y = Math.floor(top / majorSize) * majorSize; y <= bottom; y += majorSize) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();
    }
    if (config.bmp && imgRect) {
      const cx = imgRect.x + imgRect.w / 2;
      const cy = imgRect.y + imgRect.h / 2;
      const dw = imgRect.w * imgScale;
      const dh = imgRect.h * imgScale;
      const x = cx - dw / 2 + imgShiftX;
      const y = cy - dh / 2 + imgShiftY;
      try { ctx.drawImage(config.bmp, x, y, dw, dh); } catch (_) {}
    }

    const lw = Math.max(1, 2 / Math.max(0.25, zoom));
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#e8e2d6';
    ctx.fillStyle = '#e8e2d6';

    const okPoly = (doodleMode === 'polygon' && points.length >= 3 && points.length <= 256)
      ? (polyOkCached && polyOkCachedCount === points.length)
      : false;
    if (doodleMode === 'polygon' && points.length >= 3 && okPoly) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#e8e2d6';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (doodleMode === 'polygon' && points.length >= 3 && okPoly && !closed) {
      const dash = 8 / Math.max(0.25, zoom);
      ctx.save();
      ctx.strokeStyle = 'rgba(232, 226, 214, 0.8)';
      ctx.setLineDash([dash, dash]);
      ctx.beginPath();
      const last = points[points.length - 1];
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(points[0].x, points[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (usesHalfCanvas() && points.length >= 2) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.moveTo(0, points[0].y);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      const last = points[points.length - 1];
      ctx.lineTo(0, last.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (points.length) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      if (closed && doodleMode === 'polygon') ctx.closePath();
      ctx.stroke();

      if (!closed && hoverPt && toolMode === 'draw') {
        ctx.beginPath();
        const last = points[points.length - 1];
        const hp = snapPoint(hoverPt, last);
        if (usesHalfCanvas() && hp.x > 0) hp.x = 0;
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(hp.x, hp.y);
        ctx.stroke();
      }

      const pr = Math.max(2.5, 4 / Math.max(0.25, zoom));
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        if (i === 0) ctx.fill();
        else ctx.stroke();
      }
    }
    ctx.restore();

    if (usesHalfCanvas()) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
      ctx.fillRect(w * 0.5, 0, w * 0.5, h);
      ctx.strokeStyle = '#e8e2d6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + 0.5, 0);
      ctx.lineTo(w * 0.5 + 0.5, h);
      ctx.stroke();
      const text = String(t('doodle_mirror_canvas_hint') || '').split('\n');
      ctx.fillStyle = 'rgba(232, 226, 214, 0.92)';
      ctx.font = '600 12px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
      ctx.textBaseline = 'top';
      const pad = 14;
      const tx = w * 0.5 + pad;
      let ty = pad;
      const lh = 16;
      for (let i = 0; i < text.length; i++) {
        const line = String(text[i] || '').trim();
        if (!line) { ty += lh * 0.6; continue; }
        ctx.fillText(line, tx, ty);
        ty += lh;
      }
      ctx.restore();
    }
    drawModelScaleReference();
  }

  function segsIntersect(a, b, c, d) {
    const ax = a.x, ay = a.y, bx = b.x, by = b.y, cx = c.x, cy = c.y, dx = d.x, dy = d.y;
    const abx = bx - ax, aby = by - ay;
    const cdx = dx - cx, cdy = dy - cy;
    const denom = (-cdx * aby + abx * cdy);
    if (Math.abs(denom) < 1e-9) return false;
    const s = (-aby * (ax - cx) + abx * (ay - cy)) / denom;
    const t0 = (cdx * (ay - cy) - cdy * (ax - cx)) / denom;
    if (s <= 0 || s >= 1 || t0 <= 0 || t0 >= 1) return false;
    return true;
  }

  function isSimpleClosedPolygon(pts) {
    if (!pts || pts.length < 3) return false;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(i - j) <= 1) continue;
        if (i === 0 && j === n - 1) continue;
        const c = pts[j];
        const d = pts[(j + 1) % n];
        if (segsIntersect(a, b, c, d)) return false;
      }
    }
    return true;
  }

  function isMirrorProfileMonotonic(pts) {
    if (!pts || pts.length < 2) return false;
    const arr = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = Number(p && p.x);
      const y = Number(p && p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      arr.push({ x: Math.min(x, 0), y });
    }
    if (arr.length < 2) return false;
    if (arr[0].y > arr[arr.length - 1].y) arr.reverse();
    let lastY = arr[0].y;
    for (let i = 1; i < arr.length; i++) {
      const y = arr[i].y;
      if (y + 1e-6 < lastY) return false;
      lastY = y;
    }
    return true;
  }

  function updateValidityUi() {
    let ok = false;
    let errKey = '';
    if (doodleMode === 'revolve') {
      ok = points.length >= 2;
      if (ok && !isMirrorProfileMonotonic(points)) { ok = false; errKey = 'doodle_error_mirror_profile'; }
    } else if (points.length >= 3) {
      if (points.length > 256) {
        ok = false;
        errKey = 'doodle_error_too_many_points';
      } else {
        ok = isSimpleClosedPolygon(points);
        if (!ok) errKey = 'doodle_error_self_intersection';
      }
    }
    polyOkCached = !!ok;
    polyOkCachedCount = points.length | 0;
    if (errorEl) errorEl.textContent = errKey ? t(errKey) : '';
    if (applyBtn) applyBtn.disabled = doodleMode === 'revolve' ? !(points.length >= 2 && ok) : !(points.length >= 3 && ok);
    if (applyHint) applyHint.hidden = !(applyBtn && applyBtn.disabled);
  }

  function resetState() {
    try { if (config.bmp && typeof config.bmp.close === 'function') config.bmp.close(); } catch (_) {}
    config.bmp = null;
    imgRect = null;
    imgShiftX = 0;
    imgShiftY = 0;
    imgScale = 1;
    points = [];
    closed = false;
    panX = usesHalfCanvas() ? (w * 0.5) : 0;
    panY = 0;
    zoom = 1;
    step1Status = 'pending';
    if (errorEl) errorEl.textContent = '';
    if (applyBtn) applyBtn.disabled = true;
    if (applyHint) applyHint.hidden = true;
    if (scaleValEl) scaleValEl.textContent = '100%';
    refreshToolAvailability();
    render();
  }

  async function loadBitmapFromFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return null;
    try {
        return normalizeTraceBitmap(await createImageBitmap(file, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'default' }));
    } catch (_) {
      return await new Promise((resolve) => {
        try {
          const img = new Image();
          img.onload = async () => {
            const src = img.src;
            try { resolve(await normalizeTraceBitmap(await createImageBitmap(img))); } catch (_) { resolve(null); }
            try { if (src) URL.revokeObjectURL(src); } catch (_) {}
          };
          img.onerror = () => {
            const src = img.src;
            try { if (src) URL.revokeObjectURL(src); } catch (_) {}
            resolve(null);
          };
          const url = URL.createObjectURL(file);
          img.src = url;
        } catch (_) {
          resolve(null);
        }
      });
    }
  }

  function open() {
    // Keep this guard at the modal boundary as well as in Add Volume: keyboard
    // shortcuts and future callers must not bypass the phone-size constraint.
    try {
      const isPhoneCanvas = window.matchMedia('(max-width: 767px), (max-height: 520px) and (pointer: coarse)').matches;
      if (isPhoneCanvas) {
        showToast(tr('doodle_phone_unavailable'), 'info');
        return false;
      }
    } catch (_) {}
    const api = resolveEditorModalApi(config);
    if (api && typeof api.openDoodleModal === 'function') {
      try { api.openDoodleModal(); return; } catch (_) {}
    }
  }

  function close() {
    const api = resolveEditorModalApi(config);
    if (api && typeof api.closeDoodleModal === 'function') {
      try { api.closeDoodleModal(); return; } catch (_) {}
    }
  }

  function goStep2() {
    setStep(2);
    panX = usesHalfCanvas() ? (w * 0.5) : 0;
    panY = 0;
    zoom = 1;
    if (scaleValEl) scaleValEl.textContent = '100%';
    refreshToolAvailability();
    render();
    updateValidityUi();
  }

  function setZoom(nextZoom, anchorX, anchorY) {
    const p = screenToWorld(anchorX, anchorY);
    zoom = Math.max(0.2, Math.min(6.0, nextZoom));
    panX = anchorX - p.x * zoom;
    panY = anchorY - p.y * zoom;
    if (usesHalfCanvas()) panX = w * 0.5;
    if (scaleValEl) scaleValEl.textContent = Math.round(zoom * 100) + '%';
    render();
  }

  function clearPointerInteraction() {
    panning = false;
    moved = false;
    dragMode = '';
    dragRect = null;
    dragSx = 1;
    dragSy = 1;
    activePointerId = null;
    pointerGestureCancelled = false;
  }

  function abortPan(e) {
    if (!panning || !e || e.pointerId !== activePointerId) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    clearPointerInteraction();
    hoverPt = null;
    render();
  }

  function endPan(e) {
    if (!panning || !e || e.pointerId !== activePointerId) return;
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    // Only an ordinary release from the primary drawing pointer may add a
    // point. `pointercancel` is deliberately routed to abortPan instead.
    if (pointerGestureCancelled || e.type !== 'pointerup') {
      clearPointerInteraction();
      return;
    }
    const p = getCanvasPos(e);
    // The interaction that began this pointer sequence is authoritative. In
    // particular, a reference-image drag must never become a polygon point if
    // the Draw tool is selected before its pointerup is delivered on iPad.
    if (!moved && !closed && dragMode === 'point' && toolMode === 'draw') {
      const t2 = screenToWorld(p.x, p.y);
      if (usesHalfCanvas() && t2.x > 0) t2.x = 0;
      if (points.length >= 256) {
        if (errorEl) errorEl.textContent = t('doodle_error_too_many_points');
        updateValidityUi();
        render();
        clearPointerInteraction();
        return;
      }
      const last = points.length ? points[points.length - 1] : null;
      const t3 = last ? snapPoint(t2, last) : t2;
      if (usesHalfCanvas() && t3.x > 0) t3.x = 0;
      if (points.length >= 3) {
        const dx0 = t3.x - points[0].x;
        const dy0 = t3.y - points[0].y;
        const d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
        if (doodleMode !== 'revolve' && d0 <= Math.max(8, 14 / Math.max(0.25, zoom))) {
          closed = true;
          updateValidityUi();
          render();
          clearPointerInteraction();
          return;
        }
      }
      points.push({ x: t3.x, y: t3.y });
      XR?.DebugLog?.event?.('doodle.point.added', { index: points.length - 1, x: t3.x, y: t3.y, mode: doodleMode });
      updateValidityUi();
      render();
    }
    if (dragMode === 'img') {
      // A moved reference has no geometric meaning. Drop the preview point so
      // the next Draw gesture starts from a fresh canvas coordinate.
      hoverPt = null;
      render();
    }
    clearPointerInteraction();
  }

  function bind() {
    const api = resolveEditorModalApi(config);
    if (api && typeof api.bind === 'function') {
      try { api.bind(); } catch (_) {}
    }

    bindOnce(modePolygonBtn, '__xrDoodleModePolygonBound', 'click', () => setDoodleMode('polygon'));
    bindOnce(modeMirrorBtn, '__xrDoodleModeMirrorBound', 'click', () => setDoodleMode('mirror'));
    bindOnce(modeRevolveBtn, '__xrDoodleModeRevolveBound', 'click', () => setDoodleMode('revolve'));
    bindOnce(snapBtn, '__xrDoodleSnapBound', 'click', toggleSnap);
    bindOnce(toolDrawBtn, '__xrDoodleToolDrawBound', 'click', () => setToolMode('draw'));
    bindOnce(toolMoveBtn, '__xrDoodleToolMoveBound', 'click', () => setToolMode('move'));
    bindOnce(backBtn, '__xrDoodleBackBound', 'click', () => setStep(1));
    bindOnce(pickFile, '__xrDoodlePickFileBound', 'click', () => {
      try { if (fileInput) { fileInput.value = ''; fileInput.click(); } } catch (_) {}
    });
    bindOnce(pickCamera, '__xrDoodlePickCameraBound', 'click', () => {
      try { if (cameraInput) { cameraInput.value = ''; cameraInput.click(); } } catch (_) {}
    });
    bindOnce(skipImage, '__xrDoodleSkipImageBound', 'click', () => { config.bmp = null; imgRect = null; step1Status = 'skipped'; goStep2(); });

    bindOnce(fileInput, '__xrDoodleFileChangeBound', 'change', async () => {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const next = await loadBitmapFromFile(file);
      config.bmp = next;
      step1Status = next ? 'completed' : 'skipped';
      fitImageRect();
      goStep2();
    });
    bindOnce(cameraInput, '__xrDoodleCameraChangeBound', 'change', async () => {
      const file = cameraInput.files && cameraInput.files[0] ? cameraInput.files[0] : null;
      const next = await loadBitmapFromFile(file);
      config.bmp = next;
      step1Status = next ? 'completed' : 'skipped';
      fitImageRect();
      goStep2();
    });

    bindOnce(undoBtn, '__xrDoodleUndoBound', 'click', () => {
      if (!points.length) return;
      if (closed) { closed = false; updateValidityUi(); render(); return; }
      points.pop();
      updateValidityUi();
      render();
    });
    bindOnce(clearBtn, '__xrDoodleClearBound', 'click', () => {
      points = [];
      closed = false;
      updateValidityUi();
      render();
    });

    bindOnce(scaleDownBtn, '__xrDoodleScaleDownBound', 'click', () => setZoom(zoom / 1.15, w / 2, h / 2));
    bindOnce(scaleUpBtn, '__xrDoodleScaleUpBound', 'click', () => setZoom(zoom * 1.15, w / 2, h / 2));
    bindOnce(scaleResetBtn, '__xrDoodleScaleResetBound', 'click', () => { resetImageTransform(); setZoom(1, w / 2, h / 2); });
    bindOnce(scaleCenterBtn, '__xrDoodleScaleCenterBound', 'click', () => centerImageInContainer());

    if (canvas) {
      bindOnce(canvas, '__xrDoodleContextBound', 'contextmenu', (e) => { e.preventDefault(); undoBtn?.click(); });
      bindOnce(canvas, '__xrDoodlePointerDownBound', 'pointerdown', (e) => {
        // A second touch means a device gesture, never a second polygon point.
        // Abort the active stroke so neither contact can leave a phantom point.
        if (activePointerId !== null) {
          if (e.pointerId !== activePointerId) {
            pointerGestureCancelled = true;
            try { canvas.releasePointerCapture(activePointerId); } catch (_) {}
            clearPointerInteraction();
            hoverPt = null;
            render();
          }
          return;
        }
        if (e.pointerType === 'touch' && e.isPrimary === false) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        try {
          dragRect = canvas.getBoundingClientRect();
          dragSx = (dragRect.width > 0) ? (canvas.width / dragRect.width) : 1;
          dragSy = (dragRect.height > 0) ? (canvas.height / dragRect.height) : 1;
        } catch (_) {
          dragRect = null;
          dragSx = 1;
          dragSy = 1;
        }
        const p = getCanvasPos(e);
        panning = true;
        moved = false;
        activePointerId = e.pointerId;
        pointerGestureCancelled = false;
        dragMode = ((e.button === 1) || !!e.shiftKey) ? 'pan' : (toolMode === 'move' ? 'img' : 'point');
        prevX = p.x;
        prevY = p.y;
      });
      bindOnce(canvas, '__xrDoodlePointerMoveBound', 'pointermove', (e) => {
        if (panning && e.pointerId !== activePointerId) return;
        e.preventDefault();
        const p = getCanvasPos(e);
        const w0 = screenToWorld(p.x, p.y);
        if (usesHalfCanvas() && w0.x > 0) w0.x = 0;
        hoverPt = (!closed) ? w0 : null;
        if (!panning) { render(); return; }
        const dx = p.x - prevX;
        const dy = p.y - prevY;
        // The CSS canvas is smaller than its 720px backing store on phones.
        // Use a physical-finger slop, not a fixed backing-pixel threshold, so
        // ordinary tap jitter on an image still creates exactly one point.
        const tapSlop = (e.pointerType === 'touch')
          ? 10 * Math.max(dragSx, dragSy)
          : 3;
        if (Math.abs(dx) + Math.abs(dy) > tapSlop) moved = true;
        if (dragMode === 'pan') {
          if (!usesHalfCanvas()) panX += dx;
          panY += dy;
        } else if (dragMode === 'img') {
          imgShiftX += dx / Math.max(0.0001, zoom);
          imgShiftY += dy / Math.max(0.0001, zoom);
        }
        prevX = p.x;
        prevY = p.y;
        render();
      });
      bindOnce(canvas, '__xrDoodlePointerUpBound', 'pointerup', endPan);
      bindOnce(canvas, '__xrDoodlePointerCancelBound', 'pointercancel', abortPan);
      bindOnce(canvas, '__xrDoodleWheelBound', 'wheel', (e) => {
        e.preventDefault();
        const p = getCanvasPos(e);
        const factor = Math.exp(-e.deltaY * 0.001);
        setZoom(zoom * factor, p.x, p.y);
      }, { passive: false });
    }

    bindOnce(applyBtn, '__xrDoodleApplyBound', 'click', () => {
      if (!points.length || applyBtn.disabled) return;
      if (doodleMode === 'polygon' && !closed) {
        closed = true;
        render();
      }
      if (doodleMode === 'polygon' && points.length > 96) {
        const simplified = simplifyPolygonPoints(points);
        if (Array.isArray(simplified) && simplified.length >= 3 && simplified.length < points.length) {
          points = simplified;
          updateValidityUi();
          render();
          if (applyBtn.disabled) return;
        }
      }
      // `XR.addDoodleShapeToScene` is the legacy command bridge configured by
      // the live editor.  The generic Shapes facade can exist before that
      // command has received its editor dependencies, which made Apply fail
      // even though the polygon was valid.  Prefer the configured command and
      // retain the public facade as a compatibility fallback.
      const addDoodle = XR?.addDoodleShapeToScene || XR?.Shapes?.addDoodle || null;
      const id = typeof addDoodle === 'function'
        ? addDoodle(points, (doodleMode === 'revolve') ? { segments: 64 } : { depth: 0.5 }, { mode: doodleMode })
        : null;
      if (!id) {
        console.error('[doodle] extrusion command returned no shape', { pointCount: points.length, mode: doodleMode, hasCommand: typeof addDoodle === 'function' });
        XR?.DebugLog?.event?.('doodle.create.failure', { pointCount: points.length, mode: doodleMode, hasCommand: typeof addDoodle === 'function' });
        if (errorEl) errorEl.textContent = t('doodle_error_extrude_failed');
        return;
      }
      XR?.DebugLog?.event?.('doodle.create.success', { id, pointCount: points.length, mode: doodleMode });
      try { showToast(tr('toast_polygon_created'), 'success'); } catch (_) {}
      close();
    });
  }

  config.setStep = setStep;
  config.resetState = resetState;
  config.applyModeUi = applyModeUi;
  config.setToolMode = setToolMode;
  config.applySnapUi = applySnapUi;
  config.refreshToolAvailability = refreshToolAvailability;

  const api = {
    bind,
    openDoodleModal: open,
    closeDoodleModal: close,
  };

  XR.__modules.ShellDoodleModal = XR.__modules.ShellDoodleModal || {};
  XR.__modules.ShellDoodleModal._instance = api;
  return api;
}

XR.__modules.ShellDoodleModal = XR.__modules.ShellDoodleModal || {};
XR.__modules.ShellDoodleModal.create = create;

function eagerBootstrap() {
  try {
    const translate = (key) => {
      try {
        if (typeof XR?.tr === 'function') return XR.tr(key);
      } catch (_) {}
      return String(key);
    };
    const api = create({
      t: translate,
      tr: translate,
      showToast: (msg, type) => {
        try { XR?.showToast?.(msg, type); } catch (_) {}
      },
    });
    try { api?.bind?.(); } catch (_) {}
  } catch (_) {}
}

if (document.readyState === 'loading') {
  try { window.addEventListener('DOMContentLoaded', eagerBootstrap, { once: true }); } catch (_) {}
} else {
  try { window.setTimeout(eagerBootstrap, 0); } catch (_) {}
}
try { window.addEventListener('load', eagerBootstrap, { once: true }); } catch (_) {}
