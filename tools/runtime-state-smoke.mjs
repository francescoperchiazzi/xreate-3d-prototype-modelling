#!/usr/bin/env node
import assert from 'node:assert/strict';
import { state } from '../engine/core/state.js';

assert.ok(state.lifecycle && typeof state.lifecycle === 'object');
assert.ok(state.runtime && typeof state.runtime === 'object');
state.runtime.currentMesh = { id: 'fixture-mesh' };
assert.equal(state.runtime.currentMesh.id, 'fixture-mesh');
state.runtime.currentMesh = null;
state.runtime.drawingTexture = { id: 'fixture-texture' };
assert.equal(state.runtime.drawingTexture.id, 'fixture-texture');
state.runtime.drawingTexture = null;
state.runtime.wireframeOn = true;
state.runtime.flatLightingOn = true;
assert.equal(state.runtime.wireframeOn, true);
assert.equal(state.runtime.flatLightingOn, true);
state.runtime.wireframeOn = false;
state.runtime.flatLightingOn = false;
console.log(JSON.stringify({ ok: true, namespaces: Object.keys(state).sort() }));
