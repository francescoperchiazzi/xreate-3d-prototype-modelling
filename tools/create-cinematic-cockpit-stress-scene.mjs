#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const destination = new URL('../scenes/cinematic-experimental/xreate_cinematic_nebula-flight-deck-stress-test.xreate.json', import.meta.url);
const shapes = [];
let serial = 0;

const palette = {
  hull: { baseColor: '#172332', roughness: 0.46, metalness: 0.62 },
  panel: { baseColor: '#314860', roughness: 0.34, metalness: 0.52 },
  cyan: { baseColor: '#37d9e6', roughness: 0.2, metalness: 0.35, emissive: 0.24, emissiveColor: '#1d9ba5' },
  amber: { baseColor: '#f1a93c', roughness: 0.24, metalness: 0.32, emissive: 0.18, emissiveColor: '#d47a1e' },
  red: { baseColor: '#d94f61', roughness: 0.28, metalness: 0.28, emissive: 0.14, emissiveColor: '#9f2435' },
  seat: { baseColor: '#5d738a', roughness: 0.62, metalness: 0.14 },
  window: { baseColor: '#6289a6', roughness: 0.12, metalness: 0.72, emissive: 0.12, emissiveColor: '#31546d' },
};

function add(type, name, params, x, y, z, material, rotation = {}) {
  shapes.push({
    id: `${type}_${String(++serial).padStart(4, '0')}`,
    name,
    type,
    params,
    transform: {
      position: { x, y, z },
      rotation: { x: rotation.x || 0, y: rotation.y || 0, z: rotation.z || 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    material,
  });
}

function box(name, x, y, z, width, height, depth, material, rotation) {
  add('box', name, { width, height, depth, segments: 1 }, x, y, z, material, rotation);
}

function cylinder(name, x, y, z, radius, height, material, rotation) {
  add('cylinder', name, { radiusTop: radius, radiusBottom: radius, height, segments: 12, heightSegments: 1, openEnded: false }, x, y, z, material, rotation);
}

function sphere(name, x, y, z, radius, material) {
  add('sphere', name, { radius, widthSegments: 12, heightSegments: 8 }, x, y, z, material);
}

// 800 tiles establish the interior shell of the 20 × 20 metre flight deck.
for (let row = 0; row < 20; row += 1) {
  for (let column = 0; column < 20; column += 1) {
    const x = -9.5 + column;
    const z = -9.5 + row;
    box(`Deck plate ${row + 1}-${column + 1}`, x, 0.025, z, 0.96, 0.05, 0.96, (row + column) % 2 ? palette.hull : palette.panel);
    box(`Ceiling coffer ${row + 1}-${column + 1}`, x, 8.95, z, 0.96, 0.08, 0.96, (row + column) % 3 ? palette.hull : palette.panel);
  }
}

// 240 vertical braces turn the modular shell into a believable pressure hull.
for (const side of [-1, 1]) {
  for (let bay = 0; bay < 20; bay += 1) {
    for (let level = 0; level < 6; level += 1) {
      box(`Hull brace ${side < 0 ? 'port' : 'starboard'} ${bay + 1}-${level + 1}`, side * 9.72, 0.74 + (level * 1.34), -9.5 + bay, 0.16, 1.22, 0.72, level % 2 ? palette.panel : palette.hull);
    }
  }
}

// The front instrument wall uses 1,680 individually selectable coloured controls.
for (let row = 0; row < 28; row += 1) {
  for (let column = 0; column < 60; column += 1) {
    const tone = (row + column) % 17 === 0 ? palette.red : (row + column) % 5 === 0 ? palette.amber : palette.cyan;
    box(`Instrument control ${String(row + 1).padStart(2, '0')}-${String(column + 1).padStart(2, '0')}`, -7.38 + (column * 0.25), 1.44 + (row * 0.19), -8.88, 0.2, 0.14, 0.11, tone);
  }
}

// The overhead grid adds 960 ceiling switches for a deliberately demanding scene graph.
for (let row = 0; row < 20; row += 1) {
  for (let column = 0; column < 48; column += 1) {
    const tone = (row * 3 + column) % 13 === 0 ? palette.amber : palette.cyan;
    box(`Overhead switch ${String(row + 1).padStart(2, '0')}-${String(column + 1).padStart(2, '0')}`, -7.28 + (column * 0.31), 8.76, -5.15 + (row * 0.31), 0.24, 0.07, 0.24, tone);
  }
}

// Structural dashboard slabs, windows, seats, and tactile controls complete the cockpit.
for (let index = 0; index < 8; index += 1) {
  const x = -7 + (index * 2);
  box(`Forward display housing ${index + 1}`, x, 5.9, -8.74, 1.72, 2.3, 0.28, palette.panel);
  box(`Forward viewport ${index + 1}`, x, 7.18, -8.53, 1.52, 1.9, 0.08, palette.window, { x: -0.16 });
}
for (let index = 0; index < 96; index += 1) {
  const x = -7.2 + ((index % 24) * 0.63);
  const z = -5.95 + (Math.floor(index / 24) * 1.15);
  cylinder(`Console rotary dial ${index + 1}`, x, 1.03, z, 0.12, 0.11, index % 4 ? palette.panel : palette.amber, { x: Math.PI / 2 });
}
for (const side of [-1, 1]) {
  const offset = side * 3.2;
  cylinder(`Pilot seat pedestal ${side < 0 ? 'port' : 'starboard'}`, offset, 0.42, 1.85, 0.48, 0.8, palette.hull);
  box(`Pilot seat cushion ${side < 0 ? 'port' : 'starboard'}`, offset, 0.92, 1.85, 1.12, 0.2, 1.08, palette.seat);
  box(`Pilot seat back ${side < 0 ? 'port' : 'starboard'}`, offset, 1.62, 2.26, 1.12, 1.26, 0.18, palette.seat, { x: -0.17 });
  for (let arm = 0; arm < 2; arm += 1) {
    box(`Pilot seat arm ${side < 0 ? 'port' : 'starboard'} ${arm + 1}`, offset + (arm ? 0.66 : -0.66), 1.2, 1.78, 0.12, 0.34, 0.72, palette.panel);
  }
}
for (let index = 0; index < 48; index += 1) {
  const angle = (Math.PI * 2 * index) / 48;
  sphere(`Navigation beacon ${index + 1}`, Math.cos(angle) * 8.95, 4.5 + (Math.sin(angle) * 3.5), -8.35, 0.075, index % 4 ? palette.cyan : palette.red);
}

const scene = {
  format: 'xreate',
  version: '2.2.0',
  project: {
    id: 'xreate_cinematic_nebula_flight_deck_stress_test',
    name: 'Nebula Flight Deck — Cockpit Stress Test',
    textureMode: 'per-shape',
    selectedId: 'box_0001',
    metadata: {
      scaleProfile: 'cinematic-large-scale',
      authorship: 'ai-generated',
      dimensionsMetres: '20 × 20',
      stressTest: true,
      warning: 'Stress test: more than 3,000 individually selectable volumes. Loading, selection, transforms, and export can be slow on lower-powered devices.',
      description: 'A fictional texture-free starship cockpit built only from coloured primitive volumes.',
    },
    shapes,
  },
};

await mkdir(new URL('../scenes/cinematic-experimental/', import.meta.url), { recursive: true });
await writeFile(destination, `${JSON.stringify(scene, null, 2)}\n`);
console.log(JSON.stringify({ file: destination.pathname, shapes: shapes.length }, null, 2));
