/** Rebuilds the selected mesh geometry while preserving its part identity. */
export function rebuildSelectedPartGeometry(ctx) {
  const part = ctx?.getSelectedPart?.();
  if (!part?._mesh) return false;
  const arch = ctx?.getArchetypeById?.(part.type);
  if (!arch || typeof arch.build !== 'function') return false;
  const applyUvModeToGeometry = ctx?.applyUvModeToGeometry;
  if (typeof applyUvModeToGeometry !== 'function') return false;

  ctx?.armProjectUndoSnapshot?.();
  let geo0 = null;
  try {
    geo0 = arch.build(part.params || undefined);
    if (!geo0) return false;
    const nextGeo = applyUvModeToGeometry(geo0, part.uvMode) || geo0;
    if (nextGeo !== geo0) geo0.dispose();
    if (part._mesh.geometry) part._mesh.geometry.dispose();
    part._mesh.geometry = nextGeo;
    // End-cap changes affect material culling even when no texture exists, so
    // apply the material contract before the optional texture refresh below.
    ctx?.applyMaterialFlagsForPart?.(part, part._mesh.material);
  } catch (err) {
    try { geo0?.dispose?.(); } catch (disposeErr) { console.warn('[geometry-controller] failed to dispose failed geometry', disposeErr); }
    console.error('[geometry-controller] rebuild failed', { partId: part.id, type: part.type, err });
    return false;
  }
  try { ctx?.updateInfoForMesh?.(part._mesh); } catch (err) { console.warn('[geometry-controller] mesh info update failed', err); }
  try { ctx?.renderUvOverlay?.(); } catch (err) { console.warn('[geometry-controller] UV overlay update failed', err); }
  try { ctx?.markViewportDirty?.(30); } catch (err) { console.warn('[geometry-controller] viewport refresh failed', err); }
  try { ctx?.requestApplyTexture?.(true); } catch (err) { console.warn('[geometry-controller] texture refresh failed', err); }
  return true;
}
