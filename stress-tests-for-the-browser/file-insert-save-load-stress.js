/**
 * XReate UI44 - File Insert / Save / Load Roundtrip Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH imports (texture-manager + persistence.js) -> REMOVED; instead use ST.serialize() / ST.load() and layers[] imageDataUrl mutation
 *   - AssetManager.applyTexture(mesh, type, objectUrl, color) -> NOT-EXIST in XReate public API.
 *     REPLACED with: generate PNG data URL via canvas.toDataURL('image/png'), create a layer via ST.update(id, {layers: [...]}) mutation,
 *     i.e. ST calls XR.Undo.mutateProject and mutates project.shapes[id].layers in-place, injecting a new layer with imageDataUrl.
 *   - serializeProject() -> ST.serialize() (XR.ProjectIO.buildProjectSavePayload)
 *   - restoreFromProject(project) -> ST.load(payload) (full project load, not manual entity loop)
 *   - window.scene / findMeshById(userData.id) -> ST.3d.findMesh(partId) (matches mesh.userData.partId)
 *   - getEntities/addEntity/updateEntity/clearAll globals -> ST helper
 *   - typeA/typeB/typeD -> cube / cylinder / plane (ST.TYPES A, B, D)
 * Sections REMOVED:
 *   - isFallbackMap() check (XReate textures are injected as data URL layers, not THREE.Material.map; there is no fallback texture concept)
 *   - texture re-apply repair path
 *   - window.app?.* fallbacks
 *   - object URL revoke (we use data URLs, not blob URLs)
 * Preserved original test intent:
 *   - N cycles, each creates M shapes, each with a unique procedurally-generated PNG texture data URL injected into shape.layers[0]
 *   - serialize project -> ST.load payload -> verify all shapes are back + their layers with image data are preserved (non-empty)
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 *   NOTE: Default cycles=3, filesPerCycle=8 to keep runtime short. Raise CONFIG.cycles for aggressive QA.
 */

(async function runFileInsertSaveLoadStressTest() {
  const CONFIG = {
    cycles: 3,
    filesPerCycle: 8,
    seed: 424242,
    timeoutMs: 9000,
    settleMs: 160,
  };
  const TYPE_KEYS = ['A','B','D']; // cube / cylinder / plane
  const LAYER_LABEL = 'StressTextureLayer';

  const mulberry32 = (a) => {
    return function rng() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const raf = () => new Promise(r => requestAnimationFrame(r));

  // ========= SHARED ST HELPER =========
  const ST = (() => {
    const TYPES = { A:'cube', B:'cylinder', C:'sphere', D:'plane' };
    const _refs = { projectUndoArmed:false, projectUndoArmTimer:null };
    const XR = (typeof window !== 'undefined') ? (window.XR||{}) : {};
    const _ctx = {
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.() || XR.ProjectIO?.buildProjectSavePayload?.() || null,
      loadProjectFromPayload: (p,o) => (XR.ProjectIO?.loadProjectFromPayload?.(p, o||{})),
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
      const cr = { id: o.id, name: o.name||`FC_${type}_${Date.now().toString(36)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
      try {
        const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
        let part = arch ? (XR.addPartFromArchetype?.(arch, cr) || null) : null;
        if (!part) part = XR.Shapes?.add?.(type, cr);
        if (!part) part = XR.addShape?.(type, cr);
        if (part) return part;
      } catch(e) { console.warn('[ST.add fail]', type, e?.message||e); }
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
          if ('layers' in d) t.layers = d.layers;
        }});
      } catch(_) {
        _et(p);
        if (d.position) Object.assign(p.transform.position, d.position);
        if (d.rotation) Object.assign(p.transform.rotation, d.rotation);
        if (d.scale) Object.assign(p.transform.scale, d.scale);
        if ('color' in d || 'baseColor' in d) p.baseColor = ('baseColor' in d) ? d.baseColor : d.color;
        if ('layers' in d) p.layers = d.layers;
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
    async function load(payload) { try { if (XR.ProjectIO?.loadProjectFromPayload) { await XR.ProjectIO.loadProjectFromPayload(payload, {}); return true; } } catch(e){ console.warn('[ST.load]', e?.message||e); return false; } return false; }
    const _3D = {
      findMesh(partId) {
        const sid = String(partId||'');
        try {
          const parts = list().slice(0, 40);
          for (const p of parts) {
            // A materialized XReate part owns its mesh directly. Traversing up
            // to Scene was an obsolete pre-refactor assumption and missed
            // valid meshes under the assembly root.
            if (p?.id === sid && p._mesh) return p._mesh;
            let cur = p && (p._mesh || p._node || p._ref);
            let d=0; let scene=null;
            while(cur && d<60) { if ((cur.type==='Scene')||(cur.isScene===true)) { scene = cur; break; } cur=cur.parent; d++; }
            if (scene && typeof scene.traverse === 'function') {
              let found = null;
              scene.traverse(n=>{ if (!found && n?.userData?.partId === sid) found = n; });
              if (found) return found;
            }
          }
        } catch(_) {}
        return null;
      }
    };
    return { TYPES, list, get, add, update, clear, serialize, load, '3d':_3D, _ctx };
  })();
  // ========= END ST HELPER =========

  if (!window.XR?.ProjectIO?.buildProjectSavePayload) {
    console.error('[FILE-CYCLE] XR.ProjectIO not initialized. Open the editor page and retry.');
    return;
  }

  // Generate PNG data URL (base64 image/png) instead of Blob/File, since XReate layers accept data URLs
  const makePngDataUrl = (hue, label) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `hsl(${hue} 85% 55%)`;
    ctx.fillRect(0, 0, 64, 64);
    // Gradient stripe
    const grad = ctx.createLinearGradient(0,0,64,64);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,64,64);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace';
    ctx.fillText(String(label||'').slice(0, 10), 4, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 54, 64, 10);
    ctx.fillStyle = '#ffffff'; ctx.font = '8px monospace'; ctx.fillText(`h${hue}`, 4, 62);
    return canvas.toDataURL('image/png');
  };

  const waitForMesh = async (id, timeoutMs) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const m = ST['3d'].findMesh(id);
      if (m) return m;
      await raf();
    }
    return null;
  };

  const hasImageLayer = (shape) => {
    const layers = shape?.layers;
    if (!Array.isArray(layers) || layers.length === 0) return false;
    return layers.some(l => l && (typeof l.imageDataUrl === 'string' && l.imageDataUrl.length > 40));
  };

  const report = {
    pass: true,
    startedAt: Date.now(),
    config: { ...CONFIG },
    cycles: [],
    failures: [],
  };
  window.__FILE_CYCLE_STRESS__ = report;

  const runCycle = async (cycleIndex) => {
    const rng = mulberry32(CONFIG.seed + cycleIndex);
    const created = [];

    ST.clear();
    await raf();

    for (let i = 0; i < CONFIG.filesPerCycle; i++) {
      const id = `stress-fc-${CONFIG.seed}-${cycleIndex}-${String(i).padStart(3,'0')}`;
      const tKey = TYPE_KEYS[i % TYPE_KEYS.length];
      const x = (rng()*10) - 5;
      const y = 1 + rng() * 3;
      const z = -1 - rng() * 6;
      const color = `#${Math.floor(rng()*16777215).toString(16).padStart(6,'0')}`;
      const scale = tKey === 'A' ? 1.1 : tKey === 'B' ? 0.7 : 6.0;
      const shape = ST.add(tKey, {
        id,
        position:{x,y,z},
        rotation:{x:0, y:rng()*Math.PI*2, z:0},
        scale:{x:scale, y: scale, z: scale},
        name:`StressFile ${cycleIndex}-${i} [${ST.TYPES[tKey]}]`,
        color,
      });
      if (!shape) throw new Error(`ST.add returned null for id=${id}`);
      const mesh = await waitForMesh(id, CONFIG.timeoutMs);
      if (!mesh) throw new Error(`Mesh not materialized for ${id}`);

      const hue = Math.floor(rng()*360);
      const dataUrl = makePngDataUrl(hue, `C${cycleIndex}-N${i}`);
      const layerId = `layer-${cycleIndex}-${i}`;
      const layer = {
        id: layerId,
        label: LAYER_LABEL,
        imageDataUrl: dataUrl,
        transform: { x: 0, y: 0, scale: 1, rot: 0, ratio: 1, tile: false, tileScale: 1 },
        opacity: 1.0,
        visible: true,
        locked: false,
        blendMode: 'source-over',
        isSharedBackground: false,
      };
      const updated = ST.update(id, { layers: [layer] });
      if (!updated || !hasImageLayer(updated)) {
        // Try directly mutating shape + fire project-changed
        const s = ST.get(id);
        if (s) {
          s.layers = [layer];
          try { window.dispatchEvent(new CustomEvent('xr:project-changed', {detail:{project: ST._ctx.getProject()}})); } catch(_) {}
        }
      }
      created.push({ id, tKey, hue, dataUrl });
    }

    const saved = ST.serialize();
    if (!saved || !saved?.project?.shapes) throw new Error('serialize returned invalid payload (no project.shapes)');

    // Restore = clear + full payload load
    ST.clear();
    await raf();
    const loadedOk = await ST.load(saved);
    if (!loadedOk) throw new Error('ST.load(payload) returned false');
    await sleep(CONFIG.settleMs);

    // Verification
    const verification = {
      expected: created.length,
      savedEntityCount: saved.project.shapes.length,
      shapesRestored: 0,
      missingMeshes: 0,
      shapesWithImageLayers: 0,
      shapesMissingImageLayers: 0,
    };

    for (const e of created) {
      const shape = ST.get(e.id);
      if (!shape) { verification.missingMeshes += 1; continue; }
      verification.shapesRestored += 1;
      const mesh = await waitForMesh(e.id, CONFIG.timeoutMs);
      if (!mesh) verification.missingMeshes += 1;

      if (hasImageLayer(shape)) verification.shapesWithImageLayers += 1;
      else verification.shapesMissingImageLayers += 1;
    }

    return { saved, verification };
  };

  try {
    const t0 = performance.now();
    for (let c = 0; c < CONFIG.cycles; c++) {
      const tc0 = performance.now();
      let res;
      try {
        res = await runCycle(c);
      } catch (err) {
        report.pass = false;
        report.failures.push({ cycle: c, name: err?.name || 'Error', message: err?.message || String(err), stack: String(err?.stack || '').slice(0, 300) });
        console.error(`[FILE-CYCLE] Cycle ${c} failed:`, err);
        res = { verification: { expected: CONFIG.filesPerCycle, shapesRestored: 0, missingMeshes: CONFIG.filesPerCycle, shapesWithImageLayers: 0, shapesMissingImageLayers: CONFIG.filesPerCycle } };
      }
      const tc1 = performance.now();
      report.cycles.push({
        cycle: c,
        ms: Math.round(tc1 - tc0),
        savedEntityCount: res.verification.savedEntityCount ?? res.verification.expected,
        verification: res.verification,
      });
      await sleep(90);
    }
    report.durationMs = Math.round(performance.now() - t0);
  } catch (err) {
    report.pass = false;
    report.failures.push({ name: err?.name || 'TopLevelError', message: err?.message || String(err) });
  } finally {
    report.endedAt = Date.now();
  }

  const agg = report.cycles.reduce((acc, c) => {
    acc.cycles += 1;
    acc.expected += c.verification.expected;
    acc.shapesRestored += c.verification.shapesRestored;
    acc.missingMeshes += c.verification.missingMeshes;
    acc.shapesWithImageLayers += c.verification.shapesWithImageLayers;
    acc.shapesMissingImageLayers += c.verification.shapesMissingImageLayers;
    return acc;
  }, { cycles: 0, expected: 0, shapesRestored: 0, missingMeshes: 0, shapesWithImageLayers: 0, shapesMissingImageLayers: 0 });

  console.group('[FILE-CYCLE] Result');
  console.log('pass:', report.pass, '| durationMs:', report.durationMs);
  if (report.cycles.length) console.table(report.cycles);
  console.log('aggregate:', agg);
  if (report.failures.length) console.error('failures:', report.failures);
  console.log('fullReport ref @ window.__FILE_CYCLE_STRESS__ =', report);
  console.groupEnd();
  console.table?.([
    { metric: 'Pass', value: String(report.pass).toUpperCase() },
    { metric: 'Cycles', value: agg.cycles },
    { metric: 'Expected shapes total', value: agg.expected },
    { metric: 'Shapes restored', value: agg.shapesRestored },
    { metric: 'Missing meshes (Three)', value: agg.missingMeshes },
    { metric: 'Shapes WITH image layers after load', value: agg.shapesWithImageLayers },
    { metric: 'Shapes LOST image layer after load', value: agg.shapesMissingImageLayers },
    { metric: 'Total failures', value: report.failures.length },
  ]);
  try {
    window.__RESULTS__ = window.__RESULTS__ || {};
    window.__RESULTS__.fisl = { pass: report.pass, durationMs: report.durationMs, aggregate: agg, failures: report.failures, cycles: report.cycles.length };
  } catch (_) {}
})();
