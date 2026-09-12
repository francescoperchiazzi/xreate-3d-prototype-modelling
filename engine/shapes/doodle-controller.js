const DEFAULT_MATERIAL = {
  baseColor: '#ffffff', roughness: 0.6, metalness: 0,
  emissive: 0, emissiveColor: '#e8c88e',
};

function normalizedInput(ctx) {
  const points = Array.isArray(ctx?.points) ? ctx.points : [];
  const mode = ctx?.mode === 'revolve' ? 'revolve' : (ctx?.mode === 'mirror' ? 'mirror' : 'polygon');
  if (points.length < (mode === 'revolve' ? 2 : 3)) return null;
  const raw = ctx?.params || {};
  return {
    points, mode,
    params: mode === 'revolve'
      ? { segments: Math.max(12, Math.min(128, Number.isFinite(raw.segments) ? Math.round(raw.segments) : 64)) }
      : { depth: Number.isFinite(raw.depth) && raw.depth > 0 ? raw.depth : 0.5 },
  };
}

/** Shared Doodle factory for interactive creation and project hydration. */
export function createDoodlePart(ctx) {
  const input = normalizedInput(ctx);
  const THREE = ctx?.THREE;
  if (!input || !THREE?.Mesh || !ctx?.assemblyRoot || typeof ctx?.createMaterial !== 'function') {
    console.error('[doodle] factory prerequisites unavailable', { hasInput: !!input, hasThreeMesh: !!THREE?.Mesh, hasAssemblyRoot: !!ctx?.assemblyRoot, hasCreateMaterial: typeof ctx?.createMaterial === 'function' });
    return null;
  }
  const geo0 = input.mode === 'revolve'
    ? ctx?.buildDoodleRevolveFromPoints?.(input.points, input.params)
    : input.mode === 'mirror'
      ? ctx?.buildDoodleMirrorFromPoints?.(input.points, input.params)
      : ctx?.buildDoodleFromPoints?.(input.points, input.params);
  if (!geo0) {
    console.error('[doodle] geometry builder returned no geometry', { mode: input.mode, pointCount: input.points.length, points: input.points });
    return null;
  }
  const uvMode = ctx?.uvMode || (input.mode === 'revolve' ? 'cylindrical' : 'box');
  const geometry = ctx?.applyUvModeToGeometry?.(geo0, uvMode) || geo0;
  if (geometry !== geo0) {
    try { geo0.dispose?.(); } catch (err) { console.warn('[doodle-factory] source geometry disposal failed', err); }
  }
  const offscreen = ctx?.createOffscreenCanvas?.();
  const materialState = { ...DEFAULT_MATERIAL, ...(ctx?.material || {}) };
  const material = ctx.createMaterial(materialState);
  const id = ctx?.id || ctx?.newPartId?.();
  if (!id || !offscreen?.canvas || !offscreen?.ctx || !material) {
    console.error('[doodle] factory resource allocation incomplete', { hasId: !!id, hasCanvas: !!offscreen?.canvas, hasContext: !!offscreen?.ctx, hasMaterial: !!material });
    try { geometry.dispose?.(); } catch (err) { console.warn('[doodle-factory] incomplete resource cleanup failed', err); }
    return null;
  }
  const canvasSize = ctx?.canvasSize || 1024;
  offscreen.ctx.fillStyle = ctx?.editorBg || '#000';
  offscreen.ctx.fillRect(0, 0, canvasSize, canvasSize);
  // All three Doodle modes produce closed solids. FrontSide both makes a
  // reversed normal immediately visible during development and prevents the
  // inner wall of a Revolve from showing through its exterior texture.
  material.side = THREE.FrontSide;
  material.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = id;
  mesh.userData.shapeId = id;
  mesh.visible = ctx?.visible !== false;
  if (ctx?.position && mesh.position?.copy) mesh.position.copy(ctx.position);
  if (ctx?.rotation && mesh.rotation?.set) mesh.rotation.set(ctx.rotation.x || 0, ctx.rotation.y || 0, ctx.rotation.z || 0);
  if (ctx?.scale && mesh.scale?.set) mesh.scale.set(ctx.scale.x || 1, ctx.scale.y || 1, ctx.scale.z || 1);
  const part = {
    id: String(id), name: ctx?.name ? String(ctx.name) : 'Doodle', type: 'doodle',
    params: input.params, doodleMode: input.mode,
    doodlePoints: input.points.map((point) => ({ x: point.x, y: point.y })),
    visible: ctx?.visible !== false, locked: !!ctx?.locked,
    transform: {
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
      scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
    },
    material: materialState, uvMode, selectedIslandId: null, layers: [], activeLayerIndex: 0,
    imageBitmap: null,
    imageTransform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
    shapeScale: null, _compositeCanvas: offscreen.canvas, _compositeCtx: offscreen.ctx,
    _texture: null, _mesh: mesh,
  };
  ctx.assemblyRoot.add(mesh);
  return part;
}

/** Creates a Doodle through the interactive editor command boundary. */
export function addDoodleShapeToScene(ctx) {
  const input = normalizedInput(ctx);
  const mutateProject = ctx?.mutateProject;
  if (!input || typeof mutateProject !== 'function') return null;
  let created = null;
  mutateProject(() => {
    const shapes = ctx?.getShapeList?.() || [];
    const opts = ctx?.opts || {};
    const part = createDoodlePart({
      ...ctx, ...input,
      id: ctx?.newPartId?.(), name: opts.name || `Doodle ${shapes.length + 1}`,
      position: opts.position || ctx?.getDefaultSpawnPosition?.(shapes.length),
    });
    if (!part) {
      ctx?.setStatusKey?.('status_doodle_failed', 'bad');
      if (typeof ctx?.setStatus === 'function') setTimeout(() => ctx.setStatus('', ''), 2500);
      return;
    }
    shapes.push(part);
    ctx?.setSelectedPart?.(part.id, { silent: true });
    ctx?.setStatusKey?.('status_shape_added', 'ok');
    created = part;
  });
  if (!created) return null;
  try { ctx?.setSelectedPart?.(created.id, { silent: false }); } catch (err) { console.warn('[doodle-controller] selection sync failed', err); }
  try { ctx?.ensureGizmo?.(); ctx?.fitViewportView?.(created.id); } catch (err) { console.warn('[doodle-controller] viewport focus failed', err); }
  return created.id;
}
