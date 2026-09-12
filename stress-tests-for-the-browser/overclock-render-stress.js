/**
 * XReate UI44 - Overclock Render Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH imports -> ST helper (window.XR runtime)
 *   - typeA/B/C/D -> cube / cylinder / sphere / plane
 *   - Entities API -> ST.list/add/get/update/remove/clear
 *   - AppConfig.bounds/maxEntities -> local constants (max 500, x: -14..14, y: 0.1..4.5, z: -14..-2)
 *   - EventBus 11x publish(EVENT_A..K) -> replaced with 3 real CustomEvents (xr:project-changed / selection-changed / ui-mode-changed)
 *   - MeshRegistryAPI.hasMesh/getMesh -> ST.3d.findMesh(partId)
 *   - updateSelection -> ST.select(id)
 *   - stateManager.toggleVisibility -> XR.SceneCommands.setPartVisibility(id, bool)
 *   - resetCamera -> manual ST.3d.camera position reset (if reachable)
 * Sections REMOVED: badges, formatVariant, textureFitMode, faceTextures, textureDeformation, badgeLayoutMode, source field (no such fields in XReate shapes)
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 *   NOTE: Default budget = 120 entities. Edit CONFIG.totalWanted to raise/lower.
 */

(async () => {
  console.log('%c[STRESS-OVERCLOCK] Starting bulk entity creation + mutation phase...', 'color: #00ff00; font-weight: bold; font-size: 14px;');

  // ========= SHARED ST HELPER =========
  const ST = (() => {
    const TYPES = { A: 'cube', B: 'cylinder', C: 'sphere', D: 'plane' };
    const _refs = { projectUndoArmed: false, projectUndoArmTimer: null };
    const XR = (typeof window !== 'undefined') ? (window.XR || {}) : {};
    const _ctx = {
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.() || XR.ProjectIO?.buildProjectSavePayload?.() || null,
      loadProjectFromPayload: (p, o) => (XR.ProjectIO?.loadProjectFromPayload?.(p, o || {})),
      getUndoMaxSteps: () => (XR.Undo?.getUndoMaxSteps?.() ?? 20),
      gcUndoAssets: () => {},
      setStatusKey: () => {},
      setStatus: () => {},
      tr: (s) => String(s || ''),
      refs: _refs,
      pushProjectUndoSnapshot: () => (XR.Undo?.pushProjectUndoSnapshot?.(_ctx)),
      armProjectUndoSnapshot: () => (XR.Undo?.armProjectUndoSnapshot?.(_ctx)),
    };
    function _ensureTransform(p) {
      if (!p) return null;
      if (!p.transform) p.transform = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
      if (!p.transform.position) p.transform.position = { x: 0, y: 0, z: 0 };
      if (!p.transform.rotation) p.transform.rotation = { x: 0, y: 0, z: 0 };
      if (!p.transform.scale) p.transform.scale = { x: 1, y: 1, z: 1 };
      return p;
    }
    function list() { try { return XR.Shapes?.list?.() || XR.ProjectState?.getShapeList?.() || XR.getShapes?.() || []; } catch (_) { return []; } }
    function get(id) {
      const sid = String(id || '');
      try { return XR.Shapes?.getById?.(sid) || XR.ProjectState?.getShapeById?.(sid) || list().find(s => s && s.id === sid) || null; }
      catch (_) { return list().find(s => s && s.id === sid) || null; }
    }
    function add(typeId, opts) {
      const type = typeId in TYPES ? TYPES[typeId] : (String(typeId || '') || 'cube');
      const o = opts || {};
      const pos = o.position || { x: 0, y: 1, z: -2 };
      const sca = o.scale || { x: 1, y: 1, z: 1 };
      const rot = o.rotation || { x: 0, y: 0, z: 0 };
      const createOpts = { id: o.id, name: o.name || `Stress_${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, color: o.color || null, position: pos, scale: sca, rotation: rot, layers: Array.isArray(o.layers) ? o.layers : null, uvMode: o.uvMode || null };
      try {
        const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
        let part = arch ? (XR.addPartFromArchetype?.(arch, createOpts) || null) : null;
        if (!part) part = XR.Shapes?.add?.(type, createOpts);
        if (!part) part = XR.addShape?.(type, createOpts);
        if (part) return part;
      } catch (e) { console.warn('[ST.add] fail', type, e?.message || e); }
      return null;
    }
    function update(id, delta) {
      const sid = String(id || '');
      const part = get(sid);
      if (!part) return null;
      const d = delta || {};
      try {
        XR.Undo?.mutateProject?.({
          ..._ctx,
          fn: (project) => {
            const target = (project?.shapes || list()).find(s => s && s.id === sid);
            if (!target) return;
            if (d.position) { _ensureTransform(target); Object.assign(target.transform.position, d.position); }
            if (d.rotation) { _ensureTransform(target); Object.assign(target.transform.rotation, d.rotation); }
            if (d.scale) { _ensureTransform(target); Object.assign(target.transform.scale, d.scale); }
            if ('color' in d || 'baseColor' in d) target.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
            if ('name' in d) target.name = String(d.name || '');
            if ('visible' in d) target.visible = Boolean(d.visible);
            if ('uvMode' in d) target.uvMode = d.uvMode;
          }
        });
      } catch (_) {
        _ensureTransform(part);
        if (d.position) Object.assign(part.transform.position, d.position);
        if (d.rotation) Object.assign(part.transform.rotation, d.rotation);
        if (d.scale) Object.assign(part.transform.scale, d.scale);
        if ('color' in d || 'baseColor' in d) part.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
      }
      return get(sid);
    }
    function remove(id) {
      const sid = String(id || '');
      try { if (XR.SceneCommands?.deletePart) { XR.SceneCommands.deletePart(sid); return true; } } catch (_) {}
      try {
        const pro = _ctx.getProject();
        if (pro && Array.isArray(pro.shapes)) {
          const i = pro.shapes.findIndex(s => s && s.id === sid);
          if (i >= 0) pro.shapes.splice(i, 1);
          if (pro.selectedId === sid) pro.selectedId = null;
          return true;
        }
      } catch (_) {}
      return false;
    }
    function clear() {
      try {
        const ids = list().map(s => s && s.id).filter(Boolean);
        for (const id of ids) remove(id);
        try { XR.ProjectState?.setShapeList?.([]); } catch (_) {}
        try { XR.ProjectState?.setSelectedId?.(null); } catch (_) {}
        const pro = _ctx.getProject();
        if (pro) { pro.selectedId = null; if (pro.shapes) pro.shapes.length = 0; }
        return true;
      } catch (_) { return false; }
    }
    function select(id) { try { XR.Shapes?.select?.(id, { silent: false }); return true; } catch (_) { try { XR.ProjectState?.setSelectedId?.(id); return true; } catch (_) { return false; } } }
    async function undo() { try { await XR.Undo?.undoProject?.(_ctx); return true; } catch (_) { return false; } }
    async function redo() { try { await XR.Undo?.redoProject?.(_ctx); return true; } catch (_) { return false; } }
    function armUndo() { try { XR.Undo?.armProjectUndoSnapshot?.(_ctx); } catch (_) {} }
    function serialize() { try { return XR.ProjectIO?.buildProjectSavePayload?.(); } catch (_) { return null; } }
    async function load(payload) { try { if (XR.ProjectIO?.loadProjectFromPayload) { await XR.ProjectIO.loadProjectFromPayload(payload, {}); return true; } } catch (_) { return false; } }
    function setMode(m) {
      try { if (XR.TRAE?.setMode) XR.TRAE.setMode(m); else if (document?.documentElement) document.documentElement.setAttribute('data-ui-mode', String(m || 'draft3d')); } catch (_) {}
      try { if (document?.dispatchEvent) document.dispatchEvent(new CustomEvent('xr:ui-mode-changed', { detail: { mode: m } })); } catch (_) {}
    }
    const _3D = {
      get assemblyRoot() {
        try {
          const parts = list();
          for (const p of parts.slice(0, 30)) {
            let cur = p && (p._mesh || p._node || p._ref);
            let d = 0;
            while (cur && d < 60) { if ((cur?.type === 'Scene') || (cur?.isScene === true)) return cur; cur = cur.parent; d++; }
          }
        } catch (_) {}
        return null;
      },
      get camera() {
        const r = _3D.assemblyRoot;
        if (r && r.parent) {
          let cur = r.parent; let d = 0;
          while (cur && d < 40) {
            if (cur?.isCamera === true) return cur;
            if (Array.isArray(cur?.children)) for (const c of cur.children) if (c?.isCamera === true) return c;
            cur = cur.parent; d++;
          }
        }
        return null;
      },
      findMesh(partId) {
        const sid = String(partId || '');
        const root = _3D.assemblyRoot;
        if (!root || typeof root.traverse !== 'function') return null;
        let found = null;
        try { root.traverse((n) => { if (!found && n?.userData?.partId === sid) found = n; }); } catch (_) {}
        return found;
      },
      resetCamera() {
        const cam = _3D.camera;
        if (cam && typeof cam.position?.set === 'function' && typeof cam.lookAt === 'function') {
          cam.position.set(0, 1.8, 5);
          cam.lookAt(0, 0.8, 0);
          return true;
        }
        return false;
      }
    };
    return {
      TYPES,
      list, get, add, update, remove, clear, select,
      undo, redo, armUndo, serialize, load, setMode,
      autosave: () => XR.Autosave?.manager || null,
      '3d': _3D,
      _ctx,
    };
  })();
  // ========= END ST HELPER =========

  const CONFIG = {
    totalWanted: 120,
    maxEntities: 500,
    eye: 1.7,
    bounds: { x: { min: -14, max: 14 }, y: { min: 0.1, max: 4.5 }, z: { min: -14, max: 14 } },
    margin: 0.6,
  };
  const uvModes = ['cube', 'sphere', 'cylinder', 'plane'];
  const faces = ['front', 'back', 'left', 'right', 'top', 'bottom'];

  const existingCount = ST.list().length;
  const remainingBudget = Math.max(0, CONFIG.maxEntities - existingCount);
  const total = Math.min(CONFIG.totalWanted, remainingBudget);
  const zMin = CONFIG.bounds.z.min + CONFIG.margin;
  const zMax = Math.min(-2, CONFIG.bounds.z.max - CONFIG.margin);
  const xMin = CONFIG.bounds.x.min + CONFIG.margin;
  const xMax = CONFIG.bounds.x.max - CONFIG.margin;
  const yMin = CONFIG.bounds.y.min;
  const yMax = CONFIG.bounds.y.max;

  if (total < CONFIG.totalWanted) console.warn('[STRESS-OVERCLOCK] Limited by maxEntities:', CONFIG.maxEntities, 'Existing:', existingCount, 'Creating:', total);
  if (total <= 0) { console.warn('[STRESS-OVERCLOCK] ABORT: no entity budget (existing =', existingCount, ')'); return { createdCount: 0, totalEntities: existingCount, errors: ['no-budget'] }; }

  const created = [];

  if (total > 5) {
    const immersive = ST.add('D', {
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 20, y: 20, z: 1 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      name: 'Immersive Dome (Plane)',
      color: '#111111',
      uvMode: 'cube',
    });
    if (immersive) created.push(immersive);
  }

  const nonImmersiveTotal = Math.max(0, total - (created.length > 0 ? 1 : 0));
  const cols = Math.ceil(Math.sqrt(Math.max(1, nonImmersiveTotal)));
  const rows = Math.ceil(nonImmersiveTotal / Math.max(1, cols));

  console.log(`[STRESS-OVERCLOCK] Grid ${cols}x${rows} = ${nonImmersiveTotal} entities (plus ${created.length} env)`);

  for (let i = 0; i < nonImmersiveTotal; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const tX = cols <= 1 ? 0.5 : col / (cols - 1);
    const tZ = rows <= 1 ? 0.0 : row / Math.max(1, rows - 1);
    const x = xMin + tX * (xMax - xMin);
    const z = zMax + tZ * (zMin - zMax);
    const y = Math.max(yMin, Math.min(yMax, CONFIG.eye + Math.sin(i * 0.7) * 0.18));

    const tKey = i % 5 === 0 ? 'C' : (i % 2 === 0 ? 'A' : 'B');
    const scale =
      tKey === 'A' ? 0.9 + (i % 5) * 0.12 :
      tKey === 'B' ? 0.45 + (i % 4) * 0.1 :
      0.35 + (i % 3) * 0.12;

    const name = tKey === 'C' ? `Orn_${i}_${Math.random().toString(16).slice(2, 6)}` : `${ST.TYPES[tKey][0].toUpperCase() + ST.TYPES[tKey].slice(1)}_${i}`;
    const color = tKey === 'B' ? '#007AFF' : tKey === 'A' ? '#1a1a1a' : '#999999';

    const ent = ST.add(tKey, {
      position: { x, y, z },
      scale: { x: scale, y: scale, z: scale },
      name,
      color,
      uvMode: uvModes[i % uvModes.length],
    });
    if (ent) created.push(ent);
    if (i % 12 === 0) await new Promise(requestAnimationFrame);
  }

  // Post-create bulk mutations
  const entitiesNow = ST.list();
  const windows = entitiesNow.filter(e => e && ST.get(e.id) && !e._skip);
  const cubes = windows.filter(e => { const t = e.type || (e.archetype && e.archetype.id) || ''; return t === 'cube' || t === ST.TYPES.A; });
  const cylinders = windows.filter(e => { const t = e.type || (e.archetype && e.archetype.id) || ''; return t === 'cylinder' || t === ST.TYPES.B; });
  const spheres = windows.filter(e => { const t = e.type || (e.archetype && e.archetype.id) || ''; return t === 'sphere' || t === ST.TYPES.C; });

  // Mutation 1: cylinder scale wiggle
  for (let i = 0; i < cylinders.length; i++) {
    const id = cylinders[i].id;
    if (i % 50 === 0) {
      const s = 0.5 + (i % 4) * 0.1;
      ST.update(id, { scale: { x: s, y: s * 1.6, z: s } });
    }
    if (i % 40 === 0) await new Promise(requestAnimationFrame);
  }

  // Mutation 2: cube rotation batch
  for (let i = 0; i < cubes.length; i++) {
    if (i % 3 !== 0) continue;
    ST.update(cubes[i].id, {
      rotation: { x: 0, y: ((i % 12) * Math.PI) / 6, z: 0 },
      uvMode: uvModes[i % uvModes.length],
    });
    if (i % 25 === 0) await new Promise(requestAnimationFrame);
  }

  // Fire real custom events (3 XReate events, not 11)
  try { window.dispatchEvent(new CustomEvent('xr:project-changed', { detail: { project: ST._ctx.getProject() } })); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('xr:project-selection-changed', { detail: { selectedId: null, project: ST._ctx.getProject() } })); } catch (_) {}
  try { document.dispatchEvent(new CustomEvent('xr:ui-mode-changed', { detail: { mode: 'draft3d' } })); } catch (_) {}

  ST.armUndo();

  // Selection sweep
  const pickIds = entitiesNow.filter(e => e && e.id).slice(0, Math.min(80, entitiesNow.length)).map(e => e.id);
  for (let i = 0; i < pickIds.length; i++) {
    ST.select(pickIds[i]);
    if (i % 20 === 0) await new Promise(requestAnimationFrame);
  }
  ST.select(null);

  // Visibility toggle via XR.SceneCommands
  const hideIds = entitiesNow.filter(e => e && e.id).slice(0, Math.min(50, entitiesNow.length)).map(e => e.id);
  for (let idx = 0; idx < hideIds.length; idx++) {
    if (idx % 5 === 0) {
      try { XR.SceneCommands?.setPartVisibility?.(hideIds[idx], false); }
      catch (_) { try { ST.update(hideIds[idx], { visible: false }); } catch (_) {} }
    }
  }
  await new Promise(requestAnimationFrame);
  for (let idx = 0; idx < hideIds.length; idx++) {
    if (idx % 5 === 0) {
      try { XR.SceneCommands?.setPartVisibility?.(hideIds[idx], true); }
      catch (_) { try { ST.update(hideIds[idx], { visible: true }); } catch (_) {} }
    }
  }

  // Massive rotation + color mutation
  const targetForMutation = entitiesNow.filter(e => { const t = e.type || (e.archetype && e.archetype.id) || ''; return t !== 'plane' && t !== ST.TYPES.D; }).slice(0, Math.min(120, entitiesNow.length));
  for (let i = 0; i < targetForMutation.length; i++) {
    ST.update(targetForMutation[i].id, {
      rotation: { x: 0, y: ((i % 12) * Math.PI) / 6, z: 0 },
      baseColor: `hsl(${(i * 13) % 360}, 70%, 55%)`,
    });
    if (i % 30 === 0) await new Promise(requestAnimationFrame);
  }

  try { ST.armUndo(); } catch (_) {}
  try { await ST.undo(); } catch (_) {}
  try { await ST.redo(); } catch (_) {}

  ST['3d'].resetCamera();

  const count = ST.list().length;
  console.log(`[STRESS-OVERCLOCK] Created: ${created.length}, Total shapes now: ${count}, Volumes(cyl): ${cylinders.length}, Cubes: ${cubes.length}, Spheres: ${spheres.length}`);
  console.table?.([
    { metric: 'Budget wanted', value: CONFIG.totalWanted },
    { metric: 'Created successfully', value: created.length },
    { metric: 'Total live shapes', value: count },
    { metric: 'Cubes mutated', value: cubes.filter((_, i) => i % 3 === 0).length },
  ]);

  const RESULT = { createdCount: created.length, totalEntities: count, cubes: cubes.length, cylinders: cylinders.length, spheres: spheres.length };
  try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.oclk = RESULT; } catch (_) {}
  return RESULT;
})();
