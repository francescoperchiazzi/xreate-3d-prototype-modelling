// TRAE — XReate Top-Level UI Authority (single source of truth for UI modes + window registry).
// Architecture hierarchy target: TRAE → UI Shell → Mode Controller → Window Manager → Windows → Controls.
// No framework. Minimal consolidation only.

(function () {
  const XR = (window.XR = window.XR || {});
  if (XR.TRAE) return;

  const ROOT = document.documentElement;
  const STORAGE_KEY = 'xr.trae.uiMode';
  const MODES = Object.freeze(['draft3d', 'texture']);
  const DEFAULT_MODE = 'draft3d';

  const WINDOW_AUTO_SELECTORS = Object.freeze([
    { id: 'xr-app', sel: '.xr-app' },
    { id: 'xr-shell-root', sel: '#xr-shell-root' },
    { id: 'xreate-editor-root', sel: '#xreate-editor-root' },
    { id: 'xr-header', sel: 'header.xr-header' },
    { id: 'trae-mode-selector', sel: '#trae-mode-selector' },
    { id: 'btn-scene', sel: '#btn-scene' },
    { id: 'btn-add-shape', sel: '#btn-add-shape' },
    { id: 'add-shape-menu', sel: '#add-shape-menu' },
    { id: 'export-group', sel: '.xr-export-group' },
    { id: 'xr-export-dropdown', sel: '#xr-export-dropdown' },
    { id: 'btn-app-menu', sel: '#btn-app-menu' },
    { id: 'app-menu', sel: '#app-menu' },
    { id: 'toast', sel: '#toast' },
    { id: 'tooltip', sel: '#tooltip' },
    { id: 'scene-panel', sel: '#scenePanel' },
    { id: 'panel-viewport', sel: 'section.xr-panel-viewport' },
    { id: 'panel-inspector', sel: 'aside.xr-panel-inspector' },
    { id: 'panel-surface', sel: 'aside.xr-panel-surface' },
    { id: 'modal-export', sel: '#exportModal' },
    { id: 'modal-rename-layer', sel: '#renameLayerModal' },
    { id: 'modal-shortcuts', sel: '#shortcutsModal' },
    { id: 'modal-uv-compare', sel: '#uvCompareModal' },
    { id: 'modal-mask', sel: '#maskModal' },
    { id: 'modal-doodle', sel: '#doodleModal' },
    { id: 'modal-autosave', sel: '#autosaveModal' },
    { id: 'modal-share', sel: '#share-modal' },
    { id: 'modal-mastodon', sel: '#mastodon-modal' },
    { id: 'modal-image', sel: '#image-modal' },
  ]);

  let _mode = DEFAULT_MODE;
  let _initialized = false;
  let _winRegistry = Object.create(null);
  let _winAutoRegistered = false;

  function getMode() {
    return _mode;
  }

  function isValidMode(m) {
    return MODES.indexOf(m) !== -1;
  }

  function applyDomMode(mode) {
    ROOT.setAttribute('data-ui-mode', mode);
  }

  function persistMode(mode) {
    try {
      if (XR.Storage && XR.Storage.put) {
        XR.Storage.put(STORAGE_KEY, mode);
      } else {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch (_) {}
  }

  function restoreMode() {
    return DEFAULT_MODE;
  }

  function syncModeSelectorUI(mode) {
    try {
      const root = document.getElementById('trae-mode-selector');
      if (!root) return;
      const btns = root.querySelectorAll('[data-mode-target]');
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        const t = b.getAttribute('data-mode-target');
        const on = t === mode;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.setAttribute('tabindex', on ? '0' : '-1');
      }
    } catch (_) {}
  }

  function setMode(nextMode, opts) {
    const options = opts || {};
    if (!isValidMode(nextMode)) return false;
    const prev = _mode;
    if (prev === nextMode) {
      if (!options.silent) syncModeSelectorUI(nextMode);
      return true;
    }
    _mode = nextMode;
    applyDomMode(nextMode);
    if (options.persist !== false) persistMode(nextMode);
    syncModeSelectorUI(nextMode);
    try {
      const ev = new CustomEvent('xr:ui-mode-changed', {
        detail: { from: prev, to: nextMode },
        bubbles: true,
      });
      document.dispatchEvent(ev);
    } catch (_) {}
    return true;
  }

  function bindModeSelectorUI() {
    try {
      const root = document.getElementById('trae-mode-selector');
      if (!root) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', bindModeSelectorUI, { once: true });
        } else {
          window.setTimeout(bindModeSelectorUI, 250);
          window.setTimeout(bindModeSelectorUI, 800);
          window.setTimeout(bindModeSelectorUI, 1600);
        }
        return;
      }
      // This function is deliberately retried while async shell markup mounts.
      // Without a per-element guard every successful retry installs another
      // click/keydown pair on the same selector.
      if (root.dataset.xrTraeBound === '1') return;
      root.dataset.xrTraeBound = '1';
      root.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-mode-target]');
        if (!btn || !btn.getAttribute('data-mode-target')) return;
        setMode(btn.getAttribute('data-mode-target'));
      });
      root.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const items = Array.prototype.slice.call(root.querySelectorAll('[data-mode-target]'));
        if (!items.length) return;
        let idx = -1;
        for (let i = 0; i < items.length; i++) {
          if (items[i].getAttribute('aria-selected') === 'true') { idx = i; break; }
        }
        if (idx === -1) idx = 0;
        idx = e.key === 'ArrowLeft'
          ? (idx - 1 + items.length) % items.length
          : (idx + 1) % items.length;
        items[idx].focus();
        setMode(items[idx].getAttribute('data-mode-target'));
        e.preventDefault();
      });
    } catch (_) {}
  }

  function winResolveEl(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      if (_winRegistry[target]) return _winRegistry[target].el;
      try { return document.querySelector(target); } catch (_) { return null; }
    }
    if (target.nodeType === 1) return target;
    if (target.el && target.el.nodeType === 1) return target.el;
    return null;
  }

  function winRegister(winDef) {
    if (!winDef || !winDef.id) return null;
    const existing = _winRegistry[winDef.id];
    if (existing && !winDef.force) return existing;
    const el = winResolveEl(winDef.el || winDef.sel || winDef.id);
    const entry = {
      id: winDef.id,
      el: el,
      sel: winDef.sel || null,
      mode: winDef.mode || (el && el.getAttribute && el.getAttribute('data-ui-mode')) || null,
      label: winDef.label || winDef.id,
    };
    _winRegistry[winDef.id] = entry;
    return entry;
  }

  function winGet(id) {
    if (!id) return null;
    return _winRegistry[id] || null;
  }

  function winList(options) {
    const opts = options || {};
    const out = [];
    const ids = Object.keys(_winRegistry);
    for (let i = 0; i < ids.length; i++) {
      const e = _winRegistry[ids[i]];
      if (opts.mode && e.mode !== opts.mode) continue;
      if (opts.onlyExisting && !e.el) continue;
      out.push(e);
    }
    return out;
  }

  function winIsVisible(target, opts) {
    const el = winResolveEl(target);
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none') return false;
    if (st.visibility === 'hidden') return false;
    if (el.hasAttribute && el.hasAttribute('hidden')) return false;
    if (opts && opts.skipRectCheck) return true;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return true;
  }

  function winShow(target) {
    const el = winResolveEl(target);
    if (!el) return false;
    if (el.hasAttribute && el.hasAttribute('hidden')) el.removeAttribute('hidden');
    return true;
  }

  function winHide(target) {
    const el = winResolveEl(target);
    if (!el) return false;
    if (el.hasAttribute) el.setAttribute('hidden', '');
    return true;
  }

  function winCloseAll(options) {
    const opts = options || {};
    const closed = [];
    const ids = Object.keys(_winRegistry);
    for (let i = 0; i < ids.length; i++) {
      const e = _winRegistry[ids[i]];
      if (!e.el) continue;
      const isModal = /modal/i.test(e.id) || (e.mode === 'modal');
      const isMenu = /menu|dropdown/i.test(e.id);
      if (opts.all) {
        if (winHide(e.el)) closed.push(e.id);
        continue;
      }
      if (opts.onlyModals && !isModal) continue;
      if (opts.onlyMenus && !isMenu) continue;
      if (!opts.onlyModals && !opts.onlyMenus && !isModal && !isMenu) continue;
      if (winHide(e.el)) closed.push(e.id);
    }
    return closed;
  }

  function winGetByMode(mode) {
    return winList({ mode: mode, onlyExisting: true });
  }

  function winAutoRegister() {
    for (let i = 0; i < WINDOW_AUTO_SELECTORS.length; i++) {
      const def = WINDOW_AUTO_SELECTORS[i];
      const existing = _winRegistry[def.id];
      const needsUpdate = !existing || !existing.el || existing.mode === null;
      if (needsUpdate) {
        try { winRegister({ id: def.id, sel: def.sel, force: true, label: def.label }); } catch (_) {}
      }
    }
  }

  function scheduleWinAutoRegister() {
    winAutoRegister();
    setTimeout(winAutoRegister, 250);
    setTimeout(winAutoRegister, 800);
    setTimeout(winAutoRegister, 1600);
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    const restored = restoreMode();
    _mode = restored;
    applyDomMode(restored);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindModeSelectorUI);
      document.addEventListener('DOMContentLoaded', scheduleWinAutoRegister);
    } else {
      bindModeSelectorUI();
      scheduleWinAutoRegister();
    }
  }

  const TRAE = {
    MODES: MODES,
    DEFAULT_MODE: DEFAULT_MODE,
    getMode: getMode,
    setMode: setMode,
    init: init,
    Windows: Object.freeze({
      register: winRegister,
      get: winGet,
      list: winList,
      isVisible: winIsVisible,
      show: winShow,
      hide: winHide,
      closeAll: winCloseAll,
      getByMode: winGetByMode,
    }),
  };

  XR.TRAE = Object.freeze(TRAE);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
