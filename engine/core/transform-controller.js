function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function mutateSelectedTransform(ctx) {
  const part = ctx?.getSelectedPart?.() || null;
  const mesh = part?._mesh || null;
  const mutate = ctx?.mutate || null;
  if (!part || !mesh || typeof mutate !== 'function') return false;
  const mutateProject = ctx?.mutateProject || null;
  const run = () => {
    const transform = ctx?.ensureTransformState?.(part) || part.transform;
    if (!transform) return;
    mutate(part, transform, mesh);
    ctx?.applyTransformToMesh?.(part);
    ctx?.afterTransform?.(part);
  };
  if (typeof mutateProject === 'function') mutateProject(run);
  else run();
  return true;
}

// Transitional UI adapter: it centralizes how DOM form values become a serial-
// izable transform. The legacy bootstrap only supplies dependencies and owns no
// transform mutation logic any longer.
export function applySelectedTransformFromControls(ctx) {
  const part = ctx?.getSelectedPart?.() || null;
  const mesh = part?._mesh || null;
  if (!part || !mesh) return false;
  const byId = (id) => document.getElementById(id);
  const controls = {
    x: byId('shapePosX'), y: byId('shapePosY'), z: byId('shapePosZ'),
    rx: byId('shapeRotX'), ry: byId('shapeRotY'), rz: byId('shapeRotZ'),
    sx: byId('shapeScaleX'), sy: byId('shapeScaleY'), sz: byId('shapeScaleZ'),
  };
  const source = ctx?.source || null;
  if (ctx?.isUniformScaleLocked?.() && ['shapeScaleX', 'shapeScaleY', 'shapeScaleZ'].includes(source)) {
    const control = source === 'shapeScaleX' ? controls.sx : source === 'shapeScaleY' ? controls.sy : controls.sz;
    if (control) {
      for (const candidate of [controls.sx, controls.sy, controls.sz]) {
        if (candidate) candidate.value = String(control.value);
      }
    }
  }
  const position = part.transform?.position || mesh.position;
  const rotation = part.transform?.rotation || mesh.rotation;
  const scale = part.transform?.scale || mesh.scale;
  const next = {
    position: {
      x: controls.x ? clamp(Number(controls.x.value) / 100, -2, 2, position.x) : position.x,
      y: controls.y ? clamp(Number(controls.y.value) / 100, -2, 2, position.y) : position.y,
      z: controls.z ? clamp(Number(controls.z.value) / 100, -2, 2, position.z) : position.z,
    },
    rotation: {
      x: (controls.rx ? clamp(controls.rx.value, -180, 180, rotation.x * 180 / Math.PI) : rotation.x * 180 / Math.PI) * Math.PI / 180,
      y: (controls.ry ? clamp(controls.ry.value, -180, 180, rotation.y * 180 / Math.PI) : rotation.y * 180 / Math.PI) * Math.PI / 180,
      z: (controls.rz ? clamp(controls.rz.value, -180, 180, rotation.z * 180 / Math.PI) : rotation.z * 180 / Math.PI) * Math.PI / 180,
    },
    scale: {
      x: controls.sx ? clamp(Number(controls.sx.value) / 100, 0.01, 3, scale.x) : scale.x,
      y: controls.sy ? clamp(Number(controls.sy.value) / 100, 0.01, 3, scale.y) : scale.y,
      z: controls.sz ? clamp(Number(controls.sz.value) / 100, 0.01, 3, scale.z) : scale.z,
    },
  };
  return mutateSelectedTransform({
    ...ctx,
    mutate: (_part, transform) => {
      transform.position = { ...next.position };
      transform.rotation = { ...next.rotation };
      transform.scale = { ...next.scale };
    },
  });
}

// Compatibility controls used by the older compact inspector. Unlike the
// former inline implementation this updates serializable part.transform as
// well as the Three mesh, so persistence and export cannot diverge.
export function applySelectedUniformTransformFromControls(ctx) {
  const part = ctx?.getSelectedPart?.() || null;
  const mesh = part?._mesh || null;
  if (!part || !mesh) return false;
  const control = (id) => document.getElementById(id);
  const position = part.transform?.position || mesh.position;
  const rotation = part.transform?.rotation || mesh.rotation;
  const scale = part.transform?.scale || mesh.scale;
  const scalar = control('partScale');
  const px = control('partPosX');
  const py = control('partPosY');
  const pz = control('partPosZ');
  const ry = control('partRotY');
  const uniform = scalar ? clamp(Number(scalar.value) / 100, 0.01, 3, scale.x) : scale.x;
  const next = {
    position: {
      x: px ? clamp(Number(px.value) / 100, -2, 2, position.x) : position.x,
      y: py ? clamp(Number(py.value) / 100, -2, 2, position.y) : position.y,
      z: pz ? clamp(Number(pz.value) / 100, -2, 2, position.z) : position.z,
    },
    rotation: {
      x: rotation.x,
      y: (ry ? clamp(ry.value, -180, 180, rotation.y * 180 / Math.PI) : rotation.y * 180 / Math.PI) * Math.PI / 180,
      z: rotation.z,
    },
    scale: { x: uniform, y: uniform, z: uniform },
  };
  return mutateSelectedTransform({
    ...ctx,
    mutate: (_part, transform) => {
      transform.position = { ...next.position };
      transform.rotation = { ...next.rotation };
      transform.scale = { ...next.scale };
    },
  });
}
