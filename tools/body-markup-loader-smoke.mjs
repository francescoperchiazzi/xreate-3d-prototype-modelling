#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let root = null;
const warnings = [];
const calls = new Map();
const windowRef = {};
const documentRef = {
  getElementById(id) { return id === 'xr-shell-root' ? root : null; },
};
const source = readFileSync(new URL('../shell/ui/body-markup-loader.js', import.meta.url), 'utf8');
vm.runInNewContext(source, {
  window: windowRef,
  document: documentRef,
  fetch: async (url) => {
    const count = (calls.get(url) || 0) + 1;
    calls.set(url, count);
    if (url === 'shell/ui/header.html' && count === 1) throw new Error('transient connection reset');
    return { ok: true, text: async () => `<section data-part="${url}"></section>` };
  },
  setTimeout,
  CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.options = options; } },
  console: { warn(...args) { warnings.push(args); }, error() {} },
});

root = { dataset: {}, innerHTML: '', dispatchEvent() {} };
const mounted = await windowRef.XR.__modules.ShellBodyMarkup.mount();
assert.equal(mounted, true);
assert.equal(root.dataset.xrShellMounted, '1');
assert.equal(root.dataset.loading, 'ready');
assert.equal(calls.get('shell/ui/header.html'), 2, 'a transient partial failure must retry once');
assert.equal(warnings.length, 1, 'the retry must remain diagnosable');
assert.match(root.innerHTML, /header\.html/);
console.log(JSON.stringify({ ok: true, headerAttempts: calls.get('shell/ui/header.html'), warnings: warnings.length }));
