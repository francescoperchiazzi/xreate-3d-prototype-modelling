/**
 * XReate UI44 - User Simulation Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH imports -> ST helper (window.XR runtime)
 *   - typeA/B/C/D -> cube / cylinder / sphere / plane (4 real archetypes)
 *   - Entities API -> ST.list/add/get/update/remove/clear
 *   - EventBus/connectAllEntities/MeshRegistryAPI -> REMOVED (no such features)
 *   - saveSceneState/loadSceneState/getPlaylist -> in-memory payload array
 *     using XR.ProjectIO.buildProjectSavePayload / loadProjectFromPayload
 *   - saveActionState/undoAction/redoAction -> XR.Undo via ST.undo/redo/armUndo
 *   - window.scene / camera / renderer -> ST._XR3D (traverse-up from any mesh)
 * Sections REMOVED: connections topology, playlist manager, event-bus publish, mesh registry direct access
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 */

(async () => {
  console.log('%c[USER-SIM] Starting High-Stress Prototype Validation...', 'color: #00ff00; font-weight: bold; font-size: 14px;');

  // ============================================================
  // SHARED ST HELPER BOILERPLATE — paste at top of EVERY harness
  // ============================================================
  const ST = (() => {
    const TYPES = {
      A: 'cube',
      B: 'cylinder',
      C: 'sphere',
      D: 'plane',
    };
    const _refs = { projectUndoArmed: false, projectUndoArmTimer: null };
    const XR = (typeof window !== 'undefined') ? (window.XR || {}) : {};

    const _ctx = {
      get project() { return XR.ProjectState?.getProject?.() || XR.getProject?.() || null; },
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.()
        || XR.ProjectIO?.buildProjectSavePayload?.()
        || null,
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

    function _ensureTransform(part) {
      if (!part) return null;
      if (!part.transform) part.transform = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
      if (!part.transform.position) part.transform.position = { x: 0, y: 0, z: 0 };
      if (!part.transform.rotation) part.transform.rotation = { x: 0, y: 0, z: 0 };
      if (!part.transform.scale) part.transform.scale = { x: 1, y: 1, z: 1 };
      return part;
    }

    function list() {
      try { return XR.Shapes?.list?.() || XR.ProjectState?.getShapeList?.() || XR.getShapes?.() || []; }
      catch (_) { return []; }
    }

    function get(id) {
      const sid = String(id || '');
      try { return XR.Shapes?.getById?.(sid) || XR.ProjectState?.getShapeById?.(sid) || list().find(s => s && s.id === sid) || null; }
      catch (_) { return list().find(s => s && s.id === sid) || null; }
    }

    function add(typeId, opts) {
      const type = typeId in TYPES ? TYPES[typeId] : (String(typeId || '') || 'cube');
      const options = opts || {};
      const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
      const defaultPos = options.position || { x: 0, y: (0.5 + Math.random() * 1.5), z: -2 };
      const defaultScale = options.scale || { x: 1, y: 1, z: 1 };
      const defaultRot = options.rotation || { x: 0, y: 0, z: 0 };
      const createOpts = {
        id: options.id || undefined,
        name: options.name || `Stress_${type}_${Date.now().toString(36)}`,
        color: options.color || null,
        position: defaultPos,
        scale: defaultScale,
        rotation: defaultRot,
        layers: Array.isArray(options.layers) ? options.layers : null,
        uvMode: options.uvMode || null,
      };
      try {
        let part = null;
        if (arch) part = XR.addPartFromArchetype?.(arch, createOpts);
        if (!part) part = XR.Shapes?.add?.(type, createOpts);
        if (!part) part = XR.addShape?.(type, createOpts);
        if (part) {
          try { XR.Shapes?.select?.(part.id, { silent: true }); } catch (_) {}
          return part;
        }
      } catch (e) {
        console.warn('[ST.add] failed for', type, e);
      }
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
            if ('position' in d && d.position) {
              _ensureTransform(target);
              Object.assign(target.transform.position, d.position);
            }
            if ('rotation' in d && d.rotation) {
              _ensureTransform(target);
              Object.assign(target.transform.rotation, d.rotation);
            }
            if ('scale' in d && d.scale) {
              _ensureTransform(target);
              Object.assign(target.transform.scale, d.scale);
            }
            if ('color' in d || 'baseColor' in d) target.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
            if ('name' in d) target.name = String(d.name || '');
            if ('visible' in d) target.visible = Boolean(d.visible);
            if ('locked' in d) target.locked = Boolean(d.locked);
            if ('uvMode' in d) target.uvMode = d.uvMode;
            if ('layers' in d) target.layers = d.layers;
            if ('opacity' in d && typeof d.opacity === 'number' && target.transform) {
              target._opacityHint = d.opacity;
            }
          }
        });
      } catch (_) {
        _ensureTransform(part);
        if ('position' in d && d.position) Object.assign(part.transform.position, d.position);
        if ('rotation' in d && d.rotation) Object.assign(part.transform.rotation, d.rotation);
        if ('scale' in d && d.scale) Object.assign(part.transform.scale, d.scale);
        if ('color' in d || 'baseColor' in d) part.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
        if ('name' in d) part.name = String(d.name || '');
      }
      return get(sid);
    }

    function remove(id) {
      const sid = String(id || '');
      try {
        if (XR.SceneCommands?.deletePart) {
          XR.SceneCommands.deletePart(sid);
          return true;
        }
        const pro = _ctx.getProject();
        if (pro && Array.isArray(pro.shapes)) {
          const idx = pro.shapes.findIndex(s => s && s.id === sid);
          if (idx >= 0) pro.shapes.splice(idx, 1);
          if (pro.selectedId === sid) pro.selectedId = null;
          return true;
        }
      } catch (e) { console.warn('[ST.remove] failed', e); }
      return false;
    }

    function clear() {
      try {
        const ids = list().map(s => s && s.id).filter(Boolean);
        for (const id of ids) remove(id);
        try { XR.ProjectState?.setShapeList?.([]); } catch (_) {}
        try { XR.ProjectState?.setSelectedId?.(null); } catch (_) {}
        const pro = _ctx.getProject();
        if (pro) {
          pro.selectedId = null;
          if (pro.shapes) pro.shapes.length = 0;
        }
        return true;
      } catch (e) { console.warn('[ST.clear] failed', e); return false; }
    }

    function select(id) {
      try { XR.Shapes?.select?.(id, { silent: false }); return true; }
      catch (_) { try { XR.ProjectState?.setSelectedId?.(id); return true; } catch (_) { return false; } }
    }

    async function undo() { try { await XR.Undo?.undoProject?.(_ctx); return true; } catch (_) { return false; } }
    async function redo() { try { await XR.Undo?.redoProject?.(_ctx); return true; } catch (_) { return false; } }
    function armUndo() { try { XR.Undo?.armProjectUndoSnapshot?.(_ctx); } catch (_) {} }

    function serialize() { try { return XR.ProjectIO?.buildProjectSavePayload?.(); } catch (_) { return null; } }
    async function load(payload) { try { if (XR.ProjectIO?.loadProjectFromPayload) { await XR.ProjectIO.loadProjectFromPayload(payload, {}); return true; } } catch (e) { console.warn('[ST.load] failed', e); } return false; }

    function setMode(m) { try { if (XR.TRAE?.setMode) XR.TRAE.setMode(m); else if (document?.documentElement?.setAttribute) document.documentElement.setAttribute('data-ui-mode', String(m || 'draft3d')); } catch (_) {} }

    const _3D = {
      get assemblyRoot() {
        try {
          const parts = list();
          for (const p of parts.slice(0, 20)) {
            let cur = p && (p._mesh || p._node || p._ref);
            let depth = 0;
            while (cur && depth < 50) {
              const typeCheck = cur?.type || cur?.isScene;
              if (typeCheck === 'Scene' || cur?.isScene === true) return cur;
              cur = cur.parent;
              depth++;
            }
          }
        } catch (_) {}
        return null;
      },
      get camera() {
        const root = _3D.assemblyRoot;
        if (root && root.parent) {
          let cur = root.parent;
          let depth = 0;
          while (cur && depth < 30) {
            if (cur?.isCamera === true) return cur;
            if (cur?.children && Array.isArray(cur.children)) {
              for (const c of cur.children) if (c?.isCamera === true) return c;
            }
            cur = cur.parent;
            depth++;
          }
        }
        return null;
      },
      get renderer() {
        try {
          const canvas = document?.querySelector?.('canvas');
          if (canvas && canvas.__renderer) return canvas.__renderer;
        } catch (_) {}
        return null;
      },
      findMesh(partId) {
        const sid = String(partId || '');
        const root = _3D.assemblyRoot;
        if (!root || typeof root.traverse !== 'function') return null;
        let found = null;
        try {
          root.traverse((node) => {
            if (!found && node?.userData?.partId === sid) found = node;
          });
        } catch (_) {}
        return found;
      },
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
  // ============================================================
  // END SHARED ST HELPER
  // ============================================================

  // 2. Configuration
  const uvModes = ['cube', 'sphere', 'cylinder', 'plane'];
  const colors = ['#007AFF', '#FF3B30', '#34C759', '#5856D6', '#FF9500', '#AF52DE'];

  // 3. Reset State
  console.log('[USER-SIM] Clearing existing shapes and preparing in-memory payload stash...');
  ST.clear();
  await new Promise(r => requestAnimationFrame(r));

  // 4. Build 10 Prototype "scenes" (payload snapshots, since XReate has no playlist)
  const totalScenes = 10;
  const payloadStash = [];

  for (let sceneIdx = 0; sceneIdx < totalScenes; sceneIdx++) {
    console.log(`%c[USER-SIM] Building Scene ${sceneIdx + 1}/${totalScenes}...`, 'color: cyan');
    ST.clear();

    // 4.1 Immersive Environment (Every 3rd scene) — use typeD = plane as floor/base
    if (sceneIdx % 3 === 0) {
      ST.add('D', {
        position: { x: 0, y: 0, z: 0 },
        scale: { x: 10, y: 10, z: 1 },
        rotation: { x: -Math.PI / 2, y: 0, z: 0 },
        name: `Environment ${sceneIdx}`,
        color: '#111111',
        uvMode: uvModes[sceneIdx % uvModes.length],
      });
    }

    // 4.2 Main Application Window (Central Hub) — typeA = cube
    const mainVariant = uvModes[sceneIdx % uvModes.length];
    const mainEntity = ST.add('A', {
      position: { x: 0, y: 1.5, z: -2.0 },
      scale: { x: 2.0, y: 2.0, z: 2.0 },
      name: `Main Shape - ${mainVariant}`,
      color: '#ffffff',
      uvMode: mainVariant,
    });
    if (mainEntity) {
      ST.update(mainEntity.id, {
        baseColor: colors[sceneIdx % colors.length],
        uvMode: mainVariant,
      });
    }

    // 4.3 Sidebar Volumes (Tools/Controls) — typeB = cylinder, curved layout
    const volumeCount = 4 + (sceneIdx % 3);
    for (let i = 0; i < volumeCount; i++) {
      const angle = -0.5 + (i / Math.max(1, volumeCount - 1));
      const x = Math.sin(angle) * 2.5;
      const z = -2.0 + Math.cos(angle) * 0.5;
      ST.add('B', {
        position: { x, y: 1.2, z },
        scale: { x: 0.4, y: 0.4, z: 0.4 },
        name: `Tool ${i}`,
        color: colors[i % colors.length],
      });
    }

    // 4.4 Ornaments (Badges/Status Indicators) — typeC = sphere, helix layout
    const ornamentCount = 5 + sceneIdx;
    for (let i = 0; i < ornamentCount; i++) {
      const t = ornamentCount <= 1 ? 0.5 : (i / (ornamentCount - 1));
      const x = Math.cos(t * Math.PI * 4) * 3;
      const y = 1.0 + t * 2;
      const z = Math.sin(t * Math.PI * 4) * 3;
      ST.add('C', {
        position: { x, y, z },
        scale: { x: 0.25, y: 0.25, z: 0.25 },
        name: `Status ${i}`,
        color: '#FFD60A',
      });
    }

    await new Promise(r => requestAnimationFrame(r));

    // 4.5 Simulate User Interaction
    if (mainEntity) {
      ST.select(mainEntity.id);
      ST.update(mainEntity.id, { position: { x: 0.2, y: 1.6, z: -1.9 } });
      try {
        ST.armUndo();
        ST.update(mainEntity.id, { position: { x: 0.4, y: 1.8, z: -1.8 } });
        await new Promise(r => setTimeout(r, 50));
        await ST.undo();
        await new Promise(r => setTimeout(r, 50));
        await ST.redo();
      } catch (e) { console.warn('[USER-SIM] History stress iteration', sceneIdx, 'failed', e); }
      ST.select(null);
    }

    // 4.7 Save Scene = stash serialize payload
    const payload = ST.serialize();
    if (payload) {
      payloadStash.push({ name: `Scene ${sceneIdx + 1}`, payload });
      console.log(`[USER-SIM] Stashed payload Scene ${sceneIdx + 1}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // 5. Payload Playback Stress Test (roundtrip load from stash)
  console.log('%c[USER-SIM] Starting Payload Playback Sequence...', 'color: yellow');
  const errors = [];

  if (payloadStash.length > 0) {
    for (let i = 0; i < payloadStash.length; i++) {
      const snap = payloadStash[i];
      console.log(`[USER-SIM] Loading Scene ${i + 1}/${payloadStash.length}: ${snap.name}`);
      const beforeCount = ST.list().length;
      const ok = await ST.load(snap.payload);
      await new Promise(r => setTimeout(r, 300));
      const afterCount = ST.list().length;
      const expected = (snap.payload?.project?.shapes || []).length;
      if (!ok) errors.push(`load failed for ${snap.name}`);
      if (afterCount !== expected) errors.push(`${snap.name}: after load shapes=${afterCount} vs expected=${expected} (before=${beforeCount})`);

      try {
        window.dispatchEvent(new CustomEvent('xr:project-changed', { detail: { project: ST._ctx.getProject() } }));
      } catch (_) {}
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 6. Final Report
  const endCount = ST.list().length;
  console.log(`%c[USER-SIM] Test Complete.`, 'color: #00ff00; font-weight: bold; font-size: 16px;');
  console.log(`[USER-SIM] Total scenes (payloads) created/stashed: ${payloadStash.length}`);
  console.log(`[USER-SIM] Final scene shape count: ${endCount}`);
  if (errors.length > 0) {
    console.error('[USER-SIM] ERRORS:', errors.length);
    errors.forEach(e => console.error('  -', e));
  } else {
    console.log('[USER-SIM] All roundtrip loads matched expected shape counts.');
  }
  console.table?.([
    { metric: 'Scenes', value: payloadStash.length },
    { metric: 'Final shapes', value: endCount },
    { metric: 'Load errors', value: errors.length },
  ]);

  const RESULT = {
    status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
    scenesCreated: payloadStash.length,
    finalEntityCount: endCount,
    errors,
  };
  try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.usim = RESULT; } catch (_) {}
  return RESULT;
})();
