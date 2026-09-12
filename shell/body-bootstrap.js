(() => {
  const trace = (type, details = {}) => {
    const XR = window.XR = window.XR || {};
    if (XR.DebugLog?.event) XR.DebugLog.event(type, details);
    else (XR.__debugPending = XR.__debugPending || []).push({ type, details });
  };
  // `defer` classic scripts do not wait for an ESM graph to finish fetching.
  // Running the bridge in that gap used to make Editor.create observe a partial
  // compatibility facade (notably ExportConfiguration) and fail permanently.
  const engineReady = () => typeof window.XR?.ExportConfiguration?.createExportConfigurations === 'function';
  // The shell entry point is an ESM graph.  CanvasSizing was originally the
  // only readiness sentinel, but it is imported before the modal modules.
  // That allowed the legacy bridge to start with a partially published shell:
  // a menu could render while Doodle/Mask actions had no callable owner.
  const shellReady = () => (
    typeof window.XR?.__modules?.ShellCanvasSizing?.scaleDrawCanvas === 'function'
    && typeof window.XR?.__modules?.ShellDoodleModal?.create === 'function'
    && typeof window.XR?.__modules?.ShellMaskEditor?.create === 'function'
  );
  if (!engineReady() || !shellReady()) {
    const missing = !engineReady() ? 'engine' : 'shell';
    trace('bootstrap.waiting-for-modules', { missing });
    const key = '__bodyBootstrapWaitingForModules';
    if (!window.XR?.[key]) {
      window.XR = window.XR || {};
      window.XR[key] = true;
      const scriptUrl = document.currentScript?.src || 'shell/body-bootstrap.js';
      const timeout = window.setTimeout(() => {
        if (!window.XR?.[key]) return;
        console.error('[bootstrap]', 'module readiness', new Error('engine and shell modules did not become ready within 10 seconds'));
      }, 10000);
      const retryWhenReady = () => {
        if (!engineReady() || !shellReady()) return;
        window.clearTimeout(timeout);
        window.XR[key] = false;
        const retry = document.createElement('script');
        retry.src = scriptUrl;
        retry.defer = true;
        document.body.appendChild(retry);
      };
      window.addEventListener('xreate:engine-modules-ready', retryWhenReady);
      window.addEventListener('xreate:shell-modules-ready', retryWhenReady);
    }
    return;
  }
  function reportBootstrapError(stage, err) {
    const error = err instanceof Error ? err : new Error(String(err || 'Unknown bootstrap failure'));
    try { console.error('[bootstrap]', stage, error); } catch (_) {}
    trace('bootstrap.failure', { stage, error });
    try {
      const root = document.getElementById('xr-shell-root') || document.body;
      if (!root) return;
      root.dataset.bootstrapError = String(stage);
      let banner = document.getElementById('xr-bootstrap-error');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'xr-bootstrap-error';
        banner.setAttribute('role', 'alert');
        banner.style.cssText = 'position:fixed;inset:auto 12px 12px;z-index:2147483647;padding:10px 12px;background:#7f1d1d;color:#fff;font:12px/1.4 sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.35)';
        root.appendChild(banner);
      }
      banner.textContent = 'XReate could not finish loading. Open the console for diagnostic details.';
    } catch (bannerError) {
      try { console.error('[bootstrap] error banner failed', bannerError); } catch (_) {}
    }
  }

  const mountPromise = Promise.resolve().then(() => {
    try {
      const r = window.XR?.__modules?.ShellBodyMarkup?.mount?.();
      if (r && typeof r.then === 'function') return r.catch(() => false);
      return Promise.resolve(!!r);
    } catch (_) { return Promise.resolve(false); }
  }).then((mounted) => {
    if (mounted) return true;
    return new Promise((resolve) => {
      let tries = 0;
      const tick = () => {
        tries += 1;
        const root = document.getElementById('xr-shell-root');
        if (root && root.dataset && root.dataset.xrShellMounted === '1') { resolve(true); return; }
        if (tries >= 80) { resolve(false); return; }
        setTimeout(tick, 25);
      };
      setTimeout(tick, 0);
    });
  });

  mountPromise.then((mounted) => {
    if (!mounted) {
      reportBootstrapError('shell markup mount', new Error('Shell markup did not mount within the startup timeout'));
      return;
    }
    trace('bootstrap.markup-ready');
    /**
     * isRestrictedOrigin: true when storage APIs are restricted (file: / null origin).
     * @returns {boolean}
     */
  const isRestrictedOrigin = (() => {
    try {
      if (window.location.protocol === 'file:') return true;
      if (window.location.origin === 'null') return true;
    } catch (_) {}
    return false;
  })();
  try { window.XR = window.XR || {}; if (window.XR.Storage && typeof window.XR.Storage.setRestricted === 'function') window.XR.Storage.setRestricted(isRestrictedOrigin); } catch (_) {}

  function storageGet(key) {
    try { return window.XR && window.XR.Storage && typeof window.XR.Storage.getRaw === 'function' ? window.XR.Storage.getRaw(String(key)) : null; } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { return window.XR && window.XR.Storage && typeof window.XR.Storage.setRaw === 'function' ? window.XR.Storage.setRaw(String(key), String(value)) : false; } catch (_) { return false; }
  }

  function tr(key) {
    try {
      const f = window.XR && window.XR.i18n && typeof window.XR.i18n.t === 'function' ? window.XR.i18n.t : null;
      return f ? f(key) : String(key);
    } catch (_) {
      return String(key);
    }
  }

  // The body bootstrap owns a few UI actions before the legacy editor is
  // created.  Keep their notification dependency explicit instead of relying
  // on an undeclared legacy free variable.
  function showToast(message, type) {
    try {
      const toast = window.XR?.showToast || window.XR?.__modules?.showToast || null;
      if (typeof toast === 'function') return toast(message, type);
    } catch (err) {
      console.error('[bootstrap]', 'toast notification', err);
    }
    return null;
  }

  const translations = {
    en: {
      page_title: 'XReate — A Volumetric Sketchbook for XR Prototyping',
      menu_title: 'Menu',
      menu_close: 'Close menu',
      menu_language: 'Language',
      menu_theme: 'Theme',
      menu_tab_project: 'Project',
      menu_tab_preferences: 'Preferences',
      menu_tab_help: 'Help',
      menu_tab_about: 'About',
      project_name_hint: 'Type a name for your project. Press Enter to confirm.',
      action_confirm: 'Confirm',
      action_cancel: 'Cancel',
      toast_dismiss_aria: 'Dismiss notification',
      modal_glb_title: 'Export GLB',
      modal_glb_ready: 'GLB ready — the download should start shortly.',
      modal_usdz_title: 'Export USDZ',
      modal_usdz_ready: 'USDZ ready — the download should start shortly.',
      modal_save_failed: 'Save failed'
    }
  };

  let editorApi = null;
  const langSelect = document.getElementById('lang-select');
  const createShellI18n = () => {
    const mod = window.XR?.__modules?.ShellI18n || null;
    if (mod && typeof mod.create === 'function') {
      try {
        return mod.create({
          translations,
          storageGet,
          storageSet,
          getEditorApi: () => editorApi,
          langSelect,
          isRestrictedOrigin
        });
      } catch (_) {}
    }

    const rtlLangs = new Set(['ar', 'fa', 'he']);
    let currentLang = 'en';

    function t(key) {
      const dict = translations[currentLang] || translations.en || {};
      const fallback = translations.en || {};
      const value = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
      if (value !== undefined && value !== null && value !== '') return String(value);
      const f = Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : undefined;
      if (f !== undefined && f !== null && f !== '') return String(f);
      return key;
    }

    async function loadTranslations() {}

    function sanitizeInlineHtml(html) {
      const tpl = document.createElement('template');
      tpl.innerHTML = String(html);
      const allowed = new Set(['strong', 'em', 'b', 'i', 'br', 'span']);
      const all = Array.from(tpl.content.querySelectorAll('*'));
      for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (!allowed.has(tag)) {
          const parent = el.parentNode;
          if (!parent) continue;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          continue;
        }
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      }
      return tpl.innerHTML;
    }

    function applyTranslations(lang) {
      currentLang = translations[lang] ? lang : 'en';
      document.documentElement.lang = currentLang;
      document.documentElement.dir = rtlLangs.has(currentLang) ? 'rtl' : 'ltr';
      document.title = t('page_title');

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.textContent = value;
      });

      document.querySelectorAll('[data-i18n-html]').forEach((el) => {
        const key = el.getAttribute('data-i18n-html');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.innerHTML = sanitizeInlineHtml(value);
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('placeholder', value);
      });

      document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-aria');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('aria-label', value);
      });

      document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('title', value);
      });

      document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
        const key = el.getAttribute('data-i18n-alt');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('alt', value);
      });

      try { editorApi?.refreshI18n?.(); } catch (_) {}
      try {
        const empty = document.querySelector('.xr-tree-empty');
        if (empty) empty.textContent = t('tree_empty');
      } catch (_) {}
    }

    window.XR = window.XR || {};
    window.XR.i18n = window.XR.i18n || {};
    window.XR.i18n.t = t;

    const translationsReady = Promise.resolve().then(() => {
      try {
        const storedLang = storageGet('lang');
        const browserLang = (navigator.language || '').split('-')[0];
        const initial = storedLang || browserLang || 'en';
        applyTranslations(initial);
        if (langSelect) langSelect.value = translations[initial] ? initial : 'en';
      } catch (_) {}
    });
    try {
      if (langSelect && !langSelect.__xrI18nBound) {
        langSelect.__xrI18nBound = true;
        langSelect.addEventListener('change', (e) => {
          const value = e.target.value;
          storageSet('lang', value);
          applyTranslations(value);
        });
      }
    } catch (_) {}

    return { t, loadTranslations, applyTranslations, translationsReady };
  };
  const shellI18n = createShellI18n();
  const t = shellI18n.t;
  const loadTranslations = shellI18n.loadTranslations;
  const applyTranslations = shellI18n.applyTranslations;
  const translationsReady = shellI18n.translationsReady;

  const themeRoot = document.documentElement;
  const themeInputs = document.querySelectorAll('.xr-theme-toggle input[type="radio"]');
  const themeStorageKey = 'theme';
  const refreshThemeUi = () => {
    try { refreshThemeDerivedColors(); } catch (_) {}
    try { rebuildGridLabels(); } catch (_) {}
    try { updateViewportScaleLabel(); } catch (_) {}
    try { drawBaseLayer(); } catch (_) {}
    try { renderUvOverlay(); } catch (_) {}
  };
  const themeMod = window.XR?.__modules?.ShellTheme || null;
  if (themeMod && typeof themeMod.create === 'function') {
    try {
      themeMod.create({
        storageGet,
        storageSet,
        themeRoot,
        themeInputs,
        themeStorageKey,
        onThemeRefresh: refreshThemeUi,
      }).bind();
    } catch (_) {
      const applyTheme = (value) => {
        themeRoot.setAttribute('data-theme', value);
        storageSet(themeStorageKey, value);
        themeInputs.forEach((input) => {
          input.checked = input.value === value;
        });
        refreshThemeUi();
      };

      const storedTheme = storageGet(themeStorageKey) || 'auto';
      themeRoot.setAttribute('data-theme', storedTheme);
      refreshThemeUi();
      themeInputs.forEach((input) => {
        input.checked = input.value === storedTheme;
        input.addEventListener('change', () => applyTheme(input.value));
      });
      try {
        const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        mq?.addEventListener?.('change', () => {
          if (String(themeRoot.getAttribute('data-theme') || 'auto') !== 'auto') return;
          refreshThemeUi();
        });
      } catch (_) {}
    }
  } else {
    const applyTheme = (value) => {
      themeRoot.setAttribute('data-theme', value);
      storageSet(themeStorageKey, value);
      themeInputs.forEach((input) => {
        input.checked = input.value === value;
      });
      refreshThemeUi();
    };

    const storedTheme = storageGet(themeStorageKey) || 'auto';
    themeRoot.setAttribute('data-theme', storedTheme);
    refreshThemeUi();
    themeInputs.forEach((input) => {
      input.checked = input.value === storedTheme;
      input.addEventListener('change', () => applyTheme(input.value));
    });
    try {
      const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      mq?.addEventListener?.('change', () => {
        if (String(themeRoot.getAttribute('data-theme') || 'auto') !== 'auto') return;
        refreshThemeUi();
      });
    } catch (_) {}
  }

  const appMenuBtn = document.getElementById('btn-app-menu');
  const appMenu = document.getElementById('app-menu');
  const appMenuClose = document.getElementById('btn-app-menu-close');
  const clearLocalDataBtn = document.getElementById('btn-clear-local-data');
  const appMenuTabs = appMenu ? Array.from(appMenu.querySelectorAll('.xr-menu-tab')) : [];
  const appMenuSections = appMenu ? Array.from(appMenu.querySelectorAll('.xr-menu__section')) : [];
  let appMenuState = null;
  const shellMenuApi2 = window.XR?.__modules?.ShellMenuWiring?.create ? { active: true } : null;

  function setAppMenuTab(tabId) {
    const key = String(tabId || 'project');
    for (const sec of appMenuSections) {
      const on = sec && sec.dataset && sec.dataset.tab === key;
      if (sec) sec.hidden = !on;
    }
    for (const btn of appMenuTabs) {
      const on = btn && btn.dataset && btn.dataset.tab === key;
      if (btn) btn.classList.toggle('is-active', !!on);
      if (btn) btn.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) btn.removeAttribute('tabindex');
      else btn.setAttribute('tabindex', '-1');
    }
  }

  if (!shellMenuApi2) for (const btn of appMenuTabs) {
    btn.addEventListener('click', () => {
      if (!btn || !btn.dataset) return;
      setAppMenuTab(btn.dataset.tab);
    });
    btn.addEventListener('keydown', (e) => {
      const k = (e && e.key) ? e.key : '';
      if (!k) return;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      if (!appMenuTabs.length) return;
      const idx = appMenuTabs.indexOf(btn);
      let nextIdx = idx;
      if (k === 'ArrowLeft') nextIdx = (idx - 1 + appMenuTabs.length) % appMenuTabs.length;
      else if (k === 'ArrowRight') nextIdx = (idx + 1) % appMenuTabs.length;
      else if (k === 'Home') nextIdx = 0;
      else if (k === 'End') nextIdx = appMenuTabs.length - 1;
      const nextBtn = appMenuTabs[nextIdx];
      if (!nextBtn) return;
      setAppMenuTab(nextBtn.dataset.tab);
      try { nextBtn.focus(); } catch (_) {}
    });
  }

  /**
   * openAppMenu: open app menu.
   */
  function openAppMenu() {
    if (!appMenu) return;
    setAppMenuTab('project');
    if (appMenuState) window.XR?.closeModal?.(appMenuState);
    appMenuState = window.XR?.openModal?.(appMenu, {
      initialFocusEl: appMenuClose,
      returnFocusEl: appMenuBtn,
      onRequestClose: closeAppMenu,
    });
    try { appMenuBtn?.setAttribute?.('aria-expanded', 'true'); } catch (_) {}
  }

  /**
   * closeAppMenu: close app menu.
   */
  function closeAppMenu() {
    if (!appMenu) return;
    try { appMenuBtn?.setAttribute?.('aria-expanded', 'false'); } catch (_) {}
    if (appMenuState) {
      const st = appMenuState;
      appMenuState = null;
      window.XR?.closeModal?.(st);
    } else {
      window.XR?.closeModal?.(appMenu);
    }
  }

  if (!shellMenuApi2) {
    appMenuBtn?.addEventListener('click', openAppMenu);
    appMenuClose?.addEventListener('click', closeAppMenu);
  }
  function bindClearLocalDataConfirm() {
    const btn = document.getElementById('btn-clear-local-data');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const row = document.getElementById('clearLocalDataRow');
      if (!row || row.dataset.confirming === '1') return;
      row.dataset.confirming = '1';
      const prev = row.innerHTML;
      const wrap = document.createElement('div');
      wrap.className = 'xr-menu-confirm';
      const msg = document.createElement('div');
      msg.className = 'xr-menu-confirm__msg';
      msg.setAttribute('data-i18n', 'clear_local_data_confirm_ui');
      msg.textContent = tr('clear_local_data_confirm_ui');
      const actions = document.createElement('div');
      actions.className = 'xr-menu__row';
      const btnYes = document.createElement('button');
      btnYes.type = 'button';
      btnYes.className = 'xr-btn is-danger';
      btnYes.setAttribute('data-i18n', 'action_confirm');
      btnYes.textContent = tr('action_confirm');
      const btnNo = document.createElement('button');
      btnNo.type = 'button';
      btnNo.className = 'xr-btn';
      btnNo.setAttribute('data-i18n', 'action_cancel');
      btnNo.textContent = tr('action_cancel');
      actions.append(btnYes, btnNo);
      wrap.append(msg, actions);
      row.innerHTML = '';
      row.appendChild(wrap);
      const onKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); restore(); }
      };
      const restore = () => {
        try { appMenu?.removeEventListener?.('keydown', onKeyDown); } catch (_) {}
        row.dataset.confirming = '0';
        row.innerHTML = prev;
        try { applyTranslations(document.documentElement.lang || 'en'); } catch (_) {}
        bindClearLocalDataConfirm();
        document.getElementById('btn-clear-local-data')?.focus();
      };
      btnNo.addEventListener('click', restore);
      btnYes.addEventListener('click', () => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (!k) continue;
              if (k === 'xreate_viewport' || k === 'translations_cache_v1' || k === 'mastodonInstance' || k.startsWith('autosave:') || k.startsWith('autosave_')) {
                try { localStorage.removeItem(k); } catch (_) {}
              }
            }
          }
        } catch (_) {}
        try { showToast(tr('clear_local_data_done'), 'info'); } catch (_) {}
        restore();
        closeAppMenu();
      });
      appMenu?.addEventListener('keydown', onKeyDown);
      btnYes.focus();
    });
  }
  bindClearLocalDataConfirm();

  let shellBodyOverlaysApi = null;
  function ensureShellBodyOverlaysApi() {
    if (shellBodyOverlaysApi) return shellBodyOverlaysApi;
    const mod = window.XR?.__modules?.ShellBodyOverlays || null;
    if (!mod || typeof mod.create !== 'function') return null;
    try {
      shellBodyOverlaysApi = mod.create({
        t,
        storageGet,
        storageSet,
        closeAppMenu,
      });
      return shellBodyOverlaysApi;
    } catch (_) {
      return null;
    }
  }
  function openShortcutsModal() {
    const api = ensureShellBodyOverlaysApi();
    if (api && typeof api.openShortcutsModal === 'function') {
      try { api.openShortcutsModal(); } catch (_) {}
    }
  }
  function closeShortcutsModal() {
    const api = ensureShellBodyOverlaysApi();
    if (api && typeof api.closeShortcutsModal === 'function') {
      try { api.closeShortcutsModal(); } catch (_) {}
    }
  }
  function openUvCompareModal() {
    const api = ensureShellBodyOverlaysApi();
    if (api && typeof api.openUvCompareModal === 'function') {
      try { api.openUvCompareModal(); } catch (_) {}
    }
  }
  function closeUvCompareModal() {
    const api = ensureShellBodyOverlaysApi();
    if (api && typeof api.closeUvCompareModal === 'function') {
      try { api.closeUvCompareModal(); } catch (_) {}
    }
  }
  function closeShareModal() {
    const api = ensureShellBodyOverlaysApi();
    if (api && typeof api.closeShareModal === 'function') {
      try { api.closeShareModal(); } catch (_) {}
    }
  }
  const shareModal = document.getElementById('share-modal');
  const bindShellBodyOverlays = () => {
    const api = ensureShellBodyOverlaysApi();
    if (!api || typeof api.bind !== 'function') return false;
    try {
      api.bind();
      return true;
    } catch (_) {
      return false;
    }
  };
  let shellBodyOverlaysBindAttempts = 0;
  let shellBodyOverlaysBindTimer = 0;
  const retryBindShellBodyOverlays = () => {
    if (bindShellBodyOverlays()) return;
    shellBodyOverlaysBindAttempts += 1;
    if (shellBodyOverlaysBindAttempts >= 40) return;
    shellBodyOverlaysBindTimer = window.setTimeout(retryBindShellBodyOverlays, 50);
  };
  if (!bindShellBodyOverlays()) {
    retryBindShellBodyOverlays();
    try {
      window.addEventListener('load', () => {
        if (shellBodyOverlaysBindTimer) {
          try { window.clearTimeout(shellBodyOverlaysBindTimer); } catch (_) {}
          shellBodyOverlaysBindTimer = 0;
        }
        bindShellBodyOverlays();
      }, { once: true });
    } catch (_) {}
  }

  let shellDoodleModalApi = null;
  function ensureShellDoodleModalApi() {
    if (shellDoodleModalApi) return shellDoodleModalApi;
    const mod = window.XR?.__modules?.ShellDoodleModal || null;
    if (!mod || typeof mod.create !== 'function') return null;
    try {
      shellDoodleModalApi = mod.create({ t, tr, showToast });
      if (!shellDoodleModalApi) {
        console.error('[bootstrap]', 'doodle modal creation returned no API');
        trace('bootstrap.doodle-modal.create.empty');
        return null;
      }
      window.XR.__bodyBootstrap = window.XR.__bodyBootstrap || {};
      window.XR.__bodyBootstrap.shellDoodleModalApi = shellDoodleModalApi;
      trace('bootstrap.doodle-modal.create.success');
      return shellDoodleModalApi;
    } catch (err) {
      console.error('[bootstrap]', 'doodle modal creation', err);
      trace('bootstrap.doodle-modal.create.failure', { error: String(err?.message || err) });
      return null;
    }
  }
  const bindShellDoodleModal = () => {
    const api = ensureShellDoodleModalApi();
    if (!api || typeof api.bind !== 'function') return false;
    try {
      api.bind();
      trace('bootstrap.doodle-modal.bind.success');
      return true;
    } catch (err) {
      console.error('[bootstrap]', 'doodle modal binding', err);
      trace('bootstrap.doodle-modal.bind.failure', { error: String(err?.message || err) });
      return false;
    }
  };
  let shellDoodleModalBindAttempts = 0;
  let shellDoodleModalBindTimer = 0;
  const retryBindShellDoodleModal = () => {
    if (bindShellDoodleModal()) return;
    shellDoodleModalBindAttempts += 1;
    if (shellDoodleModalBindAttempts >= 40) return;
    shellDoodleModalBindTimer = window.setTimeout(retryBindShellDoodleModal, 50);
  };
  if (!bindShellDoodleModal()) {
    retryBindShellDoodleModal();
    try {
      window.addEventListener('load', () => {
        if (shellDoodleModalBindTimer) {
          try { window.clearTimeout(shellDoodleModalBindTimer); } catch (_) {}
          shellDoodleModalBindTimer = 0;
        }
        bindShellDoodleModal();
      }, { once: true });
    } catch (_) {}
  }

  try {
    trace('bootstrap.editor.create.start');
    editorApi = window.XR?.Editor?.create?.() || null;
    trace('bootstrap.editor.create.success', { created: !!editorApi });
  } catch (err) {
    reportBootstrapError('editor creation', err);
    return;
  }
  if (!editorApi) {
    reportBootstrapError('editor creation', new Error('XR.Editor.create is unavailable or returned no editor API'));
    return;
  }

  // The legacy factory normally binds these controls, but it can encounter the
  // shell module before the dynamic markup exists.  The result was a rendered
  // Add Volume button with no listener (most visible on focused/tablet
  // layouts).  Bind once again at the stable boundary: every menu listener
  // carries its own data guard, so this is intentionally idempotent.
  let shellMenuWiringApi = null;
  function bindShellMenuWiring() {
    if (shellMenuWiringApi) return true;
    const module = window.XR?.__modules?.ShellMenuWiring || null;
    if (typeof module?.create !== 'function') return false;
    try {
      shellMenuWiringApi = module.create({
        openAddShapeMenu: (...args) => window.XR?.openAddShapeMenu?.(...args),
        closeAddShapeMenu: (...args) => window.XR?.closeAddShapeMenu?.(...args),
        toggleAddShapeMenu: (...args) => window.XR?.toggleAddShapeMenu?.(...args),
        openAutosaveModal: () => window.XR?.Autosave?.openModal?.(),
        closeExportModal: () => window.XR?.closeExportModal?.(),
        exportGLB: () => window.XR?.__modules?.exportGLB?.(),
        exportUSDZ: () => window.XR?.__modules?.exportUSDZ?.(),
        exportTextureAtlas: () => window.XR?.__modules?.exportTextureAtlas?.(),
        openModal: (...args) => window.XR?.openModal?.(...args),
        closeModal: (...args) => window.XR?.closeModal?.(...args),
      });
      shellMenuWiringApi?.bind?.();
      trace('bootstrap.menu-wiring.success');
      return true;
    } catch (err) {
      console.error('[bootstrap]', 'menu wiring', err);
      trace('bootstrap.menu-wiring.failure', { error: String(err?.message || err) });
      shellMenuWiringApi = null;
      return false;
    }
  }
  if (!bindShellMenuWiring()) {
    let menuBindAttempts = 0;
    const retryMenuWiring = () => {
      if (bindShellMenuWiring()) return;
      menuBindAttempts += 1;
      if (menuBindAttempts < 40) window.setTimeout(retryMenuWiring, 50);
      else console.error('[bootstrap]', 'menu wiring', new Error('ShellMenuWiring did not become ready within 2 seconds'));
    };
    window.setTimeout(retryMenuWiring, 50);
  }
  let shellBootstrapApi = null;
  function ensureShellBootstrapApi() {
    if (shellBootstrapApi) return shellBootstrapApi;
    const mod = window.XR?.__modules?.ShellBootstrap || null;
    if (!mod || typeof mod.create !== 'function') return null;
    try {
      shellBootstrapApi = mod.create({
        editorApi,
        translationsReady,
        shareModal,
        closeShareModal,
      });
      return shellBootstrapApi;
    } catch (_) {
      return null;
    }
  }
  const startShellBootstrap = () => {
    const api = ensureShellBootstrapApi();
    if (!api || typeof api.install !== 'function') return false;
    try {
      api.install();
      return true;
    } catch (_) {
      return false;
    }
  };
  let shellBootstrapAttempts = 0;
  let shellBootstrapTimer = 0;
  const retryShellBootstrap = () => {
    if (startShellBootstrap()) return;
    shellBootstrapAttempts += 1;
    if (shellBootstrapAttempts >= 40) return;
    shellBootstrapTimer = window.setTimeout(retryShellBootstrap, 50);
  };
  // WARNING: Historical i18n startup race (fixed).
  // XR.i18n.t is assigned synchronously, while translations.json is loaded asynchronously.
  // Current design: wait for translationsReady before `resumeAll()`, now orchestrated by `ShellBootstrap`.
  if (!startShellBootstrap()) {
    retryShellBootstrap();
    try {
      window.addEventListener('load', () => {
        if (shellBootstrapTimer) {
          try { window.clearTimeout(shellBootstrapTimer); } catch (_) {}
          shellBootstrapTimer = 0;
        }
        startShellBootstrap();
      }, { once: true });
    } catch (_) {}
  }
  }).catch((err) => reportBootstrapError('body bootstrap', err));
})();
