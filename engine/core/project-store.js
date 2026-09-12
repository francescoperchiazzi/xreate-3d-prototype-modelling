import { state } from './state.js';

const subscribers = new Set();
let configuredProjectState = null;

const store = state.projectStore = state.projectStore || {
  projectId: null,
  name: 'Untitled',
  selectedId: null,
  textureMode: 'per-shape',
  selection: { activeLayerIndex: 0, uvMode: 'planar', selectedIslandId: null },
  activeLayer: { id: null, transform: null },
  revision: 0,
  reason: 'bootstrap',
};

export function configureProjectStore(opts = {}) {
  if (opts.projectState && typeof opts.projectState === 'object') {
    configuredProjectState = opts.projectState;
  }
  return { projectState: configuredProjectState };
}

function projectApi() {
  return configuredProjectState;
}

function emit() {
  for (const subscriber of subscribers) {
    try { subscriber(store); } catch (err) { console.error('[project-store] subscriber failed', err); }
  }
}

function cloneTransform(transform) {
  if (!transform || typeof transform !== 'object') return null;
  return {
    x: Number.isFinite(transform.x) ? transform.x : 0,
    y: Number.isFinite(transform.y) ? transform.y : 0,
    scale: Number.isFinite(transform.scale) ? transform.scale : 1,
    rot: Number.isFinite(transform.rot) ? transform.rot : 0,
    ratio: Number.isFinite(transform.ratio) ? transform.ratio : 1,
    tile: !!transform.tile,
    tileScale: Number.isFinite(transform.tileScale) ? transform.tileScale : 1,
    tileAnchor: transform.tileAnchor === 'topleft' ? 'topleft' : 'center',
    tileRepeat: transform.tileRepeat === 'mirror' ? 'mirror' : 'repeat',
  };
}

function snapshotFor(project) {
  const source = project || projectApi()?.getProject?.() || null;
  const selectedId = source?.selectedId || null;
  const selected = Array.isArray(source?.shapes)
    ? source.shapes.find((part) => part?.id === selectedId) || null
    : null;
  const layers = Array.isArray(selected?.layers) ? selected.layers : [];
  const requestedIndex = Number.isFinite(selected?.activeLayerIndex) ? selected.activeLayerIndex : 0;
  const activeLayerIndex = layers.length ? Math.max(0, Math.min(requestedIndex, layers.length - 1)) : 0;
  const layer = layers[activeLayerIndex] || null;
  return {
    projectId: source?.id || null,
    name: String(source?.name || 'Untitled').trim() || 'Untitled',
    selectedId,
    textureMode: source?.textureMode || 'per-shape',
    selection: {
      activeLayerIndex,
      uvMode: selected?.uvMode || 'planar',
      selectedIslandId: selected?.selectedIslandId || null,
    },
    activeLayer: {
      id: layer?.id || null,
      transform: cloneTransform(layer?.transform || selected?.imageTransform),
    },
    layer,
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// This is a deliberately scalar snapshot. Runtime meshes, ImageBitmaps and
// layer objects remain outside the store so UI state can never acquire a
// mutable object owned by another entity.
export function syncProjectStore(project, reason = 'sync') {
  const snapshot = snapshotFor(project);
  store.projectId = snapshot.projectId;
  store.name = snapshot.name;
  store.selectedId = snapshot.selectedId;
  store.textureMode = snapshot.textureMode;
  store.selection = snapshot.selection;
  store.activeLayer = snapshot.activeLayer;
  store.revision += 1;
  store.reason = reason;
  emit();
  return store;
}

// Temporary migration guard: compare the modern serializable snapshot to the
// legacy project after every selected/layer command. It never repairs state;
// a mismatch must remain visible for diagnosis.
export function assertProjectStoreMirror(project, legacyRefs = null, reason = 'assert') {
  const expected = snapshotFor(project);
  const mismatches = [];
  if (store.projectId !== expected.projectId) mismatches.push('projectId');
  if (store.name !== expected.name) mismatches.push('name');
  if (store.selectedId !== expected.selectedId) mismatches.push('selectedId');
  if (store.textureMode !== expected.textureMode) mismatches.push('textureMode');
  if (!sameJson(store.selection, expected.selection)) mismatches.push('selection');
  if (!sameJson(store.activeLayer, expected.activeLayer)) mismatches.push('activeLayer');
  if (legacyRefs?.imageTransform && expected.layer?.transform && legacyRefs.imageTransform === expected.layer.transform) {
    mismatches.push('shared-imageTransform-reference');
  }
  if (mismatches.length) {
    console.error('[project-store] legacy shadow mismatch', { reason, mismatches });
    return false;
  }
  return true;
}

export function getProjectStore() { return store; }
export function getSelectionState() { return { ...store.selection }; }
// External consumers receive values, never the store's mutable layer snapshot.
// Commands must go through dispatch/LayerController so a Shell event cannot
// silently reintroduce cross-entity transform aliasing.
export function getActiveLayerState() {
  return {
    id: store.activeLayer?.id || null,
    transform: cloneTransform(store.activeLayer?.transform),
  };
}

export function subscribeProjectStore(subscriber) {
  if (typeof subscriber !== 'function') return () => {};
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function dispatchProject(action) {
  const type = action?.type;
  const api = projectApi();
  if (type === 'selection/set') {
    const selectedId = action?.selectedId || null;
    if (api?.setSelectedId) api.setSelectedId(selectedId, { markModified: action?.markModified !== false });
    return syncProjectStore(api?.getProject?.(), type);
  }
  if (type === 'selection/uv-mode-set') {
    const project = api?.getProject?.() || action?.project || null;
    const selectedId = action?.selectedId || project?.selectedId || null;
    const selected = Array.isArray(project?.shapes)
      ? project.shapes.find((part) => part?.id === selectedId) || null
      : null;
    if (!selected) {
      console.error('[project-store] UV mode action received without selected part');
      return store;
    }
    selected.uvMode = String(action?.uvMode || 'planar');
    selected.selectedIslandId = null;
    if (project.meta && action?.markModified !== false) project.meta.modified = Date.now();
    return syncProjectStore(project, type);
  }
  if (type === 'selection/island-set') {
    const project = api?.getProject?.() || action?.project || null;
    const selectedId = action?.selectedId || project?.selectedId || null;
    const selected = Array.isArray(project?.shapes)
      ? project.shapes.find((part) => part?.id === selectedId) || null
      : null;
    if (!selected) {
      console.error('[project-store] UV island action received without selected part');
      return store;
    }
    selected.selectedIslandId = action?.selectedIslandId ? String(action.selectedIslandId) : null;
    if (project.meta && action?.markModified === true) project.meta.modified = Date.now();
    return syncProjectStore(project, type);
  }
  if (type === 'texture-mode/set') {
    const project = api?.getProject?.() || action?.project || null;
    if (!project) {
      console.error('[project-store] texture-mode action received without project');
      return store;
    }
    project.textureMode = action?.textureMode === 'shared' ? 'shared' : 'per-shape';
    if (project.meta && action?.markModified !== false) project.meta.modified = Date.now();
    return syncProjectStore(project, type);
  }
  if (type === 'project/name-set') {
    const project = api?.getProject?.() || action?.project || null;
    if (!project) {
      console.error('[project-store] project-name action received without project');
      return store;
    }
    const nextName = String(action?.name || '').trim() || 'Untitled';
    if (api?.setProjectName) api.setProjectName(nextName);
    else {
      project.name = nextName;
      if (project.meta && action?.markModified !== false) project.meta.modified = Date.now();
    }
    return syncProjectStore(project, type);
  }
  if (type === 'project/sync') return syncProjectStore(action?.project || api?.getProject?.(), action?.reason || type);
  console.warn('[project-store] unsupported action', { type });
  return store;
}

export const ProjectStore = {
  configure: configureProjectStore,
  getState: getProjectStore,
  getSelectionState,
  getActiveLayerState,
  subscribe: subscribeProjectStore,
  dispatch: dispatchProject,
  sync: syncProjectStore,
  assertMirror: assertProjectStoreMirror,
};
