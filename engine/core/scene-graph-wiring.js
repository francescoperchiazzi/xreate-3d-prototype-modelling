export function syncAssemblyRootOrderFromTree(ctx) {
  const assemblyRoot = ctx?.assemblyRoot || null;
  const getShapeList = ctx?.getShapeList || (() => []);
  if (!assemblyRoot) return;
  const shapes = getShapeList();
  const children = (assemblyRoot.children || []).slice();
  for (const ch of children) {
    try { assemblyRoot.remove(ch); } catch (_) {}
  }
  for (let i = 0; i < shapes.length; i++) {
    const p = shapes[i];
    const m = p && p._mesh;
    if (!m) continue;
    m.renderOrder = i;
    try { assemblyRoot.add(m); } catch (_) {}
  }
}

export function movePartInTree(ctx) {
  const partId = ctx?.partId ? String(ctx.partId) : '';
  const delta = ctx?.delta || 0;
  const getShapeList = ctx?.getShapeList || (() => []);
  const mutateProject = ctx?.mutateProject || null;
  const renderTreeUI = ctx?.renderTreeUI || null;
  const setStatusKey = ctx?.setStatusKey || null;
  const assemblyRoot = ctx?.assemblyRoot || null;
  if (!partId) return;
  const shapes = getShapeList();
  const idx = shapes.findIndex(p => p && p.id === partId);
  if (idx < 0) return;
  if (typeof mutateProject !== 'function') return;
  mutateProject(() => {
    const nextIdx = Math.max(0, Math.min(shapes.length - 1, idx + (delta || 0)));
    if (nextIdx === idx) return;
    const item = shapes.splice(idx, 1)[0];
    shapes.splice(nextIdx, 0, item);
    try { syncAssemblyRootOrderFromTree({ assemblyRoot, getShapeList }); } catch (_) {}
    try { renderTreeUI && renderTreeUI(); } catch (_) {}
    try { setStatusKey && setStatusKey('status_layer_order_updated', 'ok'); } catch (_) {}
  });
}

export function deletePart(ctx) {
  const partId = ctx?.partId ? String(ctx.partId) : '';
  const getShapeList = ctx?.getShapeList || (() => []);
  const mutateProject = ctx?.mutateProject || null;
  const disposePart = ctx?.disposePart || null;
  const clearAssembly = ctx?.clearAssembly || null;
  const setSelectedPart = ctx?.setSelectedPart || null;
  const setStatusKey = ctx?.setStatusKey || null;
  const renderTreeUI = ctx?.renderTreeUI || null;
  const updatePartControlsFromSelected = ctx?.updatePartControlsFromSelected || null;
  const updateShapeTransformControlsFromSelected = ctx?.updateShapeTransformControlsFromSelected || null;
  const updateMaterialControlsFromSelected = ctx?.updateMaterialControlsFromSelected || null;
  const updateGizmo = ctx?.updateGizmo || null;
  const showToast = ctx?.showToast || null;
  const tr = ctx?.tr || ((k) => String(k || ''));
  const undoProject = ctx?.undoProject || null;
  const getSelectedId = ctx?.getSelectedId || null;

  if (!partId) return;
  const shapes = getShapeList();
  const idx = shapes.findIndex(p => p && p.id === partId);
  if (idx < 0) return;
  if (typeof mutateProject !== 'function') return;
  if (typeof disposePart !== 'function') return;
  if (typeof setSelectedPart !== 'function') return;
  if (typeof setStatusKey !== 'function') return;

  let didDelete = false;
  mutateProject(() => {
    const selectedId = getSelectedId ? getSelectedId() : null;
    const wasSelected = selectedId === partId;
    if (wasSelected) {
      try { setSelectedPart(null, { silent: true, skipApplyTexture: true }); } catch (_) {}
    }
    disposePart(shapes[idx]);
    shapes.splice(idx, 1);
    didDelete = true;
    if (!shapes.length) {
      try { clearAssembly && clearAssembly(); } catch (_) {}
      setSelectedPart(null, { silent: true, skipApplyTexture: true });
      setStatusKey('status_project_cleared', 'ok');
      try { renderTreeUI && renderTreeUI(); } catch (_) {}
      try { updatePartControlsFromSelected && updatePartControlsFromSelected(); } catch (_) {}
      try { updateShapeTransformControlsFromSelected && updateShapeTransformControlsFromSelected(); } catch (_) {}
      try { updateMaterialControlsFromSelected && updateMaterialControlsFromSelected(); } catch (_) {}
      try { updateGizmo && updateGizmo(); } catch (_) {}
      return;
    }
    if (wasSelected) {
      const next = shapes[Math.max(0, idx - 1)];
      try { setSelectedPart(next.id, { silent: true }); } catch (_) {}
    }
  });

  if (didDelete) {
    try {
      showToast && showToast(tr('toast_volume_deleted'), 'info', {
        durationMs: 5000,
        actions: [{ label: tr('action_undo'), onClick: () => {
          try { void undoProject?.(); }
          catch (err) { console.error('[scene-graph] undo after deletion failed', err); }
        } }]
      });
    } catch (_) {}
  }
}

export const SceneGraphWiring = { syncAssemblyRootOrderFromTree, movePartInTree, deletePart };
