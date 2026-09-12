import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');
const start = source.indexOf('function onOrbitPointerUp(e)');
const end = source.indexOf('// ── EVENT WIRING', start);
const body = start >= 0 && end >= 0 ? source.slice(start, end) : '';
const sync = 'refs.currentMesh = getCurrentMesh();';
const apply = 'applyViewportRuntimeRefs(refs);';
if (body.indexOf(sync) < 0 || body.indexOf(sync) > body.indexOf(apply)) {
  throw new Error('pointer-up must synchronize the post-selection mesh before applying viewport refs');
}
console.log('viewport-selection-sync: PASS');
