import { pruneDuplicateGizmoRoots } from '../engine/core/gizmo.js';
import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function group(name) {
  return {
    name,
    visible: true,
    userData: { xreateGizmoRoot: true },
    parent: null,
  };
}

const kept = group('kept');
const stale = group('stale');
const scene = {
  children: [kept, stale],
  traverse(callback) {
    for (const child of this.children.slice()) callback(child);
  },
  remove(child) {
    this.children = this.children.filter((entry) => entry !== child);
    child.parent = null;
  },
};
kept.parent = scene;
stale.parent = scene;

assert(pruneDuplicateGizmoRoots(scene, kept) === 1, 'one stale gizmo must be pruned');
assert(scene.children.length === 1 && scene.children[0] === kept, 'only the active gizmo may remain in the scene');
assert(stale.visible === false, 'a pruned gizmo must be hidden before removal');

const [gizmoSource, selectionSource, legacySource] = await Promise.all([
  readFile(new URL('../engine/core/gizmo.js', import.meta.url), 'utf8'),
  readFile(new URL('../engine/core/selection.js', import.meta.url), 'utf8'),
  readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8'),
]);
assert(gizmoSource.includes('return refs.gizmoRoot;'), 'gizmo creation must return its singleton to the caller');
assert(selectionSource.includes('if (ensuredGizmo) refs.gizmoRoot = ensuredGizmo;'), 'selection must retain a lazily-created gizmo before writing refs');
assert(legacySource.includes('return mod.ensureGizmo({ refs, scene, THREE, gizmoVisuals, gizmoColliders }) || refs.gizmoRoot || null;'), 'legacy bridge must forward the created gizmo root');
console.log(JSON.stringify({ ok: true, check: 'duplicate gizmo roots are pruned and the bridge returns the singleton to selection ownership' }));
