#!/usr/bin/env node
import assert from 'node:assert/strict';

const documentListeners = new Map();
const canvasListeners = new Map();
globalThis.window = { XR: { __modules: {} } };
globalThis.document = {
  hidden: false,
  activeElement: null,
  addEventListener(name, handler) { documentListeners.set(name, handler); },
  removeEventListener(name) { documentListeners.delete(name); },
};

const { create } = await import('../engine/viewport/viewport-controller.js');
const canvas = {
  addEventListener(name, handler) { canvasListeners.set(name, handler); },
  removeEventListener(name) { canvasListeners.delete(name); },
  focus() {},
};
const cleanups = [];
const controller = create({
  threeCanvas: canvas,
  threeWrap: {},
  document,
  editorCleanupFns: cleanups,
  getRefs: () => ({}),
  viewportWasdKeys: new Set(),
  clampSnap: (value) => value,
  persistViewportSettings: () => {},
  sphericalToXYZ: () => {},
  onOrbitPointerDown: () => {},
  onOrbitPointerMove: () => {},
  onOrbitPointerUp: () => {},
  resizeRenderer: () => {},
  stateRef: { viewportWasdLastT: Date.now() },
  THREE: {},
  updateGizmo: () => {},
  getSelectionHelper: () => null,
  getCurrentMesh: () => null,
});

assert.equal(controller.mount(), true, 'viewport controller did not mount');
assert.equal(controller.mount(), false, 'viewport controller mounted listeners twice');
assert.ok(canvasListeners.has('pointerdown'), 'pointer listener was not installed');
assert.ok(documentListeners.has('keydown'), 'keyboard listener was not installed');
assert.ok(cleanups.length >= 8, 'viewport lifecycle did not register cleanup handlers');
for (const cleanup of cleanups) cleanup();
assert.equal(canvasListeners.size, 0, 'canvas listeners survived lifecycle cleanup');
assert.equal(documentListeners.size, 0, 'document listeners survived lifecycle cleanup');

console.log(JSON.stringify({ ok: true, checks: ['single-mount', 'listener-registration', 'cleanup'] }));
