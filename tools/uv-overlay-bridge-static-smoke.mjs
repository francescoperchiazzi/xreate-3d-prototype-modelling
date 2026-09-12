import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');
if (!/function toRgba\(rgb, alpha\)/.test(source)) {
  throw new Error('UV overlay bridge must define the shared toRgba helper outside theme refresh');
}
if (/^\s*rgba,\s*$/m.test(source)) {
  throw new Error('UV overlay bridge must pass the defined toRgba helper, not an unbound rgba shorthand');
}
const passes = (source.match(/rgba:\s*toRgba,/g) || []).length;
if (passes < 6) throw new Error(`UV overlay bridge expected six toRgba passes, found ${passes}`);
console.log('uv-overlay-bridge-static: PASS');
