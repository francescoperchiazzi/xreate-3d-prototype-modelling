import assert from 'node:assert/strict';

const listeners = new Map();
const add = (type, handler) => listeners.set(type, [...(listeners.get(type) || []), handler]);
const remove = (type, handler) => listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler));
globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
globalThis.window = {
  XR: { __modules: {} },
  addEventListener: add,
  removeEventListener: remove,
};
globalThis.document = {
  hidden: false,
  addEventListener: add,
  removeEventListener: remove,
};

const { install } = await import(`../shell/orchestrator.js?smoke=${Date.now()}`);
const calls = { resume: 0, pause: 0, dispose: 0 };
install({
  resumeAll() { calls.resume += 1; },
  pauseAll() { calls.pause += 1; },
  disposeAll() { calls.dispose += 1; },
});
listeners.get('pagehide')[0]({ persisted: true });
assert.equal(calls.pause, 1, 'Quick Look pagehide must pause rather than dispose the editor');
assert.equal(calls.dispose, 0, 'Quick Look pagehide must retain the WebGL renderer');
listeners.get('pageshow')[0]({ persisted: true });
assert.equal(calls.resume, 2, 'Quick Look pageshow must resume the renderer after the initial startup');
listeners.get('pagehide')[0]({ persisted: false });
assert.equal(calls.dispose, 1, 'a real navigation must still dispose the editor');
console.log(JSON.stringify({ ok: true, check: 'Quick Look pagehide preserves WebGL and pageshow resumes it' }));
