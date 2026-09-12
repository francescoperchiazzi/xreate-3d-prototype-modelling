// Lazy Shell adapter construction. The compatibility facade is injected so
// this module is usable in tests and never reaches the browser global itself.
function createResolver(compatibility, moduleName, getConfig, label, afterCreate) {
  let instance = null;
  return () => {
    if (instance) return instance;
    const module = compatibility?.__modules?.[moduleName] || null;
    const config = getConfig();
    if (!module || typeof module.create !== 'function' || !config) return null;
    try {
      instance = module.create(config);
      afterCreate?.(instance);
    } catch (err) {
      console.error(`[${label}] create failed`, err);
      instance = null;
    }
    return instance;
  };
}

export function createShellResolvers(compatibility, configs = {}) {
  const get = (key) => () => configs[key] || null;
  return {
    resolveShellScenePanelsApi: createResolver(
      compatibility, 'ShellScenePanels', get('scenePanels'), 'shell-scene-panels',
      (api) => {
        try { api?.installInspectorScrollSync?.(); }
        catch (err) { console.warn('[shell-scene-panels] inspector scroll setup failed', err); }
      },
    ),
    resolveShellInspectorPanelsApi: createResolver(compatibility, 'ShellInspectorPanels', get('inspectorPanels'), 'shell-inspector-panels'),
    resolveShellShapeParamsApi: createResolver(compatibility, 'ShellShapeParams', get('shapeParams'), 'shell-shape-params'),
    resolveShellSurfaceEditorApi: createResolver(compatibility, 'ShellSurfaceEditor', get('surfaceEditor'), 'shell-surface-editor'),
    resolveShellMaskEditorApi: createResolver(compatibility, 'ShellMaskEditor', get('maskEditor'), 'shell-mask-editor'),
    resolveShellProjectUiApi: createResolver(compatibility, 'ShellProjectUi', get('projectUi'), 'shell-project-ui'),
    resolveShellUvUiApi: createResolver(compatibility, 'ShellUvUi', get('uvUi'), 'shell-uv-ui'),
    resolveShellViewportControlsApi: createResolver(compatibility, 'ShellViewportControls', get('viewportControls'), 'shell-viewport-controls'),
  };
}

export const ShellResolvers = { create: createShellResolvers };
