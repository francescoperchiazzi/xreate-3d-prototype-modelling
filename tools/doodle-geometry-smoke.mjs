import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// The production builder intentionally uses the browser-global Three build.
// Load that same vendor artifact before importing it: this catches a real
// extrusion regression which a controller mock cannot see.
const threeSource = await readFile(new URL('../vendor/three.min.js', import.meta.url), 'utf8');
vm.runInThisContext(threeSource, { filename: 'three.min.js' });
const { buildDoodleFromPoints, buildDoodleMirrorFromPoints, buildDoodleRevolveFromPoints, buildFrustum, buildPyramidFrustum } = await import('../engine/shapes/builders/advanced.js');
const { buildCylinder } = await import('../engine/shapes/builders/primitives.js');

function assertRevolveOutward(geometry) {
  const pos = geometry.attributes.position;
  let checked = 0;
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-12) continue;
    normal.normalize();
    const centre = a.add(b).add(c).multiplyScalar(1 / 3);
    const reference = Math.abs(normal.y) > 0.75
      ? new THREE.Vector3(0, centre.y >= 0 ? 1 : -1, 0)
      : new THREE.Vector3(centre.x, 0, centre.z).normalize();
    assert(normal.dot(reference) > 0, 'Revolve Doodle triangle winding must face outward');
    checked += 1;
  }
  assert(checked > 0, 'Revolve Doodle must contain non-degenerate faces');
}

function assertOpenPrimitiveNormals(geometry, label) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    if (face.lengthSq() < 1e-12) continue;
    const authored = new THREE.Vector3(
      nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2),
      nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2),
      nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2),
    );
    assert(face.dot(authored) >= 0, `${label} must not expose a negative face when end caps are opened`);
  }
  if (g !== geometry) g.dispose();
}

const polygon = buildDoodleFromPoints([
  { x: 120, y: 100 },
  { x: 540, y: 130 },
  { x: 320, y: 410 },
], { depth: 0.5 });
assert(polygon?.attributes?.position?.count > 0, 'polygon Doodle must produce extruded geometry for three non-collinear points');

const mirror = buildDoodleMirrorFromPoints([
  { x: -120, y: 110 },
  { x: -260, y: 280 },
  { x: -80, y: 430 },
], { depth: 0.5 });
mirror.computeBoundingBox();
assert(mirror?.attributes?.position?.count > 0 && mirror.boundingBox.min.x < 0 && mirror.boundingBox.max.x > 0, 'Mirror Doodle must include both bilateral halves in one geometry');

const revolve = buildDoodleRevolveFromPoints([
  { x: -120, y: 110 },
  { x: -260, y: 280 },
], { segments: 24 });
revolve.computeBoundingBox();
assert(revolve?.attributes?.position?.count > polygon.attributes.position.count && revolve.boundingBox.min.z < 0 && revolve.boundingBox.max.z > 0, 'Revolve Doodle must produce a complete 360 degree lathe');
assert(revolve.userData?.allowCylCaps === true, 'Revolve Doodle must declare cylindrical cap support for UV mapping');
assertRevolveOutward(revolve);

assertOpenPrimitiveNormals(buildCylinder({ radiusTop: 0.8, radiusBottom: 0.6, height: 1.8, segments: 24, heightSegments: 3, openEnded: true }), 'Open cylinder');
assertOpenPrimitiveNormals(buildFrustum({ radiusTop: 0.8, radiusBottom: 0.6, height: 1.8, segments: 24, heightSegments: 3, openEnded: true }), 'Open frustum');
assertOpenPrimitiveNormals(buildPyramidFrustum({ radiusTop: 0.8, radiusBottom: 0.6, height: 1.8, heightSegments: 3, openEnded: true }), 'Open pyramid frustum');

console.log(JSON.stringify({ ok: true, check: 'production Three builders extrude polygon, mirror and revolve Doodle fixtures' }));
