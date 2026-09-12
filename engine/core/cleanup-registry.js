export function create() {
  const cleanupFns = new Set();
  let disposed = false;

  return {
    add(cleanup) {
      if (typeof cleanup !== 'function' || disposed) return () => {};
      cleanupFns.add(cleanup);
      return () => cleanupFns.delete(cleanup);
    },
    get size() { return cleanupFns.size; },
    dispose() {
      if (disposed) return false;
      disposed = true;
      const pending = [...cleanupFns];
      cleanupFns.clear();
      for (const cleanup of pending.reverse()) {
        try { cleanup(); } catch (err) { console.error('[cleanup-registry] cleanup failed', err); }
      }
      return true;
    },
  };
}

export const CleanupRegistry = { create };
