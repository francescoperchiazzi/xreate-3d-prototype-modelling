globalThis.window = {
  dispatchEvent() {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};

const ProjectState = await import('../engine/core/project-state.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let projectSequence = 0;
let layerSequence = 0;
ProjectState.configureProjectState({
  createProjectId: () => `project-${++projectSequence}`,
  createLayerId: () => `layer-${++layerSequence}`,
});

const project = ProjectState.setProject(null);
assert(project.id === 'project-1', 'default project did not use the state-owned ID generator');
assert(ProjectState.getProject() === project, 'getProject did not return the canonical project instance');
assert(ProjectState.createProjectId() === 'project-2', 'project ID factory is not exposed by ProjectState');
const layer = ProjectState.createLayer({ label: 'Regression layer' });
assert(layer.id === 'layer-1', 'createLayer did not use the state-owned layer ID generator');
assert(ProjectState.createLayerId() === 'layer-2', 'layer ID factory is not exposed by ProjectState');

console.log('project-state: PASS');
