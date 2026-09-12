// XReate engine entrypoint.
// Transitional bootstrap for the ES modules migration:
// - imports shared state
// - exposes a stable state surface on window.XR.state
// - keeps window.XR.__state as a temporary compatibility alias
// - coexists with the legacy inline editor engine until extraction is complete

import { state } from './core/state.js';
import { configureDebugLog, event as debugEvent, installBrowserEventLogging } from './debug/event-log.js';
import { createLegacyEditor } from './legacy/editor-inline.js';
import * as EditorStore from './core/editor-store.js';
import { Storage, adoptLegacyStorage } from './persistence/storage.js';
import { download } from './download.js';
import { create as createProjectIO } from './persistence/project-io.js';
import * as AutosaveModule from './persistence/autosave.js';
import { createGLBExporter } from './export/glb.js';
import { createUSDZExporter } from './export/usdz.js';
import { createTextureAtlasExporter } from './export/atlas.js';
import * as ExportPayloadBuildersModule from './export/payload-builders.js';
import * as SceneGraphWiringModule from './core/scene-graph-wiring.js';
import * as SceneCommandsModule from './core/scene-commands.js';
import * as ShapeCommandsModule from './core/shapes-commands.js';
import * as FocusTrapModule from './core/focus-trap.js';
import * as UVCommandsModule from './core/uv-commands.js';
import * as UVMappingModule from './core/uv-mapping.js';
import * as UVDiagnosticsModule from './core/uv-diagnostics.js';
import * as SceneSetup from './core/scene-setup.js';
import * as RenderLoopModule from './core/render-loop.js';
import * as Raycasting from './core/raycasting.js';
import * as Gizmo from './core/gizmo.js';
import {
  updateViewportScaleLabel,
  updateInfoForMesh,
  setViewportTransformReadout,
  isViewportWasdContextActive,
  updateViewportWasd,
  bindViewportEventWiring,
  bindViewportResize,
  createViewportAnimator,
} from './core/viewport-runtime.js';
import * as ProjectState from './core/project-state.js';
import * as IdentifiersModule from './core/identifiers.js';
import * as ProjectStore from './core/project-store.js';
import * as LayerState from './core/layers.js';
import * as MaterialRuntime from './core/material-runtime.js';
import * as Selection from './core/selection.js';
import * as SelectionController from './core/selection-controller.js';
import * as TransformController from './core/transform-controller.js';
import * as EditorInitModule from './core/editor-init.js';
import * as EditorLifecycleModule from './core/editor-lifecycle.js';
import * as CleanupRegistryModule from './core/cleanup-registry.js';
import * as EngineRuntimeModule from './core/engine-runtime.js';
import { create as createProjectController } from './editor/project-controller.js';
import * as ThemeDerivedColorsModule from './editor/theme-derived-colors.js';
import * as ShapeActionsModule from './editor/shape-actions.js';
import * as SceneRuntime from './editor/scene-runtime.js';
import { disposePart, clearAssembly } from './editor/part-resource-runtime.js';
import { create as createViewportControllerBase } from './viewport/viewport-controller.js';
import * as UndoModule from './core/undo.js';
import * as ImageRuntimeModule from './image/runtime.js';
import * as ImageCompositorModule from './image/compositor.js';
import './image/canvas-interactions.js';
import * as ImageAffineModule from './image/affine-transform.js';
import { create as createLayerController } from './texture/layer-controller.js';
import { create as createLayerSession } from './texture/layer-session.js';
import { create as createImageWorkflowController } from './texture/image-workflow-controller.js';
import { create as createTextureCanvasController } from './texture/canvas-controller.js';
import { setTextureMode } from './texture/mode-controller.js';
import * as ImageIOModule from './image/io.js';
import * as ImageWorkflowsModule from './image/workflows.js';
import * as ImagePbrMapsModule from './image/pbr-maps.js';
import * as ImageRetroModule from './image/retro.js';
import * as ImageSeamlessModule from './image/seamless.js';
import * as ImagePerspectiveModule from './image/perspective.js';
import { packTexturesToAtlas } from './export/atlas-pack.js';
import { shapeMeta } from './shapes/archetypes.meta.js';
import { createArchetypes, getArchetypeById, getArchetypeCategoryById } from './shapes/archetype-catalog.js';
import * as ShapeDefsModule from './shapes/shapedefs.js';
import * as ShapeFactoryModule from './shapes/factory.js';
import { addPartFromArchetype } from './shapes/shape-controller.js';
import { rebuildSelectedPartGeometry } from './shapes/geometry-controller.js';
import { addDoodleShapeToScene, createDoodlePart } from './shapes/doodle-controller.js';
import { spawnHumanoidKit } from './shapes/humanoid-controller.js';
import { ensureTransformState, getShapeScaleFactors, applyTransformToMesh } from './core/part-transform.js';
import { getGeometryStats } from './core/geometry-stats.js';
import { createExportConfigurations } from './export/configuration.js';
import * as ProjectIoConfigModule from './editor/project-io-config.js';
import * as UndoAssetsModule from './persistence/undo-assets.js';
import * as ShellResolversModule from './editor/shell-resolvers.js';
import * as UvOverlayRuntimeModule from './canvas/uv-overlay.js';
import * as PrimitiveBuilders from './shapes/builders/primitives.js';
import * as AdvancedBuilders from './shapes/builders/advanced.js';
import * as ShapesRuntimeModule from './core/shapes-runtime.js';

window.XR = window.XR || {};
window.XR.__modules = window.XR.__modules || {};
const compatibility = window.XR;
configureDebugLog({ facade: compatibility });
installBrowserEventLogging();
debugEvent('engine.module.start');
const isDevelopmentRuntime = (() => {
  try {
    const host = String(window.location?.hostname || '');
    const query = String(window.location?.search || '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || query.includes('dev=1') || query.includes('debug=1');
  } catch (_) {
    return false;
  }
})();
const devWarn = (...args) => {
  if (isDevelopmentRuntime) console.warn(...args);
};
compatibility.devWarn = compatibility.devWarn || devWarn;
const ShapeBuilders = { ...PrimitiveBuilders, ...AdvancedBuilders };
const glbExporter = createGLBExporter();
const usdzExporter = createUSDZExporter();
const atlasExporter = createTextureAtlasExporter();
const ExportApi = {
  configureGLB: (opts) => glbExporter.configure(opts),
  configureUSDZ: (opts) => usdzExporter.configure(opts),
  configureTextureAtlas: (opts) => atlasExporter.configure(opts),
  glb: () => glbExporter.run(),
  usdz: () => usdzExporter.run(),
  atlas: () => atlasExporter.run(),
  packTexturesToAtlas,
};
const ImageToolsApi = {
  ...ImageRuntimeModule,
  ...ImagePbrMapsModule,
  ...ImageRetroModule,
  ...ImageSeamlessModule,
  ...ImagePerspectiveModule,
};
const AutosaveApi = {
  ensureManager: AutosaveModule.ensureAutosaveManager,
  ensureModalUi: AutosaveModule.ensureAutosaveModalUi,
  openModal: AutosaveModule.openAutosaveModal,
  get manager() { return AutosaveModule.getAutosaveManager(); },
  get modalUi() { return AutosaveModule.getAutosaveModalUi(); },
};
const Archetypes = createArchetypes({
  shapeMeta,
  builders: {
    ...ShapeBuilders,
    doodle: () => null,
    'humanoid-kit': () => null,
  },
});
const bootstrapState = compatibility.state || compatibility.__state || null;
if (bootstrapState && bootstrapState !== state) {
  Object.assign(state, bootstrapState);
  state.lifecycle = { ...(state.lifecycle || {}), ...(bootstrapState.lifecycle || {}) };
}
state.runtime = state.runtime || {};
adoptLegacyStorage(compatibility.Storage);
// Project and layer IDs belong to the canonical state contract.  The legacy
// bridge may request an ID while adapting UI actions, but never configures the
// state authority or owns the generator.
ProjectState.configureProjectState({
  createProjectId: () => `xreate_${Storage.uuid()}`,
  createLayerId: () => `layer_${Storage.uuid()}`,
});
IdentifiersModule.configureIdentifiers({ uuid: () => Storage.uuid() });
AutosaveModule.configureAutosave({
  devWarn: compatibility.devWarn,
  tr: (key) => compatibility.tr?.(key) || compatibility.i18n?.t?.(key) || String(key),
  showToast: (...args) => compatibility.showToast?.(...args),
  getProjectMetaModified: () => ProjectState.getProjectMetaModified(),
  getProjectIO: () => compatibility.ProjectIO || null,
  buildProjectSavePayload: () => compatibility.buildProjectSavePayload?.(),
  loadProjectFromPayload: (payload) => compatibility.loadProjectFromPayload?.(payload),
  download,
  openModal: (...args) => compatibility.openModal?.(...args),
  closeModal: (...args) => compatibility.closeModal?.(...args),
});
ProjectStore.configureProjectStore({ projectState: ProjectState });
ExportPayloadBuildersModule.configureDebugRuntime({
  getMinimalUsdaMode: () => compatibility.__debugMinimalUsda || null,
  captureUsdzPayload: (payload, usda, files) => {
    compatibility.__lastUsdzPayload = payload;
    compatibility.__lastUsdzDebug = { usda, files };
    compatibility.__forceDownloadLastPayloadDirect = (filename) => {
      if (!compatibility.__lastUsdzPayload) {
        console.warn('[USDZ-DIRECT] No payload. Export first.');
        return false;
      }
      download(
        compatibility.__lastUsdzPayload,
        filename || (`__DIRECT__${compatibility.__lastProjectName || 'XReate'}.usdz`),
        'model/vnd.usdz+zip',
      );
      return true;
    };
    const endpoint = compatibility.debug?.usdzCaptureEndpoint;
    if (!endpoint) return;
    if (typeof fetch !== 'function' || typeof endpoint !== 'string') {
      console.warn('[usdz] debug capture requested but endpoint/fetch is unavailable');
      return;
    }
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload, cache: 'no-store', mode: 'cors' })
      .catch((err) => console.warn('[usdz] opt-in debug capture failed', { endpoint, err }));
  },
});
compatibility.UvOverlayRuntime = UvOverlayRuntimeModule;
compatibility.__modules.UvOverlayRuntime = compatibility.UvOverlayRuntime;
UVCommandsModule.configureUvCommands({ overlayRuntime: compatibility.UvOverlayRuntime });
ShapeDefsModule.configureShapeDefs({ shapeMeta });
const viewportRuntimeFacade = {
  updateViewportScaleLabel,
  updateInfoForMesh,
  setViewportTransformReadout,
  isViewportWasdContextActive,
  updateViewportWasd,
  bindViewportEventWiring,
  bindViewportResize,
  createViewportAnimator,
  markDirty: () => {},
};
const createViewportController = (opts = {}) => createViewportControllerBase({
  ...opts,
  setMarkDirty: (markDirty) => { viewportRuntimeFacade.markDirty = markDirty; },
});
function createEditorFromLegacyFactory() {
  const result = createLegacyEditor(compatibility);
  const api = result?.api || result;
  if (!api) return null;
  const patch = result?.compatibilityPatch || {};
  const namespaces = { ...patch.namespaces };
  if (patch.engine) namespaces.Engine = { ...namespaces.Engine, ...patch.engine };
  for (const [namespace, entries] of Object.entries(namespaces)) {
    const target = compatibility[namespace] = compatibility[namespace] || {};
    for (const [key, value] of Object.entries(entries || {})) {
      if (!target[key] && value) target[key] = value;
    }
  }
  for (const [key, value] of Object.entries(patch.aliases || {})) {
    if (!compatibility[key] && value) compatibility[key] = value;
  }
  for (const [key, value] of Object.entries(patch.configs || {})) {
    if (!compatibility[key] && value) compatibility[key] = value;
  }
  window.__xreateEditorApi = api;
  return api;
}
compatibility.state = state;
compatibility.__state = state;
compatibility.Storage = compatibility.Storage || Storage;
compatibility.download = compatibility.download || download;
compatibility.Editor = { create: createEditorFromLegacyFactory };
// The compatibility namespace is written only at this bootstrap boundary.
// Extracted modules export pure APIs and never mutate it themselves.
compatibility.ShapeController = { addPartFromArchetype };
compatibility.GeometryController = { rebuildSelectedPartGeometry };
compatibility.DoodleController = { addDoodleShapeToScene, createDoodlePart };
compatibility.HumanoidController = { spawnHumanoidKit };
compatibility.PartTransform = { ensureTransformState, getShapeScaleFactors, applyTransformToMesh };
compatibility.GeometryStats = { getGeometryStats };
compatibility.ExportConfiguration = { createExportConfigurations };
compatibility.LayerSession = { create: createLayerSession };
compatibility.ImageWorkflowController = { create: createImageWorkflowController };
compatibility.TextureCanvasController = { create: createTextureCanvasController };
compatibility.ViewportController = { create: createViewportController };
compatibility.ViewportRuntime = viewportRuntimeFacade;
compatibility.SceneSetup = SceneSetup;
compatibility.SceneRuntime = SceneRuntime;
compatibility.Raycasting = Raycasting;
compatibility.Gizmo = Gizmo;
compatibility.TransformController = TransformController;
compatibility.Selection = Selection;
compatibility.SelectionController = SelectionController;
compatibility.LayerController = { create: createLayerController };
compatibility.LayerState = LayerState;
compatibility.EditorStore = EditorStore;
compatibility.ProjectController = { create: createProjectController };
compatibility.ProjectIO = { create: createProjectIO };
compatibility.ProjectIoConfig = ProjectIoConfigModule.ProjectIoConfig;
compatibility.UndoAssets = UndoAssetsModule.UndoAssets;
compatibility.ShellResolvers = ShellResolversModule.ShellResolvers;
compatibility.ProjectState = ProjectState;
compatibility.Identifiers = IdentifiersModule.Identifiers;
compatibility.ProjectStore = ProjectStore.ProjectStore;
compatibility.MaterialRuntime = MaterialRuntime.MaterialRuntime;
compatibility.UVMapping = UVMappingModule.UVMapping;
compatibility.UVDiagnostics = UVDiagnosticsModule.UVDiagnostics;
compatibility.CleanupRegistry = CleanupRegistryModule.CleanupRegistry;
compatibility.EngineRuntime = EngineRuntimeModule.EngineRuntime;
compatibility.FocusTrap = FocusTrapModule.FocusTrap;
compatibility.activateFocusTrap = compatibility.FocusTrap.activate;
compatibility.deactivateFocusTrap = compatibility.FocusTrap.deactivate;
compatibility.SceneGraphWiring = SceneGraphWiringModule.SceneGraphWiring;
compatibility.SceneCommands = SceneCommandsModule.SceneCommands;
compatibility.ShapeFactory = ShapeFactoryModule.ShapeFactory;
compatibility.ShapeDefs = ShapeDefsModule.ShapeDefs;
compatibility.shapeMeta = shapeMeta;
compatibility.ShapeBuilders = ShapeBuilders;
compatibility.Archetypes = Archetypes;
compatibility.getArchetypeById = (id) => getArchetypeById(Archetypes, id);
compatibility.getArchetypeCategoryById = (id) => getArchetypeCategoryById(Archetypes, id);
compatibility.ThemeDerivedColors = ThemeDerivedColorsModule.ThemeDerivedColors;
compatibility.ShapeActions = ShapeActionsModule;
compatibility.Export = ExportApi;
compatibility.Autosave = AutosaveApi;
compatibility.ExportPayloadBuilders = ExportPayloadBuildersModule;
compatibility.ImageAffine = ImageAffineModule.ImageAffine;
compatibility.ImageIO = ImageIOModule;
compatibility.ImageCompositor = ImageCompositorModule;
compatibility.ImageTools = ImageToolsApi;
compatibility.ImageWorkflows = ImageWorkflowsModule;
compatibility.generatePBRMaps = ImageToolsApi.generatePBRMaps;
compatibility.applyRetroEffect = ImageToolsApi.applyRetroEffect;
compatibility.resetRetroEffect = ImageToolsApi.resetRetroEffect;
compatibility.makeSeamless = ImageToolsApi.makeSeamless;
compatibility.resetSeamless = ImageToolsApi.resetSeamless;
compatibility.Project = ShapeCommandsModule.ProjectCommands;
compatibility.Shapes = ShapeCommandsModule.ShapeCommands;
compatibility.RenderLoop = RenderLoopModule.RenderLoop;
compatibility.ShapesRuntime = ShapesRuntimeModule.ShapesRuntime;
compatibility.Undo = UndoModule.Undo;
compatibility.UV = UVCommandsModule.UVCommands;
compatibility.EditorInit = EditorInitModule.EditorInit;
compatibility.EditorLifecycle = EditorLifecycleModule.EditorLifecycle;
compatibility.PartResourceRuntime = { disposePart, clearAssembly };
compatibility.TextureModeController = { setTextureMode };
compatibility.__modules.ShapeController = compatibility.ShapeController;
compatibility.__modules.GeometryController = compatibility.GeometryController;
compatibility.__modules.DoodleController = compatibility.DoodleController;
compatibility.__modules.download = compatibility.download;
compatibility.__modules.HumanoidController = compatibility.HumanoidController;
compatibility.__modules.PartTransform = compatibility.PartTransform;
compatibility.__modules.GeometryStats = compatibility.GeometryStats;
compatibility.__modules.ExportConfiguration = compatibility.ExportConfiguration;
compatibility.__modules.LayerSession = compatibility.LayerSession;
compatibility.__modules.ImageWorkflowController = compatibility.ImageWorkflowController;
compatibility.__modules.TextureCanvasController = compatibility.TextureCanvasController;
compatibility.__modules.ViewportController = compatibility.ViewportController;
compatibility.__modules.ViewportRuntime = compatibility.ViewportRuntime;
compatibility.__modules.SceneSetup = compatibility.SceneSetup;
compatibility.__modules.SceneRuntime = compatibility.SceneRuntime;
compatibility.__modules.Raycasting = compatibility.Raycasting;
compatibility.__modules.Gizmo = compatibility.Gizmo;
compatibility.__modules.TransformController = compatibility.TransformController;
compatibility.__modules.Selection = compatibility.Selection;
compatibility.__modules.SelectionController = compatibility.SelectionController;
compatibility.__modules.LayerController = compatibility.LayerController;
compatibility.__modules.LayerState = compatibility.LayerState;
compatibility.__modules.EditorStore = compatibility.EditorStore;
compatibility.__modules.ProjectController = compatibility.ProjectController;
compatibility.__modules.ProjectIO = compatibility.ProjectIO;
compatibility.__modules.ProjectState = compatibility.ProjectState;
compatibility.__modules.Identifiers = compatibility.Identifiers;
compatibility.__modules.ProjectStore = compatibility.ProjectStore;
compatibility.__modules.MaterialRuntime = compatibility.MaterialRuntime;
compatibility.__modules.UVMapping = compatibility.UVMapping;
compatibility.__modules.UVDiagnostics = compatibility.UVDiagnostics;
compatibility.__modules.CleanupRegistry = compatibility.CleanupRegistry;
compatibility.__modules.EngineRuntime = compatibility.EngineRuntime;
compatibility.__modules.FocusTrap = compatibility.FocusTrap;
compatibility.__modules.SceneGraphWiring = compatibility.SceneGraphWiring;
compatibility.__modules.SceneCommands = compatibility.SceneCommands;
compatibility.__modules.ShapeFactory = compatibility.ShapeFactory;
compatibility.__modules.ShapeDefs = compatibility.ShapeDefs;
compatibility.__modules.ShapeBuilders = compatibility.ShapeBuilders;
compatibility.__modules.Archetypes = compatibility.Archetypes;
compatibility.__modules.ThemeDerivedColors = compatibility.ThemeDerivedColors;
compatibility.__modules.ShapeActions = compatibility.ShapeActions;
compatibility.__modules.ExportGLB = { configure: ExportApi.configureGLB, create: ExportApi.configureGLB };
compatibility.__modules.ExportPayloadBuilders = compatibility.ExportPayloadBuilders;
compatibility.__modules.AutosaveManager = AutosaveModule.AutosaveManager;
compatibility.__modules.AutosaveHistoryModal = AutosaveModule.AutosaveHistoryModal;
compatibility.__modules.ExportUSDZ = { configure: ExportApi.configureUSDZ, create: ExportApi.configureUSDZ };
compatibility.__modules.ExportTextureAtlas = { configure: ExportApi.configureTextureAtlas, create: ExportApi.configureTextureAtlas };
compatibility.__modules.ExportTextureAtlas.packTexturesToAtlas = packTexturesToAtlas;
compatibility.__modules.exportGLB = ExportApi.glb;
compatibility.__modules.exportUSDZ = ExportApi.usdz;
compatibility.__modules.exportTextureAtlas = ExportApi.atlas;
compatibility.__modules.ImageAffine = compatibility.ImageAffine;
compatibility.__modules.ImageIO = compatibility.ImageIO;
compatibility.__modules.ImageCompositor = compatibility.ImageCompositor;
compatibility.__modules.ImageTools = compatibility.ImageTools;
compatibility.__modules.ImageWorkflows = compatibility.ImageWorkflows;
compatibility.__modules.Project = compatibility.Project;
compatibility.__modules.Shapes = compatibility.Shapes;
compatibility.__modules.RenderLoop = compatibility.RenderLoop;
compatibility.__modules.ShapesRuntime = compatibility.ShapesRuntime;
compatibility.__modules.Undo = compatibility.Undo;
compatibility.__modules.UV = compatibility.UV;
compatibility.__modules.EditorInit = compatibility.EditorInit;
compatibility.__modules.EditorLifecycle = compatibility.EditorLifecycle;
compatibility.getProject = compatibility.Project.get;
compatibility.getShapes = compatibility.Shapes.list;
compatibility.getShapeById = compatibility.Shapes.getById;
compatibility.getSelectedId = compatibility.Project.getSelectedId;
compatibility.selectShape = compatibility.Shapes.select;
compatibility.addShape = compatibility.Shapes.add;
compatibility.duplicateSelected = compatibility.Shapes.duplicateSelected;
compatibility.deleteSelected = compatibility.Shapes.deleteSelected;
compatibility.moveSelectedUp = compatibility.Shapes.moveSelectedUp;
compatibility.moveSelectedDown = compatibility.Shapes.moveSelectedDown;
compatibility.getShapeDef = compatibility.ShapeDefs.get;
compatibility.allShapeDefs = compatibility.ShapeDefs.all;
compatibility.defaultParams = compatibility.ShapeDefs.defaultParams;
compatibility.defaultUvMode = compatibility.ShapeDefs.defaultUvMode;
compatibility.__modules.PartResourceRuntime = compatibility.PartResourceRuntime;
compatibility.__modules.TextureModeController = compatibility.TextureModeController;

// The deferred legacy bridge may execute before this module graph has finished
// evaluating. Signal the actual readiness boundary instead of making bootstrap
// correctness depend on a guessed retry delay.
window.dispatchEvent(new Event('xreate:engine-modules-ready'));
