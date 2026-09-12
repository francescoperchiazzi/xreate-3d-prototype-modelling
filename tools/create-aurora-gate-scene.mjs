#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';

const destination = new URL('../scenes/cinematic-experimental/xreate_cinematic_the-aurora-gate.xreate.json', import.meta.url);
const shapes = [];
let serial = 0;

const palette = {
  floor: { baseColor: '#17202b', roughness: 0.5, metalness: 0.42 },
  steel: { baseColor: '#37475b', roughness: 0.3, metalness: 0.72 },
  glow: { baseColor: '#55d6d2', roughness: 0.2, metalness: 0.42, emissive: 0.3, emissiveColor: '#2fbbb8' },
  amber: { baseColor: '#f5b74b', roughness: 0.22, metalness: 0.38, emissive: 0.2, emissiveColor: '#e69a2c' },
  violet: { baseColor: '#ab85ff', roughness: 0.28, metalness: 0.32, emissive: 0.18, emissiveColor: '#8e66e5' },
  light: { baseColor: '#e9eff3', roughness: 0.2, metalness: 0.24, emissive: 0.1, emissiveColor: '#d0edf0' },
};

function transform(x, y, z, rotation = {}) {
  return {
    position: { x, y, z },
    rotation: { x: rotation.x || 0, y: rotation.y || 0, z: rotation.z || 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function add(type, name, params, x, y, z, material, rotation) {
  const id = `${type}_${String(++serial).padStart(3, '0')}`;
  shapes.push({ id, name, type, params, transform: transform(x, y, z, rotation), material });
}

function box(name, x, y, z, width, height, depth, material, rotation) {
  add('box', name, { width, height, depth, segments: 2 }, x, y, z, material, rotation);
}

function cylinder(name, x, y, z, radius, height, material, rotation) {
  add('cylinder', name, { radiusTop: radius, radiusBottom: radius, height, segments: 24, heightSegments: 3, openEnded: false }, x, y, z, material, rotation);
}

function sphere(name, x, y, z, radius, material) {
  add('sphere', name, { radius, widthSegments: 24, heightSegments: 16 }, x, y, z, material);
}

function torus(name, x, y, z, radius, tube, material, rotation = { x: 1.570796 }) {
  add('torus', name, { radius, tube, radialSegments: 12, tubularSegments: 36 }, x, y, z, material, rotation);
}

// 400 modular floor tiles establish the 20 × 20 metre soundstage.
for (let row = 0; row < 20; row += 1) {
  for (let column = 0; column < 20; column += 1) {
    const x = -9.5 + column;
    const z = -9.5 + row;
    box(`Floor tile ${String(row + 1).padStart(2, '0')}-${String(column + 1).padStart(2, '0')}`, x, 0.025, z, 0.96, 0.05, 0.96, (row + column) % 2 ? palette.floor : palette.steel);
  }
}

// Cyan runway markers guide performers and viewers through the terminal.
for (const x of [-3.4, 3.4]) {
  for (let index = 0; index < 20; index += 1) {
    sphere(`Runway light ${x < 0 ? 'left' : 'right'} ${index + 1}`, x, 0.09, -9.2 + index, 0.075, palette.glow);
  }
}

// The terminal façade builds a broad backdrop rather than a single flat wall.
for (let row = 0; row < 3; row += 1) {
  for (let column = 0; column < 5; column += 1) {
    box(`Backdrop panel ${row + 1}-${column + 1}`, -8 + (column * 4), 1.3 + (row * 2.55), -9.55, 3.72, 2.42, 0.16, row === 1 ? palette.violet : palette.steel);
  }
}
for (let index = 0; index < 6; index += 1) {
  const x = -9.2 + (index * 3.68);
  cylinder(`Backdrop column ${index + 1}`, x, 3.8, -9.33, 0.18, 7.5, palette.steel);
  sphere(`Backdrop column light ${index + 1}`, x, 7.65, -9.33, 0.19, palette.glow);
}

// A monumental arrival gate frames the central performance area.
for (const x of [-6.8, 6.8]) cylinder(`Aurora gate pillar ${x < 0 ? 'left' : 'right'}`, x, 2.3, -5.8, 0.31, 4.6, palette.steel);
box('Aurora gate lintel', 0, 4.55, -5.8, 13.9, 0.34, 0.42, palette.steel);
torus('Aurora gate halo', 0, 3.1, -5.55, 2.2, 0.1, palette.amber, { x: 0, y: 0, z: 0 });
for (let index = 0; index < 10; index += 1) {
  const angle = (Math.PI * 2 * index) / 10;
  sphere(`Aurora gate lamp ${index + 1}`, Math.cos(angle) * 2.2, 3.1 + (Math.sin(angle) * 2.2), -5.55, 0.11, palette.amber);
}

// Eight control islands offer readable interaction zones across the set.
for (let index = 0; index < 8; index += 1) {
  const x = -7 + ((index % 4) * 4.65);
  const z = index < 4 ? -1.8 : 4.8;
  cylinder(`Console pedestal ${index + 1}`, x, 0.55, z, 0.34, 1.1, palette.steel);
  box(`Console display ${index + 1}`, x, 1.22, z, 0.78, 0.36, 0.08, index % 2 ? palette.glow : palette.light, { x: -0.32, y: 0, z: 0 });
  sphere(`Console beacon ${index + 1}`, x, 1.48, z, 0.11, index % 2 ? palette.glow : palette.amber);
}

// Twenty-four lounge chairs give the soundstage a human-scale foreground.
for (let index = 0; index < 24; index += 1) {
  const x = -7.7 + ((index % 8) * 2.2);
  const z = 7.3 + (Math.floor(index / 8) * 0.82);
  cylinder(`Lounge chair base ${index + 1}`, x, 0.14, z, 0.34, 0.12, palette.steel);
  box(`Lounge chair seat ${index + 1}`, x, 0.34, z, 0.72, 0.22, 0.68, index % 2 ? palette.violet : palette.light);
  box(`Lounge chair back ${index + 1}`, x, 0.73, z + 0.27, 0.72, 0.62, 0.12, index % 2 ? palette.violet : palette.light, { x: -0.18, y: 0, z: 0 });
}

// Perimeter lights complete the theatrical rhythm of the large set.
for (let index = 0; index < 12; index += 1) {
  const x = -8.8 + (index * 1.6);
  cylinder(`Front stanchion ${index + 1}`, x, 0.32, 9.15, 0.07, 0.62, palette.steel);
  sphere(`Front stanchion light ${index + 1}`, x, 0.66, 9.15, 0.09, palette.glow);
}
for (let index = 0; index < 6; index += 1) {
  const x = -7.5 + (index * 3);
  sphere(`Ceiling constellation ${index + 1}`, x, 7.7, -1.5 + ((index % 2) * 2.8), 0.18, index % 2 ? palette.amber : palette.violet);
}

const scene = {
  format: 'xreate',
  version: '2.2.0',
  project: {
    id: 'xreate_cinematic_the_aurora_gate',
    name: 'The Aurora Gate — Retro-Futurist Terminal',
    textureMode: 'per-shape',
    selectedId: 'torus_471',
    metadata: {
      scaleProfile: 'cinematic-large-scale',
      authorship: 'ai-generated',
      dimensionsMetres: '20 × 20',
      description: 'A texture-free retro-futurist terminal set for spatial storytelling studies.',
    },
    shapes,
  },
};

await mkdir(new URL('../scenes/cinematic-experimental/', import.meta.url), { recursive: true });
await writeFile(destination, `${JSON.stringify(scene, null, 2)}\n`);
console.log(JSON.stringify({ file: destination.pathname, shapes: shapes.length }, null, 2));
