#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnHumanoidKit } from '../engine/shapes/humanoid-controller.js';

class Vector3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

const shapes = [];
const calls = { mutate: 0, tree: 0, status: 0, selected: null };
let serial = 0;
const result = spawnHumanoidKit({
  THREE: { Vector3 },
  opts: { position: new Vector3(10, 20, 30) },
  mutateProject(fn) { calls.mutate += 1; fn(); },
  getShapeList: () => shapes,
  getArchetypeById: (id) => ({ id }),
  createPartFromArchetype(archetype, options) {
    serial += 1;
    return { id: `part-${serial}`, archetype, options, _mesh: { position: options.position } };
  },
  setSelectedPart(id) { calls.selected = id; },
  renderTreeUI() { calls.tree += 1; },
  setStatusKey() { calls.status += 1; },
});

assert.equal(result.created, 15, 'the kit must create every canonical limb');
assert.equal(shapes.length, 15);
assert.equal(result.selectedId, 'part-1');
assert.equal(calls.selected, 'part-1');
assert.deepEqual(shapes[0]._mesh.position, new Vector3(10, 21.7, 30), 'the factory receives the final mesh position');
assert.deepEqual(shapes.at(-1)._mesh.position, new Vector3(10.13, 19.725, 30.1));
assert.deepEqual({ mutate: calls.mutate, tree: calls.tree, status: calls.status }, {
  mutate: 1, tree: 1, status: 1,
});

console.log(JSON.stringify({ ok: true, created: result.created, head: shapes[0]._mesh.position, foot: shapes.at(-1)._mesh.position }));
