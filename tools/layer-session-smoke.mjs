#!/usr/bin/env node
import assert from 'node:assert/strict';
import { create } from '../engine/texture/layer-session.js';

const original = { x: 5, scale: 2, tile: true };
const changes = [];
const session = create({ activeLayerIndex: 1, imageBitmap: { id: 'A' }, imageTransform: original }, (state) => changes.push(state));

original.scale = 99;
assert.equal(session.snapshot().imageTransform.scale, 2, 'session must not retain caller transform identity');

const mutable = session.getMutableRefs();
mutable.activeLayerIndex = 2;
mutable.imageTransform.x = 9;
session.replaceRefs(mutable);
assert.equal(session.snapshot().activeLayerIndex, 2);
assert.equal(session.snapshot().imageTransform.x, 9);
assert.equal(changes.length, 1, 'commit publishes exactly once');

const leakedSnapshot = session.snapshot();
leakedSnapshot.imageTransform.scale = 17;
assert.equal(session.snapshot().imageTransform.scale, 2, 'snapshots must not mutate session state');
assert.notEqual(session.snapshot().imageTransform, session.getMutableRefs().imageTransform, 'public snapshot must be a separate transform object');

console.log(JSON.stringify({ ok: true, checks: ['initial-clone', 'single-publish', 'snapshot-isolation'] }));
