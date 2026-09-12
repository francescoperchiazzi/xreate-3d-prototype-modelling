export function getSelectedPart(ctx) {
  const projectApi = ctx?.projectState || null;
  const getShapeList = ctx?.getShapeList || projectApi?.getShapeList || null;
  const getSelectedId = ctx?.getSelectedId
    || projectApi?.getSelectedId
    || (() => {
      const project = ctx?.project || null;
      return (project && project.selectedId) ? project.selectedId : null;
    });
  if (!getShapeList) return null;
  const shapes = getShapeList();
  const selectedId = getSelectedId ? getSelectedId() : null;
  if (!selectedId) return null;
  return shapes.find((p) => p.id === selectedId) || null;
}

export function setSelectedPart(ctx) {
  const projectApi = ctx?.projectState || null;
  const projectStore = ctx?.projectStore || null;
  const editorStore = ctx?.editorStore || null;
  const markViewportDirty = ctx?.markViewportDirty || null;
  const partId = ctx?.partId;
  const options = ctx?.options || null;
  const project = ctx?.project || null;
  const refs = ctx?.refs || {};
  const getShapeList = ctx?.getShapeList || projectApi?.getShapeList || null;
  const getSelectedPartFn = ctx?.getSelectedPart || (() => getSelectedPart(ctx || {}));
  const syncVisibleToSelectedPart = ctx?.syncVisibleToSelectedPart || null;
  const tr = ctx?.tr || ((key) => String(key));
  const scene = ctx?.scene || null;
  const THREERef = ctx?.THREE || null;
  const applyTransformToMesh = ctx?.applyTransformToMesh || null;
  const ensureTransformState = ctx?.ensureTransformState || null;
  const applyMaterialStateToMesh = ctx?.applyMaterialStateToMesh || null;
  const getDefaultUvModeForArchetypeId = ctx?.getDefaultUvModeForArchetypeId || null;
  const setUVMode = ctx?.setUVMode || null;
  const ensureLayersOnPart = ctx?.ensureLayersOnPart || null;
  const syncSelectionPanels = ctx?.syncSelectionPanels || null;
  const updateTransformUi = ctx?.updateTransformUi || null;
  const syncImageSliderControlsFromTransform = ctx?.syncImageSliderControlsFromTransform || null;
  const drawBaseLayer = ctx?.drawBaseLayer || null;
  const renderLayerListUI = ctx?.renderLayerListUI || null;
  const hydrateLayerBitmapIfNeeded = ctx?.hydrateLayerBitmapIfNeeded || null;
  const ensureGizmo = ctx?.ensureGizmo || null;
  const updateGizmo = ctx?.updateGizmo || null;
  const renderTreeUI = ctx?.renderTreeUI || null;
  const renderShapeParamsUI = ctx?.renderShapeParamsUI || null;
  const updateShapeTransformControlsFromSelected = ctx?.updateShapeTransformControlsFromSelected || null;
  const renderUvOverlay = ctx?.renderUvOverlay || null;
  const requestApplyTexture = ctx?.requestApplyTexture || null;
  const updateComposite = ctx?.updateComposite || null;
  const updateUVPreview = ctx?.updateUVPreview || null;
  const updateInfoForMesh = ctx?.updateInfoForMesh || null;
  const setStatus = ctx?.setStatus || null;
  const getArchetypeById = ctx?.getArchetypeById || null;

  const prev = getSelectedPartFn ? getSelectedPartFn() : null;

  const shapes = getShapeList ? getShapeList() : [];
  const next = shapes.find((p) => p.id === partId) || null;
  if (next && next.locked) {
    debugEvent('selection.blocked', { partId: next.id, reason: 'locked' });
    return;
  }
  debugEvent('selection.resolve', { requestedId: partId || null, previousId: prev?.id || null, nextId: next?.id || null, nextType: next?.type || null });
  if (projectStore && typeof projectStore.dispatch === 'function') {
    try {
      projectStore.dispatch({ type: 'selection/set', selectedId: next ? next.id : null });
    } catch (err) {
      console.error('[selection] project-store selection command failed', { partId: next ? next.id : null, err });
      if (projectApi && typeof projectApi.setSelectedId === 'function') projectApi.setSelectedId(next ? next.id : null);
    }
  } else if (projectApi && typeof projectApi.setSelectedId === 'function') {
    try {
      projectApi.setSelectedId(next ? next.id : null);
    } catch (_) {
      if (project) {
        project.selectedId = next ? next.id : null;
        if (project.meta) project.meta.modified = Date.now();
      }
    }
  } else if (project) {
    project.selectedId = next ? next.id : null;
    if (project.meta) project.meta.modified = Date.now();
  }
  try {
    projectStore?.sync?.(projectApi?.getProject?.() || project, 'selection/set');
    projectStore?.assertMirror?.(projectApi?.getProject?.() || project, refs, 'selection/set');
  } catch (err) { console.error('[selection] project-store sync failed', { partId: next?.id || null, err }); }

  try { syncSelectionPanels && syncSelectionPanels({ shapes, next }); } catch (_) {}

  if (!next) {
    try { editorStore?.syncSelectionShadow?.(null); } catch (err) { console.error('[selection] shadow-store clear failed', err); }
    refs.currentMesh = null;
    refs.currentArchetype = null;
    if (typeof ctx?.currentMesh !== 'undefined') ctx.currentMesh = null;
    if (typeof ctx?.currentArchetype !== 'undefined') ctx.currentArchetype = null;
    if (refs.selectionHelper) {
      try { scene?.remove(refs.selectionHelper); } catch (_) {}
      if (refs.selectionHelper.geometry) refs.selectionHelper.geometry.dispose();
      if (refs.selectionHelper.material) refs.selectionHelper.material.dispose();
      refs.selectionHelper = null;
    }
    if (refs.gizmoRoot) refs.gizmoRoot.visible = false;
    if (typeof ctx?.gizmoRoot !== 'undefined' && ctx.gizmoRoot) ctx.gizmoRoot.visible = false;
    try {
      const ensuredGizmo = ensureGizmo && ensureGizmo(ctx);
      if (ensuredGizmo) refs.gizmoRoot = ensuredGizmo;
    } catch (_) {}
    try { updateGizmo && updateGizmo(ctx); } catch (_) {}
    try {
      if (typeof markViewportDirty === 'function') markViewportDirty(30);
    } catch (_) {}
    try { renderTreeUI && renderTreeUI(); } catch (_) {}
    debugEvent('selection.deselected', { previousId: prev?.id || null, gizmoVisible: false });
    return;
  }

  refs.currentMesh = next._mesh;
  refs.currentArchetype = getArchetypeById ? getArchetypeById(next.type) : null;
  if (!refs.currentMesh) {
    try { syncSelectionPanels && syncSelectionPanels({ shapes, next: null }); } catch (_) {}
    try {
      if (projectApi && typeof projectApi.setSelectedId === 'function') {
        try { projectApi.setSelectedId(null); } catch (_) { if (project) project.selectedId = null; }
      } else if (project) {
        project.selectedId = null;
      }
      try {
        projectStore?.sync?.(projectApi?.getProject?.() || project, 'selection/clear-missing-mesh');
        projectStore?.assertMirror?.(projectApi?.getProject?.() || project, refs, 'selection/clear-missing-mesh');
      } catch (err) { console.error('[selection] project-store clear sync failed', err); }
    } catch (_) {}
    try { renderTreeUI && renderTreeUI(); } catch (_) {}
    debugEvent('selection.missing-mesh', { partId: next.id });
    return;
  }
  if (typeof ctx?.currentMesh !== 'undefined') {
    ctx.currentMesh = next._mesh;
  }
  if (typeof ctx?.currentArchetype !== 'undefined') {
    ctx.currentArchetype = refs.currentArchetype || null;
  }
  try {
    syncSelectionPanels && syncSelectionPanels({
      shapes,
      next,
      currentArchetypeLabel: refs.currentArchetype ? refs.currentArchetype.label : null,
    });
  } catch (_) {}

  if (refs.currentMesh && next.transform) {
    try { applyTransformToMesh && applyTransformToMesh(next); } catch (_) {}
  } else if (refs.currentMesh && !next.transform) {
    const t = ensureTransformState ? ensureTransformState(next) : null;
    if (t) {
      t.position = { x: refs.currentMesh.position.x, y: refs.currentMesh.position.y, z: refs.currentMesh.position.z };
      t.rotation = { x: refs.currentMesh.rotation.x, y: refs.currentMesh.rotation.y, z: refs.currentMesh.rotation.z };
      const u = refs.currentMesh.scale.x;
      t.scale = { x: u, y: u, z: u };
    }
    try { applyTransformToMesh && applyTransformToMesh(next); } catch (_) {}
  }

  if (refs.currentMesh && refs.currentMesh.material) {
    if (!next.material) {
      next.material = {
        baseColor: (refs.currentMesh.material && refs.currentMesh.material.color) ? ('#' + refs.currentMesh.material.color.getHexString()) : '#ffffff',
        roughness: (typeof refs.currentMesh.material.roughness === 'number') ? refs.currentMesh.material.roughness : 0.6,
        metalness: (typeof refs.currentMesh.material.metalness === 'number') ? refs.currentMesh.material.metalness : 0.0,
        emissive: (typeof refs.currentMesh.material.emissiveIntensity === 'number') ? refs.currentMesh.material.emissiveIntensity : 0.0,
        emissiveColor: '#e8c88e',
      };
    } else {
      try { applyMaterialStateToMesh && applyMaterialStateToMesh(next); } catch (_) {}
    }
  }

  refs.uvMode = next.uvMode
    || (typeof getDefaultUvModeForArchetypeId === 'function' ? getDefaultUvModeForArchetypeId(next.type) : null)
    || refs.uvMode
    || 'planar';
  try { setUVMode && setUVMode(refs.uvMode, { silent: true, skipRemap: true, applyTexture: false }); } catch (_) {}

  try { ensureLayersOnPart && ensureLayersOnPart(next); } catch (_) {}
  const layers = next.layers || [];
  const storedActive = Number.isFinite(next.activeLayerIndex) ? next.activeLayerIndex : 0;
  refs.activeLayerIndex = layers.length ? Math.max(0, Math.min(storedActive, layers.length - 1)) : 0;
  next.activeLayerIndex = refs.activeLayerIndex;
  const layer = layers.length ? (layers[refs.activeLayerIndex] || null) : null;
  refs.imageBitmap = layer ? (layer.imageBitmap || null) : null;
  refs.imageTransform = layer && layer.transform
    ? { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, ...layer.transform }
    : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, ...(next.imageTransform || {}) };
  refs.imageTransform.tileAnchor = (refs.imageTransform.tileAnchor === 'topleft' || refs.imageTransform.tileAnchor === 'top-left') ? 'topleft' : 'center';
  refs.imageTransform.tileRepeat = (refs.imageTransform.tileRepeat === 'mirror') ? 'mirror' : 'repeat';
  refs.selectedIslandId = null;
  try {
    projectStore?.sync?.(projectApi?.getProject?.() || project, 'selection/hydrated-layer');
    projectStore?.assertMirror?.(projectApi?.getProject?.() || project, refs, 'selection/hydrated-layer');
  } catch (err) { console.error('[selection] project-store layer sync failed', { partId: next.id, err }); }
  try { editorStore?.syncSelectionShadow?.(next, { legacyTransform: refs.imageTransform }); } catch (err) { console.error('[selection] shadow-store sync failed', { partId: next.id, err }); }
  try { updateTransformUi && updateTransformUi(); } catch (_) {}
  try { syncImageSliderControlsFromTransform && syncImageSliderControlsFromTransform(); } catch (_) {}
  try { drawBaseLayer && drawBaseLayer(); } catch (_) {}
  try { renderLayerListUI && renderLayerListUI(); } catch (_) {}
  try { hydrateLayerBitmapIfNeeded && hydrateLayerBitmapIfNeeded(layer, next); } catch (_) {}

  if (refs.currentMesh && THREERef) {
    if (!refs.selectionHelper) {
      refs.selectionHelper = new THREERef.BoxHelper(refs.currentMesh, 0xe8c88e);
      try { scene?.add(refs.selectionHelper); } catch (_) {}
    } else if (typeof refs.selectionHelper.setFromObject === 'function') {
      try {
        refs.selectionHelper.setFromObject(refs.currentMesh);
      } catch (_) {
        try { scene?.remove(refs.selectionHelper); } catch (_e) {}
        if (refs.selectionHelper.geometry) refs.selectionHelper.geometry.dispose();
        if (refs.selectionHelper.material) refs.selectionHelper.material.dispose();
        refs.selectionHelper = new THREERef.BoxHelper(refs.currentMesh, 0xe8c88e);
        try { scene?.add(refs.selectionHelper); } catch (_e) {}
      }
    }
  }
  try {
    // The bridge may allocate lazily.  Preserve its returned singleton in the
    // selection refs before writeRefs runs; otherwise the next selection can
    // overwrite it with null and leave the old visual root at its last pivot.
    const ensuredGizmo = ensureGizmo && ensureGizmo(ctx);
    if (ensuredGizmo) refs.gizmoRoot = ensuredGizmo;
  } catch (_) {}
  if (refs.gizmoRoot) refs.gizmoRoot.visible = true;
  if (typeof ctx?.gizmoRoot !== 'undefined' && refs.gizmoRoot) ctx.gizmoRoot = refs.gizmoRoot;
  if (ctx?.gizmoRoot) ctx.gizmoRoot.visible = true;
  try { updateGizmo && updateGizmo(ctx); } catch (_) {}

  try { renderTreeUI && renderTreeUI(); } catch (_) {}
  try { renderShapeParamsUI && renderShapeParamsUI(); } catch (_) {}
  try { updateShapeTransformControlsFromSelected && updateShapeTransformControlsFromSelected(); } catch (_) {}
  try { renderUvOverlay && renderUvOverlay(); } catch (_) {}
  if (!(options && options.skipApplyTexture)) {
    try { requestApplyTexture && requestApplyTexture(true); } catch (_) {}
  } else {
    try { updateComposite && updateComposite(); } catch (_) {}
    try { updateUVPreview && updateUVPreview(); } catch (_) {}
  }
  try { updateInfoForMesh && updateInfoForMesh(refs.currentMesh); } catch (_) {}
  if (!(options && options.silent)) {
    const name = String(next.name || '').trim() || tr('status_part_fallback');
    try { setStatus && setStatus(name + ' ' + tr('status_selected_suffix'), ''); } catch (_) {}
  }
  try {
    if (typeof markViewportDirty === 'function') markViewportDirty(30);
  } catch (_) {}
  debugEvent('selection.applied', {
    partId: next.id,
    type: next.type,
    uvMode: refs.uvMode,
    layerCount: layers.length,
    activeLayerIndex: refs.activeLayerIndex,
    hasSelectionHelper: !!refs.selectionHelper,
    gizmoVisible: !!refs.gizmoRoot?.visible,
  });
}
import { event as debugEvent } from '../debug/event-log.js';
