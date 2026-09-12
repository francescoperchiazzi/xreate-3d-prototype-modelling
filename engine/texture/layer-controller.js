import * as LayerState from '../core/layers.js';

// Transitional controller: owns the ephemeral canvas/UI refs while LayerState
// remains the sole owner of serializable layer data and commands.
export function create(opts = {}) {
  const session = opts.session || null;
  const getRefs = session && typeof session.getMutableRefs === 'function'
    ? () => session.getMutableRefs()
    : (typeof opts.getRefs === 'function' ? opts.getRefs : (() => ({})));
  const setRefs = session && typeof session.replaceRefs === 'function'
    ? (refs) => session.replaceRefs(refs)
    : (typeof opts.setRefs === 'function' ? opts.setRefs : (() => {}));
  const context = () => ({ ...opts, refs: getRefs() || {} });
  const run = (fn, args = {}) => {
    const ctx = { ...context(), ...args };
    const result = fn(ctx);
    setRefs(ctx.refs);
    return result;
  };

  return {
    getCurrentLayers() { return LayerState.getCurrentLayers(context()); },
    getActiveLayer() { return LayerState.getActiveLayer(context()); },
    getSessionState() { return session && typeof session.snapshot === 'function' ? session.snapshot() : { ...getRefs() }; },
    commitActiveLayerTransform() { return run(LayerState.commitActiveLayerTransform); },
    updateActiveLayerTransform(patch) { return run(LayerState.updateActiveLayerTransform, { patch }); },
    setActiveLayer(idx) { return run(LayerState.setActiveLayer, { idx }); },
    toggleLayerVisibility(idx) { return run(LayerState.toggleLayerVisibility, { idx }); },
    clearLayerPolygonMask(idx) { return run(LayerState.clearLayerPolygonMask, { idx }); },
    duplicateLayer(idx) { return run(LayerState.duplicateLayer, { idx }); },
    renameLayer(idx, name, part) { return run(LayerState.renameLayer, { idx, name, part }); },
    deleteLayer(idx) { return run(LayerState.deleteLayer, { idx }); },
    moveLayer(idx, delta) { return run(LayerState.moveLayer, { idx, delta }); },
    addImageAsLayer(bmp, dataUrl) { return run(LayerState.addImageAsLayer, { bmp, dataUrl }); },
    syncVisibleToSelectedPart() { return run(LayerState.syncVisibleToSelectedPart); },
  };
}
