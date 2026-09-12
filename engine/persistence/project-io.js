import { createDoodlePart } from '../shapes/doodle-controller.js';

function resolveProjectStateApi(opts) {
  const api = opts?.projectState || null;
  return {
    getProject: opts && typeof opts.getProject === 'function'
      ? opts.getProject
      : (api && typeof api.getProject === 'function' ? () => api.getProject() : () => null),
    getShapeList: opts && typeof opts.getShapeList === 'function'
      ? opts.getShapeList
      : (api && typeof api.getShapeList === 'function' ? () => api.getShapeList() : () => []),
    setShapeList: opts && typeof opts.setShapeList === 'function'
      ? opts.setShapeList
      : (api && typeof api.setShapeList === 'function' ? (shapes, cfg) => api.setShapeList(shapes, cfg) : null),
    setSelectedId: opts && typeof opts.setSelectedId === 'function'
      ? opts.setSelectedId
      : (api && typeof api.setSelectedId === 'function' ? (id, cfg) => api.setSelectedId(id, cfg) : null),
  };
}

function serializeShapeForSave(shape, opts) {
  if (!shape) return null;
  const t = shape.transform || { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const m = shape.material || { roughness: 0.6, metalness: 0.0, emissive: 0.0, emissiveColor: '#e8c88e' };
  const ts = t && t.scale ? t.scale : null;
  const sx = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.x)) ? ts.x : 1);
  const sy = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.y)) ? ts.y : 1);
  const sz = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.z)) ? ts.z : 1);
  const layers = Array.isArray(shape.layers) ? shape.layers : (shape.imageBitmap ? [{
    id: 'layer_legacy',
    label: 'Layer 1',
    imageBitmap: shape.imageBitmap,
    imageDataUrl: null,
    transform: shape.imageTransform ? { ratio: 1, tile: false, tileScale: 1, ...shape.imageTransform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
    visible: true,
    clippingIslandId: null,
    polygonMaskPoints: null,
    maskLinked: true,
    opacity: 1.0,
    blendMode: 'source-over',
  }] : []);
  const rawActive = Number.isFinite(shape.activeLayerIndex) ? shape.activeLayerIndex : 0;
  const activeIdx = layers.length ? Math.max(0, Math.min(rawActive, layers.length - 1)) : 0;
  const activeLayer = layers.length ? (layers[activeIdx] || null) : null;
  const legacyImageDataUrl = activeLayer
    ? (activeLayer.imageDataUrl || opts.imageBitmapToPngDataUrlForSave(activeLayer.imageBitmap))
    : opts.imageBitmapToPngDataUrlForSave(shape.imageBitmap);
  const legacyImageTransform = activeLayer && activeLayer.transform
    ? { ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat', ...activeLayer.transform }
    : (shape.imageTransform
      ? { ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat', ...shape.imageTransform }
      : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat' });
  legacyImageTransform.tileAnchor = (legacyImageTransform.tileAnchor === 'topleft' || legacyImageTransform.tileAnchor === 'top-left') ? 'topleft' : 'center';
  legacyImageTransform.tileRepeat = (legacyImageTransform.tileRepeat === 'mirror') ? 'mirror' : 'repeat';
  const defaultUv = opts.getDefaultUvModeForArchetypeId(shape.type) || 'sphere';
  return {
    id: shape.id,
    name: shape.name || shape.id,
    type: shape.type,
    visible: !!shape.visible,
    locked: !!shape.locked,
    params: shape.params ? { ...shape.params } : null,
    doodleMode: shape.doodleMode || null,
    doodlePoints: Array.isArray(shape.doodlePoints) ? shape.doodlePoints.map(p => ({ x: p.x, y: p.y })) : null,
    transform: {
      position: { x: t.position ? (t.position.x || 0) : 0, y: t.position ? (t.position.y || 0) : 0, z: t.position ? (t.position.z || 0) : 0 },
      rotation: { x: t.rotation ? (t.rotation.x || 0) : 0, y: t.rotation ? (t.rotation.y || 0) : 0, z: t.rotation ? (t.rotation.z || 0) : 0 },
      scale: { x: sx, y: sy, z: sz },
    },
    material: {
      baseColor: m.baseColor || '#ffffff',
      roughness: (typeof m.roughness === 'number') ? m.roughness : 0.6,
      metalness: (typeof m.metalness === 'number') ? m.metalness : 0.0,
      emissive: (typeof m.emissive === 'number') ? m.emissive : 0.0,
      emissiveColor: m.emissiveColor || '#e8c88e',
    },
    uvMode: shape.uvMode || defaultUv,
    customUv: (shape.customUv && shape.customUv.uv && Array.isArray(shape.customUv.uv)) ? { mode: shape.customUv.mode || (shape.uvMode || defaultUv), count: shape.customUv.count, uv: shape.customUv.uv.slice(0) } : null,
    selectedIslandId: shape.selectedIslandId || null,
    imageTransform: legacyImageTransform,
    layers: layers.map((l, i) => {
      const tr = (l && l.transform)
        ? { ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat', ...l.transform }
        : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat' };
      tr.tileAnchor = (tr.tileAnchor === 'topleft' || tr.tileAnchor === 'top-left') ? 'topleft' : 'center';
      tr.tileRepeat = (tr.tileRepeat === 'mirror') ? 'mirror' : 'repeat';
      return {
        id: l && l.id ? String(l.id) : ('layer_' + i),
        label: l && l.label ? String(l.label) : ('Layer ' + (i + 1)),
        imageDataUrl: (l && l.imageDataUrl) ? l.imageDataUrl : opts.imageBitmapToPngDataUrlForSave(l ? l.imageBitmap : null),
        transform: tr,
        visible: !(l && l.visible === false),
        clippingIslandId: (l && l.clippingIslandId) ? l.clippingIslandId : null,
        polygonMaskPoints: (l && Array.isArray(l.polygonMaskPoints)) ? l.polygonMaskPoints.map(p => ({ x: p.x, y: p.y })) : null,
        maskLinked: !(l && l.maskLinked === false),
        opacity: (l && typeof l.opacity === 'number') ? l.opacity : 1.0,
        blendMode: (l && l.blendMode) ? l.blendMode : 'source-over',
      };
    }),
    activeLayerIndex: activeIdx,
    shapeScale: shape.shapeScale ? { ...shape.shapeScale } : null,
    textureCompositeDataUrl: opts.canvasToPngDataUrl(shape._compositeCanvas),
    imageDataUrl: legacyImageDataUrl,
  };
}

function serializeShapeForUndo(shape, opts) {
  if (!shape) return null;
  const t = shape.transform || { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const m = shape.material || { roughness: 0.6, metalness: 0.0, emissive: 0.0, emissiveColor: '#e8c88e' };
  const ts = t && t.scale ? t.scale : null;
  const sx = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.x)) ? ts.x : 1);
  const sy = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.y)) ? ts.y : 1);
  const sz = (typeof ts === 'number') ? ts : ((ts && Number.isFinite(ts.z)) ? ts.z : 1);
  const runtimeLayers = Array.isArray(shape.layers) ? shape.layers : (shape.imageBitmap ? [{
    id: 'layer_legacy',
    label: 'Layer 1',
    imageBitmap: shape.imageBitmap,
    imageDataUrl: null,
    transform: shape.imageTransform ? { ratio: 1, tile: false, tileScale: 1, ...shape.imageTransform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
    visible: true,
    clippingIslandId: null,
    polygonMaskPoints: null,
    maskLinked: true,
    opacity: 1.0,
    blendMode: 'source-over',
  }] : []);
  const rawActive = Number.isFinite(shape.activeLayerIndex) ? shape.activeLayerIndex : 0;
  const activeIdx = runtimeLayers.length ? Math.max(0, Math.min(rawActive, runtimeLayers.length - 1)) : 0;
  const activeLayer = runtimeLayers.length ? (runtimeLayers[activeIdx] || null) : null;
  const legacyImageTransform = activeLayer && activeLayer.transform ? { ratio: 1, tile: false, tileScale: 1, ...activeLayer.transform } : (shape.imageTransform ? { ratio: 1, tile: false, tileScale: 1, ...shape.imageTransform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 });
  const imageRef = activeLayer ? opts.getUndoLayerImageRef(activeLayer) : opts.getUndoLayerImageRef({ imageBitmap: shape.imageBitmap, imageDataUrl: null });
  const compositeRef = opts.getUndoCompositeRef(shape, opts.getBaseLayerRevision());
  const defaultUv = opts.getDefaultUvModeForArchetypeId(shape.type) || 'sphere';
  return {
    id: shape.id,
    name: shape.name || shape.id,
    type: shape.type,
    visible: !!shape.visible,
    locked: !!shape.locked,
    params: shape.params ? { ...shape.params } : null,
    doodleMode: shape.doodleMode || null,
    doodlePoints: Array.isArray(shape.doodlePoints) ? shape.doodlePoints.map(p => ({ x: p.x, y: p.y })) : null,
    transform: {
      position: { x: t.position ? (t.position.x || 0) : 0, y: t.position ? (t.position.y || 0) : 0, z: t.position ? (t.position.z || 0) : 0 },
      rotation: { x: t.rotation ? (t.rotation.x || 0) : 0, y: t.rotation ? (t.rotation.y || 0) : 0, z: t.rotation ? (t.rotation.z || 0) : 0 },
      scale: { x: sx, y: sy, z: sz },
    },
    material: {
      baseColor: m.baseColor || '#ffffff',
      roughness: (typeof m.roughness === 'number') ? m.roughness : 0.6,
      metalness: (typeof m.metalness === 'number') ? m.metalness : 0.0,
      emissive: (typeof m.emissive === 'number') ? m.emissive : 0.0,
      emissiveColor: m.emissiveColor || '#e8c88e',
    },
    uvMode: shape.uvMode || defaultUv,
    customUv: (shape.customUv && shape.customUv.uv && Array.isArray(shape.customUv.uv)) ? { mode: shape.customUv.mode || (shape.uvMode || defaultUv), count: shape.customUv.count, uv: shape.customUv.uv.slice(0) } : null,
    selectedIslandId: shape.selectedIslandId || null,
    imageTransform: legacyImageTransform,
    layers: runtimeLayers.map((l, i) => ({
      id: l && l.id ? String(l.id) : ('layer_' + i),
      label: l && l.label ? String(l.label) : ('Layer ' + (i + 1)),
      imageRef: opts.getUndoLayerImageRef(l),
      transform: (l && l.transform) ? { ratio: 1, tile: false, tileScale: 1, ...l.transform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
      visible: !(l && l.visible === false),
      clippingIslandId: (l && l.clippingIslandId) ? l.clippingIslandId : null,
      polygonMaskPoints: (l && Array.isArray(l.polygonMaskPoints)) ? l.polygonMaskPoints.map(p => ({ x: p.x, y: p.y })) : null,
      maskLinked: !(l && l.maskLinked === false),
      opacity: (l && typeof l.opacity === 'number') ? l.opacity : 1.0,
      blendMode: (l && l.blendMode) ? l.blendMode : 'source-over',
    })),
    activeLayerIndex: activeIdx,
    shapeScale: shape.shapeScale ? { ...shape.shapeScale } : null,
    textureCompositeRef: compositeRef,
    imageRef: imageRef,
  };
}

function buildProjectSavePayload(opts) {
  const stateApi = resolveProjectStateApi(opts);
  try { if (opts && typeof opts.syncVisibleToSelectedPart === 'function') opts.syncVisibleToSelectedPart(); } catch (_) {}
  const shapes = stateApi.getShapeList();
  const project = stateApi.getProject();
  try { opts?.projectStore?.sync?.(project, 'persistence/save'); } catch (err) { console.error('[project-io] project-store sync before save failed', err); }
  return {
    format: 'xreate',
    // 2.2 distinguishes bilateral Mirror from the legacy lathed "mirror"
    // representation.  Older projects are migrated only while loading.
    version: '2.2.0',
    project: {
      id: (project && project.id) ? project.id : ('xreate_' + opts.uuid()),
      name: (project && project.name) ? project.name : 'Untitled',
      textureMode: (project && project.textureMode) ? project.textureMode : 'per-shape',
      selectedId: (project && project.selectedId) ? project.selectedId : null,
      shapes: shapes.map((s) => serializeShapeForSave(s, opts)).filter(Boolean),
    }
  };
}

function buildProjectUndoPayload(opts) {
  const stateApi = resolveProjectStateApi(opts);
  try { if (opts && typeof opts.syncVisibleToSelectedPart === 'function') opts.syncVisibleToSelectedPart(); } catch (_) {}
  const shapes = stateApi.getShapeList();
  const project = stateApi.getProject();
  return {
    format: 'xreate',
    version: '2.2.0',
    project: {
      id: (project && project.id) ? project.id : ('xreate_' + opts.uuid()),
      name: (project && project.name) ? project.name : 'Untitled',
      textureMode: (project && project.textureMode) ? project.textureMode : 'per-shape',
      selectedId: (project && project.selectedId) ? project.selectedId : null,
      shapes: shapes.map((s) => serializeShapeForUndo(s, opts)).filter(Boolean),
    }
  };
}

function safeCyclicStringify(value, space) {
  const seen = new WeakSet();
  const replacer = function (key, val) {
    if (val !== null && typeof val === 'object') {
      const t = Object.prototype.toString.call(val);
      if (t === '[object HTMLCanvasElement]' || t === '[object CanvasRenderingContext2D]' || t === '[object WebGLRenderingContext]' || t === '[object WebGL2RenderingContext]' || t === '[object ImageBitmap]' || t === '[object HTMLImageElement]' || t === '[object HTMLVideoElement]' || t === '[object AudioBuffer]' || t === '[object OffscreenCanvas]') {
        return null;
      }
      if (val instanceof WeakMap || val instanceof WeakSet || val instanceof Map || val instanceof Set) {
        return null;
      }
      if (seen.has(val)) return '[CircularRef]';
      seen.add(val);
      if (val instanceof Error) return { name: val.name, message: val.message };
      if (typeof val.then === 'function') return null;
      const ctor = val.constructor && val.constructor.name;
      if (ctor && (ctor === 'Mesh' || ctor === 'Object3D' || ctor === 'Scene' || ctor === 'Camera' || ctor === 'PerspectiveCamera' || ctor === 'OrthographicCamera' || ctor === 'Texture' || ctor === 'CanvasTexture' || ctor === 'Material' || ctor === 'ShaderMaterial' || ctor === 'MeshStandardMaterial' || ctor === 'MeshBasicMaterial' || ctor === 'BufferGeometry' || ctor === 'Geometry' || ctor === 'Raycaster' || ctor === 'Renderer' || ctor === 'WebGLRenderer' || ctor === 'Group')) {
        return null;
      }
    } else if (typeof val === 'function') {
      return undefined;
    }
    return val;
  };
  try {
    return JSON.stringify(value, replacer, space);
  } catch (_) {
    return JSON.stringify({ error: 'stringify_failed' });
  }
}

function saveProjectXreateJson(opts) {
  try {
    const payload = buildProjectSavePayload(opts);
    const name = opts.sanitizeFilenameBase(payload.project.name);
    let jsonText;
    try {
      jsonText = JSON.stringify(payload, null, 2);
    } catch (_) {
      jsonText = safeCyclicStringify(payload, 2);
    }
    const bytes = new TextEncoder().encode(jsonText);
    opts.download(bytes, name + '.xreate.json', 'application/json');
    opts.setStatusKey('status_project_saved', 'ok');
    setTimeout(() => opts.setStatus('', ''), 900);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const title = (opts && typeof opts.tr === 'function')
      ? opts.tr('modal_save_failed')
      : ((opts && typeof opts.getTr === 'function') ? opts.getTr()('modal_save_failed') : 'Save failed');
    try { if (opts && typeof opts.showModal === 'function') opts.showModal(title, msg); } catch (_) {}
    try { if (opts && typeof opts.setStatusKey === 'function') opts.setStatusKey('status_save_failed', ''); } catch (_) {}
  }
}

async function loadProjectFromPayload(payload, callOpts, opts) {
  const stateApi = resolveProjectStateApi(opts);
  if (!payload || payload.format !== 'xreate' || !payload.project) throw new Error('Invalid file format');
  const p = payload.project;
  if (!Array.isArray(p.shapes)) throw new Error('Invalid project data');
  const preserveHistory = !!(callOpts && callOpts.preserveHistory);
  const project = stateApi.getProject();
  const keepUndo = preserveHistory ? (project ? project._undoStack : null) : null;
  const keepRedo = preserveHistory ? (project ? project._redoStack : null) : null;
  const beforeSnap = (!preserveHistory && project && project.shapes && project.shapes.length) ? buildProjectUndoPayload(opts) : null;

  opts.clearAssembly();
  if (!project) throw new Error('Project not initialized');
  project.id = p.id || ('xreate_' + opts.uuid());
  project.name = String(p.name || '').trim() || 'Untitled';
  project.textureMode = (p.textureMode === 'shared') ? 'shared' : 'per-shape';
  if (stateApi.setSelectedId) stateApi.setSelectedId(null, { markModified: false });
  else project.selectedId = null;
  if (!preserveHistory) {
    if (!project._undoStack) project._undoStack = [];
    if (!project._redoStack) project._redoStack = [];
    project._undoStack.length = 0;
    if (beforeSnap) project._undoStack.push(beforeSnap);
    project._redoStack.length = 0;
  } else {
    if (keepUndo) project._undoStack = keepUndo;
    if (keepRedo) project._redoStack = keepRedo;
  }
  opts.resetProjectUndoArm();
  if (!project.meta) project.meta = { created: Date.now(), modified: Date.now(), version: '2.2.0' };
  project.meta.modified = Date.now();
  try { opts?.projectStore?.sync?.(project, 'persistence/load-reset'); } catch (err) { console.error('[project-io] project-store sync at load reset failed', err); }
  opts.updateProjectNameUi();

  const THREE = opts.THREE || globalThis.THREE;
  if (!THREE) throw new Error('THREE not available');
  const editorBg = opts.getEditorBg();
  const nextShapes = [];
  for (const s of p.shapes) {
    const pos = (s.transform && s.transform.position) ? s.transform.position : { x: 0, y: 0, z: 0 };
    const rot = (s.transform && s.transform.rotation) ? s.transform.rotation : { x: 0, y: 0, z: 0 };
    const sc = (s.transform && s.transform.scale) ? s.transform.scale : { x: 1, y: 1, z: 1 };
    const sx = Number.isFinite(sc.x) ? sc.x : 1;
    const sy = Number.isFinite(sc.y) ? sc.y : 1;
    const sz = Number.isFinite(sc.z) ? sc.z : 1;
    let part = null;
    if (s.type === 'doodle') {
      // Before 2.2, persisted "mirror" Doodles were lathed profiles. New
      // projects persist explicit `mirror` and `revolve` modes, so both remain
      // stable through save, duplicate and hydration.
      const sourceVersion = String(payload?.version || p?.meta?.version || '2.1.0');
      const explicitDoodleModes = /^2\.(?:[2-9]|\d{2,})\./.test(sourceVersion) || /^[3-9]\./.test(sourceVersion);
      const mode = s.doodleMode === 'revolve'
        ? 'revolve'
        : (s.doodleMode === 'mirror' ? (explicitDoodleModes ? 'mirror' : 'revolve') : 'polygon');
      const points = Array.isArray(s.doodlePoints) ? s.doodlePoints : [];
      part = createDoodlePart({
        points, mode, params: s.params || null, id: s.id || opts.newPartId(),
        name: s.name || s.id || 'Doodle', material: s.material || null,
        uvMode: s.uvMode || null, visible: s.visible !== false, locked: !!s.locked,
        position: new THREE.Vector3(pos.x || 0, pos.y || 0, pos.z || 0),
        rotation: new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0),
        scale: new THREE.Vector3(sx, sy, sz), THREE, assemblyRoot: opts.getAssemblyRoot(),
        createOffscreenCanvas: opts.createOffscreenCanvas, createMaterial: opts.createMaterial,
        editorBg, canvasSize: opts.CANVAS_SIZE,
        buildDoodleRevolveFromPoints: opts.buildDoodleRevolveFromPoints,
        buildDoodleMirrorFromPoints: opts.buildDoodleMirrorFromPoints,
        buildDoodleFromPoints: opts.buildDoodleFromPoints,
        applyUvModeToGeometry: opts.applyUvModeToGeometry,
      });
      if (!part) continue;
    } else {
      const arch = opts.getArchetypeById(s.type) || opts.getArchetypeById('cube');
      if (!arch) continue;
      part = opts.createPartFromArchetype(arch, {
        id: s.id,
        name: s.name,
        uvMode: s.uvMode,
        params: s.params || null,
        position: new THREE.Vector3(pos.x || 0, pos.y || 0, pos.z || 0),
        rotation: new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0),
        scale: new THREE.Vector3(sx, sy, sz),
      });
    }
    if (!part) continue;
    part.visible = (s.visible !== false);
    part.locked = !!s.locked;
    part.selectedIslandId = s.selectedIslandId || null;
    part.imageTransform = s.imageTransform ? { ratio: 1, tile: false, tileScale: 1, ...s.imageTransform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 };
    part.material = s.material ? { baseColor: '#ffffff', ...s.material } : part.material;
    part.shapeScale = s.shapeScale ? { ...s.shapeScale } : (part.shapeScale || null);
    if (part._mesh && part.shapeScale) {
      const f = part.shapeScale;
      part._mesh.scale.set(sx * (Number.isFinite(f.x) ? f.x : 1), sy * (Number.isFinite(f.y) ? f.y : 1), sz * (Number.isFinite(f.z) ? f.z : 1));
    }
    const defaultUvMode = part.uvMode || opts.getDefaultUvModeForArchetypeId(part.type) || 'sphere';
    part.customUv = (s.customUv && s.customUv.uv && Array.isArray(s.customUv.uv)) ? { mode: s.customUv.mode || defaultUvMode, count: s.customUv.count, uv: s.customUv.uv.slice(0) } : null;
    if (part._mesh) part._mesh.visible = !!part.visible;
    opts.applyMaterialStateToMesh(part);
    if (part.customUv && part.customUv.mode === defaultUvMode && part._mesh && part._mesh.geometry) {
      try { opts.applyCustomUvToGeometry(part._mesh.geometry, part.customUv); } catch (_) {}
    }

    const compUrl = s.textureCompositeDataUrl || await opts.resolveUndoAssetAsync(s.textureCompositeRef);
    const imgUrl = s.imageDataUrl || await opts.resolveUndoAssetAsync(s.imageRef);
    if (compUrl && part._compositeCtx) {
      try { await opts.drawDataUrlToCanvas(compUrl, part._compositeCtx); } catch (_) {}
      if (!part._texture) {
        part._texture = new THREE.CanvasTexture(part._compositeCanvas);
        opts.ensureSrgbTexture(part._texture);
      } else part._texture.needsUpdate = true;
      if (part._mesh && part._mesh.material) {
        part._mesh.material.map = part._texture;
        part._mesh.material.needsUpdate = true;
      }
    }
    part.layers = [];
    part.activeLayerIndex = Number.isFinite(s.activeLayerIndex) ? s.activeLayerIndex : 0;
    if (Array.isArray(s.layers) && s.layers.length) {
      for (const l of s.layers) {
        const url = (l && l.imageDataUrl) ? l.imageDataUrl : await opts.resolveUndoAssetAsync(l ? l.imageRef : null);
        let bmp = null;
        if (url) {
          try { bmp = await opts.loadImageFromDataUrl(url); } catch (_) { bmp = null; }
        }
        part.layers.push({
          id: (l && l.id) ? String(l.id) : opts.newLayerId(),
          label: (l && l.label) ? String(l.label) : ('Layer ' + (part.layers.length + 1)),
          imageBitmap: bmp,
          imageDataUrl: url || null,
          transform: (l && l.transform) ? { ratio: 1, tile: false, tileScale: 1, ...l.transform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
          visible: !(l && l.visible === false),
          clippingIslandId: (l && l.clippingIslandId) ? l.clippingIslandId : null,
          polygonMaskPoints: (l && Array.isArray(l.polygonMaskPoints)) ? l.polygonMaskPoints.map(pt => ({ x: pt.x, y: pt.y })) : null,
          maskLinked: !(l && l.maskLinked === false),
          opacity: (l && typeof l.opacity === 'number') ? l.opacity : 1.0,
          blendMode: (l && l.blendMode) ? l.blendMode : 'source-over',
        });
      }
      const al = part.layers.length ? Math.max(0, Math.min(part.activeLayerIndex, part.layers.length - 1)) : 0;
      part.activeLayerIndex = al;
      const active = part.layers.length ? (part.layers[al] || null) : null;
      part.imageBitmap = active ? (active.imageBitmap || null) : null;
      part.imageTransform = active && active.transform ? { ratio: 1, tile: false, tileScale: 1, ...active.transform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 };
    } else if (imgUrl) {
      try {
        const bmp = await opts.loadImageFromDataUrl(imgUrl);
        if (bmp) {
          part.layers.push({
            id: opts.newLayerId(),
            label: 'Layer 1',
            imageBitmap: bmp,
            imageDataUrl: imgUrl,
            transform: part.imageTransform ? { ratio: 1, tile: false, tileScale: 1, ...part.imageTransform } : { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
            visible: true,
            clippingIslandId: null,
            polygonMaskPoints: null,
            maskLinked: true,
            opacity: 1.0,
            blendMode: 'source-over',
          });
          part.activeLayerIndex = 0;
          part.imageBitmap = bmp;
        }
      } catch (_) {}
    }
    nextShapes.push(part);
  }

  if (stateApi.setShapeList) stateApi.setShapeList(nextShapes, { markModified: false });
  else project.shapes = nextShapes;
  if (project.textureMode === 'shared') {
    const src = nextShapes.find(s => s && s._compositeCanvas) || null;
    if (src && src._compositeCanvas) {
      if (project._sharedTexture && project._sharedTexture.dispose) project._sharedTexture.dispose();
      project._sharedTexture = new THREE.CanvasTexture(src._compositeCanvas);
      opts.ensureSrgbTexture(project._sharedTexture);
      for (const sh of nextShapes) {
        if (sh && sh._mesh && sh._mesh.material) {
          sh._mesh.material.map = project._sharedTexture;
          sh._mesh.material.needsUpdate = true;
        }
      }
    }
  }
  const sel = p.selectedId && nextShapes.find(x => x && x.id === p.selectedId) ? p.selectedId : (nextShapes[0] ? nextShapes[0].id : null);
  if (sel) opts.setSelectedPart(sel, { silent: true, skipApplyTexture: true });
  else opts.setSelectedPart(null, { silent: true, skipApplyTexture: true });
  // Loading uses a silent selection to avoid intermediate redraws while assets
  // hydrate. Repaint the final surface and its UV guide once that selection is ready.
  try { opts.drawBaseLayer?.(); } catch (_) {}
  try { opts.renderUvOverlay?.(); } catch (_) {}
  try { opts.requestApplyTexture?.(true); } catch (_) {}
  try { opts?.projectStore?.sync?.(project, 'persistence/load-complete'); } catch (err) { console.error('[project-io] project-store sync after load failed', err); }
  opts.updateShapeTransformControlsFromSelected();
  opts.renderShapeParamsUI();
  opts.setStatusKey('status_project_loaded', 'ok');
  setTimeout(() => opts.setStatus('', ''), 900);
  opts.gcUndoAssets();
  if (p && p.id === 'xreate_uv_checker_all_shapes') {
    opts.applyUvCheckerToAllShapes().catch(e => console.error(e));
  }
  try { opts?.autosaveManager?.onProjectLoaded?.(); } catch (_) {}
}

export function create(opts) {
  const cfg = opts || {};
  const api = {
    buildProjectSavePayload: () => buildProjectSavePayload(cfg),
    buildProjectUndoPayload: () => buildProjectUndoPayload(cfg),
    saveProjectXreateJson: () => saveProjectXreateJson(cfg),
    loadProjectFromPayload: (payload, callOpts) => loadProjectFromPayload(payload, callOpts, cfg),
  };
  return api;
}

export const ProjectIO = { create };
