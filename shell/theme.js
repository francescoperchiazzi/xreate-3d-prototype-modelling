const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function isDarkThemeActive(opts) {
  const themeRoot = opts?.themeRoot || document.documentElement;
  const v = String(themeRoot?.getAttribute?.('data-theme') || 'auto');
  if (v === 'dark') return true;
  if (v === 'light') return false;
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_) {
    return false;
  }
}

export function readCssVar(opts) {
  const name = opts?.name;
  const fallback = opts?.fallback;
  const themeRoot = opts?.themeRoot || document.documentElement;
  try {
    const v = getComputedStyle(themeRoot).getPropertyValue(name);
    const s = String(v || '').trim();
    return s || fallback;
  } catch (_) {
    return fallback;
  }
}

export function refreshThemeDerivedColors(opts) {
  const currentEditorBg = opts?.currentEditorBg || '#f5f0e8';
  const parseCssRgbTriplet = opts?.parseCssRgbTriplet || null;
  const rgba = opts?.rgba || null;
  const themeRoot = opts?.themeRoot || document.documentElement;
  if (!parseCssRgbTriplet || !rgba) return null;

  const nextBg = readCssVar({ name: '--surface-panel', fallback: currentEditorBg, themeRoot });
  const dark = isDarkThemeActive({ themeRoot });
  const inkRaw = readCssVar({
    name: '--text-primary',
    fallback: dark ? 'rgb(245, 240, 232)' : 'rgb(40, 35, 28)',
    themeRoot,
  });
  const inkRgb = parseCssRgbTriplet(inkRaw) || (dark
    ? { r: 245, g: 240, b: 232 }
    : { r: 40, g: 35, b: 28 });

  return {
    editorBg: nextBg || currentEditorBg,
    uvOverlayTheme: {
      gridDash: rgba(inkRgb, dark ? 0.14 : 0.35),
      frame: rgba(inkRgb, dark ? 0.22 : 0.55),
      faceFill: rgba(inkRgb, dark ? 0.05 : 0.06),
      faceStroke: rgba(inkRgb, dark ? 0.26 : 0.65),
      label: rgba(inkRgb, dark ? 0.72 : 0.55),
      labelStrong: rgba(inkRgb, dark ? 0.88 : 0.85),
    },
  };
}

export function create(opts) {
  const storageGet = (opts && typeof opts.storageGet === 'function') ? opts.storageGet : (() => null);
  const storageSet = (opts && typeof opts.storageSet === 'function') ? opts.storageSet : (() => false);
  const onThemeRefresh = (opts && typeof opts.onThemeRefresh === 'function') ? opts.onThemeRefresh : (() => {});
  const themeRoot = opts?.themeRoot || document.documentElement;
  const themeInputs = Array.from(opts?.themeInputs || document.querySelectorAll('.xr-theme-toggle input[type="radio"]'));
  const themeStorageKey = opts?.themeStorageKey || 'theme';

  function refreshAll() {
    try { onThemeRefresh(); } catch (_) {}
  }

  function applyTheme(value) {
    themeRoot.setAttribute('data-theme', value);
    storageSet(themeStorageKey, value);
    themeInputs.forEach((input) => {
      input.checked = input.value === value;
    });
    refreshAll();
    return value;
  }

  function bind() {
    const storedTheme = storageGet(themeStorageKey) || 'auto';
    themeRoot.setAttribute('data-theme', storedTheme);
    refreshAll();
    themeInputs.forEach((input) => {
      input.checked = input.value === storedTheme;
      if (input.dataset.boundShellTheme === '1') return;
      input.dataset.boundShellTheme = '1';
      input.addEventListener('change', () => applyTheme(input.value));
    });
    try {
      const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      mq?.addEventListener?.('change', () => {
        if (String(themeRoot.getAttribute('data-theme') || 'auto') !== 'auto') return;
        refreshAll();
      });
    } catch (_) {}
    return storedTheme;
  }

  return { applyTheme, bind };
}

XR.__modules.ShellTheme = XR.__modules.ShellTheme || {};
XR.__modules.ShellTheme.isDarkThemeActive = isDarkThemeActive;
XR.__modules.ShellTheme.readCssVar = readCssVar;
XR.__modules.ShellTheme.refreshThemeDerivedColors = refreshThemeDerivedColors;
XR.__modules.ShellTheme.create = create;
