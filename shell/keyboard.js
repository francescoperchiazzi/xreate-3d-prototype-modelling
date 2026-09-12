const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function createHandler(opts) {
  const editorApi = opts?.editorApi || null;
  const shareModal = opts?.shareModal || null;
  const closeShareModal = opts?.closeShareModal || null;

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
      if (k === 'Delete' || k === 'Backspace') {
        const del = XR?.deleteSelected
          || (XR?.Shapes && XR.Shapes.deleteSelected)
          || (XR?.SceneCommands && XR.SceneCommands.deletePart);
        if (typeof del === 'function') {
          const sel = XR?.getSelectedId
            || (XR?.ProjectState && XR.ProjectState.getSelectedId)
            || (XR?.Project && XR.Project.getSelectedId);
          const selId = typeof sel === 'function' ? sel() : null;
          if (selId) {
            if (del === XR?.SceneCommands?.deletePart) {
              try { del({ partId: selId }); } catch (_) {}
            } else {
              try { del(); } catch (_) {}
            }
            e.preventDefault();
            return;
          }
        }
      }
    }

    if (e.key !== 'Escape') return;
    let escapeHandled = false;
    const addShapeMenu = document.getElementById('add-shape-menu');
    if (addShapeMenu && !addShapeMenu.hidden) {
      addShapeMenu.hidden = true;
      document.getElementById('btn-add-shape')?.focus();
      escapeHandled = true;
    }
    const doodleModal = document.getElementById('doodleModal');
    if (doodleModal && !doodleModal.hidden) {
      try { window.XR?.__modules?.ShellEditorModals?.closeDoodleModal?.(); } catch (_) {}
      escapeHandled = true;
    }
    const appMenu = document.getElementById('app-menu');
    if (appMenu && !appMenu.hidden) {
      document.getElementById('btn-app-menu-close')?.click();
      escapeHandled = true;
    }
    const uvCompareModal = document.getElementById('uvCompareModal');
    if (uvCompareModal && !uvCompareModal.hidden) {
      try { window.XR?.__modules?.ShellEditorModals?.closeUvCompareModal?.(); } catch (_) {}
      escapeHandled = true;
    }
    if (shareModal && !shareModal.hidden) {
      closeShareModal && closeShareModal();
      escapeHandled = true;
    }
    const exportModal = document.getElementById('exportModal');
    if (exportModal && !exportModal.hidden) {
      document.getElementById('exportModalClose')?.click();
      escapeHandled = true;
    }
    if (escapeHandled) return;
    const tag2 = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : '';
    const isTypingNow = (tag2 === 'input' || tag2 === 'textarea' || tag2 === 'select') || (e.target && e.target.isContentEditable);
    if (!isTypingNow) {
      try {
        const setSel = (XR?.Selection && XR.Selection.setSelectedPart)
          || (XR?.__modules?.Selection && XR.__modules.Selection.setSelectedPart);
        if (typeof setSel === 'function') {
          try { setSel({ partId: null }); } catch (_) {}
        } else if (XR?.ProjectState && typeof XR.ProjectState.setSelectedId === 'function') {
          try { XR.ProjectState.setSelectedId(null); } catch (_) {}
        }
      } catch (_) {}
    }
  };
}

XR.__modules.ShellKeyboard = XR.__modules.ShellKeyboard || {};
XR.__modules.ShellKeyboard.createHandler = createHandler;
