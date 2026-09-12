import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [bootstrap, legacy, doodle, mask, markup, headerMarkup, editorMarkup, surfaceEditor, css, shapeActions, addShapeMenu] = await Promise.all([
  readFile(new URL('../shell/body-bootstrap.js', import.meta.url), 'utf8'),
  readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8'),
  readFile(new URL('../shell/doodle-modal.js', import.meta.url), 'utf8'),
  readFile(new URL('../shell/mask-editor.js', import.meta.url), 'utf8'),
  readFile(new URL('../shell/ui/modals.html', import.meta.url), 'utf8'),
  readFile(new URL('../shell/ui/header.html', import.meta.url), 'utf8'),
  readFile(new URL('../shell/ui/editor.html', import.meta.url), 'utf8'),
  readFile(new URL('../shell/surface-editor.js', import.meta.url), 'utf8'),
  readFile(new URL('../xreate.css', import.meta.url), 'utf8'),
  readFile(new URL('../engine/editor/shape-actions.js', import.meta.url), 'utf8'),
  readFile(new URL('../shell/add-shape-menu.js', import.meta.url), 'utf8'),
]);

assert(bootstrap.includes('function showToast(message, type)'), 'body bootstrap must own its toast callback');
assert(bootstrap.includes('mod.create({ t, tr, showToast })'), 'Doodle creation must receive the bootstrap toast callback');
assert(bootstrap.includes('ShellDoodleModal?.create') && bootstrap.includes('ShellMaskEditor?.create'), 'shell readiness must include both interactive modal modules');
assert(bootstrap.includes('function bindShellMenuWiring()') && bootstrap.includes("'bootstrap.menu-wiring.success'"), 'stable bootstrap must rebind header controls after dynamic markup mounts');
assert(legacy.includes("XR?.DebugLog?.event?.('doodle.open.request'"), 'Doodle open must be observable in the flight recorder');
assert(doodle.includes('XR?.addDoodleShapeToScene || XR?.Shapes?.addDoodle'), 'Doodle Apply must prefer the configured editor command');
assert(shapeActions.includes('mode: opts?.mode'), 'Doodle command bridge must preserve Polygon, Mirror and Revolve mode');
assert(doodle.includes("'doodle.point.added'"), 'Doodle point placement must be observable in the flight recorder');
assert(mask.includes('function fitMaskView()'), 'mask editor must provide an initial fit calculation');
assert(mask.includes('if (canvas) fitMaskViewAfterOpen(idx);'), 'mask editor must fit the texture when it opens');
assert(mask.includes('availableWidth / CANVAS_SIZE') && mask.includes('availableHeight / CANVAS_SIZE'), 'mask fit must use both preview dimensions');
assert(mask.includes('function fitMaskViewAfterOpen(layerIndex)') && mask.includes('raf(() => raf(fitAndRender))'), 'Mask must refit after the dialog reaches its final layout size');
assert(mask.includes('drawBaseLayer();\n      renderUvOverlay();\n      requestApplyTexture(true);'), 'applying a Mask must redraw the UV reference overlay above the texture');
assert(css.includes('.xr-mask-modal {\n  box-sizing: border-box;') && css.includes('block-size: 0;'), 'Mask must reserve a finite editing canvas instead of clipping an oversized canvas');
assert(mask.includes('function zoomMaskView(factor)') && mask.includes('updateMaskViewUi();'), 'mask editor must expose a view-only zoom path');
assert(markup.includes('id="maskViewZoomOut"') && markup.includes('id="maskViewZoomIn"') && markup.includes('id="maskViewFit"'), 'Mask must provide explicit view zoom and fit controls');
assert(mask.includes('btnSel.disabled = !canSelect') && mask.includes('add at least two points to unlock Select'), 'Mask Select must remain disabled until its bounding box is meaningful');
assert((mask.match(/setMaskTool\('select'\);/g) || []).length >= 2, 'mask presets must enter Select mode so scale controls are immediately usable');
assert(mask.includes("selectActions.dataset.mode = mode"), 'mask tool changes must expose Select-control state to the UI');
assert(markup.includes('id="maskSelectActions"') && markup.includes('aria-controls="maskSelectActions"'), 'Select must own the scale controls semantically');
assert(markup.includes('Quick presets') && markup.includes('Create a starting mask, then refine it in Select.'), 'square and circle must describe their preset behavior');
assert(markup.indexOf('id="maskPresetSquare"') < markup.indexOf('class="xr-mask-actions"'), 'mask presets must not be confused with destructive/action controls');
assert(css.includes('grid-template-columns: minmax(140px, 1fr) auto minmax(140px, 1fr)') && css.includes('grid-column: 2;\n  grid-row: 1;'), 'Doodle Polygon/Mirror control must be centered in its mode row');
assert(doodle.includes('function getOutputScaleLabel()') && doodle.includes('drawModelScaleReference();') && doodle.includes('const ruler = 100 * zoom'), 'Doodle canvas scale reference must zoom with its drawing space');
assert(doodle.includes("snapMode === 5") && doodle.includes('Math.PI / 36'), 'Doodle angle snap must include the precise 5 degree increment');
assert(!css.includes(':root html[data-theme='), 'theme selectors must target html itself, not an impossible html descendant');
assert(css.includes('html[data-theme="dark"] .xr-editor .xr-field-row.xr-scale-lock-row .xr-scale-lock-btn[aria-pressed="true"] .xr-scale-lock-btn__state'), 'dark active scale control must have an explicit contrast rule');
assert(css.includes('PUBLIC RESPONSIVE BASELINE') && css.includes('--app-header-h: 112px'), 'phone header must reserve a two-row safe canvas offset');
assert(css.includes('min(52dvh, 500px)') && css.includes('safe-area-inset-bottom'), 'phone sheets must remain bounded and safe-area aware');
assert(css.includes('FINAL PHONE MODAL LAYOUT + TOUCH RANGE SKIN'), 'phone creative dialogs need a final cascade guard against legacy modal layout rules');
assert(css.includes('#doodleModal #doodleCanvas') && css.includes('min-height: 42svh !important'), 'phone Doodle must reserve a substantial canvas before its compact controls');
assert(css.includes('#maskModal #maskCanvas') && css.includes('#maskModal .xr-mask-toolbar'), 'phone Mask must compact desktop copy before reserving the canvas');
assert(css.includes('visible track and thumb remain consistent') && css.includes('height: 34px !important'), 'phone sliders must retain a generous hit target without a giant visual rail');
assert(css.includes('input[type="color"].xr-color-input') && css.includes('border-radius: 50% !important'), 'material colour preview must remain circular on Safari touch devices');
assert(doodle.includes('function abortPan(e)') && doodle.includes("'pointercancel', abortPan"), 'a cancelled touch gesture must never commit a phantom Doodle point');
assert(doodle.includes('let activePointerId = null') && doodle.includes('A second touch means a device gesture'), 'multi-touch Doodle input must not create an extra point');
assert(doodle.includes("dragMode === 'point' && toolMode === 'draw'") && doodle.includes("if (dragMode === 'img')"), 'a reference-image drag must not be promoted to a Doodle polygon point on touch devices');
assert(doodle.includes('normalizeTraceBitmap') && doodle.includes('if (usesHalfCanvas())'), 'large source photos must be normalized and half-canvas modes must centre their reference image');
assert(markup.includes('xr-doodle-source-card') && markup.includes('id="doodlePickFile"'), 'Doodle source step must present a focused, photo-first CTA card');
assert(css.includes('#doodleStep1.xr-doodle-panel') && css.includes('justify-content: center') && css.includes('xr-doodle-source-card__icon'), 'Doodle source CTA must stay centred and visibly invite a photo reference');
assert(doodle.includes("'doodle_phone_unavailable'") && doodle.includes('isPhoneCanvas'), 'Doodle modal must reject phone-sized canvases even when invoked outside Add Volume');
assert(addShapeMenu.includes('function') && addShapeMenu.includes('isDoodleUnavailable') && addShapeMenu.includes('aria-disabled'), 'Add Volume must present Doodle as unavailable rather than opening it on phones');
assert(addShapeMenu.includes('const localized =') && addShapeMenu.includes("value !== key ? value : fallback"), 'Doodle device messaging must never expose a raw i18n key before translations load');
assert(addShapeMenu.indexOf('const doodleUnavailable') < addShapeMenu.indexOf("getComputedStyle(iconCanvas).color"), 'the unavailable Doodle colour must be applied before its canvas icon is painted');
assert(css.includes('doodle-phone-note') && css.includes('A phone has too little continuous space'), 'phone Doodle availability must be communicated visibly in the Add Volume menu');
assert(headerMarkup.includes('xr-about-epigraph') && headerMarkup.includes('about_agentic_coding') && headerMarkup.includes('translations_ai_note'), 'About must disclose Agentic Coding and AI-assisted translations');
assert(headerMarkup.includes('xr-bug-report') && headerMarkup.includes('mailto:francesco@francescoperchiazzi.com'), 'A persistent bug-report control must open a prefilled author email');
assert(markup.includes('xr-app-footer') && markup.includes('footer_credits'), 'The shell must render a localized attribution footer after the editor');
assert(markup.includes('id="uvWorkspaceModal"') && markup.includes('id="uvWorkspaceCanvasHost"'), 'UV workspace must provide a dedicated full-screen canvas host');
assert(css.includes('#renameLayerModal.xr-modal-overlay') && css.includes('calc(var(--z-modal) + 1)'), 'layer rename must stack above the UV workspace that launches it');
assert(css.includes('.xr-rename-layer-modal {') && css.includes('inline-size: min(420px, 100%)') && css.includes('box-sizing: border-box'), 'layer rename must size from its overlay on a narrow viewport');
assert(css.includes('.xr-rename-layer-modal input.xr-field-text') && css.includes('.xr-rename-layer-modal .xr-ctl-row'), 'layer rename input and actions must be contained independently of generic editor controls');
assert(surfaceEditor.includes('function setRenameLayerModalStacking') && surfaceEditor.includes("setRenameLayerModalStacking(modal, true)"), 'layer rename must explicitly elevate above an already-open UV workspace');
assert(editorMarkup.includes('id="btn-uv-workspace"') && surfaceEditor.includes('function openUvWorkspace') && surfaceEditor.includes('restoreUvWorkspacePortals'), 'UV workspace must move the live editor controls instead of cloning stale state');
assert(markup.includes('id="uvWorkspaceZoomIn"') && markup.includes('id="uvWorkspacePan"') && markup.includes('id="uvWorkspaceWheelTexture"') && surfaceEditor.includes('installUvWorkspaceViewGestures'), 'UV workspace must expose independent canvas zoom, pan, and wheel-target controls');
assert(headerMarkup.includes('<ellipse') && headerMarkup.includes('<circle'), 'Bug-report control must use the insect icon, not the former notification glyph');
assert(!headerMarkup.includes('btn-library-trigger') && !headerMarkup.includes('xr-library-dropdown'), 'Library UI must not be mounted in the app shell');
assert(mask.includes('function beginMaskPinch') && mask.includes("state.pinchKind = 'mask-scale'"), 'Mask must support two-finger scaling after a selection is created');
assert(!mask.includes("ctx.fill('evenodd')") && mask.includes('ctx.clip()'), 'Mask preview must avoid WebKit-incompatible inverse fills when a saved mask is reopened');
assert(css.includes('Desktop reads each parameter') && css.includes('#inspector-transform-body > .xr-field-row + .xr-field-slider'), 'desktop label-to-slider spacing must remain compact');

console.log(JSON.stringify({
  ok: true,
  check: 'modal bootstrap, Doodle command routing, mask initial fit, and scale-control theme contrast are guarded',
}));
