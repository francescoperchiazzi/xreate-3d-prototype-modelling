import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [mapping, overlay] = await Promise.all([
  readFile(new URL('../engine/core/uv-mapping.js', import.meta.url), 'utf8'),
  readFile(new URL('../engine/canvas/uv-overlay.js', import.meta.url), 'utf8'),
]);

// The canvas net retains a human-readable TOP row and BOT row. Three's
// CanvasTexture orientation means the geometry must deliberately address the
// opposite V rows for its upward/downward faces.
assert(mapping.includes('top: boxRect(1, 2)'), 'upward-facing geometry must sample the displayed TOP texture cell');
assert(mapping.includes('bottom: boxRect(1, 0)'), 'downward-facing geometry must sample the displayed BOT texture cell');
assert(mapping.includes('front: boxRect(2, 1)') && mapping.includes('left: boxRect(1, 1)') && mapping.includes('back: boxRect(0, 1)') && mapping.includes('right: boxRect(3, 1)'), 'front-facing geometry must sample the atlas FRONT cell');
assert(overlay.includes("{ id: 'back', name: 'BACK', ...faceRect(0, 1) }") && overlay.includes("{ id: 'front', name: 'FRONT',...faceRect(2, 1) }") && overlay.includes("{ id: 'bottom', name: 'BOT',  ...faceRect(1, 2) }"), 'the visible box net must match the authored BACK/LEFT/FRONT/RIGHT atlas order');
console.log('box-uv-orientation: PASS');
