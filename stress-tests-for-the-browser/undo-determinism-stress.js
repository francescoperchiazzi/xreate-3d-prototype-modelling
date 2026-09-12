/**
 * XReate UI44 - Undo / Redo Determinism Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - Entities.getEntities/addEntity/updateEntity/clearAll/deleteEntity -> ST.list/add/update/clear/remove
 *   - window.appHistory (undoAction/redoAction/saveActionState/actionHistory) -> XR.Undo via ST.undo/redo/armUndo + project._undoStack.length
 *   - YOUR_APP_PATH imports -> REMOVED entirely
 *   - typeA (window)/typeB (volume)/typeC (ornament) -> cube/cylinder/sphere (ST.TYPES A/B/C)
 *   - snapshot digest fields (position/rotation/scale/formatVariant) -> real XReate shape fields (id/type/transform.position|rotation|scale/baseColor/uvMode/visible/locked)
 *   - confirmDeleteEntity -> ST.remove(id) (no confirm dialog)
 * Sections REMOVED:
 *   - badges / opacity / formatVariant fields (not in XReate)
 *   - visualLog UI rendering (no DOM overlays from console)
 *   - undo depth > 16 (XR default max 20 steps; lowered CONFIG to stay within budget)
 * Preserved original intent:
 *   S1 Volatile inserts + delete, S2 Persistent transforms, S3 batch-delete + undo back,
 *   S4 N rapid undo/redo loops, S5 Monte-Carlo weighted ops mix, S6 determinism (repeat SAME seed twice, SHA-256 of final snapshot MUST match)
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste + Enter
 *   Default CONFIG lowered for manual QA speed. Raise scenarioMonteCarloOps/undoRedoDepth only when debugging.
 */

(async () => {
  console.log('%c[UNDO-DETERMINISM] Starting...', 'color:#00bcd4;font-weight:bold;font-size:14px;');

  const CONFIG = {
    seed: 12345,
    repeat: 2,
    entityCount: 18,
    batchSize: 8,
    monteCarloOps: 80,
    undoRedoDepth: 14,
    opDelayMs: 0,
    yieldEveryOps: 40,
    typeDistribution: { A: 0.34, B: 0.33, C: 0.33 },
    opDistribution: { insert: 0.22, transform: 0.22, remove: 0.18, undo: 0.19, redo: 0.19 },
  };

  // Utilities
  const mulberry32 = (seed) => { let t = seed>>>0; return () => { t+=0x6d2b79f5; let x=Math.imul(t^(t>>>15),1|t); x^=x+Math.imul(x^(x>>>7),61|x); return ((x^(x>>>14))>>>0)/4294967296; }; };
  const pickWeighted = (rng, wm) => { const entries = Object.entries(wm); const sum = entries.reduce((a,[,w])=>a+w,0); const r = rng()*sum; let acc=0; for (const [k,w] of entries) { acc+=w; if (r<=acc) return k; } return entries[entries.length-1][0]; };
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));
  const raf = () => new Promise(r=>requestAnimationFrame(r));
  const r2 = (n) => Math.round(n*100)/100;
  const r3 = (n) => Math.round(n*1000)/1000;
  const sha256Hex = async (text) => {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  };

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
      const cr = { id: o.id, name: o.name||`UD_${type}_${Date.now().toString(36)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
      try {
        const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
        let part = arch ? (XR.addPartFromArchetype?.(arch, cr) || null) : null;
        if (!part) part = XR.Shapes?.add?.(type, cr);
        if (!part) part = XR.addShape?.(type, cr);
        return part || null;
      } catch(e) { return null; }
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
    function armUndo() { try { XR.Undo?.armProjectUndoSnapshot?.(_ctx); } catch(_) {} }
    async function undo() { try { await XR.Undo?.undoProject?.(_ctx); return true; } catch(_) { return false; } }
    async function redo() { try { await XR.Undo?.redoProject?.(_ctx); return true; } catch(_) { return false; } }
    function undoStackLen() { try { const pro = _ctx.getProject(); return pro?._undoStack?.length ?? 0; } catch(_){ return 0; } }
    function redoStackLen() { try { const pro = _ctx.getProject(); return pro?._redoStack?.length ?? 0; } catch(_){ return 0; } }
    return { TYPES, list, get, add, update, remove, clear, armUndo, undo, redo, undoStackLen, redoStackLen, _ctx };
  })();
  // ========= END ST HELPER =========

  // Snapshot + digest (deterministic fields)
  const snapshot = async () => {
    const shapes = ST.list().slice().sort((a, b) => String(a.id||'').localeCompare(String(b.id||'')));
    const lines = [];
    for (const s of shapes) {
      const id = String(s.id || '');
      const type = String(s.type || (s.archetype && s.archetype.id) || '');
      _ensureT(s);
      const p = s.transform.position, r = s.transform.rotation, sc = s.transform.scale;
      const uvMode = String(s.uvMode || '');
      const baseColor = String(s.baseColor || '');
      const visible = s.visible === false ? '0' : '1';
      const locked = s.locked === true ? '1' : '0';
      lines.push([id, type, r2(p.x),r2(p.y),r2(p.z), r3(r.x),r3(r.y),r3(r.z), r2(sc.x),r2(sc.y),r2(sc.z), uvMode, baseColor, visible, locked].join('|'));
    }
    const text = lines.join('\n');
    const hash = await sha256Hex(text);
    return { count: shapes.length, hash, text };
    function _ensureT(sh) {
      if (!sh.transform) sh.transform = { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} };
      ['position','rotation','scale'].forEach(k => { if (!sh.transform[k]) sh.transform[k] = {x:0,y:0,z:0}; });
    }
  };

  const metrics = { skippedTransformNoEntity: 0, skippedDeleteNoEntity: 0 };

  const runOnce = async (runIdx) => {
    // A determinism comparison must replay the same command stream. The old
    // run-index offset intentionally produced a different random sequence.
    const rng = mulberry32(CONFIG.seed);
    ST.clear();
    try { const pro = ST._ctx.getProject(); if (pro) { pro._undoStack = []; pro._redoStack = []; } } catch(_) {}
    await raf();

    // Pre-populate
    for (let i = 0; i < CONFIG.entityCount; i++) {
      const t = pickWeighted(rng, CONFIG.typeDistribution);
      const x = (rng()*8)-4, y = 0.7 + rng()*3, z = -1.5 - rng()*8;
      const s = 0.4 + rng()*1.2;
      ST.add(t, { id:`ud_${i}`, position:{x,y,z}, scale:{x:s,y:s,z:s}, color:`hsl(${Math.floor(rng()*360)},65%,55%)` });
      if (i % CONFIG.yieldEveryOps === 0) await raf();
    }
    // Arm initial snapshot (so first transform triggers undo)
    ST.armUndo();
    const initialSnap = await snapshot();
    console.log(`[UNDO-DET] run=${runIdx} initial count=${initialSnap.count} undoStack=${ST.undoStackLen()}`);

    // S1: Volatile inserts + delete (no armUndo between inserts)
    for (let i = 0; i < CONFIG.batchSize; i++) {
      const t = pickWeighted(rng, CONFIG.typeDistribution);
      const id = `vol_${i}`;
      ST.add(t, { id, position:{x:(rng()*8)-4,y:1+rng()*2,z:-3-rng()*4}, scale:{x:0.5,y:0.5,z:0.5} });
    }
    for (let i = 0; i < CONFIG.batchSize; i++) ST.remove(`vol_${i}`);
    await raf();

    // S2: Persistent transforms (each calls armUndo first)
    const idsNow = ST.list().map(s=>s.id).filter(Boolean);
    for (let i = 0; i < Math.min(CONFIG.batchSize, idsNow.length); i++) {
      const id = idsNow[i];
      ST.armUndo();
      ST.update(id, { position: { x: (rng()*6)-3, y: 1 + rng()*2, z: -3 - rng()*4 } });
      if (i % 5 === 0) await raf();
    }

    // S3: Batch delete of N shapes, then undo back
    const deleteIds = idsNow.slice(0, CONFIG.batchSize);
    for (const id of deleteIds) {
      ST.armUndo();
      ST.remove(id);
    }
    const afterDelete = await snapshot();
    console.log(`[UNDO-DET] run=${runIdx} after-batch-delete count=${afterDelete.count}`);
    // undo back one by one
    for (let k = 0; k < deleteIds.length; k++) { await ST.undo(); await sleep(CONFIG.opDelayMs); }
    const afterUndoDelete = await snapshot();
    console.log(`[UNDO-DET] run=${runIdx} after-undo-back count=${afterUndoDelete.count} target=${initialSnap.count - 0 /* approx */}`);

    // S4: Rapid undo/redo loops
    for (let i = 0; i < Math.min(CONFIG.undoRedoDepth, 8); i++) {
      await ST.undo(); await ST.undo(); await ST.redo(); await ST.redo();
    }

    // S5: Monte-Carlo weighted mix
    for (let op = 0; op < CONFIG.monteCarloOps; op++) {
      const choice = pickWeighted(rng, CONFIG.opDistribution);
      const liveIds = ST.list().map(s=>s.id).filter(Boolean);
      if (choice === 'insert') {
        const t = pickWeighted(rng, CONFIG.typeDistribution);
        ST.add(t, { position: { x:(rng()*10)-5, y:0.6+rng()*3.5, z:-2-rng()*8 }, scale:{x:0.3+rng()*0.9,y:0.3+rng()*0.9,z:0.3+rng()*0.9} });
      } else if (choice === 'transform') {
        if (liveIds.length === 0) { metrics.skippedTransformNoEntity++; continue; }
        const id = liveIds[Math.floor(rng()*liveIds.length)];
        ST.armUndo();
        ST.update(id, { rotation: { x: (rng()*0.4)-0.2, y: rng()*Math.PI, z: (rng()*0.4)-0.2 } });
      } else if (choice === 'remove') {
        if (liveIds.length === 0) { metrics.skippedDeleteNoEntity++; continue; }
        const id = liveIds[Math.floor(rng()*liveIds.length)];
        ST.armUndo();
        ST.remove(id);
      } else if (choice === 'undo') {
        await ST.undo();
      } else if (choice === 'redo') {
        await ST.redo();
      }
      if (op % CONFIG.yieldEveryOps === 0) await raf();
    }

    const finalSnap = await snapshot();
    console.log(`[UNDO-DET] run=${runIdx} FINAL count=${finalSnap.count} hash=${finalSnap.hash.slice(0,16)}... undoStack=${ST.undoStackLen()} redoStack=${ST.redoStackLen()}`);
    return finalSnap;
  };

  // Execute N runs, compare hashes for determinism
  const runs = [];
  for (let i = 0; i < CONFIG.repeat; i++) runs.push(await runOnce(i));

  const hashes = runs.map(r => r.hash);
  const counts = runs.map(r => r.count);
  const allSameHash = hashes.every(h => h === hashes[0]);
  const allSameCount = counts.every(c => c === counts[0]);

  console.log('%c[UNDO-DETERMINISM] Summary', allSameHash && allSameCount ? 'color:#00ff00;font-weight:bold' : 'color:#ff3860;font-weight:bold');
  console.table?.([
    { run: 'hashes', value: hashes.map(h=>h.slice(0,10)+'…').join('  vs  ') },
    { run: 'counts', value: counts.join('  vs  ') },
    { run: 'metrics.skippedTransformNoEntity', value: metrics.skippedTransformNoEntity },
    { run: 'metrics.skippedDeleteNoEntity', value: metrics.skippedDeleteNoEntity },
    { run: 'deterministic (hashes equal)?', value: String(allSameHash).toUpperCase() },
    { run: 'counts equal across runs?', value: String(allSameCount).toUpperCase() },
  ]);

  const RESULT = {
    status: (allSameHash && allSameCount) ? 'SUCCESS' : 'FAILED',
    runs: runs.map(r => ({ count: r.count, hash: r.hash })),
    deterministic: allSameHash,
    countsEqual: allSameCount,
    metrics,
  };
  try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.udet = RESULT; } catch (_) {}
  return RESULT;
})();
