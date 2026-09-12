#!/usr/bin/env node
import assert from 'node:assert/strict';
import { clearAssembly } from '../engine/editor/part-resource-runtime.js';

const calls = [];
const disposable = (name) => ({ dispose() { calls.push(name); } });
const part = {
  id: 'part-a',
  _mesh: { geometry: disposable('geometry'), material: disposable('material') },
  _texture: disposable('texture'),
  _compositeCtx: {},
  _compositeCanvas: {},
};
const shapes = [part];
const refs = { currentMesh: part._mesh, currentArchetype: {}, drawingTexture: {}, selectionHelper: { geometry: disposable('helper-geometry'), material: disposable('helper-material') }, gizmoRoot: { visible: true } };
const assemblyRoot = { remove(mesh) { calls.push(mesh === part._mesh ? 'mesh' : 'unknown-mesh'); } };
const scene = { remove() { calls.push('selection-helper'); } };
const project = { selectedId: 'part-a', textureMode: 'shared', _sharedTexture: disposable('shared-texture'), meta: {} };

assert.equal(clearAssembly({ getShapeList: () => shapes, assemblyRoot, scene, project, refs }), true);
assert.deepEqual(shapes, []);
assert.equal(project.selectedId, null);
assert.equal(project.textureMode, 'per-shape');
assert.equal(refs.currentMesh, null);
assert.equal(refs.selectionHelper, null);
assert.equal(refs.gizmoRoot.visible, false);
for (const name of ['mesh', 'geometry', 'material', 'texture', 'shared-texture', 'selection-helper']) assert.ok(calls.includes(name), `${name} was not disposed`);
console.log(JSON.stringify({ ok: true, checks: ['dispose-gpu-resources', 'clear-selection', 'reset-project'] }));
