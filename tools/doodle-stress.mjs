// Deterministic Doodle stress matrix. This exercises production Three
// geometry, controller normalization, persistence hydration and the modal's
// touch/image safeguards without requiring a browser runner.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const threeSource = await readFile(new URL('../vendor/three.min.js', import.meta.url), 'utf8');
vm.runInThisContext(threeSource, { filename: 'three.min.js' });
globalThis.window = { THREE: globalThis.THREE };

const THREE = globalThis.THREE;
const builders = await import('../engine/shapes/builders/advanced.js');
const { createDoodlePart } = await import('../engine/shapes/doodle-controller.js');
const { ProjectIO } = await import('../engine/persistence/project-io.js');

function finiteGeometry(geometry, label) {
  assert(geometry?.attributes?.position?.count > 0, `${label}: geometry was not created`);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    assert(Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i)), `${label}: non-finite vertex ${i}`);
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  assert(box && Number.isFinite(box.min.x) && Number.isFinite(box.max.x) && Number.isFinite(box.min.y) && Number.isFinite(box.max.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.z), `${label}: invalid bounding box`);
  assert(box.max.x > box.min.x || box.max.y > box.min.y || box.max.z > box.min.z, `${label}: zero-sized geometry`);
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function polygonFor(seed) {
  const next = random(seed);
  const count = 4 + (seed % 6);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    // Alternating radii make controlled concavity without self-intersection.
    const radius = (i % 2 ? 120 : 190) + next() * 32;
    out.push({ x: 360 + Math.cos(angle) * radius, y: 260 + Math.sin(angle) * radius });
  }
  return out;
}

function halfContourFor(seed) {
  const next = random(seed * 31 + 7);
  const count = 3 + (seed % 6);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    out.push({ x: -(60 + next() * 170), y: 70 + t * 380 + (next() - 0.5) * 22 });
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

function profileFor(seed) {
  const next = random(seed * 97 + 11);
  const count = 2 + (seed % 6);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    out.push({ x: -(42 + next() * 210), y: 70 + t * 380 });
  }
  return out;
}

const depths = [0.05, 0.1, 0.5, 1.5, 3];
const segments = [12, 16, 32, 64, 128];
let polygonCases = 0;
let mirrorCases = 0;
let revolveCases = 0;

const explicitPolygons = [
  [{ x: 120, y: 100 }, { x: 540, y: 130 }, { x: 320, y: 410 }],
  [{ x: 90, y: 90 }, { x: 620, y: 90 }, { x: 620, y: 430 }, { x: 90, y: 430 }],
  [{ x: 90, y: 90 }, { x: 620, y: 90 }, { x: 620, y: 210 }, { x: 360, y: 210 }, { x: 360, y: 430 }, { x: 90, y: 430 }],
];
for (const points of explicitPolygons) {
  for (const depth of depths) {
    const geometry = builders.buildDoodleFromPoints(points, { depth });
    finiteGeometry(geometry, `polygon fixture depth=${depth}`);
    geometry.dispose();
    polygonCases += 1;
  }
}

for (let seed = 1; seed <= 18; seed += 1) {
  const polygon = polygonFor(seed);
  const contour = halfContourFor(seed);
  const originalContour = JSON.stringify(contour);
  const profile = profileFor(seed);
  for (const depth of depths) {
    const polygonGeometry = builders.buildDoodleFromPoints(polygon, { depth });
    finiteGeometry(polygonGeometry, `polygon fuzz seed=${seed} depth=${depth}`);
    polygonGeometry.dispose();
    polygonCases += 1;

    const mirrorGeometry = builders.buildDoodleMirrorFromPoints(contour, { depth });
    finiteGeometry(mirrorGeometry, `mirror fuzz seed=${seed} depth=${depth}`);
    const box = mirrorGeometry.boundingBox;
    assert(box.min.x < 0 && box.max.x > 0 && Math.abs(box.min.x + box.max.x) < 0.0001, `mirror fuzz seed=${seed}: bilateral silhouette is not symmetric`);
    const rawEdges = new THREE.WireframeGeometry(mirrorGeometry);
    const cleanEdges = new THREE.EdgesGeometry(mirrorGeometry, 1);
    assert(cleanEdges.attributes.position.count < rawEdges.attributes.position.count, `mirror fuzz seed=${seed}: clean wireframe did not eliminate cap triangulation`);
    rawEdges.dispose();
    cleanEdges.dispose();
    mirrorGeometry.dispose();
    assert(JSON.stringify(contour) === originalContour, `mirror fuzz seed=${seed}: builder mutated the authored contour`);
    mirrorCases += 1;
  }
  for (const count of segments) {
    const revolveGeometry = builders.buildDoodleRevolveFromPoints(profile, { segments: count });
    finiteGeometry(revolveGeometry, `revolve fuzz seed=${seed} segments=${count}`);
    const box = revolveGeometry.boundingBox;
    assert(box.min.z < -0.001 && box.max.z > 0.001, `revolve fuzz seed=${seed}: profile was not lathed through 360 degrees`);
    revolveGeometry.dispose();
    revolveCases += 1;
  }
}

function makeContext(mode, points, params) {
  const added = [];
  return {
    mode, points, params, id: `controller-${mode}`, name: `Controller ${mode}`,
    THREE, assemblyRoot: { add: (mesh) => added.push(mesh) },
    createMaterial: (material) => new THREE.MeshBasicMaterial({ color: material.baseColor }),
    createOffscreenCanvas: () => ({ canvas: {}, ctx: { fillStyle: '', fillRect() {} } }),
    buildDoodleFromPoints: builders.buildDoodleFromPoints,
    buildDoodleMirrorFromPoints: builders.buildDoodleMirrorFromPoints,
    buildDoodleRevolveFromPoints: builders.buildDoodleRevolveFromPoints,
    applyUvModeToGeometry: (geometry) => geometry,
    position: new THREE.Vector3(1, 2, 3), rotation: new THREE.Euler(0.1, 0.2, 0.3), scale: new THREE.Vector3(1.2, 0.8, 1.1),
    added,
  };
}

const controllerFixtures = [
  ['polygon', polygonFor(3), { depth: -2 }, 0.5],
  ['mirror', halfContourFor(4), { depth: 9 }, 9],
  ['revolve', profileFor(5), { segments: 2 }, 12],
  ['revolve', profileFor(6), { segments: 900 }, 128],
];
for (const [mode, points, params, expected] of controllerFixtures) {
  const ctx = makeContext(mode, points, params);
  const part = createDoodlePart(ctx);
  assert(part && ctx.added.length === 1 && part.doodleMode === mode, `controller ${mode}: part was not created`);
  if (mode === 'revolve') assert(part.params.segments === expected, `controller ${mode}: segment clamp failed`);
  else assert(part.params.depth === expected, `controller ${mode}: depth normalization failed`);
  assert(part.transform.position.x === 1 && part.transform.rotation.y === 0.2 && part.transform.scale.z === 1.1, `controller ${mode}: transform was not persisted`);
  part._mesh.geometry.dispose();
  part._mesh.material.dispose();
}

const project = { id: 'before', name: 'Before', shapes: [], selectedId: null, textureMode: 'per-shape' };
const attached = [];
const io = ProjectIO.create({
  THREE, CANVAS_SIZE: 16, getProject: () => project, getShapeList: () => project.shapes,
  setShapeList: (shapes) => { project.shapes = shapes; }, setSelectedId: (id) => { project.selectedId = id; },
  clearAssembly: () => { project.shapes = []; }, uuid: () => 'new-id', resetProjectUndoArm: () => {}, updateProjectNameUi: () => {},
  getEditorBg: () => '#000', newPartId: () => 'generated', newLayerId: () => 'layer', getAssemblyRoot: () => ({ add: (mesh) => attached.push(mesh) }),
  createOffscreenCanvas: () => ({ canvas: {}, ctx: { fillStyle: '', fillRect() {} } }), createMaterial: (state) => new THREE.MeshBasicMaterial({ color: state.baseColor }),
  buildDoodleFromPoints: builders.buildDoodleFromPoints, buildDoodleMirrorFromPoints: builders.buildDoodleMirrorFromPoints, buildDoodleRevolveFromPoints: builders.buildDoodleRevolveFromPoints,
  applyUvModeToGeometry: (geometry) => geometry, getArchetypeById: () => null, createPartFromArchetype: () => null, getDefaultUvModeForArchetypeId: () => 'box',
  applyMaterialStateToMesh: () => {}, applyCustomUvToGeometry: () => {}, resolveUndoAssetAsync: async () => null, drawDataUrlToCanvas: async () => {}, ensureSrgbTexture: () => {},
  loadImageFromDataUrl: async () => null, setSelectedPart: (id) => { project.selectedId = id; }, updateShapeTransformControlsFromSelected: () => {}, renderShapeParamsUI: () => {},
  setStatusKey: () => {}, setStatus: () => {}, gcUndoAssets: () => {}, applyUvCheckerToAllShapes: async () => {},
});
await io.loadProjectFromPayload({ format: 'xreate', version: '2.2.0', project: {
  id: 'doodle-stress', name: 'Doodle stress', textureMode: 'per-shape', selectedId: 'persist-revolve', shapes: [
    { id: 'persist-polygon', type: 'doodle', doodleMode: 'polygon', doodlePoints: polygonFor(9), params: { depth: 0.15 }, material: { baseColor: '#ff0000' }, transform: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { id: 'persist-mirror', type: 'doodle', doodleMode: 'mirror', doodlePoints: halfContourFor(10), params: { depth: 1.2 }, material: { baseColor: '#00ff00' }, transform: { position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0.2, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
    { id: 'persist-revolve', type: 'doodle', doodleMode: 'revolve', doodlePoints: profileFor(11), params: { segments: 96 }, material: { baseColor: '#0000ff' }, transform: { position: { x: 3, y: 0, z: 0 }, rotation: { x: 0, y: 0.4, z: 0 }, scale: { x: 1, y: 1, z: 1 } } }
  ]
} });
assert(project.shapes.length === 3 && attached.length === 3, 'persistence: all Doodle modes were not hydrated');
assert(project.selectedId === 'persist-revolve', 'persistence: selected Doodle was not restored');
assert(project.shapes.map((shape) => shape.doodleMode).join(',') === 'polygon,mirror,revolve', 'persistence: Doodle modes changed during hydration');
assert(project.shapes[1].material.baseColor === '#00ff00' && project.shapes[2].params.segments === 96, 'persistence: Doodle material or parameters changed during hydration');
for (const shape of project.shapes) {
  shape._mesh.geometry.dispose();
  shape._mesh.material.dispose();
}

const doodleModal = await readFile(new URL('../shell/doodle-modal.js', import.meta.url), 'utf8');
assert(doodleModal.includes('normalizeTraceBitmap') && doodleModal.includes('maxDimension = 2048'), 'touch/image: source photos must be normalized before tracing');
assert(doodleModal.includes('if (usesHalfCanvas())') && doodleModal.includes('x: -dw / 2'), 'touch/image: Mirror and Revolve references must be centred on their construction axis');
assert(doodleModal.includes('pointercancel') && doodleModal.includes('activePointerId'), 'touch/image: cancelled or multi-touch gestures must not commit phantom points');

console.log(JSON.stringify({ ok: true, polygonCases, mirrorCases, revolveCases, controllerCases: controllerFixtures.length, persistenceModes: 3, check: 'Doodle stress matrix passed' }));
