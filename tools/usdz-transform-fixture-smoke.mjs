import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildUSDZ, buildGLB, getLastUsdDebug } from '../engine/export/payload-builders.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approx(actual, expected, label) {
  assert(Math.abs(actual - expected) <= 0.00011, `${label}: expected ${expected}, got ${actual}`);
}

async function loadThree() {
  const source = await readFile(new URL('../vendor/three.min.js', import.meta.url), 'utf8');
  const context = { console, setTimeout, clearTimeout };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'three.min.js' });
  return context.THREE;
}

function readGlbJson(buffer) {
  const view = new DataView(buffer);
  assert(view.getUint32(0, true) === 0x46546c67, 'GLB magic is invalid');
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
}

function parseUsdaPoints(usda) {
  const match = usda.match(/point3f\[\] points = \[([^\]]+)\]/);
  assert(match, 'USDZ payload does not contain mesh points');
  return [...match[1].matchAll(/\(([^)]+)\)/g)].map((entry) => entry[1].split(',').map(Number));
}

function readFirstZipEntryName(buffer) {
  const view = new DataView(buffer);
  assert(view.getUint32(0, true) === 0x04034b50, 'USDZ must begin with a ZIP local header');
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const name = new TextDecoder().decode(new Uint8Array(buffer, 30, nameLength));
  const dataOffset = 30 + nameLength + extraLength;
  assert(dataOffset % 64 === 0, `USDZ first member data is not 64-byte aligned: ${dataOffset}`);
  return name;
}

function parseUsdaUvs(usda) {
  const match = usda.match(/texCoord2f\[\] primvars:st = \[([^\]]+)\]/);
  assert(match, 'USDZ payload does not contain UV coordinates');
  return [...match[1].matchAll(/\(([^)]+)\)/g)].map((entry) => entry[1].split(',').map(Number));
}

function parseUsdaFaceIndices(usda) {
  const match = usda.match(/int\[\] faceVertexIndices = \[([^\]]+)\]/);
  assert(match, 'USDZ payload does not contain face vertex indices');
  return match[1].split(',').map((value) => Number(value.trim()));
}

const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
function createTextureCanvas() {
  return {
    width: 1,
    height: 1,
    toDataURL: () => `data:image/png;base64,${onePixelPng}`,
    getContext: () => null,
  };
}

function readGlbUvs(buffer, gltf) {
  const accessorIndex = gltf.meshes[0].primitives[0].attributes.TEXCOORD_0;
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const jsonLength = new DataView(buffer).getUint32(12, true);
  const binaryStart = 20 + jsonLength + 8;
  return [...new Float32Array(buffer, binaryStart + bufferView.byteOffset, accessor.count * 2)];
}

function createFixture(THREE, { parented }) {
  const assemblyRoot = new THREE.Group();
  assemblyRoot.rotation.y = Math.PI / 7; // Export intentionally neutralizes this display rotation.
  const parent = new THREE.Group();
  parent.position.set(-0.75, 0.5, 1.25);
  parent.rotation.set(0, Math.PI / 9, 0);
  parent.scale.set(1.2, 0.8, 1.1);
  if (parented) assemblyRoot.add(parent);

  const geometry = new THREE.BufferGeometry();
  // A non-symmetric triangle makes translation, rotation and non-uniform scale observable.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  mesh.position.set(1, 2, 3);
  mesh.rotation.set(Math.PI / 6, 0, 0);
  mesh.scale.set(2, 3, 4);
  (parented ? parent : assemblyRoot).add(mesh);

  return {
    assemblyRoot,
    part: { id: parented ? 'parented-cube' : 'root-cube', name: parented ? 'Parented cube' : 'Root cube', _mesh: mesh, material: { baseColor: '#ffffff', roughness: 0.6, metalness: 0 } },
  };
}

async function validateVariant(THREE, parented) {
  const { assemblyRoot, part } = createFixture(THREE, { parented });
  const context = {
    THREE,
    getShapeList: () => [part],
    getAssemblyRoot: () => assemblyRoot,
    getProject: () => ({ textureMode: 'perPart' }),
  };

  // Establish the expected world matrix in the same neutral export frame.
  const displayRotation = assemblyRoot.rotation.y;
  assemblyRoot.rotation.y = 0;
  assemblyRoot.updateMatrixWorld(true);
  const expected = [];
  const vertex = new THREE.Vector3();
  const positions = part._mesh.geometry.attributes.position.array;
  for (let index = 0; index < positions.length; index += 3) {
    expected.push(vertex.set(positions[index], positions[index + 1], positions[index + 2]).applyMatrix4(part._mesh.matrixWorld).toArray());
  }
  const expectedPosition = new THREE.Vector3();
  const expectedQuaternion = new THREE.Quaternion();
  const expectedScale = new THREE.Vector3();
  part._mesh.matrixWorld.decompose(expectedPosition, expectedQuaternion, expectedScale);
  assemblyRoot.rotation.y = displayRotation;
  assemblyRoot.updateMatrixWorld(true);

  const glb = buildGLB(context);
  const gltf = readGlbJson(glb);
  const node = gltf.nodes[0];
  node.translation.forEach((value, index) => approx(value, expectedPosition.toArray()[index], `${parented ? 'parented' : 'root'} GLB translation`));
  node.scale.forEach((value, index) => approx(value, expectedScale.toArray()[index], `${parented ? 'parented' : 'root'} GLB scale`));

  const usdz = buildUSDZ(context);
  const debug = getLastUsdDebug();
  const points = parseUsdaPoints(debug?.usda || '');
  assert(points.length === expected.length, 'USDZ point count differs from source geometry');
  for (let index = 0; index < expected.length; index += 1) {
    points[index].forEach((value, axis) => approx(value, expected[index][axis], `${parented ? 'parented' : 'root'} USDZ point ${index}:${axis}`));
  }
  assert(debug.usda.includes('upAxis = "Y"'), 'USDZ must declare Y-up');
  assert(debug.usda.includes('metersPerUnit = 1'), 'USDZ must declare meters as units');
  assert(debug.usda.includes('interpolation = "faceVarying"'), 'USDZ must provide per-face-corner attributes for generated triangle meshes');
  assert(debug.usda.includes('uniform token subdivisionScheme = "none"'), 'USDZ must preserve the authored triangle mesh instead of invoking default subdivision');
  assert(!debug.usda.includes('Displacement_Shader'), 'USDZ must not author a second Preview Surface for an unused displacement output');

  const dir = await mkdtemp(join(tmpdir(), 'xreate-usdz-'));
  const file = join(dir, parented ? 'parented.usdz' : 'root.usdz');
  try {
    await writeFile(file, new Uint8Array(usdz));
    const validator = spawnSync('/usr/bin/usdchecker', [file], { encoding: 'utf8' });
    assert(validator.status === 0, `usdchecker rejected ${parented ? 'parented' : 'root'} fixture: ${validator.stdout}${validator.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function validateTexturedPackage(THREE) {
  const { assemblyRoot, part } = createFixture(THREE, { parented: false });
  const canvas = createTextureCanvas();
  const context = {
    THREE,
    getShapeList: () => [part],
    getAssemblyRoot: () => assemblyRoot,
    getProject: () => ({ textureMode: 'shared' }),
    getCompositeCanvas: () => canvas,
    partHasAnyVisibleLayerImage: () => true,
  };
  const glb = buildGLB(context);
  const gltf = readGlbJson(glb);
  const uvs = readGlbUvs(glb, gltf);
  assert(uvs[1] === 1 && uvs[3] === 1 && uvs[5] === 0, `GLB texture V must be mirrored for canvas pixels: ${uvs}`);

  const usdz = buildUSDZ(context);
  const debug = getLastUsdDebug();
  assert(readFirstZipEntryName(usdz) === 'XReate.usda', 'USDZ default USDA layer must be the first ZIP entry');
  assert(!debug.usda.includes('outputs:displacement.connect'), 'Textured USDZ must expose only its surface output for RealityKit PBR import');
  assert((debug.usda.match(/info:id = "UsdPreviewSurface"/g) || []).length === 1, 'Textured USDZ must author exactly one Preview Surface per material');
  const usdUvs = parseUsdaUvs(debug?.usda || '');
  assert(usdUvs[0][1] === 0 && usdUvs[1][1] === 0 && usdUvs[2][1] === 1, `USDZ must retain authored canvas UV V: ${JSON.stringify(usdUvs)}`);

  const dir = await mkdtemp(join(tmpdir(), 'xreate-usdz-textured-'));
  const file = join(dir, 'textured.usdz');
  try {
    await writeFile(file, new Uint8Array(usdz));
    const validator = spawnSync('/usr/bin/usdchecker', [file], { encoding: 'utf8' });
    assert(validator.status === 0, `usdchecker rejected textured package: ${validator.stdout}${validator.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function validateInvertedWindingRepair(THREE) {
  const assemblyRoot = new THREE.Group();
  // Clockwise face order, but outward authored normals: this is representative
  // of malformed custom geometry that Quick Look would otherwise backface-cull.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 1, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  assemblyRoot.add(mesh);
  buildUSDZ({
    THREE,
    getShapeList: () => [{ id: 'inverted-doodle', name: 'Inverted Doodle', type: 'doodle', _mesh: mesh, material: { baseColor: '#ffffff' } }],
    getAssemblyRoot: () => assemblyRoot,
    getProject: () => ({ textureMode: 'per-shape' }),
  });
  const usda = getLastUsdDebug()?.usda || '';
  assert(JSON.stringify(parseUsdaFaceIndices(usda)) === JSON.stringify([0, 2, 1]), 'USDZ must repair inverted custom triangle winding');
  assert(usda.includes('uniform token orientation = "rightHanded"'), 'USDZ must explicitly declare its repaired mesh orientation');
  assert(usda.includes('uniform bool doubleSided = 0'), 'USDZ must export a closed Doodle as an opaque exterior, not a two-sided shell');
}

const THREE = await loadThree();
await validateVariant(THREE, false);
await validateVariant(THREE, true);
await validateTexturedPackage(THREE);
validateInvertedWindingRepair(THREE);
console.log(JSON.stringify({ ok: true, check: 'USDZ root and parented transforms match GLB world-frame expectations; textured USDZ puts its root layer first, preserves 64-byte alignment, retains USD canvas UV V, and passes usdchecker' }));
