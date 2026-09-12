globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};

const ProjectState = await import('../engine/core/project-state.js');
const { cloneLayersForDuplicate } = await import('../engine/shapes/factory.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let nextLayer = 0;
ProjectState.configureProjectState({ createLayerId: () => `copy-layer-${++nextLayer}` });
const bitmap = { immutable: true };
const source = {
  id: 'source-layer', label: 'Paint', imageBitmap: bitmap, imageDataUrl: 'data:image/png;base64,AA==',
  transform: { x: 4, y: 9, scale: 1.25, rot: 0.2, ratio: 1, tile: true, tileScale: 2 },
  polygonMaskPoints: [{ x: 0.1, y: 0.2 }], visible: true, maskLinked: false,
};
const first = cloneLayersForDuplicate([source])[0];
const second = cloneLayersForDuplicate([first])[0];
assert(first.id === 'copy-layer-1' && second.id === 'copy-layer-2', 'duplicate layers did not obtain state-owned IDs');
assert(first !== source && second !== first, 'A to B to C reused a layer object');
assert(first.transform !== source.transform && second.transform !== first.transform, 'A to B to C reused a UV transform');
assert(first.polygonMaskPoints !== source.polygonMaskPoints && second.polygonMaskPoints !== first.polygonMaskPoints, 'A to B to C reused a polygon mask');
assert(first.imageBitmap === bitmap && second.imageBitmap === bitmap, 'immutable bitmap data should remain reusable');
second.transform.x = 999;
second.polygonMaskPoints[0].x = 777;
assert(source.transform.x === 4 && first.transform.x === 4, 'editing C changed UV state of A or B');
assert(source.polygonMaskPoints[0].x === 0.1 && first.polygonMaskPoints[0].x === 0.1, 'editing C changed mask state of A or B');
console.log('shape-factory: PASS');
