#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createProjectIoConfig } from '../engine/editor/project-io-config.js';

const getProject = () => ({ id: 'canonical-project' });
const setShapeList = () => {};
const saveLayer = () => 'layer';
const config = createProjectIoConfig({
  CANVAS_SIZE: 1024,
  THREE: { revision: 'fixture' },
  projectState: { getProject },
  projectStore: { dispatch() {} },
  getProject,
  setShapeList,
  newLayerId: saveLayer,
  getAssemblyRoot: () => ({ id: 'assembly' }),
});

assert.equal(config.CANVAS_SIZE, 1024);
assert.equal(config.projectState.getProject, getProject);
assert.equal(config.getProject, getProject);
assert.equal(config.setShapeList, setShapeList);
assert.equal(config.newLayerId, saveLayer);
assert.deepEqual(config.getAssemblyRoot(), { id: 'assembly' });
assert.equal(Object.hasOwn(config, 'window'), false);
console.log(JSON.stringify({ ok: true, contractKeys: Object.keys(config).length }));
