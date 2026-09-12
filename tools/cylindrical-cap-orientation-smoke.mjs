import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { applyUvModeToGeometry } from '../engine/core/uv-mapping.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const threeSource = await readFile(new URL('../vendor/three.min.js', import.meta.url), 'utf8');
vm.runInThisContext(threeSource, { filename: 'three.min.js' });

const CANVAS_SIZE = 1024;
const UV_LAYOUT = {
  cylinder: {
    norm: {
      wrapX: 72 / CANVAS_SIZE,
      wrapW: 880 / CANVAS_SIZE,
      wrapY: 272 / CANVAS_SIZE,
      wrapH: 480 / CANVAS_SIZE,
      capR: 100 / CANVAS_SIZE,
      capTopV: 172 / CANVAS_SIZE,
      capBottomV: 852 / CANVAS_SIZE,
    },
  },
  box: { face: 256, originY: 128 },
  planar: { pad: 4 },
};

const source = new THREE.CylinderGeometry(1, 1, 2, 16, 1, false);
const geometry = applyUvModeToGeometry({
  geo: source,
  modeOverride: 'cylindrical',
  THREE,
  uvLayout: UV_LAYOUT,
  CANVAS_SIZE,
});
geometry.computeBoundingBox();
const pos = geometry.attributes.position;
const uv = geometry.attributes.uv;
const minY = geometry.boundingBox.min.y;
const maxY = geometry.boundingBox.max.y;
const capThreshold = 0.3;
function assertCapIslands(geometry, label) {
  geometry.computeBoundingBox();
  const position = geometry.attributes.position;
  const mappedUv = geometry.attributes.uv;
  const lower = geometry.boundingBox.min.y;
  const upper = geometry.boundingBox.max.y;
  let topTotal = 0;
  let topCount = 0;
  let bottomTotal = 0;
  let bottomCount = 0;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const v = mappedUv.getY(i);
    if (Math.abs(y - upper) < 1e-5 && v > 0.7) { topTotal += v; topCount += 1; }
    if (Math.abs(y - lower) < 1e-5 && v < capThreshold) { bottomTotal += v; bottomCount += 1; }
  }
  assert(topCount > 0 && bottomCount > 0, `${label}: cylindrical projection must retain distinct top and bottom cap islands`);
  assert((topTotal / topCount) > 0.7, `${label}: physical top must compensate for CanvasTexture V inversion`);
  assert((bottomTotal / bottomCount) < capThreshold, `${label}: physical bottom must compensate for CanvasTexture V inversion`);
}

assertCapIslands(geometry, 'Cylinder');

const revolve = new THREE.LatheGeometry([
  new THREE.Vector2(0, -1),
  new THREE.Vector2(0.8, -1),
  new THREE.Vector2(0.55, 1),
  new THREE.Vector2(0, 1),
], 24).toNonIndexed();
revolve.userData.allowCylCaps = true;
revolve.userData.xrUvSourceGeometryType = 'LatheGeometry';
const mappedRevolve = applyUvModeToGeometry({
  geo: revolve,
  modeOverride: 'cylindrical',
  THREE,
  uvLayout: UV_LAYOUT,
  CANVAS_SIZE,
});
assertCapIslands(mappedRevolve, 'Revolve Doodle');

console.log('cylindrical-cap-orientation: PASS');
