const MAX_EVENTS = 2000;
let sequence = 0;
let enabled = false;
let listenersInstalled = false;
const entries = [];

function isLocalRuntime() {
  try {
    const host = String(window.location?.hostname || '');
    const query = String(window.location?.search || '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || query.includes('debug=1') || query.includes('trace=1');
  } catch (_) {
    return false;
  }
}

function summarize(value, depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack || null };
  if (depth >= 2) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => summarize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      if (/password|token|secret/i.test(key)) out[key] = '[redacted]';
      else out[key] = summarize(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

function targetDetails(target) {
  if (!target || typeof target !== 'object') return { target: null };
  const id = target.id || null;
  const role = target.getAttribute?.('role') || null;
  const label = target.getAttribute?.('aria-label') || null;
  const name = target.getAttribute?.('name') || null;
  const tag = String(target.tagName || '').toLowerCase() || null;
  const type = target.getAttribute?.('type') || null;
  const text = String(target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 96) || null;
  const value = type === 'file'
    ? Array.from(target.files || []).map((file) => ({ name: file.name, size: file.size, type: file.type }))
    : (typeof target.value === 'string' ? target.value.slice(0, 160) : null);
  return { id, tag, role, label, name, type, text, value };
}

export function event(type, details = {}, level = 'debug') {
  if (!enabled) return null;
  const entry = {
    sequence: ++sequence,
    at: new Date().toISOString(),
    type: String(type),
    details: summarize(details),
  };
  entries.push(entry);
  if (entries.length > MAX_EVENTS) entries.splice(0, entries.length - MAX_EVENTS);
  try {
    const output = console[level] || console.debug || console.log;
    // DevTools often renders the second console argument as a collapsed
    // "Object". Keep the retained entry structured, but make the visible log
    // self-contained so a copied console trace preserves the evidence.
    output.call(console, `[xreate:debug #${entry.sequence}] ${entry.type} ${JSON.stringify(entry.details)}`);
  } catch (_) {}
  return entry;
}

export function error(type, err, details = {}) {
  return event(type, { ...details, error: err }, 'error');
}

export function configureDebugLog({ active = isLocalRuntime(), facade = {} } = {}) {
  enabled = !!active;
  const targetFacade = (facade && typeof facade === 'object') ? facade : {};
  targetFacade.DebugLog = {
    enable() { enabled = true; event('debug.enabled'); return true; },
    disable() { event('debug.disabled'); enabled = false; return true; },
    isEnabled: () => enabled,
    event,
    error,
    snapshot: () => entries.map((entry) => ({ ...entry })),
    clear() { entries.length = 0; sequence = 0; return true; },
    toJSON: () => JSON.stringify(entries, null, 2),
    help: () => 'XR.DebugLog.snapshot(), XR.DebugLog.clear(), XR.DebugLog.toJSON(), XR.DebugLog.enable()',
  };
  const pending = Array.isArray(targetFacade.__debugPending) ? targetFacade.__debugPending.splice(0) : [];
  for (const pendingEntry of pending) event(pendingEntry.type || 'bootstrap.pending', pendingEntry.details || {});
  event('debug.ready', { maxEvents: MAX_EVENTS, local: isLocalRuntime() });
  return targetFacade.DebugLog;
}

export function installBrowserEventLogging() {
  if (listenersInstalled || typeof document === 'undefined') return;
  listenersInstalled = true;
  const recordUiEvent = (domEvent) => {
    event(`ui.${domEvent.type}`, {
      target: targetDetails(domEvent.target),
      key: domEvent.key || null,
      button: typeof domEvent.button === 'number' ? domEvent.button : null,
    });
  };
  document.addEventListener('click', recordUiEvent, true);
  document.addEventListener('change', recordUiEvent, true);
  document.addEventListener('input', recordUiEvent, true);
  document.addEventListener('pointerdown', recordUiEvent, true);
  document.addEventListener('pointerup', recordUiEvent, true);
  window.addEventListener('error', (domEvent) => error('runtime.error', domEvent.error || domEvent.message, { source: domEvent.filename, line: domEvent.lineno }));
  window.addEventListener('unhandledrejection', (domEvent) => error('runtime.unhandled-rejection', domEvent.reason));
  event('debug.browser-listeners-installed');
}
