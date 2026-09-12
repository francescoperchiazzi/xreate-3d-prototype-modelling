// Transitional adapter: this module exports the legacy factory but never
// publishes itself. `engine/main.js` owns the sole compatibility write.
export function createLegacyEditor(compatibility) {
  const XR = compatibility;
  if (!XR) throw new Error('[bootstrap] XR compatibility namespace unavailable');
  // ── EDITOR ENGINE (XR.Editor.create) ───────────────────────────────────────
  // This IIFE contains the full editor runtime and is the core of XReate:
  // - 3D scene setup (Three.js renderer, camera, lights, grid)
  // - Shape/mesh archetype definitions and builders
  // - Texture pipeline (image import, layers, transforms, polygon masks)
  // - UV mapping modes and visualization
  // - Transform gizmo (move, rotate, scale)
  // - Export pipeline (GLB + USDZ + ZIP utilities)
  // - Undo/redo and project state management
  // - I18n (31+ languages) support
  // The editor is exposed via a small API object returned at the end (resume/pause/refreshI18n).

  const lifecycle = XR.state?.lifecycle || XR.__state?.lifecycle;
  if (!lifecycle) throw new Error('[bootstrap] lifecycle state unavailable after engine bootstrap');

  let rafId = (typeof lifecycle.rafId === 'number' || lifecycle.rafId === null) ? lifecycle.rafId : null;
  let paused = (typeof lifecycle.paused === 'boolean') ? lifecycle.paused : true;
  let initialized = (typeof lifecycle.initialized === 'boolean') ? lifecycle.initialized : false;
  let initErrorShown = (typeof lifecycle.initErrorShown === 'boolean') ? lifecycle.initErrorShown : false;
  let bootLogged = (typeof lifecycle.bootLogged === 'boolean') ? lifecycle.bootLogged : false;
  let restrictedOriginNoteShown = false;
  let onResize = null;
  let resize3d = null;
  let resumeQueued = false;
  let resumeRetryCount = 0;
  let onPaste = null;
  let onEditorKeyDown = null;
  let resumeRafId = 0;
  let resumeRafFrames = 0;
  let resumeRetryTimer = 0;
  let resumeDomObserver = null;
  let threeWrap = document.getElementById('threeWrap') || Object.assign(document.createElement('div'), { id: 'threeWrap' });
  let threeCanvas = document.getElementById('threeCanvas') || Object.assign(document.createElement('canvas'), { id: 'threeCanvas' });
  let baseCanvas = document.getElementById('imageCanvas') || Object.assign(document.createElement('canvas'), { id: 'imageCanvas' });
  let uvCanvas = document.getElementById('uvOverlay') || Object.assign(document.createElement('canvas'), { id: 'uvOverlay' });
  const devWarn = XR.devWarn;
  const statusState = { stickyUntil: 0, timer: null };
  const legacyImageToolAliases = {};
  let legacyExportConfigs = null;
  function tr(key) {
    try {
      const f = XR && XR.i18n && typeof XR.i18n.t === 'function' ? XR.i18n.t : null;
      return f ? f(key) : String(key);
    } catch (_) {
      return String(key);
    }
  }
  function setStatus(msg, type) {
    const el = document.getElementById('statusText');
    if (!el) return;
    try { if (!el.dataset.defaultText) el.dataset.defaultText = el.textContent || 'Ready'; } catch (_) {}
    const state = statusState;
    const nextMsg = String(msg || '').trim();
    const t = String(type || '').trim();
    if (!nextMsg && !t && state.stickyUntil && Date.now() < state.stickyUntil) return;
    el.textContent = nextMsg || (el.dataset && el.dataset.defaultText ? el.dataset.defaultText : 'Ready');
    try {
      const urgent = (t === 'bad' || t === 'danger' || t === 'error');
      el.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
    } catch (_) {}
    const extra = [];
    try {
      for (const c of Array.from(el.classList || [])) {
        if (!c || c === 'xr-status') continue;
        if (c.startsWith('is-')) continue;
        extra.push(c);
      }
    } catch (_) {}
    el.className = ['xr-status', ...extra, ...(t ? ['is-' + t] : [])].join(' ');
    if (t === 'ok' && nextMsg) {
      state.stickyUntil = Date.now() + 3500;
      if (state.timer) { try { clearTimeout(state.timer); } catch (_) {} }
      state.timer = setTimeout(() => { try { setStatus('', ''); } catch (_) {} }, 3500);
    } else if (t && t !== 'ok') {
      state.stickyUntil = 0;
      if (state.timer) { try { clearTimeout(state.timer); } catch (_) {} }
      state.timer = null;
    }
  }
  function setStatusKey(key, type) {
    const msg = tr(key);
    const t = String(type || '').trim();
    try {
      setStatus(msg, t);
    } catch (_) {}
  }
  function sanitizeFilenameBase(name) {
    const s = String(name || '').trim() || 'Untitled';
    return s
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/[\/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64) || 'Untitled';
  }
  function _inlineDownloadRealImpl(buffer, filename, mimeType) {
    try {
      const singleton = (typeof XR?.__modules?.download === 'function') ? XR.__modules.download : null;
      if (singleton) { try { return singleton(buffer, filename, mimeType); } catch (_) {} }
      if (typeof document === 'undefined') return;
      const blob = (buffer instanceof Blob) ? buffer : new Blob([buffer], { type: (mimeType || 'application/octet-stream') });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = String(filename || 'download'); a.rel = 'noopener';
      document.body && document.body.appendChild(a);
      const evt = document.createEvent('MouseEvents');
      evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      a.dispatchEvent(evt);
      setTimeout(() => { try { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); } catch (_) {} }, 1500);
    } catch (_) {}
  }
  function _inlineShowToastRealImpl(msg, type, msOrOpts) {
    try {
      const singleton = (typeof XR?.__modules?.showToast === 'function') ? XR.__modules.showToast : null;
      if (singleton) { try { return singleton(msg, type, msOrOpts); } catch (_) { return; } }
    } catch (_) {}
  }
  const download = _inlineDownloadRealImpl;
  const showToast = _inlineShowToastRealImpl;
  // ensureInit() is a lazy initializer. XR.Editor.create() can be called early, and the
  // editor "wakes up" once the DOM is present. This keeps XReate static and view-source-friendly.
  function ensureInit(opts){
    const mod = XR?.EditorInit || XR?.__modules?.EditorInit || null;
    if (!mod || typeof mod.preflight !== 'function') return;
    const refs = {
      initialized,
      initErrorShown,
      bootLogged,
      restrictedOriginNoteShown,
      resumeDomObserver,
      resumeRafId,
      resumeRafFrames,
      threeWrap,
      threeCanvas,
      baseCanvas,
      uvCanvas,
    };
    try {
      const ok = mod.preflight({
        opts,
        refs,
        setStatusKey,
        isRestrictedOrigin: () => !!XR?.Storage?.isRestricted?.(),
      });
      initialized = refs.initialized;
      initErrorShown = refs.initErrorShown;
      bootLogged = refs.bootLogged;
      restrictedOriginNoteShown = refs.restrictedOriginNoteShown;
      resumeDomObserver = refs.resumeDomObserver;
      resumeRafId = refs.resumeRafId;
      resumeRafFrames = refs.resumeRafFrames;
      threeWrap = refs.threeWrap;
      threeCanvas = refs.threeCanvas;
      baseCanvas = refs.baseCanvas;
      uvCanvas = refs.uvCanvas;
      if (!ok) { return; }
    } catch (e) { return; }
  }
  // try { window.__afterEnsureInit = true; console.log('[XR] after ensureInit def'); } catch (_) {}



const ARCHETYPES = XR?.Archetypes || XR?.__modules?.Archetypes || {};

// ── ICON CANVAS RENDERING ────────────────────────────────────────────────────
// These icons are rendered into <canvas> elements for the "Add Volume" menu.
// They intentionally avoid emoji / icon fonts so the UI is consistent across platforms.
function drawIcon(ctx, name, size, opts) {
  const stable = XR?.Icons?.drawIcon || XR?.__modules?.Icons?.drawIcon || null;
  if (stable && stable !== drawIcon) {
    try { return stable(ctx, name, size, opts); } catch (_) {}
  }
  return;
}

// ── EDITOR GLOBAL STATE ──────────────────────────────────────────────────────
// The editor engine keeps most runtime state in function-scoped variables
// These are intentionally not on `window` to reduce accidental coupling.
// - project: Main state container for shapes, layers, undo/redo
// - selectPartMode/selectionHelper: Selection handling
// - uvMode/wireframeOn/flatLightingOn: View options
// - baseLayerRevision: Tracks texture changes
// - *ModalState: Tracks open modals

let currentArchetype = null;
let addShapeMenuApi = null;
let projectIoApi = null;
let shellScenePanelsConfig = null;
let shellInspectorPanelsConfig = null;
let shellShapeParamsConfig = null;
let shellSurfaceEditorConfig = null;
let shellMaskEditorConfig = null;
let shellProjectUiConfig = null;
let shellUvUiConfig = null;
let shellViewportControlsConfig = null;
let projectIoConfig = null;
let projectControllerConfig = null;
let projectControllerApi = null;
const runtimeState = XR.state?.runtime || XR.__state?.runtime;
if (!runtimeState) throw new Error('[bootstrap] runtime state unavailable after engine bootstrap');
function getCurrentMesh() { return runtimeState.currentMesh || null; }
function setCurrentMesh(mesh) { runtimeState.currentMesh = mesh || null; return runtimeState.currentMesh; }
function getDrawingTexture() { return runtimeState.drawingTexture || null; }
function setDrawingTexture(texture) { runtimeState.drawingTexture = texture || null; return runtimeState.drawingTexture; }
function getWireframeOn() { return !!runtimeState.wireframeOn; }
function setWireframeOn(value) { runtimeState.wireframeOn = !!value; return runtimeState.wireframeOn; }
function getFlatLightingOn() { return !!runtimeState.flatLightingOn; }
function setFlatLightingOn(value) { runtimeState.flatLightingOn = !!value; return runtimeState.flatLightingOn; }
function getUvMode() {
  return XR?.ProjectStore?.getSelectionState?.()?.uvMode || getSelectedPart()?.uvMode || 'sphere';
}
function setCanonicalUvMode(uvMode) {
  // Deselecting from the canvas writes temporary refs back through this
  // bridge. UV belongs to a part, so there is no command to dispatch without
  // one; treating that transition as a no-op keeps deselection console-clean.
  if (!getSelectedPart()) return null;
  const dispatch = XR?.ProjectStore?.dispatch;
  if (typeof dispatch !== 'function') throw new Error('[project-store] UV mode dispatch unavailable after engine bootstrap');
  return dispatch({ type: 'selection/uv-mode-set', uvMode, project });
}
function getSelectedIslandId() {
  return XR?.ProjectStore?.getSelectionState?.()?.selectedIslandId || getSelectedPart()?.selectedIslandId || null;
}
function setCanonicalSelectedIslandId(selectedIslandId) {
  // See setCanonicalUvMode: an island is scoped to the selected part.
  if (!getSelectedPart()) return null;
  const dispatch = XR?.ProjectStore?.dispatch;
  if (typeof dispatch !== 'function') throw new Error('[project-store] UV island dispatch unavailable after engine bootstrap');
  return dispatch({ type: 'selection/island-set', selectedIslandId, project });
}
function getProject() {
  const stable = XR?.ProjectState?.getProject || null;
  if (!stable) throw new Error('[project-state] getProject unavailable after engine bootstrap');
  return stable();
}
// Compatibility reference only: the object is allocated and owned by
// ProjectState before this deferred bridge is evaluated.
const project = getProject();
function updateProjectNameUi() {
  return resolveProjectControllerApi()?.updateProjectNameUi?.();
}
function resolveUndoAsset(ref) {
  const resolver = XR?.UndoAssets || XR?.__modules?.UndoAssets || null;
  if (typeof resolver?.resolveUndoAsset !== 'function') {
    console.error('[undo-assets] resolver unavailable after engine bootstrap');
    return null;
  }
  return resolver.resolveUndoAsset(project, ref);
}
async function resolveUndoAssetAsync(ref) {
  const resolver = XR?.UndoAssets || XR?.__modules?.UndoAssets || null;
  if (typeof resolver?.resolveUndoAssetAsync !== 'function') {
    console.error('[undo-assets] async resolver unavailable after engine bootstrap');
    return null;
  }
  return await resolver.resolveUndoAssetAsync(project, ref);
}
const gcUndoAssets = () => {
  try {
    const owner = ensureUndoAssetStores();
    const used = new Set();
    const collect = (snapshot) => {
      const shapes = snapshot?.project?.shapes;
      if (!Array.isArray(shapes)) return;
      for (const shape of shapes) {
        if (shape?.imageRef) used.add(shape.imageRef);
        if (shape?.textureCompositeRef) used.add(shape.textureCompositeRef);
        for (const layer of (Array.isArray(shape?.layers) ? shape.layers : [])) {
          if (layer?.imageRef) used.add(layer.imageRef);
        }
      }
    };
    for (const snapshot of (Array.isArray(owner._undoStack) ? owner._undoStack : [])) collect(snapshot);
    for (const snapshot of (Array.isArray(owner._redoStack) ? owner._redoStack : [])) collect(snapshot);
    for (const ref of owner._undoAssets.keys()) if (!used.has(ref)) owner._undoAssets.delete(ref);
    for (const ref of owner._undoAssetsPending.keys()) if (!used.has(ref)) owner._undoAssetsPending.delete(ref);
  } catch (_) {}
};
// #region migration-residue-bridges: free-variable fixes (composition-root call-time bridges)
const showModal = (title, msg) => {
  try {
    const f = XR?.showModal || XR?.__modules?.ShellExportModal?.showModal || null;
    if (typeof f === 'function') f(title, msg);
  } catch (_) {}
}
const exportTextureAtlas = (...args) => {
  try {
    const f = XR?.__modules?.exportTextureAtlas || XR?.Export?.atlas || null;
    if (typeof f === 'function') return f.apply(window, args);
  } catch (_) {}
  return null;
};
const openDoodleModal = (...args) => {
  try {
    const mod = XR?.__modules?.ShellDoodleModal || null;
    const inst = (mod && typeof mod._instance !== 'undefined') ? mod._instance : null;
    const directCreate = (XR?.__bodyBootstrap?.shellDoodleModalApi) || null;
    const f = (inst && typeof inst.openDoodleModal === 'function') ? inst.openDoodleModal : (directCreate && typeof directCreate.openDoodleModal === 'function' ? directCreate.openDoodleModal : null);
    const ctx = (inst && typeof inst.openDoodleModal === 'function') ? inst : directCreate || null;
    if (typeof f === 'function') {
      XR?.DebugLog?.event?.('doodle.open.request', { owner: inst ? 'module-instance' : 'bootstrap-api' });
      return f.apply(ctx, args);
    }
    console.error('[doodle] modal owner unavailable', { hasModule: !!mod, hasInstance: !!inst, hasBootstrapApi: !!directCreate });
    XR?.DebugLog?.event?.('doodle.open.unavailable', { hasModule: !!mod, hasInstance: !!inst, hasBootstrapApi: !!directCreate });
  } catch (err) {
    console.error('[doodle] opening modal failed', err);
    XR?.DebugLog?.event?.('doodle.open.failure', { error: String(err?.message || err) });
  }
  return null;
};
// Undo snapshots intentionally keep bulky image data outside the serialized
// project payload.  The previous compatibility stubs returned the data (or
// worse, the lazy producer function) directly, so a restored snapshot could
// no longer resolve a newly imported texture.  Keep a small, runtime-only
// asset registry on the canonical project instead.
let undoAssetSequence = 0;
const ensureUndoAssetStores = () => {
  if (!project._undoAssets || typeof project._undoAssets.get !== 'function') project._undoAssets = new Map();
  if (!project._undoAssetsPending || typeof project._undoAssetsPending.get !== 'function') project._undoAssetsPending = new Map();
  return project;
};
const nextUndoAssetRef = () => `undo_asset_${Date.now().toString(36)}_${(++undoAssetSequence).toString(36)}`;
const internUndoAsset = (asset) => {
  if (typeof asset !== 'string' || !asset) return null;
  const owner = ensureUndoAssetStores();
  const ref = nextUndoAssetRef();
  owner._undoAssets.set(ref, asset);
  return ref;
};
const internUndoAssetAsync = (producer) => {
  const owner = ensureUndoAssetStores();
  const ref = nextUndoAssetRef();
  const pending = Promise.resolve()
    .then(() => (typeof producer === 'function' ? producer() : producer))
    .then((asset) => {
      if (typeof asset === 'string' && asset) owner._undoAssets.set(ref, asset);
      return (typeof asset === 'string' && asset) ? asset : null;
    })
    .catch(() => null)
    .finally(() => { try { owner._undoAssetsPending.delete(ref); } catch (_) {} });
  owner._undoAssetsPending.set(ref, pending);
  return ref;
};
let textureApplyRaf = 0;
let textureApplySilent = false;
let inspectorScrollRaf = 0;
// #endregion
let selectPartMode = false;
let selectionHelper = null;
let baseLayerRevision = 0;

const BG_COLORS = [
  '#0a0908','#1a1a2e','#0d1f0d','#1a0a0a','#2a2720','#e8e2d6'
];

function newLayerId() {
  const stable = XR?.ProjectState?.createLayerId || null;
  if (stable) return stable();
  throw new Error('[project-state] createLayerId unavailable after engine bootstrap');
}

function newPartId() {
  const stable = XR?.Identifiers?.createShapeId || null;
  if (stable) return stable();
  throw new Error('[identifiers] createShapeId unavailable after engine bootstrap');
}

function resolveProjectIoApi() {
  if (!projectIoApi) {
    const mod = XR?.ProjectIO || XR?.__modules?.ProjectIO || null;
    if (mod && typeof mod.create === 'function' && projectIoConfig) {
      try { projectIoApi = mod.create(projectIoConfig); } catch (_) {}
    }
  }
  return projectIoApi;
}

function resolveProjectControllerApi() {
  if (!projectControllerApi) {
    const mod = XR?.ProjectController || XR?.__modules?.ProjectController || null;
    if (mod?.create && projectControllerConfig) {
      try { projectControllerApi = mod.create(projectControllerConfig); } catch (err) { console.error('[project-controller] create failed', err); }
    }
  }
  return projectControllerApi;
}

const shellResolverFactory = XR?.ShellResolvers?.create || XR?.__modules?.ShellResolvers?.create || null;
if (typeof shellResolverFactory !== 'function') {
  throw new Error('ShellResolvers unavailable after engine bootstrap');
}
const {
  resolveShellScenePanelsApi,
  resolveShellInspectorPanelsApi,
  resolveShellShapeParamsApi,
  resolveShellSurfaceEditorApi,
  resolveShellMaskEditorApi,
  resolveShellProjectUiApi,
  resolveShellUvUiApi,
  resolveShellViewportControlsApi,
} = shellResolverFactory(XR, {
  get scenePanels() { return shellScenePanelsConfig; },
  get inspectorPanels() { return shellInspectorPanelsConfig; },
  get shapeParams() { return shellShapeParamsConfig; },
  get surfaceEditor() { return shellSurfaceEditorConfig; },
  get maskEditor() { return shellMaskEditorConfig; },
  get projectUi() { return shellProjectUiConfig; },
  get uvUi() { return shellUvUiConfig; },
  get viewportControls() { return shellViewportControlsConfig; },
});

function callShellMaskEditor(method, ...args) {
  const api = resolveShellMaskEditorApi();
  if (api && typeof api[method] === 'function') {
    try { return api[method](...args); } catch (_) {}
  }
  scheduleDeferredShellCall(`shell-mask-editor:${method}`, () => {
    const nextApi = resolveShellMaskEditorApi();
    if (nextApi && typeof nextApi[method] === 'function') {
      try { nextApi[method](...args); } catch (_) {}
      return true;
    }
    return false;
  }, { delayMs: 25, maxAttempts: 20 });
  return undefined;
}

const shellDeferredCalls = Object.create(null);
const shellDeferredTimers = Object.create(null);

function scheduleDeferredShellCall(key, cb, opts) {
  if (!key || typeof cb !== 'function') return;
  shellDeferredCalls[key] = cb;
  if (shellDeferredTimers[key]) return;
  const delayMs = Math.max(0, (opts && Number.isFinite(opts.delayMs)) ? opts.delayMs : 0);
  const maxAttempts = Math.max(1, (opts && Number.isFinite(opts.maxAttempts)) ? opts.maxAttempts : 1);
  const attempt = Math.max(1, (opts && Number.isFinite(opts.attempt)) ? opts.attempt : 1);
  shellDeferredTimers[key] = setTimeout(() => {
    const fn = shellDeferredCalls[key];
    delete shellDeferredCalls[key];
    delete shellDeferredTimers[key];
    let done = true;
    try {
      if (fn) done = fn() !== false;
    } catch (_) {}
    if (!done && attempt < maxAttempts) {
      scheduleDeferredShellCall(key, cb, { delayMs, maxAttempts, attempt: attempt + 1 });
    }
  }, delayMs);
}

// ── SCENE SETUP ──────────────────────────────────────────────
let renderer, scene, assemblyRoot, perspCamera, orthoCamera, orthoZoom, camera, viewportView, viewportProjection, orbitTarget;
let ambientLight, keyLight, fillLight, rimLight, VIEWPORT_LIGHT_BASE;
let sceneRuntimeOwner = null;
{
  const sceneRuntimeModule = XR?.SceneRuntime || XR?.__modules?.SceneRuntime || null;
  const sceneSetupModule = XR?.__modules?.SceneSetup || null;
  const sceneCore = (sceneRuntimeModule && typeof sceneRuntimeModule.create === 'function')
    ? sceneRuntimeModule.create({
        THREE,
        threeCanvas,
        devicePixelRatio: window.devicePixelRatio,
      })
    : (sceneSetupModule && typeof sceneSetupModule.createSceneCore === 'function')
      ? sceneSetupModule.createSceneCore({
          THREE,
          threeCanvas,
          devicePixelRatio: window.devicePixelRatio,
        })
    : null;

  if (sceneCore) {
    ({
      renderer,
      scene,
      assemblyRoot,
      perspCamera,
      orthoCamera,
      orthoZoom,
      camera,
      viewportView,
      viewportProjection,
      orbitTarget,
      ambientLight,
      keyLight,
      fillLight,
      rimLight,
      VIEWPORT_LIGHT_BASE,
    } = sceneCore);
    sceneRuntimeOwner = sceneCore.sceneRuntime || null;
  }

}

// Spatial composition is not only geometric.
// It also inherits principles from scenography, cinema, and the discipline of bodies in space.
function updateViewportViewButtons() {
  const ids = ['free', 'front', 'top', 'iso'];
  for (const id of ids) {
    const el = document.getElementById('btn-view-' + id);
    const on = viewportView === id;
    if (el) el.classList.toggle('is-active', on);
    if (el) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}
function setActiveCamera(kind) {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.setActiveCamera !== 'function') return;
  try {
    const refs = { perspCamera, orthoCamera, camera, viewportProjection };
    mod.setActiveCamera({ kind, refs });
    camera = refs.camera;
    viewportProjection = refs.viewportProjection;
  } catch (_) {}
}
function setViewportView(nextView) {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.setViewportView !== 'function') return;
  try {
    viewportView = nextView;
    const refs = { viewportView, spherical, orthoZoom, orthoCamera };
    mod.setViewportView({
      nextView,
      refs,
      setActiveCamera,
      updateViewportViewButtons,
      persistViewportSettings,
      sphericalToXYZ,
    });
    viewportView = refs.viewportView || nextView;
    orthoZoom = refs.orthoZoom;
  } catch (_) {}
}
function clampSnap(v, min, max, step) {
  const x = Math.max(min, Math.min(max, v));
  if (step && step > 0) return Math.round(x / step) * step;
  return x;
}
function readViewportSettings() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.readViewportSettings !== 'function') return null;
  try { return mod.readViewportSettings({ Storage: XR.Storage, devWarn }); } catch (_) { return null; }
}
function persistViewportSettings() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.persistViewportSettings !== 'function') return;
  try {
    return mod.persistViewportSettings({
      refs: { viewportView, orthoZoom, spherical, flatLightingOn: getFlatLightingOn(), orbitTarget },
      Storage: XR.Storage,
      devWarn,
    });
  } catch (_) {}
}
function fitViewportView() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.fitViewportView !== 'function') return;
  try {
    const refs = { orbitTarget, camera, orthoCamera, viewportView, orthoZoom, perspCamera, spherical };
    mod.fitViewportView({
      refs,
      THREE,
      getShapeList,
      clampSnap,
      sphericalToXYZ,
      persistViewportSettings,
    });
    orthoZoom = refs.orthoZoom;
  } catch (_) {}
}
function axisDragPlaneNormal(axisDir) {
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const n = new THREE.Vector3().crossVectors(axisDir, camDir).cross(axisDir);
  if (n.lengthSq() < 1e-8) {
    const up = new THREE.Vector3(0, 1, 0);
    n.copy(new THREE.Vector3().crossVectors(axisDir, up));
    if (n.lengthSq() < 1e-8) n.copy(new THREE.Vector3().crossVectors(axisDir, new THREE.Vector3(1, 0, 0)));
  }
  return n.normalize();
}
function rotateVectorFromRay(raycaster, axisDir, pivot) {
  const mod = XR?.__modules?.Raycasting || null;
  if (!mod || typeof mod.rotateVectorFromRay !== 'function') return null;
  try { return mod.rotateVectorFromRay({ raycaster, axisDir, pivot, camera, THREE }); } catch (_) { return null; }
}

const sceneSetupGridConfig = (() => {
  const mod = XR?.__modules?.SceneSetup || null;
  if (mod && typeof mod.getGridConfig === 'function') {
    try { return mod.getGridConfig() || null; } catch (_) {}
  }
  return null;
})();
const GRID_SIZE = (sceneSetupGridConfig && typeof sceneSetupGridConfig.size === 'number') ? sceneSetupGridConfig.size : 6;
const GRID_DIVISIONS = (sceneSetupGridConfig && typeof sceneSetupGridConfig.divisions === 'number') ? sceneSetupGridConfig.divisions : 20;
const GRID_UNITS = (sceneSetupGridConfig && typeof sceneSetupGridConfig.units === 'string') ? sceneSetupGridConfig.units : 'm';
let gridHelper = null;
let gridLabelGroup = null;

function disposeGridLabelGroup() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.disposeGridLabelGroup !== 'function') return;
  try { mod.disposeGridLabelGroup({ refs: { gridLabelGroup } }); } catch (_) {}
}

function makeGridTextSprite(text) {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.makeGridTextSprite !== 'function') return null;
  try { return mod.makeGridTextSprite({ text, THREE, ensureSrgbTexture }); } catch (_) { return null; }
}

function rebuildGridLabels() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.rebuildGridLabels !== 'function') return;
  try {
    mod.rebuildGridLabels({
      THREE,
      ensureSrgbTexture,
      refs: { gridHelper, gridLabelGroup },
    });
  } catch (_) {}
}

(function SCENE_SETUP() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.createViewportGrid !== 'function') return;
  try {
    const created = mod.createViewportGrid({
      THREE,
      scene,
      ensureSrgbTexture,
    });
    gridHelper = created?.gridHelper || null;
    gridLabelGroup = created?.gridLabelGroup || null;
  } catch (_) {}
})();

function updateViewportScaleLabel() {
  const mod = XR?.__modules?.ViewportRuntime || null;
  if (!mod || typeof mod.updateViewportScaleLabel !== 'function') return;
  try { mod.updateViewportScaleLabel({ document, gridSize: GRID_SIZE, gridDivisions: GRID_DIVISIONS, gridUnits: GRID_UNITS }); } catch (_) {}
}

updateViewportScaleLabel();

function setViewportTransformReadout(text, e) {
  const mod = XR?.__modules?.ViewportRuntime || null;
  if (!mod || typeof mod.setViewportTransformReadout !== 'function') return;
  try { mod.setViewportTransformReadout({ document, threeCanvas, text, event: e }); } catch (_) {}
}

let spherical = { theta: 0.4, phi: 1.1, radius: 3.5 };
const viewportInteractionRefs = {
  isDragging: false,
  prevMouse: { x: 0, y: 0 },
  orbitMoved: false,
  pendingPickPartId: null,
  gizmoRoot: null,
  gizmoMode: 'move',
  gizmoDragging: false,
  gizmoActiveMode: null,
  gizmoActiveAxis: null,
  gizmoStartPos: null,
  gizmoStartHit: null,
  gizmoStartRot: null,
  gizmoStartScale: null,
  gizmoStartVec: null,
};
let gizmoPlane = new THREE.Plane();
let gizmoVisuals = { move: null, rotate: null, scale: null };
let gizmoColliders = { move: { x: null, y: null, z: null }, rotate: { x: null, y: null, z: null }, scale: { x: null, y: null, z: null } };
const raycaster = new THREE.Raycaster();
let viewportWasdLastT = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') ? performance.now() : Date.now();
const viewportRuntimeState = { viewportWasdLastT };
const viewportWasdKeys = new Set();

function getViewportRuntimeRefs() {
  return Object.assign(viewportInteractionRefs, {
    renderer,
    scene,
    assemblyRoot,
    perspCamera,
    orthoCamera,
    orthoZoom,
    camera,
    viewportView,
    viewportProjection,
    orbitTarget,
    spherical,
    flatLightingOn: getFlatLightingOn(),
    currentMesh: getCurrentMesh(),
  });
}

function applyViewportRuntimeRefs(refs) {
  if (!refs || typeof refs !== 'object') return;
  if ('renderer' in refs) renderer = refs.renderer;
  if ('scene' in refs) scene = refs.scene;
  if ('assemblyRoot' in refs) assemblyRoot = refs.assemblyRoot;
  if ('perspCamera' in refs) perspCamera = refs.perspCamera;
  if ('orthoCamera' in refs) orthoCamera = refs.orthoCamera;
  if ('orthoZoom' in refs) orthoZoom = refs.orthoZoom;
  if ('camera' in refs) camera = refs.camera;
  if ('viewportView' in refs) viewportView = refs.viewportView;
  if ('viewportProjection' in refs) viewportProjection = refs.viewportProjection;
  if ('orbitTarget' in refs) orbitTarget = refs.orbitTarget;
  if ('spherical' in refs) spherical = refs.spherical;
  if ('flatLightingOn' in refs) setFlatLightingOn(refs.flatLightingOn);
  if ('currentMesh' in refs) setCurrentMesh(refs.currentMesh);
}

function isViewportWasdContextActive() {
  const mod = XR?.__modules?.ViewportRuntime || null;
  if (!mod || typeof mod.isViewportWasdContextActive !== 'function') return false;
  try { return !!mod.isViewportWasdContextActive({ document, threeCanvas }); } catch (_) { return false; }
}

function updateViewportWasd(dt) {
  const mod = XR?.__modules?.ViewportRuntime || null;
  if (!mod || typeof mod.updateViewportWasd !== 'function') return;
  try {
    mod.updateViewportWasd({
      dt,
      refs: getViewportRuntimeRefs(),
      viewportWasdKeys,
      threeCanvas,
      THREE,
      document,
      sphericalToXYZ,
    });
  } catch (_) {}
}
function hitTestPartIdFromPointer(e) {
  const mod = XR?.__modules?.Raycasting || null;
  if (!mod || typeof mod.hitTestPartIdFromPointer !== 'function') return null;
  try { return mod.hitTestPartIdFromPointer({ event: e, getShapeList, threeCanvas, raycaster, camera }); } catch (err) {
    console.error('[picking] part raycast failed', err);
    return null;
  }
}

// ── GIZMO ────────────────────────────────────────────────────
// Volumes are treated as spatial actors inside a composition.
function ensureGizmo() {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.ensureGizmo !== 'function') return null;
  try {
    const refs = viewportInteractionRefs;
    return mod.ensureGizmo({ refs, scene, THREE, gizmoVisuals, gizmoColliders }) || refs.gizmoRoot || null;
  } catch (err) {
    console.error('[gizmo] creation failed', err);
    return null;
  }
}
function updateGizmo() {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.updateGizmo !== 'function') return;
  try {
    mod.updateGizmo({
      scene,
      gizmoRoot: viewportInteractionRefs.gizmoRoot,
      currentMesh: getCurrentMesh(),
      camera,
      gizmoVisuals,
      gizmoMode: viewportInteractionRefs.gizmoMode,
    });
  } catch (err) {
    console.error('[gizmo] visual update failed', err);
  }
}
function setGizmoMode(nextMode, opts) {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.setGizmoMode !== 'function') return;
  try {
    const prevMode = viewportInteractionRefs.gizmoMode;
    mod.setGizmoMode({
      nextMode,
      currentMode: prevMode,
      setCurrentMode: (value) => { viewportInteractionRefs.gizmoMode = value; },
      buttons: {
        move: document.getElementById('btn-gizmo-move'),
        rotate: document.getElementById('btn-gizmo-rotate'),
        scale: document.getElementById('btn-gizmo-scale'),
      },
      updateGizmo,
      opts,
      showToast: _inlineShowToastRealImpl,
      tr,
    });
  } catch (_) {}
}
function hitTestGizmoFromPointer(e) {
  const mod = XR?.__modules?.Raycasting || null;
  if (!mod || typeof mod.hitTestGizmoFromPointer !== 'function') return null;
  try {
    return mod.hitTestGizmoFromPointer({ event: e, currentMesh: getCurrentMesh(), gizmoRoot: viewportInteractionRefs.gizmoRoot, threeCanvas, raycaster, camera, gizmoColliders, gizmoMode: viewportInteractionRefs.gizmoMode });
  } catch (err) {
    console.error('[picking] gizmo raycast failed', err);
    return null;
  }
}
function sphericalToXYZ() {
  const mod = XR?.__modules?.SceneSetup || null;
  if (!mod || typeof mod.sphericalToXYZ !== 'function') return;
  try { mod.sphericalToXYZ({ refs: { spherical, orbitTarget, perspCamera, orthoCamera } }); } catch (_) {}
}
sphericalToXYZ();
function onOrbitPointerDown(e) {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.onOrbitPointerDown !== 'function') return;
  try {
    const refs = getViewportRuntimeRefs();
    mod.onOrbitPointerDown({
      event: e,
      refs,
      setViewportTransformReadout,
      ensureGizmo,
      updateGizmo,
      hitTestGizmoFromPointer,
      getSelectedPart,
      ensureTransformState,
      getShapeScaleFactors,
      axisDragPlaneNormal,
      rotateVectorFromRay,
      hitTestPartIdFromPointer,
      threeCanvas,
      raycaster,
      camera,
      THREE,
      gizmoPlane,
      getGlobalPanLock: () => !!(XR?.__panLockMode || XR?.__globalPanLock),
    });
    applyViewportRuntimeRefs(refs);
  } catch (err) { console.error('[picking] pointer-down handling failed', err); }
}
function onOrbitPointerMove(e) {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.onOrbitPointerMove !== 'function') return;
  try {
    const refs = getViewportRuntimeRefs();
    mod.onOrbitPointerMove({
      event: e,
      refs,
      threeCanvas,
      raycaster,
      camera,
      gizmoPlane,
      THREE,
      clampSnap,
      rotateVectorFromRay,
      mutateSelectedPartTransform,
      setViewportTransformReadout,
      tr,
      GRID_UNITS,
      orthoCamera,
      viewportView,
      orbitTarget,
      spherical,
      sphericalToXYZ,
      getGlobalPanLock: () => !!(XR?.__panLockMode || XR?.__globalPanLock),
    });
    applyViewportRuntimeRefs(refs);
  } catch (err) { console.error('[picking] pointer-move handling failed', err); }
}
function onOrbitPointerUp(e) {
  const mod = XR?.__modules?.Gizmo || null;
  if (!mod || typeof mod.onOrbitPointerUp !== 'function') return;
  try {
    const refs = getViewportRuntimeRefs();
    mod.onOrbitPointerUp({
      event: e,
      refs,
      setViewportTransformReadout,
      updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      persistViewportSettings,
      setSelectedPart,
      threeCanvas,
    });
    // `onOrbitPointerUp` can change selection. Do not write the mesh captured
    // before pointerdown back into runtime state after that command completes:
    // doing so resurrects a deselected mesh and leaves its gizmo hittable.
    refs.currentMesh = getCurrentMesh();
    applyViewportRuntimeRefs(refs);
  } catch (err) { console.error('[picking] pointer-up handling failed', err); }
}

// ── EVENT WIRING ─────────────────────────────────────────────
const editorCleanupFns = [];
const editorCleanupRegistry = XR?.CleanupRegistry?.create?.()
  || XR?.__modules?.CleanupRegistry?.create?.()
  || null;
let viewportController = null;
function resolveViewportController() {
  if (viewportController) return viewportController;
  const mod = XR?.ViewportController || XR?.__modules?.ViewportController || null;
  if (!mod || typeof mod.create !== 'function') return null;
  try {
    viewportController = mod.create({
      threeCanvas,
      threeWrap,
      document,
      editorCleanupFns,
      registerCleanup: editorCleanupRegistry?.add?.bind(editorCleanupRegistry),
      getRefs: getViewportRuntimeRefs,
      viewportWasdKeys,
      clampSnap,
      persistViewportSettings,
      sphericalToXYZ,
      onOrbitPointerDown,
      onOrbitPointerMove,
      onOrbitPointerUp,
      resizeRenderer,
      stateRef: viewportRuntimeState,
      THREE,
      updateGizmo,
      getAutoRotate: () => false,
      getAutoRotateFreeze: () => false,
      getSelectionHelper: () => selectionHelper,
      getCurrentMesh,
    });
  } catch (err) {
    console.error('[viewport] controller creation failed', err);
  }
  return viewportController;
}
(function EVENT_WIRING() {
  const controller = resolveViewportController();
  if (!controller) throw new Error('ViewportController unavailable after engine bootstrap');
  controller.mount();
})();
function resizeRenderer() {
  const runtimeModule = XR?.SceneRuntime || XR?.__modules?.SceneRuntime || null;
  const setupModule = XR?.__modules?.SceneSetup || null;
  const resize = runtimeModule?.resize || setupModule?.resizeRenderer || null;
  if (typeof resize !== 'function') return;
  try {
    resize({
      threeWrap,
      refs: { renderer, perspCamera, orthoCamera, orthoZoom },
    });
  } catch (err) { console.error('[viewport] renderer resize failed', err); }
}

let viewportResizeObserver = null;
{
  const controller = resolveViewportController();
  if (!controller) throw new Error('ViewportController unavailable after engine bootstrap');
  viewportResizeObserver = controller.resizeObserver;
}
function animate() {
  const controller = resolveViewportController();
  if (!controller) {
    console.error('[viewport] controller unavailable after engine bootstrap');
    return false;
  }
  try { controller.frame(); } catch (err) { console.error('[viewport] controller frame failed', err); }
  viewportWasdLastT = viewportRuntimeState.viewportWasdLastT;
}
resize3d = resizeRenderer;
try {
  try {
    XR.__modules?.RenderLoop?.configure?.({ frame: animate });
  } catch (err) {
    console.error('[render-loop] runtime configuration failed', err);
  }
  const imageTools = XR.ImageTools || null;
  const imageToolNames = ['setPerspectiveActive', 'initPerspectiveOverlay', 'drawPerspectiveOverlay', 'applyPerspectiveCorrection', 'resetPerspectivePoints', 'generatePBRMaps', 'applyRetroEffect', 'resetRetroEffect', 'makeSeamless', 'resetSeamless'];
  for (const name of imageToolNames) {
    if (typeof imageTools?.[name] !== 'function') throw new Error(`ImageTools.${name} unavailable after engine bootstrap`);
    legacyImageToolAliases[name] = imageTools[name];
  }
} catch (err) { console.error('[compatibility] image tool aliases unavailable', err); }



let CANVAS_BASE = 512;
let CANVAS_SIZE = 1024;
let CANVAS_SCALE = 2;
let UV_LAYOUT = null;
let baseCtx = null;
let uvCtx = null;
let compositeCanvas = null;
let compositeCtx = null;
try {
  CANVAS_BASE = 512;
  CANVAS_SIZE = 1024;
  CANVAS_SCALE = CANVAS_SIZE / CANVAS_BASE;
  if (baseCanvas) {
    baseCanvas.width = CANVAS_SIZE;
    baseCanvas.height = CANVAS_SIZE;
  }
  if (uvCanvas) {
    uvCanvas.width = CANVAS_SIZE;
    uvCanvas.height = CANVAS_SIZE;
  }
  UV_LAYOUT = {
    box: {
      get face() { return CANVAS_SIZE / 4; },
      originX: 0,
      get originY() { return CANVAS_SIZE / 8; },
    },
    cylinder: {
      pad: Math.round(36 * CANVAS_SCALE),
      wrapH: Math.round(240 * CANVAS_SCALE),
      get wrapY() { return (CANVAS_SIZE - this.wrapH) / 2; },
      get wrapX() { return this.pad; },
      get wrapW() { return CANVAS_SIZE - this.pad * 2; },
      capR: Math.round(50 * CANVAS_SCALE),
      get capGap() { return this.capR; },
      get capTopY() { return this.wrapY - this.capGap; },
      get capBottomY() { return this.wrapY + this.wrapH + this.capGap; },
      get norm() {
        const s = CANVAS_SIZE;
        return {
          pad: this.pad / s,
          wrapH: this.wrapH / s,
          wrapY: this.wrapY / s,
          wrapX: this.wrapX / s,
          wrapW: this.wrapW / s,
          capR: this.capR / s,
          capTopV: this.capTopY / s,
          capBottomV: this.capBottomY / s,
        };
      }
    },
    planar: {
      pad: Math.max(2, Math.round(2 * CANVAS_SCALE)),
    },
  };
  baseCtx = baseCanvas ? baseCanvas.getContext('2d') : null;
  uvCtx = uvCanvas ? uvCanvas.getContext('2d') : null;
  compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = CANVAS_SIZE;
  compositeCanvas.height = CANVAS_SIZE;
  compositeCtx = compositeCanvas.getContext('2d');
} catch (_e_canvas) {}

let editorBg = '#f5f0e8';
let uvOverlayTheme = null;

// Used by the UV-overlay bridge as well as theme derivation.  It must live
// outside refreshThemeDerivedColors: renderUvOverlay can run later, after that
// function's local bindings no longer exist.
function toRgba(rgb, alpha) {
  const derived = XR?.ThemeDerivedColors || XR?.__modules?.ThemeDerivedColors || null;
  if (typeof derived?.rgba === 'function') return derived.rgba(rgb, alpha);
  const value = rgb || { r: 40, g: 35, b: 28 };
  return `rgba(${Math.round(value.r)}, ${Math.round(value.g)}, ${Math.round(value.b)}, ${alpha})`;
}

function isDarkThemeActive() {
  const mod = XR?.__modules?.ShellTheme || null;
  if (mod && typeof mod.isDarkThemeActive === 'function') {
    try {
      const handled = mod.isDarkThemeActive({ themeRoot: document.documentElement });
      if (typeof handled === 'boolean') return handled;
    } catch (_) {}
  }
  const v = String(document.documentElement.getAttribute('data-theme') || 'auto');
  if (v === 'dark') return true;
  if (v === 'light') return false;
  try { return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) { return false; }
}

function readCssVar(name, fallback) {
  const mod = XR?.__modules?.ShellTheme || null;
  if (mod && typeof mod.readCssVar === 'function') {
    try {
      const handled = mod.readCssVar({ name, fallback, themeRoot: document.documentElement });
      if (typeof handled === 'string') return handled;
    } catch (_) {}
  }
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    const s = String(v || '').trim();
    return s || fallback;
  } catch (_) {
    return fallback;
  }
}

function refreshThemeDerivedColors() {
  const derived = XR?.ThemeDerivedColors || XR?.__modules?.ThemeDerivedColors || null;
  const parse = derived?.parseCssRgbTriplet || ((value) => {
    const match = String(value || '').trim().match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)/i);
    return match ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) } : null;
  });
  const deriveRgba = derived?.rgba || ((rgb, alpha) => {
    const value = rgb || { r: 40, g: 35, b: 28 };
    return `rgba(${Math.round(value.r)}, ${Math.round(value.g)}, ${Math.round(value.b)}, ${alpha})`;
  });
  if (derived?.deriveThemeColors) {
    const next = derived.deriveThemeColors({
      currentEditorBg: editorBg,
      isDark: isDarkThemeActive,
      readCssVar,
    });
    if (next?.editorBg) editorBg = next.editorBg;
    if (next?.uvOverlayTheme) uvOverlayTheme = next.uvOverlayTheme;
    return;
  }
  const mod = XR?.__modules?.ShellTheme || null;
  if (mod && typeof mod.refreshThemeDerivedColors === 'function') {
    try {
      const handled = mod.refreshThemeDerivedColors({
        currentEditorBg: editorBg,
        parseCssRgbTriplet: parse,
        rgba: deriveRgba,
        themeRoot: document.documentElement,
      });
      if (handled && typeof handled === 'object') {
        if (typeof handled.editorBg === 'string' && handled.editorBg) editorBg = handled.editorBg;
        if (handled.uvOverlayTheme && typeof handled.uvOverlayTheme === 'object') uvOverlayTheme = handled.uvOverlayTheme;
        return;
      }
    } catch (_) {}
  }
  const nextBg = readCssVar('--surface-panel', editorBg);
  if (nextBg) editorBg = nextBg;

  const dark = isDarkThemeActive();
  const inkRaw = readCssVar('--text-primary', dark ? 'rgb(245, 240, 232)' : 'rgb(40, 35, 28)');
  const inkRgb = parse(inkRaw) || (dark ? { r: 245, g: 240, b: 232 } : { r: 40, g: 35, b: 28 });

  uvOverlayTheme = {
    gridDash: deriveRgba(inkRgb, dark ? 0.14 : 0.35),
    frame: deriveRgba(inkRgb, dark ? 0.22 : 0.55),
    faceFill: deriveRgba(inkRgb, dark ? 0.05 : 0.06),
    faceStroke: deriveRgba(inkRgb, dark ? 0.26 : 0.65),
    label: deriveRgba(inkRgb, dark ? 0.72 : 0.55),
    labelStrong: deriveRgba(inkRgb, dark ? 0.88 : 0.85),
  };
}

function getUvOverlayTheme() {
  if (!uvOverlayTheme) refreshThemeDerivedColors();
  return uvOverlayTheme;
}

refreshThemeDerivedColors();

let maskTmpCanvas = null;
let maskTmpCtx = null;
let layerController = null;
let imageWorkflowController = null;
let textureCanvasController = null;
let textureLayerSession = null;
function resolveTextureLayerSession() {
  if (textureLayerSession) return textureLayerSession;
  const mod = XR?.LayerSession || XR?.__modules?.LayerSession || null;
  if (!mod?.create) return null;
  textureLayerSession = mod.create();
  return textureLayerSession;
}
function readTextureLayerRefs() {
  const session = resolveTextureLayerSession();
  if (!session?.snapshot) throw new Error('[texture] LayerSession unavailable while reading refs');
  return session.snapshot();
}
function writeTextureLayerRefs(refs) {
  const session = resolveTextureLayerSession();
  if (!session?.replaceRefs) throw new Error('[texture] LayerSession unavailable while writing refs');
  session.replaceRefs(refs);
}
function resolveLayerController() {
  if (layerController) return layerController;
  const mod = XR?.LayerController || XR?.__modules?.LayerController || null;
  if (!mod?.create) return null;
  try {
    const session = resolveTextureLayerSession();
    if (!session) throw new Error('LayerSession module unavailable');
    layerController = mod.create({
      session,
      projectState: XR?.ProjectState || null,
      projectStore: XR?.ProjectStore || null,
      editorStore: XR?.EditorStore || null,
      getSelectedPart,
      ensureLayersOnPart,
      affineFromCanvasTransform,
      affineInvert,
      affineMul,
      markDirty: () => {
        try { XR?.Autosave?.manager?.markDirty?.(); }
        catch (err) { console.warn('[texture] autosave dirty notification failed', err); }
      },
      mutateProject,
      imageBitmapToPngDataUrlForSave,
      syncImageSliderControlsFromTransform,
      updateTransformUi,
      renderLayerListUI,
      hydrateLayerBitmapIfNeeded,
      drawBaseLayer,
      requestApplyTexture,
      setActiveLayer,
      getActiveLayer,
    });
  } catch (err) {
    console.error('[texture] layer controller creation failed', err);
  }
  return layerController;
}
function resolveImageWorkflowController() {
  if (imageWorkflowController) return imageWorkflowController;
  const mod = XR?.ImageWorkflowController || XR?.__modules?.ImageWorkflowController || null;
  const session = resolveTextureLayerSession();
  if (!mod?.create || !session) return null;
  try {
    imageWorkflowController = mod.create({
      session,
      canvasSize: CANVAS_SIZE,
      loadImageFromDataUrl,
      getActiveLayer,
      drawBaseLayer,
      requestApplyTexture,
      renderLayerListUI,
      syncImageSliderControlsFromTransform,
      updateTransformUi,
      commitActiveLayerTransform,
      getSelectedPart,
      armProjectUndoSnapshot,
      addImageAsLayer,
      fitImageToCanvas,
      setStatusKey,
      setStatus,
      showToast: _inlineShowToastRealImpl,
      tr,
    });
  } catch (err) {
    console.error('[texture] image workflow controller creation failed', err);
  }
  return imageWorkflowController;
}
function resolveTextureCanvasController() {
  if (textureCanvasController) return textureCanvasController;
  const mod = XR?.TextureCanvasController || XR?.__modules?.TextureCanvasController || null;
  const session = resolveTextureLayerSession();
  if (!mod?.create || !session) return null;
  try {
    textureCanvasController = mod.create({
      session,
      baseCanvas,
      canvasSize: CANVAS_SIZE,
      getCurrentLayers,
      getIslandsForUvMode,
      affineFromCanvasTransform,
      affineInvert,
      setActiveLayer,
      commitActiveLayerTransform,
      drawBaseLayer,
      requestApplyTexture,
      updateTransformUi,
      onScaleChanged: (scale) => {
        const slider = document.getElementById('imgScale');
        if (slider) slider.value = String(Math.round(scale * 100));
      },
    });
  } catch (err) {
    console.error('[texture] canvas controller creation failed', err);
  }
  return textureCanvasController;
}
function getShapeList() {
  const stable = XR?.ProjectState?.getShapeList || null;
  if (stable) {
    try { return stable(); } catch (err) { console.error('[project-state] getShapeList failed', err); }
  }
  console.error('[project-state] getShapeList unavailable after engine bootstrap');
  return [];
}
function getSelectedPart() {
  const stable = XR?.ProjectState?.getSelectedPart || null;
  if (stable) {
    try { return stable(); } catch (err) { console.error('[project-state] getSelectedPart failed', err); }
  }
  console.error('[project-state] getSelectedPart unavailable after engine bootstrap');
  return null;
}

function ensureLayersOnPart(part) {
  const stable = XR?.ProjectState?.ensureLayersOnPart || null;
  if (!stable) {
    console.error('[project-state] ensureLayersOnPart unavailable after engine bootstrap');
    return null;
  }
  try { return stable(part); } catch (err) { console.error('[project-state] ensureLayersOnPart failed', err); return null; }
}

function getCurrentLayers() {
  const controller = resolveLayerController();
  return controller ? controller.getCurrentLayers() : [];
}

function getActiveLayer() {
  const controller = resolveLayerController();
  return controller ? controller.getActiveLayer() : null;
}

function syncImageSliderControlsFromTransform() {
  const api = resolveShellSurfaceEditorApi();
  if (api && typeof api.syncImageSliderControlsFromTransform === 'function') {
    try { return api.syncImageSliderControlsFromTransform(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-surface-editor:syncImageSliders', () => {
    const nextApi = resolveShellSurfaceEditorApi();
    if (nextApi && typeof nextApi.syncImageSliderControlsFromTransform === 'function') {
      try { nextApi.syncImageSliderControlsFromTransform(); } catch (_) {}
    }
  });
}

function affineFromCanvasTransform(t) {
  const mod = XR?.ImageAffine || XR?.__modules?.ImageAffine || null;
  if (!mod?.fromCanvasTransform) throw new Error('ImageAffine module unavailable');
  return mod.fromCanvasTransform(t, CANVAS_SIZE);
}

function affineInvert(m) {
  const mod = XR?.ImageAffine || XR?.__modules?.ImageAffine || null;
  if (!mod?.invert) throw new Error('ImageAffine module unavailable');
  return mod.invert(m);
}

function affineMul(m1, m2) {
  const mod = XR?.ImageAffine || XR?.__modules?.ImageAffine || null;
  if (!mod?.multiply) throw new Error('ImageAffine module unavailable');
  return mod.multiply(m1, m2);
}

function commitActiveLayerTransform() {
  const controller = resolveLayerController();
  return controller?.commitActiveLayerTransform();
}

function updateActiveLayerTransform(patch) {
  const controller = resolveLayerController();
  return controller ? controller.updateActiveLayerTransform(patch) : null;
}

function setActiveLayer(idx) {
  const controller = resolveLayerController();
  return controller?.setActiveLayer(idx);
}

function hydrateLayerBitmapIfNeeded(layer, part) {
  return resolveImageWorkflowController()?.hydrateLayerBitmapIfNeeded(layer, part);
}

function toggleLayerVisibility(idx) {
  return resolveLayerController()?.toggleLayerVisibility(idx);
}

function layerHasPolygonMask(layer) {
  return !!(layer && Array.isArray(layer.polygonMaskPoints) && layer.polygonMaskPoints.length >= 3);
}

function toggleLayerPolygonMask(idx) {
  const part = getSelectedPart();
  if (!part) return;
  ensureLayersOnPart(part);
  const layers = part.layers || [];
  const layer = layers[idx] || null;
  if (!layer) return;
  if (layerHasPolygonMask(layer)) {
    resolveLayerController()?.clearLayerPolygonMask(idx);
    return;
  }
  callShellMaskEditor('openPolygonMaskModal', idx);
}

function duplicateLayer(idx) {
  const controller = resolveLayerController();
  return controller?.duplicateLayer(idx);
}

function openRenameLayerModal(currentValue, onSubmit, opts) {
  const api = resolveShellSurfaceEditorApi();
  if (api && typeof api.openRenameLayerModal === 'function') {
    try { return api.openRenameLayerModal(currentValue, onSubmit, opts); } catch (_) {}
  }
}

function renameLayer(idx) {
  const part = getSelectedPart();
  if (!part) return;
  ensureLayersOnPart(part);
  const layers = part.layers || [];
  const layer = layers[idx] || null;
  if (!layer) return;
  const current = String(layer.label || ('Layer ' + (idx + 1)));
  const existing = layers.map((l, i) => (i === idx) ? '' : String(l && l.label ? l.label : ('Layer ' + (i + 1))).trim().toLowerCase()).filter(Boolean);
  openRenameLayerModal(current, (name) => {
    resolveLayerController()?.renameLayer(idx, name, part);
  }, { maxLen: 32, validate: (next) => !existing.includes(String(next || '').trim().toLowerCase()) });
}

function deleteLayer(idx) {
  return resolveLayerController()?.deleteLayer(idx);
}

function moveLayer(idx, delta) {
  return resolveLayerController()?.moveLayer(idx, delta);
}

function onWithSignal(signal, target, ev, fn, opts) {
  if (!target || !target.addEventListener) return;
  try { target.addEventListener(ev, fn, { ...(opts || {}), signal }); }
  catch (_) { try { target.addEventListener(ev, fn, opts || false); } catch (_) {} }
}

function renderLayerListUI() {
  const api = resolveShellSurfaceEditorApi();
  if (api && typeof api.renderLayerListUI === 'function') {
    try { return api.renderLayerListUI(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-surface-editor:renderLayerList', () => {
    const nextApi = resolveShellSurfaceEditorApi();
    if (nextApi && typeof nextApi.renderLayerListUI === 'function') {
      try { nextApi.renderLayerListUI(); } catch (_) {}
    }
  });
}
function syncVisibleToSelectedPart() {
  return resolveLayerController()?.syncVisibleToSelectedPart();
}

function isRatioAllowedForPart(part) {
  return !!part;
}
function updateTransformUi() {
  const api = resolveShellSurfaceEditorApi();
  if (api && typeof api.updateTransformUi === 'function') {
    try { return api.updateTransformUi(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-surface-editor:updateTransformUi', () => {
    const nextApi = resolveShellSurfaceEditorApi();
    if (nextApi && typeof nextApi.updateTransformUi === 'function') {
      try { nextApi.updateTransformUi(); } catch (_) {}
    }
  });
}

function drawLayerBitmapToCtx(ctx, layer) {
  const mod = XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.drawLayerBitmapToCtx !== 'function') return;
  try { mod.drawLayerBitmapToCtx(ctx, layer, { canvasSize: CANVAS_SIZE, document }); } catch (_) {}
}
function drawBaseLayer() {
  const mod = XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.drawBaseLayer !== 'function') return;
  const refs = { maskTmpCanvas, maskTmpCtx, baseLayerRevision };
  try {
    mod.drawBaseLayer({
      refs,
      baseCtx,
      canvasSize: CANVAS_SIZE,
      editorBg,
      document,
      getSelectedPart,
      getProject: () => project,
      getCurrentLayers,
    });
    maskTmpCanvas = refs.maskTmpCanvas;
    maskTmpCtx = refs.maskTmpCtx;
    baseLayerRevision = refs.baseLayerRevision;
  } catch (_) {}
}
function updateComposite() {
  const mod = XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.updateComposite !== 'function') return;
  try { mod.updateComposite({ compositeCtx, baseCanvas, canvasSize: CANVAS_SIZE }); } catch (_) {}
}

function partHasAnyVisibleLayerImage(part) {
  const mod = XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.partHasAnyVisibleLayerImage !== 'function') return false;
  try { return !!mod.partHasAnyVisibleLayerImage(part); } catch (_) { return false; }
}

function ensureSrgbTexture(tex) {
  const mod = XR?.ImageCompositor || XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.ensureSrgbTexture !== 'function') return;
  try { mod.ensureSrgbTexture({ texture: tex, THREE, renderer }); } catch (_) {}
}
function applyTexture(silent) {
  const mod = XR?.ImageCompositor || XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.applyTexture !== 'function') return;
  try { mod.applyTexture({ silent }); } catch (_) {}
}

function requestApplyTexture(silent) {
  const mod = XR?.ImageCompositor || XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.requestApplyTexture !== 'function') return;
  try { mod.requestApplyTexture({ silent }); } catch (_) {}
}

function configureImageCompositorRuntime() {
  const mod = XR?.ImageCompositor || XR?.__modules?.ImageCompositor || null;
  if (!mod || typeof mod.configure !== 'function') return;
  const refs = { drawingTexture: getDrawingTexture() };
  try {
    mod.configure({
      refs,
      syncRefsFromHost: () => {
        refs.drawingTexture = getDrawingTexture();
      },
      syncHostFromRefs: () => {
        setDrawingTexture(refs.drawingTexture);
      },
      THREE,
      renderer,
      canvasSize: CANVAS_SIZE,
      baseCanvas,
      compositeCanvas,
      compositeCtx,
      getCurrentMesh,
      getSelectedPart,
      getProject: () => project,
      getShapeList,
      syncVisibleToSelectedPart,
      updateUVPreview,
      markViewportDirty: (frames) => XR?.__modules?.ViewportRuntime?.markDirty?.(frames),
      setStatusKey,
      setStatus,
      applyMaterialFlagsForPart,
    });
  } catch (_) {}
}

configureImageCompositorRuntime();

const imageToolRuntime = {
  canvasSize: CANVAS_SIZE,
  getActiveLayer,
  drawBaseLayer,
  requestApplyTexture,
  armProjectUndoSnapshot,
  markDirty: () => XR?.Autosave?.manager?.markDirty?.(),
};
try {
  if (XR.ImageTools && typeof XR.ImageTools.configure === 'function') {
    XR.ImageTools.configure(imageToolRuntime);
  }
} catch (_) {}
function installSurfaceCanvasInteractions() {
  return resolveTextureCanvasController()?.install();
}

installSurfaceCanvasInteractions();

let uvStretchOn = false;
function setUvStretch(on) {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.setUvStretch !== 'function') return;
  const refs = { uvStretchOn };
  try {
    mod.setUvStretch({ on, refs });
    uvStretchOn = refs.uvStretchOn;
    updateUvStretchUi();
    renderUvOverlay();
    updateUvTexelDensityUi();
  } catch (_) {}
}

function uvModePrimaryIsland(mode) {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.uvModePrimaryIsland !== 'function') return null;
  try {
    return mod.uvModePrimaryIsland({
      mode,
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
    });
  } catch (_) {
    return null;
  }
}

function getIslandsForUvMode() {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.getIslandsForUvMode !== 'function') return [];
  try {
    return mod.getIslandsForUvMode({
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
    }) || [];
  } catch (_) {
    return [];
  }
}
function renderUvOverlay() {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.renderUvOverlay !== 'function') {
    XR?.DebugLog?.event?.('uv.overlay.bridge.skipped', {
      hasRuntime: !!mod,
      hasRenderer: typeof mod?.renderUvOverlay === 'function',
      uvMode: getUvMode(),
    });
    return false;
  }
  try {
    mod.renderUvOverlay({
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      refs: { uvStretchOn },
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
      selectedIslandId: getSelectedIslandId(),
      t: tr,
    });
    XR?.DebugLog?.event?.('uv.overlay.bridge.success', { uvMode: getUvMode() });
    return true;
  } catch (err) {
    console.error('[uv-overlay] render failed', err);
    XR?.DebugLog?.error?.('uv.overlay.bridge.failure', err, { uvMode: getUvMode() });
    return false;
  }
}

function renderUvCompareNets() {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.renderUvCompareNets !== 'function') return;
  try {
    mod.renderUvCompareNets({
      document,
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      refs: { uvStretchOn },
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
    });
  } catch (_) {}
}

function applyCustomUvToGeometry(geo, cu) {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.applyCustomUvToGeometry !== 'function') return false;
  try {
    return !!mod.applyCustomUvToGeometry({
      geo,
      cu,
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      refs: { uvStretchOn },
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
    });
  } catch (_) {
    return false;
  }
}

function applyCustomUvToCurrentMesh(part) {
  const mod = XR?.__modules?.UvOverlayRuntime || null;
  if (!mod || typeof mod.applyCustomUvToCurrentMesh !== 'function') return false;
  try {
    return !!mod.applyCustomUvToCurrentMesh({
      part,
      uvCtx,
      CANVAS_SIZE,
      UV_LAYOUT,
      uvMode: getUvMode(),
      refs: { uvStretchOn },
      getUvOverlayTheme,
      isDarkThemeActive,
      rgba: toRgba,
      currentMesh: getCurrentMesh(),
      updateInfoForMesh,
      updateUvStretchUi,
      updateUvTexelDensityUi,
    });
  } catch (_) {
    return false;
  }
}

drawBaseLayer();
renderUvOverlay();
updateComposite();

function canImportImagesNow() {
  const shapes = getShapeList();
  if (!shapes || !shapes.length) return false;
  return !!getSelectedPart();
}

function updateTextureImportAvailability() {
  const api = resolveShellSurfaceEditorApi();
  if (api && typeof api.updateTextureImportAvailability === 'function') {
    try { return api.updateTextureImportAvailability(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-surface-editor:updateImportAvailability', () => {
    const nextApi = resolveShellSurfaceEditorApi();
    if (nextApi && typeof nextApi.updateTextureImportAvailability === 'function') {
      try { nextApi.updateTextureImportAvailability(); } catch (_) {}
    }
  });
}

function updateUvStretchUi() {
  const api = resolveShellUvUiApi();
  if (api && typeof api.updateUvStretchUi === 'function') {
    try { return api.updateUvStretchUi(); } catch (_) {}
  }
}

function updateUvStretchLegendUi() {
  const api = resolveShellUvUiApi();
  if (api && typeof api.updateUvStretchLegendUi === 'function') {
    try { return api.updateUvStretchLegendUi(); } catch (_) {}
  }
}

function updateUvModeHint() {
  const api = resolveShellUvUiApi();
  if (api && typeof api.updateUvModeHint === 'function') {
    try { return api.updateUvModeHint(); } catch (_) {}
  }
}

function updateUVPreview() {
  const api = resolveShellUvUiApi();
  if (api && typeof api.updateUVPreview === 'function') {
    try { return api.updateUVPreview(); } catch (_) {}
  }
}

function updateUvTexelDensityUi() {
  const wrap = document.getElementById('uvTexel');
  const list = document.getElementById('uvTexelList');
  if (!wrap || !list) return;
  const rows = computeUvTexelDensityRows();
  list.innerHTML = '';
  if (!rows.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'xr-uv-texel__row' + (r.id && r.id === getSelectedIslandId() ? ' is-active' : '');
    const a = document.createElement('span');
    a.className = 'xr-uv-texel__name';
    const key = r.labelKey || '';
    const label = key ? tr(key) : '';
    a.textContent = (label && label !== key) ? label : String(r.id || '');
    const b = document.createElement('span');
    b.className = 'xr-uv-texel__val';
    b.textContent = (typeof r.factor === 'number' && isFinite(r.factor)) ? (r.factor.toFixed(2) + '×') : '—';
    row.append(a, b);
    list.appendChild(row);
  }
}

function computeUvTexelDensityRows() {
  const mod = XR?.UVDiagnostics || XR?.__modules?.UVDiagnostics || null;
  if (!mod || typeof mod.computeUvTexelDensityRows !== 'function') return [];
  try {
    return mod.computeUvTexelDensityRows({
      currentMesh: getCurrentMesh(),
      getIslandsForUvMode,
      canvasSize: CANVAS_SIZE,
    }) || [];
  } catch (_) {
    return [];
  }
}

let uvCheckerCanvas = null;
let uvCheckerDataUrl = null;
function isUvCheckerApplied() {
  const mod = XR?.__modules?.ImageWorkflows || null;
  if (!mod || typeof mod.isUvCheckerApplied !== 'function') return false;
  const refs = { uvCheckerCanvas, uvCheckerDataUrl };
  try {
    const result = mod.isUvCheckerApplied({ refs, getShapeList });
    uvCheckerCanvas = refs.uvCheckerCanvas;
    uvCheckerDataUrl = refs.uvCheckerDataUrl;
    return !!result;
  } catch (_) {
    return false;
  }
}

function removeUvCheckerFromAllShapes() {
  const mod = XR?.__modules?.ImageWorkflows || null;
  if (!mod || typeof mod.removeUvCheckerFromAllShapes !== 'function') return false;
  const refs = { uvCheckerCanvas, uvCheckerDataUrl };
  try {
    const result = mod.removeUvCheckerFromAllShapes({
      refs,
      getShapeList,
      getProject: () => project,
      mutateProject,
      setSelectedPart,
      getSelectedPart,
      setActiveLayer,
      drawBaseLayer,
      requestApplyTexture,
      renderLayerListUI,
    });
    uvCheckerCanvas = refs.uvCheckerCanvas;
    uvCheckerDataUrl = refs.uvCheckerDataUrl;
    return !!result;
  } catch (_) {
    return false;
  }
}

async function applyUvCheckerToAllShapes() {
  const mod = XR?.__modules?.ImageWorkflows || null;
  if (!mod || typeof mod.applyUvCheckerToAllShapes !== 'function') return;
  const refs = { uvCheckerCanvas, uvCheckerDataUrl };
  try {
    await mod.applyUvCheckerToAllShapes({
      refs,
      getShapeList,
      getProject: () => project,
      mutateProject,
      ensureLayersOnPart,
      newLayerId,
      setSelectedPart,
      drawBaseLayer,
      applyTexture,
    });
    uvCheckerCanvas = refs.uvCheckerCanvas;
    uvCheckerDataUrl = refs.uvCheckerDataUrl;
  } catch (_) {}
}

async function applyUvChecker() {
  const mod = XR?.__modules?.ImageWorkflows || null;
  if (!mod || typeof mod.applyUvChecker !== 'function') return;
  const refs = { uvCheckerCanvas, uvCheckerDataUrl };
  try {
    await mod.applyUvChecker({
      refs,
      getSelectedPart,
      armProjectUndoSnapshot,
      addImageAsLayer,
      fitImageToCanvas,
      setStatusKey,
      setStatus,
    });
    uvCheckerCanvas = refs.uvCheckerCanvas;
    uvCheckerDataUrl = refs.uvCheckerDataUrl;
  } catch (_) {}
}
async function loadImageFromFile(file) {
  return resolveImageWorkflowController()?.loadImageFromFile(file);
}

function addImageAsLayer(bmp, dataUrl) {
  return resolveLayerController()?.addImageAsLayer(bmp, dataUrl);
}
function fitImageToCanvas() {
  return resolveImageWorkflowController()?.fitImageToCanvas();
}

function fillImageToCanvas() {
  return resolveImageWorkflowController()?.fillImageToCanvas();
}
function createMaterial(state) {
  const mod = XR?.__modules?.MaterialRuntime || null;
  if (!mod || typeof mod.createMaterial !== 'function') return null;
  try { return mod.createMaterial({ state, THREE, flatLightingOn: getFlatLightingOn(), wireframeOn: getWireframeOn() }); } catch (_) { return null; }
}

function applyMaterialFlagsForPart(part, mat) {
  const mod = XR?.__modules?.MaterialRuntime || null;
  if (!mod || typeof mod.applyMaterialFlagsForPart !== 'function') return;
  try { mod.applyMaterialFlagsForPart({ part, mat, THREE }); } catch (_) {}
}
function applyMaterialStateToMesh(part) {
  const mod = XR?.__modules?.MaterialRuntime || null;
  if (!mod || typeof mod.applyMaterialStateToMesh !== 'function') return;
  try { mod.applyMaterialStateToMesh({ part, THREE, wireframeOn: getWireframeOn() }); } catch (_) {}
}
function createOffscreenCanvas() {
  const c = document.createElement('canvas');
  c.width = CANVAS_SIZE;
  c.height = CANVAS_SIZE;
  const ctx = c.getContext('2d');
  return { canvas: c, ctx };
}
function updateInfoForMesh(mesh) {
  const mod = XR?.__modules?.ViewportRuntime || null;
  if (!mod || typeof mod.updateInfoForMesh !== 'function') return;
  try {
    mod.updateInfoForMesh({
      mesh,
      THREE,
      document,
      tr,
      getUvModeLabel,
      uvMode: getUvMode(),
      gridUnits: GRID_UNITS,
    });
  } catch (_) {}
}
function getGeoStats(filterFn) {
  const stats = XR?.GeometryStats || XR?.__modules?.GeometryStats || null;
  return stats?.getGeometryStats?.({ shapes: getShapeList(), filter: filterFn }) || { tris: 0, verts: 0 };
}


function disposePart(part) {
  return XR?.PartResourceRuntime?.disposePart?.({ part, assemblyRoot }) || false;
}
function clearAssembly() {
  const runtime = XR?.PartResourceRuntime || XR?.__modules?.PartResourceRuntime || null;
  if (!runtime?.clearAssembly) return false;
  const refs = { currentMesh: getCurrentMesh(), currentArchetype, drawingTexture: getDrawingTexture(), selectionHelper, gizmoRoot: viewportInteractionRefs.gizmoRoot };
  const result = runtime.clearAssembly({ getShapeList, project, assemblyRoot, scene, refs });
  setCurrentMesh(refs.currentMesh);
  currentArchetype = refs.currentArchetype;
  setDrawingTexture(refs.drawingTexture);
  selectionHelper = refs.selectionHelper;
  viewportInteractionRefs.gizmoRoot = refs.gizmoRoot;
  return result;
}
function getArchetypeById(id) {
  return XR?.getArchetypeById?.(id) || null;
}
function getArchetypeCategoryById(id) {
  return XR?.getArchetypeCategoryById?.(id) || null;
}
function ensureTransformState(part) {
  return XR?.PartTransform?.ensureTransformState?.(part)
    || XR?.__modules?.PartTransform?.ensureTransformState?.(part)
    || null;
}
function getShapeScaleFactors(part) {
  return XR?.PartTransform?.getShapeScaleFactors?.(part)
    || XR?.__modules?.PartTransform?.getShapeScaleFactors?.(part)
    || { x: 1, y: 1, z: 1 };
}
function applyTransformToMesh(part) {
  const runtime = XR?.PartTransform || XR?.__modules?.PartTransform || null;
  return runtime?.applyTransformToMesh?.({
    part,
    selectionHelper,
    updateGizmo,
    markDirty: (frames) => XR?.__modules?.ViewportRuntime?.markDirty?.(frames),
    onWarning: (message, err) => console.warn(message, err),
  }) || false;
}
function createPartFromArchetype(arch, opts) {
  const mod = XR?.ShapeFactory || XR?.__modules?.ShapeFactory || null;
  if (!mod || typeof mod.createPartFromArchetype !== 'function') return null;
  try {
    return mod.createPartFromArchetype({
      arch,
      opts,
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
  } catch (_) {
    return null;
  }
}
function setSelectedPart(partId, options) {
  const controller = XR?.SelectionController || XR?.__modules?.SelectionController || null;
  if (!controller || typeof controller.select !== 'function') return;
  controller.select({
    partId,
    options,
    readRefs: () => ({ currentMesh: getCurrentMesh(), currentArchetype, selectionHelper, gizmoRoot: viewportInteractionRefs.gizmoRoot, uvMode: getUvMode(), ...readTextureLayerRefs(), selectedIslandId: getSelectedIslandId() }),
    writeRefs: (refs) => {
      setCurrentMesh(refs.currentMesh);
      currentArchetype = refs.currentArchetype;
      selectionHelper = refs.selectionHelper;
      viewportInteractionRefs.gizmoRoot = refs.gizmoRoot;
      setCanonicalUvMode(refs.uvMode);
      writeTextureLayerRefs(refs);
      setCanonicalSelectedIslandId(refs.selectedIslandId);
    },
    buildSelectionContext: ({ partId: nextPartId, options: nextOptions, refs }) => ({
      partId: nextPartId,
      options: nextOptions,
      project,
      refs,
      getShapeList,
      projectState: XR?.ProjectState || null,
      projectStore: XR?.ProjectStore || null,
      editorStore: XR?.EditorStore || null,
      markViewportDirty: XR?.ViewportRuntime?.markDirty || null,
      getSelectedId: () => (XR?.ProjectState?.getSelectedId?.() ?? ((project && project.selectedId) ? project.selectedId : null)),
      getSelectedPart,
      syncVisibleToSelectedPart,
      tr,
      scene,
      THREE,
      applyTransformToMesh,
      ensureTransformState,
      applyMaterialStateToMesh,
      getDefaultUvModeForArchetypeId,
      setUVMode,
      ensureLayersOnPart,
      syncSelectionPanels: (payload) => callShellInspectorPanels('syncSelectionPanels', payload),
      updateTransformUi,
      syncImageSliderControlsFromTransform,
      drawBaseLayer,
      renderLayerListUI,
      hydrateLayerBitmapIfNeeded,
      ensureGizmo,
      updateGizmo,
      renderTreeUI,
      renderShapeParamsUI,
      updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      renderUvOverlay,
      requestApplyTexture,
      updateComposite,
      updateUVPreview,
      updateInfoForMesh,
      setStatus,
      getArchetypeById,
    }),
    // Selection may lazily create a gizmo. The refs are copied before this
    // runs, preventing texture controls from reading the prior part's layer.
    afterSelectionSync: () => {
      try { syncImageSliderControlsFromTransform(); } catch (err) { console.error('[selection] image slider resync failed', err); }
      try { updateTransformUi(); } catch (err) { console.error('[selection] image transform UI resync failed', err); }
      try { drawBaseLayer(); } catch (err) { console.error('[selection] image canvas resync failed', err); }
      try { requestApplyTexture(true); } catch (err) { console.error('[selection] texture resync failed', err); }
    },
  });
}
function renderTreeUI() {
  const api = resolveShellScenePanelsApi();
  if (api && typeof api.renderTree === 'function') {
    try { return api.renderTree(); } catch (err) { console.error('[shell-scene-panels] tree render failed', err); }
  }
  scheduleDeferredShellCall('shell-scene-panels:renderTree', () => {
    const nextApi = resolveShellScenePanelsApi();
    if (nextApi && typeof nextApi.renderTree === 'function') {
      try { nextApi.renderTree(); } catch (err) { console.error('[shell-scene-panels] deferred tree render failed', err); }
    }
  });
}

function setMobilePreviewMode(on) {
  const root = document.getElementById('xreate-editor-root');
  if (!root) return;
  // Retained only as a compatibility no-op for saved sessions and old
  // adapters. Device Preview no longer has a supported control or mode.
  root.classList.remove('is-mobile-preview');
  try {
    const sceneRootEl = document.documentElement;
    if (sceneRootEl && sceneRootEl.dataset.sceneOpen === 'true') delete sceneRootEl.dataset.sceneOpen;
    document.getElementById('btn-scene')?.setAttribute('aria-expanded', 'false');
  } catch (_) {}
  try { window.dispatchEvent(new Event('resize')); } catch (_) {}
}

function isMobilePreviewDevice() {
  try {
    if (navigator && Number(navigator.maxTouchPoints || 0) > 0) return true;
  } catch (_) {}
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (_) {}
  try {
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return true;
  } catch (_) {}
  return false;
}

function updateMobilePreviewAvailability(totalShapes) {
  return resolveProjectControllerApi()?.updateMobilePreviewAvailability?.(totalShapes);
}

function updateExportAvailability(totalShapes) {
  return resolveProjectControllerApi()?.updateExportAvailability?.(totalShapes);
}
function callShellInspectorPanels(method, payload) {
  const api = resolveShellInspectorPanelsApi();
  if (api && method && typeof api[method] === 'function') {
    try { return api[method](payload); } catch (_) {}
    return;
  }
  scheduleDeferredShellCall('shell-inspector:' + String(method || ''), () => {
    const nextApi = resolveShellInspectorPanelsApi();
    if (nextApi && method && typeof nextApi[method] === 'function') {
      try { nextApi[method](payload); } catch (_) {}
    }
  });
}
function mutateSelectedPartTransform(mutator) {
  const controller = XR?.TransformController || XR?.__modules?.TransformController || null;
  return controller?.mutateSelectedTransform?.({
    getSelectedPart, mutateProject, ensureTransformState, applyTransformToMesh,
    mutate: mutator,
    afterTransform: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
  });
}
function applyShapeTransformControlsToSelected(source) {
  const controller = XR?.TransformController || XR?.__modules?.TransformController || null;
  return controller?.applySelectedTransformFromControls?.({
    source, getSelectedPart, mutateProject, ensureTransformState, applyTransformToMesh,
    isUniformScaleLocked: () => uniformScaleLock,
    afterTransform: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
  });
}
function updateMaterialControlsFromSelected() {
  const api = resolveShellShapeParamsApi();
  if (api && typeof api.updateMaterialControlsFromSelected === 'function') {
    try { return api.updateMaterialControlsFromSelected(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-shape-params:updateMaterialControls', () => {
    const nextApi = resolveShellShapeParamsApi();
    if (nextApi && typeof nextApi.updateMaterialControlsFromSelected === 'function') {
      try { nextApi.updateMaterialControlsFromSelected(); } catch (_) {}
    }
  });
}

let uniformScaleLock = true;
function rebuildSelectedPartGeometry() {
  const controller = XR?.GeometryController || XR?.__modules?.GeometryController || null;
  return controller?.rebuildSelectedPartGeometry?.({
    getSelectedPart, getArchetypeById, applyUvModeToGeometry,
    armProjectUndoSnapshot, applyMaterialFlagsForPart, updateInfoForMesh, renderUvOverlay, requestApplyTexture,
    markViewportDirty: (frames) => XR?.__modules?.ViewportRuntime?.markDirty?.(frames),
  }) || false;
}
function renderShapeParamsUI() {
  const api = resolveShellShapeParamsApi();
  if (api && typeof api.render === 'function') {
    try { return api.render(); } catch (_) {}
  }
  scheduleDeferredShellCall('shell-shape-params:render', () => {
    const nextApi = resolveShellShapeParamsApi();
    if (nextApi && typeof nextApi.render === 'function') {
      try { nextApi.render(); } catch (_) {}
    }
  });
}
function applyPartControlsToSelected() {
  const controller = XR?.TransformController || XR?.__modules?.TransformController || null;
  return controller?.applySelectedUniformTransformFromControls?.({
    getSelectedPart,
    mutateProject,
    ensureTransformState,
    applyTransformToMesh,
    afterTransform: () => callShellInspectorPanels('updatePartControlsFromSelected'),
  });
}
function replaceSelectedPartArchetype(arch) {
  const mod = XR?.ShapeFactory || XR?.__modules?.ShapeFactory || null;
  if (!mod || typeof mod.replaceSelectedPartArchetype !== 'function') return;
  const refs = { uvMode: getUvMode() };
  try {
    mod.replaceSelectedPartArchetype({
      arch,
      refs,
      getSelectedPart,
      mutateProject,
      syncVisibleToSelectedPart,
      ensureTransformState,
      THREE,
      applyMaterialFlagsForPart,
      getDefaultUvModeForArchetypeId,
      getDefaultParamsForArchetypeId,
      applyUvModeToGeometry,
      setUVMode,
      updateInfoForMesh,
      renderUvOverlay,
      drawBaseLayer,
      requestApplyTexture,
      renderTreeUI,
      renderShapeParamsUI,
      updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      // Keep one resilient entry point: the Doodle owner may be exposed by
      // ShellDoodleModal before ShellEditorModals publishes its facade.
      openDoodleModal,
    });
    setCanonicalUvMode(refs.uvMode);
  } catch (_) {}
}
function addPartFromCurrentArchetype() {
  const arch = currentArchetype || getArchetypeById('cube');
  addPartFromArchetype(arch);
}

function getDefaultSpawnPosition(shapeCount) {
  const o = 0.22 * Math.min(6, Math.max(0, shapeCount || 0));
  return new THREE.Vector3(o, 0, o);
}
let shapeActions = null;
function getShapeActions() {
  if (shapeActions) return shapeActions;
  const api = XR?.ShapeActions || XR?.__modules?.ShapeActions || null;
  if (typeof api?.create !== 'function') return null;
  shapeActions = api.create({
    getController: (name) => XR?.[name] || XR?.__modules?.[name] || null,
    mutateProject, getShapeList, getDefaultSpawnPosition, getArchetypeById,
    createPartFromArchetype, setSelectedPart, renderTreeUI, setStatusKey, setStatus,
    THREE, newPartId, createOffscreenCanvas, createMaterial, assemblyRoot,
    editorBg, canvasSize: CANVAS_SIZE, buildDoodleRevolveFromPoints, buildDoodleMirrorFromPoints,
    buildDoodleFromPoints, applyUvModeToGeometry,
    ensureGizmo: (typeof ensureGizmo === 'function') ? ensureGizmo : XR?.Gizmo?.ensureGizmoFn,
    fitViewportView: (typeof fitViewportView === 'function') ? fitViewportView : XR?.fitViewportView,
    openDoodleModal,
    onError: (message, err) => console.error(message, err),
  });
  return shapeActions;
}
function spawnHumanoidKit(opts) {
  return getShapeActions()?.spawnHumanoidKit(opts) || { created: 0, selectedId: null };
}
function addPartFromArchetype(arch, opts) {
  return getShapeActions()?.addPartFromArchetype(arch, opts) || null;
}

function addDoodleShapeToScene(points, params, opts) {
  return getShapeActions()?.addDoodleShapeToScene(points, params, opts) || null;
}

function setTextureMode(perPart) {
  const controller = XR?.TextureModeController || XR?.__modules?.TextureModeController || null;
  if (!controller?.setTextureMode) return false;
  const refs = { drawingTexture: getDrawingTexture() };
  const result = controller.setTextureMode({
    perShape: perPart, project, getProject: () => project, mutateProject, getShapeList,
    THREE, compositeCanvas, ensureSrgbTexture, getSelectedPart, requestApplyTexture,
    setStatusKey, refs,
    dispatchProject: (action) => XR?.ProjectStore?.dispatch?.(action),
  });
  setDrawingTexture(refs.drawingTexture);
  return result;
}
function toggleSelectPartMode() {
  selectPartMode = !selectPartMode;
  renderTreeUI();
  setStatusKey(selectPartMode ? 'status_select_part_on' : 'status_select_part_off', 'ok');
}
function toggleTextureMode() {
  setTextureMode(!(project && project.textureMode === 'per-shape'));
}

// Only doodle-specific geometry remains bridged until the doodle editor is
// fully moved. All standard archetype builders live in the ESM catalog.
const buildDoodleFromPoints = (...args) => {
  const fn = XR?.ShapeBuilders?.buildDoodleFromPoints || XR?.__modules?.ShapeBuilders?.buildDoodleFromPoints;
  if (typeof fn !== 'function') throw new Error('buildDoodleFromPoints not available');
  return fn(...args);
};
const buildDoodleRevolveFromPoints = (...args) => {
  const fn = XR?.ShapeBuilders?.buildDoodleRevolveFromPoints || XR?.__modules?.ShapeBuilders?.buildDoodleRevolveFromPoints;
  if (typeof fn !== 'function') throw new Error('buildDoodleRevolveFromPoints not available');
  return fn(...args);
};
const buildDoodleMirrorFromPoints = (...args) => {
  const fn = XR?.ShapeBuilders?.buildDoodleMirrorFromPoints || XR?.__modules?.ShapeBuilders?.buildDoodleMirrorFromPoints;
  if (typeof fn !== 'function') throw new Error('buildDoodleMirrorFromPoints not available');
  return fn(...args);
};
function buildAddShapeMenu() {
  if (addShapeMenuApi && typeof addShapeMenuApi.build === 'function') {
    try { return addShapeMenuApi.build(); } catch (_) {}
  }
}
function openAddShapeMenu(anchorEl) {
  if (addShapeMenuApi && typeof addShapeMenuApi.open === 'function') {
    try { return addShapeMenuApi.open(anchorEl); } catch (_) {}
  }
}
function closeAddShapeMenu() {
  if (addShapeMenuApi && typeof addShapeMenuApi.close === 'function') {
    try { return addShapeMenuApi.close(); } catch (_) {}
  }
  const menu = document.getElementById('add-shape-menu');
  const btn = document.getElementById('btn-add-shape');
  if (!menu) return;
  menu.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function toggleAddShapeMenu() {
  if (addShapeMenuApi && typeof addShapeMenuApi.toggle === 'function') {
    try { return addShapeMenuApi.toggle(); } catch (_) {}
  }
  const menu = document.getElementById('add-shape-menu');
  if (!menu) return;
  if (menu.hidden) openAddShapeMenu();
  else closeAddShapeMenu();
}
function getDefaultUvModeForArchetypeId(id) {
  const stable = XR?.ShapeDefs?.defaultUvMode || XR?.__modules?.ShapeDefs?.defaultUvMode || null;
  if (!stable || stable === getDefaultUvModeForArchetypeId) return 'cylindrical';
  try {
    const r = stable(id);
    return (r != null) ? r : 'cylindrical';
  } catch (_) {
    return 'cylindrical';
  }
}
function getDefaultParamsForArchetypeId(id) {
  const stable = XR?.ShapeDefs?.defaultParams || XR?.__modules?.ShapeDefs?.defaultParams || null;
  if (!stable || stable === getDefaultParamsForArchetypeId) return null;
  try { return stable(id); } catch (_) { return null; }
}
function buildBGRow() {
  const api = resolveShellProjectUiApi();
  if (api && typeof api.buildBackgroundRow === 'function') {
    try { return api.buildBackgroundRow(); } catch (_) {}
  }
}

// UV mapping in XReate is intentionally didactic: these modes are simple projections
// (planar/cylindrical/spherical/box) that produce readable UV islands and predictable seams.
function canonicalizeUvMode(mode) {
  return XR?.UVMapping?.canonicalizeUvMode?.(mode)
    || XR?.__modules?.UVMapping?.canonicalizeUvMode?.(mode)
    || 'cylindrical';
}
function applyUvModeToGeometry(geo, modeOverride) {
  const mod = XR?.UVMapping || XR?.__modules?.UVMapping || null;
  if (!mod || typeof mod.applyUvModeToGeometry !== 'function') return null;
  try {
    return mod.applyUvModeToGeometry({
      geo,
      modeOverride: canonicalizeUvMode(modeOverride),
      defaultMode: canonicalizeUvMode(getUvMode()),
      THREE,
      uvLayout: UV_LAYOUT,
      canvasSize: CANVAS_SIZE,
    });
  } catch (_) {
    return null;
  }
}
// Each projection must be calculated from the same, untouched geometry.  Reusing
// the output of the previous projection makes a spherical mesh progressively lose
// its native UV orientation (e.g. Spherical → Cylindrical → Spherical).
function getUvRemapBaseGeometry(mesh) {
  if (!mesh || !mesh.geometry || typeof mesh.geometry.clone !== 'function') return null;
  const data = mesh.userData || (mesh.userData = {});
  const existing = data.xrUvRemapBaseGeometry;
  if (existing && existing.isBufferGeometry && typeof existing.clone === 'function') return existing;
  const base = mesh.geometry.clone();
  data.xrUvRemapBaseGeometry = base;
  return base;
}
function setUVMode(mode, options) {
  const opts = options || {};
  const canon = canonicalizeUvMode(mode);
  setCanonicalUvMode(canon);
  document.querySelectorAll('.xr-ctl-btn[data-uv]').forEach(b => {
    const on = b.dataset.uv === canon;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) b.removeAttribute('tabindex');
    else b.setAttribute('tabindex', '-1');
  });
  const uvSel = document.getElementById('uvModeSelect');
  if (uvSel) {
    try {
      uvSel.value = canon;
      // fallthrough: if no option value matches canon, force first spherical=sphere matching option (legacy safety)
      if (uvSel.value !== canon) {
        const opts2 = Array.from(uvSel.options || []);
        for (let i = 0; i < opts2.length; i++) {
          if (canonicalizeUvMode(opts2[i].value) === canon) { uvSel.selectedIndex = i; break; }
        }
      }
    } catch(_) {}
  }
  const infoUV = document.getElementById('infoUV');
  if (infoUV) infoUV.textContent = 'UV: ' + getUvModeLabel(canon);
  const cap = document.getElementById('uvPreviewCaption');
  if (cap) cap.textContent = tr('uv_preview_prefix') + ' ' + getUvModeLabel(canon);
  const part = getSelectedPart();
  const currentMesh = getCurrentMesh();
  if (!opts.skipRemap && opts.remapCurrentMesh !== false && currentMesh && currentMesh.geometry) {
    const baseGeo = getUvRemapBaseGeometry(currentMesh);
    const nextGeo = applyUvModeToGeometry(baseGeo ? baseGeo.clone() : currentMesh.geometry, canon);
    if (nextGeo && nextGeo !== currentMesh.geometry) {
      currentMesh.geometry.dispose();
      currentMesh.geometry = nextGeo;
    }
  }
  if (part) applyCustomUvToCurrentMesh(part);
  setCanonicalSelectedIslandId(null);
  renderUvOverlay();
  updateUVPreview();
  updateUvModeHint();
  updateUvTexelDensityUi();
  renderLayerListUI();
  if (opts.applyTexture !== false) requestApplyTexture(true);
}
function toggleWireframe() {
  const runtime = XR?.MaterialRuntime || XR?.__modules?.MaterialRuntime || null;
  const refs = { wireframeOn: getWireframeOn() };
  const result = runtime?.toggleWireframe?.({ refs, document, getShapeList, THREE });
  setWireframeOn(refs.wireframeOn);
  return result;
}

function rebuildAllMaterials() {
  const runtime = XR?.MaterialRuntime || XR?.__modules?.MaterialRuntime || null;
  if (!runtime?.rebuildAllMaterials) {
    console.error('[material] MaterialRuntime rebuild API unavailable');
    return 0;
  }
  return runtime.rebuildAllMaterials({
    getShapeList, getProject: () => project, createMaterial, applyMaterialFlagsForPart, THREE, wireframeOn: getWireframeOn(),
  });
}

function toggleFlatLighting() {
  const runtime = XR?.MaterialRuntime || XR?.__modules?.MaterialRuntime || null;
  const refs = { flatLightingOn: getFlatLightingOn() };
  const result = runtime?.toggleFlatLighting?.({
    refs, document, rebuildAllMaterials, persistViewportSettings,
    onStateChange: (nextRefs) => { setFlatLightingOn(nextRefs.flatLightingOn); },
  });
  setFlatLightingOn(refs.flatLightingOn);
  return result;
}

// ── EXPORT ───────────────────────────────────────────────────
// The ESM Export facade is the sole action authority. The bridge only supplies
// configuration callbacks while the individual exporters own execution.
function runCoreExport(kind) {
  const action = XR?.Export?.[kind] || null;
  if (typeof action !== 'function') throw new Error(`Export.${String(kind)} unavailable after engine bootstrap`);
  return action();
}
function resolveExportPayloadBuilders() {
  return XR?.ExportPayloadBuilders || XR?.__modules?.ExportPayloadBuilders || null;
}
function getUvModeLabel(mode) {
  const m = String(mode || '');
  const key = (m === 'sphere') ? 'uv_mode_spherical' : ('uv_mode_' + m);
  const label = tr(key);
  return (label && label !== key) ? label : m;
}
function canvasToPngDataUrl(canvas) {
  const mod = XR?.ImageIO || XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.canvasToPngDataUrl !== 'function') return null;
  try {
    return mod.canvasToPngDataUrl(canvas, {
      compositeCanvas,
      baseLayerRevision,
      performance,
      warn: (...args) => console.warn(...args),
    });
  } catch (_) { return null; }
}

function getUndoLayerImageRef(layer) {
  const mod = XR?.ImageIO || XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.getUndoLayerImageRef !== 'function') return null;
  try {
    return mod.getUndoLayerImageRef(layer, {
      internUndoAsset,
      internUndoAssetAsync,
      document,
      canvasSize: CANVAS_SIZE,
    });
  } catch (_) { return null; }
}
function getUndoCompositeRef(shape, baseRev) {
  const mod = XR?.ImageIO || XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.getUndoCompositeRef !== 'function') return null;
  try {
    return mod.getUndoCompositeRef(shape, baseRev, {
      internUndoAsset,
      internUndoAssetAsync,
    });
  } catch (_) { return null; }
}
function imageBitmapToPngDataUrlForSave(bitmap) {
  const mod = XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.imageBitmapToPngDataUrlForSave !== 'function') return null;
  try { return mod.imageBitmapToPngDataUrlForSave(bitmap, { canvasSize: CANVAS_SIZE, document }); } catch (_) { return null; }
}
async function loadImageFromDataUrl(dataUrl) {
  const mod = XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.loadImageFromDataUrl !== 'function') return null;
  try { return await mod.loadImageFromDataUrl(dataUrl); } catch (_) { return null; }
}
async function drawDataUrlToCanvas(dataUrl, ctx) {
  const mod = XR?.__modules?.ImageIO || null;
  if (!mod || typeof mod.drawDataUrlToCanvas !== 'function') return false;
  try { return await mod.drawDataUrlToCanvas(dataUrl, ctx, { canvasSize: CANVAS_SIZE }); } catch (_) { return false; }
}

function buildProjectSavePayload() {
  const api = resolveProjectIoApi();
  if (api && typeof api.buildProjectSavePayload === 'function') {
    return api.buildProjectSavePayload();
  }
  throw new Error('buildProjectSavePayload not available');
}

function buildProjectUndoPayload() {
  const api = resolveProjectIoApi();
  if (api && typeof api.buildProjectUndoPayload === 'function') {
    return api.buildProjectUndoPayload();
  }
  throw new Error('buildProjectUndoPayload not available');
}

function saveProjectXreateJson() {
  const api = resolveProjectIoApi();
  if (api && typeof api.saveProjectXreateJson === 'function') {
    return api.saveProjectXreateJson();
  }
  throw new Error('saveProjectXreateJson not available');
}

async function loadProjectFromPayload(payload, opts) {
  const api = resolveProjectIoApi();
  if (api && typeof api.loadProjectFromPayload === 'function') {
    return await api.loadProjectFromPayload(payload, opts);
  }
  throw new Error('loadProjectFromPayload not available');
}
const projectUndoRefs = { projectUndoArmed: false, projectUndoArmTimer: null };

function getUndoMaxSteps() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.getUndoMaxSteps !== 'function') {
    console.error('[undo] Undo module unavailable while resolving history limit');
    return 20;
  }
  try { return mod.getUndoMaxSteps({ getShapeList, partHasAnyVisibleLayerImage }); }
  catch (err) { console.error('[undo] history limit resolution failed', err); return 20; }
}
function pushProjectUndoSnapshot() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.pushProjectUndoSnapshot !== 'function') {
    console.error('[undo] Undo module unavailable while taking snapshot');
    return;
  }
  try {
    return mod.pushProjectUndoSnapshot({
      getProject, project,
      buildProjectUndoPayload, gcUndoAssets, getUndoMaxSteps,
    });
  } catch (err) { console.error('[undo] snapshot failed', err); }
}
function armProjectUndoSnapshot() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.armProjectUndoSnapshot !== 'function') {
    console.error('[undo] Undo module unavailable while arming snapshot');
    return;
  }
  try { mod.armProjectUndoSnapshot({ refs: projectUndoRefs, pushProjectUndoSnapshot }); }
  catch (err) { console.error('[undo] snapshot arming failed', err); }
}
function beginDiscreteUndo() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.beginDiscreteUndo !== 'function') {
    console.error('[undo] Undo module unavailable while starting discrete command');
    return;
  }
  try { mod.beginDiscreteUndo({ refs: projectUndoRefs }); }
  catch (err) { console.error('[undo] discrete boundary setup failed', err); }
}
function mutateProject(fn) {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.mutateProject !== 'function') return;
  try {
    return mod.mutateProject({
      getProject,
      project,
      fn,
      armProjectUndoSnapshot,
    });
  } catch (_) {}
}
async function undoProject() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.undoProject !== 'function') return;
  try {
    return await mod.undoProject({
      getProject,
      project,
      buildProjectUndoPayload,
      loadProjectFromPayload,
      gcUndoAssets,
      setStatusKey,
      setStatus,
      getUndoMaxSteps,
    });
  } catch (_) {}
}
async function redoProject() {
  const mod = XR?.Undo || XR?.__modules?.Undo || null;
  if (!mod || typeof mod.redoProject !== 'function') return;
  try {
    return await mod.redoProject({
      getProject,
      project,
      buildProjectUndoPayload,
      loadProjectFromPayload,
      gcUndoAssets,
      setStatusKey,
      setStatus,
      getUndoMaxSteps,
    });
  } catch (_) {}
}

let shellCanvasSizingRetryAttached = false;
function scaleDrawCanvas() {
  const mod = XR?.CanvasSizing || XR?.__modules?.ShellCanvasSizing || null;
  if (typeof mod?.scaleDrawCanvas !== 'function') {
    if (!shellCanvasSizingRetryAttached) {
      shellCanvasSizingRetryAttached = true;
      window.addEventListener('xreate:shell-modules-ready', () => {
        shellCanvasSizingRetryAttached = false;
        scaleDrawCanvas();
      }, { once: true });
    }
    console.warn('[canvas-sizing] deferred until ShellCanvasSizing is ready');
    return false;
  }
  try { return mod.scaleDrawCanvas({ wrapId: 'drawWrap', baseCanvas, uvCanvas }); }
  catch (err) { console.error('[canvas-sizing] draw canvas resize failed', err); return false; }
}
    const shellAddShapeMenuModule = XR?.__modules?.ShellAddShapeMenu || null;
    if (!addShapeMenuApi && shellAddShapeMenuModule && typeof shellAddShapeMenuModule.create === 'function') {
      try {
        addShapeMenuApi = shellAddShapeMenuModule.create({
          archetypes: ARCHETYPES,
          drawIcon,
          tr,
          setCurrentArchetype: (arch) => { currentArchetype = arch; },
          addPartFromArchetype,
          openDoodleModal,
        });
      } catch (_) {}
    }
    try {
      XR?.SceneCommands?.configure?.({
        shapeFactory: XR?.ShapeFactory || XR?.__modules?.ShapeFactory || null,
        sceneGraphWiring: XR?.SceneGraphWiring || XR?.__modules?.SceneGraphWiring || null,
        projectState: XR?.ProjectState || XR?.__modules?.ProjectState || null,
        getShapeList,
        mutateProject,
        getArchetypeById,
        THREE,
        ensureLayersOnPart,
        newLayerId,
        imageBitmapToPngDataUrlForSave,
        setSelectedPart,
        setStatusKey,
        newPartId,
        getDefaultUvModeForArchetypeId,
        getDefaultParamsForArchetypeId,
        applyUvModeToGeometry,
        createDoodlePart: XR?.DoodleController?.createDoodlePart || XR?.__modules?.DoodleController?.createDoodlePart || null,
        buildDoodleRevolveFromPoints,
        buildDoodleMirrorFromPoints,
        buildDoodleFromPoints,
        createOffscreenCanvas,
        CANVAS_SIZE,
        editorBg,
        createMaterial,
        assemblyRoot,
        applyMaterialFlagsForPart,
        assertLayerOwnership: (shapes) => XR?.ProjectState?.assertLayerOwnership?.(shapes) || { ok: true },
        renderTreeUI,
        updatePartControlsFromSelected: () => callShellInspectorPanels('updatePartControlsFromSelected'),
        updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
        updateMaterialControlsFromSelected,
        updateGizmo,
        showToast: _inlineShowToastRealImpl,
        tr,
        undoProject,
        disposePart,
        clearAssembly,
        getSelectedId: () => ((project && project.selectedId) ? project.selectedId : null),
        getProject,
        beginDiscreteUndo,
      });
    } catch (_) {}
    try {
      XR?.Shapes?.configure?.({
        projectState: XR?.ProjectState || XR?.__modules?.ProjectState || null,
        selection: XR?.Selection || XR?.__modules?.Selection || null,
        shapeFactory: XR?.ShapeFactory || XR?.__modules?.ShapeFactory || null,
        shapesRuntime: XR?.ShapesRuntime || XR?.__modules?.ShapesRuntime || null,
        sceneCommands: XR?.SceneCommands || XR?.__modules?.SceneCommands || null,
        shapeDefs: XR?.ShapeDefs || XR?.__modules?.ShapeDefs || null,
        addDoodleShapeToScene,
        project,
        getShapeList,
        setSelectedPart,
        getSelectedPart,
        getArchetypeById,
        clearAssembly,
        getDefaultSpawnPosition,
        mutateProject,
        shapeFactoryRefs: { uvMode: getUvMode() },
        resizeRenderer,
        openDoodleModal,
        showToast: _inlineShowToastRealImpl,
        tr,
        setStatusKey,
        getSelectedId: () => ((project && project.selectedId) ? project.selectedId : null),
        getProject,
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
        applyMaterialStateToMesh,
        ensureTransformState,
        setUVMode,
        updateInfoForMesh,
        renderUvOverlay,
        drawBaseLayer,
        requestApplyTexture,
        renderTreeUI,
        renderShapeParamsUI,
        updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      });
    } catch (_) {}
    projectControllerConfig = {
      getProject,
      tr,
      isMobilePreviewDevice,
      setMobilePreviewMode,
    };
    shellScenePanelsConfig = {
      onWithSignal,
      getShapeList,
      getSelectedId: () => ((project && project.selectedId) ? project.selectedId : null),
      updateTextureImportAvailability,
      getGeoStats,
      updateMobilePreviewAvailability,
      updateExportAvailability,
      setSelectedPart,
      getArchetypeById,
      drawIcon,
      armProjectUndoSnapshot,
      updatePartControlsFromSelected: () => callShellInspectorPanels('updatePartControlsFromSelected'),
      tr,
      getSelectedPart,
      renamePart: (partId, name) => { try { return XR?.SceneCommands?.renamePart?.(partId, name); } catch (_) { return null; } },
      setPartVisibility: (partId, visible) => { try { return XR?.SceneCommands?.setPartVisibility?.(partId, visible); } catch (_) { return null; } },
      togglePartLocked: (partId) => { try { return XR?.SceneCommands?.togglePartLocked?.(partId); } catch (_) { return null; } },
      duplicatePart: (partId) => { try { XR?.SceneCommands?.duplicatePart?.(partId); } catch (_) {} },
      movePartInTree: (partId, delta) => { try { XR?.SceneCommands?.movePartInTree?.(partId, delta); } catch (_) {} },
      deletePart: (partId) => { try { XR?.SceneCommands?.deletePart?.(partId); } catch (_) {} },
    };
    const projectIoConfigFactory = XR?.ProjectIoConfig?.create || XR?.__modules?.ProjectIoConfig?.create || null;
    if (typeof projectIoConfigFactory !== 'function') {
      throw new Error('ProjectIoConfig unavailable after engine bootstrap');
    }
    projectIoConfig = projectIoConfigFactory({
      CANVAS_SIZE,
      THREE,
      projectState: XR?.ProjectState || null,
      projectStore: XR?.ProjectStore || null,
      autosaveManager: XR?.Autosave?.manager || null,
      getProject: () => {
        const f = XR?.ProjectState?.getProject || null;
        if (!f) throw new Error('[project-state] getProject unavailable for ProjectIO');
        return f();
      },
      getShapeList,
      setShapeList: (shapes, opts) => {
        const f = XR?.ProjectState?.setShapeList || null;
        if (!f) throw new Error('[project-state] setShapeList unavailable for ProjectIO');
        return f(shapes, opts);
      },
      setSelectedId: (id, opts) => {
        const f = XR?.ProjectState?.setSelectedId || null;
        if (!f) throw new Error('[project-state] setSelectedId unavailable for ProjectIO');
        return f(id, opts);
      },
      syncVisibleToSelectedPart,
      uuid: () => XR.Storage.uuid(),
      imageBitmapToPngDataUrlForSave,
      canvasToPngDataUrl,
      getDefaultUvModeForArchetypeId,
      getUndoLayerImageRef,
      getUndoCompositeRef,
      getBaseLayerRevision: () => baseLayerRevision,
      sanitizeFilenameBase,
      download: _inlineDownloadRealImpl,
      setStatusKey,
      setStatus,
      showModal: (title, msg) => {
        try {
          const f = XR?.showModal || XR?.__modules?.ShellExportModal?.showModal || null;
          if (typeof f === 'function') f(title, msg);
        } catch (_) {}
      },
      tr,
      clearAssembly,
      updateProjectNameUi,
      resetProjectUndoArm: () => {
        projectUndoRefs.projectUndoArmed = false;
        if (projectUndoRefs.projectUndoArmTimer) {
          clearTimeout(projectUndoRefs.projectUndoArmTimer);
          projectUndoRefs.projectUndoArmTimer = null;
        }
      },
      getEditorBg: () => editorBg,
      createOffscreenCanvas,
      newPartId,
      newLayerId,
      createMaterial,
      getAssemblyRoot: () => assemblyRoot,
      getArchetypeById,
      createPartFromArchetype,
      buildDoodleRevolveFromPoints,
      buildDoodleMirrorFromPoints,
      buildDoodleFromPoints,
      applyUvModeToGeometry,
      applyMaterialStateToMesh,
      applyCustomUvToGeometry,
      resolveUndoAssetAsync,
      loadImageFromDataUrl,
      drawDataUrlToCanvas,
      ensureSrgbTexture,
      setSelectedPart,
      updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      renderShapeParamsUI,
      gcUndoAssets,
      applyUvCheckerToAllShapes,
      drawBaseLayer,
      renderUvOverlay,
      requestApplyTexture,
    });
    shellInspectorPanelsConfig = {
      tr,
      getSelectedPart,
      ensureTransformState,
    };
    shellShapeParamsConfig = {
      onWithSignal,
      getSelectedPart,
      getArchetypeById,
      drawIcon,
      tr,
      armProjectUndoSnapshot,
      applyMaterialStateToMesh,
      buildDoodleRevolveFromPoints,
      buildDoodleMirrorFromPoints,
      buildDoodleFromPoints,
      applyUvModeToGeometry,
      updateInfoForMesh,
      renderUvOverlay,
      requestApplyTexture,
      markViewportDirty: (frames) => XR?.__modules?.ViewportRuntime?.markDirty?.(frames),
      getDefaultParamsForArchetypeId,
      getArchetypeCategoryById,
      getShapeScaleFactors,
      applyTransformToMesh,
      rebuildSelectedPartGeometry,
      markProjectModified: () => {
        if (project && project.meta) project.meta.modified = Date.now();
      },
    };
    shellSurfaceEditorConfig = {
      onWithSignal,
      getSelectedPart,
      ensureLayersOnPart,
      getActiveLayer,
      getActiveLayerIndex: () => {
        const part = getSelectedPart();
        if (part) ensureLayersOnPart(part);
        const layers = part?.layers || [];
        const index = Number(part?.activeLayerIndex);
        return layers.length ? Math.max(0, Math.min(Number.isFinite(index) ? index : 0, layers.length - 1)) : 0;
      },
      setActiveLayer,
      getImageTransform: () => getActiveLayer()?.transform || readTextureLayerRefs().imageTransform,
      updateImageTransform: updateActiveLayerTransform,
      toggleLayerVisibility,
      renameLayer,
      layerHasPolygonMask,
      toggleLayerPolygonMask,
      duplicateLayer,
      moveLayer,
      deleteLayer,
      commitActiveLayerTransform,
      drawBaseLayer,
      requestApplyTexture,
      isRatioAllowedForPart,
      canImportImagesNow,
      tr,
      fillImageToCanvas,
      loadImageFromFile,
    };
    shellMaskEditorConfig = {
      CANVAS_SIZE,
      getEditorBg: () => editorBg,
      getSelectedPart,
      ensureLayersOnPart,
      getIslandsForUvMode,
      getSelectedIslandId,
      drawLayerBitmapToCtx,
      openModal: (el, opts) => {
        try {
          const f = XR?.openModal || XR?.__modules?.ShellModal?.openModal || null;
          if (typeof f === 'function') return f(el, opts);
        } catch (_) {}
        return null;
      },
      closeModal: (state) => {
        try {
          const f = XR?.closeModal || XR?.__modules?.ShellModal?.closeModal || null;
          if (typeof f === 'function') return f(state);
        } catch (_) {}
        return null;
      },
      mutateProject,
      drawBaseLayer,
      renderUvOverlay,
      requestApplyTexture,
      renderLayerListUI,
    };
    shellProjectUiConfig = {
      bgColors: BG_COLORS,
      getProject: () => {
        try {
          const f = XR?.ProjectState?.getProject || null;
          if (f) return f();
        } catch (_) {}
        return project;
      },
      armProjectUndoSnapshot,
      setProjectName: (name) => XR?.ProjectStore?.dispatch?.({ type: 'project/name-set', name, project }),
      updateProjectNameUi,
      tr,
      setSceneBackground: (color) => {
        const mod = XR?.__modules?.SceneSetup || null;
        if (mod && typeof mod.setSceneBackground === 'function') {
          try {
            const handled = mod.setSceneBackground({
              THREE,
              color,
              refs: { scene, renderer },
            });
            if (handled) return handled;
          } catch (_) {}
        }
        try {
          scene.background = new THREE.Color(color);
          renderer.setClearColor(new THREE.Color(color), 1);
        } catch (_) {}
        return null;
      },
    };
    shellUvUiConfig = {
      tr,
      getShapeList,
      getSelectedPart,
      getUvMode,
      getUvStretchOn: () => uvStretchOn,
      updateComposite,
      getCompositeCanvas: () => compositeCanvas,
      getCanvasSize: () => CANVAS_SIZE,
      getUvLayout: () => UV_LAYOUT,
      getPrimaryIsland: uvModePrimaryIsland,
    };
    shellViewportControlsConfig = {
      tr,
      setGizmoMode,
      getGizmoMode: () => viewportInteractionRefs.gizmoMode,
      setMobilePreviewMode,
      showToast: _inlineShowToastRealImpl,
      fitViewportView,
      setViewportView,
      updateViewportViewButtons,
      setUVMode,
      setUvStretch,
      getUvStretchOn: () => uvStretchOn,
      scaleDrawCanvas,
      applyUvChecker,
      openUvCompareModal: () => {
        try { XR?.__modules?.ShellEditorModals?.openUvCompareModal?.(); } catch (_) {}
      },
    };
    if (typeof buildAddShapeMenu === "function") buildAddShapeMenu();
    if (typeof buildBGRow === "function") buildBGRow();
    if (typeof renderTreeUI === "function") renderTreeUI();
    if (typeof scaleDrawCanvas === "function") scaleDrawCanvas();
    if (typeof updateUVPreview === "function") updateUVPreview();
    const bindInspectorAccordion = (root, key) => {
      const api = resolveShellScenePanelsApi();
      if (api && typeof api.bindInspectorAccordion === 'function') {
        try { return api.bindInspectorAccordion(root); } catch (_) {}
      }
      scheduleDeferredShellCall(key, () => {
        const nextApi = resolveShellScenePanelsApi();
        if (nextApi && typeof nextApi.bindInspectorAccordion === 'function') {
          try { nextApi.bindInspectorAccordion(root); } catch (_) {}
          return true;
        }
        return false;
      }, { delayMs: 25, maxAttempts: 20 });
    };
    bindInspectorAccordion(document.getElementById("inspectorSections"), 'shell-scene-panels:bindInspectorAccordion:inspector');
    bindInspectorAccordion(document.getElementById("surfaceSections"), 'shell-scene-panels:bindInspectorAccordion:surface');
    const bindUvHelpersAndScaleState = () => {
      const api = resolveShellScenePanelsApi();
      if (api && typeof api.bindUVHelpAndScaleStateLabel === 'function') {
        try { return api.bindUVHelpAndScaleStateLabel(); } catch (_) {}
      }
      scheduleDeferredShellCall('shell-scene-panels:bindUVHelpAndScaleStateLabel', () => {
        const nextApi = resolveShellScenePanelsApi();
        if (nextApi && typeof nextApi.bindUVHelpAndScaleStateLabel === 'function') {
          try { nextApi.bindUVHelpAndScaleStateLabel(); return true; } catch (_) {}
        }
        return false;
      }, { delayMs: 50, maxAttempts: 20 });
    };
    bindUvHelpersAndScaleState();
    const btnGlb = document.getElementById("btn-export-glb");
    const btnUsdz = document.getElementById("btn-export-usdz");
    const btnExportAtlas = document.getElementById("btn-export-atlas");
    const btnExportTrigger = document.getElementById("btn-export-trigger");
    const exportDropdown = document.getElementById("xr-export-dropdown");
    const exportGroup = btnExportTrigger ? btnExportTrigger.closest(".xr-export-group") : null;
    const exportClose = document.getElementById("exportModalClose");
    const exportCheckerWarning = () => {
      try {
        if (isUvCheckerApplied()) {
          showToast(tr('toast_checker_warning'), 'warning', {
            durationMs: 8000,
            actions: [{ label: tr('toast_remove_checker'), onClick: () => { try { removeUvCheckerFromAllShapes(); } catch (_) {} } }]
          });
        }
      } catch (_) {}
    };
    const exportConfiguration = XR?.ExportConfiguration || XR?.__modules?.ExportConfiguration || null;
    if (typeof exportConfiguration?.createExportConfigurations !== 'function') {
      throw new Error('ExportConfiguration unavailable after engine bootstrap');
    }
    legacyExportConfigs = exportConfiguration.createExportConfigurations({
      getShapeList,
      THREE,
      tr,
      showToast: _inlineShowToastRealImpl,
      onCheckerWarning: exportCheckerWarning,
      getAssemblyRoot: () => assemblyRoot,
      syncVisibleToSelectedPart,
      applyTexture,
      getProject: () => project,
      updateComposite,
      getCompositeCanvas: () => compositeCanvas,
      partHasAnyVisibleLayerImage,
      packTexturesToAtlas: (...args) => {
        const packer = XR?.Export?.packTexturesToAtlas || null;
        if (typeof packer !== 'function') throw new Error('Export.packTexturesToAtlas unavailable after engine bootstrap');
        return packer(...args);
      },
      download: _inlineDownloadRealImpl,
      showModal,
      getPayloadBuilders: resolveExportPayloadBuilders,
    });
    const exportApi = XR?.Export || null;
    if (typeof exportApi?.configureGLB !== 'function'
      || typeof exportApi.configureUSDZ !== 'function'
      || typeof exportApi.configureTextureAtlas !== 'function') {
      throw new Error('Export facade unavailable after engine bootstrap');
    }
    try { exportApi.configureGLB(legacyExportConfigs.glb); }
    catch (err) { console.error('[export] GLB configuration failed', err); throw err; }
    try { exportApi.configureUSDZ(legacyExportConfigs.usdz); }
    catch (err) { console.error('[export] USDZ configuration failed', err); throw err; }
    try { exportApi.configureTextureAtlas(legacyExportConfigs.atlas); }
    catch (err) { console.error('[export] atlas configuration failed', err); throw err; }
    const shellMenuModule = XR?.__modules?.ShellMenuWiring || null;
    let shellMenuApi = null;
    if (shellMenuModule && typeof shellMenuModule.create === 'function') {
      try {
        shellMenuApi = shellMenuModule.create({
          openAddShapeMenu,
          closeAddShapeMenu,
          toggleAddShapeMenu,
          openAutosaveModal: async () => {
            try { await XR?.Autosave?.openModal?.(); } catch (_) {}
          },
          closeExportModal: () => {
            try {
              const f = XR?.closeExportModal || XR?.__modules?.ShellExportModal?.closeExportModal || null;
              if (typeof f === 'function') f();
            } catch (_) {}
          },
          exportGLB: () => runCoreExport('glb'),
          exportUSDZ: () => runCoreExport('usdz'),
          exportTextureAtlas,
          openModal: XR?.openModal,
          closeModal: XR?.closeModal,
        });
        try { shellMenuApi.bind?.(); } catch (_) {}
      } catch (_) {}
    }
    if (!shellMenuApi) {
      scheduleDeferredShellCall('shell-menu-wiring:bind', () => {
        const nextModule = XR?.__modules?.ShellMenuWiring || null;
        if (!nextModule || typeof nextModule.create !== 'function') return false;
        try {
          shellMenuApi = nextModule.create({
            openAddShapeMenu,
            closeAddShapeMenu,
            toggleAddShapeMenu,
            openAutosaveModal: async () => {
              try { await XR?.Autosave?.openModal?.(); } catch (_) {}
            },
            closeExportModal: () => {
              try {
                const f = XR?.closeExportModal || XR?.__modules?.ShellExportModal?.closeExportModal || null;
                if (typeof f === 'function') f();
              } catch (_) {}
            },
            exportGLB: () => runCoreExport('glb'),
            exportUSDZ: () => runCoreExport('usdz'),
            exportTextureAtlas,
            openModal: XR?.openModal,
            closeModal: XR?.closeModal,
          });
          shellMenuApi.bind?.();
          return true;
        } catch (_) {
          return false;
        }
      }, { delayMs: 25, maxAttempts: 40 });
    }
    const btnWire = document.getElementById("btn-wireframe");
    const btnFlat = document.getElementById("btn-flatlight");
    const btnAddShape = document.getElementById("btn-add-shape");
    const btnAddPart = document.getElementById("btn-add-part");
    const btnDupPart = document.getElementById("btn-dup-part");
    const btnDelPart = document.getElementById("btn-del-part");
    const btnSelectPart = document.getElementById("btn-toggle-select-part");
    const btnTexMode = document.getElementById("btn-toggle-tex-mode");
    const shapePosX = document.getElementById("shapePosX");
    const shapePosY = document.getElementById("shapePosY");
    const shapePosZ = document.getElementById("shapePosZ");
    const shapeRotX = document.getElementById("shapeRotX");
    const shapeRotY = document.getElementById("shapeRotY");
    const shapeRotZ = document.getElementById("shapeRotZ");
    const shapeScaleX = document.getElementById("shapeScaleX");
    const shapeScaleY = document.getElementById("shapeScaleY");
    const shapeScaleZ = document.getElementById("shapeScaleZ");
    const partName = document.getElementById("partName");
    const partScale = document.getElementById("partScale");
    const partPosX = document.getElementById("partPosX");
    const partPosY = document.getElementById("partPosY");
    const partPosZ = document.getElementById("partPosZ");
    const partRotY = document.getElementById("partRotY");
    if (btnWire) btnWire.setAttribute('aria-pressed', getWireframeOn() ? 'true' : 'false');
    if (btnFlat) btnFlat.setAttribute('aria-pressed', getFlatLightingOn() ? 'true' : 'false');

    try { resolveShellViewportControlsApi()?.bind?.(); } catch (_) {}
    try { updateMobilePreviewAvailability(getShapeList().length | 0); } catch (_) {}

    {
      const api = resolveShellScenePanelsApi();
      if (api && typeof api.bindSceneDrawer === 'function') {
        try { api.bindSceneDrawer(); } catch (_) {}
      } else {
        scheduleDeferredShellCall('shell-scene-panels:bindSceneDrawer', () => {
          const nextApi = resolveShellScenePanelsApi();
          if (nextApi && typeof nextApi.bindSceneDrawer === 'function') {
            try { nextApi.bindSceneDrawer(); } catch (_) {}
            return true;
          }
          return false;
        }, { delayMs: 25, maxAttempts: 20 });
      }
    }
    const loadViewportSettings = () => {
      const s = readViewportSettings();
      if (!s) return;
      const mod = XR?.__modules?.SceneSetup || null;
      if (mod && typeof mod.applyViewportSettings === 'function') {
        try {
          const refs = { flatLightingOn: getFlatLightingOn(), spherical, orbitTarget, camera, orthoCamera, orthoZoom, viewportView };
          const handled = mod.applyViewportSettings({
            settings: s,
            refs,
            clampSnap,
            setActiveCamera,
            sphericalToXYZ,
          });
          setFlatLightingOn(refs.flatLightingOn);
          orthoZoom = refs.orthoZoom;
          viewportView = refs.viewportView;
          if (handled && handled.appliedFlatLighting) {
            const btn = document.getElementById('btn-flatlight');
            if (btn) btn.setAttribute('aria-pressed', getFlatLightingOn() ? 'true' : 'false');
            if (btn) btn.classList.toggle('is-active', getFlatLightingOn());
            if (btn) { try { btn.removeAttribute('data-i18n'); } catch (_) {} }
            if (btn) {
              const label = btn.querySelector('.xr-ctl-btn__label');
              if (label) label.textContent = tr('hud_flatlight');
              else btn.textContent = tr('hud_flatlight');
            }
          }
          if (handled && handled.persistRecommended) {
            try { persistViewportSettings(); } catch (_) {}
          }
          if (handled) return;
        } catch (_) {}
      }
      if (typeof s.flatLightingOn === 'boolean') {
        setFlatLightingOn(s.flatLightingOn);
        const btn = document.getElementById('btn-flatlight');
        if (btn) btn.setAttribute('aria-pressed', getFlatLightingOn() ? 'true' : 'false');
        if (btn) btn.classList.toggle('is-active', getFlatLightingOn());
        if (btn) { try { btn.removeAttribute('data-i18n'); } catch (_) {} }
        if (btn) {
          const label = btn.querySelector('.xr-ctl-btn__label');
          if (label) label.textContent = tr('hud_flatlight');
          else btn.textContent = tr('hud_flatlight');
        }
      }
      if (s.spherical && typeof s.spherical === 'object') {
        const th = Number(s.spherical.theta);
        const ph = Number(s.spherical.phi);
        const ra = Number(s.spherical.radius);
        if (isFinite(th)) spherical.theta = th;
        if (isFinite(ph)) spherical.phi = ph;
        if (isFinite(ra)) spherical.radius = ra;
      }
      if (s.target && typeof s.target === 'object') {
        const tx = Number(s.target.x);
        const ty = Number(s.target.y);
        const tz = Number(s.target.z);
        if (isFinite(tx) && isFinite(ty) && isFinite(tz)) orbitTarget.set(tx, ty, tz);
      }
      const storedView = (typeof s.view === 'string') ? s.view : null;
      const storedZoom = (typeof s.orthoZoom === 'number' && isFinite(s.orthoZoom)) ? s.orthoZoom : null;
      if (storedView) {
        viewportView = storedView;
        if (storedView === 'free') {
          setActiveCamera('perspective');
        } else {
          setActiveCamera('ortho');
          const eps = 0.001;
          if (storedView === 'front') { spherical.theta = 0; spherical.phi = Math.PI / 2; }
          else if (storedView === 'back') { spherical.theta = Math.PI; spherical.phi = Math.PI / 2; }
          else if (storedView === 'right') { spherical.theta = Math.PI / 2; spherical.phi = Math.PI / 2; }
          else if (storedView === 'left') { spherical.theta = -Math.PI / 2; spherical.phi = Math.PI / 2; }
          else if (storedView === 'top') { spherical.theta = 0; spherical.phi = eps; }
          else if (storedView === 'bottom') { spherical.theta = 0; spherical.phi = Math.PI - eps; }
          else if (storedView === 'iso') { spherical.theta = Math.PI / 4; spherical.phi = Math.acos(1 / Math.sqrt(3)); }
          orthoZoom = (storedZoom !== null)
            ? clampSnap(storedZoom, 0.3, 3.0, 0)
            : 1.0;
          orthoCamera.zoom = orthoZoom;
          orthoCamera.updateProjectionMatrix();
        }
        sphericalToXYZ();
        try { persistViewportSettings(); } catch (_) {}
      }
    };

    if (!shellMenuApi && btnExportTrigger && exportDropdown && !btnExportTrigger.dataset.bound) {
      btnExportTrigger.dataset.bound = "1";
      btnExportTrigger.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = !exportDropdown.hidden;
        exportDropdown.hidden = isOpen;
        btnExportTrigger.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });

      document.addEventListener("click", (e) => {
        if (!exportGroup || !exportDropdown || exportDropdown.hidden) return;
        const t = e.target;
        if (t && exportGroup.contains(t)) return;
        exportDropdown.hidden = true;
        btnExportTrigger.setAttribute("aria-expanded", "false");
      }, true);
    }

    loadViewportSettings();

    try { resolveShellViewportControlsApi()?.bind?.(); } catch (_) {}

    updateProjectNameUi();
    try { resolveShellProjectUiApi()?.bindProjectNameEditor?.(); } catch (_) {}

    for (const el of [shapePosX, shapePosY, shapePosZ, shapeRotX, shapeRotY, shapeRotZ]) {
      if (!el) continue;
      el.addEventListener('input', () => applyShapeTransformControlsToSelected());
    }
    if (shapeScaleX) shapeScaleX.addEventListener('input', () => applyShapeTransformControlsToSelected('shapeScaleX'));
    if (shapeScaleY) shapeScaleY.addEventListener('input', () => applyShapeTransformControlsToSelected('shapeScaleY'));
    if (shapeScaleZ) shapeScaleZ.addEventListener('input', () => applyShapeTransformControlsToSelected('shapeScaleZ'));
    const btnResetPos = document.getElementById('btn-tr-reset-pos');
    const btnResetRot = document.getElementById('btn-tr-reset-rot');
    const btnResetScale = document.getElementById('btn-tr-reset-scale');
    if (btnResetPos) btnResetPos.addEventListener('click', () => mutateSelectedPartTransform((p, t) => { t.position = { x: 0, y: 0, z: 0 }; }));
    if (btnResetRot) btnResetRot.addEventListener('click', () => mutateSelectedPartTransform((p, t) => { t.rotation = { x: 0, y: 0, z: 0 }; }));
    if (btnResetScale) btnResetScale.addEventListener('click', () => mutateSelectedPartTransform((p, t) => { t.scale = { x: 1, y: 1, z: 1 }; }));
    const btnUniform = document.getElementById('btn-scale-uniform');
    if (btnUniform) {
      btnUniform.classList.toggle('is-active', uniformScaleLock);
      btnUniform.setAttribute('aria-pressed', uniformScaleLock ? 'true' : 'false');
      btnUniform.addEventListener('click', () => {
        uniformScaleLock = !uniformScaleLock;
        btnUniform.classList.toggle('is-active', uniformScaleLock);
        btnUniform.setAttribute('aria-pressed', uniformScaleLock ? 'true' : 'false');
        btnUniform.setAttribute('data-i18n-title', uniformScaleLock ? 'tr_uniform_scale_title' : 'tr_uniform_scale_title_off');
        btnUniform.setAttribute('title', tr(uniformScaleLock ? 'tr_uniform_scale_title' : 'tr_uniform_scale_title_off'));
        if (uniformScaleLock && shapeScaleX) {
          try {
            if (shapeScaleY) shapeScaleY.value = String(shapeScaleX.value);
            if (shapeScaleZ) shapeScaleZ.value = String(shapeScaleX.value);
          } catch (_) {}
          applyShapeTransformControlsToSelected('shapeScaleX');
        }
      });
    }
    const bindInlineNumberEditor = (valId, sliderId, kind) => {
      const span = document.getElementById(valId);
      const slider = document.getElementById(sliderId);
      if (!span || !slider) return;
      if (span.dataset && span.dataset.bound) return;
      if (span.dataset) span.dataset.bound = '1';

      const readInitial = () => {
        if (kind === 'pos') return String((parseInt(slider.value, 10) / 100).toFixed(2));
        if (kind === 'scale') return String((parseInt(slider.value, 10) / 100).toFixed(2));
        return String(parseInt(slider.value, 10));
      };

      const commit = (raw) => {
        const cleaned = String(raw).trim().replace(/[^\d\.\-]+/g, '');
        let v = parseFloat(cleaned);
        if (!Number.isFinite(v)) return false;
        if (kind === 'pos') v = Math.max(-2.0, Math.min(2.0, v));
        if (kind === 'rot') v = Math.max(-180, Math.min(180, v));
        if (kind === 'scale') v = Math.max(0.01, Math.min(3.0, v));
        if (kind === 'pos') slider.value = String(Math.round(v * 100));
        else if (kind === 'scale') slider.value = String(Math.round(v * 100));
        else slider.value = String(Math.round(v));
        applyShapeTransformControlsToSelected(kind === 'scale' ? sliderId : null);
        return true;
      };

      const begin = () => {
        const current = span.textContent || '';
        if (current === '—') return;
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'xr-inline-number-input';
        if (kind === 'pos' || kind === 'scale') input.step = '0.01';
        if (kind === 'rot') input.step = '1';
        input.value = readInitial();
        const parent = span.parentElement;
        if (!parent) return;
        parent.replaceChild(input, span);
        input.focus();
        input.select();
        let finished = false;
        let onKeyDown = null;
        let onBlur = null;
        const finish = (save) => {
          if (finished) return;
          finished = true;
          try { if (onKeyDown) input.removeEventListener('keydown', onKeyDown); } catch (_) {}
          try { if (onBlur) input.removeEventListener('blur', onBlur); } catch (_) {}
          const did = save ? commit(input.value) : false;
          try { if (input.parentElement === parent) parent.replaceChild(span, input); } catch (_) {}
          if (did) callShellInspectorPanels('updateShapeTransformControlsFromSelected');
          span.focus();
        };
        onKeyDown = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        };
        onBlur = () => finish(true);
        input.addEventListener('keydown', onKeyDown);
        input.addEventListener('blur', onBlur);
      };

      let fromPointer = false;
      span.addEventListener('pointerdown', () => { fromPointer = true; });
      span.addEventListener('click', begin);
      span.addEventListener('focus', () => {
        if (fromPointer) { fromPointer = false; return; }
        begin();
      });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); }
      });
    };

    bindInlineNumberEditor('shapePosXVal', 'shapePosX', 'pos');
    bindInlineNumberEditor('shapePosYVal', 'shapePosY', 'pos');
    bindInlineNumberEditor('shapePosZVal', 'shapePosZ', 'pos');
    bindInlineNumberEditor('shapeRotXVal', 'shapeRotX', 'rot');
    bindInlineNumberEditor('shapeRotYVal', 'shapeRotY', 'rot');
    bindInlineNumberEditor('shapeRotZVal', 'shapeRotZ', 'rot');
    bindInlineNumberEditor('shapeScaleXVal', 'shapeScaleX', 'scale');
    bindInlineNumberEditor('shapeScaleYVal', 'shapeScaleY', 'scale');
    bindInlineNumberEditor('shapeScaleZVal', 'shapeScaleZ', 'scale');

    {
      const api = resolveShellSurfaceEditorApi();
      if (api && typeof api.bindControls === 'function') {
        try { api.bindControls(); } catch (_) {}
      } else {
        scheduleDeferredShellCall('shell-surface-editor:bindControls', () => {
          const nextApi = resolveShellSurfaceEditorApi();
          if (nextApi && typeof nextApi.bindControls === 'function') {
            try { nextApi.bindControls(); } catch (_) {}
            return true;
          }
          return false;
        }, { delayMs: 25, maxAttempts: 20 });
      }
    }
    if (!shellMenuApi) {
      const closeExportDropdown = () => {
        if (!exportDropdown || exportDropdown.hidden) return;
        exportDropdown.hidden = true;
        btnExportTrigger?.setAttribute("aria-expanded", "false");
      };
      if (btnGlb) btnGlb.addEventListener("click", () => {
        closeExportDropdown();
        runCoreExport('glb');
      });
      if (btnUsdz) btnUsdz.addEventListener("click", () => {
        closeExportDropdown();
        runCoreExport('usdz');
      });
      if (btnExportAtlas) btnExportAtlas.addEventListener("click", () => {
        closeExportDropdown();
        const atlas = (XR && XR.__modules && typeof XR.__modules.exportTextureAtlas === 'function') ? XR.__modules.exportTextureAtlas : exportTextureAtlas;
        atlas();
      });
      if (exportClose) exportClose.addEventListener("click", () => {
        try { XR?.closeExportModal?.(); } catch (_) {}
      });
    }
    if (btnWire) btnWire.addEventListener("click", () => toggleWireframe());
    if (btnFlat) btnFlat.addEventListener("click", () => toggleFlatLighting());
    if (!resolveShellSurfaceEditorApi()) {
      scheduleDeferredShellCall('shell-surface-editor:legacy-buttons', () => {
        const nextApi = resolveShellSurfaceEditorApi();
        if (nextApi && typeof nextApi.bindControls === 'function') {
          try { nextApi.bindControls(); } catch (_) {}
          return true;
        }
        return false;
      }, { delayMs: 25, maxAttempts: 20 });
    }

    callShellMaskEditor('bindControls');
    if (!resolveShellSurfaceEditorApi()) {
      scheduleDeferredShellCall('shell-surface-editor:legacy-transform-bindings', () => {
        const nextApi = resolveShellSurfaceEditorApi();
        if (nextApi && typeof nextApi.bindControls === 'function') {
          try { nextApi.bindControls(); } catch (_) {}
          return true;
        }
        return false;
      }, { delayMs: 25, maxAttempts: 20 });
    }

    updateTransformUi();
    updateUvStretchUi();
    updateUvModeHint();
    updateUvTexelDensityUi();
    renderLayerListUI();
    renderTreeUI();
    callShellInspectorPanels('updateShapeTransformControlsFromSelected');
    try {
      const api = resolveShellScenePanelsApi();
      api?.scheduleInspectorScrollState?.();
    } catch (_) {}

    {
      const api = resolveShellScenePanelsApi();
      if (api && typeof api.bindTreeControls === 'function') {
        try { api.bindTreeControls(); } catch (_) {}
      } else {
        scheduleDeferredShellCall('shell-scene-panels:bindTreeControls', () => {
          const nextApi = resolveShellScenePanelsApi();
          if (nextApi && typeof nextApi.bindTreeControls === 'function') {
            try { nextApi.bindTreeControls(); } catch (_) {}
            return true;
          }
          return false;
        }, { delayMs: 25, maxAttempts: 20 });
      }
    }
    if (!shellMenuApi && btnAddShape) btnAddShape.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAddShapeMenu();
    });
    if (!shellMenuApi && btnAddShape) btnAddShape.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openAddShapeMenu(btnAddShape);
      }
    });
    const btnTreeAddVolume = document.getElementById("btn-tree-add-volume");
    if (!shellMenuApi && btnTreeAddVolume) btnTreeAddVolume.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAddShapeMenu(btnTreeAddVolume);
    });
    if (btnAddPart) btnAddPart.addEventListener("click", () => addPartFromCurrentArchetype());
    if (btnDupPart) btnDupPart.addEventListener("click", () => {
      const p = getSelectedPart();
      if (p) { try { XR?.SceneCommands?.duplicatePart?.(p.id); } catch (_) {} }
    });
    if (btnDelPart) btnDelPart.addEventListener("click", () => {
      const p = getSelectedPart();
      if (p) { try { XR?.SceneCommands?.deletePart?.(p.id); } catch (_) {} }
    });
    if (btnSelectPart) btnSelectPart.addEventListener("click", () => toggleSelectPartMode());
    if (btnTexMode) btnTexMode.addEventListener("click", () => toggleTextureMode());

    if (!shellMenuApi) document.addEventListener('pointerdown', (e) => {
      const menu = document.getElementById('add-shape-menu');
      if (!menu || menu.hidden) return;
      const btn = document.getElementById('btn-add-shape');
      const target = e.target;
      if (btn && btn.contains(target)) return;
      if (menu.contains(target)) return;
      closeAddShapeMenu();
    }, true);

    if (partName) {
      if (partName.dataset) partName.dataset.undoArmed = '0';
      partName.addEventListener("focus", () => { if (partName.dataset) partName.dataset.undoArmed = '0'; });
      partName.addEventListener("blur", () => { if (partName.dataset) partName.dataset.undoArmed = '0'; });
      partName.addEventListener("input", () => {
        const p = getSelectedPart();
        if (!p) return;
        if (partName.dataset && partName.dataset.undoArmed !== '1') {
          armProjectUndoSnapshot();
          partName.dataset.undoArmed = '1';
        }
        const stable = XR?.ProjectState?.renameShape || null;
        if (stable) stable(p.id, partName.value.trim() || p.name || 'Part');
        else p.name = partName.value.trim() || p.name || 'Part';
        renderTreeUI();
      });
    }
    const transformInputs = [partScale, partPosX, partPosY, partPosZ, partRotY];
    transformInputs.forEach((el) => {
      if (!el) return;
      el.addEventListener("input", () => applyPartControlsToSelected());
    });

    const btnUvTexelHelp = document.getElementById('btn-uv-texel-help');
    const uvTexelHelp = document.getElementById('uvTexelHelp');
    if (btnUvTexelHelp && uvTexelHelp) {
      btnUvTexelHelp.addEventListener('click', () => {
        const expanded = btnUvTexelHelp.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        btnUvTexelHelp.setAttribute('aria-expanded', next ? 'true' : 'false');
        uvTexelHelp.hidden = !next;
      });
    }

    const btnSurfaceImgXform = document.getElementById('btn-surface-imgxform');
    const surfaceImgXformControls = document.getElementById('surfaceImgXformControls');
    if (btnSurfaceImgXform && surfaceImgXformControls) {
      btnSurfaceImgXform.addEventListener('click', () => {
        const expanded = btnSurfaceImgXform.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        btnSurfaceImgXform.setAttribute('aria-expanded', next ? 'true' : 'false');
        surfaceImgXformControls.hidden = !next;
        const drawWrap = document.getElementById('drawWrap');
        if (drawWrap) drawWrap.classList.toggle('is-collapsed', !next);
      });
    }

    const drawWrap = document.getElementById("drawWrap");
    drawWrap?.addEventListener("dragover", (e) => { e.preventDefault(); });
    drawWrap?.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!canImportImagesNow()) return;
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      loadImageFromFile(file);
    });
    onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
      const item = items.find((it) => it.type && it.type.startsWith("image/"));
      if (!item) return;
      if (!canImportImagesNow()) return;
      const file = item.getAsFile();
      loadImageFromFile(file);
    };
    onEditorKeyDown = (e) => {
      const ae = document.activeElement;
      const tag = ae && ae.tagName ? ae.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || (ae && ae.isContentEditable)) return;
      if (e.key === 'Escape') {
        const addShapeMenu = document.getElementById('add-shape-menu');
        if (addShapeMenu && !addShapeMenu.hidden) {
          closeAddShapeMenu();
          document.getElementById('btn-add-shape')?.focus();
          return;
        }
        const exportDropdown = document.getElementById('xr-export-dropdown');
        if (exportDropdown && !exportDropdown.hidden) {
          exportDropdown.hidden = true;
          document.getElementById('btn-export-trigger')?.setAttribute('aria-expanded', 'false');
          document.getElementById('btn-export-trigger')?.focus();
          return;
        }
        const exportModal = document.getElementById('exportModal');
        if (exportModal && !exportModal.hidden) {
          try { XR?.closeExportModal?.(); } catch (_) {}
          return;
        }
        const shortcutsModal = document.getElementById('shortcutsModal');
        if (shortcutsModal && !shortcutsModal.hidden) {
          try { XR?.__modules?.ShellEditorModals?.closeShortcutsModal?.(); } catch (_) {}
          return;
        }
      }
      const k = (e.key || '').toLowerCase();
      const code = String(e.code || '');
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        if (k === 'g') { e.preventDefault(); setGizmoMode('move'); return; }
        if (k === 'r') { e.preventDefault(); setGizmoMode('rotate'); return; }
        if (k === 's') { e.preventDefault(); setGizmoMode('scale'); return; }
        if (k === 'h') {
          e.preventDefault();
          try {
            const shortcutsModal = document.getElementById('shortcutsModal');
            if (shortcutsModal && !shortcutsModal.hidden) XR?.__modules?.ShellEditorModals?.closeShortcutsModal?.();
            else XR?.__modules?.ShellEditorModals?.openShortcutsModal?.();
          } catch (_) {}
          return;
        }
        if (k === 'f') { e.preventDefault(); try { fitViewportView(); } catch (_) {} return; }
        if (code === 'Numpad1') { e.preventDefault(); try { setViewportView('front'); } catch (_) {} return; }
        if (code === 'Numpad7') { e.preventDefault(); try { setViewportView('top'); } catch (_) {} return; }
        if (code === 'Numpad5') {
          e.preventDefault();
          try {
            const next = (viewportProjection === 'ortho') ? 'perspective' : 'ortho';
            setActiveCamera(next);
            updateViewportViewButtons();
            persistViewportSettings();
          } catch (_) {}
          return;
        }
        return;
      }
      if (k === 's') { e.preventDefault(); saveProjectXreateJson(); return; }
      if (k === 'z' && e.shiftKey) { e.preventDefault(); void redoProject(); return; }
      if (k === 'z') { e.preventDefault(); void undoProject(); return; }
      if (k === 'y') { e.preventDefault(); void redoProject(); }
    };
    try { resolveShellViewportControlsApi()?.bind?.(); } catch (_) {}



    const debugUsdaBtn = document.getElementById('btn-debug-usda');
    const debugUsdzReportBtn = document.getElementById('btn-debug-usdz-report');
    const projectSaveBtn = document.getElementById('btn-project-save');
    const projectLoadBtn = document.getElementById('btn-project-load');
    const projectAutosaveBtn = document.getElementById('btn-project-autosave');
    const projectFileInput = document.getElementById('projectFileInput');
    debugUsdaBtn?.addEventListener('click', () => {
      try {
        const buildPayload = legacyExportConfigs?.usdz?.buildPayload || XR?.exportConfigs?.usdz?.buildPayload;
        if (typeof buildPayload !== 'function') throw new Error('USDZ payload configuration unavailable');
        buildPayload();
        const pb = resolveExportPayloadBuilders();
        const dbg = (pb && typeof pb.getLastUsdDebug === 'function') ? pb.getLastUsdDebug() : null;
        const usda = (dbg && dbg.usda) ? dbg.usda : '';
        if (!usda) throw new Error('No USDA data available');
        const bytes = new TextEncoder().encode(usda);
        download(bytes, 'xreate_debug.usda', 'text/plain');
        setStatusKey('status_usda_downloaded', 'ok');
      } catch (e) {
        try {
          const f = XR?.showModal || XR?.__modules?.ShellExportModal?.showModal || null;
          if (typeof f === 'function') f(tr('modal_debug_export_title'), String(e && e.message ? e.message : e));
        } catch (_) {}
        setStatusKey('status_debug_export_failed', '');
      }
    });
    debugUsdzReportBtn?.addEventListener('click', () => {
      try {
        const buildPayload = legacyExportConfigs?.usdz?.buildPayload || XR?.exportConfigs?.usdz?.buildPayload;
        if (typeof buildPayload !== 'function') throw new Error('USDZ payload configuration unavailable');
        buildPayload();
        const pb = resolveExportPayloadBuilders();
        const dbg = (pb && typeof pb.getLastUsdDebug === 'function') ? pb.getLastUsdDebug() : null;
        const zip = (pb && typeof pb.getLastZipReport === 'function') ? pb.getLastZipReport() : null;
        const payload = {
          bounds: (dbg && dbg.bounds) ? dbg.bounds : null,
          zip: zip || null
        };
        const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
        download(bytes, 'xreate_usdz_report.json', 'application/json');
        setStatusKey('status_usdz_report_downloaded', 'ok');
      } catch (e) {
        try {
          const f = XR?.showModal || XR?.__modules?.ShellExportModal?.showModal || null;
          if (typeof f === 'function') f(tr('modal_debug_export_title'), String(e && e.message ? e.message : e));
        } catch (_) {}
        setStatusKey('status_debug_export_failed', '');
      }
    });

    projectSaveBtn?.addEventListener('click', () => saveProjectXreateJson());
    projectLoadBtn?.addEventListener('click', () => {
      try {
        if (projectFileInput) {
          projectFileInput.value = '';
          projectFileInput.click();
        }
      } catch (_) {}
    });
    projectFileInput?.addEventListener('change', async () => {
      try {
        const file = projectFileInput.files && projectFileInput.files[0] ? projectFileInput.files[0] : null;
        if (!file) return;
        setStatusKey('status_loading_project', 'working');
        const text = await file.text();
        const payload = JSON.parse(text);
        await loadProjectFromPayload(payload);
      } catch (e) {
        try {
          const f = XR?.showModal || XR?.__modules?.ShellExportModal?.showModal || null;
          if (typeof f === 'function') f(tr('modal_load_failed'), String(e && e.message ? e.message : e));
        } catch (_) {}
        setStatusKey('status_load_failed', '');
      } finally {
        try { projectFileInput.value = ''; } catch (_) {}
      }
    });

    projectAutosaveBtn?.addEventListener('click', async () => {
      try { await XR?.Autosave?.openModal?.(); } catch (_) {}
    });
    document.addEventListener('keydown', (e) => {
      const k = String(e && e.key ? e.key : '');
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (k.toLowerCase() !== 'a') return;
      e.preventDefault();
      try { void XR?.Autosave?.openModal?.(); } catch (_) {}
    }, true);

    onResize = () => {
      try { if (typeof scaleDrawCanvas === "function") scaleDrawCanvas(); } catch (_) {}
      try { if (typeof resizeRenderer === "function") resizeRenderer(); } catch (_) {}
    };
  (function(XR){
    try {
      XR.Shapes?.configure?.({
        project,
        getShapeList,
        getSelectedPart,
        setSelectedPart,
        getArchetypeById,
        addPartFromArchetype,
        mutateProject,
        clearAssembly,
        getDefaultSpawnPosition,
        resizeRenderer,
        openDoodleModal,
        showToast: _inlineShowToastRealImpl,
        tr,
        setStatusKey,
        updateProjectNameUi,
        THREE,
        ensureLayersOnPart,
        newLayerId,
        imageBitmapToPngDataUrlForSave,
        newPartId,
        getDefaultUvModeForArchetypeId,
        getDefaultParamsForArchetypeId,
        applyUvModeToGeometry,
        createOffscreenCanvas,
        CANVAS_SIZE,
        editorBg,
        createMaterial,
        assemblyRoot,
        applyMaterialFlagsForPart,
        syncVisibleToSelectedPart,
        ensureTransformState,
        setUVMode,
        updateInfoForMesh,
        renderUvOverlay,
        drawBaseLayer,
        requestApplyTexture,
        renderTreeUI,
        renderShapeParamsUI,
        updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
      });
    } catch (_) {}
  })(XR);

  const runtimeOptions = {
    lifecycle,
    getRefs: () => ({ rafId, paused, initialized, resumeQueued, resumeRetryCount, resumeRafId, resumeRafFrames, resumeRetryTimer, resumeDomObserver, textureApplyRaf, textureApplySilent, inspectorScrollRaf }),
    setRefs: (refs) => {
      rafId = refs.rafId; paused = refs.paused; initialized = refs.initialized;
      resumeQueued = refs.resumeQueued; resumeRetryCount = refs.resumeRetryCount;
      resumeRafId = refs.resumeRafId; resumeRafFrames = refs.resumeRafFrames; resumeRetryTimer = refs.resumeRetryTimer;
      resumeDomObserver = refs.resumeDomObserver; textureApplyRaf = refs.textureApplyRaf;
      textureApplySilent = refs.textureApplySilent; inspectorScrollRaf = refs.inspectorScrollRaf;
    },
    ensureInit, onResize, onPaste, onEditorKeyDown, resize3d, scaleDrawCanvas,
    getLifecycleDom: () => XR?.LifecycleDom || XR?.__modules?.LifecycleDom || null,
    getSceneDrawerEscHandler: () => {
      const panels = XR?.ShellScenePanels || XR?.__modules?.ShellScenePanels || null;
      return panels?.getSceneDrawerEscHandler?.() || null;
    },
    renderLoopTick: () => {
      const loop = XR?.__modules?.RenderLoop || null;
      if (typeof loop?.tick !== 'function') {
        console.error('[render-loop] core RenderLoop unavailable after engine bootstrap');
        return false;
      }
      return loop.tick();
    },
    renderTreeUI,
    updatePartControlsFromSelected: () => callShellInspectorPanels('updatePartControlsFromSelected'),
    updateTransformUi, updateUvStretchUi, updateUvModeHint, updateUvTexelDensityUi,
    updateShapeTransformControlsFromSelected: () => callShellInspectorPanels('updateShapeTransformControlsFromSelected'),
    updateInfoForMesh, getCurrentMesh, tr, getUvMode,
    renderUvCompareNets, renderer, getEditorCleanupFns: () => editorCleanupFns,
    cleanupRegistry: editorCleanupRegistry,
    sceneRuntime: sceneRuntimeOwner || (() => {
      const sceneRuntimeModule = XR?.SceneRuntime || XR?.__modules?.SceneRuntime || null;
      return sceneRuntimeModule?.adopt?.({ renderer, scene, assemblyRoot }) || null;
    })(),
  };
  // Module scripts may finish after this deferred legacy script. Resolve on
  // first lifecycle call rather than capturing a null module during bootstrap.
  let runtime = null;
  const getRuntime = () => {
    if (runtime) return runtime;
    const runtimeModule = XR?.EngineRuntime || XR?.__modules?.EngineRuntime || null;
    runtime = runtimeModule?.create?.(runtimeOptions) || null;
    return runtime;
  };
  let runtimeResumeRetries = 0;
  let runtimeResumeTimer = 0;
  let runtimeModulesReadyListenerAttached = false;
  const resumeRuntime = () => {
    const next = getRuntime();
    if (next?.resume) {
      runtimeResumeRetries = 0;
      if (runtimeResumeTimer) { clearTimeout(runtimeResumeTimer); runtimeResumeTimer = 0; }
      return next.resume();
    }
    if (!runtimeModulesReadyListenerAttached) {
      runtimeModulesReadyListenerAttached = true;
      window.addEventListener('xreate:engine-modules-ready', () => {
        runtimeModulesReadyListenerAttached = false;
        resumeRuntime();
      }, { once: true });
    }
    if (runtimeResumeRetries >= 200) {
      // The module-ready listener remains attached. A slow development server
      // may need longer than the retry window to stream the full ESM graph.
      return;
    }
    runtimeResumeRetries += 1;
    if (!runtimeResumeTimer) {
      runtimeResumeTimer = setTimeout(() => {
        runtimeResumeTimer = 0;
        resumeRuntime();
      }, 25);
    }
  };
  const api = {
    resume: resumeRuntime,
    refreshI18n: () => getRuntime()?.refreshI18n?.(),
    pause: () => getRuntime()?.pause?.(),
    dispose: () => getRuntime()?.dispose?.(),
    setViewportView: (v) => setViewportView(v),
    fitViewportView: () => fitViewportView(),
  };
  return {
    api,
    compatibilityPatch: {
      engine: {
        frame: animate,
        pause: () => api.pause(),
        resume: () => api.resume(),
      },
      aliases: {
        resize3d: resizeRenderer,
        getActiveLayer,
        spawnHumanoidKit,
        addPartFromArchetype,
        addPartFromCurrentArchetype,
        addDoodleShapeToScene,
        openAddShapeMenu,
        closeAddShapeMenu,
        toggleAddShapeMenu,
        buildProjectSavePayload,
        loadProjectFromPayload,
        saveProjectXreateJson,
        undoProject,
        redoProject,
        ...legacyImageToolAliases,
      },
      namespaces: {
        Shapes: {
          addDoodle: (points, params, opts) => addDoodleShapeToScene(points, params, opts),
        },
        ProjectIO: {
          buildProjectSavePayload,
          buildProjectUndoPayload,
          loadProjectFromPayload,
          saveProjectXreateJson,
        },
        Undo: {
          safeUndoProject: undoProject,
          safeRedoProject: redoProject,
        },
      },
      configs: {
        exportConfigs: legacyExportConfigs,
        projectIoConfig,
        shellScenePanelsConfig,
        shellInspectorPanelsConfig,
        shellShapeParamsConfig,
        shellSurfaceEditorConfig,
        shellMaskEditorConfig,
        shellProjectUiConfig,
        shellUvUiConfig,
        shellViewportControlsConfig,
      },
    },
  };
}
