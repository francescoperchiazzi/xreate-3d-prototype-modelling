#!/usr/bin/env node
import assert from 'node:assert/strict';

const listeners = new Map();
let nextInterval = 0;
const clearedIntervals = [];
globalThis.window = {
  XR: { __modules: {} },
  addEventListener(type, handler) {
    const entries = listeners.get(type) || [];
    entries.push(handler);
    listeners.set(type, entries);
  },
  removeEventListener(type, handler) {
    listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== handler));
  },
  setInterval() { nextInterval += 1; return nextInterval; },
  clearInterval(id) { clearedIntervals.push(id); },
};

const { create } = await import(`../shell/runtime.js?smoke=${Date.now()}`);
const calls = { resume: 0, pause: 0, dispose: 0, init: 0, update: 0 };
const handler = () => {};
const api = create({
  editorApi: {
    resume() { calls.resume += 1; },
    pause() { calls.pause += 1; },
    dispose() { calls.dispose += 1; },
  },
  onShellKeyDown: handler,
  initPerspectiveCorrection() { calls.init += 1; },
  initPBRTools() { calls.init += 1; },
  initRetroMode() { calls.init += 1; },
  initSeamlessTile() { calls.init += 1; },
  updateToolButtons() { calls.update += 1; },
});

api.resumeAll();
api.resumeAll();
assert.equal((listeners.get('keydown') || []).length, 1, 'resume must not attach duplicate keyboard handlers');
assert.equal(calls.init, 4, 'one-time tool initialization must not repeat');
api.pauseAll();
assert.equal((listeners.get('keydown') || []).length, 0, 'pause must detach keyboard handler');
api.resumeAll();
assert.equal((listeners.get('keydown') || []).length, 1, 'resume after pause must reattach keyboard handler');
assert.deepEqual(clearedIntervals, [1], 'pause must clear the active UI interval');
api.disposeAll();
assert.equal((listeners.get('keydown') || []).length, 0);
assert.equal(calls.dispose, 1);
assert.ok(calls.resume >= 3 && calls.pause >= 2);
console.log(JSON.stringify({ ok: true, calls, clearedIntervals }));
