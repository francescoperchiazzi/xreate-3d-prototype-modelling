const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function resolveModalApi() {
  return {
    openModal: XR?.openModal || null,
    closeModal: XR?.closeModal || null,
  };
}

function bindOnce(el, key, eventName, handler) {
  if (!el || typeof handler !== 'function') return;
  if (el[key]) return;
  el[key] = true;
  el.addEventListener(eventName, handler);
}

export function createShortcutsModal(opts) {
  const shortcutsModal = opts?.shortcutsModal || null;
  const shortcutsClose = opts?.shortcutsClose || null;
  const shortcutsBtn = opts?.shortcutsBtn || null;
  const closeAppMenu = (opts && typeof opts.closeAppMenu === 'function') ? opts.closeAppMenu : (() => {});
  let shortcutsModalState = null;

  function openShortcutsModal() {
    const { openModal, closeModal } = resolveModalApi();
    if (!shortcutsModal || !openModal) return;
    try { if (shortcutsModalState && typeof closeModal === 'function') closeModal(shortcutsModalState); } catch (_) {}
    shortcutsModalState = openModal(shortcutsModal, {
      initialFocusEl: shortcutsClose,
      returnFocusEl: document.activeElement,
      onRequestClose: closeShortcutsModal,
    });
  }

  function closeShortcutsModal() {
    const { closeModal } = resolveModalApi();
    if (!shortcutsModal || !closeModal) return;
    if (shortcutsModalState) {
      const st = shortcutsModalState;
      shortcutsModalState = null;
      closeModal(st);
    } else {
      closeModal(shortcutsModal);
    }
  }

  function bind() {
    bindOnce(shortcutsBtn, '__xrShortcutsModalOpenBound', 'click', () => {
      closeAppMenu();
      openShortcutsModal();
    });
    bindOnce(shortcutsClose, '__xrShortcutsModalCloseBound', 'click', closeShortcutsModal);
  }

  XR.__modules.ShellEditorModals.openShortcutsModal = openShortcutsModal;
  XR.__modules.ShellEditorModals.closeShortcutsModal = closeShortcutsModal;
  return { openShortcutsModal, closeShortcutsModal, bind };
}

export function createUvCompareModal(opts) {
  const uvCompareModal = opts?.uvCompareModal || null;
  const uvCompareClose = opts?.uvCompareClose || null;
  let uvCompareModalState = null;

  function openUvCompareModal() {
    const { openModal, closeModal } = resolveModalApi();
    if (!uvCompareModal || !openModal) return;
    try { if (uvCompareModalState && typeof closeModal === 'function') closeModal(uvCompareModalState); } catch (_) {}
    uvCompareModalState = openModal(uvCompareModal, {
      initialFocusEl: uvCompareClose,
      returnFocusEl: document.activeElement,
      onRequestClose: closeUvCompareModal,
    });
  }

  function closeUvCompareModal() {
    const { closeModal } = resolveModalApi();
    if (!uvCompareModal || !closeModal) return;
    if (uvCompareModalState) {
      const st = uvCompareModalState;
      uvCompareModalState = null;
      closeModal(st);
    } else {
      closeModal(uvCompareModal);
    }
  }

  function bind() {
    bindOnce(uvCompareClose, '__xrUvCompareModalCloseBound', 'click', closeUvCompareModal);
  }

  XR.__modules.ShellEditorModals.openUvCompareModal = openUvCompareModal;
  XR.__modules.ShellEditorModals.closeUvCompareModal = closeUvCompareModal;
  return { openUvCompareModal, closeUvCompareModal, bind };
}

export function createDoodleModal(opts) {
  const modal = opts?.modal || null;
  const closeTargets = Array.from(opts?.closeTargets || []);
  const onOpen = (opts && typeof opts.onOpen === 'function') ? opts.onOpen : (() => {});
  const onClose = (opts && typeof opts.onClose === 'function') ? opts.onClose : (() => {});
  let modalState = null;
  let returnFocusEl = null;

  function openDoodleModal() {
    const { openModal, closeModal } = resolveModalApi();
    if (!modal || !openModal) return;
    returnFocusEl = document.activeElement || null;
    try { if (modalState && typeof closeModal === 'function') closeModal(modalState); } catch (_) {}
    modalState = openModal(modal, {
      initialFocusEl: closeTargets[0] || null,
      returnFocusEl,
      onRequestClose: closeDoodleModal,
    });
    onOpen();
  }

  function closeDoodleModal() {
    const { closeModal } = resolveModalApi();
    if (!modal || !closeModal) return;
    if (modalState) {
      const st = modalState;
      modalState = null;
      closeModal(st);
    } else {
      closeModal(modal);
    }
    onClose();
  }

  function bind() {
    for (const target of closeTargets) {
      bindOnce(target, '__xrDoodleModalCloseBound', 'click', closeDoodleModal);
    }
  }

  XR.__modules.ShellEditorModals.openDoodleModal = openDoodleModal;
  XR.__modules.ShellEditorModals.closeDoodleModal = closeDoodleModal;
  return { openDoodleModal, closeDoodleModal, bind };
}

XR.__modules.ShellEditorModals = XR.__modules.ShellEditorModals || {};
XR.__modules.ShellEditorModals.createShortcutsModal = createShortcutsModal;
XR.__modules.ShellEditorModals.createUvCompareModal = createUvCompareModal;
XR.__modules.ShellEditorModals.createDoodleModal = createDoodleModal;
