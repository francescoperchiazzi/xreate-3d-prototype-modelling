const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

let activeFocusTrapEl = null;
let focusTrapStack = [];
let focusTrapKeyHandler = null;

export function getFocusableEls(root) {
  if (!root) return [];
  const nodes = Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ));
  return nodes.filter((el) => {
    if (!el) return false;
    if (el.hasAttribute('disabled')) return false;
    const style = window.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (el.offsetParent === null && style.position !== 'fixed') return false;
    return true;
  });
}

export function activateFocusTrap(el) {
  if (!el) return;
  if (!Array.isArray(focusTrapStack)) focusTrapStack = [];
  const existing = focusTrapStack.lastIndexOf(el);
  if (existing >= 0) focusTrapStack.splice(existing, 1);
  focusTrapStack.push(el);
  activeFocusTrapEl = focusTrapStack[focusTrapStack.length - 1] || null;
  if (focusTrapKeyHandler) return;
  focusTrapKeyHandler = (e) => {
    if (e.key !== 'Tab') return;
    if (!activeFocusTrapEl || activeFocusTrapEl.hidden) return;
    const focusables = getFocusableEls(activeFocusTrapEl);
    if (!focusables.length) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !activeFocusTrapEl.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !activeFocusTrapEl.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', focusTrapKeyHandler, true);
}

export function deactivateFocusTrap(el) {
  if (!Array.isArray(focusTrapStack)) focusTrapStack = [];
  const existing = focusTrapStack.lastIndexOf(el);
  if (existing >= 0) focusTrapStack.splice(existing, 1);
  activeFocusTrapEl = focusTrapStack.length ? focusTrapStack[focusTrapStack.length - 1] : null;
  if (activeFocusTrapEl) return;
  if (focusTrapKeyHandler) {
    document.removeEventListener('keydown', focusTrapKeyHandler, true);
    focusTrapKeyHandler = null;
  }
}

export function trapFocus(modalEl, triggerEl, opts) {
  if (!modalEl) return null;
  const state = {
    modalEl,
    returnFocusEl: triggerEl || null,
    _closed: false,
    cleanup: null,
  };
  modalEl.hidden = false;
  activateFocusTrap(modalEl);
  const focusables = getFocusableEls(modalEl);
  const initialFocusEl = (opts && opts.initialFocusEl) ? opts.initialFocusEl : (focusables[0] || null);
  const focusTarget = initialFocusEl || modalEl;
  try { focusTarget && focusTarget.focus && focusTarget.focus(); } catch (_) {}

  const closeOnEscape = !(opts && opts.closeOnEscape === false);
  const closeOnOverlayClick = !(opts && opts.closeOnOverlayClick === false);
  const onRequestClose = (opts && typeof opts.onRequestClose === 'function')
    ? opts.onRequestClose
    : () => closeModal(state);

  const onKeyDown = (e) => {
    if (state._closed) return;
    if (!closeOnEscape) return;
    if (!e || e.key !== 'Escape') return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    onRequestClose();
  };
  const onClick = (e) => {
    if (state._closed) return;
    if (!closeOnOverlayClick) return;
    if (!e) return;
    if (e.target !== modalEl) return;
    if (e.defaultPrevented) return;
    onRequestClose();
  };
  try { modalEl.addEventListener('keydown', onKeyDown); } catch (_) {}
  try { modalEl.addEventListener('click', onClick); } catch (_) {}

  state.cleanup = () => {
    state._closed = true;
    try { modalEl.removeEventListener('keydown', onKeyDown); } catch (_) {}
    try { modalEl.removeEventListener('click', onClick); } catch (_) {}
  };
  return state;
}

export function openModal(modalEl, opts) {
  if (!modalEl) return null;
  const returnFocusEl = (opts && opts.returnFocusEl) ? opts.returnFocusEl : (document.activeElement || null);
  return trapFocus(modalEl, returnFocusEl, opts);
}

export function closeModal(state) {
  const modalEl = state && state.modalEl ? state.modalEl : state;
  if (!modalEl) return;
  modalEl.hidden = true;
  deactivateFocusTrap(modalEl);
  try { if (state && typeof state.cleanup === 'function') state.cleanup(); } catch (_) {}
  const returnFocusEl = state && state.returnFocusEl ? state.returnFocusEl : null;
  try { returnFocusEl && returnFocusEl.focus && returnFocusEl.focus(); } catch (_) {}
}

XR.__modules.ShellModal = XR.__modules.ShellModal || {};
XR.__modules.ShellModal.getFocusableEls = getFocusableEls;
XR.__modules.ShellModal.activateFocusTrap = activateFocusTrap;
XR.__modules.ShellModal.deactivateFocusTrap = deactivateFocusTrap;
XR.__modules.ShellModal.trapFocus = trapFocus;
XR.__modules.ShellModal.openModal = openModal;
XR.__modules.ShellModal.closeModal = closeModal;

XR.trapFocus = XR.trapFocus || trapFocus;
XR.openModal = XR.openModal || openModal;
XR.closeModal = XR.closeModal || closeModal;
