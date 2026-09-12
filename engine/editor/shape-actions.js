/**
 * Bridges editor commands to the modular shape controllers.  It owns command
 * routing only; scene state, UI and renderer authority remain injected.
 */
export function create(ctx = {}) {
  const controller = (name) => ctx?.getController?.(name) || null;
  const viewport = () => ({
    ensureGizmo: ctx?.ensureGizmo,
    fitViewportView: ctx?.fitViewportView,
  });

  function spawnHumanoidKit(opts) {
    const humanoid = controller('HumanoidController');
    if (typeof humanoid?.spawnHumanoidKit !== 'function') return { created: 0, selectedId: null };
    try {
      return humanoid.spawnHumanoidKit({
        opts,
        mutateProject: ctx?.mutateProject,
        getShapeList: ctx?.getShapeList,
        getDefaultSpawnPosition: ctx?.getDefaultSpawnPosition,
        getArchetypeById: ctx?.getArchetypeById,
        createPartFromArchetype: ctx?.createPartFromArchetype,
        setSelectedPart: ctx?.setSelectedPart,
        renderTreeUI: ctx?.renderTreeUI,
        setStatusKey: ctx?.setStatusKey,
        THREE: ctx?.THREE,
      });
    } catch (err) {
      ctx?.onError?.('[humanoid] kit creation failed', err);
      return { created: 0, selectedId: null };
    }
  }

  function addPartFromArchetype(arch, opts) {
    if (!arch) return null;
    if (arch.id === 'doodle') {
      ctx?.openDoodleModal?.();
      return null;
    }
    if (arch.id === 'humanoid-kit') {
      spawnHumanoidKit(opts);
      return null;
    }
    const shapes = controller('ShapeController');
    if (typeof shapes?.addPartFromArchetype !== 'function') return null;
    return shapes.addPartFromArchetype({
      arch, opts,
      mutateProject: ctx?.mutateProject,
      getShapeList: ctx?.getShapeList,
      getDefaultSpawnPosition: ctx?.getDefaultSpawnPosition,
      createPartFromArchetype: ctx?.createPartFromArchetype,
      setSelectedPart: ctx?.setSelectedPart,
      setStatusKey: ctx?.setStatusKey,
      ...viewport(),
    });
  }

  function addDoodleShapeToScene(points, params, opts) {
    const doodle = controller('DoodleController');
    if (typeof doodle?.addDoodleShapeToScene !== 'function') {
      console.error('[doodle] controller unavailable at command boundary');
      return null;
    }
    const result = doodle.addDoodleShapeToScene({
      // `opts.mode` is not presentation state: it selects a different
      // geometry builder (polygon, bilateral mirror or lathe).  Passing only
      // `opts` made the controller fall back to polygon for every request.
      points, params, opts, mode: opts?.mode,
      mutateProject: ctx?.mutateProject,
      THREE: ctx?.THREE,
      getShapeList: ctx?.getShapeList,
      newPartId: ctx?.newPartId,
      createOffscreenCanvas: ctx?.createOffscreenCanvas,
      createMaterial: ctx?.createMaterial,
      assemblyRoot: ctx?.assemblyRoot,
      editorBg: ctx?.editorBg,
      canvasSize: ctx?.canvasSize,
      buildDoodleRevolveFromPoints: ctx?.buildDoodleRevolveFromPoints,
      buildDoodleMirrorFromPoints: ctx?.buildDoodleMirrorFromPoints,
      buildDoodleFromPoints: ctx?.buildDoodleFromPoints,
      applyUvModeToGeometry: ctx?.applyUvModeToGeometry,
      getDefaultSpawnPosition: ctx?.getDefaultSpawnPosition,
      setSelectedPart: ctx?.setSelectedPart,
      setStatusKey: ctx?.setStatusKey,
      setStatus: ctx?.setStatus,
      ...viewport(),
    });
    if (!result) console.error('[doodle] controller rejected create request', { pointCount: Array.isArray(points) ? points.length : 0, mode: opts?.mode || 'polygon' });
    return result;
  }

  return { spawnHumanoidKit, addPartFromArchetype, addDoodleShapeToScene };
}
