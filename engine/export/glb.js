import { createBinaryExportAction } from './runtime.js';

export function createGLBExporter() {
  let runAction = null;
  return {
    configure(opts) {
      runAction = createBinaryExportAction({
        ...opts,
        extension: 'glb',
        mimeType: 'model/gltf-binary',
        successTitleKey: 'modal_glb_title',
        successMessageKey: 'modal_glb_ready',
      });
      return runAction;
    },
    run() {
      if (typeof runAction !== 'function') throw new Error('exportGLB not configured');
      return runAction();
    },
  };
}
