let configured = null;
const refs = { currentArchetype: null };

export function configure(ctx) {
  configured = ctx && typeof ctx === 'object' ? ctx : null;
}

export function getProject() {
  const api = configured?.projectState || null;
  if (api && typeof api.getProject === 'function') return api.getProject();
  return (configured && configured.project) ? configured.project : null;
}

export function getSelectedId() {
  const api = configured?.projectState || null;
  if (api && typeof api.getSelectedId === 'function') return api.getSelectedId();
  const project = getProject();
  return (project && project.selectedId) ? project.selectedId : null;
}

export function setProjectName(name) {
  const api = configured?.projectState || null;
  if (api && typeof api.setProjectName === 'function') {
    try { api.setProjectName(name); } catch (_) {}
  } else {
    const project = getProject();
    if (project) {
      project.name = String(name || '').trim() || 'Untitled';
      if (project.meta) project.meta.modified = Date.now();
    }
  }
  try { configured?.updateProjectNameUi?.(); } catch (_) {}
}

export function list() {
  const api = XR?.ProjectState || null;
  if (api && typeof api.getShapeList === 'function') return api.getShapeList();
  if (configured && typeof configured.getShapeList === 'function') return configured.getShapeList();
  const project = getProject();
  return (project && Array.isArray(project.shapes)) ? project.shapes : [];
}

export function getById(id) {
  const sid = String(id || '');
  const api = configured?.projectState || null;
  if (api && typeof api.getShapeById === 'function') return api.getShapeById(sid);
  return list().find(s => s && s.id === sid) || null;
}

export function getArchetype(typeId) {
  try {
    const f = configured?.getArchetypeById || configured?.shapeDefs?.get || null;
    if (typeof f === 'function') return f(typeId);
  } catch (_) {}
  return null;
}

export function select(id, opts) {
  const partId = id ? String(id) : null;
  const options = opts || { silent: true };
  const f = configured?.setSelectedPart || null;
  if (typeof f === 'function') {
    try { return f(partId, options); } catch (_) { return; }
  }
  const selection = configured?.selection || null;
  if (selection && typeof selection.setSelectedPart === 'function') {
    try { return selection.setSelectedPart({ partId, options }); } catch (_) { return; }
  }
  try { configured?.projectState?.setSelectedId?.(partId); } catch (_) {}
}

export function addFromArchetype(arch, opts) {
  if (arch && typeof arch === 'object' && arch.id) {
    const controllerAddFn = configured?.addPartFromArchetype || null;
    if (typeof controllerAddFn === 'function') {
      try {
        const part = controllerAddFn(arch, opts || null);
        if (part) return part;
      } catch (_) {}
    }
    const ctxAddFn = configured?.fallbackAddPartFromArchetype || null;
    if (typeof ctxAddFn === 'function') {
      try {
        const part = ctxAddFn(arch, opts || null);
        if (part) return part;
      } catch (_) {}
    }
  }
  const mod = configured?.shapesRuntime || null;
  if (!mod || typeof mod.selectArchetype !== 'function') return null;
  const shapeFactory = configured?.shapeFactory || null;
  if (!shapeFactory || typeof shapeFactory.createPartFromArchetype !== 'function' || typeof shapeFactory.replaceSelectedPartArchetype !== 'function') return null;

  const mutateProject = configured?.mutateProject || null;

  try {
    mod.selectArchetype({
      arch,
      refs,
      getShapeList: () => list(),
      getSelectedId: () => getSelectedId(),
      mutateProject,
      clearAssembly: configured?.clearAssembly || null,
      getDefaultSpawnPosition: configured?.getDefaultSpawnPosition || null,
      createPartFromArchetype: (a, o) => {
        try {
          return shapeFactory.createPartFromArchetype({
            ...(configured || {}),
            arch: a,
            opts: o || opts || null,
          });
        } catch (_) { return null; }
      },
      setSelectedPart: configured?.setSelectedPart || null,
      replaceSelectedPartArchetype: (a) => {
        try {
          return shapeFactory.replaceSelectedPartArchetype({
            ...(configured || {}),
            arch: a,
            refs: configured?.shapeFactoryRefs || { uvMode: null },
            getSelectedPart: configured?.getSelectedPart || null,
          });
        } catch (_) {}
      },
      resizeRenderer: configured?.resizeRenderer || null,
      openDoodleModal: configured?.openDoodleModal || null,
      showToast: configured?.showToast || null,
      tr: configured?.tr || null,
      setStatusKey: configured?.setStatusKey || null,
    });
  } catch (_) {}

  return refs.currentArchetype || null;
}

export function add(typeId, opts) {
  const arch = getArchetype(typeId) || getArchetype('cube');
  return addFromArchetype(arch, opts);
}

export function addDoodle(points, params, opts) {
  try {
    const f = configured?.addDoodleShapeToScene || null;
    if (typeof f === 'function') return f(points, params, opts);
  } catch (_) {}
  return null;
}

export function duplicateSelected() {
  const s = (configured && typeof configured.getSelectedPart === 'function')
    ? configured.getSelectedPart()
    : (configured?.projectState?.getSelectedPart?.() || null);
  if (!s) return;
  try { configured?.sceneCommands?.duplicatePart?.(s.id); } catch (_) {}
}

export function deleteSelected() {
  const s = (configured && typeof configured.getSelectedPart === 'function')
    ? configured.getSelectedPart()
    : (configured?.projectState?.getSelectedPart?.() || null);
  if (!s) return;
  try { configured?.sceneCommands?.deletePart?.(s.id); } catch (_) {}
}

export function moveSelectedUp() {
  const s = (configured && typeof configured.getSelectedPart === 'function')
    ? configured.getSelectedPart()
    : (configured?.projectState?.getSelectedPart?.() || null);
  if (!s) return;
  try { configured?.sceneCommands?.movePartInTree?.(s.id, -1); } catch (_) {}
}

export function moveSelectedDown() {
  const s = (configured && typeof configured.getSelectedPart === 'function')
    ? configured.getSelectedPart()
    : (configured?.projectState?.getSelectedPart?.() || null);
  if (!s) return;
  try { configured?.sceneCommands?.movePartInTree?.(s.id, +1); } catch (_) {}
}

export const ProjectCommands = { get: getProject, getSelectedId, setName: setProjectName };
export const ShapeCommands = { configure, list, getById, select, getArchetype, addFromArchetype, add, addDoodle, duplicateSelected, deleteSelected, moveSelectedUp, moveSelectedDown };
