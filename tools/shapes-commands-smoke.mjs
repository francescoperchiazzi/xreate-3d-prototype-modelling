const { ShapeCommands, ProjectCommands } = await import('../engine/core/shapes-commands.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const project = { id: 'project', name: 'Before', selectedId: 'shape-a', shapes: [{ id: 'shape-a' }] };
const calls = [];
const projectState = {
  getProject: () => project,
  getSelectedId: () => project.selectedId,
  getSelectedPart: () => project.shapes[0],
  getShapeList: () => project.shapes,
  getShapeById: (id) => project.shapes.find((shape) => shape.id === id) || null,
  setProjectName: (name) => { project.name = name; },
};
ShapeCommands.configure({
  projectState,
  sceneCommands: {
    duplicatePart: (id) => calls.push(['duplicate', id]),
    deletePart: (id) => calls.push(['delete', id]),
    movePartInTree: (id, delta) => calls.push(['move', id, delta]),
  },
  setSelectedPart: (id) => { project.selectedId = id; },
  getArchetypeById: (id) => ({ id }),
  addPartFromArchetype: (arch) => ({ id: arch.id }),
});
assert(ProjectCommands.get() === project && ProjectCommands.getSelectedId() === 'shape-a', 'project facade did not use injected ProjectState');
ProjectCommands.setName('Renamed');
assert(project.name === 'Renamed', 'project name command did not use injected ProjectState');
assert(ShapeCommands.add('cube').id === 'cube', 'shape add did not route through injected controller');
ShapeCommands.duplicateSelected();
ShapeCommands.moveSelectedDown();
ShapeCommands.moveSelectedUp();
ShapeCommands.deleteSelected();
assert(JSON.stringify(calls) === JSON.stringify([
  ['duplicate', 'shape-a'], ['move', 'shape-a', 1], ['move', 'shape-a', -1], ['delete', 'shape-a'],
]), 'selected shape commands did not route through injected scene commands');
console.log('shapes-commands: PASS');
