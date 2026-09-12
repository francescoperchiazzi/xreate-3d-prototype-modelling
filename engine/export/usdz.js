import { createBinaryExportAction } from './runtime.js';

export function createUSDZExporter() {
  let runAction = null;
  return {
    configure(opts) {
      runAction = createBinaryExportAction({
        ...opts,
        extension: 'usdz',
        mimeType: 'model/vnd.usdz+zip',
        successTitleKey: 'modal_usdz_title',
        successMessageKey: 'modal_usdz_ready',
      });
      return runAction;
    },
    run() {
      if (typeof runAction !== 'function') throw new Error('exportUSDZ not configured');
      return runAction();
    },
  };
}
