const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function bindClickOnce(el, key, handler) {
  if (!el || typeof handler !== 'function') return;
  if (el[key]) return;
  el[key] = true;
  el.addEventListener('click', handler);
}

function bindToggleDisclosure(toggleBtn, controls, key) {
  bindClickOnce(toggleBtn, key, () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', (!isExpanded).toString());
    if (controls) controls.hidden = isExpanded;
  });
}

function downloadCanvasAsImage(canvas, filename) {
  if (!canvas || typeof canvas.toBlob !== 'function') return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 'image/png');
}

export function create() {
  function initPerspectiveCorrection() {}
  function initPBRTools() {}
  function initRetroMode() {}
  function initSeamlessTile() {}
  function updateToolButtons() {}

  return {
    initPerspectiveCorrection,
    initPBRTools,
    initRetroMode,
    initSeamlessTile,
    updateToolButtons,
  };
}

XR.__modules.ShellImageTools = XR.__modules.ShellImageTools || {};
XR.__modules.ShellImageTools.create = create;
