let configured = null;

export function configure(ctx) {
  configured = ctx && typeof ctx === 'object' ? ctx : null;
}

export function duplicatePart(partId) {
  const mod = configured?.shapeFactory || null;
  if (!mod || typeof mod.duplicatePart !== 'function') return;
  try {
    return mod.duplicatePart({ ...(configured || {}), partId });
  } catch (_) {}
}

export function movePartInTree(partId, delta) {
  const mod = configured?.sceneGraphWiring || null;
  if (!mod || typeof mod.movePartInTree !== 'function') return;
  try {
    return mod.movePartInTree({ ...(configured || {}), partId, delta });
  } catch (_) {}
}

export function deletePart(partId) {
  const mod = configured?.sceneGraphWiring || null;
  if (!mod || typeof mod.deletePart !== 'function') return;
  try {
    return mod.deletePart({ ...(configured || {}), partId });
  } catch (_) {}
}

export function renamePart(partId, name) {
  const stable = configured?.projectState?.renameShape || null;
  if (stable) {
    try { return stable(partId, name); } catch (_) { return null; }
  }
  const getShapeList = configured && typeof configured.getShapeList === 'function' ? configured.getShapeList : null;
  const getProject = configured && typeof configured.getProject === 'function' ? configured.getProject : null;
  if (!getShapeList) return null;
  const shapes = getShapeList();
  const part = Array.isArray(shapes) ? shapes.find((p) => p && p.id === partId) : null;
  if (!part) return null;
  part.name = String(name || '').trim() || part.name || part.id;
  try {
    const project = getProject ? getProject() : null;
    if (project && project.meta) project.meta.modified = Date.now();
  } catch (_) {}
  return part;
}

export function setPartVisibility(partId, visible) {
  const stable = configured?.projectState?.setShapeVisibility || null;
  if (stable) {
    try { return stable(partId, visible); } catch (_) { return null; }
  }
  const getShapeList = configured && typeof configured.getShapeList === 'function' ? configured.getShapeList : null;
  const getProject = configured && typeof configured.getProject === 'function' ? configured.getProject : null;
  if (!getShapeList) return null;
  const shapes = getShapeList();
  const part = Array.isArray(shapes) ? shapes.find((p) => p && p.id === partId) : null;
  if (!part) return null;
  part.visible = visible !== false;
  if (part._mesh) part._mesh.visible = !!part.visible;
  try {
    const project = getProject ? getProject() : null;
    if (project && project.meta) project.meta.modified = Date.now();
  } catch (_) {}
  return part;
}

export function togglePartLocked(partId) {
  const stable = configured?.projectState?.toggleShapeLocked || null;
  if (stable) {
    try { return stable(partId); } catch (_) { return null; }
  }
  const getShapeList = configured && typeof configured.getShapeList === 'function' ? configured.getShapeList : null;
  const getProject = configured && typeof configured.getProject === 'function' ? configured.getProject : null;
  if (!getShapeList) return null;
  const shapes = getShapeList();
  const part = Array.isArray(shapes) ? shapes.find((p) => p && p.id === partId) : null;
  if (!part) return null;
  part.locked = !part.locked;
  try {
    const project = getProject ? getProject() : null;
    if (project && project.meta) project.meta.modified = Date.now();
  } catch (_) {}
  return part;
}

export const SceneCommands = {
  configure,
  duplicatePart,
  movePartInTree,
  deletePart,
  renamePart,
  setPartVisibility,
  togglePartLocked,
};
