/**
 * Coordinates creation of one ordinary archetype part.  The controller owns
 * the state transition; callers only provide the current scene/UI adapters.
 * Special archetypes remain a shell concern because they open a modal or add
 * a multi-part preset rather than a single factory part.
 */
export function addPartFromArchetype(ctx) {
  const arch = ctx?.arch || null;
  if (!arch || arch.id === 'doodle' || arch.id === 'humanoid-kit') return null;

  const mutateProject = ctx?.mutateProject;
  const getShapeList = ctx?.getShapeList;
  const getDefaultSpawnPosition = ctx?.getDefaultSpawnPosition;
  const createPartFromArchetype = ctx?.createPartFromArchetype;
  const setSelectedPart = ctx?.setSelectedPart;
  if (typeof mutateProject !== 'function' || typeof getShapeList !== 'function'
    || typeof getDefaultSpawnPosition !== 'function' || typeof createPartFromArchetype !== 'function'
    || typeof setSelectedPart !== 'function') return null;

  let createdPart = null;
  mutateProject(() => {
    const shapes = getShapeList();
    const opts = ctx?.opts || null;
    const position = opts?.position || getDefaultSpawnPosition(shapes.length);
    const spawnOpts = { position };
    if (opts?.rotation) spawnOpts.rotation = opts.rotation;
    if (opts?.scale) spawnOpts.scale = opts.scale;
    if (opts?.params) spawnOpts.params = opts.params;
    if (opts?.uvMode) spawnOpts.uvMode = opts.uvMode;
    if (opts?.color) spawnOpts.color = opts.color;

    const part = createPartFromArchetype(arch, spawnOpts);
    if (!part) return;
    if (typeof opts?.id === 'string' && opts.id && !shapes.some((item) => item?.id === opts.id)) part.id = opts.id;
    if (typeof opts?.name === 'string' && opts.name.trim()) part.name = opts.name.trim();
    if (typeof opts?.visible === 'boolean') {
      part.visible = opts.visible;
      if (part._mesh) part._mesh.visible = part.visible;
    }
    if (typeof opts?.locked === 'boolean') part.locked = opts.locked;
    if (typeof opts?.uvMode === 'string' && opts.uvMode) part.uvMode = opts.uvMode;
    if (opts?.color && part.material) {
      part.material.baseColor = String(opts.color);
      const color = part._mesh?.material?.color;
      if (color?.set) {
        color.set(String(opts.color));
        part._mesh.material.needsUpdate = true;
      }
    }
    createdPart = part;
    shapes.push(part);
    setSelectedPart(part.id, { silent: true });
    ctx?.setStatusKey?.('status_shape_added', 'ok');
  });

  if (!createdPart?.id) return createdPart;
  try { setSelectedPart(createdPart.id, { silent: false }); } catch (err) { console.warn('[shape-controller] selection sync failed', err); }
  try {
    ctx?.ensureGizmo?.();
    ctx?.fitViewportView?.(createdPart.id);
  } catch (err) {
    console.warn('[shape-controller] viewport focus failed', err);
    try { ctx?.fitViewportView?.(); } catch (fallbackErr) { console.warn('[shape-controller] fallback viewport focus failed', fallbackErr); }
  }
  return createdPart;
}
