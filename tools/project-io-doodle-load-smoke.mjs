globalThis.window = { XR: { __modules: {} } };

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
class Euler extends Vector3 {}
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material; this.position = new Vector3();
    this.rotation = new Euler(); this.scale = new Vector3(1, 1, 1); this.userData = {};
  }
}
class CanvasTexture { constructor(canvas) { this.canvas = canvas; } }
const THREE = { Vector3, Euler, Mesh, CanvasTexture, DoubleSide: 'double' };

const { ProjectIO } = await import('../engine/persistence/project-io.js');
const project = { id: 'before', name: 'Before', shapes: [], selectedId: null, textureMode: 'per-shape', meta: {} };
const attached = [];
let selected = null;
let baseDraws = 0;
let overlays = 0;
let textureApplies = 0;
const api = ProjectIO.create({
  THREE, CANVAS_SIZE: 16, getProject: () => project, getShapeList: () => project.shapes,
  setShapeList: (shapes) => { project.shapes = shapes; }, setSelectedId: (id) => { project.selectedId = id; },
  clearAssembly: () => { project.shapes = []; }, uuid: () => 'new-id', resetProjectUndoArm: () => {},
  updateProjectNameUi: () => {}, getEditorBg: () => '#000', newPartId: () => 'generated', newLayerId: () => 'layer',
  getAssemblyRoot: () => ({ add: (mesh) => attached.push(mesh) }),
  createOffscreenCanvas: () => ({ canvas: {}, ctx: { fillStyle: '', fillRect() {} } }),
  createMaterial: (state) => ({ ...state }),
  buildDoodleFromPoints: () => ({ dispose() {} }), buildDoodleMirrorFromPoints: () => ({ dispose() {} }), buildDoodleRevolveFromPoints: () => ({ dispose() {} }),
  applyUvModeToGeometry: (geometry) => geometry, getArchetypeById: () => null,
  createPartFromArchetype: () => null, getDefaultUvModeForArchetypeId: () => 'box',
  applyMaterialStateToMesh: () => {}, applyCustomUvToGeometry: () => {},
  resolveUndoAssetAsync: async () => null, drawDataUrlToCanvas: async () => {}, ensureSrgbTexture: () => {},
  loadImageFromDataUrl: async () => null, setSelectedPart: (id) => { selected = id; },
  updateShapeTransformControlsFromSelected: () => {}, renderShapeParamsUI: () => {}, setStatusKey: () => {}, setStatus: () => {},
  gcUndoAssets: () => {}, applyUvCheckerToAllShapes: async () => {},
  drawBaseLayer: () => { baseDraws += 1; }, renderUvOverlay: () => { overlays += 1; }, requestApplyTexture: () => { textureApplies += 1; },
});
await api.loadProjectFromPayload({ format: 'xreate', project: {
  id: 'doodle-project', name: 'Doodle Project', textureMode: 'per-shape', selectedId: 'd1',
  shapes: [{ id: 'd1', name: 'Loaded Doodle', type: 'doodle', doodleMode: 'polygon', doodlePoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], params: { depth: 0.75 }, transform: { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0.5, z: 0 }, scale: { x: 2, y: 1, z: 1 } }, material: { baseColor: '#abc' }, visible: true, locked: false, layers: [] }],
} });
function assert(value, message) { if (!value) throw new Error(message); }
assert(project.shapes.length === 1 && attached.length === 1, 'Doodle was not attached once');
assert(project.shapes[0].id === 'd1' && project.shapes[0]._mesh.position.x === 1, 'Doodle transform/id was not hydrated');
assert(selected === 'd1', 'Doodle selection was not restored');
assert(baseDraws === 1 && overlays === 1 && textureApplies === 1, 'Loading must restore the final texture surface and UV overlay');
console.log('project-io-doodle-load: PASS');
