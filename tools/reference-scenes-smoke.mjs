#!/usr/bin/env node
// Keep the distributable reference scenes useful for device-scale AR/XR
// reviews: each complete composition must fit inside one metre and must not
// reintroduce retired internal naming.
import { readdir, readFile } from 'node:fs/promises';
import vm from 'node:vm';

function assert(condition, message) {
  if (!condition) throw new Error(`Reference scenes: ${message}`);
}

const threeSource = await readFile(new URL('../vendor/three.min.js', import.meta.url), 'utf8');
vm.runInThisContext(threeSource, { filename: 'three.min.js' });

const primitives = await import('../engine/shapes/builders/primitives.js');
const advanced = await import('../engine/shapes/builders/advanced.js');

const builders = {
  sphere: primitives.buildSphere,
  cube: primitives.buildCube,
  box: primitives.buildBox,
  cylinder: primitives.buildCylinder,
  cone: primitives.buildCone,
  torus: primitives.buildTorus,
  plane: primitives.buildPlane,
  dome: advanced.buildDome,
  hemi_open: advanced.buildHemiOpen,
  rod: advanced.buildRod,
  capsule: advanced.buildCapsule,
  tri_prism: advanced.buildTriPrism,
  frustum: advanced.buildFrustum,
  pyr_frustum: advanced.buildPyramidFrustum,
  wedge: advanced.buildWedge,
  arc_cyl: advanced.buildArcCylinder,
  rod_arc_15: advanced.buildRodArc15,
  rod_arc_30: advanced.buildRodArc30,
  rod_arc_45: advanced.buildRodArc45,
  curved_box: advanced.buildCurvedBox,
  ellipsoid: advanced.buildEllipsoid,
  hex_prism: advanced.buildHexPrism,
};

function buildGeometry(shape) {
  if (shape.type !== 'doodle') return builders[shape.type]?.(shape.params || {}) || null;
  const points = shape.doodlePoints || [];
  if (shape.doodleMode === 'mirror') return advanced.buildDoodleMirrorFromPoints(points, shape.params || {});
  if (shape.doodleMode === 'revolve') return advanced.buildDoodleRevolveFromPoints(points, shape.params || {});
  return advanced.buildDoodleFromPoints(points, shape.params || {});
}

function matrixForTransform(transform = {}) {
  const position = transform.position || {};
  const rotation = transform.rotation || {};
  const scale = transform.scale || {};
  return new THREE.Matrix4().compose(
    new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x || 0, rotation.y || 0, rotation.z || 0)),
    new THREE.Vector3(scale.x || 1, scale.y || 1, scale.z || 1),
  );
}

const scenesDir = new URL('../scenes/', import.meta.url);
const files = [
  ...(await readdir(scenesDir)).filter((file) => file.endsWith('.xreate.json')).sort(),
  'cinematic-experimental/xreate_cinematic_spatial-study-alcove.xreate.json',
];
assert(files.length > 0, 'no project fixtures found');

const results = [];
for (const file of files) {
  const fixture = JSON.parse(await readFile(new URL(`../scenes/${file}`, import.meta.url), 'utf8'));
  const project = fixture.project;
  assert(project?.id && project?.name, `${file} lacks project identity`);
  assert(!/geoni/i.test(`${project.id} ${project.name}`), `${file} still contains retired Geoni naming`);
  assert(Array.isArray(project.shapes) && project.shapes.length > 0, `${file} has no shapes`);

  const bounds = new THREE.Box3();
  for (const shape of project.shapes) {
    const geometry = buildGeometry(shape);
    assert(geometry?.attributes?.position, `${file}/${shape.id || shape.type} has no production geometry`);
    geometry.computeBoundingBox();
    assert(geometry.boundingBox, `${file}/${shape.id || shape.type} has no bounds`);
    bounds.union(geometry.boundingBox.clone().applyMatrix4(matrixForTransform(shape.transform)));
    geometry.dispose?.();
  }
  const dimensions = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
  assert(maxDimension <= 1.000001, `${file} exceeds the 1 m AR/XR limit (${maxDimension.toFixed(3)} m)`);
  results.push({
    file,
    project: project.name,
    shapes: project.shapes.length,
    maxDimensionM: Number(maxDimension.toFixed(3)),
  });
}

console.log(JSON.stringify({ ok: true, sceneCount: results.length, results }, null, 2));
