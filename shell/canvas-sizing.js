const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function scaleDrawCanvas(opts) {
  const wrapId = opts?.wrapId || 'drawWrap';
  const baseId = opts?.baseId || 'imageCanvas';
  const uvId = opts?.uvId || 'uvOverlay';
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const w = wrap.clientWidth;
  if (!(w > 0)) return;
  const size = Math.max(1, Math.floor(w));
  wrap.style.height = size + 'px';
  const baseCanvas = opts?.baseCanvas || document.getElementById(baseId);
  const uvCanvas = opts?.uvCanvas || document.getElementById(uvId);
  const canvases = [baseCanvas, uvCanvas].filter(Boolean);
  for (const c of canvases) {
    try {
      c.style.width = size + 'px';
      c.style.height = size + 'px';
    } catch (_) {}
  }
}

XR.__modules.ShellCanvasSizing = XR.__modules.ShellCanvasSizing || {};
XR.__modules.ShellCanvasSizing.scaleDrawCanvas = scaleDrawCanvas;
XR.CanvasSizing = XR.CanvasSizing || XR.__modules.ShellCanvasSizing;

