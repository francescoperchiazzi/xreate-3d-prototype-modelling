/** Owns the texture-mode transition and prevents an accidental shared texture
 * from surviving when the editor returns to per-shape ownership. */
export function setTextureMode(ctx) {
  const project = ctx?.getProject?.() || ctx?.project || null;
  const mutateProject = ctx?.mutateProject;
  const getShapeList = ctx?.getShapeList;
  if (!project || typeof mutateProject !== 'function' || typeof getShapeList !== 'function') return false;
  const perShape = !!ctx?.perShape;
  mutateProject(() => {
    const nextTextureMode = perShape ? 'per-shape' : 'shared';
    if (typeof ctx?.dispatchProject === 'function') {
      ctx.dispatchProject({ type: 'texture-mode/set', textureMode: nextTextureMode, project });
    } else {
      project.textureMode = nextTextureMode;
    }
    const shapes = getShapeList();
    if (!shapes.length) return;
    if (project.textureMode === 'shared') {
      ctx?.requestApplyTexture?.(true);
      ctx?.setStatusKey?.('status_texture_mode_shared', 'ok');
      return;
    }
    for (const part of shapes) {
      const mesh = part?._mesh;
      if (!mesh?.material) continue;
      if (!part._texture) {
        const THREE = ctx?.THREE;
        if (!THREE?.CanvasTexture) {
          console.error('[texture-mode] CanvasTexture is unavailable while restoring per-shape mode');
          continue;
        }
        part._texture = new THREE.CanvasTexture(part._compositeCanvas || ctx?.compositeCanvas);
        ctx?.ensureSrgbTexture?.(part._texture);
      }
      mesh.material.map = part._texture;
      mesh.material.needsUpdate = true;
    }
    const selected = ctx?.getSelectedPart?.() || null;
    const refs = ctx?.refs || {};
    refs.drawingTexture = selected?._texture || refs.drawingTexture || null;
    ctx?.requestApplyTexture?.(true);
    ctx?.setStatusKey?.('status_texture_mode_per_shape', 'ok');
  });
  return true;
}
