globalThis.window = {
  XR: { __debugPending: [{ type: 'bootstrap.queued', details: { source: 'classic-script' } }] },
  location: { hostname: 'example.invalid', search: '' },
  addEventListener() {},
};

const DebugLog = await import('../engine/debug/event-log.js');
const api = DebugLog.configureDebugLog({ active: true, facade: window.XR });
api.clear();
DebugLog.event('test.event', { answer: 42 });
if (api.snapshot().length !== 1 || api.snapshot()[0].type !== 'test.event') {
  throw new Error('debug event log did not retain a structured event');
}
if (!api.toJSON().includes('test.event')) throw new Error('debug event log did not serialize its buffer');
console.log('debug-event-log: PASS');
