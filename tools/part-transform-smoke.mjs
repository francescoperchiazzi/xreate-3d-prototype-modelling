#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyTransformToMesh, ensureTransformState, getShapeScaleFactors } from '../engine/core/part-transform.js';

function vector() {
  return { values: null, set(...values) { this.values = values; } };
}

const part = {
  visible: false,
  shapeScale: { x: 2, y: 3, z: 4 },
  transform: {
    position: { x: 1, y: -2, z: 3 },
    rotation: { x: 0.1, y: 0.2, z: 0.3 },
    scale: { x: 1.5, y: 2, z: 0.5 },
  },
  _mesh: { position: vector(), rotation: vector(), scale: vector(), visible: true },
};
let helperMesh = null;
let gizmoUpdates = 0;
let dirtyFrames = 0;
assert.equal(applyTransformToMesh({
  part,
  selectionHelper: { setFromObject(mesh) { helperMesh = mesh; } },
  updateGizmo() { gizmoUpdates += 1; },
  markDirty(frames) { dirtyFrames = frames; },
}), true);
assert.deepEqual(part._mesh.position.values, [1, -2, 3]);
assert.deepEqual(part._mesh.rotation.values, [0.1, 0.2, 0.3]);
assert.deepEqual(part._mesh.scale.values, [3, 6, 2]);
assert.equal(part._mesh.visible, false);
assert.equal(helperMesh, part._mesh);
assert.equal(gizmoUpdates, 1);
assert.equal(dirtyFrames, 30);
const blank = {};
assert.deepEqual(ensureTransformState(blank), { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } });
assert.deepEqual(getShapeScaleFactors({ shapeScale: { x: 2 } }), { x: 2, y: 1, z: 1 });
console.log(JSON.stringify({ ok: true, meshScale: part._mesh.scale.values, dirtyFrames }));
