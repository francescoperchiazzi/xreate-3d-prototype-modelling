const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const editorApi = opts?.editorApi || null;
  const onShellKeyDown = opts?.onShellKeyDown || null;
  const initPerspectiveCorrection = opts?.initPerspectiveCorrection || null;
  const initPBRTools = opts?.initPBRTools || null;
  const initRetroMode = opts?.initRetroMode || null;
  const initSeamlessTile = opts?.initSeamlessTile || null;
  const updateToolButtons = opts?.updateToolButtons || null;
  let toolButtonsIntervalId = 0;
  let _resumeAllAttached = false;
  let _keydownAttached = false;

  const resumeAll = () => {

    try { editorApi?.resume?.(); } catch (e) {

    }

    try {
      if (onShellKeyDown && !_keydownAttached) {
        window.addEventListener('keydown', onShellKeyDown);
        _keydownAttached = true;
      }
    } catch (_) {}
    if (!_resumeAllAttached) {
      try { initPerspectiveCorrection && initPerspectiveCorrection(); } catch (_) {}
      try { initPBRTools && initPBRTools(); } catch (_) {}
      try { initRetroMode && initRetroMode(); } catch (_) {}
      try { initSeamlessTile && initSeamlessTile(); } catch (_) {}
      _resumeAllAttached = true;
    }
    try { if (updateToolButtons) updateToolButtons(); } catch (_) {}
    if (!toolButtonsIntervalId && updateToolButtons) {
      try { toolButtonsIntervalId = window.setInterval(updateToolButtons, 500); } catch (_) { toolButtonsIntervalId = 0; }
    }

  };

  const pauseAll = () => {
    try { editorApi?.pause?.(); } catch (_) {}
    try {
      if (onShellKeyDown && _keydownAttached) window.removeEventListener('keydown', onShellKeyDown);
      // `resumeAll()` uses this guard to decide whether it must attach the
      // handler.  Keeping it true after removal made keyboard shortcuts stop
      // working permanently after the first visibility pause/resume cycle.
      _keydownAttached = false;
    } catch (_) {}
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

XR.__modules.ShellRuntime = XR.__modules.ShellRuntime || {};
XR.__modules.ShellRuntime.create = create;
