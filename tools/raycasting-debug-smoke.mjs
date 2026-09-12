import { hitTestGizmoFromPointer, hitTestPartIdFromPointer } from '../engine/core/raycasting.js';

const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
const event = { clientX: 50, clientY: 50 };
const raycaster = {
  setFromCamera() {},
  intersectObjects: () => [],
};

const miss = hitTestPartIdFromPointer({ event, getShapeList: () => [{ _mesh: {} }], threeCanvas: canvas, raycaster, camera: {} });
if (miss !== null) throw new Error('raycast miss must return null');

raycaster.intersectObjects = () => [{ object: { userData: { partId: 'part-1' } } }];
const hit = hitTestPartIdFromPointer({ event, getShapeList: () => [{ _mesh: {} }], threeCanvas: canvas, raycaster, camera: {} });
if (hit !== 'part-1') throw new Error('raycast hit did not return the part id');

raycaster.intersectObjects = () => [{ object: { userData: { gizmoMode: 'move', gizmoAxis: 'x' } } }];
const gizmo = hitTestGizmoFromPointer({
  event,
  currentMesh: {},
  gizmoRoot: { visible: true },
  threeCanvas: canvas,
  raycaster,
  camera: {},
  gizmoColliders: { move: { x: {}, y: null, z: null } },
});
if (gizmo?.axis !== 'x') throw new Error('gizmo raycast did not return its axis');
console.log('raycasting-debug: PASS');
