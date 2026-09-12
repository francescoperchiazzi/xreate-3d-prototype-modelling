export function create(ctx) {
  const refs = ctx?.refs || {};
  const lifecycle = ctx?.lifecycle || null;
  const ensureInit = ctx?.ensureInit || null;
  const syncRefsFromHost = ctx?.syncRefsFromHost || null;
  const syncHostFromRefs = ctx?.syncHostFromRefs || null;
  const onResize = ctx?.onResize || null;
  const onPaste = ctx?.onPaste || null;
  const onEditorKeyDown = ctx?.onEditorKeyDown || null;
  const resize3d = ctx?.resize3d || null;
  const scaleDrawCanvas = ctx?.scaleDrawCanvas || null;
  const renderLoopTick = ctx?.renderLoopTick || null;
  const tick = ctx?.tick || null;
  const renderTreeUI = ctx?.renderTreeUI || null;
  const updatePartControlsFromSelected = ctx?.updatePartControlsFromSelected || null;
  const updateTransformUi = ctx?.updateTransformUi || null;
  const updateUvStretchUi = ctx?.updateUvStretchUi || null;
  const updateUvModeHint = ctx?.updateUvModeHint || null;
  const updateUvTexelDensityUi = ctx?.updateUvTexelDensityUi || null;
  const updateShapeTransformControlsFromSelected = ctx?.updateShapeTransformControlsFromSelected || null;
  const updateInfoForMesh = ctx?.updateInfoForMesh || null;
  const getCurrentMesh = ctx?.getCurrentMesh || null;
  const tr = ctx?.tr || ((key) => String(key));
  const getUvMode = ctx?.getUvMode || null;
  const renderUvCompareNets = ctx?.renderUvCompareNets || null;
  const renderer = ctx?.renderer || null;
  const disposeRuntimeResources = ctx?.disposeRuntimeResources || null;
  const getEditorCleanupFns = ctx?.getEditorCleanupFns || null;
  const cleanupRegistry = ctx?.cleanupRegistry || null;
  const getLifecycleDom = typeof ctx?.getLifecycleDom === 'function'
    ? ctx.getLifecycleDom
    : (() => ctx?.lifecycleDom || null);
  const getSceneDrawerEscHandler = typeof ctx?.getSceneDrawerEscHandler === 'function'
    ? ctx.getSceneDrawerEscHandler
    : (() => null);

  function pullHostState() {
    if (typeof syncRefsFromHost === 'function') {
      try { syncRefsFromHost(); } catch (_) {}
    }
  }

  function pushHostState() {
    if (lifecycle) {
      lifecycle.rafId = (typeof refs.rafId === 'number' && refs.rafId) ? refs.rafId : null;
      lifecycle.paused = !!refs.paused;
      lifecycle.initialized = !!refs.initialized;
    }
    if (typeof syncHostFromRefs === 'function') {
      try { syncHostFromRefs(); } catch (_) {}
    }
  }

  function disconnectResumeWatchers() {
    if (refs.resumeDomObserver) {
      try { refs.resumeDomObserver.disconnect(); } catch (_) {}
      refs.resumeDomObserver = null;
    }
    if (refs.resumeRafId) {
      try { cancelAnimationFrame(refs.resumeRafId); } catch (_) {}
      refs.resumeRafId = 0;
    }
    if (refs.resumeRetryTimer) {
      try { clearTimeout(refs.resumeRetryTimer); } catch (err) { console.warn('[lifecycle] resume retry timer cleanup failed', err); }
      refs.resumeRetryTimer = 0;
    }
    refs.resumeRafFrames = 0;
  }

  const api = {
    resume() {
      try { ensureInit && ensureInit({ silent: refs.resumeRetryCount < 10 }); } catch (_) {}
      pullHostState();
      if (refs.initialized && !refs.paused) {
        pushHostState();
        return;
      }
      if (!refs.initialized) {
        // Hard safety: absolute retry count cap (max ~12 * (40ms + 60ms step) ≈ 4.5s window). Prevents infinite retry loops.
        if ((refs.resumeRetryCount || 0) > 12) {
          try { disconnectResumeWatchers && disconnectResumeWatchers(); } catch (_) {}
          refs.resumeQueued = false;
          pullHostState();
          return;
        }
        if (!refs.resumeQueued) {
          refs.resumeQueued = true;
          pushHostState();
          const retry = () => {
            refs.resumeQueued = false;
            refs.resumeRetryCount = (refs.resumeRetryCount || 0) + 1;
            pushHostState();
            try { api.resume(); } catch (_) {}
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', retry, { once: true });
          } else if (refs.resumeRetryCount < 10) {
            // TEMPORARY DIAGNOSTIC DISABLE: MutationObserver completely disabled to confirm it is the root cause of 110% CPU infinite microtask loop.
            // PROBLEM: Every MutationObserver callback calls api.resume() recursively (line 125 below), queues microtask before other .then() handlers.
            // After >100 disconnections, the code RECREATES a brand-new observer (line 111 check !refs.resumeDomObserver → true after disconnect/null).
            // Result: 100 callbacks → disconnect → recreate → 100 callbacks → disconnect → recreate → INFINITE LOOP.
            // Fix: Replaced with hard disable + hard flag refs._domObserverPermanentlyDisabled so it never gets recreated even if resume() is called 1000 times.
            if (!refs._domObserverPermanentlyDisabled && !refs.resumeDomObserver && document.body && typeof MutationObserver !== 'undefined') {
              try {
                refs._domObserverPermanentlyDisabled = true;
                refs.resumeDomObserver = null;
              } catch (_) {
                refs.resumeDomObserver = null;
              }
            }
            if (!refs.resumeRafId && refs.resumeRafFrames < 20) {
              refs.resumeRafId = requestAnimationFrame(() => {
                refs.resumeRafId = 0;
                refs.resumeRafFrames = (refs.resumeRafFrames || 0) + 1;
                pushHostState();
                try { api.resume(); } catch (_) {}
              });
            }
            const delay = Math.min(500, 40 + ((refs.resumeRetryCount || 0) * 60));
            refs.resumeRetryTimer = setTimeout(() => {
              refs.resumeRetryTimer = 0;
              retry();
            }, delay);
          } else {
            refs.resumeQueued = false;
            try { ensureInit && ensureInit(); } catch (_) {}
            pullHostState();
            disconnectResumeWatchers();
            pushHostState();
          }
        }
        return;
      }

      refs.resumeRetryCount = 0;
      if (!refs.paused) {
        pushHostState();
        return;
      }
      refs.paused = false;
      if (lifecycle) lifecycle.paused = false;
      pushHostState();

      const dom = getLifecycleDom();
      const esc = getSceneDrawerEscHandler();
      if (dom && typeof dom.attach === 'function') {
        try { dom.attach({ onResize, onPaste, onEditorKeyDown, esc }); } catch (_) {}
      } else {
        if (onResize) window.addEventListener('resize', onResize);
        if (onPaste) window.addEventListener('paste', onPaste);
        if (onEditorKeyDown) window.addEventListener('keydown', onEditorKeyDown);
        if (esc) {
          try { document.removeEventListener('keydown', esc, true); } catch (_) {}
          try { document.addEventListener('keydown', esc, true); } catch (_) {}
        }
      }


      try { resize3d && resize3d(); } catch (_) {}
      try { typeof scaleDrawCanvas === 'function' && scaleDrawCanvas(); } catch (_) {}

      if (!lifecycle?.rafId) {
        try {
          if (typeof renderLoopTick === 'function') { renderLoopTick(); }
          else if (typeof tick === 'function') { tick(); }
        } catch (_) {
          try { typeof tick === 'function' && tick(); } catch (_) {}
        }
      }

    },

    refreshI18n() {
      try { typeof renderTreeUI === 'function' && renderTreeUI(); } catch (_) {}
      try { typeof updatePartControlsFromSelected === 'function' && updatePartControlsFromSelected(); } catch (_) {}
      try { typeof updateTransformUi === 'function' && updateTransformUi(); } catch (_) {}
      try { typeof updateUvStretchUi === 'function' && updateUvStretchUi(); } catch (_) {}
      try { typeof updateUvModeHint === 'function' && updateUvModeHint(); } catch (_) {}
      try { typeof updateUvTexelDensityUi === 'function' && updateUvTexelDensityUi(); } catch (_) {}
      try { typeof updateShapeTransformControlsFromSelected === 'function' && updateShapeTransformControlsFromSelected(); } catch (_) {}
      try { typeof updateInfoForMesh === 'function' && updateInfoForMesh(getCurrentMesh ? getCurrentMesh() : null); } catch (_) {}
      try {
        const cap = document.getElementById('uvPreviewCaption');
        if (cap) {
          const prefix = tr('uv_preview_prefix');
          const safePrefix = (prefix && prefix !== 'uv_preview_prefix') ? prefix : 'UV preview:';
          const uvMode = getUvMode ? getUvMode() : null;
          cap.textContent = uvMode ? (safePrefix + ' ' + String(uvMode)) : safePrefix;
        }
      } catch (_) {}
      try {
        if (!document.getElementById('uvCompareModal')?.hidden && typeof renderUvCompareNets === 'function') {
          renderUvCompareNets();
        }
      } catch (_) {}
    },

    pause() {
      if (refs.paused) return;
      refs.paused = true;
      if (lifecycle) lifecycle.paused = true;
      pushHostState();
      disconnectResumeWatchers();

      const dom = getLifecycleDom();
      const esc = getSceneDrawerEscHandler();
      if (dom && typeof dom.detach === 'function') {
        try { dom.detach({ onResize, onPaste, onEditorKeyDown, esc }); } catch (_) {}
      } else {
        if (onResize) window.removeEventListener('resize', onResize);
        if (onPaste) window.removeEventListener('paste', onPaste);
        if (onEditorKeyDown) window.removeEventListener('keydown', onEditorKeyDown);
        if (esc) {
          try { document.removeEventListener('keydown', esc, true); } catch (_) {}
        }
      }

      const id = (typeof lifecycle?.rafId === 'number' && lifecycle.rafId) ? lifecycle.rafId : refs.rafId;
      if (id) {
        try { cancelAnimationFrame(id); } catch (_) {}
      }
      refs.rafId = null;
      if (lifecycle) lifecycle.rafId = null;
      if (refs.textureApplyRaf) {
        try { cancelAnimationFrame(refs.textureApplyRaf); } catch (_) {}
        refs.textureApplyRaf = 0;
        refs.textureApplySilent = true;
      }
      if (refs.inspectorScrollRaf) {
        try { cancelAnimationFrame(refs.inspectorScrollRaf); } catch (_) {}
        refs.inspectorScrollRaf = 0;
      }
      pushHostState();
    },

    dispose() {
      try { api.pause(); } catch (_) {}
      if (typeof disposeRuntimeResources === 'function') {
        try { disposeRuntimeResources(); } catch (err) { console.error('[lifecycle] runtime resource dispose failed', err); }
      } else {
        try { renderer?.dispose?.(); } catch (_) {}
        try { renderer?.forceContextLoss?.(); } catch (_) {}
      }
      try { cleanupRegistry?.dispose?.(); } catch (err) { console.error('[lifecycle] cleanup registry dispose failed', err); }
      try {
        const cleanupFns = typeof getEditorCleanupFns === 'function' ? getEditorCleanupFns() : null;
        if (Array.isArray(cleanupFns)) {
          while (cleanupFns.length) {
            const fn = cleanupFns.pop();
            try { fn && fn(); } catch (_) {}
          }
        }
      } catch (_) {}
    },
  };

  return api;
}

export const EditorLifecycle = { create };
