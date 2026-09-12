/*
 * XReate texture-bombing stress test — run in the DevTools console.
 *
 * Loads 110 entities, each with 10 independent texture layers and varied
 * polygon masks. Each entity visibly starts from the local Skybox test asset.
 * It checks loaded ownership and save-round-trip data, then restores the
 * original project. Set keepScene to true only to inspect the temporary scene.
 *
 * Optional before pasting:
 *   window.XR_TEXTURE_BOMB_CONFIG = { entities: 110, layers: 10, keepScene: true }
 */
(async () => {
  const cfg = { entities: 110, layers: 10, keepScene: false, ...(window.XR_TEXTURE_BOMB_CONFIG || {}) };
  if (!Number.isInteger(cfg.entities) || cfg.entities <= 100) throw new Error('entities must be an integer above 100');
  if (!Number.isInteger(cfg.layers) || cfg.layers < 10) throw new Error('layers must be an integer of at least 10');
  const XR = window.XR || {};
  const io = XR.ProjectIO || XR.__modules?.ProjectIO;
  if (!io?.buildProjectSavePayload || !io?.loadProjectFromPayload) throw new Error('Project IO is not ready');
  const getShapes = XR.ProjectState?.getShapeList || (() => XR.ProjectState?.getProject?.()?.shapes || []);
  const original = io.buildProjectSavePayload();
  const startedAt = performance.now();
  const report = { ok: false, entities: cfg.entities, layersPerEntity: cfg.layers, checks: [], restored: false };
  const restoreOriginal = async () => {
    if (report.restored) return true;
    try {
      await io.loadProjectFromPayload(original);
      report.restored = true;
      const notice = document.getElementById('xreate-texture-bombing-notice');
      if (notice) notice.remove();
      console.info('[texture bombing] original project restored');
      return true;
    } catch (restoreError) {
      report.restoreError = String(restoreError?.message || restoreError);
      console.error('[texture bombing] restore failed', restoreError);
      return false;
    }
  };
  const showInspectionNotice = () => {
    document.getElementById('xreate-texture-bombing-notice')?.remove();
    const notice = document.createElement('aside');
    notice.id = 'xreate-texture-bombing-notice';
    notice.setAttribute('role', 'status');
    notice.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:330px;padding:12px;border:1px solid #f5f0e8;background:#211f1b;color:#f5f0e8;font:12px/1.45 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    const text = document.createElement('div');
    text.textContent = `Texture bombing complete: ${cfg.entities} entities × ${cfg.layers} layers. Inspect the scene, then restore your project.`;
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.textContent = 'Restore project';
    restore.style.cssText = 'display:block;margin-top:10px;padding:7px 10px;border:1px solid currentColor;background:#f5f0e8;color:#211f1b;font:700 11px system-ui;cursor:pointer';
    restore.addEventListener('click', () => { restore.disabled = true; restoreOriginal(); });
    notice.append(text, restore);
    document.body.append(notice);
  };
  window.XR = window.XR || {};
  window.XR.__restoreTextureBombingStress = restoreOriginal;
  const check = (name, ok, details = {}) => {
    report.checks.push({ name, ok, details });
    if (!ok) throw new Error(`${name}: ${JSON.stringify(details)}`);
  };
  const texturePalette = ['#ef476f', '#f78c6b', '#ffd166', '#90be6d', '#06d6a0', '#4cc9f0', '#4361ee', '#7b2cbf', '#c77dff', '#f72585'];
  const assetUrl = new URL('assets/testing/skybox-example.png', window.location.href);
  const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
  if (!assetResponse.ok) throw new Error(`Test texture could not be loaded: ${assetUrl}`);
  const assetBlob = await assetResponse.blob();
  const assetDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Test texture could not be converted to a data URL'));
    reader.readAsDataURL(assetBlob);
  });
  const makeTexture = (color, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 96, 96);
    ctx.fillStyle = 'rgba(255,255,255,.76)';
    for (let p = 0; p < 96; p += 24) ctx.fillRect(p, 0, 12, 96);
    ctx.fillStyle = '#111';
    ctx.font = '800 18px system-ui';
    ctx.fillText(`T${index + 1}`, 28, 54);
    return canvas.toDataURL('image/png');
  };
  const textures = [assetDataUrl, ...texturePalette.slice(1).map(makeTexture)];
  const maskFor = (variant) => {
    if (variant % 3 === 0) return [{ x: .12, y: .12 }, { x: .88, y: .12 }, { x: .88, y: .88 }, { x: .12, y: .88 }];
    if (variant % 3 === 1) return [{ x: .5, y: .06 }, { x: .94, y: .5 }, { x: .5, y: .94 }, { x: .06, y: .5 }];
    return Array.from({ length: 10 }, (_, point) => {
      const angle = (Math.PI * 2 * point) / 10;
      return { x: .5 + Math.cos(angle) * .42, y: .5 + Math.sin(angle) * .42 };
    });
  };
  const transformFor = (entity, layer) => ({
    x: ((entity + layer) % 5 - 2) * .035,
    y: ((entity * 3 + layer) % 5 - 2) * .035,
    scale: 1 + (layer % 4) * .08,
    rot: (entity * 7 + layer * 19) % 360,
    ratio: 1,
    tile: layer % 2 === 0,
    tileScale: 1 + (layer % 3) * .15,
  });
  const types = [
    ['cube', 'box'], ['sphere', 'sphere'], ['cylinder', 'cylindrical'],
    ['cone', 'cylindrical'], ['torus', 'cylindrical'],
  ];
  const shapes = Array.from({ length: cfg.entities }, (_, entity) => {
    const [type, uvMode] = types[entity % types.length];
    const layers = Array.from({ length: cfg.layers }, (_, layer) => ({
      id: `bomb_${entity}_layer_${layer}`,
      label: `Bomb texture ${layer + 1}`,
      imageDataUrl: textures[layer % textures.length],
      transform: transformFor(entity, layer),
      visible: true,
      clippingIslandId: null,
      polygonMaskPoints: maskFor(entity + layer),
      maskLinked: true,
      opacity: layer === 0 ? 1 : .18,
      blendMode: 'source-over',
    }));
    return {
      id: `texture_bomb_${entity}`,
      name: `Texture bomb ${String(entity + 1).padStart(3, '0')}`,
      type, visible: true, locked: false, params: null,
      transform: {
        position: { x: (entity % 11 - 5) * 2.25, y: 0, z: (Math.floor(entity / 11) - 4.5) * 2.25 },
        rotation: { x: 0, y: (entity % 5) * .16, z: 0 },
        scale: { x: .45, y: .45, z: .45 },
      },
      material: { baseColor: '#ffffff', roughness: .6, metalness: 0, emissive: 0, emissiveColor: '#e8c88e' },
      uvMode, customUv: null, selectedIslandId: null,
      imageTransform: { ...layers[0].transform },
      layers, activeLayerIndex: layers.length - 1, shapeScale: null,
      // ProjectIO applies a saved composite to every mesh during hydration.
      // Without it, layer data is correctly present but only the selected
      // entity gets composited by the interactive image workflow.
      textureCompositeDataUrl: assetDataUrl, imageDataUrl: assetDataUrl,
    };
  });
  const payload = { format: 'xreate', version: '2.1.0', project: {
    id: 'xreate_texture_bomb', name: 'Texture bombing (temporary)', textureMode: 'per-shape',
    selectedId: shapes[0].id, shapes,
  }};

  try {
    await io.loadProjectFromPayload(payload);
    const loaded = getShapes();
    check('all temporary entities loaded', loaded.length === cfg.entities, { loaded: loaded.length });
    check('every entity has all layers', loaded.every((shape) => shape.layers?.length === cfg.layers));
    check('every layer retained its bitmap and a polygon mask', loaded.every((shape) => shape.layers.every((layer) =>
      layer.imageBitmap && Array.isArray(layer.polygonMaskPoints) && layer.polygonMaskPoints.length >= 4)));
    check('layer state is not shared between entities', loaded[0].layers[0] !== loaded[1].layers[0]
      && loaded[0].layers[0].transform !== loaded[1].layers[0].transform
      && loaded[0].layers[0].polygonMaskPoints !== loaded[1].layers[0].polygonMaskPoints);
    XR.__modules?.ImageCompositor?.applyTexture?.({ silent: true });
    const saved = io.buildProjectSavePayload();
    check('save preserves entity count', saved.project.shapes.length === cfg.entities, { saved: saved.project.shapes.length });
    check('save preserves the layer matrix', saved.project.shapes.every((shape) => shape.layers?.length === cfg.layers));
    check('save preserves masks and all ten source textures', saved.project.shapes.every((shape) =>
      shape.layers.every((layer) => Array.isArray(layer.polygonMaskPoints) && layer.imageDataUrl?.startsWith('data:image/png'))));
    report.ok = true;
  } finally {
    if (!cfg.keepScene) await restoreOriginal();
    report.durationMs = Math.round(performance.now() - startedAt);
    window.XR.__lastTextureBombingStress = report;
    if (report.ok && cfg.keepScene) showInspectionNotice();
    console[report.ok ? 'info' : 'error']('[texture bombing] final report', report);
  }
  return report;
})().catch((error) => {
  const report = { ok: false, error: String(error?.message || error) };
  window.XR = window.XR || {};
  window.XR.__lastTextureBombingStress = report;
  console.error('[texture bombing] failed before the scene could be inspected', error);
  return report;
});
