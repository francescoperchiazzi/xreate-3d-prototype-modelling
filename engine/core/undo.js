function resolveProject(ctx) {
  const getProject = ctx?.getProject || null;
  if (typeof getProject === 'function') {
    try {
      const project = getProject();
      if (project) return project;
    } catch (_) {}
  }
  const stable = ctx?.projectState?.getProject || null;
  if (typeof stable === 'function') {
    try {
      const project = stable();
      if (project) return project;
    } catch (_) {}
  }
  return ctx?.project || null;
}

export function getUndoMaxSteps(ctx) {
  try {
    const ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent) ? String(navigator.userAgent) : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    const getShapeList = ctx?.getShapeList || null;
    const partHasAnyVisibleLayerImage = ctx?.partHasAnyVisibleLayerImage || null;
    const shapes = getShapeList ? getShapeList() : [];
    const hasAnyImage = Array.isArray(shapes) && partHasAnyVisibleLayerImage
      ? shapes.some((p) => partHasAnyVisibleLayerImage(p))
      : false;
    if (isIOS) return hasAnyImage ? 8 : 12;
    return hasAnyImage ? 12 : 20;
  } catch (_) {
    return 20;
  }
}

export function pushProjectUndoSnapshot(ctx) {
  const project = resolveProject(ctx);
  const buildProjectUndoPayload = ctx?.buildProjectUndoPayload || null;
  const gcUndoAssets = ctx?.gcUndoAssets || null;
  const getUndoMaxStepsFn = ctx?.getUndoMaxSteps || null;
  if (!project || !buildProjectUndoPayload || !getUndoMaxStepsFn) return;
  if (!project._undoStack) project._undoStack = [];
  if (!project._redoStack) project._redoStack = [];
  const snap = buildProjectUndoPayload();
  project._undoStack.push(snap);
  const max = getUndoMaxStepsFn();
  while (project._undoStack.length > max) project._undoStack.shift();
  project._redoStack.length = 0;
  try { gcUndoAssets && gcUndoAssets(); } catch (_) {}
}

export function armProjectUndoSnapshot(ctx) {
  const refs = ctx?.refs || {};
  const pushProjectUndoSnapshotFn = ctx?.pushProjectUndoSnapshot || null;
  if (!refs.projectUndoArmed) {
    try { pushProjectUndoSnapshotFn && pushProjectUndoSnapshotFn(); } catch (_) {}
    refs.projectUndoArmed = true;
  }
  if (refs.projectUndoArmTimer) clearTimeout(refs.projectUndoArmTimer);
  refs.projectUndoArmTimer = setTimeout(() => {
    refs.projectUndoArmed = false;
    refs.projectUndoArmTimer = null;
  }, 900);
}

// Discrete commands (add, duplicate, delete, import) must never be merged
// with the preceding slider/drag debounce window.
export function beginDiscreteUndo(ctx) {
  const refs = ctx?.refs || {};
  refs.projectUndoArmed = false;
  if (refs.projectUndoArmTimer) clearTimeout(refs.projectUndoArmTimer);
  refs.projectUndoArmTimer = null;
}

export function mutateProject(ctx) {
  const project = resolveProject(ctx);
  const fn = ctx?.fn || null;
  const armProjectUndoSnapshotFn = ctx?.armProjectUndoSnapshot || null;
  if (!project || typeof fn !== 'function') return;
  try { armProjectUndoSnapshotFn && armProjectUndoSnapshotFn(); } catch (_) {}
  fn(project);
  if (project.meta) project.meta.modified = Date.now();
}

export async function undoProject(ctx) {
  const project = resolveProject(ctx);
  const buildProjectUndoPayload = ctx?.buildProjectUndoPayload || null;
  const loadProjectFromPayload = ctx?.loadProjectFromPayload || null;
  const gcUndoAssets = ctx?.gcUndoAssets || null;
  const setStatusKey = ctx?.setStatusKey || null;
  const setStatus = ctx?.setStatus || null;
  const getUndoMaxStepsFn = ctx?.getUndoMaxSteps || null;
  if (!project || !project._undoStack || !project._undoStack.length) return;
  if (!project._redoStack) project._redoStack = [];
  if (!buildProjectUndoPayload) return;
  if (!loadProjectFromPayload) return;
  const cur = buildProjectUndoPayload ? buildProjectUndoPayload() : null;
  const prev = project._undoStack.pop();
  project._redoStack.push(cur);
  const max = getUndoMaxStepsFn ? getUndoMaxStepsFn() : 20;
  while (project._redoStack.length > max) project._redoStack.shift();
  try { setStatusKey && setStatusKey('status_undo_working', 'working'); } catch (_) {}
  await loadProjectFromPayload(prev, { preserveHistory: true });
  try { setStatusKey && setStatusKey('status_undo', 'ok'); } catch (_) {}
  setTimeout(() => {
    try { setStatus && setStatus('', ''); } catch (_) {}
  }, 700);
  try { gcUndoAssets && gcUndoAssets(); } catch (_) {}
}

export async function redoProject(ctx) {
  const project = resolveProject(ctx);
  const buildProjectUndoPayload = ctx?.buildProjectUndoPayload || null;
  const loadProjectFromPayload = ctx?.loadProjectFromPayload || null;
  const gcUndoAssets = ctx?.gcUndoAssets || null;
  const setStatusKey = ctx?.setStatusKey || null;
  const setStatus = ctx?.setStatus || null;
  const getUndoMaxStepsFn = ctx?.getUndoMaxSteps || null;
  if (!project || !project._redoStack || !project._redoStack.length) return;
  if (!project._undoStack) project._undoStack = [];
  if (!buildProjectUndoPayload) return;
  if (!loadProjectFromPayload) return;
  const cur = buildProjectUndoPayload ? buildProjectUndoPayload() : null;
  const next = project._redoStack.pop();
  project._undoStack.push(cur);
  const max = getUndoMaxStepsFn ? getUndoMaxStepsFn() : 20;
  while (project._undoStack.length > max) project._undoStack.shift();
  try { setStatusKey && setStatusKey('status_redo_working', 'working'); } catch (_) {}
  await loadProjectFromPayload(next, { preserveHistory: true });
  try { setStatusKey && setStatusKey('status_redo', 'ok'); } catch (_) {}
  setTimeout(() => {
    try { setStatus && setStatus('', ''); } catch (_) {}
  }, 700);
  try { gcUndoAssets && gcUndoAssets(); } catch (_) {}
}

export const Undo = {
  getUndoMaxSteps,
  pushProjectUndoSnapshot,
  armProjectUndoSnapshot,
  beginDiscreteUndo,
  mutateProject,
  undoProject,
  redoProject,
};
