const { deriveThemeColors, parseCssRgbTriplet } = await import('../engine/editor/theme-derived-colors.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(parseCssRgbTriplet('rgb(10, 20, 30)').b === 30, 'RGB parser did not preserve channels');
const dark = deriveThemeColors({
  currentEditorBg: '#fff', isDark: () => true,
  readCssVar: (name, fallback) => name === '--surface-panel' ? '#111' : fallback,
});
assert(dark.editorBg === '#111' && dark.uvOverlayTheme.labelStrong === 'rgba(245, 240, 232, 0.88)', 'dark derived palette is incorrect');
console.log('theme-derived-colors: PASS');
