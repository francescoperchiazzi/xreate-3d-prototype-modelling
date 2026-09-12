import { event as debugEvent } from '../debug/event-log.js';

const GIZMO_ROOT_FLAG = 'xreateGizmoRoot';
const GIZMO_ROOT_NAME = 'XReateGizmoRoot';

function getGizmoRoots(scene) {
  const roots = [];
  if (!scene || typeof scene.traverse !== 'function') return roots;
  scene.traverse((node) => {
    if (node?.userData?.[GIZMO_ROOT_FLAG] === true) roots.push(node);
  });
  return roots;
}

// A gizmo is an editor singleton, never a per-part scene resource.  Keeping
// this cleanup at the scene boundary makes accidental bridge re-initialisation
// visible and prevents its abandoned root from remaining at a former pivot.
export function pruneDuplicateGizmoRoots(scene, keepRoot) {
  const duplicates = getGizmoRoots(scene).filter((root) => root !== keepRoot);
  for (const root of duplicates) {
    root.visible = false;
    root.parent?.remove?.(root);
  }
  if (duplicates.length) {
    debugEvent('gizmo.duplicate.pruned', { count: duplicates.length });
  }
  return duplicates.length;
}

export function ensureGizmo(ctx) {
  const refs = ctx?.refs || (ctx ? ctx : {});
  const scene = ctx?.scene || (refs && refs.scene) || null;
  const THREERef = ctx?.THREE || (refs && refs.THREE) || null;
  const gizmoVisuals = ctx?.gizmoVisuals || (refs && refs.gizmoVisuals) || {};
  const gizmoColliders = ctx?.gizmoColliders || (refs && refs.gizmoColliders) || {};
  if (!scene || !THREERef) return;
  if (refs.gizmoRoot) {
    refs.gizmoRoot.userData ||= {};
    refs.gizmoRoot.userData[GIZMO_ROOT_FLAG] = true;
    refs.gizmoRoot.name = GIZMO_ROOT_NAME;
    pruneDuplicateGizmoRoots(scene, refs.gizmoRoot);
    return refs.gizmoRoot;
  }

  refs.gizmoRoot = new THREERef.Group();
  refs.gizmoRoot.name = GIZMO_ROOT_NAME;
  refs.gizmoRoot.userData[GIZMO_ROOT_FLAG] = true;
  refs.gizmoRoot.visible = false;
  refs.gizmoRoot.renderOrder = 1000;

  gizmoVisuals.move = new THREERef.Group();
  gizmoVisuals.rotate = new THREERef.Group();
  gizmoVisuals.scale = new THREERef.Group();

  function makeMoveAxis(axis, color) {
    const g = new THREERef.Group();
    const mat = new THREERef.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
    const shaft = new THREERef.Mesh(new THREERef.CylinderGeometry(0.02, 0.02, 0.9, 12), mat);
    const tip = new THREERef.Mesh(new THREERef.ConeGeometry(0.05, 0.18, 14), mat);
    shaft.position.y = 0.45;
    tip.position.y = 0.99;
    const colMat = new THREERef.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });
    const col = new THREERef.Mesh(new THREERef.CylinderGeometry(0.08, 0.08, 1.25, 10), colMat);
    col.position.y = 0.62;
    col.userData.gizmoAxis = axis;
    col.userData.gizmoMode = 'move';
    g.add(shaft);
    g.add(tip);
    g.add(col);
    if (axis === 'x') g.rotation.z = -Math.PI / 2;
    if (axis === 'z') g.rotation.x = Math.PI / 2;
    return { group: g, collider: col };
  }

  function makeRotateRing(axis, color) {
    const g = new THREERef.Group();
    const mat = new THREERef.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
    const ring = new THREERef.Mesh(new THREERef.TorusGeometry(0.75, 0.015, 10, 64), mat);
    const colMat = new THREERef.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });
    const col = new THREERef.Mesh(new THREERef.TorusGeometry(0.75, 0.08, 8, 32), colMat);
    col.userData.gizmoAxis = axis;
    col.userData.gizmoMode = 'rotate';
    g.add(ring);
    g.add(col);
    if (axis === 'x') g.rotation.z = -Math.PI / 2;
    if (axis === 'z') g.rotation.x = Math.PI / 2;
    return { group: g, collider: col };
  }

  function makeScaleHandle(axis, color) {
    const g = new THREERef.Group();
    const mat = new THREERef.MeshBasicMaterial({ color, depthTest: false, depthWrite: false });
    const box = new THREERef.Mesh(new THREERef.BoxGeometry(0.12, 0.12, 0.12), mat);
    const colMat = new THREERef.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });
    const col = new THREERef.Mesh(new THREERef.BoxGeometry(0.32, 0.32, 0.32), colMat);
    col.userData.gizmoAxis = axis;
    col.userData.gizmoMode = 'scale';
    const d = 1.05;
    if (axis === 'x') { box.position.set(d, 0, 0); col.position.set(d, 0, 0); }
    if (axis === 'y') { box.position.set(0, d, 0); col.position.set(0, d, 0); }
    if (axis === 'z') { box.position.set(0, 0, d); col.position.set(0, 0, d); }
    g.add(box);
    g.add(col);
    return { group: g, collider: col };
  }

  const mx = makeMoveAxis('x', 0xff3333);
  const my = makeMoveAxis('y', 0x33ff33);
  const mz = makeMoveAxis('z', 0x3366ff);
  mx.group.traverse((o) => { o.renderOrder = 1001; });
  my.group.traverse((o) => { o.renderOrder = 1002; });
  mz.group.traverse((o) => { o.renderOrder = 1003; });
  gizmoVisuals.move.add(mx.group, my.group, mz.group);
  gizmoColliders.move = { x: mx.collider, y: my.collider, z: mz.collider };

  const rx = makeRotateRing('x', 0xff3333);
  const ry = makeRotateRing('y', 0x33ff33);
  const rz = makeRotateRing('z', 0x3366ff);
  rx.group.traverse((o) => { o.renderOrder = 1011; });
  ry.group.traverse((o) => { o.renderOrder = 1012; });
  rz.group.traverse((o) => { o.renderOrder = 1013; });
  gizmoVisuals.rotate.add(rx.group, ry.group, rz.group);
  gizmoColliders.rotate = { x: rx.collider, y: ry.collider, z: rz.collider };

  const sx = makeScaleHandle('x', 0xff3333);
  const sy = makeScaleHandle('y', 0x33ff33);
  const sz = makeScaleHandle('z', 0x3366ff);
  sx.group.traverse((o) => { o.renderOrder = 1021; });
  sy.group.traverse((o) => { o.renderOrder = 1022; });
  sz.group.traverse((o) => { o.renderOrder = 1023; });
  gizmoVisuals.scale.add(sx.group, sy.group, sz.group);
  gizmoColliders.scale = { x: sx.collider, y: sy.collider, z: sz.collider };

  refs.gizmoRoot.add(gizmoVisuals.move, gizmoVisuals.rotate, gizmoVisuals.scale);
  scene.add(refs.gizmoRoot);
  const pruned = pruneDuplicateGizmoRoots(scene, refs.gizmoRoot);
  debugEvent('gizmo.created', { prunedDuplicates: pruned });
  return refs.gizmoRoot;
}

export function updateGizmo(ctx) {
  const refs = ctx?.refs || {};
  const gizmoRoot = ctx?.gizmoRoot || refs.gizmoRoot || null;
  const currentMesh = (ctx && (typeof ctx.currentMesh !== 'undefined') ? ctx.currentMesh : null) || refs.currentMesh || null;
  const camera = ctx?.camera || refs.camera || null;
  const gizmoVisuals = ctx?.gizmoVisuals || refs.gizmoVisuals || null;
  const gizmoMode = ctx?.gizmoMode || refs.gizmoMode || 'move';
  const scene = ctx?.scene || refs.scene || null;
  if (!gizmoRoot) return;
  pruneDuplicateGizmoRoots(scene, gizmoRoot);
  if (!currentMesh) {
    gizmoRoot.visible = false;
    return;
  }
  gizmoRoot.visible = true;
  currentMesh.getWorldPosition(gizmoRoot.position);
  const d = camera.position.distanceTo(gizmoRoot.position);
  const s = Math.max(0.25, Math.min(1.2, d * 0.15));
  gizmoRoot.scale.set(s, s, s);
  if (gizmoVisuals?.move) gizmoVisuals.move.visible = (gizmoMode === 'move');
  if (gizmoVisuals?.rotate) gizmoVisuals.rotate.visible = (gizmoMode === 'rotate');
  if (gizmoVisuals?.scale) gizmoVisuals.scale.visible = (gizmoMode === 'scale');
}

export function setGizmoMode(ctx) {
  const nextMode = ctx?.nextMode;
  const currentMode = ctx?.currentMode || 'move';
  const setCurrentMode = ctx?.setCurrentMode || null;
  const buttons = ctx?.buttons || {};
  const update = ctx?.updateGizmo || null;
  const opts = ctx?.opts || null;
  const showToast = ctx?.showToast || null;
  const tr = ctx?.tr || null;

  const m = (nextMode === 'rotate' || nextMode === 'scale') ? nextMode : 'move';
  if (typeof setCurrentMode === 'function') setCurrentMode(m);

  const bMove = buttons.move || null;
  const bRot = buttons.rotate || null;
  const bScale = buttons.scale || null;
  if (bMove) {
    const on = m === 'move';
    bMove.classList.toggle('is-active', on);
    bMove.setAttribute('aria-checked', on ? 'true' : 'false');
    bMove.setAttribute('tabindex', on ? '0' : '-1');
  }
  if (bRot) {
    const on = m === 'rotate';
    bRot.classList.toggle('is-active', on);
    bRot.setAttribute('aria-checked', on ? 'true' : 'false');
    bRot.setAttribute('tabindex', on ? '0' : '-1');
  }
  if (bScale) {
    const on = m === 'scale';
    bScale.classList.toggle('is-active', on);
    bScale.setAttribute('aria-checked', on ? 'true' : 'false');
    bScale.setAttribute('tabindex', on ? '0' : '-1');
  }
  try { update && update(); } catch (_) {}
  const silent = !!(opts && opts.silent);
  if (!silent && currentMode !== m) {
    try {
      const key = m === 'rotate' ? 'status_tool_rotate' : (m === 'scale' ? 'status_tool_scale' : 'status_tool_move');
      showToast && showToast(tr ? tr(key) : key, 'info');
    } catch (_) {}
  }
}

function rememberOrbitTouch(refs, event) {
  if (!refs || event?.pointerType !== 'touch') return 0;
  refs.orbitTouchPoints ||= new Map();
  refs.orbitTouchPoints.set(String(event.pointerId), { x: event.clientX, y: event.clientY });
  return refs.orbitTouchPoints.size;
}

function forgetOrbitTouch(refs, event) {
  if (!refs?.orbitTouchPoints || event?.pointerType !== 'touch') return 0;
  refs.orbitTouchPoints.delete(String(event.pointerId));
  return refs.orbitTouchPoints.size;
}

function orbitTouchMidpoint(refs) {
  const points = Array.from(refs?.orbitTouchPoints?.values?.() || []);
  if (points.length < 2) return null;
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

export function onOrbitPointerDown(ctx) {
  const e = ctx?.event || null;
  const refs = ctx?.refs || {};
  const setViewportTransformReadout = ctx?.setViewportTransformReadout || null;
  const ensureGizmoFn = ctx?.ensureGizmo || null;
  const updateGizmoFn = ctx?.updateGizmo || null;
  const hitTestGizmoFromPointer = ctx?.hitTestGizmoFromPointer || null;
  const getSelectedPart = ctx?.getSelectedPart || null;
  const ensureTransformState = ctx?.ensureTransformState || null;
  const getShapeScaleFactors = ctx?.getShapeScaleFactors || null;
  const axisDragPlaneNormal = ctx?.axisDragPlaneNormal || null;
  const rotateVectorFromRay = ctx?.rotateVectorFromRay || null;
  const hitTestPartIdFromPointer = ctx?.hitTestPartIdFromPointer || null;
  const threeCanvas = ctx?.threeCanvas || null;
  const raycaster = ctx?.raycaster || null;
  const camera = ctx?.camera || null;
  const THREERef = ctx?.THREE || null;
  const gizmoPlane = ctx?.gizmoPlane || null;
  const getGlobalPanLock = ctx?.getGlobalPanLock || (() => false);
  refs.orbitMoved = false;
  if (!e) return false;
  const touchCount = rememberOrbitTouch(refs, e);
  if (e.pointerType === 'touch' && touchCount >= 2) {
    const midpoint = orbitTouchMidpoint(refs);
    refs.touchPanActive = true;
    refs.panMode = true;
    refs.isDragging = true;
    refs.orbitMoved = true;
    refs.pendingPickPartId = null;
    refs.gizmoDragging = false;
    refs.prevMouse = midpoint || { x: e.clientX, y: e.clientY };
    try { e.preventDefault && e.preventDefault(); } catch (_) {}
    return true;
  }
  const btn = typeof e.button === 'number' ? e.button : 0;
  const globalPanLock = !!getGlobalPanLock();
  const forcePanByKey = (e.shiftKey && btn === 0) || !!refs.panLockMode || globalPanLock;
  const isPanButton = (btn === 1) || (btn === 2) || forcePanByKey;
  if (btn !== 0 && !isPanButton) return false;
  try { setViewportTransformReadout && setViewportTransformReadout('', null); } catch (_) {}
  try { ensureGizmoFn && ensureGizmoFn(); } catch (_) {}
  try { updateGizmoFn && updateGizmoFn(); } catch (_) {}
  if (isPanButton) {
    refs.panMode = true;
    refs.isDragging = true;
    refs.orbitMoved = true;
    refs.pendingPickPartId = null;
    refs.gizmoDragging = false;
    refs.prevMouse = { x: e.clientX, y: e.clientY };
    if (threeCanvas.setPointerCapture && e.pointerId !== undefined) {
      try { threeCanvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    try { e.preventDefault && e.preventDefault(); } catch (_) {}
    return true;
  }
  const hit = hitTestGizmoFromPointer ? hitTestGizmoFromPointer(e) : null;
  if (hit && hit.axis) {
    refs.gizmoDragging = true;
    refs.gizmoActiveMode = hit.mode || refs.gizmoMode;
    refs.gizmoActiveAxis = hit.axis;
    refs.orbitMoved = true;
    refs.pendingPickPartId = null;
    refs.isDragging = false;
    const part = getSelectedPart ? getSelectedPart() : null;
    const t = part && ensureTransformState ? ensureTransformState(part) : null;
    refs.gizmoStartPos = refs.currentMesh ? refs.currentMesh.position.clone() : null;
    refs.gizmoStartRot = (t && t.rotation)
      ? new THREERef.Euler(t.rotation.x || 0, t.rotation.y || 0, t.rotation.z || 0)
      : (refs.currentMesh ? refs.currentMesh.rotation.clone() : null);
    const u = (t && t.scale && typeof t.scale.x === 'number') ? t.scale.x : (refs.currentMesh ? refs.currentMesh.scale.x : 1);
    const sf = getShapeScaleFactors ? getShapeScaleFactors(part) : { x: 1, y: 1, z: 1 };
    refs.gizmoStartScale = { u, sf: { x: sf.x, y: sf.y, z: sf.z } };
    const rect = threeCanvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const planeNormal = new THREERef.Vector3();
    if (refs.gizmoActiveMode === 'rotate') {
      if (refs.gizmoActiveAxis === 'x') planeNormal.set(1, 0, 0);
      else if (refs.gizmoActiveAxis === 'y') planeNormal.set(0, 1, 0);
      else planeNormal.set(0, 0, 1);
    } else {
      const axisDir = (refs.gizmoActiveAxis === 'x')
        ? new THREERef.Vector3(1, 0, 0)
        : (refs.gizmoActiveAxis === 'y')
          ? new THREERef.Vector3(0, 1, 0)
          : new THREERef.Vector3(0, 0, 1);
      planeNormal.copy(axisDragPlaneNormal(axisDir));
    }
    gizmoPlane.setFromNormalAndCoplanarPoint(planeNormal, refs.currentMesh.position);
    const hitPt = new THREERef.Vector3();
    refs.gizmoStartHit = raycaster.ray.intersectPlane(gizmoPlane, hitPt) ? hitPt.clone() : refs.currentMesh.position.clone();
    if (refs.gizmoActiveMode === 'rotate') {
      const axisDir = (refs.gizmoActiveAxis === 'x')
        ? new THREERef.Vector3(1, 0, 0)
        : (refs.gizmoActiveAxis === 'y')
          ? new THREERef.Vector3(0, 1, 0)
          : new THREERef.Vector3(0, 0, 1);
      refs.gizmoStartVec = rotateVectorFromRay ? rotateVectorFromRay(raycaster, axisDir, refs.currentMesh.position) : null;
    } else {
      refs.gizmoStartVec = null;
    }
    refs.prevMouse = { x: e.clientX, y: e.clientY };
    if (threeCanvas.setPointerCapture && e.pointerId !== undefined) {
      try { threeCanvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    return true;
  }
  refs.isDragging = true;
  refs.orbitMoved = false;
  const _rawPick = hitTestPartIdFromPointer ? hitTestPartIdFromPointer(e) : null;
  refs.pendingPickPartId = _rawPick;
  refs.prevMouse = { x: e.clientX, y: e.clientY };
  if (threeCanvas.setPointerCapture && e.pointerId !== undefined) {
    try { threeCanvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  return true;
}

export function onOrbitPointerUp(ctx) {
  const e = ctx?.event || null;
  const refs = ctx?.refs || {};
  const setViewportTransformReadout = ctx?.setViewportTransformReadout || null;
  const updateShapeTransformControlsFromSelected = ctx?.updateShapeTransformControlsFromSelected || null;
  const persistViewportSettings = ctx?.persistViewportSettings || null;
  const setSelectedPart = ctx?.setSelectedPart || null;
  const threeCanvas = ctx?.threeCanvas || null;
  if (!e) return false;
  const remainingTouches = forgetOrbitTouch(refs, e);
  if (refs.touchPanActive) {
    if (remainingTouches < 2) {
      refs.touchPanActive = false;
      refs.panMode = false;
      refs.isDragging = false;
      refs.pendingPickPartId = null;
      try { persistViewportSettings && persistViewportSettings(); } catch (_) {}
    }
    if (threeCanvas.releasePointerCapture && e.pointerId !== undefined) {
      try { threeCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    return true;
  }
  if (refs.panMode) {
    refs.panMode = false;
    try { persistViewportSettings && persistViewportSettings(); } catch (_) {}
    try { setViewportTransformReadout && setViewportTransformReadout('', null); } catch (_) {}
    if (threeCanvas.releasePointerCapture && e.pointerId !== undefined) {
      try { threeCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    return true;
  }
  if (refs.gizmoDragging) {
    refs.gizmoDragging = false;
    try { setViewportTransformReadout && setViewportTransformReadout('', null); } catch (_) {}
    refs.gizmoActiveMode = null;
    refs.gizmoActiveAxis = null;
    refs.gizmoStartPos = null;
    refs.gizmoStartHit = null;
    refs.gizmoStartRot = null;
    refs.gizmoStartScale = null;
    refs.gizmoStartVec = null;
    try { updateShapeTransformControlsFromSelected && updateShapeTransformControlsFromSelected(); } catch (_) {}
    if (threeCanvas.releasePointerCapture && e.pointerId !== undefined) {
      try { threeCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    return true;
  }
  refs.isDragging = false;
  if (!refs.orbitMoved) {
    if (refs.pendingPickPartId) {
      try { setSelectedPart && setSelectedPart(refs.pendingPickPartId, { silent: true }); } catch (err) { console.error('[picking] applying canvas selection failed', { partId: refs.pendingPickPartId, err }); }
    } else {
      try { setSelectedPart && setSelectedPart(null, { silent: true }); } catch (err) { console.error('[picking] clearing canvas selection failed', err); }
    }
  } else {
    try { persistViewportSettings && persistViewportSettings(); } catch (_) {}
  }
  refs.pendingPickPartId = null;
  if (threeCanvas.releasePointerCapture && e.pointerId !== undefined) {
    try { threeCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  return true;
}

export function onOrbitPointerMove(ctx) {
  let e = ctx?.event || null;
  const refs = ctx?.refs || {};
  const threeCanvas = ctx?.threeCanvas || null;
  const raycaster = ctx?.raycaster || null;
  const camera = ctx?.camera || null;
  const gizmoPlane = ctx?.gizmoPlane || null;
  const THREERef = ctx?.THREE || null;
  const clampSnap = ctx?.clampSnap || null;
  const rotateVectorFromRay = ctx?.rotateVectorFromRay || null;
  const mutateSelectedPartTransform = ctx?.mutateSelectedPartTransform || null;
  const setViewportTransformReadout = ctx?.setViewportTransformReadout || null;
  const tr = ctx?.tr || ((x) => String(x));
  const GRID_UNITS = ctx?.GRID_UNITS || '';
  const orthoCamera = ctx?.orthoCamera || null;
  const viewportView = ctx?.viewportView || 'free';
  const orbitTarget = ctx?.orbitTarget || null;
  const getGlobalPanLock = ctx?.getGlobalPanLock || (() => false);
  const spherical = ctx?.spherical || null;
  const sphericalToXYZ = ctx?.sphericalToXYZ || null;
  if (!e) return false;

  if (e.pointerType === 'touch') {
    const touchCount = rememberOrbitTouch(refs, e);
    if (touchCount >= 2) {
      const midpoint = orbitTouchMidpoint(refs);
      if (!refs.touchPanActive) {
        refs.touchPanActive = true;
        refs.panMode = true;
        refs.isDragging = true;
        refs.orbitMoved = true;
        refs.pendingPickPartId = null;
        refs.prevMouse = midpoint || { x: e.clientX, y: e.clientY };
      }
      // Feed the existing camera pan math with the two-finger midpoint, so a
      // parallel gesture pans while a one-finger gesture continues to orbit.
      if (midpoint) e = { ...e, clientX: midpoint.x, clientY: midpoint.y };
      try { e.preventDefault && e.preventDefault(); } catch (_) {}
    }
  }

  if (refs.gizmoDragging && refs.gizmoActiveAxis && refs.currentMesh && refs.gizmoStartHit) {
    const rect = threeCanvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hit = new THREERef.Vector3();
    if (raycaster.ray.intersectPlane(gizmoPlane, hit) || refs.gizmoActiveMode === 'rotate') {
      const axisDir = (refs.gizmoActiveAxis === 'x')
        ? new THREERef.Vector3(1, 0, 0)
        : (refs.gizmoActiveAxis === 'y')
          ? new THREERef.Vector3(0, 1, 0)
          : new THREERef.Vector3(0, 0, 1);
      let nextPos = null;
      let nextRot = null;
      let nextUScale = null;
      let nextShapeScale = null;

      if (refs.gizmoActiveMode === 'move') {
        const deltaV = hit.sub(refs.gizmoStartHit);
        const d = deltaV.dot(axisDir);
        const start = refs.gizmoStartPos ? refs.gizmoStartPos : refs.currentMesh.position.clone();
        const step = e.shiftKey ? 0.1 : 0;
        const ds = step ? (Math.round(d / step) * step) : d;
        const next = start.clone().add(axisDir.multiplyScalar(ds));
        next.x = Math.max(-2.0, Math.min(2.0, next.x));
        next.y = Math.max(-2.0, Math.min(2.0, next.y));
        next.z = Math.max(-2.0, Math.min(2.0, next.z));
        nextPos = { x: next.x, y: next.y, z: next.z };
        const sign = ds >= 0 ? '+' : '';
        setViewportTransformReadout(`${tr('gizmo_move')} ${String(refs.gizmoActiveAxis).toUpperCase()}: ${sign}${(Math.round(ds * 100) / 100).toFixed(2)}${GRID_UNITS}`, e);
      } else if (refs.gizmoActiveMode === 'scale') {
        const deltaV = hit.sub(refs.gizmoStartHit);
        const d = deltaV.dot(axisDir);
        const startU = (refs.gizmoStartScale && typeof refs.gizmoStartScale.u === 'number') ? refs.gizmoStartScale.u : 1;
        const sf0 = (refs.gizmoStartScale && refs.gizmoStartScale.sf) ? refs.gizmoStartScale.sf : { x: 1, y: 1, z: 1 };
        const k = 0.6;
        const step = e.shiftKey ? 0.1 : 0;
        const nextAxis = clampSnap((sf0[refs.gizmoActiveAxis] || 1) + d * k, 0.2, 3.0, step);
        nextUScale = { x: startU, y: startU, z: startU };
        nextShapeScale = { x: sf0.x || 1, y: sf0.y || 1, z: sf0.z || 1 };
        nextShapeScale[refs.gizmoActiveAxis] = nextAxis;
        setViewportTransformReadout(`${tr('gizmo_scale')} ${String(refs.gizmoActiveAxis).toUpperCase()}: ×${(Math.round(nextAxis * 100) / 100).toFixed(2)}`, e);
      } else if (refs.gizmoActiveMode === 'rotate') {
        const curVec = rotateVectorFromRay(raycaster, axisDir, refs.currentMesh.position);
        if (curVec && refs.gizmoStartVec) {
          const cross = new THREERef.Vector3().crossVectors(refs.gizmoStartVec, curVec);
          const dot = Math.max(-1, Math.min(1, refs.gizmoStartVec.dot(curVec)));
          let ang = Math.atan2(cross.dot(axisDir), dot);
          if (e.shiftKey) {
            const step = Math.PI / 12;
            ang = Math.round(ang / step) * step;
          }
          const sr = refs.gizmoStartRot || refs.currentMesh.rotation;
          const nr = new THREERef.Euler(sr.x, sr.y, sr.z);
          if (refs.gizmoActiveAxis === 'x') nr.x = sr.x + ang;
          if (refs.gizmoActiveAxis === 'y') nr.y = sr.y + ang;
          if (refs.gizmoActiveAxis === 'z') nr.z = sr.z + ang;
          nextRot = { x: nr.x, y: nr.y, z: nr.z };
          const deg = ang * 180 / Math.PI;
          const sign = deg >= 0 ? '+' : '';
          setViewportTransformReadout(`${tr('gizmo_rotate')} ${String(refs.gizmoActiveAxis).toUpperCase()}: ${sign}${(Math.round(deg * 10) / 10).toFixed(1)}°`, e);
        }
      }

      mutateSelectedPartTransform((p, t) => {
        if (nextPos) t.position = nextPos;
        if (nextRot) t.rotation = nextRot;
        if (nextUScale) t.scale = nextUScale;
        if (nextShapeScale) p.shapeScale = nextShapeScale;
      });
    }
    return true;
  }

  if (!refs.isDragging && !refs.panMode) return true;
  const px = (e.clientX - refs.prevMouse.x);
  const py = (e.clientY - refs.prevMouse.y);
  const dx = px * 0.005;
  const dy = py * 0.005;
  if (!refs.orbitMoved && !refs.panMode) {
    const apx = Math.abs(px);
    const apy = Math.abs(py);
    if (apx + apy > 2) refs.orbitMoved = true;
  }
  const globalPanLock = !!getGlobalPanLock();
  const wantPan = (refs.panMode || !!refs.panLockMode || globalPanLock);
  if (wantPan || (camera === orthoCamera && viewportView !== 'free')) {
    const rect = threeCanvas.getBoundingClientRect();
    let sx;
    let sy;
    if (camera === orthoCamera) {
      const w = (orthoCamera.right - orthoCamera.left) / Math.max(0.001, orthoCamera.zoom);
      const h = (orthoCamera.top - orthoCamera.bottom) / Math.max(0.001, orthoCamera.zoom);
      sx = w / Math.max(1, rect.width);
      sy = h / Math.max(1, rect.height);
    } else {
      const fov = (typeof camera.fov === 'number') ? (camera.fov * Math.PI / 180) : (50 * Math.PI / 180);
      const aspect = rect.width / Math.max(1, rect.height);
      const distVec = new THREERef.Vector3().subVectors(camera.position, orbitTarget || camera.position.clone());
      const dist = Math.max(0.01, distVec.length());
      const h = 2 * Math.tan(fov / 2) * dist;
      const w = h * aspect;
      sx = w / Math.max(1, rect.width);
      sy = h / Math.max(1, rect.height);
    }
    const right = new THREERef.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREERef.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    orbitTarget.addScaledVector(right, -px * sx);
    orbitTarget.addScaledVector(up, py * sy);
    sphericalToXYZ();
  } else {
    spherical.theta -= dx;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy));
    sphericalToXYZ();
  }
  refs.prevMouse = { x: e.clientX, y: e.clientY };
  return true;
}
