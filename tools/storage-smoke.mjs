import { Storage, adoptLegacyStorage } from '../engine/persistence/storage.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Storage.setRaw('fallback', 'value');
assert(Storage.getRaw('fallback') === 'value', 'in-memory fallback did not retain a value');

const calls = [];
const legacy = {
  getRaw: (key) => `legacy:${key}`,
  setRaw: (key, value) => { calls.push([key, value]); return true; },
  remove() {},
  getJSON: () => ({ source: 'legacy' }),
  setJSON: () => true,
  uuid: () => 'legacy-uuid',
  isRestricted: () => false,
  setRestricted() {},
};
assert(adoptLegacyStorage(legacy), 'legacy provider was not adopted');
assert(Storage.getRaw('key') === 'legacy:key', 'reads were not delegated to the adopted provider');
Storage.setRaw('key', 'value');
assert(calls.length === 1 && calls[0][1] === 'value', 'writes were not delegated to the adopted provider');
assert(Storage.uuid() === 'legacy-uuid', 'uuid was not delegated to the adopted provider');
assert(!adoptLegacyStorage({}), 'invalid provider was accepted');

console.log('storage: PASS');
