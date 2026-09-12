import { create as createSession } from '../engine/texture/layer-session.js';
import { create as createImageWorkflowController } from '../engine/texture/image-workflow-controller.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const session = createSession({ activeLayerIndex: 0, imageTransform: { scale: 1 } });
const workflows = {
  async loadImageFromFile(ctx) {
    ctx.addImageAsLayer();
    return ctx.fitImageToCanvas();
  },
  fitImageToCanvas(ctx) {
    assert(ctx.refs.activeLayerIndex === 2, 'fit must receive refs created by the new layer');
    ctx.refs.imageTransform.scale = 3;
    return true;
  },
  fillImageToCanvas() { return true; },
  hydrateLayerBitmapIfNeeded() { return false; },
};
const controller = createImageWorkflowController({
  session,
  workflows,
  addImageAsLayer() {
    session.replaceRefs({ activeLayerIndex: 2, imageBitmap: { id: 'fresh-bitmap' }, imageTransform: { scale: 1 } });
  },
});

await controller.loadImageFromFile({ type: 'image/png' });
const state = session.snapshot();
assert(state.activeLayerIndex === 2, 'import must retain the new layer as active');
assert(state.imageTransform.scale === 3, 'fit transform must be persisted to the active layer session');
console.log('image-workflow-controller: PASS');
