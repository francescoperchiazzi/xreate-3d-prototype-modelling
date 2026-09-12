(() => {
  const XR = window.XR = window.XR || {};
  XR.__modules = XR.__modules || {};
  const trace = (type, details = {}) => {
    if (XR.DebugLog?.event) XR.DebugLog.event(type, details);
    else (XR.__debugPending = XR.__debugPending || []).push({ type, details });
  };

  async function loadPartial(url) {
    const hasFetch = (typeof fetch === 'function');
    if (hasFetch) {
      const maxAttempts = 3;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return String((await response.text()) || '');
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            try { console.warn('[ShellBodyMarkup] partial fetch retry', { url, attempt, error }); } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, attempt * 100));
          }
        }
      }
      throw new Error(`Failed to load ${url} after ${maxAttempts} attempts: ${lastError && lastError.message ? lastError.message : lastError}`);
    }
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    try {
      xhr.send(null);
    } catch (error) {
      throw new Error(`Failed to load ${url}: ${error && error.message ? error.message : error}`);
    }
    if (xhr.status >= 200 && xhr.status < 300) return String(xhr.responseText || '');
    if (xhr.status === 0 && xhr.responseText) return String(xhr.responseText);
    throw new Error(`Failed to load ${url}: HTTP ${xhr.status}`);
  }

  async function mount() {
    const root = document.getElementById('xr-shell-root');
    if (!root) return false;
    if (root.dataset.xrShellMounted === '1') return false;
    if (root.dataset.loading === 'pending') return false;
    root.dataset.loading = 'pending';
    const parts = [
      'shell/ui/header.html',
      'shell/ui/editor.html',
      'shell/ui/modals.html',
    ];
    let chunks;
    try {
      trace('ui.markup.mount.start', { parts });
      chunks = await Promise.all(parts.map(loadPartial));
    } catch (err) {
      root.dataset.loading = 'error';
      try { console.error('[ShellBodyMarkup] mount failed:', err); } catch (_) {}
      trace('ui.markup.mount.failure', { error: err });
      return false;
    }
    const html = chunks.join('\n');
    root.innerHTML = html;
    root.dataset.xrShellMounted = '1';
    root.dataset.loading = 'ready';
    trace('ui.markup.mount.success', { parts, childCount: root.childElementCount });
    try {
      const ev = new CustomEvent('xr-shell-mounted', { bubbles: true, cancelable: true });
      root.dispatchEvent(ev);
    } catch (_) {}
    return true;
  }

  XR.__modules.ShellBodyMarkup = XR.__modules.ShellBodyMarkup || {};
  XR.__modules.ShellBodyMarkup.mount = mount;
  XR.ShellBodyMarkup = XR.ShellBodyMarkup || XR.__modules.ShellBodyMarkup;

  try { void mount(); } catch (_) {}
})();
