import {
  bindViewportEventWiring,
  bindViewportResize,
  createViewportAnimator,
} from '../core/viewport-runtime.js';

// Owns the viewport lifecycle boundary. The host supplies adapters only for
// transitional state and commands; it no longer coordinates three independent
// runtime modules itself.
export function create(opts = {}) {
  let mounted = false;
  let animator = null;
  let resizeObserver = null;

  function mount() {
    if (mounted) return false;
    mounted = true;
    bindViewportEventWiring(opts);
    resizeObserver = bindViewportResize(opts);
    return true;
  }

  function frame() {
    if (!animator) animator = createViewportAnimator({
      ...opts,
      onMarkDirty: (markDirty) => opts.setMarkDirty && opts.setMarkDirty(markDirty),
    });
    return animator();
  }

  return {
    mount,
    frame,
    get resizeObserver() { return resizeObserver; },
  };
}
