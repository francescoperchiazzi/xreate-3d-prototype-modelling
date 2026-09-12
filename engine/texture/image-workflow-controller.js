import * as ImageWorkflows from '../image/workflows.js';

// Binds image workflows to the texture session. Workflow functions can stay
// small and DOM-agnostic while no caller can accidentally retain UV refs.
export function create(opts = {}) {
  const session = opts.session || null;
  const workflows = opts.workflows || ImageWorkflows;
  if (!session || typeof session.getMutableRefs !== 'function' || typeof session.replaceRefs !== 'function') {
    throw new Error('ImageWorkflowController requires a LayerSession');
  }
  const context = () => ({ ...opts, refs: session.getMutableRefs() });
  const run = (fn, args = {}) => {
    const ctx = { ...context(), ...args };
    const result = fn(ctx);
    session.replaceRefs(ctx.refs);
    return result;
  };

  return {
    hydrateLayerBitmapIfNeeded(layer, part) {
      return run(workflows.hydrateLayerBitmapIfNeeded, {
        layer,
        part,
        commitRefs: (refs) => session.replaceRefs(refs),
      });
    },
    fitImageToCanvas() { return run(workflows.fitImageToCanvas); },
    fillImageToCanvas() { return run(workflows.fillImageToCanvas); },
    loadImageFromFile(file) {
      // Import first creates a layer, and that command replaces LayerSession's
      // mutable refs. Run the follow-up fit through `run` so it reads those
      // new refs instead of the snapshot from before the async import.
      return workflows.loadImageFromFile({
        ...opts,
        file,
        fitImageToCanvas: () => run(workflows.fitImageToCanvas),
      });
    },
  };
}
