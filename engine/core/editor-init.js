export function preflight(args) {
  const opts = args?.opts || null;
  const refs = args?.refs || {};
  const setStatusKey = args?.setStatusKey || null;

  if (refs.initialized) return true;

  const silent = !!(opts && opts.silent);

  refs.threeWrap = document.getElementById('threeWrap') || refs.threeWrap;
  refs.threeCanvas = document.getElementById('threeCanvas') || refs.threeCanvas;
  refs.baseCanvas = document.getElementById('imageCanvas') || refs.baseCanvas;
  refs.uvCanvas = document.getElementById('uvOverlay') || refs.uvCanvas;

  if (!refs.threeWrap || !refs.threeCanvas || !refs.baseCanvas || !refs.uvCanvas) {
    if (!silent && !refs.initErrorShown && document.readyState !== 'loading') {
      refs.initErrorShown = true;
      const missing = [];
      if (!refs.threeWrap) missing.push('#threeWrap');
      if (!refs.threeCanvas) missing.push('#threeCanvas');
      if (!refs.baseCanvas) missing.push('#imageCanvas');
      if (!refs.uvCanvas) missing.push('#uvOverlay');
      const msg = 'XReate failed to initialize: missing DOM nodes ' + missing.join(', ') + '. Try refreshing, disabling extensions, or opening via a local HTTP server.';
      try { console.error(msg); } catch (_) {}
      try {
        let el = document.getElementById('xrInitError');
        if (!el) {
          el = document.createElement('div');
          el.id = 'xrInitError';
          el.className = 'xr-init-error';
          el.setAttribute('role', 'alert');
          el.textContent = msg;
          document.body.appendChild(el);
        } else {
          el.textContent = msg;
          el.hidden = false;
        }
      } catch (_) {}
    }

    return false;
  }

  refs.initialized = true;


  if (refs.resumeDomObserver) {
    try { refs.resumeDomObserver.disconnect(); } catch (_) {}
    refs.resumeDomObserver = null;
  }
  if (refs.resumeRafId) {
    try { cancelAnimationFrame(refs.resumeRafId); } catch (_) {}
    refs.resumeRafId = 0;
  }
  refs.resumeRafFrames = 0;

  if (!refs.bootLogged) {
    refs.bootLogged = true;
    try { console.info('XReate initialized — a volumetric sketchbook for XR prototyping.'); } catch (_) {}
    try { console.info('Dedicated to Federico Torre.'); } catch (_) {}
  }

  try {
    if (args?.isRestrictedOrigin?.() && !refs.restrictedOriginNoteShown) {
      refs.restrictedOriginNoteShown = true;
      if (typeof setStatusKey === 'function') setStatusKey('autosave_disabled', '');
    }
  } catch (_) {}

  return true;
}

export const EditorInit = { preflight };
