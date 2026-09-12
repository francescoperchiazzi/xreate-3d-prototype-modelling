// ESM storage contract. The legacy synchronous bootstrap can be adopted at
// startup, but core modules never need to read the compatibility namespace.
let backend = null;

function storageBackend() {
  const memory = Object.create(null);
  let restricted = false;
  return {
    setRestricted(value) { restricted = !!value; },
    isRestricted() { return restricted; },
    getRaw(key) {
      const id = String(key);
      if (restricted) return Object.prototype.hasOwnProperty.call(memory, id) ? memory[id] : null;
      try { return localStorage.getItem(id); } catch (_) { restricted = true; return memory[id] || null; }
    },
    setRaw(key, value) {
      const id = String(key); const next = String(value);
      if (restricted) { memory[id] = next; return true; }
      try { localStorage.setItem(id, next); return true; } catch (_) { restricted = true; memory[id] = next; return false; }
    },
    remove(key) {
      const id = String(key);
      if (restricted) { delete memory[id]; return; }
      try { localStorage.removeItem(id); } catch (_) { restricted = true; delete memory[id]; }
    },
    getJSON(key) {
      const raw = this.getRaw(key);
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    },
    setJSON(key, value) {
      try { return this.setRaw(key, JSON.stringify(value)); } catch (_) { return false; }
    },
    uuid() { return `uuid_${Date.now()}_${Math.random().toString(16).slice(2)}`; },
  };
}

backend = storageBackend();

export function adoptLegacyStorage(next) {
  if (!next || typeof next.getRaw !== 'function' || typeof next.setRaw !== 'function') return false;
  backend = next;
  return true;
}

export const Storage = {
  setRestricted: (...args) => backend.setRestricted?.(...args),
  isRestricted: (...args) => !!backend.isRestricted?.(...args),
  getRaw: (...args) => backend.getRaw?.(...args) ?? null,
  setRaw: (...args) => backend.setRaw?.(...args) ?? false,
  remove: (...args) => backend.remove?.(...args),
  getJSON: (...args) => backend.getJSON?.(...args) ?? null,
  setJSON: (...args) => backend.setJSON?.(...args) ?? false,
  uuid: (...args) => backend.uuid?.(...args) || `uuid_${Date.now()}_${Math.random().toString(16).slice(2)}`,
};
