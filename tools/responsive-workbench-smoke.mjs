import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [css, controls] = await Promise.all([
  readFile(new URL('../xreate.css', import.meta.url), 'utf8'),
  readFile(new URL('../shell/viewport-controls.js', import.meta.url), 'utf8'),
]);
const [editorMarkup, scenePanels] = await Promise.all([
  readFile(new URL('../shell/ui/editor.html', import.meta.url), 'utf8'),
  readFile(new URL('../shell/scene-panels.js', import.meta.url), 'utf8'),
]);

assert(css.includes('RESPONSIVE WORKBENCH — tablet and phone interaction contract'), 'responsive workbench contract must remain documented');
assert(css.includes('@media (min-width: 768px) and (max-width: 1159px)'), 'tablet breakpoint must remain explicit');
assert(css.includes('"viewport viewport"\n      "tree inspector"\n      "surface surface"'), 'tablet must keep viewport, Composition, Inspector, and Surface in a real grid');
assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important'), 'tablet Inspector must retain its two-column layout');
assert(css.includes('height: calc(100dvh - var(--app-header-h)) !important'), 'phone editor must account for its two-row header');
assert(css.includes('.xr-mobile-panel-dock'), 'phone must expose a labelled panel dock');
assert(css.includes(':root.is-tree-open #xreate-editor-root.xr-editor .xr-panel-tree'), 'phone Composition must have an explicit open state');
assert(css.includes(':root.is-inspector-open #xreate-editor-root.xr-editor .xr-panel-inspector'), 'phone Inspector must have an explicit open state');
assert(css.includes('is-surface-open #xreate-editor-root.xr-editor .xr-panel-surface > .xr-mobile-panel-body'), 'an opened phone Surface sheet must expose its body');
assert(controls.includes("addDockButton('Composition'") && controls.includes("addDockButton('Inspector'"), 'phone dock must expose Composition and Inspector actions');
assert(controls.includes("'Close Composition panel'") && controls.includes("'Close Surface panel'"), 'all focused sheets must have explicit close actions');
assert(controls.includes('const isPhoneViewport') && controls.includes('if (isPhoneViewport()) root.classList.remove(\'is-surface-open\')'), 'phone Texture mode must start canvas-first instead of auto-opening Surface');
assert(css.includes('.xr-editor .xr-mobile-panel-dock { display: none; }'), 'the injected phone dock must be hidden outside the phone breakpoint');
assert(css.includes('overflow-y: auto !important') && css.includes('--app-header-h: 104px'), 'tablet layout must scroll and reserve two intentional header rows');
assert(css.includes('height: min(100vw, 440px) !important') && css.includes('aspect-ratio: 1 / 1 !important'), 'phone viewport must remain a usable square canvas');
assert(editorMarkup.includes('id="btn-viewport-add-volume"'), 'empty viewport must provide an explicit first-volume action');
assert(scenePanels.includes('viewportEmpty.hidden = shapes.length > 0'), 'empty viewport invitation must return after every last-volume deletion');
assert(scenePanels.includes("editorRoot.classList.toggle('is-empty-scene'"), 'the editor must expose a durable empty-scene state for responsive UX');
assert(css.includes('Final cascade guard') && css.includes('height: min(70dvh, 560px) !important'), 'phone canvas must remain substantial despite later legacy responsive rules');
assert(css.includes('.xr-panel-tree .xr-tree-list') && css.includes('overscroll-behavior: auto !important'), 'tablet Composition must allow trackpad scroll to continue to the page');
assert(controls.includes('syncEmptySceneDock') && controls.includes('button.disabled = isEmpty'), 'empty mobile panels must be visibly and semantically muted');
assert(css.includes('PHONE ACCORDION FINAL GUARD'), 'phone accordion layout must be protected from legacy fixed-sheet rules');
assert(css.includes('.xr-header__mode-group, .xr-app > .xr-header .xr-header__divider { display: none !important; }'), 'phone must hide the desktop-only mode switch');
assert(css.includes('height: min(100vw, 520px) !important') && css.includes('aspect-ratio: 1 / 1 !important'), 'phone canvas must remain square and dominant');
assert(css.includes('.xr-editor .xr-mobile-panel-dock { display: none !important; }'), 'phone must not show the old sheet navigation dock');
assert(css.includes('Old fixed-sheet close actions are not useful inside an in-flow accordion.'), 'phone accordions must not retain redundant sheet close buttons');
assert(css.includes('.xr-app > main {') && css.includes('leaves an inert white "footer"'), 'phone document flow must not reserve a blank viewport-height footer');
assert(controls.includes("title: 'VOLUME'") && controls.includes("title: '3D TEXTURE'"), 'phone accordion labels must match the desktop workflow vocabulary');
assert(controls.includes("isPhoneViewport() ? getInspectorPanelTitle() : 'INSPECTOR — ' + name"), 'phone Volume accordion title must remain stable instead of inheriting an object name');
assert(css.includes('.xr-app {') && css.includes('overflow: visible !important') && css.includes('touch-action: pan-y !important'), 'phone document and canvas must permit vertical trackpad scrolling');
assert(controls.includes('syncMobilePanelContent') && controls.includes("'xr-mobile-texture-controls'"), 'phone must place the live UV Mapping controls in the 3D Texture accordion');
assert(css.includes('Composition → Composition') && css.includes('the sole workflow heading'), 'phone accordions must suppress duplicate desktop headings');
assert(!controls.includes('syncMobilePreviewButton'), 'removed Device Preview must not leave a broken viewport-controls export');

console.log(JSON.stringify({ ok: true, check: 'tablet workbench and phone panel dock contracts are guarded' }));
