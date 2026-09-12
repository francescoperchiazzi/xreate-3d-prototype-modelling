// XReate shell entrypoint.
// Placeholder module created during migration Phase 1.
// The legacy inline shell remains authoritative until its wiring is extracted.

import './trae.js';
import './lifecycle-dom.js';
import './icons/draw-icon.js';
import './modal.js';
import './export-modal.js';
import './canvas-sizing.js';
import './orchestrator.js';
import './runtime.js';
import './bootstrap.js';
import './keyboard.js';
import './editor-modals.js';
import './body-overlays.js';
import './doodle-modal.js';
import './toast.js';
import './theme.js';
import './add-shape-menu.js';
import './project-ui.js';
import './uv-ui.js';
import './viewport-controls.js';
import './scene-panels.js';
import './inspector-panels.js';
import './shape-params.js';
import './surface-editor.js';
import './image-tools.js';
import './mask-editor.js';
import './menu-wiring.js';

// Deferred legacy code may need a Shell facade while this ESM graph is still
// evaluating. Publish a real readiness boundary rather than relying on script
// order or an arbitrary timeout.
window.dispatchEvent(new Event('xreate:shell-modules-ready'));
window.XR?.DebugLog?.event?.('shell.modules.ready');
