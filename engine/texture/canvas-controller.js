import { installCanvasInteractions } from '../image/canvas-interactions.js';

// Owns canvas-only drag state. LayerSession remains the owner of the selected
// layer and transform, so pointer events never write bridge-local UV objects.
export function create(opts = {}) {
  const session = opts.session || null;
  if (!session || typeof session.snapshot !== 'function' || typeof session.replaceRefs !== 'function') {
    throw new Error('TextureCanvasController requires a LayerSession');
  }
  const initial = session.snapshot();
  const refs = {
    activeLayerIndex: initial.activeLayerIndex,
    imageTransform: initial.imageTransform,
    canvasDragActive: false,
    canvasDragPointerId: null,
    canvasDragStartClient: { x: 0, y: 0 },
    draggingImage: false,
    prevImagePointer: { x: 0, y: 0 },
  };
  const syncRefsFromSession = () => {
    const current = session.snapshot();
    refs.activeLayerIndex = current.activeLayerIndex;
    refs.imageTransform = current.imageTransform;
  };
  const syncSessionFromRefs = () => {
    session.replaceRefs({
      activeLayerIndex: refs.activeLayerIndex,
      imageTransform: refs.imageTransform,
      imageBitmap: session.getMutableRefs().imageBitmap,
    });
  };

  return {
    install() {
      return installCanvasInteractions({
        ...opts,
        refs,
        syncRefsFromHost: syncRefsFromSession,
        syncHostFromRefs: syncSessionFromRefs,
      });
    },
  };
}
