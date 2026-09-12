#!/usr/bin/env node
import assert from 'node:assert/strict';

const scheduled = [];
let nextRaf = 0;
globalThis.window = { XR: { __modules: {} } };
globalThis.requestAnimationFrame = (callback) => {
  nextRaf += 1;
  scheduled.push({ id: nextRaf, callback });
  return nextRaf;
};

// Both imports intentionally use the same canonical ESM URL. Adding a query
// string to only one of them creates a second module singleton and tests a
// cache artefact rather than the runtime dependency graph.
const { state } = await import('../engine/core/state.js');
const { configure, tick } = await import('../engine/core/render-loop.js');
state.lifecycle = { paused: false, rafId: null };
let frames = 0;
configure({ frame() { frames += 1; } });
tick();
tick();
assert.equal(scheduled.length, 1, 'a second tick must not schedule a second RAF');
const first = scheduled.shift();
first.callback();
assert.equal(frames, 1, 'the configured core frame runs exactly once per RAF');
assert.equal(scheduled.length, 1, 'each frame schedules only its successor');
state.lifecycle.paused = true;
const final = scheduled.shift();
final.callback();
assert.equal(frames, 1, 'paused lifecycle must not render');
assert.equal(state.lifecycle.rafId, null, 'paused lifecycle releases RAF ownership');
console.log(JSON.stringify({ ok: true, frames, rafsAllocated: nextRaf }));
