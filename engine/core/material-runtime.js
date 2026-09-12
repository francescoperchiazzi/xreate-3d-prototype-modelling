export function createMaterial(ctx) {
  const state = ctx?.state || null;
  const THREE = ctx?.THREE || window.THREE;
  const rough = (state && typeof state.roughness === 'number') ? state.roughness : 0.6;
  const metal = (state && typeof state.metalness === 'number') ? state.metalness : 0.0;
  const em = (state && typeof state.emissive === 'number') ? state.emissive : 0.0;
  const emc = (state && state.emissiveColor) ? state.emissiveColor : '#e8c88e';
  const bc = (state && state.baseColor) ? state.baseColor : '#ffffff';
  if (ctx?.flatLightingOn) {
    const m = new THREE.MeshBasicMaterial({ color: bc, map: null, wireframe: !!ctx?.wireframeOn });
    m.toneMapped = false;
    return m;
  }
  return new THREE.MeshStandardMaterial({
    color: bc,
    roughness: rough,
    metalness: metal,
    emissive: new THREE.Color(emc),
    emissiveIntensity: em,
    map: null,
    wireframe: !!ctx?.wireframeOn,
  });
}

export function applyMaterialFlagsForPart(ctx) {
  const part = ctx?.part || null;
  const mat = ctx?.mat || null;
  const THREE = ctx?.THREE || window.THREE;
  if (!part || !mat) return false;
  const openSurface = !!part?.params?.openEnded;
  const sheetLikeSurface = ['plane', 'dome', 'hemi_open', 'arc_cyl', 'rod_arc_15', 'rod_arc_30', 'rod_arc_45'].includes(part.type);
  // An open cylinder/frustum has an interior: with FrontSide its inner wall
  // is culled, so the opening reads as an opaque black void. Render the shell
  // from both directions only while the caps are open, then restore FrontSide.
  try { mat.side = (sheetLikeSurface || openSurface) ? THREE.DoubleSide : THREE.FrontSide; } catch (_) {}
  try { mat.needsUpdate = true; } catch (_) {}
  if (part.type === 'plane') {
    try { mat.transparent = true; } catch (_) {}
    try { mat.alphaTest = 0.02; } catch (_) {}
    try { mat.depthWrite = true; } catch (_) {}
    try { mat.needsUpdate = true; } catch (_) {}
  }
  return true;
}

// ExtrudeGeometry triangulates the two caps of a mirrored Doodle. Three's
// Material.wireframe draws those triangulation diagonals as if they were real
// edges, even though the volume itself is one continuous silhouette. For this
// one topology use EdgesGeometry instead: it preserves the outside contour and
// actual depth edges while omitting coplanar cap diagonals.
function disposeMirrorWireframeOverlay(part, mesh) {
  const overlay = part?._mirrorWireframeOverlay || null;
  if (!overlay) return;
  try { mesh?.remove?.(overlay); } catch (_) {}
  try { overlay.geometry?.dispose?.(); } catch (_) {}
  try { overlay.material?.dispose?.(); } catch (_) {}
  part._mirrorWireframeOverlay = null;
}

function restoreMirrorWireframeMaterial(part, material) {
  const saved = part?._mirrorWireframeMaterial || null;
  if (!saved || saved.material !== material) return;
  material.transparent = saved.transparent;
  material.opacity = saved.opacity;
  material.depthWrite = saved.depthWrite;
  material.needsUpdate = true;
  part._mirrorWireframeMaterial = null;
}

function syncMirrorWireframe(ctx) {
  const part = ctx?.part || null;
  const mesh = part?._mesh || null;
  const material = mesh?.material || null;
  const THREE = ctx?.THREE || globalThis.THREE || null;
  const enabled = !!ctx?.wireframeOn;
  const canUseCleanEdges = enabled
    && part?.type === 'doodle'
    && part?.doodleMode === 'mirror'
    && mesh?.geometry
    && material
    && typeof THREE?.EdgesGeometry === 'function'
    && typeof THREE?.LineSegments === 'function'
    && typeof THREE?.LineBasicMaterial === 'function';

  if (!canUseCleanEdges) {
    disposeMirrorWireframeOverlay(part, mesh);
    restoreMirrorWireframeMaterial(part, material);
    if (material) material.wireframe = enabled;
    return false;
  }

  const hasCurrentOverlay = part._mirrorWireframeOverlay
    && part._mirrorWireframeOverlay.userData?.sourceGeometry === mesh.geometry;
  if (!hasCurrentOverlay) {
    disposeMirrorWireframeOverlay(part, mesh);
    const edges = new THREE.EdgesGeometry(mesh.geometry, 1);
    const color = material.color?.clone?.() || material.color || '#e8e2d6';
    const lineMaterial = new THREE.LineBasicMaterial({ color });
    const overlay = new THREE.LineSegments(edges, lineMaterial);
    overlay.userData.sourceGeometry = mesh.geometry;
    overlay.renderOrder = (mesh.renderOrder || 0) + 1;
    mesh.add(overlay);
    part._mirrorWireframeOverlay = overlay;
  }
  if (!part._mirrorWireframeMaterial || part._mirrorWireframeMaterial.material !== material) {
    part._mirrorWireframeMaterial = {
      material,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    };
  }
  material.wireframe = false;
  material.transparent = true;
  material.opacity = 0;
  material.depthWrite = false;
  material.needsUpdate = true;
  return true;
}

export function applyMaterialStateToMesh(ctx) {
  const part = ctx?.part || null;
  const THREE = ctx?.THREE || window.THREE;
  const wireframeOn = !!ctx?.wireframeOn;
  if (!part || !part._mesh || !part._mesh.material) return false;
  const mat = part._mesh.material;
  const m = part.material || null;
  if (!m) return false;
  if ('color' in mat && m.baseColor) {
    try { mat.color = new THREE.Color(m.baseColor); } catch (_) {}
  }
  if ('roughness' in mat && typeof m.roughness === 'number') mat.roughness = Math.max(0, Math.min(1, m.roughness));
  if ('metalness' in mat && typeof m.metalness === 'number') mat.metalness = Math.max(0, Math.min(1, m.metalness));
  if ('emissiveIntensity' in mat && typeof m.emissive === 'number') mat.emissiveIntensity = Math.max(0, Math.min(1, m.emissive));
  if (m.emissiveColor && 'emissive' in mat) {
    try { mat.emissive = new THREE.Color(m.emissiveColor); } catch (_) {}
  }
  // Geometry parameters can change without a texture being present. Apply the
  // topology-dependent flags here as well, rather than depending on the image
  // compositor (which returns early for an untextured volume).
  applyMaterialFlagsForPart({ part, mat, THREE });
  mat.wireframe = wireframeOn;
  mat.needsUpdate = true;
  syncMirrorWireframe({ part, THREE, wireframeOn });
  return true;
}

// Recreates materials after a renderer-wide display mode changes. Textures are
// selected per part/project but disposal stays local to the replaced material.
export function rebuildAllMaterials(ctx) {
  const shapes = ctx?.getShapeList?.() || [];
  const project = ctx?.getProject?.() || null;
  let rebuilt = 0;
  for (const part of shapes) {
    const mesh = part?._mesh || null;
    if (!mesh) continue;
    const previous = mesh.material || null;
    const next = ctx?.createMaterial?.(part.material) || null;
    if (!next) continue;
    ctx?.applyMaterialFlagsForPart?.(part, next);
    const texture = project?.textureMode === 'shared' ? project?._sharedTexture || null : part._texture || null;
    if (texture) next.map = texture;
    next.wireframe = !!ctx?.wireframeOn;
    next.needsUpdate = true;
    // Tear down an overlay tied to the previous material/geometry before the
    // replacement material is disposed, then build a clean one if needed.
    disposeMirrorWireframeOverlay(part, mesh);
    restoreMirrorWireframeMaterial(part, previous);
    mesh.material = next;
    syncMirrorWireframe({ part, THREE: ctx?.THREE, wireframeOn: !!ctx?.wireframeOn });
    for (const material of (Array.isArray(previous) ? previous : [previous])) {
      try { material?.dispose?.(); } catch (err) { console.warn('[material-runtime] replaced material disposal failed', { partId: part?.id, err }); }
    }
    rebuilt += 1;
  }
  return rebuilt;
}

function syncDisplayButton(documentRef, id, active) {
  const button = documentRef?.getElementById?.(id) || null;
  button?.setAttribute?.('aria-pressed', active ? 'true' : 'false');
  button?.classList?.toggle?.('is-active', active);
}

export function toggleWireframe(ctx) {
  const refs = ctx?.refs || {};
  refs.wireframeOn = !refs.wireframeOn;
  syncDisplayButton(ctx?.document, 'btn-wireframe', refs.wireframeOn);
  for (const part of ctx?.getShapeList?.() || []) {
    const material = part?._mesh?.material || null;
    if (material) {
      material.wireframe = refs.wireframeOn;
      syncMirrorWireframe({ part, THREE: ctx?.THREE, wireframeOn: refs.wireframeOn });
    }
  }
  return refs.wireframeOn;
}

export function toggleFlatLighting(ctx) {
  const refs = ctx?.refs || {};
  refs.flatLightingOn = !refs.flatLightingOn;
  syncDisplayButton(ctx?.document, 'btn-flatlight', refs.flatLightingOn);
  ctx?.onStateChange?.(refs);
  ctx?.rebuildAllMaterials?.();
  try { ctx?.persistViewportSettings?.(); } catch (err) { console.warn('[material-runtime] viewport display persistence failed', err); }
  return refs.flatLightingOn;
}

export const MaterialRuntime = {
  createMaterial,
  applyMaterialFlagsForPart,
  applyMaterialStateToMesh,
  rebuildAllMaterials,
  toggleWireframe,
  toggleFlatLighting,
};
