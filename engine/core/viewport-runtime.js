export function updateViewportScaleLabel(ctx) {
  const documentRef = ctx?.document || document;
  const gridSize = Number(ctx?.gridSize) || 0;
  const gridDivisions = Number(ctx?.gridDivisions) || 1;
  const gridUnits = String(ctx?.gridUnits || '');
  const el = documentRef.getElementById('viewportScaleLabel');
  if (!el) return false;
  const step = gridDivisions ? (gridSize / gridDivisions) : 0;
  el.textContent = `Scale: 1u = 1${gridUnits} · Grid: ${step.toFixed(2)}${gridUnits}`;
  return true;
}

export function updateInfoForMesh(ctx) {
  const documentRef = ctx?.document || document;
  const mesh = ctx?.mesh || null;
  const THREERef = ctx?.THREE || window.THREE;
  const tr = (typeof ctx?.tr === 'function') ? ctx.tr : ((k) => String(k || ''));
  const getUvModeLabel = (typeof ctx?.getUvModeLabel === 'function') ? ctx.getUvModeLabel : ((v) => String(v || ''));
  const uvMode = ctx?.uvMode;
  const gridUnits = String(ctx?.gridUnits || '');
  const dimsEl = documentRef.getElementById('viewportDimsLabel');
  if (!mesh || !mesh.geometry) {
    if (dimsEl) dimsEl.textContent = '';
    const vertsEl = documentRef.getElementById('infoVerts');
    const facesEl = documentRef.getElementById('infoFaces');
    const uvEl = documentRef.getElementById('infoUV');
    if (vertsEl) vertsEl.textContent = '';
    if (facesEl) facesEl.textContent = '';
    if (uvEl) uvEl.textContent = '';
    return false;
  }
  const geo = mesh.geometry;
  const vertsEl = documentRef.getElementById('infoVerts');
  const facesEl = documentRef.getElementById('infoFaces');
  const uvEl = documentRef.getElementById('infoUV');
  if (vertsEl) vertsEl.textContent = tr('scene_verts_short') + ': ' + geo.attributes.position.count;
  if (facesEl) facesEl.textContent = tr('scene_tris_short') + ': ' + (((geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3) | 0));
  if (uvEl) uvEl.textContent = 'UV: ' + getUvModeLabel(uvMode);
  if (dimsEl) {
    try {
      const box = new THREERef.Box3().setFromObject(mesh);
      const size = new THREERef.Vector3();
      box.getSize(size);
      const fmt = (n) => {
        const v = (typeof n === 'number' && isFinite(n)) ? n : 0;
        return (Math.round(v * 100) / 100).toFixed(2);
      };
      dimsEl.textContent = `Dims: ${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} ${gridUnits}`;
    } catch (_) {
      dimsEl.textContent = '';
    }
  }
  return true;
}

export function setViewportTransformReadout(ctx) {
  const documentRef = ctx?.document || document;
  const threeCanvas = ctx?.threeCanvas || null;
  const text = ctx?.text;
  const event = ctx?.event || null;
  const el = documentRef.getElementById('viewportXformReadout');
  if (!el) return false;
  const msg = String(text || '').trim();
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    return true;
  }
  el.textContent = msg;
  el.hidden = false;
  if (!threeCanvas || !event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return true;
  const rect = threeCanvas.getBoundingClientRect();
  const x0 = event.clientX - rect.left;
  const y0 = event.clientY - rect.top;
  const x = Math.max(12, Math.min(Math.max(12, rect.width - 12), x0));
  const y = Math.max(12, Math.min(Math.max(12, rect.height - 12), y0));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  return true;
}

export function isViewportWasdContextActive(ctx) {
  const documentRef = ctx?.document || document;
  const threeCanvas = ctx?.threeCanvas || null;
  try { return documentRef.activeElement === threeCanvas; } catch (_) { return false; }
}

export function updateViewportWasd(ctx) {
  const dt = Number(ctx?.dt);
  const refs = ctx?.refs || {};
  const keys = ctx?.viewportWasdKeys || null;
  const threeCanvas = ctx?.threeCanvas || null;
  const THREERef = ctx?.THREE || null;
  const documentRef = ctx?.document || document;
  if (!dt || !isFinite(dt) || dt <= 0) return false;
  if (!keys || !threeCanvas || !THREERef) return false;
  if (!isViewportWasdContextActive({ document: documentRef, threeCanvas })) return false;
  if (refs.gizmoDragging || refs.isDragging) return false;
  if (refs.viewportView !== 'free') return false;
  if (refs.camera !== refs.perspCamera) return false;

  let x = 0;
  let y = 0;
  let z = 0;
  if (keys.has('KeyW')) z += 1;
  if (keys.has('KeyS')) z -= 1;
  if (keys.has('KeyA')) x -= 1;
  if (keys.has('KeyD')) x += 1;
  if (keys.has('KeyE')) y += 1;
  if (keys.has('KeyQ')) y -= 1;
  if (!x && !y && !z) return false;

  const forward = new THREERef.Vector3();
  try { refs.camera.getWorldDirection(forward); } catch (_) { forward.set(0, 0, -1); }
  forward.y = 0;
  const len = forward.length();
  if (len > 1e-6) forward.multiplyScalar(1 / len);
  else forward.set(0, 0, -1);
  const up = new THREERef.Vector3(0, 1, 0);
  const right = new THREERef.Vector3().crossVectors(forward, up);
  const move = new THREERef.Vector3();
  move.addScaledVector(right, x);
  move.addScaledVector(forward, z);
  move.addScaledVector(up, y);
  const moveLen = move.length();
  if (moveLen > 1e-6) move.multiplyScalar(1 / moveLen);

  const spherical = refs.spherical || { radius: 3.5 };
  const orbitTarget = refs.orbitTarget || null;
  if (!orbitTarget || typeof orbitTarget.addScaledVector !== 'function') return false;
  const base = 1.8 * Math.max(0.6, Math.min(3.0, spherical.radius / 3.5));
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? base * 3.0 : base;
  const slow = keys.has('AltLeft') || keys.has('AltRight') ? 0.35 : 1.0;
  orbitTarget.addScaledVector(move, speed * slow * dt);
  try { ctx.sphericalToXYZ && ctx.sphericalToXYZ(); } catch (_) {}
  return true;
}

export function bindViewportEventWiring(ctx) {
  const threeCanvas = ctx?.threeCanvas || null;
  const documentRef = ctx?.document || document;
  const editorCleanupFns = Array.isArray(ctx?.editorCleanupFns) ? ctx.editorCleanupFns : null;
  const registerCleanup = (typeof ctx?.registerCleanup === 'function')
    ? ctx.registerCleanup
    : (editorCleanupFns ? ((cleanup) => editorCleanupFns.push(cleanup)) : null);
  const getRefs = (typeof ctx?.getRefs === 'function')
    ? ctx.getRefs
    : (() => (ctx?.refs || {}));
  if (!threeCanvas || !registerCleanup) return false;

  const markDirty = (frames = 30) => {
    try {
      const runtimeState = (typeof ctx?.stateRef === 'object' && ctx.stateRef) ? ctx.stateRef : null;
      if (runtimeState) {
        const current = Number(runtimeState._dirtyFramesRemaining) || 0;
        runtimeState._dirtyFramesRemaining = Math.max(current, Number(frames) || 0);
      }
    } catch (_) {}
  };

  const onCanvasFocusPointerDown = () => {
    try { threeCanvas.focus({ preventScroll: true }); } catch (_) { try { threeCanvas.focus(); } catch (_) {} }
  };
  const onViewportWasdKeyDown = (e) => {
    if (!e) return;
    if (!isViewportWasdContextActive({ document: documentRef, threeCanvas })) return;
    if (e.ctrlKey || e.metaKey) return;
    const code = String(e.code || '');
    if (
      code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
      || code === 'KeyQ' || code === 'KeyE'
      || code === 'ShiftLeft' || code === 'ShiftRight'
      || code === 'AltLeft' || code === 'AltRight'
    ) {
      ctx.viewportWasdKeys.add(code);
      markDirty(30);
      e.preventDefault();
    }
  };
  const onViewportWasdKeyUp = (e) => {
    if (!e) return;
    const code = String(e.code || '');
    if (ctx.viewportWasdKeys.has(code)) ctx.viewportWasdKeys.delete(code);
    if (code) markDirty(15);
  };
  const onViewportVisibilityChange = () => {
    if (documentRef.hidden) ctx.viewportWasdKeys.clear();
    else markDirty(60);
  };
  const isPhoneViewport = () => {
    try { return documentRef.defaultView?.matchMedia?.('(max-width: 767px)').matches === true; } catch (_) { return false; }
  };
  const onViewportWheel = (e) => {
    const refs = getRefs() || {};
    if (!e) return;
    // On a phone the canvas occupies the top of the document. Let wheel and
    // trackpad gestures continue to the page so its accordion panels remain
    // reachable; desktop and tablet retain viewport zoom.
    if (isPhoneViewport()) return;
    if (refs.camera === refs.orthoCamera) {
      const next = refs.orthoZoom * (1 - e.deltaY * 0.001);
      refs.orthoZoom = ctx.clampSnap(next, 0.3, 3.0, 0);
      refs.orthoCamera.zoom = refs.orthoZoom;
      refs.orthoCamera.updateProjectionMatrix();
      try { ctx.persistViewportSettings && ctx.persistViewportSettings(); } catch (_) {}
    } else {
      refs.spherical.radius = Math.max(1, Math.min(200, refs.spherical.radius + e.deltaY * 0.005));
      try { ctx.sphericalToXYZ && ctx.sphericalToXYZ(); } catch (_) {}
      try { ctx.persistViewportSettings && ctx.persistViewportSettings(); } catch (_) {}
    }
    markDirty(10);
    e.preventDefault();
  };

  const wrapOrbitPointerDown = typeof ctx.onOrbitPointerDown === 'function' ? function(e){ markDirty(60); try { return ctx.onOrbitPointerDown(e); } catch (_) {} } : null;
  const wrapOrbitPointerMove = typeof ctx.onOrbitPointerMove === 'function' ? function(e){ markDirty(30); try { return ctx.onOrbitPointerMove(e); } catch (_) {} } : null;
  const wrapOrbitPointerUp = typeof ctx.onOrbitPointerUp === 'function' ? function(e){ markDirty(15); try { return ctx.onOrbitPointerUp(e); } catch (_) {} } : null;
  const finalPointerDown = wrapOrbitPointerDown || ctx.onOrbitPointerDown;
  const finalPointerMove = wrapOrbitPointerMove || ctx.onOrbitPointerMove;
  const finalPointerUp = wrapOrbitPointerUp || ctx.onOrbitPointerUp;

  threeCanvas.addEventListener('pointerdown', finalPointerDown);
  registerCleanup(() => { try { threeCanvas.removeEventListener('pointerdown', finalPointerDown); } catch (_) {} });
  threeCanvas.addEventListener('pointermove', finalPointerMove);
  registerCleanup(() => { try { threeCanvas.removeEventListener('pointermove', finalPointerMove); } catch (_) {} });
  threeCanvas.addEventListener('pointerup', finalPointerUp);
  registerCleanup(() => { try { threeCanvas.removeEventListener('pointerup', finalPointerUp); } catch (_) {} });
  threeCanvas.addEventListener('pointercancel', finalPointerUp);
  registerCleanup(() => { try { threeCanvas.removeEventListener('pointercancel', finalPointerUp); } catch (_) {} });
  try { threeCanvas.tabIndex = 0; } catch (_) {}
  threeCanvas.addEventListener('pointerdown', onCanvasFocusPointerDown, true);
  registerCleanup(() => { try { threeCanvas.removeEventListener('pointerdown', onCanvasFocusPointerDown, true); } catch (_) {} });
  documentRef.addEventListener('keydown', onViewportWasdKeyDown, true);
  registerCleanup(() => { try { documentRef.removeEventListener('keydown', onViewportWasdKeyDown, true); } catch (_) {} });
  documentRef.addEventListener('keyup', onViewportWasdKeyUp, true);
  registerCleanup(() => { try { documentRef.removeEventListener('keyup', onViewportWasdKeyUp, true); } catch (_) {} });
  documentRef.addEventListener('visibilitychange', onViewportVisibilityChange, true);
  registerCleanup(() => { try { documentRef.removeEventListener('visibilitychange', onViewportVisibilityChange, true); } catch (_) {} });
  threeCanvas.addEventListener('wheel', onViewportWheel, { passive: false });
  registerCleanup(() => { try { threeCanvas.removeEventListener('wheel', onViewportWheel); } catch (_) {} });
  return true;
}

export function bindViewportResize(ctx) {
  const threeWrap = ctx?.threeWrap || null;
  const editorCleanupFns = Array.isArray(ctx?.editorCleanupFns) ? ctx.editorCleanupFns : null;
  const registerCleanup = (typeof ctx?.registerCleanup === 'function')
    ? ctx.registerCleanup
    : (editorCleanupFns ? ((cleanup) => editorCleanupFns.push(cleanup)) : null);
  const stateRef = ctx?.stateRef || null;
  if (!threeWrap || !registerCleanup) return null;
  const markDirtyAfterResize = (frames = 60) => {
    try {
      if (stateRef && typeof stateRef === 'object') {
        const cur = Number(stateRef._dirtyFramesRemaining) || 0;
        if (frames > cur) stateRef._dirtyFramesRemaining = frames;
      }
    } catch (_) {}
  };
  let observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      try { ctx.resizeRenderer && ctx.resizeRenderer(); } catch (_) {}
      markDirtyAfterResize(60);
    });
    observer.observe(threeWrap);
    registerCleanup(() => { try { observer && observer.disconnect && observer.disconnect(); } catch (_) {} });
  }
  const initialResizeTimer = setTimeout(() => {
    try { ctx.resizeRenderer && ctx.resizeRenderer(); } catch (_) {}
    markDirtyAfterResize(90);
  }, 50);
  registerCleanup(() => {
    try { clearTimeout(initialResizeTimer); } catch (err) { console.warn('[viewport] initial resize timer cleanup failed', err); }
  });
  return observer;
}

export function createViewportAnimator(ctx) {
  const stateRef = ctx?.stateRef || {};
  const getRefs = (typeof ctx?.getRefs === 'function')
    ? ctx.getRefs
    : (() => (ctx?.refs || {}));
  const SAFETY_NET_FRAMES = 60;
  const COOLDOWN_FRAMES = 30;
  const LONG_COOLDOWN_FRAMES = 60;
  const BOOT_FRAMES = 180;

  let frameCount = 0;
  let dirtyFramesRemaining = BOOT_FRAMES;
  let lastCamSig = '';
  let lastSelectionId = null;

  const markDirty = (frames = COOLDOWN_FRAMES) => {
    const f = frames | 0;
    if (f > dirtyFramesRemaining) dirtyFramesRemaining = f;
    try {
      if (stateRef && typeof stateRef === 'object') {
        const shared = Number(stateRef._dirtyFramesRemaining) || 0;
        if (f > shared) stateRef._dirtyFramesRemaining = f;
      }
    } catch (_) {}
  };

  const animate = function () {
    try {
      if (stateRef && typeof stateRef === 'object') {
        const shared = Number(stateRef._dirtyFramesRemaining) || 0;
        if (shared > 0) {
          if (shared > dirtyFramesRemaining) dirtyFramesRemaining = shared;
          stateRef._dirtyFramesRemaining = 0;
        }
      }
    } catch (_) {}
    frameCount++;
    const refs = getRefs() || {};
    const now = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
    const lastT = (typeof stateRef.viewportWasdLastT === 'number') ? stateRef.viewportWasdLastT : now;
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    stateRef.viewportWasdLastT = now;

    let wasdMoved = false;
    try {
      wasdMoved = !!updateViewportWasd({
        dt,
        refs,
        viewportWasdKeys: ctx.viewportWasdKeys,
        threeCanvas: ctx.threeCanvas,
        THREE: ctx.THREE,
        document: ctx.document || document,
        sphericalToXYZ: ctx.sphericalToXYZ,
      });
    } catch (_) { wasdMoved = false; }
    if (wasdMoved) markDirty();

    if (ctx.viewportWasdKeys && ctx.viewportWasdKeys.size > 0) markDirty();
    if (refs.gizmoDragging || refs.isDragging || refs.orbitMoved === true) markDirty(LONG_COOLDOWN_FRAMES);

    const selectionHelper = ctx.getSelectionHelper?.() || null;
    const currentMesh = ctx.getCurrentMesh?.() || null;
    const selId = (currentMesh && typeof currentMesh.id === 'number')
      ? currentMesh.id
      : ((currentMesh && (currentMesh.uuid || currentMesh.id)) ? String(currentMesh.uuid || currentMesh.id) : null);
    if (selId !== lastSelectionId) {
      lastSelectionId = selId;
      markDirty(15);
    }
    if (selectionHelper && currentMesh) {
      try { selectionHelper.setFromObject(currentMesh); } catch (_) {}
    }
    if (refs.gizmoRoot) {
      try { ctx.updateGizmo && ctx.updateGizmo(); } catch (_) {}
    }

    const cam = refs.camera;
    if (cam && typeof cam.updateMatrixWorld === 'function') {
      try {
        if (cam.matrixWorldNeedsUpdate || !lastCamSig) cam.updateMatrixWorld(true);
        const mw = cam.matrixWorld && cam.matrixWorld.elements;
        if (mw && mw.length >= 16) {
          const sig = (mw[0] | 0) + ',' + (mw[12] * 1000 | 0) + ',' + (mw[13] * 1000 | 0) + ',' + (mw[14] * 1000 | 0) + ',' + (mw[15] * 1000 | 0);
          if (sig !== lastCamSig) {
            lastCamSig = sig;
            markDirty(3);
          }
        }
      } catch (_) {}
    }

    if (frameCount % SAFETY_NET_FRAMES === 0) markDirty(1);

    if (dirtyFramesRemaining > 0) {
      dirtyFramesRemaining--;
      try { refs.renderer.render(refs.scene, refs.camera); } catch (_) {}
    }
  };

  animate.markDirty = markDirty;
  try { ctx.onMarkDirty && ctx.onMarkDirty(markDirty); } catch (_) {}

  return animate;
}
