import { createSceneCore, resizeRenderer as resizeSceneRenderer } from '../core/scene-setup.js';

function disposeTexture(value, seen) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  if (!value.isTexture) return;
  seen.add(value);
  try { value.dispose?.(); } catch (err) { console.warn('[scene-runtime] texture dispose failed', err); }
}

function disposeMaterial(material, seenMaterials, seenTextures) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    if (!item || seenMaterials.has(item)) continue;
    seenMaterials.add(item);
    for (const value of Object.values(item)) disposeTexture(value, seenTextures);
    try { item.dispose?.(); } catch (err) { console.warn('[scene-runtime] material dispose failed', err); }
  }
}

// Public scene boundary used by the runtime bootstrap. SceneSetup remains the
// low-level Three factory, while this module owns the lifecycle-facing API.
export function create(ctx = {}) {
  const resources = createSceneCore(ctx);
  if (!resources) return null;
  return { ...resources, sceneRuntime: adopt(resources) };
}

export function resize(ctx = {}) {
  return resizeSceneRenderer(ctx);
}

// Adopts the Three resources created during the transitional bootstrap. The
// legacy bridge may read them, but disposal has one owner from this point on.
export function adopt(resources = {}) {
  let disposed = false;
  const renderer = resources.renderer || null;
  const scene = resources.scene || null;

  return {
    get disposed() { return disposed; },
    dispose() {
      if (disposed) return false;
      disposed = true;
      const materials = new Set();
      const textures = new Set();
      try {
        scene?.traverse?.((object) => {
          try { object.geometry?.dispose?.(); } catch (err) { console.warn('[scene-runtime] geometry dispose failed', err); }
          disposeMaterial(object.material, materials, textures);
        });
      } catch (err) {
        console.warn('[scene-runtime] scene traversal during dispose failed', err);
      }
      try { renderer?.renderLists?.dispose?.(); } catch (err) { console.warn('[scene-runtime] render-list dispose failed', err); }
      try { renderer?.dispose?.(); } catch (err) { console.warn('[scene-runtime] renderer dispose failed', err); }
      try { renderer?.forceContextLoss?.(); } catch (err) { console.warn('[scene-runtime] renderer context loss failed', err); }
      return true;
    },
  };
}
