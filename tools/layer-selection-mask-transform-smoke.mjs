#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  commitActiveLayerTransform,
  getActiveLayer,
  updateActiveLayerTransform,
} from '../engine/core/layers.js';
import { duplicateLayer as duplicateLayerState } from '../engine/core/project-state.js';
import { fromCanvasTransform, invert, multiply } from '../engine/image/affine-transform.js';
import { onCanvasPointerDown } from '../engine/image/canvas-interactions.js';

const layerA = { id: 'layer-a', transform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1 } };
const layerB = {
  id: 'layer-b',
  transform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1 },
  polygonMaskPoints: [
    { x: 512, y: 512 },
    { x: 612, y: 512 },
    { x: 512, y: 612 },
  ],
  maskLinked: true,
};
const part = { id: 'part-1', activeLayerIndex: 1, layers: [layerA, layerB] };
const refs = {
  // Deliberately stale: this reproduces clicking Layer B while the canvas
  // session still remembers Layer A for one synchronous event.
  activeLayerIndex: 0,
  imageTransform: { ...layerA.transform },
  imageBitmap: null,
};
const ctx = {
  refs,
  getSelectedPart: () => part,
  ensureLayersOnPart: () => {},
  affineFromCanvasTransform: (transform) => fromCanvasTransform(transform, 1024),
  affineInvert: invert,
  affineMul: multiply,
  markDirty: () => {},
  editorStore: null,
  projectStore: null,
};

assert.equal(getActiveLayer(ctx)?.id, 'layer-b', 'the selected volume layer must win over a stale session index');
updateActiveLayerTransform({ ...ctx, patch: { scale: 2 } });
assert.equal(layerA.transform.scale, 1, 'changing Layer B must never modify the previously active layer');
assert.equal(layerB.transform.scale, 2, 'the transform change must target the selected layer');
assert.deepEqual(layerB.polygonMaskPoints[1], { x: 662, y: 462 }, 'scaling must transform the clipping mask with its layer');
assert.equal(layerB.transform.x, -50, 'scaling must offset the layer to keep the mask centre as its horizontal anchor');
assert.equal(layerB.transform.y, -50, 'scaling must offset the layer to keep the mask centre as its vertical anchor');
const maskCenterAfterScale = fromCanvasTransform(layerB.transform, 1024);
assert.equal(maskCenterAfterScale.a * 50 + maskCenterAfterScale.c * 50 + maskCenterAfterScale.e, 562, 'the scaled image must keep the mask centre fixed horizontally');
assert.equal(maskCenterAfterScale.b * 50 + maskCenterAfterScale.d * 50 + maskCenterAfterScale.f, 562, 'the scaled image must keep the mask centre fixed vertically');
const maskCenter = {
  x: (Math.min(...layerB.polygonMaskPoints.map((point) => point.x)) + Math.max(...layerB.polygonMaskPoints.map((point) => point.x))) / 2,
  y: (Math.min(...layerB.polygonMaskPoints.map((point) => point.y)) + Math.max(...layerB.polygonMaskPoints.map((point) => point.y))) / 2,
};
assert.deepEqual(maskCenter, { x: 562, y: 562 }, 'the transformed mask must share the same central pivot as its layer');

commitActiveLayerTransform(ctx);
assert.deepEqual(layerB.polygonMaskPoints[1], { x: 662, y: 462 }, 'the follow-up commit must not transform the clipping mask twice');
assert.equal(part.activeLayerIndex, 1, 'the selected layer index must remain authoritative after commit');
assert.equal(refs.activeLayerIndex, 1, 'the UI cache must be reconciled with the selected layer');

const canvasRefs = {
  activeLayerIndex: 0,
  imageTransform: { x: -120, y: 24, scale: 0.5, rot: 0, ratio: 1 },
};
const selectedLayerTransform = { x: 48, y: -36, scale: 1.4, rot: 0, ratio: 1 };
onCanvasPointerDown({
  event: { button: 0, clientX: 100, clientY: 120, pointerId: 7, isTrusted: false },
  refs: canvasRefs,
  baseCanvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 512, height: 512 }) },
  canvasSize: 1024,
  pickLayerIndexAtTexPos: () => 1,
  setActiveLayer: (idx) => { assert.equal(idx, 1, 'canvas pick must select the hit layer'); },
  syncRefsFromHost: () => {
    canvasRefs.activeLayerIndex = 1;
    canvasRefs.imageTransform = { ...selectedLayerTransform };
  },
});
assert.equal(canvasRefs.activeLayerIndex, 1, 'a canvas pick must not restore the prior active layer after pointerdown');
assert.deepEqual(canvasRefs.imageTransform, selectedLayerTransform, 'the next move or scale must begin from the picked layer transform');
assert.equal(canvasRefs.canvasDragActive, false, 'the gesture that selects a new layer must not also drag it');
onCanvasPointerDown({
  event: { button: 0, clientX: 100, clientY: 120, pointerId: 8, isTrusted: false },
  refs: canvasRefs,
  baseCanvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 512, height: 512 }) },
  canvasSize: 1024,
  pickLayerIndexAtTexPos: () => 1,
});
assert.equal(canvasRefs.canvasDragActive, true, 'a second gesture on the selected layer may begin a drag');
const centredScale = fromCanvasTransform(canvasRefs.imageTransform, 1024);
assert.equal(centredScale.a, 1.4, 'the selected layer scale must be retained');
assert.equal(centredScale.d, 1.4, 'the selected layer scale must be retained on both axes');
assert.equal(centredScale.e, 560, 'scaling must retain the image centre horizontally rather than an image corner');
assert.equal(centredScale.f, 476, 'scaling must retain the image centre vertically rather than an image corner');

const imageBitmap = { immutable: true };
const duplicatePart = {
  id: 'part-duplicate',
  activeLayerIndex: 0,
  layers: [{ id: 'source', label: 'Source', imageBitmap, imageDataUrl: 'data:image/png;base64,AA==', transform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1 } }],
};
const duplicate = duplicateLayerState(duplicatePart, 0, { label: 'Source copy' });
assert.equal(duplicate?.layer?.imageBitmap, imageBitmap, 'a duplicated layer must retain its reusable bitmap for immediate editing');
assert.equal(duplicatePart.activeLayerIndex, 1, 'a duplicated layer must become the active layer');

console.log('layer-selection-mask-transform: PASS');
