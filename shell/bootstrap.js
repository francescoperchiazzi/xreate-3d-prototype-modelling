const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function createInlineShellKeyDown(editorApi, shareModal, closeShareModal) {
  return (e) => {
    const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : '';
    const isTyping = (tag === 'input' || tag === 'textarea' || tag === 'select') || (e.target && e.target.isContentEditable);
    if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const k = String(e.key || '');
      const kl = k.toLowerCase();
      const map = {
        '1': 'free',
        '2': 'front',
        '3': 'back',
        '4': 'left',
        '5': 'right',
        '6': 'top',
        '7': 'bottom',
        '8': 'iso',
      };
      if (map[k]) {
        try { editorApi?.setViewportView?.(map[k]); } catch (_) {}
        e.preventDefault();
        return;
      }
      if (k === '0' || kl === 'f') {
        try { editorApi?.fitViewportView?.(); } catch (_) {}
        e.preventDefault();
        return;
      }
      if (kl === 'g' || kl === 'w') {
        try { editorApi?.setGizmoMode?.('translate'); } catch (_) {}
        e.preventDefault();
        return;
      }
      if (kl === 'r' || kl === 'e') {
        try { editorApi?.setGizmoMode?.('rotate'); } catch (_) {}
        e.preventDefault();
        return;
      }
      if (kl === 's') {
        try { editorApi?.setGizmoMode?.('scale'); } catch (_) {}
        e.preventDefault();
        return;
      }
    }

    if (e.key !== 'Escape') return;
    const addShapeMenu = document.getElementById('add-shape-menu');
    if (addShapeMenu && !addShapeMenu.hidden) {
      addShapeMenu.hidden = true;
      document.getElementById('btn-add-shape')?.focus();
      return;
    }
    const doodleModal = document.getElementById('doodleModal');
    if (doodleModal && !doodleModal.hidden) {
      try { XR?.__modules?.ShellEditorModals?.closeDoodleModal?.(); } catch (_) {}
      return;
    }
    const appMenu = document.getElementById('app-menu');
    if (appMenu && !appMenu.hidden) {
      document.getElementById('btn-app-menu-close')?.click();
      return;
    }
    const uvCompareModal = document.getElementById('uvCompareModal');
    if (uvCompareModal && !uvCompareModal.hidden) {
      try { XR?.__modules?.ShellEditorModals?.closeUvCompareModal?.(); } catch (_) {}
      return;
    }
    if (shareModal && !shareModal.hidden) closeShareModal && closeShareModal();
    const exportModal = document.getElementById('exportModal');
    if (exportModal && !exportModal.hidden) document.getElementById('exportModalClose')?.click();
  };
}

function createInlineRuntime(editorApi, onShellKeyDown, imageToolsApi) {
  let toolButtonsIntervalId = 0;
  const initPerspectiveCorrection = () => {
    try { imageToolsApi?.initPerspectiveCorrection?.(); } catch (_) {}
  };
  const initPBRTools = () => {
    try { imageToolsApi?.initPBRTools?.(); } catch (_) {}
  };
  const initRetroMode = () => {
    try { imageToolsApi?.initRetroMode?.(); } catch (_) {}
  };
  const initSeamlessTile = () => {
    try { imageToolsApi?.initSeamlessTile?.(); } catch (_) {}
  };
  const updateToolButtons = () => {
    try { imageToolsApi?.updateToolButtons?.(); } catch (_) {}
  };

  const resumeAll = () => {
    try { editorApi?.resume?.(); } catch (_) {}
    try { if (onShellKeyDown) window.addEventListener('keydown', onShellKeyDown); } catch (_) {}
    initPerspectiveCorrection();
    initPBRTools();
    initRetroMode();
    initSeamlessTile();
    updateToolButtons();
    if (!toolButtonsIntervalId) {
      try { toolButtonsIntervalId = window.setInterval(updateToolButtons, 500); } catch (_) { toolButtonsIntervalId = 0; }
    }
  };
  const pauseAll = () => {
    try { editorApi?.pause?.(); } catch (_) {}
    try { if (onShellKeyDown) window.removeEventListener('keydown', onShellKeyDown); } catch (_) {}
    if (toolButtonsIntervalId) {
      try { window.clearInterval(toolButtonsIntervalId); } catch (_) {}
      toolButtonsIntervalId = 0;
    }
  };
  const disposeAll = () => {
    try { pauseAll(); } catch (_) {}
    try { editorApi?.dispose?.(); } catch (_) {}
  };
  return { resumeAll, pauseAll, disposeAll };
}

function installInlineOrchestrator(translationsReady, resumeAll, pauseAll, disposeAll) {
  if (translationsReady && typeof translationsReady.then === 'function') {
    translationsReady.then(
      () => {
        try {
          resumeAll();
        } catch (e) {
        }
      },
      (e) => {
        try { console.warn('Translations load failed:', e); } catch (_) {}
        try { resumeAll(); } catch (e) {
        }
      }
    );
  } else {
    try { resumeAll(); } catch (_) {}
  }

  const onVisibility = () => {
    try {
      if (document.hidden) pauseAll && pauseAll();
      else resumeAll && resumeAll();
    } catch (_) {}
  };
  // Fallback lifecycle for hosts without ShellOrchestrator. Keep WebGL alive
  // across an iPad Quick Look pagehide/pageshow round trip.
  const onPageHide = (event) => {
    try {
      if (event?.persisted) {
        pauseAll && pauseAll();
        return;
      }
      disposeAll && disposeAll();
    } catch (_) {}
  };
  const onPageShow = (event) => {
    if (!event?.persisted) return;
    try {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try { resumeAll && resumeAll(); } catch (_) {}
      }));
    } catch (_) {
      try { resumeAll && resumeAll(); } catch (_) {}
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

export function create(opts) {
  const editorApi = opts?.editorApi || null;
  const translationsReady = opts?.translationsReady || null;
  const shareModal = opts?.shareModal || null;
  const closeShareModal = opts?.closeShareModal || null;

  let shellImageToolsApi = null;
  const ensureShellImageToolsApi = () => {
    if (shellImageToolsApi) return shellImageToolsApi;
    const mod = XR?.__modules?.ShellImageTools || null;
    if (!mod || typeof mod.create !== 'function') return null;
    try {
      shellImageToolsApi = mod.create();
      return shellImageToolsApi;
    } catch (_) {
      return null;
    }
  };

  const imageToolsApi = ensureShellImageToolsApi();
  try { imageToolsApi?.initPerspectiveCorrection?.(); } catch (_) {}
  try { imageToolsApi?.initPBRTools?.(); } catch (_) {}
  try { imageToolsApi?.initRetroMode?.(); } catch (_) {}
  try { imageToolsApi?.initSeamlessTile?.(); } catch (_) {}
  try { imageToolsApi?.updateToolButtons?.(); } catch (_) {}

  const keyboardMod = XR?.__modules?.ShellKeyboard || null;
  let onShellKeyDown = null;
  if (keyboardMod && typeof keyboardMod.createHandler === 'function') {
    try { onShellKeyDown = keyboardMod.createHandler({ editorApi, shareModal, closeShareModal }); } catch (_) {}
  }
  if (!onShellKeyDown) onShellKeyDown = createInlineShellKeyDown(editorApi, shareModal, closeShareModal);

  const runtimeMod = XR?.__modules?.ShellRuntime || null;
  let runtimeApi = null;
  if (runtimeMod && typeof runtimeMod.create === 'function') {
    try {
      runtimeApi = runtimeMod.create({
        editorApi,
        onShellKeyDown,
        initPerspectiveCorrection: () => imageToolsApi?.initPerspectiveCorrection?.(),
        initPBRTools: () => imageToolsApi?.initPBRTools?.(),
        initRetroMode: () => imageToolsApi?.initRetroMode?.(),
        initSeamlessTile: () => imageToolsApi?.initSeamlessTile?.(),
        updateToolButtons: () => imageToolsApi?.updateToolButtons?.(),
      });
    } catch (_) {}
  }
  if (!runtimeApi) runtimeApi = createInlineRuntime(editorApi, onShellKeyDown, imageToolsApi);

  let teardown = null;
  const install = () => {
    const orch = XR?.__modules?.ShellOrchestrator || null;
    if (orch && typeof orch.install === 'function') {
      try {
        teardown = orch.install({
          translationsReady,
          resumeAll: runtimeApi.resumeAll,
          pauseAll: runtimeApi.pauseAll,
          disposeAll: runtimeApi.disposeAll,
        });
        return true;
      } catch (e) {
      }
    }
    teardown = installInlineOrchestrator(translationsReady, runtimeApi.resumeAll, runtimeApi.pauseAll, runtimeApi.disposeAll);
    return true;
  };

  return {
    onShellKeyDown,
    resumeAll: runtimeApi.resumeAll,
    pauseAll: runtimeApi.pauseAll,
    disposeAll: runtimeApi.disposeAll,
    install,
    teardown: () => {
      try { if (typeof teardown === 'function') teardown(); } catch (_) {}
    },
  };
}

XR.__modules.ShellBootstrap = XR.__modules.ShellBootstrap || {};
XR.__modules.ShellBootstrap.create = create;
