import { createTextureAtlasExportAction } from './runtime.js';

export function createTextureAtlasExporter() {
  let runAction = null;
  return {
    configure(opts) {
      runAction = createTextureAtlasExportAction(opts);
      return runAction;
    },
    run() {
      if (typeof runAction !== 'function') throw new Error('exportTextureAtlas not configured');
      return runAction();
    },
  };
}
