export function selectArchetype(ctx) {
  const arch = ctx?.arch || null;
  const refs = ctx?.refs || null;
  const getShapeList = ctx?.getShapeList || (() => []);
  const mutateProject = ctx?.mutateProject || null;
  const clearAssembly = ctx?.clearAssembly || null;
  const getDefaultSpawnPosition = ctx?.getDefaultSpawnPosition || null;
  const createPartFromArchetype = ctx?.createPartFromArchetype || null;
  const setSelectedPart = ctx?.setSelectedPart || null;
  const replaceSelectedPartArchetype = ctx?.replaceSelectedPartArchetype || null;
  const showToast = ctx?.showToast || null;
  const tr = ctx?.tr || ((k) => String(k || ''));
  const setStatusKey = ctx?.setStatusKey || null;
  const resizeRenderer = ctx?.resizeRenderer || null;
  const openDoodleModal = ctx?.openDoodleModal || null;
  const getSelectedId = ctx?.getSelectedId || null;

  if (!arch || !refs) return;

  try {
    const prev = refs.currentArchetype || null;
    if (prev && prev.id) {
      const prevEl = document.getElementById('arch_' + prev.id);
      if (prevEl) prevEl.classList.remove('is-active');
    }
  } catch (_) {}

  refs.currentArchetype = arch;

  try {
    const el = document.getElementById('arch_' + arch.id);
    if (el) el.classList.add('is-active');
  } catch (_) {}

  try {
    const info = document.getElementById('infoArchetype');
    if (info) info.textContent = arch.label;
  } catch (_) {}

  if (arch && arch.id === 'doodle') {
    try { openDoodleModal && openDoodleModal(); } catch (_) {}
    return;
  }

  const shapes = getShapeList();
  const selectedId = getSelectedId ? getSelectedId() : null;
  const canMutate = typeof mutateProject === 'function';
  const canCreate = typeof createPartFromArchetype === 'function' && typeof getDefaultSpawnPosition === 'function' && typeof setSelectedPart === 'function';

  if (canMutate && canCreate && (!shapes || !shapes.length)) {
    mutateProject(() => {
      try { clearAssembly && clearAssembly(); } catch (_) {}
      refs.currentArchetype = arch;
      const position = getDefaultSpawnPosition(0);
      const part = createPartFromArchetype(arch, { position });
      if (part) {
        try { shapes.push(part); } catch (_) {}
        try { setSelectedPart(part.id, { silent: true }); } catch (_) {}
      }
    });
  } else if (canMutate && canCreate && !selectedId) {
    mutateProject(() => {
      const position = getDefaultSpawnPosition(Array.isArray(shapes) ? shapes.length : 0);
      const part = createPartFromArchetype(arch, { position });
      if (part) {
        try { shapes.push(part); } catch (_) {}
        try { setSelectedPart(part.id, { silent: true }); } catch (_) {}
      }
    });
  } else {
    try { replaceSelectedPartArchetype && replaceSelectedPartArchetype(arch); } catch (_) {}
  }

  try { showToast && showToast(arch.label + ' ' + tr('status_loaded_suffix'), 'success'); } catch (_) {}
  try { setStatusKey && setTimeout(() => setStatusKey('status_hint_orbit_draw', ''), 2500); } catch (_) {}
  try { resizeRenderer && resizeRenderer(); } catch (_) {}
}

export const ShapesRuntime = { selectArchetype };
