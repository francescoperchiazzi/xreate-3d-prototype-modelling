import { setTextureMode } from '../engine/texture/mode-controller.js';

class CanvasTexture {
  constructor(canvas) { this.canvas = canvas; }
}

const parts = [
  { _mesh: { material: {} }, _compositeCanvas: { id: 'part-a' } },
  { _mesh: { material: {} }, _compositeCanvas: { id: 'part-b' } },
];
const project = { textureMode: 'shared' };
const refs = { drawingTexture: null };
const statuses = [];
const actions = [];
const context = {
  project,
  getProject: () => project,
  getShapeList: () => parts,
  mutateProject: (fn) => fn(),
  THREE: { CanvasTexture },
  compositeCanvas: { id: 'fallback' },
  ensureSrgbTexture: (texture) => { texture.srgb = true; },
  getSelectedPart: () => parts[1],
  requestApplyTexture: () => {},
  setStatusKey: (key) => statuses.push(key),
  dispatchProject: (action) => {
    actions.push(action);
    project.textureMode = action.textureMode;
  },
  refs,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(setTextureMode({ ...context, perShape: false }), 'shared transition did not run');
assert(project.textureMode === 'shared', 'shared transition stored the wrong mode');
assert(setTextureMode({ ...context, perShape: true }), 'per-shape transition did not run');
assert(project.textureMode === 'per-shape', 'per-shape transition stored the wrong mode');
assert(parts[0]._mesh.material.map !== parts[1]._mesh.material.map, 'per-shape textures share a mutable CanvasTexture');
assert(refs.drawingTexture === parts[1]._texture, 'selected texture reference was not synchronized');
assert(statuses.join(',') === 'status_texture_mode_shared,status_texture_mode_per_shape', 'texture-mode statuses are incomplete');
assert(actions.map((action) => action.type + ':' + action.textureMode).join(',') === 'texture-mode/set:shared,texture-mode/set:per-shape', 'texture mode bypassed the project dispatcher');

console.log('texture-mode-controller: PASS');
