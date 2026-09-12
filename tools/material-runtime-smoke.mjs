const { applyMaterialFlagsForPart, applyMaterialStateToMesh, rebuildAllMaterials, toggleFlatLighting, toggleWireframe } = await import('../engine/core/material-runtime.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let disposed = 0;
const oldPerPart = { dispose: () => { disposed += 1; } };
const oldSharedA = { dispose: () => { disposed += 1; } };
const oldSharedB = { dispose: () => { disposed += 1; } };
const perTexture = { id: 'per' };
const sharedTexture = { id: 'shared' };
const shapes = [
  { id: 'per', material: { baseColor: '#fff' }, _texture: perTexture, _mesh: { material: oldPerPart } },
  { id: 'shared', material: { baseColor: '#000' }, _texture: perTexture, _mesh: { material: [oldSharedA, oldSharedB] } },
];
let created = 0;
const rebuiltPer = rebuildAllMaterials({
  getShapeList: () => [shapes[0]], getProject: () => ({ textureMode: 'per-shape' }), wireframeOn: true,
  createMaterial: () => ({ id: `next-${++created}` }), applyMaterialFlagsForPart: () => {},
});
assert(rebuiltPer === 1 && shapes[0]._mesh.material.map === perTexture && shapes[0]._mesh.material.wireframe, 'per-shape material did not retain its own texture/display flag');
const rebuiltShared = rebuildAllMaterials({
  getShapeList: () => [shapes[1]], getProject: () => ({ textureMode: 'shared', _sharedTexture: sharedTexture }), wireframeOn: false,
  createMaterial: () => ({ id: `next-${++created}` }), applyMaterialFlagsForPart: () => {},
});
assert(rebuiltShared === 1 && shapes[1]._mesh.material.map === sharedTexture && !shapes[1]._mesh.material.wireframe, 'shared material did not retain the project texture');
assert(disposed === 3, 'every replaced material was not disposed exactly once');

const sideConstants = { FrontSide: 0, DoubleSide: 2 };
const openShellMaterial = {};
applyMaterialFlagsForPart({ part: { type: 'cylinder', params: { openEnded: true } }, mat: openShellMaterial, THREE: sideConstants });
assert(openShellMaterial.side === sideConstants.DoubleSide, 'an open capped primitive must render its interior so contents remain visible through the opening');
applyMaterialFlagsForPart({ part: { type: 'cylinder', params: { openEnded: false } }, mat: openShellMaterial, THREE: sideConstants });
assert(openShellMaterial.side === sideConstants.FrontSide, 'closing end caps must restore the normal front-facing material contract');

const openShellPart = { type: 'cylinder', params: { openEnded: true }, material: {}, _mesh: { material: {} } };
assert(applyMaterialStateToMesh({ part: openShellPart, THREE: sideConstants, wireframeOn: false }), 'material state must update an open shell');
assert(openShellPart._mesh.material.side === sideConstants.DoubleSide, 'material state must preserve the open-shell interior contract without relying on texture application');

const buttonState = {};
const documentRef = { getElementById: (id) => ({
  setAttribute: (_key, value) => { buttonState[id] = value; },
  classList: { toggle: () => {} },
}) };
const displayRefs = { wireframeOn: false, flatLightingOn: false };
const displayPart = { _mesh: { material: {} } };
assert(toggleWireframe({ refs: displayRefs, document: documentRef, getShapeList: () => [displayPart] }), 'wireframe toggle did not enable');
assert(displayPart._mesh.material.wireframe && buttonState['btn-wireframe'] === 'true', 'wireframe UI/runtime state diverged');

const overlayLog = [];
class MockEdgesGeometry { constructor(geometry) { this.geometry = geometry; } dispose() { overlayLog.push('edges-dispose'); } }
class MockLineBasicMaterial { constructor(opts) { this.opts = opts; } dispose() { overlayLog.push('material-dispose'); } }
class MockLineSegments {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.userData = {}; }
}
const mirrorMesh = {
  geometry: { id: 'mirror-geo' }, material: { color: '#fff', transparent: false, opacity: 1, depthWrite: true }, renderOrder: 0,
  add: (child) => { mirrorMesh.child = child; }, remove: (child) => { if (mirrorMesh.child === child) mirrorMesh.child = null; },
};
const mirrorPart = { type: 'doodle', doodleMode: 'mirror', _mesh: mirrorMesh };
const mirrorRefs = { wireframeOn: false };
assert(toggleWireframe({ refs: mirrorRefs, document: documentRef, getShapeList: () => [mirrorPart], THREE: { EdgesGeometry: MockEdgesGeometry, LineBasicMaterial: MockLineBasicMaterial, LineSegments: MockLineSegments } }), 'mirrored Doodle wireframe did not enable');
assert(mirrorMesh.child && mirrorMesh.material.opacity === 0 && !mirrorMesh.material.wireframe, 'mirrored Doodle must draw clean geometric edges instead of cap triangulation');
assert(!toggleWireframe({ refs: mirrorRefs, document: documentRef, getShapeList: () => [mirrorPart], THREE: { EdgesGeometry: MockEdgesGeometry, LineBasicMaterial: MockLineBasicMaterial, LineSegments: MockLineSegments } }), 'mirrored Doodle wireframe did not disable');
assert(!mirrorMesh.child && mirrorMesh.material.opacity === 1 && !mirrorMesh.material.transparent && !mirrorMesh.material.wireframe, 'mirrored Doodle material was not restored after wireframe disabled');
let rebuilds = 0;
let persisted = 0;
let observedFlat = null;
assert(toggleFlatLighting({
  refs: displayRefs, document: documentRef,
  onStateChange: (refs) => { observedFlat = refs.flatLightingOn; },
  rebuildAllMaterials: () => { rebuilds += 1; }, persistViewportSettings: () => { persisted += 1; },
}), 'flat-lighting toggle did not enable');
assert(observedFlat && rebuilds === 1 && persisted === 1 && buttonState['btn-flatlight'] === 'true', 'flat-lighting state was not published before rebuild/persist');
console.log('material-runtime: PASS');
