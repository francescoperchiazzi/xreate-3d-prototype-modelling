globalThis.window = {
  XR: { __modules: {} },
  dispatchEvent() {},
};
const { assertLayerOwnership } = await import('../engine/core/project-state.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourceLayer = { id: 'source-layer', transform: { x: 1, scale: 1 } };
const copyLayer = { id: 'copy-layer', transform: { x: 1, scale: 1 } };
const independent = assertLayerOwnership([{ id: 'a', layers: [sourceLayer] }, { id: 'b', layers: [copyLayer] }]);
assert(independent.ok && independent.layerCount === 2 && independent.transformCount === 2, 'independent layers were rejected');

const sharedLayer = assertLayerOwnership([{ id: 'a', layers: [sourceLayer] }, { id: 'b', layers: [sourceLayer] }]);
assert(!sharedLayer.ok && sharedLayer.kind === 'layer' && sharedLayer.firstPartId === 'a' && sharedLayer.secondPartId === 'b', 'shared layer identity was not detected');

const sharedTransform = { x: 0, scale: 1 };
const transformAlias = assertLayerOwnership([
  { id: 'a', layers: [{ id: 'a-layer', transform: sharedTransform }] },
  { id: 'b', layers: [{ id: 'b-layer', transform: sharedTransform }] },
]);
assert(!transformAlias.ok && transformAlias.kind === 'transform', 'shared mutable transform was not detected');
console.log('layer-ownership: PASS');
