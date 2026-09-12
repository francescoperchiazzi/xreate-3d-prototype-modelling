function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (const item of material) {
      try { item?.dispose?.(); } catch (err) { console.warn('[part-runtime] material disposal failed', err); }
    }
    return;
  }
  try { material?.dispose?.(); } catch (err) { console.warn('[part-runtime] material disposal failed', err); }
}

export function disposePart(ctx) {
  const part = ctx?.part || null;
  if (!part) return false;
  const mesh = part._mesh || null;
  if (mesh) {
    try { ctx?.assemblyRoot?.remove?.(mesh); } catch (err) { console.warn('[part-runtime] mesh removal failed', { partId: part.id, err }); }
    try { mesh.geometry?.dispose?.(); } catch (err) { console.warn('[part-runtime] geometry disposal failed', { partId: part.id, err }); }
    disposeMaterial(mesh.material);
    mesh.material = null;
    part._mesh = null;
  }
  try { part._texture?.dispose?.(); } catch (err) { console.warn('[part-runtime] texture disposal failed', { partId: part.id, err }); }
  part._texture = null;
  part._compositeCtx = null;
  part._compositeCanvas = null;
  return true;
}

export function clearAssembly(ctx) {
  const shapes = ctx?.getShapeList?.() || [];
  for (const part of shapes) disposePart({ part, assemblyRoot: ctx?.assemblyRoot });
  shapes.length = 0;
  const project = ctx?.project || null;
  if (project) {
    project.selectedId = null;
    project.textureMode = 'per-shape';
    try { project._sharedTexture?.dispose?.(); } catch (err) { console.warn('[part-runtime] shared texture disposal failed', err); }
    project._sharedTexture = null;
    if (project.meta) project.meta.modified = Date.now();
  }
  const refs = ctx?.refs || {};
  refs.currentMesh = null;
  refs.currentArchetype = null;
  refs.drawingTexture = null;
  const selectionHelper = refs.selectionHelper || null;
  if (selectionHelper) {
    try { ctx?.scene?.remove?.(selectionHelper); } catch (err) { console.warn('[part-runtime] selection helper removal failed', err); }
    try { selectionHelper.geometry?.dispose?.(); } catch (err) { console.warn('[part-runtime] selection geometry disposal failed', err); }
    disposeMaterial(selectionHelper.material);
    refs.selectionHelper = null;
  }
  if (refs.gizmoRoot) refs.gizmoRoot.visible = false;
  return true;
}
