const project = {
  id: 'project-regression', name: 'Before', selectedId: null, textureMode: 'per-shape', shapes: [], meta: {},
};
let setNameCalls = 0;
globalThis.window = {
  XR: {
    __modules: {},
    ProjectState: {
      getProject: () => project,
      setProjectName: (name) => { setNameCalls += 1; project.name = name; return name; },
    },
  },
};
const {
  configureProjectStore,
  dispatchProject,
  getActiveLayerState,
  getProjectStore,
  syncProjectStore,
} = await import('../engine/core/project-store.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

configureProjectStore({ projectState: globalThis.window.XR.ProjectState });
syncProjectStore(project, 'test/bootstrap');
dispatchProject({ type: 'project/name-set', name: '  Renamed Project  ' });
assert(project.name === 'Renamed Project' && setNameCalls === 1, 'project name action did not use ProjectState authority');
assert(getProjectStore().name === 'Renamed Project' && getProjectStore().reason === 'project/name-set', 'project store did not publish the renamed snapshot');
dispatchProject({ type: 'project/name-set', name: '   ' });
assert(project.name === 'Untitled' && getProjectStore().name === 'Untitled', 'empty project name did not normalize to Untitled');
project.shapes = [{
  id: 'shape-a', activeLayerIndex: 0,
  layers: [{ id: 'layer-a', transform: { x: 3, y: 4, scale: 2, rot: 0, ratio: 1 } }],
}];
project.selectedId = 'shape-a';
syncProjectStore(project, 'test/layer-snapshot');
dispatchProject({ type: 'selection/uv-mode-set', uvMode: 'cylindrical' });
assert(project.shapes[0].uvMode === 'cylindrical', 'UV mode action did not update the selected part');
assert(getProjectStore().selection.uvMode === 'cylindrical', 'UV mode action did not refresh the canonical selection snapshot');
dispatchProject({ type: 'selection/island-set', selectedIslandId: 'island-2' });
assert(project.shapes[0].selectedIslandId === 'island-2', 'UV island action did not update the selected part');
assert(getProjectStore().selection.selectedIslandId === 'island-2', 'UV island action did not refresh the canonical selection snapshot');
const publicLayer = getActiveLayerState();
publicLayer.transform.x = 999;
assert(getActiveLayerState().transform.x === 3, 'public active-layer snapshot leaked mutable store state');
assert(project.shapes[0].layers[0].transform.x === 3, 'public active-layer snapshot mutated the project layer');
console.log('project-store: PASS');
