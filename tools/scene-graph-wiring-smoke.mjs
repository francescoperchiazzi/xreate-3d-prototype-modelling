const { movePartInTree, syncAssemblyRootOrderFromTree } = await import('../engine/core/scene-graph-wiring.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const removed = [];
const added = [];
const meshA = { id: 'mesh-a' };
const meshB = { id: 'mesh-b' };
const root = {
  children: [meshA, meshB],
  remove: (mesh) => removed.push(mesh.id),
  add: (mesh) => added.push(mesh.id),
};
const shapes = [{ id: 'a', _mesh: meshA }, { id: 'b', _mesh: meshB }];
syncAssemblyRootOrderFromTree({ assemblyRoot: root, getShapeList: () => shapes });
assert(removed.join(',') === 'mesh-a,mesh-b' && added.join(',') === 'mesh-a,mesh-b', 'scene graph order did not mirror the project tree');

let rendered = 0;
let status = null;
movePartInTree({
  partId: 'a', delta: 1, assemblyRoot: root, getShapeList: () => shapes,
  mutateProject: (mutation) => mutation(), renderTreeUI: () => { rendered += 1; },
  setStatusKey: (key) => { status = key; },
});
assert(shapes.map((part) => part.id).join(',') === 'b,a', 'move command did not reorder project parts');
assert(added.slice(-2).join(',') === 'mesh-b,mesh-a' && rendered === 1 && status === 'status_layer_order_updated', 'move command did not synchronize runtime and UI');
console.log('scene-graph-wiring: PASS');
