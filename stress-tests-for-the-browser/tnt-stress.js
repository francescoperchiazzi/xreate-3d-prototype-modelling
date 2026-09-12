/**
 * XReate UI44 - TNT Stress Test (Total Numbing Turbulence)
 * Adapted / Renamed: 2026-09-02 (originally named "flood" template; renamed to match INVENTORY.md "tnt-stress-test.js")
 *
 * Mapped placeholders:
 *   - 11 module imports (entities/config/eventBus/mesh-registry/selection/stateManager/history/connections/sceneManager/tensegrity/camera) -> REMOVED entirely.
 *   - window.scene + window.renderer -> ST.3d helpers (assemblyRoot traverse; renderer via canvas.__renderer or null)
 *   - AppConfig (bounds, maxEntities, userEyeLevel) -> local CONFIG constants.
 *   - EventBus.publish(EVENT_A..K) x dozens -> 3 real CustomEvents (xr:project-changed / selection-changed / ui-mode-changed) fired every N ticks.
 *   - connectAllEntities / refreshOptionalLayer / toggleOptionalLayer / isOptionalLayerActive -> REMOVED (no connections/tensegrity/optional-layer in XReate).
 *   - saveSceneState / loadSceneState / getPlaylist / clearPlaylist -> REMOVED (no playlist system).
 *   - MeshRegistryAPI / stateManager / resetCamera -> ST.3d.findMesh / XR.SceneCommands.setPartVisibility / ST.3d.resetCamera.
 *   - formatVariant / badges / AssetManager / textureURL / isFallbackMap -> REMOVED (no such features).
 *   - window.__appAutosaveManager -> XR.Autosave.manager
 *   - typeA/B/C/D -> cube/cylinder/sphere/plane
 * Sections REMOVED from original flood:
 *   - All imports block, scene save/load every N ticks, tensegrity optional-layer every 6 ticks, connections every 10 ticks.
 * Preserved original flood intent / signature behavior:
 *   - window.__STRESS_STOP boolean flag to halt; window.__STRESS_CONFIG for overrides.
 *   - One-shot entity flood fill to targetMax (grid layout).
 *   - Continuous loop for durationMs with random weighted tick actions (insert / mutate / select / visibility / undo-redo / autosave / custom-event / resize).
 *   - Memory bomb allocator every N ticks to detect leaks (configurable size).
 *   - JS error / unhandledrejection listeners -> array catch.
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Optional: set `window.__STRESS_CONFIG = { durationMs: 30000, targetMax: 60 }` before running.
 *   4. Paste this entire script and press Enter.
 *   5. Stop early at any time: `window.__STRESS_STOP = true`
 *   DEFAULTS (safe for QA): durationMs=45000 (45s), targetMax=80 entities, tickMs=20
 */

(async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (predicate, timeoutMs = 15000, tickMs = 60) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      try { if (predicate()) return true; } catch {}
      await delay(tickMs);
    }
    return false;
  };

  const errors = [];
  const onError = (event) => {
    errors.push({
      type: 'error',
      message: event?.message,
      filename: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno,
      stack: String(event?.error?.stack || '').slice(0, 300),
    });
  };
  const onRejection = (event) => {
    const reason = event?.reason;
    let msg;
    if (!reason) msg = String(reason);
    else if (typeof reason === 'string') msg = reason;
    else if (typeof reason?.message === 'string') msg = reason.message;
    else try { msg = JSON.stringify(reason).slice(0, 300); } catch (_) { msg = String(reason).slice(0, 300); }
    errors.push({ type: 'unhandledrejection', message: msg, stack: String(reason?.stack || '').slice(0, 300) });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  // Stop flag (configurable external)
  window.__STRESS_STOP = false;

  const defaults = {
    durationMs: 45000,
    tickMs: 20,
    targetMax: null,
    autosaveEvery: 220,
    customEventEvery: 14,
    selectEvery: 7,
    visibilityEvery: 9,
    insertEvery: 110,
    mutateEvery: 2,
    undoRedoEvery: 180,
    memoryBombEvery: 900,
    memoryBombBytes: 1_500_000,
    maxEntitiesHardCap: 320,
    eye: 1.7,
    bounds: { x: { min: -14, max: 14 }, y: { min: 0.1, max: 4.5 }, z: { min: -14, max: 14 } },
  };
  const config = Object.assign({}, defaults, (window.__STRESS_CONFIG || {}));

  console.log('%c[TNT-STRESS] ARMED', 'color:#ff3860;font-weight:800');
  console.log('[TNT-STRESS] Stop anytime:  window.__STRESS_STOP = true');
  console.log('[TNT-STRESS] Config (merge defaults + window.__STRESS_CONFIG):', config);

  // ========= SHARED ST HELPER =========
  const ST = (() => {
    const TYPES = { A:'cube', B:'cylinder', C:'sphere', D:'plane' };
    const _refs = { projectUndoArmed:false, projectUndoArmTimer:null };
    const XR = (typeof window !== 'undefined') ? (window.XR||{}) : {};
    const _ctx = {
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.() || XR.ProjectIO?.buildProjectSavePayload?.() || null,
      loadProjectFromPayload: (p, o) => (XR.ProjectIO?.loadProjectFromPayload?.(p, o||{})),
      getUndoMaxSteps: () => (XR.Undo?.getUndoMaxSteps?.() ?? 20),
      gcUndoAssets: () => {}, setStatusKey: () => {}, setStatus: () => {}, tr: s => String(s||''),
      refs: _refs,
      pushProjectUndoSnapshot: () => XR.Undo?.pushProjectUndoSnapshot?.(_ctx),
      armProjectUndoSnapshot: () => XR.Undo?.armProjectUndoSnapshot?.(_ctx),
    };
    function _et(p) {
      if (!p) return null;
      if (!p.transform) p.transform = { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} };
      if (!p.transform.position) p.transform.position = {x:0,y:0,z:0};
      if (!p.transform.rotation) p.transform.rotation = {x:0,y:0,z:0};
      if (!p.transform.scale) p.transform.scale = {x:1,y:1,z:1};
      return p;
    }
    function list() { try { return XR.Shapes?.list?.() || XR.ProjectState?.getShapeList?.() || XR.getShapes?.() || []; } catch(_){ return []; } }
    function get(id) {
      const sid = String(id||'');
      try { return XR.Shapes?.getById?.(sid) || XR.ProjectState?.getShapeById?.(sid) || list().find(s=>s&&s.id===sid) || null; } catch(_){ return list().find(s=>s&&s.id===sid)||null; }
    }
    function add(typeId, opts) {
      const type = typeId in TYPES ? TYPES[typeId] : (String(typeId||'')||'cube');
      const o = opts || {};
      const pos = o.position || {x:0,y:1,z:-2}; const sca = o.scale||{x:1,y:1,z:1}; const rot = o.rotation||{x:0,y:0,z:0};
      const cr = { id: o.id, name: o.name||`TNT_${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
      try {
        const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
        let part = arch ? (XR.addPartFromArchetype?.(arch, cr) || null) : null;
        if (!part) part = XR.Shapes?.add?.(type, cr);
        if (!part) part = XR.addShape?.(type, cr);
        return part || null;
      } catch(_) { return null; }
    }
    function update(id, delta) {
      const sid = String(id||''); const p = get(sid); if (!p) return null; const d = delta||{};
      try {
        XR.Undo?.mutateProject?.({ ..._ctx, fn:(proj)=>{
          const t = (proj?.shapes||list()).find(s=>s&&s.id===sid); if (!t) return;
          if (d.position) { _et(t); Object.assign(t.transform.position, d.position); }
          if (d.rotation) { _et(t); Object.assign(t.transform.rotation, d.rotation); }
          if (d.scale) { _et(t); Object.assign(t.transform.scale, d.scale); }
          if ('color' in d || 'baseColor' in d) t.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
          if ('name' in d) t.name = String(d.name||'');
          if ('visible' in d) t.visible = Boolean(d.visible);
          if ('locked' in d) t.locked = Boolean(d.locked);
          if ('uvMode' in d) t.uvMode = d.uvMode;
        }});
      } catch(_) {
        _et(p);
        if (d.position) Object.assign(p.transform.position, d.position);
        if (d.rotation) Object.assign(p.transform.rotation, d.rotation);
        if (d.scale) Object.assign(p.transform.scale, d.scale);
        if ('color' in d || 'baseColor' in d) p.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
      }
      return get(sid);
    }
    function remove(id) {
      const sid = String(id||'');
      try { if (XR.SceneCommands?.deletePart) { XR.SceneCommands.deletePart(sid); return true; } } catch(_) {}
      try {
        const pro = _ctx.getProject();
        if (pro && Array.isArray(pro.shapes)) {
          const i = pro.shapes.findIndex(s=>s&&s.id===sid);
          if (i>=0) pro.shapes.splice(i,1);
          if (pro.selectedId === sid) pro.selectedId = null;
          return true;
        }
      } catch(_) {}
      return false;
    }
    function clear() {
      try {
        const ids = list().map(s=>s&&s.id).filter(Boolean);
        for (const id of ids) try { remove(id); } catch(_){}
        try { XR.ProjectState?.setShapeList?.([]); } catch(_){}
        try { XR.ProjectState?.setSelectedId?.(null); } catch(_){}
        const pro = _ctx.getProject();
        if (pro) { pro.selectedId = null; if (pro.shapes) pro.shapes.length = 0; }
        return true;
      } catch(_) { return false; }
    }
    function select(id) { try { XR.Shapes?.select?.(id, {silent:false}); return true; } catch(_) { try { XR.ProjectState?.setSelectedId?.(id); return true; } catch(_){ return false; } } }
    function armUndo() { try { XR.Undo?.armProjectUndoSnapshot?.(_ctx); } catch(_) {} }
    async function undo() { try { await XR.Undo?.undoProject?.(_ctx); return true; } catch(_) { return false; } }
    async function redo() { try { await XR.Undo?.redoProject?.(_ctx); return true; } catch(_) { return false; } }
    function setMode(m) {
      try { if (XR.TRAE?.setMode) XR.TRAE.setMode(m); else if (document?.documentElement) document.documentElement.setAttribute('data-ui-mode', String(m||'draft3d')); } catch(_) {}
      try { if (document?.dispatchEvent) document.dispatchEvent(new CustomEvent('xr:ui-mode-changed', {detail:{mode:m}})); } catch(_) {}
    }
    const _3D = {
      get assemblyRoot() {
        try {
          const parts = list().slice(0,40);
          for (const p of parts) {
            let cur = p && (p._mesh || p._node || p._ref);
            let d=0; while(cur && d<70) { if ((cur.type==='Scene')||(cur.isScene===true)) return cur; cur = cur.parent; d++; }
          }
        } catch(_) {}
        return null;
      },
      get camera() {
        const r = this.assemblyRoot;
        if (r && r.parent) {
          let cur = r.parent; let d=0;
          while (cur && d<50) {
            if (cur?.isCamera === true) return cur;
            if (Array.isArray(cur?.children)) for (const c of cur.children) if (c?.isCamera === true) return c;
            cur = cur.parent; d++;
          }
        }
        return null;
      },
      get renderer() {
        try { const canvas = document?.querySelector?.('canvas'); if (canvas && canvas.__renderer) return canvas.__renderer; } catch(_) {}
        return null;
      },
      findMesh(partId) {
        const sid = String(partId||'');
        const root = this.assemblyRoot;
        if (!root || typeof root.traverse !== 'function') return null;
        let found = null;
        try { root.traverse(n => { if (!found && n?.userData?.partId === sid) found = n; }); } catch(_) {}
        return found;
      },
      resetCamera() {
        const cam = this.camera;
        if (cam && typeof cam.position?.set === 'function' && typeof cam.lookAt === 'function') {
          cam.position.set(0, 1.8, 5);
          cam.lookAt(0, 0.8, 0);
          return true;
        }
        return false;
      }
    };
    const autosaveManager = () => {
      try {
        if (typeof XR.Autosave?.ensureManager === 'function') {
          const m = XR.Autosave.ensureManager();
          if (m) return m;
        }
      } catch (_) {}
      return XR.Autosave?.manager || null;
    };
    return { TYPES, list, get, add, update, remove, clear, select, armUndo, undo, redo, setMode, '3d':_3D, autosaveManager, _ctx };
  })();
  // ========= END ST HELPER =========

  // Wait for at least the XR namespace
  const xrReady = await waitFor(() => !!(window.XR && (typeof window.XR.Shapes?.list === 'function' || typeof window.XR.getShapes === 'function')), 18000, 80);
  if (!xrReady) {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    throw new Error('[TNT-STRESS] XR runtime not ready within timeout. Open the editor page.');
  }

  // Hard cap targetMax
  if (config.targetMax == null) config.targetMax = Math.min(80, config.maxEntitiesHardCap);
  config.targetMax = Math.min(config.targetMax, config.maxEntitiesHardCap);

  // ---- FLOOD FILL ----
  console.log(`[TNT-STRESS] Phase A: flood fill to targetMax=${config.targetMax} shapes...`);
  ST.clear();
  try { const pro = ST._ctx.getProject(); if (pro) { pro._undoStack = []; pro._redoStack = []; } } catch(_) {}
  await delay(80);

  const targetMax = config.targetMax;
  const margin = 0.8;
  const xMin = config.bounds.x.min + margin, xMax = config.bounds.x.max - margin;
  const zMin = config.bounds.z.min + margin;
  const zMax = Math.min(-2, config.bounds.z.max - margin);
  const yMin = config.bounds.y.min, yMax = config.bounds.y.max;
  const cols = Math.ceil(Math.sqrt(targetMax));
  const rows = Math.max(1, Math.ceil(targetMax / Math.max(1, cols)));

  for (let i = 0; i < targetMax; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const tX = cols <= 1 ? 0.5 : col / (cols - 1);
    const tZ = rows <= 1 ? 0.0 : row / Math.max(1, rows - 1);
    const x = xMin + tX * (xMax - xMin);
    const z = zMax + tZ * (zMin - zMax);
    const y = Math.max(yMin, Math.min(yMax, config.eye + Math.sin(i * 0.7) * 0.22));
    const tKey = (i % 9 === 0) ? 'C' : (i % 2 === 0 ? 'A' : 'B');
    const color = tKey === 'B' ? '#007AFF' : tKey === 'A' ? '#1a1a1a' : '#FFD60A';
    const scale = tKey === 'A' ? (0.9 + (i % 4) * 0.1) : tKey === 'B' ? (0.4 + (i % 5) * 0.09) : (0.3 + (i % 3) * 0.08);
    ST.add(tKey, { position:{x,y,z}, scale:{x:scale,y:scale,z:scale}, color, name:`tnt_${i}`, uvMode: (['cube','sphere','cylinder','plane'])[i % 4] });
    if (i % 25 === 0) await delay(0);
  }

  // One env plane (type D) as floor
  ST.add('D', { position:{x:0,y:0,z:0}, scale:{x:20,y:20,z:1}, rotation:{x:-Math.PI/2,y:0,z:0}, color:'#101010', name:'TNT_FLOOR' });
  await delay(250);
  console.log(`[TNT-STRESS] Phase A done. Live shapes: ${ST.list().length}.`);
  ST['3d'].resetCamera();

  // ---- CONTINUOUS TURBULENCE LOOP ----
  console.log(`[TNT-STRESS] Phase B: turbulence for ${config.durationMs}ms. Set window.__STRESS_STOP=true to abort.`);
  const startTs = performance.now();
  let tick = 0;
  let inserts = 0, deletes = 0, mutations = 0, selects = 0, visibilityToggles = 0, autosaves = 0, customEvents = 0, undos = 0, redos = 0, memoryBombs = 0, resizes = 0;
  const bombAllocs = []; // keep references so not GC'd (memory pressure intended)

  while (!window.__STRESS_STOP) {
    tick++;
    const now = performance.now();
    if (now - startTs >= config.durationMs) break;

    // weighted tick actions
    const ids = ST.list().map(s => s && s.id).filter(Boolean);
    const r = Math.random();

    if ((tick % config.mutateEvery) === 0 && ids.length > 0) {
      mutations++;
      const id = ids[Math.floor(Math.random() * ids.length)];
      const kind = Math.floor(Math.random() * 5);
      if (kind === 0) ST.update(id, { position: { x: (Math.random()*20)-10, y: 0.3 + Math.random()*4, z: -1.5 - Math.random()*11 } });
      else if (kind === 1) ST.update(id, { rotation: { x: (Math.random()*0.6)-0.3, y: Math.random()*Math.PI*2, z: (Math.random()*0.6)-0.3 } });
      else if (kind === 2) { const s = 0.25 + Math.random()*1.4; ST.update(id, { scale: { x:s, y:s, z:s } }); }
      else if (kind === 3) ST.update(id, { baseColor: `hsl(${Math.floor(Math.random()*360)}, 70%, ${40 + Math.floor(Math.random()*40)}%)` });
      else ST.update(id, { uvMode: (['cube','sphere','cylinder','plane'])[Math.floor(Math.random()*4)] });
    }

    if ((tick % config.insertEvery) === 0 && ST.list().length < config.maxEntitiesHardCap) {
      inserts++;
      const tKey = (Math.random() < 0.5) ? 'A' : (Math.random() < 0.5 ? 'B' : 'C');
      ST.add(tKey, {
        position: { x: (Math.random()*24)-12, y: 0.3+Math.random()*4.2, z: -1 - Math.random()*13 },
        scale: { x:0.3+Math.random()*1.3, y:0.3+Math.random()*1.3, z:0.3+Math.random()*1.3 },
        color: `hsl(${Math.floor(Math.random()*360)},65%,55%)`,
      });
    }

    if ((tick % Math.max(2, config.insertEvery * 2 + 1)) === 0 && Math.random() < 0.35 && ids.length > Math.max(5, targetMax * 0.4)) {
      deletes++;
      const id = ids[Math.floor(Math.random() * ids.length)];
      ST.armUndo();
      ST.remove(id);
    }

    if ((tick % config.selectEvery) === 0 && ids.length > 0) {
      selects++;
      ST.select(ids[Math.floor(Math.random() * ids.length)]);
      if ((selects % 17) === 0) ST.select(null);
    }

    if ((tick % config.visibilityEvery) === 0 && ids.length > 0) {
      visibilityToggles++;
      const id = ids[Math.floor(Math.random() * ids.length)];
      const on = Math.random() < 0.5;
      try { if (window.XR?.SceneCommands?.setPartVisibility) XR.SceneCommands.setPartVisibility(id, !!on); else ST.update(id, { visible: !!on }); } catch(_) {}
    }

    if ((tick % config.customEventEvery) === 0) {
      customEvents++;
      const kind = tick % 3;
      try {
        if (kind === 0) window.dispatchEvent(new CustomEvent('xr:project-changed', { detail: { project: ST._ctx.getProject() } }));
        else if (kind === 1) window.dispatchEvent(new CustomEvent('xr:project-selection-changed', { detail: { selectedId: ST._ctx.getProject()?.selectedId || null, project: ST._ctx.getProject() } }));
        else { const m = (tick % 2 === 0) ? 'texture' : 'draft3d'; ST.setMode(m); }
      } catch(_) {}
      if ((tick % (config.customEventEvery * 3)) === 0) {
        try { window.dispatchEvent(new Event('resize')); resizes++; } catch(_) {}
      }
    }

    if ((tick % config.undoRedoEvery) === 0) {
      const depth = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < depth; k++) { if (await ST.undo()) undos++; }
      await delay(0);
      for (let k = 0; k < Math.max(1, depth - 1); k++) { if (await ST.redo()) redos++; }
    }

    if ((tick % config.autosaveEvery) === 0) {
      const mgr = ST.autosaveManager();
      if (mgr && typeof mgr.performAutosave === 'function') {
        try {
          await mgr.performAutosave();
          autosaves++;
          // rotate slots to test buffer max
          try {
            if (typeof mgr.buffer?.setMaxSlots === 'function' && (autosaves % 5) === 0) {
              const cur = mgr.config?.maxSlots ?? 12;
              const next = (autosaves % 10 === 0) ? 4 : 20;
              mgr.buffer.setMaxSlots(next);
              if (mgr.config) mgr.config.maxSlots = next;
            }
          } catch(_) {}
        } catch(e) { errors.push({ type:'autosave', message: String(e?.message||e).slice(0,300) }); }
      }
    }

    if ((tick % config.memoryBombEvery) === 0) {
      memoryBombs++;
      try {
        const n = Math.max(8, Math.floor(config.memoryBombBytes / 2));
        const arr = new Uint8Array(n);
        for (let i = 0; i < arr.length; i += 4096) arr[i] = (i + tick) & 0xff;
        bombAllocs.push(arr);
        if (bombAllocs.length > 6) bombAllocs.shift(); // cap to avoid OOM in QA
      } catch(e) { errors.push({ type:'memoryBomb', message: String(e?.message||e).slice(0,200) }); }
    }

    if ((tick % 1000) === 0) {
      const heap = (window.performance?.memory?.usedJSHeapSize) ? Math.round(window.performance.memory.usedJSHeapSize/1024/1024) : null;
      console.log(`[TNT-STRESS] tick=${tick} t=${Math.round(now-startTs)}ms shapes=${ST.list().length} mem=${heap ?? 'n/a'}MB errors=${errors.length}`);
    }

    await delay(config.tickMs);
  }

  // ---- FINAL ----
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  ST['3d'].resetCamera();

  const finalShapes = ST.list().length;
  const endMem = (window.performance?.memory?.usedJSHeapSize) ? Math.round(window.performance.memory.usedJSHeapSize/1024/1024) : null;
  const summary = {
    status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
    durationMs: Math.round(performance.now() - startTs),
    ticks: tick,
    finalShapes,
    counters: { inserts, deletes, mutations, selects, visibilityToggles, autosaves, customEvents, undos, redos, memoryBombs, resizes },
    memoryBombSlotsRetained: bombAllocs.length,
    finalHeapMB: endMem,
    errorsCount: errors.length,
    errors,
  };
  console.log('%c[TNT-STRESS] COMPLETE', errors.length===0 ? 'color:#00ff00;font-weight:800' : 'color:#ff3860;font-weight:800');
  console.table?.([
    { k: 'Duration (ms)', v: summary.durationMs },
    { k: 'Ticks executed', v: tick },
    { k: 'Final shapes', v: finalShapes },
    { k: 'Mutations', v: mutations },
    { k: 'Inserts / Deletes', v: `${inserts} / ${deletes}` },
    { k: 'Selects / Visibility', v: `${selects} / ${visibilityToggles}` },
    { k: 'Autosaves', v: autosaves },
    { k: 'Undo / Redo calls', v: `${undos} / ${redos}` },
    { k: 'Custom events', v: customEvents },
    { k: 'Memory bombs', v: memoryBombs },
    { k: 'Heap (MB, Chrome)', v: endMem ?? 'n/a' },
    { k: 'ERRORS', v: errors.length },
  ]);
  if (errors.length) console.error('[TNT-STRESS] error list (first 20):', errors.slice(0, 20));
  window.__TNT_RESULT__ = summary;
  try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.tnt = summary; } catch (_) {}
  return summary;
})();
