const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

let exportReturnFocusEl = null;
let exportModalState = null;

function resolveOpenModal() {
  return XR?.openModal || XR?.__modules?.ShellModal?.openModal || null;
}

function resolveCloseModal() {
  return XR?.closeModal || XR?.__modules?.ShellModal?.closeModal || null;
}

export function showModal(title, msg) {
  const modal = document.getElementById('exportModal');
  const closeBtn = document.getElementById('exportModalClose');
  if (!modal) return;
  const open = resolveOpenModal();
  const close = resolveCloseModal();
  exportReturnFocusEl = document.activeElement;
  try { document.getElementById('modalTitle').textContent = String(title || ''); } catch (_) {}
  try { document.getElementById('modalMsg').textContent = String(msg || ''); } catch (_) {}
  try { if (exportModalState && close) close(exportModalState); } catch (_) {}
  try {
    exportModalState = (open && typeof open === 'function')
      ? (open(modal, { initialFocusEl: closeBtn, returnFocusEl: exportReturnFocusEl }) || null)
      : null;
  } catch (_) {
    exportModalState = null;
  }
}

export function closeExportModal() {
  const close = resolveCloseModal();
  try {
    if (typeof close === 'function') {
      if (exportModalState) close(exportModalState);
      else close(document.getElementById('exportModal'));
    }
  } catch (_) {}
  exportModalState = null;
  exportReturnFocusEl = null;
}

XR.__modules.ShellExportModal = XR.__modules.ShellExportModal || {};
XR.__modules.ShellExportModal.showModal = showModal;
XR.__modules.ShellExportModal.closeExportModal = closeExportModal;

XR.showModal = XR.showModal || showModal;
XR.closeExportModal = XR.closeExportModal || closeExportModal;

