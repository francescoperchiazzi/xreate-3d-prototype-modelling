import { createGLBExporter } from '../engine/export/glb.js';
import { createUSDZExporter } from '../engine/export/usdz.js';
import { createTextureAtlasExporter } from '../engine/export/atlas.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const factory of [createGLBExporter, createUSDZExporter, createTextureAtlasExporter]) {
  const exporter = factory();
  let rejected = false;
  try { exporter.run(); } catch (_) { rejected = true; }
  assert(rejected, 'exporter accepted run before configuration');
  const notices = [];
  exporter.configure({ getShapeList: () => [], showToast: (message) => notices.push(message), tr: (key) => key });
  exporter.run();
  assert(notices.length === 1, 'configured exporter did not run its injected empty-scene guard');
}
console.log('exporter-factories: PASS');
