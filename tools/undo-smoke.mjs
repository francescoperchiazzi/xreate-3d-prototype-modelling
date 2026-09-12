const { mutateProject, redoProject, undoProject } = await import('../engine/core/undo.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const project = { value: 'current', meta: {}, _undoStack: [{ value: 'previous' }], _redoStack: [] };
const loaded = [];
const ctx = {
  projectState: { getProject: () => project },
  buildProjectUndoPayload: () => ({ value: project.value }),
  loadProjectFromPayload: async (payload) => { loaded.push(payload.value); project.value = payload.value; },
  getUndoMaxSteps: () => 20,
  setStatusKey: () => {}, setStatus: () => {}, gcUndoAssets: () => {},
};
mutateProject({ ...ctx, fn: (next) => { next.value = 'mutated'; }, armProjectUndoSnapshot: () => {} });
assert(project.value === 'mutated' && Number.isFinite(project.meta.modified), 'mutation did not update injected project authority');
await undoProject(ctx);
assert(project.value === 'previous' && project._redoStack.length === 1, 'undo did not load the prior payload through the injected loader');
await redoProject(ctx);
assert(project.value === 'mutated' && loaded.join(',') === 'previous,mutated', 'redo did not restore the payload through the injected loader');
console.log('undo: PASS');
