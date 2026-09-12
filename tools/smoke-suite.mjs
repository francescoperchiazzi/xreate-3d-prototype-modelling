#!/usr/bin/env node
// One dependency-free command for the deterministic migration regressions.
// Browser-only fixtures intentionally remain separate until a browser runner
// is available in CI; this suite is the fast gate for every vertical cutover.
import { spawnSync } from 'node:child_process';

const tests = [
  'tools/static-smoke.mjs',
  'tools/comment-language-audit.mjs',
  'tools/debug-event-log-smoke.mjs',
  'tools/editor-factory-module-smoke.mjs',
  'tools/doodle-controller-smoke.mjs',
  'tools/doodle-geometry-smoke.mjs',
  'tools/doodle-stress.mjs',
  'tools/modal-workflow-static-smoke.mjs',
  'tools/i18n-audit.mjs',
  'tools/responsive-workbench-smoke.mjs',
  'tools/humanoid-controller-smoke.mjs',
  'tools/part-transform-smoke.mjs',
  'tools/shell-runtime-smoke.mjs',
  'tools/quicklook-lifecycle-smoke.mjs',
  'tools/shell-resolvers-smoke.mjs',
  'tools/render-loop-smoke.mjs',
  'tools/raycasting-debug-smoke.mjs',
  'tools/runtime-state-smoke.mjs',
  'tools/selection-deselection-static-smoke.mjs',
  'tools/scene-panels-selection-static-smoke.mjs',
  'tools/geometry-stats-smoke.mjs',
  'tools/geometry-controller-smoke.mjs',
  'tools/export-configuration-smoke.mjs',
  'tools/body-markup-loader-smoke.mjs',
  'tools/texture-mode-controller-smoke.mjs',
  'tools/project-io-doodle-load-smoke.mjs',
  'tools/project-io-config-smoke.mjs',
  'tools/uv-checker-scene-smoke.mjs',
  'tools/cinematic-cockpit-scene-smoke.mjs',
  'tools/reference-scenes-smoke.mjs',
  'tools/material-runtime-smoke.mjs',
  'tools/layer-ownership-smoke.mjs',
  'tools/shape-factory-smoke.mjs',
  'tools/layer-session-smoke.mjs',
  'tools/layer-selection-mask-transform-smoke.mjs',
  'tools/texture-canvas-controller-smoke.mjs',
  'tools/viewport-controller-smoke.mjs',
  'tools/viewport-selection-sync-static-smoke.mjs',
  'tools/part-resource-runtime-smoke.mjs',
  'tools/project-store-smoke.mjs',
  'tools/project-state-smoke.mjs',
  'tools/identifiers-smoke.mjs',
  'tools/uv-diagnostics-smoke.mjs',
  'tools/cleanup-registry-smoke.mjs',
  'tools/focus-trap-smoke.mjs',
  'tools/scene-graph-wiring-smoke.mjs',
  'tools/scene-commands-smoke.mjs',
  'tools/shapes-commands-smoke.mjs',
  'tools/undo-smoke.mjs',
  'tools/undo-assets-smoke.mjs',
  'tools/uv-commands-smoke.mjs',
  'tools/uv-mapping-facade-smoke.mjs',
  'tools/cylindrical-cap-orientation-smoke.mjs',
  'tools/box-uv-orientation-smoke.mjs',
  'tools/uv-overlay-bridge-static-smoke.mjs',
  'tools/shapedefs-smoke.mjs',
  'tools/archetype-catalog-smoke.mjs',
  'tools/theme-derived-colors-smoke.mjs',
  'tools/exporter-factories-smoke.mjs',
  'tools/usdz-transform-fixture-smoke.mjs',
  'tools/gizmo-single-root-smoke.mjs',
  'tools/image-affine-smoke.mjs',
  'tools/image-io-smoke.mjs',
  'tools/image-compositor-smoke.mjs',
  'tools/image-workflow-controller-smoke.mjs',
  'tools/image-runtime-smoke.mjs',
  'tools/download-smoke.mjs',
  'tools/storage-smoke.mjs',
  'tools/autosave-runtime-smoke.mjs',
];

const results = [];
for (const file of tests) {
  const run = spawnSync(process.execPath, ['--no-warnings', file], { encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`.trim();
  results.push({ file, ok: run.status === 0, output });
  if (run.status !== 0) {
    console.error(JSON.stringify({ ok: false, results }, null, 2));
    process.exit(run.status || 1);
  }
}

console.log(JSON.stringify({ ok: true, count: results.length, results: results.map(({ file, ok }) => ({ file, ok })) }, null, 2));
