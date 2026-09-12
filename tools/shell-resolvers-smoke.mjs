#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createShellResolvers } from '../engine/editor/shell-resolvers.js';

let creates = 0;
let installed = 0;
const config = { fixture: true };
const compatibility = {
  __modules: {
    ShellScenePanels: {
      create(received) {
        creates += 1;
        assert.equal(received, config);
        return { installInspectorScrollSync() { installed += 1; } };
      },
    },
  },
};
const resolvers = createShellResolvers(compatibility, { scenePanels: config });
const first = resolvers.resolveShellScenePanelsApi();
assert.equal(resolvers.resolveShellScenePanelsApi(), first);
assert.equal(creates, 1);
assert.equal(installed, 1);
assert.equal(resolvers.resolveShellUvUiApi(), null);
console.log(JSON.stringify({ ok: true, creates, installed }));
