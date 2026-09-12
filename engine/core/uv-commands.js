let overlayRuntime = null;

export function configureUvCommands(opts = {}) {
  overlayRuntime = opts.overlayRuntime || null;
  return { overlayRuntime };
}

function resolveUvOverlayRuntime() {
  return overlayRuntime;
}

export function renderNetTo(canvas, mode) {
  const mod = resolveUvOverlayRuntime();
  const fn = mod && typeof mod.renderUvNetToCanvas === 'function' ? mod.renderUvNetToCanvas : null;
  if (!fn) return;
  try { fn(canvas, mode); } catch (_) {}
}

export function renderCompareNets() {
  const mod = resolveUvOverlayRuntime();
  const fn = mod && typeof mod.renderUvCompareNets === 'function' ? mod.renderUvCompareNets : null;
  if (!fn) return;
  try { fn(); } catch (_) {}
}

export const UVCommands = { configure: configureUvCommands, renderNetTo, renderCompareNets };
