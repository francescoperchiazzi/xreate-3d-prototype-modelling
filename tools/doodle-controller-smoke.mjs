import { addDoodleShapeToScene } from '../engine/shapes/doodle-controller.js';

class MockGeometry {
  constructor() { this.disposed = false; }
  dispose() { this.disposed = true; }
}
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { x: 0, y: 0, z: 0, copy: (value) => { this.position.x = value.x; this.position.y = value.y; this.position.z = value.z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1 };
    this.userData = {};
  }
}

const shapes = [];
const added = [];
let selected = null;
const builds = { polygon: 0, mirror: 0, revolve: 0 };
const context = {
  points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  params: { depth: 0.75 },
  opts: { name: 'Regression Doodle', position: { x: 1, y: 2, z: 3 } },
  mutateProject: (fn) => fn(),
  THREE: { Mesh: MockMesh, FrontSide: 'front' },
  buildDoodleFromPoints: () => { builds.polygon += 1; return new MockGeometry(); },
  buildDoodleMirrorFromPoints: () => { builds.mirror += 1; return new MockGeometry(); },
  buildDoodleRevolveFromPoints: () => { builds.revolve += 1; return new MockGeometry(); },
  applyUvModeToGeometry: (geometry) => geometry,
  getShapeList: () => shapes,
  newPartId: () => 'doodle-regression',
  createOffscreenCanvas: () => ({ canvas: {}, ctx: { fillStyle: '', fillRect() {} } }),
  createMaterial: () => ({}),
  assemblyRoot: { add: (mesh) => added.push(mesh) },
  getDefaultSpawnPosition: () => ({ x: 0, y: 0, z: 0 }),
  setSelectedPart: (id) => { selected = id; },
  setStatusKey: () => {},
  setStatus: () => {},
  ensureGizmo: () => {},
  fitViewportView: () => {},
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(addDoodleShapeToScene({ ...context, points: [] }) === null, 'invalid Doodle points were accepted');
const id = addDoodleShapeToScene(context);
assert(id === 'doodle-regression', 'Doodle id was not returned');
assert(shapes.length === 1 && added.length === 1, 'Doodle was not attached once to project and scene');
assert(selected === id, 'Doodle was not selected');
assert(shapes[0]._mesh !== null && shapes[0]._mesh.material.side === 'front', 'Doodle must render as an outward-facing solid');
assert(shapes[0].transform.position.x === 1 && shapes[0].transform.position.y === 2 && shapes[0].transform.position.z === 3, 'Doodle transform was not persisted');
const mirrorId = addDoodleShapeToScene({ ...context, opts: { mode: 'mirror' }, mode: 'mirror' });
assert(mirrorId === 'doodle-regression' && builds.mirror === 1 && shapes.at(-1).doodleMode === 'mirror', 'Mirror Doodle was not routed to the bilateral builder');
const revolveId = addDoodleShapeToScene({ ...context, points: [{ x: -1, y: -1 }, { x: -0.4, y: 1 }], opts: { mode: 'revolve' }, mode: 'revolve' });
assert(revolveId === 'doodle-regression' && builds.revolve === 1 && shapes.at(-1).doodleMode === 'revolve', 'Revolve Doodle was not routed to the lathe builder');
console.log('doodle-controller: PASS');
