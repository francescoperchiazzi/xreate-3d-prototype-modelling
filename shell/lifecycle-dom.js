const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};
XR.LifecycleDom = XR.LifecycleDom || {};

export function attach(handlers) {
  const onResize = handlers?.onResize || null;
  const onPaste = handlers?.onPaste || null;
  const onEditorKeyDown = handlers?.onEditorKeyDown || null;
  const esc = handlers?.esc || null;

  if (onResize) window.addEventListener('resize', onResize);
  if (onPaste) window.addEventListener('paste', onPaste);
  if (onEditorKeyDown) window.addEventListener('keydown', onEditorKeyDown);
  if (esc) {
    try { document.removeEventListener('keydown', esc, true); } catch (_) {}
    try { document.addEventListener('keydown', esc, true); } catch (_) {}
  }
}

export function detach(handlers) {
  const onResize = handlers?.onResize || null;
  const onPaste = handlers?.onPaste || null;
  const onEditorKeyDown = handlers?.onEditorKeyDown || null;
  const esc = handlers?.esc || null;

  if (onResize) window.removeEventListener('resize', onResize);
  if (onPaste) window.removeEventListener('paste', onPaste);
  if (onEditorKeyDown) window.removeEventListener('keydown', onEditorKeyDown);
  if (esc) {
    try { document.removeEventListener('keydown', esc, true); } catch (_) {}
  }
}

Object.assign(XR.LifecycleDom, {
  attach,
  detach,
});

XR.__modules.LifecycleDom = XR.LifecycleDom;
