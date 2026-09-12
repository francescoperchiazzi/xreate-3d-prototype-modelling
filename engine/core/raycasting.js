import { event as debugEvent } from '../debug/event-log.js';

export function hitTestPartIdFromPointer(ctx) {
  const e = ctx?.event || null;
  const getShapeList = ctx?.getShapeList || null;
  const threeCanvas = ctx?.threeCanvas || null;
  const raycaster = ctx?.raycaster || null;
  const camera = ctx?.camera || null;
  if (!e || !getShapeList || !threeCanvas || !raycaster || !camera) {
    debugEvent('picking.part.skipped', { reason: 'incomplete-context' });
    return null;
  }

  const shapes = getShapeList();
  if (!shapes.length) {
    debugEvent('picking.part.empty-scene');
    return null;
  }
  const rect = threeCanvas.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const objs = shapes
    .filter((p) => p && p._mesh && !p.locked)
    .map((p) => p._mesh)
    .filter(Boolean);
  const hits = raycaster.intersectObjects(objs, false);
  if (!hits.length) {
    debugEvent('picking.part.miss', { x: e.clientX, y: e.clientY, candidates: objs.length });
    return null;
  }
  const hit = hits[0].object;
  const uid = hit && hit.userData ? (hit.userData.shapeId || hit.userData.partId) : null;
  if (!uid) {
    debugEvent('picking.part.unidentified-hit', { candidates: objs.length });
    return null;
  }
  debugEvent('picking.part.hit', { partId: uid, x: e.clientX, y: e.clientY, candidates: objs.length });
  return uid;
}

export function rotateVectorFromRay(ctx) {
  const raycaster = ctx?.raycaster || null;
  const axisDir = ctx?.axisDir || null;
  const pivot = ctx?.pivot || null;
  const camera = ctx?.camera || null;
  const THREERef = ctx?.THREE || null;
  if (!raycaster || !axisDir || !pivot || !THREERef) return null;

  const plane = new THREERef.Plane().setFromNormalAndCoplanarPoint(axisDir, pivot);
  const hit = new THREERef.Vector3();
  let ok = raycaster.ray.intersectPlane(plane, hit);
  if (!ok && camera) {
    const camDir = new THREERef.Vector3();
    camera.getWorldDirection(camDir);
    const camPlane = new THREERef.Plane().setFromNormalAndCoplanarPoint(camDir, pivot);
    ok = raycaster.ray.intersectPlane(camPlane, hit);
  }
  if (!ok) return null;
  const v = hit.sub(pivot);
  const proj = axisDir.clone().multiplyScalar(v.dot(axisDir));
  v.sub(proj);
  if (v.lengthSq() < 1e-8) return null;
  return v.normalize();
}

export function hitTestGizmoFromPointer(ctx) {
  const e = ctx?.event || null;
  const currentMesh = ctx?.currentMesh || null;
  const gizmoRoot = ctx?.gizmoRoot || null;
  const threeCanvas = ctx?.threeCanvas || null;
  const raycaster = ctx?.raycaster || null;
  const camera = ctx?.camera || null;
  const gizmoColliders = ctx?.gizmoColliders || null;
  const gizmoMode = ctx?.gizmoMode || 'move';
  if (!e || !currentMesh || !gizmoRoot || !gizmoRoot.visible || !threeCanvas || !raycaster || !camera || !gizmoColliders) {
    debugEvent('picking.gizmo.skipped', { hasMesh: !!currentMesh, hasRoot: !!gizmoRoot, visible: !!gizmoRoot?.visible });
    return null;
  }

  const rect = threeCanvas.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  const ny = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const c = gizmoColliders[gizmoMode] || null;
  const cols = c ? [c.x, c.y, c.z].filter(Boolean) : [];
  if (!cols.length) return null;
  const hits = raycaster.intersectObjects(cols, false);
  if (!hits.length) return null;
  const h = hits[0].object;
  if (!h || !h.userData) return null;
  const result = { mode: h.userData.gizmoMode || gizmoMode, axis: h.userData.gizmoAxis || null };
  debugEvent('picking.gizmo.hit', result);
  return result;
}
