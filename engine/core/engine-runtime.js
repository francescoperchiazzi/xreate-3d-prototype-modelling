import { create as createEditorLifecycle } from './editor-lifecycle.js';

// Single runtime lifecycle facade. It deliberately owns only lifecycle
// orchestration; the legacy host still supplies temporary refs while scene and
// viewport resources are migrated in subsequent vertical slices.
export function create(opts = {}) {
  const getRefs = typeof opts.getRefs === 'function' ? opts.getRefs : (() => ({}));
  const setRefs = typeof opts.setRefs === 'function' ? opts.setRefs : (() => {});
  const lifecycle = opts.lifecycle || null;
  const sceneRuntime = opts.sceneRuntime || null;
  // Keep one stable lifecycle instance per editor. Recreating EditorLifecycle
  // for each command used to leave lifecycle ownership ambiguous and made a
  // future renderer/runtime cut-over unnecessarily risky.
  const refs = {};

  const lifecycleApi = createEditorLifecycle({
    ...opts,
    lifecycle,
    refs,
    disposeRuntimeResources: sceneRuntime ? (() => sceneRuntime.dispose?.()) : null,
    syncRefsFromHost: () => Object.assign(refs, getRefs() || {}),
    syncHostFromRefs: () => setRefs(refs),
  });
  let disposed = false;

  return {
    mount() { return disposed ? false : lifecycleApi.resume(); },
    resume() { return disposed ? false : lifecycleApi.resume(); },
    pause() { return disposed ? false : lifecycleApi.pause(); },
    dispose() {
      if (disposed) return false;
      disposed = true;
      lifecycleApi.dispose();
      return true;
    },
    refreshI18n() { return lifecycleApi.refreshI18n(); },
  };
}

export const EngineRuntime = { create };
