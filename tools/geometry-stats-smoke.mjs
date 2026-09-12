#!/usr/bin/env node
import assert from 'node:assert/strict';
import { getGeometryStats } from '../engine/core/geometry-stats.js';

const shapes = [
  { id: 'indexed', _mesh: { geometry: { attributes: { position: { count: 8 } }, index: { count: 36 } } } },
  { id: 'plain', _mesh: { geometry: { attributes: { position: { count: 12 } } } } },
  { id: 'empty' },
];
assert.deepEqual(getGeometryStats({ shapes }), { verts: 20, tris: 16 });
assert.deepEqual(getGeometryStats({ shapes, filter: (part) => part.id === 'indexed' }), { verts: 8, tris: 12 });
console.log(JSON.stringify({ ok: true, stats: getGeometryStats({ shapes }) }));
