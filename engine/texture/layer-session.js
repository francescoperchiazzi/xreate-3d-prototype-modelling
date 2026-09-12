// Ephemeral texture-editor state. Serializable layer data stays in ProjectStore;
// this module owns only the bitmap and the current canvas editing selection.
const DEFAULT_TRANSFORM = Object.freeze({
  x: 0, y: 0, scale: 1, rot: 0, ratio: 1,
  tile: false, tileScale: 1, tileAnchor: 'center', tileRepeat: 'repeat',
});

export function cloneTransform(value = {}) {
  return { ...DEFAULT_TRANSFORM, ...(value || {}) };
}

export function create(initial = {}, onChange = null) {
  let refs = {
    activeLayerIndex: Number.isInteger(initial.activeLayerIndex) ? initial.activeLayerIndex : 0,
    imageBitmap: initial.imageBitmap || null,
    imageTransform: cloneTransform(initial.imageTransform),
  };

  const publish = () => {
    if (typeof onChange === 'function') onChange(snapshot());
  };
  const snapshot = () => ({
    activeLayerIndex: refs.activeLayerIndex,
    imageBitmap: refs.imageBitmap,
    imageTransform: cloneTransform(refs.imageTransform),
  });

  return {
    // Internal integrations may mutate this object during one synchronous
    // command. They must call replaceRefs afterwards, which breaks references.
    getMutableRefs() { return refs; },
    snapshot,
    replaceRefs(next = {}) {
      refs = {
        activeLayerIndex: Number.isInteger(next.activeLayerIndex) ? next.activeLayerIndex : 0,
        imageBitmap: next.imageBitmap || null,
        imageTransform: cloneTransform(next.imageTransform),
      };
      publish();
      return refs;
    },
  };
}
