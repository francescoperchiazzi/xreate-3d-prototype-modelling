import { cloneLayer, createLayerId } from '../core/project-state.js';
import { event as debugEvent } from '../debug/event-log.js';

// Pixel data can be reused between duplicates, but every mutable layer field
// (especially the UV transform and polygon mask) must have a distinct owner.
// Keeping this operation here makes the duplication boundary testable without
// a Three.js scene or the legacy bridge.
export function cloneLayersForDuplicate(sourceLayers, imageBitmapToPngDataUrlForSave) {
  const layers = Array.isArray(sourceLayers) ? sourceLayers : [];
  return layers.map((layer, index) => cloneLayer(layer, {
    id: createLayerId(),
    label: layer?.label ? String(layer.label) : (`Layer ${index + 1}`),
    preserveBitmap: true,
    imageDataUrl: layer?.imageDataUrl || imageBitmapToPngDataUrlForSave?.(layer?.imageBitmap || null) || null,
  }));
}

export function createPartFromArchetype(ctx) {
  const arch = ctx?.arch || null;
  const opts = ctx?.opts || null;
  const newPartId = ctx?.newPartId || null;
  const getDefaultUvModeForArchetypeId = ctx?.getDefaultUvModeForArchetypeId || null;
  const getDefaultParamsForArchetypeId = ctx?.getDefaultParamsForArchetypeId || null;
  const applyUvModeToGeometry = ctx?.applyUvModeToGeometry || null;
  const createOffscreenCanvas = ctx?.createOffscreenCanvas || null;
  const CANVAS_SIZE = ctx?.CANVAS_SIZE;
  const editorBg = ctx?.editorBg;
  const createMaterial = ctx?.createMaterial || null;
  const THREE = ctx?.THREE || null;
  const assemblyRoot = ctx?.assemblyRoot || null;
  const applyMaterialFlagsForPart = ctx?.applyMaterialFlagsForPart || null;

  if (!arch || arch.id === 'doodle') return null;
  if (!THREE || !assemblyRoot || !createMaterial) return null;
  if (typeof newPartId !== 'function') return null;
  if (typeof getDefaultUvModeForArchetypeId !== 'function') return null;
  if (typeof getDefaultParamsForArchetypeId !== 'function') return null;
  if (typeof createOffscreenCanvas !== 'function') return null;
  if (typeof applyMaterialFlagsForPart !== 'function') return null;

  const providedId = (opts && opts.id) ? String(opts.id) : null;
  const id = providedId || newPartId();
  const uv = (opts && opts.uvMode) ? opts.uvMode : getDefaultUvModeForArchetypeId(arch.id);
  debugEvent('shape.create.start', { partId: id, archetypeId: arch.id, uvMode: uv });
  const defaults = getDefaultParamsForArchetypeId(arch.id);
  const params = defaults ? { ...defaults, ...((opts && opts.params) ? opts.params : {}) } : ((opts && opts.params) ? { ...opts.params } : null);
  const geo0 = arch.build(params || undefined);
  const geo = (typeof applyUvModeToGeometry === 'function') ? (applyUvModeToGeometry(geo0, uv) || geo0) : geo0;
  if (geo !== geo0) geo0.dispose();

  const compOff = createOffscreenCanvas();
  if (arch && arch.id === 'plane') {
    try { compOff.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE); } catch (_) {}
  } else {
    try {
      compOff.ctx.fillStyle = editorBg;
      compOff.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    } catch (_) {}
  }

  const part = {
    id,
    name: (opts && opts.name) ? opts.name : arch.label,
    type: arch.id,
    params: params,
    visible: true,
    locked: false,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    material: {
      baseColor: '#ffffff',
      roughness: 0.6,
      metalness: 0.0,
      emissive: 0.0,
      emissiveColor: '#e8c88e',
    },
    uvMode: uv,
    selectedIslandId: null,
    layers: [],
    activeLayerIndex: 0,
    imageBitmap: null,
    imageTransform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
    shapeScale: null,
    _compositeCanvas: compOff.canvas,
    _compositeCtx: compOff.ctx,
    _texture: null,
    _mesh: null
  };

  const mat = createMaterial(part.material);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = id;
  mesh.userData.shapeId = id;
  mesh.visible = true;
  if (!(opts && (opts.scale || opts.fitToUnit === false))) {
    let fit = 1;
    try {
      if (geo && typeof geo.computeBoundingBox === 'function') geo.computeBoundingBox();
      const bb = geo ? geo.boundingBox : null;
      if (bb) {
        const sz = new THREE.Vector3();
        bb.getSize(sz);
        const m = Math.max(sz.x, sz.y, sz.z);
        if (isFinite(m) && m > 1e-6) fit = 1 / m;
      }
    } catch (_) {}
    if (fit !== 1 && isFinite(fit) && fit > 0) {
      mesh.scale.set(fit, fit, fit);
    }
  }
  if (opts && opts.position) mesh.position.copy(opts.position);
  if (opts && opts.rotation) mesh.rotation.set(opts.rotation.x, opts.rotation.y, opts.rotation.z);
  if (opts && opts.scale) mesh.scale.set(opts.scale.x, opts.scale.y, opts.scale.z);
  part.transform.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
  part.transform.rotation = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
  part.transform.scale = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };

  assemblyRoot.add(mesh);
  part._mesh = mesh;
  applyMaterialFlagsForPart(part, mesh.material);
  if (mesh.material) mesh.material.needsUpdate = true;
  debugEvent('shape.create.success', { partId: id, archetypeId: arch.id, uvMode: part.uvMode, hasMesh: !!part._mesh });
  return part;
}

export function replaceSelectedPartArchetype(ctx) {
  const arch = ctx?.arch || null;
  const refs = ctx?.refs || null;
  const getSelectedPart = ctx?.getSelectedPart || null;
  const mutateProject = ctx?.mutateProject || null;
  const syncVisibleToSelectedPart = ctx?.syncVisibleToSelectedPart || null;
  const ensureTransformState = ctx?.ensureTransformState || null;
  const THREE = ctx?.THREE || null;
  const applyMaterialFlagsForPart = ctx?.applyMaterialFlagsForPart || null;
  const getDefaultUvModeForArchetypeId = ctx?.getDefaultUvModeForArchetypeId || null;
  const getDefaultParamsForArchetypeId = ctx?.getDefaultParamsForArchetypeId || null;
  const applyUvModeToGeometry = ctx?.applyUvModeToGeometry || null;
  const setUVMode = ctx?.setUVMode || null;
  const updateInfoForMesh = ctx?.updateInfoForMesh || null;
  const renderUvOverlay = ctx?.renderUvOverlay || null;
  const drawBaseLayer = ctx?.drawBaseLayer || null;
  const requestApplyTexture = ctx?.requestApplyTexture || null;
  const renderTreeUI = ctx?.renderTreeUI || null;
  const renderShapeParamsUI = ctx?.renderShapeParamsUI || null;
  const updateShapeTransformControlsFromSelected = ctx?.updateShapeTransformControlsFromSelected || null;
  const openDoodleModal = ctx?.openDoodleModal || null;

  if (!arch || !refs) return;
  if (!THREE) return;
  if (typeof getSelectedPart !== 'function') return;
  if (typeof mutateProject !== 'function') return;
  if (typeof syncVisibleToSelectedPart !== 'function') return;
  if (typeof ensureTransformState !== 'function') return;
  if (typeof applyMaterialFlagsForPart !== 'function') return;
  if (typeof getDefaultUvModeForArchetypeId !== 'function') return;
  if (typeof getDefaultParamsForArchetypeId !== 'function') return;

  const part = getSelectedPart();
  if (!part || !part._mesh) return;
  if (arch && arch.id === 'doodle') {
    try { openDoodleModal && openDoodleModal(); } catch (_) {}
    return;
  }

  mutateProject(() => {
    syncVisibleToSelectedPart();
    part.type = arch.id;
    part.uvMode = getDefaultUvModeForArchetypeId(arch.id);
    const defaults = getDefaultParamsForArchetypeId(arch.id);
    part.params = defaults ? { ...defaults } : null;
    const t = ensureTransformState(part);
    if (arch && (arch.id === 'plane' || arch.id === 'dome' || arch.id === 'hemi_open') && part._mesh && part._mesh.material) {
      try { part._mesh.material.side = THREE.DoubleSide; } catch (_) {}
      try { part._mesh.material.needsUpdate = true; } catch (_) {}
    } else if (part._mesh && part._mesh.material) {
      try { part._mesh.material.side = THREE.FrontSide; } catch (_) {}
      try { part._mesh.material.needsUpdate = true; } catch (_) {}
    }
    applyMaterialFlagsForPart(part, part._mesh.material);
    const geo0 = arch.build(part.params || undefined);
    const nextGeo = (typeof applyUvModeToGeometry === 'function') ? (applyUvModeToGeometry(geo0, part.uvMode) || geo0) : geo0;
    if (nextGeo !== geo0) geo0.dispose();
    if (part._mesh.geometry) part._mesh.geometry.dispose();
    part._mesh.geometry = nextGeo;
    if (refs && refs.selectionHelper && typeof refs.selectionHelper.setFromObject === 'function' && part._mesh) {
      try { refs.selectionHelper.setFromObject(part._mesh); } catch (_) {}
    }
    const ctxUpdateGizmo = ctx && typeof ctx.updateGizmo === 'function' ? ctx.updateGizmo : (updateGizmo || null);
    if (typeof ctxUpdateGizmo === 'function' && part._mesh) {
      try { ctxUpdateGizmo({ refs, gizmoRoot: refs.gizmoRoot || null }); } catch (_) {}
    }
    try {
      const viewportMarkDirty = (XR && XR.__modules && XR.__modules.ViewportRuntime && XR.__modules.ViewportRuntime.markDirty) || null;
      if (typeof viewportMarkDirty === 'function') viewportMarkDirty(30);
    } catch (_) {}
    refs.uvMode = part.uvMode;
    try { setUVMode && setUVMode(refs.uvMode, { silent: true, skipRemap: true, applyTexture: false }); } catch (_) {}
    try { updateInfoForMesh && updateInfoForMesh(part._mesh); } catch (_) {}
    try { renderUvOverlay && renderUvOverlay(); } catch (_) {}
    try { drawBaseLayer && drawBaseLayer(); } catch (_) {}
    try { requestApplyTexture && requestApplyTexture(true); } catch (_) {}
    try { renderTreeUI && renderTreeUI(); } catch (_) {}
    try { renderShapeParamsUI && renderShapeParamsUI(); } catch (_) {}
    try { updateShapeTransformControlsFromSelected && updateShapeTransformControlsFromSelected(); } catch (_) {}
  });
}

export function duplicatePart(ctx) {
  const partId = ctx?.partId ? String(ctx.partId) : '';
  const getShapeList = ctx?.getShapeList || (() => []);
  const mutateProject = ctx?.mutateProject || null;
  const getArchetypeById = ctx?.getArchetypeById || null;
  const THREE = ctx?.THREE || null;
  const ensureLayersOnPart = ctx?.ensureLayersOnPart || null;
  const imageBitmapToPngDataUrlForSave = ctx?.imageBitmapToPngDataUrlForSave || null;
  const setSelectedPart = ctx?.setSelectedPart || null;
  const setStatusKey = ctx?.setStatusKey || null;

  const newPartId = ctx?.newPartId || null;
  const getDefaultUvModeForArchetypeId = ctx?.getDefaultUvModeForArchetypeId || null;
  const getDefaultParamsForArchetypeId = ctx?.getDefaultParamsForArchetypeId || null;
  const applyUvModeToGeometry = ctx?.applyUvModeToGeometry || null;
  const createOffscreenCanvas = ctx?.createOffscreenCanvas || null;
  const CANVAS_SIZE = ctx?.CANVAS_SIZE;
  const editorBg = ctx?.editorBg;
  const createMaterial = ctx?.createMaterial || null;
  const assemblyRoot = ctx?.assemblyRoot || null;
  const applyMaterialFlagsForPart = ctx?.applyMaterialFlagsForPart || null;
  const assertLayerOwnership = ctx?.assertLayerOwnership || null;
  const disposePart = ctx?.disposePart || null;
  const createDoodlePart = ctx?.createDoodlePart || null;
  const buildDoodleRevolveFromPoints = ctx?.buildDoodleRevolveFromPoints || null;
  const buildDoodleMirrorFromPoints = ctx?.buildDoodleMirrorFromPoints || null;
  const buildDoodleFromPoints = ctx?.buildDoodleFromPoints || null;

  if (!partId) return;
  if (!THREE) return;
  if (typeof mutateProject !== 'function') return;
  if (typeof getArchetypeById !== 'function') return;
  if (typeof ensureLayersOnPart !== 'function') return;
  if (typeof imageBitmapToPngDataUrlForSave !== 'function') return;
  if (typeof setSelectedPart !== 'function') return;
  if (typeof setStatusKey !== 'function') return;

  const shapes = getShapeList();
  const src = Array.isArray(shapes) ? shapes.find(p => p && p.id === partId) : null;
  if (!src) return;

  // Duplication is a discrete command, unlike a continuous slider/drag
  // gesture. It must not join the preceding command's debounce window or an
  // immediate Undo can incorrectly roll both commands back at once.
  try { ctx?.beginDiscreteUndo?.(); } catch (err) { console.warn('[duplicate] undo boundary setup failed', err); }
  mutateProject(() => {
    const arch = getArchetypeById(src.type) || getArchetypeById('cube');
    const tPos = (src.transform && src.transform.position) ? src.transform.position : null;
    const tRot = (src.transform && src.transform.rotation) ? src.transform.rotation : null;
    const tScale = (src.transform && src.transform.scale) ? src.transform.scale : null;
    const basePos = tPos ? new THREE.Vector3(tPos.x || 0, tPos.y || 0, tPos.z || 0) : (src._mesh ? src._mesh.position.clone() : new THREE.Vector3(0, 0, 0));
    const baseRot = tRot ? new THREE.Euler(tRot.x || 0, tRot.y || 0, tRot.z || 0) : (src._mesh ? src._mesh.rotation.clone() : new THREE.Euler(0, 0, 0));
    const sx = (tScale && Number.isFinite(tScale.x)) ? tScale.x : 1;
    const sy = (tScale && Number.isFinite(tScale.y)) ? tScale.y : 1;
    const sz = (tScale && Number.isFinite(tScale.z)) ? tScale.z : 1;
    const baseScale = tScale ? new THREE.Vector3(sx, sy, sz) : (src._mesh ? src._mesh.scale.clone() : new THREE.Vector3(1, 1, 1));
    const nudge = 0.22 * Math.min(6, Array.isArray(shapes) ? shapes.length : 0);
    const spawnPos = basePos.clone().add(new THREE.Vector3(nudge, 0, nudge));

    const copy = src.type === 'doodle'
      ? (typeof createDoodlePart === 'function' ? createDoodlePart({
          points: Array.isArray(src.doodlePoints) ? src.doodlePoints : [],
          mode: (src.doodleMode === 'mirror' || src.doodleMode === 'revolve') ? src.doodleMode : 'polygon',
          params: src.params || null,
          id: newPartId?.(),
          name: (src.name || 'Doodle') + ' Copy',
          uvMode: src.uvMode,
          material: src.material || null,
          visible: src.visible !== false,
          locked: !!src.locked,
          position: spawnPos,
          rotation: baseRot,
          scale: baseScale,
          THREE,
          assemblyRoot,
          createOffscreenCanvas,
          CANVAS_SIZE,
          editorBg,
          createMaterial,
          buildDoodleRevolveFromPoints,
          buildDoodleMirrorFromPoints,
          buildDoodleFromPoints,
          applyUvModeToGeometry,
        }) : null)
      : createPartFromArchetype({
          arch,
          opts: {
            name: (src.name || 'Part') + ' Copy',
            uvMode: src.uvMode,
            position: spawnPos,
            rotation: baseRot,
            scale: baseScale
          },
          newPartId,
          getDefaultUvModeForArchetypeId,
          getDefaultParamsForArchetypeId,
          applyUvModeToGeometry,
          createOffscreenCanvas,
          CANVAS_SIZE,
          editorBg,
          createMaterial,
          THREE,
          assemblyRoot,
          applyMaterialFlagsForPart,
        });
    if (!copy) return;

    if (src.params && src.type !== 'doodle') {
      copy.params = { ...src.params };
      const geo0 = arch.build(copy.params || undefined);
      const geo = (typeof applyUvModeToGeometry === 'function') ? (applyUvModeToGeometry(geo0, copy.uvMode) || geo0) : geo0;
      if (geo !== geo0) geo0.dispose();
      if (copy._mesh && copy._mesh.geometry) copy._mesh.geometry.dispose();
      if (copy._mesh) copy._mesh.geometry = geo;
    }
    if (src.material) {
      copy.material = { ...src.material };
      if (copy._mesh && copy._mesh.material) {
        copy._mesh.material.roughness = (typeof copy.material.roughness === 'number') ? copy.material.roughness : 0.6;
        copy._mesh.material.metalness = (typeof copy.material.metalness === 'number') ? copy.material.metalness : 0.0;
        copy._mesh.material.emissiveIntensity = (typeof copy.material.emissive === 'number') ? copy.material.emissive : 0.0;
        if (copy.material.emissiveColor) copy._mesh.material.emissive = new THREE.Color(copy.material.emissiveColor);
        copy._mesh.material.needsUpdate = true;
      }
    }

    ensureLayersOnPart(src);
    const srcLayers = Array.isArray(src.layers) ? src.layers : [];
    copy.layers = cloneLayersForDuplicate(srcLayers, imageBitmapToPngDataUrlForSave);
    copy.activeLayerIndex = Number.isFinite(src.activeLayerIndex) ? src.activeLayerIndex : 0;
    const al = copy.layers.length ? Math.max(0, Math.min(copy.activeLayerIndex, copy.layers.length - 1)) : 0;
    copy.activeLayerIndex = al;
    const active = copy.layers.length ? (copy.layers[al] || null) : null;
    copy.imageBitmap = active ? (active.imageBitmap || null) : null;
    copy.imageTransform = active && active.transform ? { ratio: 1, tile: false, tileScale: 1, ...active.transform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 };
    copy.selectedIslandId = src.selectedIslandId || null;
    if (src._compositeCanvas && copy._compositeCtx) copy._compositeCtx.drawImage(src._compositeCanvas, 0, 0);

    // Fail visibly before committing a duplicate if a future clone change ever
    // reuses a mutable layer/UV object owned by the source part.
    const ownership = assertLayerOwnership?.([...shapes, copy]) || { ok: true };
    if (!ownership.ok) {
      console.error('[duplicate] layer ownership invariant failed', ownership);
      try { disposePart?.(copy); } catch (err) { console.warn('[duplicate] rejected copy disposal failed', { partId: copy.id, err }); }
      return;
    }

    if (copy) {
      try { shapes.push(copy); } catch (err) { console.error('[duplicate] adding copied part to project failed', err); }
      try { setSelectedPart(copy.id, { silent: true }); } catch (err) { console.error('[duplicate] selecting copied part failed', { partId: copy.id, err }); }
      try { setStatusKey('status_part_duplicated', 'ok'); } catch (err) { console.warn('[duplicate] status update failed', err); }
    }
  });
}

export const ShapeFactory = { createPartFromArchetype, replaceSelectedPartArchetype, duplicatePart, cloneLayersForDuplicate };
