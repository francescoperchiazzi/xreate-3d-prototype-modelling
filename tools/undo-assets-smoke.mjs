#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveUndoAsset, resolveUndoAssetAsync } from '../engine/persistence/undo-assets.js';

const project = {
  _undoAssets: new Map([['ready', 'data:image/png;base64,ready']]),
  _undoAssetsPending: new Map([['pending', Promise.resolve('data:image/png;base64,pending')]]),
};
assert.equal(resolveUndoAsset(project, 'ready'), 'data:image/png;base64,ready');
assert.equal(resolveUndoAsset(project, 'missing'), null);
assert.equal(await resolveUndoAssetAsync(project, 'ready'), 'data:image/png;base64,ready');
assert.equal(await resolveUndoAssetAsync(project, 'pending'), 'data:image/png;base64,pending');
assert.equal(await resolveUndoAssetAsync(project, 'missing'), null);
const bridge = await readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');
assert.match(bridge, /owner\._undoAssets\.set\(ref, asset\)/, 'undo image assets must be persisted in the runtime asset registry');
assert.match(bridge, /owner\._undoAssetsPending\.set\(ref, pending\)/, 'async undo image serialization must remain resolvable while pending');
assert.doesNotMatch(bridge, /const internUndoAsset = \(asset\) => \(typeof asset !== 'undefined' \? asset : null\)/, 'legacy undo asset pass-through must not return unresolvable image payloads');
console.log(JSON.stringify({ ok: true }));
