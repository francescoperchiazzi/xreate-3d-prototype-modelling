// Canonical bridge between serializable project transforms and Three meshes.
// It has no window/XR dependency so selection, gizmo, factory and persistence
// cannot implement competing transform rules.
export function ensureTransformState(part) {
  if (!part) return null;
  if (!part.transform || typeof part.transform !== 'object') {
    part.transform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
  }
  if (!part.transform.position) part.transform.position = { x: 0, y: 0, z: 0 };
  if (!part.transform.rotation) part.transform.rotation = { x: 0, y: 0, z: 0 };
  if (!part.transform.scale) part.transform.scale = { x: 1, y: 1, z: 1 };
  return part.transform;
}

export function getShapeScaleFactors(part) {
  const scale = part?.shapeScale || null;
  return {
    x: (typeof scale?.x === 'number') ? scale.x : 1,
    y: (typeof scale?.y === 'number') ? scale.y : 1,
    z: (typeof scale?.z === 'number') ? scale.z : 1,
  };
}

export function applyTransformToMesh(ctx = {}) {
  const part = ctx.part || null;
  const mesh = part?._mesh || null;
  if (!part || !mesh) return false;
  const transform = ensureTransformState(part);
  const position = transform.position;
  const rotation = transform.rotation;
  const scale = transform.scale;
  mesh.position?.set?.(position.x || 0, position.y || 0, position.z || 0);
  mesh.rotation?.set?.(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  const shapeScale = getShapeScaleFactors(part);
  const x = (typeof scale === 'number') ? scale : ((typeof scale?.x === 'number') ? scale.x : 1);
  const y = (typeof scale === 'number') ? scale : ((typeof scale?.y === 'number') ? scale.y : x);
  const z = (typeof scale === 'number') ? scale : ((typeof scale?.z === 'number') ? scale.z : x);
  mesh.scale?.set?.(x * shapeScale.x, y * shapeScale.y, z * shapeScale.z);
  mesh.visible = part.visible !== false;
  try { ctx.selectionHelper?.setFromObject?.(mesh); } catch (err) { ctx.onWarning?.('[part-transform] selection helper update failed', err); }
  try { ctx.updateGizmo?.(); } catch (err) { ctx.onWarning?.('[part-transform] gizmo update failed', err); }
  try { ctx.markDirty?.(30); } catch (err) { ctx.onWarning?.('[part-transform] viewport dirty update failed', err); }
  return true;
}
