#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createExportConfigurations } from '../engine/export/configuration.js';
import { createBinaryExportAction } from '../engine/export/runtime.js';

const calls = [];
const shapes = [{ id: 'asymmetric-cube' }];
const project = { id: 'fixture-project' };
const configs = createExportConfigurations({
  getShapeList: () => shapes,
  getProject: () => project,
  getAssemblyRoot: () => ({ id: 'root' }),
  updateComposite: () => {},
  getCompositeCanvas: () => ({ id: 'canvas' }),
  partHasAnyVisibleLayerImage: () => false,
  THREE: { id: 'three' },
  getPayloadBuilders: () => ({
    buildGLB(ctx) { calls.push(['glb', ctx]); return 'glb-payload'; },
    buildUSDZ(ctx) { calls.push(['usdz', ctx]); return 'usdz-payload'; },
  }),
});
assert.equal(configs.glb.buildPayload(), 'glb-payload');
assert.equal(configs.usdz.buildPayload(), 'usdz-payload');
assert.equal(calls.length, 2);
assert.equal(calls[0][1].getShapeList(), shapes);
assert.equal(calls[1][1].getProject(), project);
assert.throws(() => createExportConfigurations({ getPayloadBuilders: () => ({}) }).usdz.buildPayload(), /buildUSDZ unavailable/);

const downloads = [];
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback) => { callback(); return 0; };
try {
  const exportNamedProject = createBinaryExportAction({
    getShapeList: () => [{ id: 'fixture' }],
    getProject: () => ({ id: 'xreate_internal_123', name: 'Tea Can', meta: { modified: 1788638430504 } }),
    buildPayload: () => new Uint8Array([1]),
    download: (_payload, filename) => downloads.push(filename),
    extension: 'usdz',
  });
  exportNamedProject();
} finally {
  globalThis.setTimeout = originalSetTimeout;
}
assert.deepEqual(downloads, ['Tea_Can.usdz'], 'user downloads must use the project name without internal IDs or timestamps');
console.log(JSON.stringify({ ok: true, methods: calls.map(([method]) => method) }));
