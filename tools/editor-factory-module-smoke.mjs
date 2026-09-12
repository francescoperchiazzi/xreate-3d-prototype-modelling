import { readFileSync } from 'node:fs';

const { createLegacyEditor } = await import('../engine/legacy/editor-inline.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');
assert(typeof createLegacyEditor === 'function', 'legacy editor factory is not an ESM export');
assert(!/script[^>]+engine\/legacy\/editor-inline\.js/.test(index), 'index still loads editor-inline.js as a classic script');
assert(!/window\.XR\s*=\s*window\.XR/.test(bridge.slice(0, 500)), 'legacy module still allocates the compatibility namespace at import time');
assert(!/\bwindow\.XR\b/.test(bridge), 'legacy factory still reaches the global compatibility namespace instead of its injected facade');
assert(/export function createLegacyEditor\(compatibility\)/.test(bridge), 'legacy factory does not declare its injected compatibility dependency');
assert(!/\bXR(?:\??\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=/.test(bridge), 'legacy factory still writes its injected facade instead of returning a compatibility patch');
assert(/compatibilityPatch:\s*\{/.test(bridge), 'legacy factory does not return its compatibility patch');
console.log('editor-factory-module: PASS');
