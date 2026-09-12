#!/usr/bin/env node
// Validates the canonical UV projection fixture without needing a browser.
// The fixture persists its checker bitmap so it remains a self-contained
// reference scene; project-io refreshes the checker after loading.
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const fixtureUrl = new URL('scenes/xreate_uv_checker_all_shapes.xreate.json', root);
const projectIoUrl = new URL('engine/persistence/project-io.js', root);

const [rawFixture, projectIo] = await Promise.all([
  readFile(fixtureUrl, 'utf8'),
  readFile(projectIoUrl, 'utf8'),
]);
const fixture = JSON.parse(rawFixture);
const fail = (message) => { throw new Error(`UV checker fixture: ${message}`); };
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

if (fixture.format !== 'xreate' || fixture.version !== '2.2.0') {
  fail(`expected the current xreate/2.2.0 envelope, got ${fixture.format}/${fixture.version}`);
}
if (fixture.project?.id !== 'xreate_uv_checker_all_shapes') fail('fixture id changed');
if (!Array.isArray(fixture.project?.shapes) || fixture.project.shapes.length !== 23) {
  fail('expected the complete 23-shape UV projection catalogue');
}

const shapes = fixture.project.shapes;
const ids = new Set();
const occupiedPositions = new Set();
for (const shape of shapes) {
  if (!shape.id || ids.has(shape.id)) fail(`duplicate or missing shape id: ${shape.id}`);
  ids.add(shape.id);
  if (!shape.type) fail(`${shape.id} has no shape type`);
  if (!['box', 'sphere', 'cylindrical', 'planar'].includes(shape.uvMode)) {
    fail(`${shape.id} has unsupported UV mode ${shape.uvMode}`);
  }
  const transform = shape.transform;
  for (const group of ['position', 'rotation']) {
    for (const key of ['x', 'y', 'z']) {
      if (!isFiniteNumber(transform?.[group]?.[key])) fail(`${shape.id} has invalid transform.${group}.${key}`);
    }
  }
  for (const key of ['x', 'y', 'z']) {
    if (!isFiniteNumber(transform?.scale?.[key]) || transform.scale[key] <= 0) {
      fail(`${shape.id} has invalid transform.scale.${key}`);
    }
  }
  const position = `${transform.position.x},${transform.position.y},${transform.position.z}`;
  if (occupiedPositions.has(position)) fail(`${shape.id} overlaps another fixture shape at ${position}`);
  occupiedPositions.add(position);
  if (!Array.isArray(shape.layers) || shape.layers.length !== 1) fail(`${shape.id} must start with one layer`);
  if (!String(shape.layers[0].imageDataUrl || '').startsWith('data:image/png;base64,')) {
    fail(`${shape.id} must persist its checker layer bitmap`);
  }
  if (!String(shape.textureCompositeDataUrl || '').startsWith('data:image/png;base64,')) {
    fail(`${shape.id} must persist its checker composite bitmap`);
  }
}

if (!ids.has(fixture.project.selectedId)) fail('selectedId does not reference a fixture shape');
if (!projectIo.includes("p.id === 'xreate_uv_checker_all_shapes'")) {
  fail('project loader no longer recognizes this fixture');
}
if (!projectIo.includes('applyUvCheckerToAllShapes')) {
  fail('project loader no longer applies the checker after loading this fixture');
}

console.log(JSON.stringify({
  ok: true,
  fixture: fixture.project.id,
  shapeCount: shapes.length,
  uvModes: [...new Set(shapes.map((shape) => shape.uvMode))].sort(),
  selectedId: fixture.project.selectedId,
}, null, 2));
