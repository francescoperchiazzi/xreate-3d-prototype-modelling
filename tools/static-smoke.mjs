#!/usr/bin/env node
// Dependency-free structural smoke check for the migration. Browser assertions
// remain in stress-tests-for-the-browser because they exercise Three/WebGL UI.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules']);
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) files.push(full);
  }
}

function count(pattern) {
  let total = 0;
  for (const file of files) total += (readFileSync(file, 'utf8').match(pattern) || []).length;
  return total;
}

function matchingFiles(pattern) {
  return files
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file));
}

walk(root);
files.sort();
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
const legacyBridgeFile = join(root, 'engine/legacy/editor-inline.js');
const legacyBridgeSource = readFileSync(legacyBridgeFile, 'utf8');
const legacyStateAuthorityPatterns = [
  /(?:\bXR|window\.XR)\.(?:state|__state)\s*=/g,
  /(?:\bXR|window\.XR)(?:\?\.)?\.ProjectState(?:\?\.)?\.configure\s*\(/g,
];
const legacyStateAuthorityViolations = legacyStateAuthorityPatterns.flatMap((pattern) =>
  legacyBridgeSource.match(pattern) || []);
const legacyFacadeWrites = legacyBridgeSource
  .split(/\r?\n/)
  .map((line, index) => ({ line, lineNumber: index + 1 }))
  .filter(({ line }) => /\bXR(?:\??\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=/.test(line))
  .map(({ lineNumber, line }) => `${lineNumber}: ${line.trim()}`);
const legacyBridgeMetrics = {
  lines: legacyBridgeSource.split(/\r?\n/).length,
  emptyCatchBlocks: (legacyBridgeSource.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length,
  facadeReads: (legacyBridgeSource.match(/\bXR(?:\?\.)?\.[A-Za-z_$][\w$]*/g) || []).length,
  facadeWrites: legacyFacadeWrites.length,
};
const legacyRuntimeMirrorViolations = legacyBridgeSource.match(/\blet\s+(?:currentMesh|drawingTexture|uvMode|selectedIslandId|wireframeOn|flatLightingOn)\s*=/g) || [];

const report = {
  checkedAt: new Date().toISOString(),
  syntaxChecked: files.length,
  emptyCatchBlocks: count(/catch\s*\([^)]*\)\s*\{\s*\}/g),
  windowXrOccurrences: count(/window\.XR/g),
  engineGlobalNamespaceFiles: files
    .filter((file) => relative(root, file).startsWith('engine/'))
    .filter((file) => /window\.XR|globalThis\.XR/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(root, file)),
  webglRendererAllocations: matchingFiles(/new\s+THREE\.WebGLRenderer\s*\(/),
  legacyStateAuthorityViolations,
  legacyFacadeWrites,
  legacyBridgeMetrics,
  legacyRuntimeMirrorViolations,
  requiredMigrationModules: [
    'engine/core/editor-store.js',
    'engine/core/project-store.js',
    'engine/core/selection-controller.js',
    'engine/core/transform-controller.js',
    'engine/core/part-transform.js',
    'engine/core/geometry-stats.js',
    'engine/core/engine-runtime.js',
    'engine/core/cleanup-registry.js',
    'engine/editor/project-controller.js',
    'engine/editor/scene-runtime.js',
    'engine/editor/part-resource-runtime.js',
    'engine/export/configuration.js',
    'engine/viewport/viewport-controller.js',
    'engine/image/affine-transform.js',
    'engine/texture/layer-controller.js',
    'engine/texture/layer-session.js',
    'engine/texture/image-workflow-controller.js',
    'engine/texture/canvas-controller.js',
    'engine/texture/mode-controller.js',
    'engine/shapes/shape-controller.js',
    'engine/shapes/geometry-controller.js',
    'engine/shapes/doodle-controller.js',
    'engine/shapes/humanoid-controller.js',
    'stress-tests-for-the-browser/texture-ownership-regression.js',
  ].map((file) => ({ file, present: files.includes(join(root, file)) })),
};

const missing = report.requiredMigrationModules.filter((item) => !item.present);
const rendererIsCentralized = report.webglRendererAllocations.length === 1
  && report.webglRendererAllocations[0] === 'engine/core/scene-setup.js';
console.log(JSON.stringify(report, null, 2));
if (missing.length) {
  console.error('Missing required migration modules:', missing.map((item) => relative(root, item.file)).join(', '));
  process.exitCode = 1;
}
if (!rendererIsCentralized) {
  console.error('WebGLRenderer must be allocated only by engine/core/scene-setup.js:', report.webglRendererAllocations.join(', ') || 'none');
  process.exitCode = 1;
}
if (legacyStateAuthorityViolations.length) {
  console.error('The legacy bridge may read ProjectState but must not allocate lifecycle state or configure its authority:', legacyStateAuthorityViolations.join(', '));
  process.exitCode = 1;
}
if (legacyFacadeWrites.length) {
  console.error('The legacy factory must return compatibility patches instead of writing its injected facade:', legacyFacadeWrites.join(', '));
  process.exitCode = 1;
}
if (legacyRuntimeMirrorViolations.length) {
  console.error('The legacy bridge must not own a currentMesh mirror:', legacyRuntimeMirrorViolations.join(', '));
  process.exitCode = 1;
}
const allowedEngineNamespaceFiles = new Set(['engine/main.js']);
const leakedEngineNamespaceFiles = report.engineGlobalNamespaceFiles
  .filter((file) => !allowedEngineNamespaceFiles.has(file));
if (leakedEngineNamespaceFiles.length) {
  console.error('Only engine/main.js may access the compatibility namespace:', leakedEngineNamespaceFiles.join(', '));
  process.exitCode = 1;
}
