export function parseCssRgbTriplet(value) {
  const source = String(value || '').trim();
  const match = source.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

export function rgba(rgb, alpha) {
  if (!rgb) return `rgba(40, 35, 28, ${alpha})`;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// DOM/theme access is supplied by the shell adapter. The derived editor palette
// is therefore deterministic and testable independently from the shell.
export function deriveThemeColors({ currentEditorBg, isDark, readCssVar } = {}) {
  const editorBg = typeof readCssVar === 'function'
    ? (readCssVar('--surface-panel', currentEditorBg) || currentEditorBg)
    : currentEditorBg;
  const dark = typeof isDark === 'function' ? !!isDark() : false;
  const inkRaw = typeof readCssVar === 'function'
    ? readCssVar('--text-primary', dark ? 'rgb(245, 240, 232)' : 'rgb(40, 35, 28)')
    : (dark ? 'rgb(245, 240, 232)' : 'rgb(40, 35, 28)');
  const ink = parseCssRgbTriplet(inkRaw) || (dark
    ? { r: 245, g: 240, b: 232 }
    : { r: 40, g: 35, b: 28 });
  return {
    editorBg,
    uvOverlayTheme: {
      gridDash: rgba(ink, dark ? 0.14 : 0.35),
      frame: rgba(ink, dark ? 0.22 : 0.55),
      faceFill: rgba(ink, dark ? 0.05 : 0.06),
      faceStroke: rgba(ink, dark ? 0.26 : 0.65),
      label: rgba(ink, dark ? 0.72 : 0.55),
      labelStrong: rgba(ink, dark ? 0.88 : 0.85),
    },
  };
}

export const ThemeDerivedColors = { parseCssRgbTriplet, rgba, deriveThemeColors };
