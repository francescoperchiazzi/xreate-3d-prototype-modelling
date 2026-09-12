#!/usr/bin/env node
import assert from 'node:assert/strict';
import { create as createLayerSession } from '../engine/texture/layer-session.js';
import { create as createTextureCanvasController } from '../engine/texture/canvas-controller.js';

const listeners = new Map();
const scheduled = [];
globalThis.requestAnimationFrame = (fn) => { scheduled.push(fn); return scheduled.length; };

const canvas = {
  dataset: {},
  addEventListener(name, handler) { listeners.set(name, handler); },
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
  setPointerCapture() {},
  releasePointerCapture() {},
};
const session = createLayerSession({ imageTransform: { x: 0, y: 0, scale: 1 } });
let commits = 0;
const controller = createTextureCanvasController({
  session,
  baseCanvas: canvas,
  canvasSize: 100,
  getCurrentLayers: () => [],
  getIslandsForUvMode: () => [],
  affineFromCanvasTransform: () => null,
  affineInvert: () => null,
  setActiveLayer: () => {},
  commitActiveLayerTransform: () => { commits += 1; },
  drawBaseLayer: () => {},
  requestApplyTexture: () => {},
  updateTransformUi: () => {},
});

assert.equal(controller.install(), true, 'canvas controller did not install');
listeners.get('pointerdown')({ button: 0, pointerId: 1, clientX: 10, clientY: 10 });
listeners.get('pointermove')({ pointerId: 1, clientX: 14, clientY: 10 });
listeners.get('pointermove')({ pointerId: 1, clientX: 24, clientY: 10 });
for (const callback of scheduled.splice(0)) callback();
assert.equal(session.snapshot().imageTransform.x, 10, 'drag transform was not committed to LayerSession');
assert.ok(commits >= 1, 'scheduled layer commit did not execute');
listeners.get('pointerup')({ pointerId: 1 });
assert.equal(session.snapshot().imageTransform.x, 10, 'pointer release unexpectedly changed transform');

// Two touch pointers must replace drag with a stable scale gesture.  This
// guards the iPad workflow: adding the second finger cannot translate the
// texture before its pinch distance is evaluated.
listeners.get('pointerdown')({ button: 0, pointerType: 'touch', pointerId: 2, clientX: 20, clientY: 20, preventDefault() {} });
listeners.get('pointerdown')({ button: 0, pointerType: 'touch', pointerId: 3, clientX: 40, clientY: 20, preventDefault() {} });
listeners.get('pointermove')({ pointerType: 'touch', pointerId: 3, clientX: 60, clientY: 20, preventDefault() {} });
for (const callback of scheduled.splice(0)) callback();
assert.equal(session.snapshot().imageTransform.scale, 2, 'pinch did not update the active layer scale');
assert.equal(session.snapshot().imageTransform.x, 20, 'pinch midpoint did not pan the active layer');
listeners.get('pointerup')({ pointerType: 'touch', pointerId: 3 });
listeners.get('pointerup')({ pointerType: 'touch', pointerId: 2 });

console.log(JSON.stringify({ ok: true, checks: ['canvas-owned-drag', 'two-finger-pinch', 'session-commit', 'scheduled-draw'] }));
