const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function tr(key) {
  try {
    if (XR && typeof XR.tr === 'function') return XR.tr(key);
    const f = XR && XR.i18n && typeof XR.i18n.t === 'function' ? XR.i18n.t : null;
    return f ? f(key) : String(key);
  } catch (_) {
    return String(key);
  }
}

XR.__modules.showToast = (msg, type, msOrOpts) => {
  const nextMsg = String(msg || '').trim();
  if (!nextMsg) return;
  const rawType = String(type || '').trim().toLowerCase();
  const variant = (rawType === 'success' || rawType === 'ok') ? 'success'
    : (rawType === 'error' || rawType === 'danger' || rawType === 'bad') ? 'error'
      : (rawType === 'warning' || rawType === 'warn') ? 'warning'
        : (rawType === 'info' || rawType === 'working') ? 'info'
          : (rawType ? rawType : 'info');
  try {
    const tag = '[xr-toast:' + variant + ']';
    const lvlMap = { debug:'info', info:'info', working:'info', success:'info', ok:'info', warning:'warn', warn:'warn', error:'error', danger:'error', bad:'error' };
    const lvl = lvlMap[variant] || 'info';
    const fn = console[lvl] || console.info;
    fn.call(console, tag, nextMsg);
  } catch (_) {}
  if (typeof msOrOpts === 'object' && msOrOpts && Array.isArray(msOrOpts.actions)) {
    try { console.debug('[xr-toast:actions]', msOrOpts.actions.map(a => a.label || '?')); } catch (_) {}
  }
};

XR.showToast = XR.showToast || XR.__modules.showToast;

export const showToast = XR.__modules.showToast;

