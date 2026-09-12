import { state } from './state.js';
const listeners = new Set();
const transformOwners = typeof WeakMap === 'function' ? new WeakMap() : null;

function cloneTransform(value) {
  return { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat', ...(value || {}) };
}

const editor = state.editor = state.editor || {
  selection: { partId: null, activeLayerIndex: 0, uvMode: 'planar', selectedIslandId: null },
  layer: { partId: null, layerId: null, transform: cloneTransform() },
  shadowMismatches: [],
};

export function getEditorState() { return editor; }
export function subscribeEditorState(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function publish(reason) {
  for (const listener of listeners) {
    try { listener(editor, reason); } catch (err) { console.error('[editor-store] subscriber failed', err); }
  }
}

export function syncSelectionShadow(part, opts = {}) {
  const index = Number(part?.activeLayerIndex) || 0;
  const layer = Array.isArray(part?.layers) ? (part.layers[Math.max(0, Math.min(index, part.layers.length - 1))] || null) : null;
  editor.selection = { partId: part?.id || null, activeLayerIndex: layer ? index : 0, uvMode: part?.uvMode || 'planar', selectedIslandId: part?.selectedIslandId || null };
  editor.layer = { partId: part?.id || null, layerId: layer?.id || null, transform: cloneTransform(layer?.transform || part?.imageTransform) };
  if (layer?.transform && transformOwners) {
    const owner = transformOwners.get(layer.transform);
    if (owner && owner !== part.id) {
      const mismatch = { kind: 'shared-layer-transform', previousPartId: owner, partId: part.id, layerId: layer.id };
      editor.shadowMismatches.push(mismatch);
      console.error('[editor-store] ownership assertion failed', mismatch);
    } else transformOwners.set(layer.transform, part.id);
  }
  if (opts.legacyTransform && JSON.stringify(editor.layer.transform) !== JSON.stringify(cloneTransform(opts.legacyTransform))) {
    const mismatch = { kind: 'legacy-transform-mismatch', partId: part?.id || null, layerId: layer?.id || null };
    editor.shadowMismatches.push(mismatch);
    console.warn('[editor-store] shadow mismatch', mismatch);
  }
  publish('selection-sync');
  return editor;
}
