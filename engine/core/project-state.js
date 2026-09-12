import { state } from './state.js';

const projectState = state.projectState = state.projectState || {
  project: null,
  createProjectId: () => {
    return `xreate_${String(Date.now())}`;
  },
  createLayerId: () => {
    return `layer_${String(Date.now())}`;
  },
};

function defaultLayerTransform(base) {
  const fallback = {
    x: 0,
    y: 0,
    scale: 1,
    rot: 0,
    ratio: 1,
    tile: false,
    tileScale: 1,
    tileAnchor: 'center',
    tileRepeat: 'repeat',
  };
  return { ...fallback, ...(base || {}) };
}

function clonePolygonMaskPoints(points) {
  return (Array.isArray(points) && points.length)
    ? points.map((point) => ({ x: point?.x, y: point?.y }))
    : null;
}

// Development invariant for the texture pipeline: serializable layer state is
// owned by exactly one part. ImageBitmap pixel data may be shared, but the
// layer object and every mutable UV transform must not be.
export function assertLayerOwnership(projectOrShapes) {
  const shapes = Array.isArray(projectOrShapes)
    ? projectOrShapes
    : (Array.isArray(projectOrShapes?.shapes) ? projectOrShapes.shapes : []);
  const layerOwners = new Map();
  const transformOwners = new Map();
  for (const part of shapes) {
    if (!part || !Array.isArray(part.layers)) continue;
    const partId = String(part.id || '<unknown>');
    for (const layer of part.layers) {
      if (!layer || typeof layer !== 'object') continue;
      const layerOwner = layerOwners.get(layer);
      if (layerOwner && layerOwner !== partId) {
        return { ok: false, kind: 'layer', firstPartId: layerOwner, secondPartId: partId, layerId: layer.id || null };
      }
      layerOwners.set(layer, partId);
      if (!layer.transform || typeof layer.transform !== 'object') continue;
      const transformOwner = transformOwners.get(layer.transform);
      if (transformOwner && transformOwner !== partId) {
        return { ok: false, kind: 'transform', firstPartId: transformOwner, secondPartId: partId, layerId: layer.id || null };
      }
      transformOwners.set(layer.transform, partId);
    }
  }
  return { ok: true, layerCount: layerOwners.size, transformCount: transformOwners.size };
}

export function createLayer(data) {
  return {
    id: String(data?.id || projectState.createLayerId()),
    label: String(data?.label || 'Layer 1'),
    imageBitmap: data?.imageBitmap || null,
    imageDataUrl: data?.imageDataUrl || null,
    transform: defaultLayerTransform(data?.transform),
    visible: data?.visible !== false,
    clippingIslandId: data?.clippingIslandId || null,
    polygonMaskPoints: clonePolygonMaskPoints(data?.polygonMaskPoints),
    maskLinked: data?.maskLinked !== false,
    opacity: (typeof data?.opacity === 'number' && isFinite(data.opacity)) ? data.opacity : 1.0,
    blendMode: data?.blendMode || 'source-over',
  };
}

export function cloneLayer(layer, opts) {
  const label = opts?.label || `${String(layer?.label || 'Layer')} copy`;
  return createLayer({
    ...layer,
    id: opts?.id || null,
    label,
    imageBitmap: opts?.preserveBitmap ? (layer?.imageBitmap || null) : null,
    imageDataUrl: opts?.imageDataUrl !== undefined ? opts.imageDataUrl : (layer?.imageDataUrl || null),
  });
}

export function configureProjectState(opts) {
  if (opts && typeof opts.createProjectId === 'function') {
    projectState.createProjectId = opts.createProjectId;
  }
  if (opts && typeof opts.createLayerId === 'function') {
    projectState.createLayerId = opts.createLayerId;
  }
  return projectState;
}

export function createProjectId() {
  return String(projectState.createProjectId());
}

export function createLayerId() {
  return String(projectState.createLayerId());
}

export function createDefaultProject() {
  return {
    id: createProjectId(),
    name: 'Untitled',
    shapes: [],
    selectedId: null,
    textureMode: 'per-shape',
    _sharedTexture: null,
    _undoStack: [],
    _redoStack: [],
    meta: {
      created: Date.now(),
      modified: Date.now(),
      version: '2.2.0',
    },
  };
}

export function setProject(nextProject) {
  projectState.project = nextProject || createDefaultProject();
  try {
    window.dispatchEvent(new CustomEvent('xr:project-changed', {
      detail: { project: projectState.project },
    }));
  } catch (_) {}
  return projectState.project;
}

export function getProject() {
  if (!projectState.project) {
    projectState.project = createDefaultProject();
  }
  return projectState.project;
}

export function getProjectMetaModified() {
  const project = getProject();
  return (project && project.meta) ? project.meta.modified : null;
}

export function getShapeList() {
  const project = getProject();
  if (!Array.isArray(project.shapes)) project.shapes = [];
  return project.shapes;
}

export function setShapeList(nextShapes, opts) {
  const project = getProject();
  project.shapes = Array.isArray(nextShapes) ? nextShapes : [];
  if (!(opts && opts.markModified === false) && project.meta) {
    project.meta.modified = Date.now();
  }
  try {
    window.dispatchEvent(new CustomEvent('xr:project-changed', {
      detail: { project },
    }));
  } catch (_) {}
  return project.shapes;
}

export function getShapeById(id) {
  if (!id) return null;
  return getShapeList().find((p) => p && p.id === id) || null;
}

function markProjectChanged(project, opts, detail) {
  if (!(opts && opts.markModified === false) && project?.meta) {
    project.meta.modified = Date.now();
  }
  try {
    window.dispatchEvent(new CustomEvent('xr:project-changed', {
      detail: detail || { project },
    }));
  } catch (_) {}
}

export function getSelectedId() {
  const project = getProject();
  return (project && project.selectedId) ? project.selectedId : null;
}

export function setSelectedId(id, opts) {
  const project = getProject();
  project.selectedId = id ? String(id) : null;
  if (!(opts && opts.markModified === false) && project.meta) {
    project.meta.modified = Date.now();
  }
  try {
    window.dispatchEvent(new CustomEvent('xr:project-selection-changed', {
      detail: { selectedId: project.selectedId, project },
    }));
  } catch (_) {}
  return project.selectedId;
}

export function getSelectedPart() {
  const selectedId = getSelectedId();
  if (!selectedId) return null;
  return getShapeById(selectedId);
}

export function renameShape(id, name, opts) {
  const project = getProject();
  const shape = getShapeById(id);
  if (!shape) return null;
  const nextName = String(name || '').trim() || shape.name || shape.id || 'Untitled';
  shape.name = nextName;
  markProjectChanged(project, opts, {
    project,
    shape,
    shapeId: shape.id,
    reason: 'rename-shape',
  });
  return shape;
}

export function setShapeVisibility(id, visible, opts) {
  const project = getProject();
  const shape = getShapeById(id);
  if (!shape) return null;
  const nextVisible = visible !== false;
  shape.visible = nextVisible;
  if (shape._mesh) shape._mesh.visible = !!nextVisible;
  markProjectChanged(project, opts, {
    project,
    shape,
    shapeId: shape.id,
    reason: 'set-shape-visibility',
  });
  return shape;
}

export function toggleShapeLocked(id, opts) {
  const project = getProject();
  const shape = getShapeById(id);
  if (!shape) return null;
  shape.locked = !shape.locked;
  markProjectChanged(project, opts, {
    project,
    shape,
    shapeId: shape.id,
    reason: 'toggle-shape-locked',
  });
  return shape;
}

export function ensureLayersOnPart(part) {
  if (!part) return;
  if (Array.isArray(part.layers)) return;
  part.layers = [];
  const legacyBmp = part.imageBitmap || null;
  const legacyTransform = part.imageTransform
    ? defaultLayerTransform(part.imageTransform)
    : defaultLayerTransform();
  if (legacyBmp) {
    part.layers.push(createLayer({
      label: 'Layer 1',
      imageBitmap: legacyBmp,
      imageDataUrl: null,
      transform: legacyTransform,
    }));
  }
  part.activeLayerIndex = 0;
}

export function getLayers(part) {
  if (!part) return [];
  ensureLayersOnPart(part);
  return Array.isArray(part.layers) ? part.layers : [];
}

export function getActiveLayerIndex(part) {
  const layers = getLayers(part);
  if (!layers.length) return 0;
  const raw = (typeof part?.activeLayerIndex === 'number' && isFinite(part.activeLayerIndex))
    ? part.activeLayerIndex
    : 0;
  return Math.max(0, Math.min(raw, layers.length - 1));
}

export function setActiveLayerIndex(part, idx) {
  const layers = getLayers(part);
  const nextIdx = layers.length
    ? Math.max(0, Math.min(Number.isFinite(idx) ? idx : 0, layers.length - 1))
    : 0;
  if (part) part.activeLayerIndex = nextIdx;
  return nextIdx;
}

export function toggleLayerVisibility(part, idx) {
  const layers = getLayers(part);
  const layer = layers[idx] || null;
  if (!layer) return null;
  layer.visible = !(layer.visible === false);
  return layer;
}

export function clearLayerPolygonMask(part, idx) {
  const layers = getLayers(part);
  const layer = layers[idx] || null;
  if (!layer) return null;
  layer.polygonMaskPoints = null;
  return layer;
}

export function renameLayer(part, idx, name) {
  const layers = getLayers(part);
  const layer = layers[idx] || null;
  if (!layer) return null;
  const next = String(name || '').trim();
  if (next) layer.label = next;
  else delete layer.label;
  return layer;
}

export function addLayer(part, data) {
  const layers = getLayers(part);
  const layer = createLayer(data);
  layers.push(layer);
  setActiveLayerIndex(part, layers.length - 1);
  return { layer, index: layers.length - 1, layers };
}

export function duplicateLayer(part, idx, opts) {
  const layers = getLayers(part);
  const src = layers[idx] || null;
  if (!src) return null;
  const dup = cloneLayer(src, {
    label: opts?.label,
    imageDataUrl: opts?.imageDataUrl,
    preserveBitmap: true,
  });
  layers.push(dup);
  const nextIndex = setActiveLayerIndex(part, layers.length - 1);
  return { layer: dup, index: nextIndex, layers };
}

export function deleteLayer(part, idx) {
  const layers = getLayers(part);
  if (idx < 0 || idx >= layers.length) return null;
  layers.splice(idx, 1);
  const nextIndex = setActiveLayerIndex(part, layers.length ? Math.min(idx, layers.length - 1) : 0);
  return { index: nextIndex, layers };
}

export function moveLayer(part, idx, delta) {
  const layers = getLayers(part);
  const target = idx + delta;
  if (idx < 0 || idx >= layers.length) return null;
  if (target < 0 || target >= layers.length) return null;
  const tmp = layers[idx];
  layers[idx] = layers[target];
  layers[target] = tmp;
  const activeIndex = getActiveLayerIndex(part);
  if (activeIndex === idx) setActiveLayerIndex(part, target);
  else if (activeIndex === target) setActiveLayerIndex(part, idx);
  return { index: getActiveLayerIndex(part), layers };
}

export function setProjectName(name) {
  const project = getProject();
  project.name = String(name || '').trim() || 'Untitled';
  if (project.meta) project.meta.modified = Date.now();
  try {
    window.dispatchEvent(new CustomEvent('xr:project-name-changed', {
      detail: { name: project.name, project },
    }));
  } catch (_) {}
  return project.name;
}

export const ProjectState = {
  configure: configureProjectState,
  createProjectId,
  createLayerId,
  createDefaultProject,
  setProject,
  getProject,
  getProjectMetaModified,
  getShapeList,
  setShapeList,
  getShapeById,
  renameShape,
  setShapeVisibility,
  toggleShapeLocked,
  getSelectedId,
  setSelectedId,
  getSelectedPart,
  ensureLayersOnPart,
  createLayer,
  cloneLayer,
  assertLayerOwnership,
  getLayers,
  getActiveLayerIndex,
  setActiveLayerIndex,
  toggleLayerVisibility,
  clearLayerPolygonMask,
  renameLayer,
  addLayer,
  duplicateLayer,
  deleteLayer,
  moveLayer,
  setProjectName,
};
