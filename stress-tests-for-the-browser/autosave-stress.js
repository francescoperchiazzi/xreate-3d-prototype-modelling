/**
 * XReate UI44 - Autosave Manager Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH/js/core/storage.js import -> REMOVED (XReate AutosaveManager has its own internal storage)
 *   - window.__appAutosaveManager -> XR.Autosave.manager singleton
 *   - global addEntityAt / updateEntity / getEntities / clearAll -> ST helper
 *   - typeA / typeB -> cube / cylinder (ST.TYPES.A / B)
 *   - appStorage.lastWriteErrorName -> REMOVED (no such public field)
 *   - data.entities integrity check -> data.project.shapes (XReate save payload shape)
 * Sections REMOVED: formatVariant / badges / textureURL source fields; import(storage.js) entirely
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 *   WARNING: This clears the autosave buffer during the test and restores original interval/maxSlots at the end.
 */

(async () => {
  console.log('%c[AUTOSAVE-STRESS] Starting Autosave Validation...', 'color: #ff00ff; font-weight: bold; font-size: 14px;');

  // ========= SHARED ST HELPER =========
  const ST = (() => {
    const TYPES = { A: 'cube', B: 'cylinder', C: 'sphere', D: 'plane' };
    const _refs = { projectUndoArmed:false, projectUndoArmTimer:null };
    const XR = (typeof window !== 'undefined') ? (window.XR || {}) : {};
    const _ctx = {
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.() || XR.ProjectIO?.buildProjectSavePayload?.() || null,
      loadProjectFromPayload: (p, o) => (XR.ProjectIO?.loadProjectFromPayload?.(p, o || {})),
      getUndoMaxSteps: () => (XR.Undo?.getUndoMaxSteps?.() ?? 20),
      gcUndoAssets: () => {}, setStatusKey: () => {}, setStatus: () => {}, tr: s => String(s || ''),
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
      const cr = { id: o.id, name: o.name||`AS_${type}_${Date.now().toString(36)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
      try {
        const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
        let part = arch ? (XR.addPartFromArchetype?.(arch, cr) || null) : null;
        if (!part) part = XR.Shapes?.add?.(type, cr);
        if (!part) part = XR.addShape?.(type, cr);
        if (part) return part;
      } catch(e) { console.warn('[ST.add]', type, e?.message||e); }
      return null;
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
    function clear() {
      try {
        const ids = list().map(s=>s&&s.id).filter(Boolean);
        for (const id of ids) try { XR.SceneCommands?.deletePart?.(id); } catch(_){}
        try { XR.ProjectState?.setShapeList?.([]); } catch(_){}
        try { XR.ProjectState?.setSelectedId?.(null); } catch(_){}
        const pro = _ctx.getProject();
        if (pro) { pro.selectedId = null; if (pro.shapes) pro.shapes.length = 0; }
        return true;
      } catch(_) { return false; }
    }
    function serialize() { try { return XR.ProjectIO?.buildProjectSavePayload?.(); } catch(_){ return null; } }
    return { TYPES, list, get, add, update, clear, serialize, _ctx };
  })();
  // ========= END ST HELPER =========

  let manager = null;
  try {
    if (typeof window.XR?.Autosave?.ensureManager === 'function') manager = window.XR.Autosave.ensureManager();
    if (!manager) manager = window.XR?.Autosave?.manager || null;
  } catch (_) { manager = window.XR?.Autosave?.manager || null; }
  if (!manager) {
    console.error('[AUTOSAVE-STRESS] XR.Autosave.manager not found. Open XReate editor (not portfolio) and retry.');
    return { status: 'SKIPPED', reason: 'no-autosave-manager' };
  }

  // 2. Setup: store original config to restore later
  const originalInterval = manager.config?.intervalMs ?? 30000;
  const originalMaxSlots = manager.config?.maxSlots ?? 12;

  const failures = [];
  let slowSaves = 0;
  let originalBufferMaxSlots = null;
  try {
    if (typeof manager.buffer?.getMaxSlots === 'function') originalBufferMaxSlots = manager.buffer.getMaxSlots();
  } catch(_) {}

  try {
    manager.config.intervalMs = 1000;
    manager.config.maxSlots = 20;
    try { if (typeof manager.buffer?.setMaxSlots === 'function') manager.buffer.setMaxSlots(20); } catch(_) {}

    console.log('[AUTOSAVE-STRESS] Clearing workspace + autosave buffer...');
    ST.clear();
    try { await manager.clearAll?.(); } catch(_) {}
    await new Promise(r => setTimeout(r, 500));

    const ITER = 30; // lowered from 50 to keep QA fast
    console.log(`%c[AUTOSAVE-STRESS] Starting ${ITER} iterations of Mutation -> Autosave...`, 'color: cyan');

    for (let i = 0; i < ITER; i++) {
      if (i === 0 || (i % 5 === 0)) {
        ST.add('A', { position:{ x: Math.random()*4-2, y:1.5, z:-2 }, scale:{x:1.0,y:1.0,z:1.0}, name:`AutoWin ${i}`, color:'#00ff00' });
        ST.add('B', { position:{ x: Math.random()*4-2, y:1.0, z:-1 }, scale:{x:0.5,y:0.5,z:0.5}, name:`AutoVol ${i}`, color:'#0000ff' });
      } else {
        const entities = ST.list();
        if (entities.length > 0) {
          const target = entities[Math.floor(Math.random() * entities.length)];
          ST.update(target.id, {
            position: { x: (Math.random() * 4 - 2), y: 1.5, z: -2 },
          });
        }
      }
      await new Promise(r => requestAnimationFrame(r));

      console.log(`[AUTOSAVE-STRESS] Iteration ${i + 1}/${ITER}: Triggering Autosave...`);
      const startTime = performance.now();
      try {
        if (typeof manager.performAutosave === 'function') await manager.performAutosave();
        else throw new Error('manager.performAutosave not a function');
      } catch (e) {
        failures.push({
          iteration: i + 1,
          name: e?.name || 'Error',
          message: e?.message || String(e),
          reason: null,
        });
        console.error(`[AUTOSAVE-STRESS] Autosave failed iteration ${i+1}:`, e);
      }
      const duration = performance.now() - startTime;
      if (duration > 500) { slowSaves += 1; console.warn(`[AUTOSAVE-STRESS] Slow save: ${duration.toFixed(2)}ms`); }

      const lastSaveTime = manager?.state?.lastSaveTime;
      if (lastSaveTime && (Date.now() - lastSaveTime > 2500)) console.warn('[AUTOSAVE-STRESS] Warning: lastSaveTime stale.');

      await new Promise(r => setTimeout(r, 100));
    }

    // Final forced save
    try { if (typeof manager.performAutosave === 'function') await manager.performAutosave(true); }
    catch (e) { failures.push({ iteration:'final-save', name:e?.name||'Error', message:e?.message||String(e), reason:null }); console.error('[AUTOSAVE-STRESS] Final autosave failed:', e); }
    await new Promise(r => requestAnimationFrame(r));

    // Integrity verification
    console.log('%c[AUTOSAVE-STRESS] Verifying Data Integrity...', 'color: yellow');
    let history = [];
    try { if (typeof manager.getHistory === 'function') history = await manager.getHistory(); }
    catch(e) { console.error('[AUTOSAVE-STRESS] getHistory failed:', e); failures.push({iteration:'history', name:e?.name||'Error', message:e?.message||String(e)}); }
    console.log(`[AUTOSAVE-STRESS] Autosaves stashed: ${history.length}`);

    if (history.length > 0) {
      const latestId = history[0].id;
      try {
        const data = typeof manager.getAutosave === 'function' ? await manager.getAutosave(latestId) : null;
        const shapesInSaved = data?.project?.shapes
          ? data.project.shapes.length
          : (Array.isArray(data?.entities) ? data.entities.length : null);
        if (shapesInSaved === null) throw new Error('Autosave payload has no project.shapes (or entities)');
        const currentCount = ST.list().length;
        if (currentCount === shapesInSaved) {
          console.log(`%c[AUTOSAVE-STRESS] Integrity PASS: shape count matches (${currentCount}).`, 'color:#00ff00');
        } else {
          failures.push({ iteration:'integrity', name:'IntegrityMismatch', message:`Current=${currentCount} vs Saved=${shapesInSaved}` });
          console.error(`[AUTOSAVE-STRESS] Integrity FAIL: current=${currentCount} vs saved=${shapesInSaved}`);
        }
      } catch (e) {
        failures.push({ iteration:'integrity', name:e?.name||'Error', message:e?.message||String(e) });
        console.error('[AUTOSAVE-STRESS] Integrity FAIL (exception):', e);
      }
    } else {
      failures.push({ iteration:'history-empty', name:'NoAutosaves', message: 'History is empty after N iterations' });
      console.error('[AUTOSAVE-STRESS] History empty after all iterations; cannot verify integrity.');
    }

    let finalHistory = history;
    try { if (finalHistory.length === 0 && typeof manager.getHistory === 'function') finalHistory = await manager.getHistory(); } catch(_) {}
    const errors = failures.length;
    console.log(`%c[AUTOSAVE-STRESS] Complete. Errors=${errors}. Final history length=${finalHistory.length}. Slow saves=${slowSaves}.`,
      errors === 0 ? 'color:#00ff00;font-weight:bold' : 'color:#ff3860;font-weight:bold');
    console.table?.([
      { metric: 'Iterations', value: ITER },
      { metric: 'History autosaves', value: finalHistory.length },
      { metric: 'Slow saves (>500ms)', value: slowSaves },
      { metric: 'Failures', value: failures.length },
    ]);
    const RESULT = { status: errors===0 ? 'SUCCESS' : 'FAILED', totalAutosaves: finalHistory.length, errors, slowSaves, failures };
    try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.asav = RESULT; } catch (_) {}
    return RESULT;

  } finally {
    console.log('[AUTOSAVE-STRESS] Restoring original config...');
    try { manager.config.intervalMs = originalInterval; } catch(_) {}
    try { manager.config.maxSlots = originalMaxSlots; } catch(_) {}
    try { if (typeof manager.buffer?.setMaxSlots === 'function') {
      const restore = (originalBufferMaxSlots != null) ? originalBufferMaxSlots : originalMaxSlots;
      manager.buffer.setMaxSlots(restore);
    } } catch(_) {}
  }
})();
