#!/usr/bin/env node
import { rebuildSelectedPartGeometry } from '../engine/shapes/geometry-controller.js';

function assert(condition, message) {
  if (!condition) throw new Error(`Geometry controller: ${message}`);
}

let oldDisposed = 0;
let infoUpdates = 0;
let uvUpdates = 0;
let viewportRefreshes = 0;
let textureRefreshes = 0;
let undoSnapshots = 0;
const material = {};
const part = {
  id: 'open-cylinder',
  type: 'cylinder',
  params: { openEnded: true },
  uvMode: 'cylindrical',
  _mesh: { geometry: { dispose: () => { oldDisposed += 1; } }, material },
};
const nextGeometry = { dispose: () => {} };

const rebuilt = rebuildSelectedPartGeometry({
  getSelectedPart: () => part,
  getArchetypeById: () => ({ build: () => nextGeometry }),
  applyUvModeToGeometry: (geometry) => geometry,
  armProjectUndoSnapshot: () => { undoSnapshots += 1; },
  applyMaterialFlagsForPart: (target, targetMaterial) => {
    assert(target === part && targetMaterial === material, 'must apply flags to the rebuilt selected mesh');
    targetMaterial.side = 'double';
  },
  updateInfoForMesh: () => { infoUpdates += 1; },
  renderUvOverlay: () => { uvUpdates += 1; },
  markViewportDirty: (frames) => { if (frames === 30) viewportRefreshes += 1; },
  requestApplyTexture: () => { textureRefreshes += 1; },
});

assert(rebuilt, 'geometry rebuild should succeed');
assert(oldDisposed === 1 && part._mesh.geometry === nextGeometry, 'previous geometry must be replaced and disposed');
assert(material.side === 'double', 'an open-end-cap rebuild must refresh material culling without a texture');
assert(undoSnapshots === 1 && infoUpdates === 1 && uvUpdates === 1 && viewportRefreshes === 1 && textureRefreshes === 1, 'the rebuild lifecycle must remain complete');
console.log('geometry-controller: PASS');
