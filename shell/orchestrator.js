const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function install(opts) {
  const translationsReady = opts?.translationsReady || null;
  const resumeAll = opts?.resumeAll || null;
  const pauseAll = opts?.pauseAll || null;
  const disposeAll = opts?.disposeAll || null;

  if (translationsReady && typeof translationsReady.then === 'function') {
    translationsReady.then(
      () => {

        try { resumeAll && resumeAll(); } catch (e) {

        }

      },
      (e) => {
        const msg = 'Translations load failed: ' + (e && e.message ? e.message : String(e || ''));
        try { if (XR && typeof XR.showToast === 'function') { XR.showToast(msg, 'warn'); return; } } catch (_) {}
        try { console.warn('[xr-toast:warning]', msg); } catch (_) {}
        try { resumeAll && resumeAll(); } catch (_) {}
      }
    );
  } else {
    try { resumeAll && resumeAll(); } catch (_) {}
  }

  const BOOT_GRACE_MS = 2000;
  const bootStart = Date.now();
  const onVisibility = () => {
    try {
      const age = Date.now() - bootStart;
      if (age < BOOT_GRACE_MS) {

        return;
      }
      if (document.hidden) { if (typeof pauseAll === 'function') pauseAll(); }
      else { if (typeof resumeAll === 'function') resumeAll(); }
    } catch (_) {}
  };
  // iPad Quick Look can issue pagehide while the document is retained in the
  // back-forward cache. That is a pause, not an editor teardown: disposing WebGL
  // here leaves an empty canvas after the user closes the USDZ preview.
  const onPageHide = (event) => {
    try {
      if (event?.persisted) {
        if (typeof pauseAll === 'function') pauseAll();
        return;
      }
      if (typeof disposeAll === 'function') disposeAll();
    } catch (_) {}
  };
  const onPageShow = (event) => {
    if (!event?.persisted) return;
    try {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try { if (typeof resumeAll === 'function') resumeAll(); } catch (_) {}
      }));
    } catch (_) {
      try { if (typeof resumeAll === 'function') resumeAll(); } catch (_) {}
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide, { capture: true });
  window.addEventListener('pageshow', onPageShow, { capture: true });
  window.addEventListener('beforeunload', onPageHide, { capture: true });

  return () => {
    try { document.removeEventListener('visibilitychange', onVisibility); } catch (_) {}
    try { window.removeEventListener('pagehide', onPageHide, { capture: true }); } catch (_) {}
    try { window.removeEventListener('pageshow', onPageShow, { capture: true }); } catch (_) {}
    try { window.removeEventListener('beforeunload', onPageHide, { capture: true }); } catch (_) {}
  };
}

XR.__modules.ShellOrchestrator = XR.__modules.ShellOrchestrator || {};
XR.__modules.ShellOrchestrator.install = install;
