import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../shell/scene-panels.js', import.meta.url), 'utf8');
const start = source.indexOf("on(nameBtn, 'click'");
const end = source.indexOf("on(nameBtn, 'dblclick'", start);
const handler = start >= 0 && end >= 0 ? source.slice(start, end) : '';

if (!handler.includes('setSelectedPart(p.id, { silent: true });')) {
  throw new Error('A single click on a Composition entity name must select it');
}
if (/setTimeout\s*\(/.test(handler)) {
  throw new Error('Composition selection must not be delayed behind a rename timer');
}

console.log(JSON.stringify({ ok: true, check: 'Composition selection is immediate before inspector controls update' }));
