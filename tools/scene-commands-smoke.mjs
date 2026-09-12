const { configure, duplicatePart, movePartInTree, renamePart, setPartVisibility, togglePartLocked } = await import('../engine/core/scene-commands.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
const part = { id: 'part-a', name: 'Before', visible: true, locked: false };
const projectState = {
  renameShape: (id, name) => { calls.push(['rename', id, name]); part.name = name; return part; },
  setShapeVisibility: (id, visible) => { calls.push(['visible', id, visible]); part.visible = visible; return part; },
  toggleShapeLocked: (id) => { calls.push(['lock', id]); part.locked = !part.locked; return part; },
};
configure({
  projectState,
  shapeFactory: { duplicatePart: (ctx) => calls.push(['duplicate', ctx.partId]) },
  sceneGraphWiring: { movePartInTree: (ctx) => calls.push(['move', ctx.partId, ctx.delta]) },
});
duplicatePart('part-a');
movePartInTree('part-a', -1);
renamePart('part-a', 'After');
setPartVisibility('part-a', false);
togglePartLocked('part-a');
assert(JSON.stringify(calls) === JSON.stringify([
  ['duplicate', 'part-a'], ['move', 'part-a', -1], ['rename', 'part-a', 'After'], ['visible', 'part-a', false], ['lock', 'part-a'],
]), 'scene commands did not route through injected authorities');
assert(part.name === 'After' && !part.visible && part.locked, 'project state commands did not apply');
console.log('scene-commands: PASS');
