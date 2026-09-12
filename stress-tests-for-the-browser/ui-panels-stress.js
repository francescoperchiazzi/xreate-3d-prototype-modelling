/**
 * XReate UI44 - UI Panels & Events Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH imports -> ST helper (window.XR runtime)
 *   - typeA/B/C/D -> cube / cylinder / sphere / plane
 *   - Entities API -> ST.list/add/get/update/clear
 *   - EventBus publish(EVENT_A..K) -> 3 real CustomEvents xr:project-changed, xr:project-selection-changed, xr:ui-mode-changed
 *   - MeshRegistryAPI.hasMesh/getMesh -> ST.3d.findMesh
 *   - updateSelection -> ST.select(id)
 *   - stateManager.toggleVisibility -> XR.SceneCommands.setPartVisibility(id, bool) / ST.update
 *   - window.openPanelA/closePanelA/toggleHelpOverlay -> ST.setMode('draft3d'|'texture') toggle + window.dispatch resize events
 * Sections REMOVED: badges param addEntityAt (no badges field in shapes), source field updateEntity, EVENT_TYPES object.
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 *   NOTE: Default cycles = 80 (template had 220 — too aggressive for manual QA). Edit CONFIG.cycles if needed.
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
    errors.push({ type: 'error', message: event?.message, filename: event?.filename, lineno: event?.lineno, colno: event?.colno, error: String(event?.error || '').slice(0, 200) });
  };
  const onRejection = (event) => {
    errors.push({ type: 'unhandledrejection', reason: String(event?.reason || '').slice(0, 240) });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  console.log('%c[UI-PANELS-STRESS] starting…', 'color:#3273dc;font-weight:700');

  const ready = await waitFor(() => {
    try { return !!window.XR && (typeof window.XR.Shapes?.list === 'function' || typeof window.XR.getShapes === 'function'); } catch (_) { return false; }
  }, 15000);
  if (!ready) {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    throw new Error('[UI-PANELS-STRESS] XR namespace not ready');
  }

  // ========= SHARED ST HELPER (shortened — same as other harnesses) =========
  const ST = (() => {
    const TYPES = { A: 'cube', B: 'cylinder', C: 'sphere', D: 'plane' };
    const _refs = { projectUndoArmed: false, projectUndoArmTimer: null };
    const XR = window.XR || {};
    const _ctx = {
      getProject: () => XR.ProjectState?.getProject?.() || XR.getProject?.() || null,
      buildProjectUndoPayload: () => XR.ProjectIO?.buildProjectUndoPayload?.() || XR.ProjectIO?.buildProjectSavePayload?.() || null,
      loadProjectFromPayload: (p, o) => (XR.ProjectIO?.loadProjectFromPayload?.(p, o || {})),
      getUndoMaxSteps: () => (XR.Undo?.getUndoMaxSteps?.() ?? 20),
      gcUndoAssets: () => {}, setStatusKey: () => {}, setStatus: () => {}, tr: (s) => String(s || ''),
      refs: _refs,
      pushProjectUndoSnapshot: () => (XR.Undo?.pushProjectUndoSnapshot?.(_ctx)),
      armProjectUndoSnapshot: () => (XR.Undo?.armProjectUndoSnapshot?.(_ctx)),
    };
    function _et(p) {
      if (!p) return null;
      if (!p.transform) p.transform = { position: { x:0,y:0,z:0 }, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1} };
      if (!p.transform.position) p.transform.position = {x:0,y:0,z:0};
      if (!p.transform.rotation) p.transform.rotation = {x:0,y:0,z:0};
      if (!p.transform.scale) p.transform.scale = {x:1,y:1,z:1};
      return p;
    }
    function list() { try { return XR.Shapes?.list?.() || XR.ProjectState?.getShapeList?.() || XR.getShapes?.() || []; } catch (_) { return []; } }
    function get(id) {
      const sid = String(id||'');
      try { return XR.Shapes?.getById?.(sid) || XR.ProjectState?.getShapeById?.(sid) || list().find(s => s && s.id === sid) || null; } catch (_) { return list().find(s=>s&&s.id===sid)||null; }
    }
    function add(typeId, opts) {
      const type = typeId in TYPES ? TYPES[typeId] : (String(typeId||'')||'cube');
      const o = opts || {};
      const pos = o.position || {x:0,y:1,z:-2}; const sca = o.scale||{x:1,y:1,z:1}; const rot = o.rotation||{x:0,y:0,z:0};
      const cr = { id: o.id, name: o.name||`ST_${type}_${Date.now().toString(36)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
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
        for (const id of ids) try { XR.SceneCommands?.deletePart?.(id); } catch(_) {}
        try { XR.ProjectState?.setShapeList?.([]); } catch(_) {}
        try { XR.ProjectState?.setSelectedId?.(null); } catch(_) {}
        const pro = _ctx.getProject();
        if (pro) { pro.selectedId = null; if (pro.shapes) pro.shapes.length = 0; }
        return true;
      } catch(_) { return false; }
    }
    function select(id) { try { XR.Shapes?.select?.(id,{silent:false}); return true; } catch(_) { try { XR.ProjectState?.setSelectedId?.(id); return true; } catch(_){ return false; } } }
    function setMode(m) {
      try { if (XR.TRAE?.setMode) XR.TRAE.setMode(m); else if (document?.documentElement) document.documentElement.setAttribute('data-ui-mode', String(m||'draft3d')); } catch(_) {}
      try { if (document?.dispatchEvent) document.dispatchEvent(new CustomEvent('xr:ui-mode-changed', {detail:{mode:m}})); } catch(_) {}
    }
    const _3D = {
      findMesh(partId) {
        const sid = String(partId||'');
        try {
          const parts = list().slice(0,25);
          for (const p of parts) {
            let cur = p && (p._mesh || p._node || p._ref);
            let d = 0; let scene = null;
            while (cur && d < 60) { if ((cur.type==='Scene')||(cur.isScene===true)) { scene = cur; break; } cur = cur.parent; d++; }
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
    return { TYPES, list, get, add, update, clear, select, setMode, '3d': _3D, _ctx };
  })();
  // ========= END ST HELPER =========

  const CONFIG = { cycles: 80 };

  ST.clear();
  await delay(80);

  const created = [];
  const createSet = (tKey, count) => {
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0.5 : (i / (count - 1));
      const x = -4 + t * 8;
      const y = tKey === 'A' ? 1.7 : 1.1 + (i % 6) * 0.1;
      const z = -2.2 - (tKey === 'C' ? 1.2 : 0.0) - (i % 5) * 0.25;
      const color = tKey === 'B' ? '#007AFF' : tKey === 'A' ? '#1a1a1a' : '#FFD60A';
      const scale = tKey === 'A' ? 1.6 : tKey === 'B' ? 0.55 : 0.9;
      const name = `${tKey}-${i}`;
      const ent = ST.add(tKey, { position:{x,y,z}, scale:{x:scale,y:scale,z:scale}, name, color });
      if (ent) created.push(ent.id);
    }
  };
  createSet('A', 25);
  createSet('B', 35);
  createSet('C', 20);
  await new Promise(requestAnimationFrame);

  const pickIds = () => ST.list().filter(e => e && e.id).map(e => e.id);
  const ids = pickIds();
  console.log(`[UI-PANELS-STRESS] Created ${created.length} entities, ${ids.length} live IDs for cycling.`);

  let modesToggled = 0;
  let eventsFired = 0;

  for (let i = 0; i < CONFIG.cycles; i++) {
    if (i % 3 === 0) { try { window.dispatchEvent(new CustomEvent('xr:project-changed', {detail:{project: ST._ctx.getProject()}})); eventsFired++; } catch(_) {} }
    if (i % 4 === 0) { try { window.dispatchEvent(new CustomEvent('xr:project-selection-changed', {detail:{selectedId: ST._ctx.getProject()?.selectedId || null, project: ST._ctx.getProject()}})); eventsFired++; } catch(_) {} }
    if (i % 5 === 0) { try { document.dispatchEvent(new CustomEvent('xr:ui-mode-changed')); eventsFired++; } catch(_) {} }

    if (i % 6 === 0) {
      try {
        ST.setMode('texture');
        ST.setMode('draft3d');
        modesToggled += 2;
      } catch(e) {
        errors.push({ type:'api', where:'setMode toggle', error: String(e||'').slice(0,120) });
      }
    }

    const id = ids[i % Math.max(1, ids.length)];
    const entity = ST.get(id);
    const mesh = entity ? ST['3d'].findMesh(entity.id) : null;
    ST.select(id);

    if (entity && i % 5 === 0) {
      const dx = Math.sin(i * 0.13) * 0.15;
      const dy = Math.cos(i * 0.11) * 0.05;
      const ep = entity.transform?.position || {x:0, y:1.2, z:-2.2};
      ST.update(entity.id, { position: { x: dx, y: ep.y + dy, z: ep.z } });
    }

    if (entity?.id && i % 14 === 0) {
      try {
        if (typeof XR.SceneCommands?.setPartVisibility === 'function') {
          XR.SceneCommands.setPartVisibility(entity.id, false);
          XR.SceneCommands.setPartVisibility(entity.id, true);
        } else {
          ST.update(entity.id, { visible: false });
          ST.update(entity.id, { visible: true });
        }
      } catch(e) {
        errors.push({ type:'api', where:'visibility-toggle', error: String(e||'').slice(0,120) });
      }
    }

    if (i % 16 === 0) { try { window.dispatchEvent(new Event('resize')); } catch(_) {} }
    if (i % 20 === 0) await new Promise(requestAnimationFrame);
    await delay(18);
  }

  ST.select(null);

  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);

  const entityCount = ST.list().length;
  const summary = { status: errors.length ? 'FAIL' : 'OK', errors, entityCount, modesToggled, eventsFired, cyclesRun: CONFIG.cycles };

  if (errors.length) {
    console.log('%c[UI-PANELS-STRESS] completed with errors', 'color:#ff3860;font-weight:700', summary);
  } else {
    console.log('%c[UI-PANELS-STRESS] completed successfully', 'color:#23d160;font-weight:700', summary);
  }
  console.table?.([
    { metric: 'Cycles', value: CONFIG.cycles },
    { metric: 'Entities live', value: entityCount },
    { metric: 'Mode toggles', value: modesToggled },
    { metric: 'Custom events fired', value: eventsFired },
    { metric: 'Errors caught', value: errors.length },
  ]);

  try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.uipnl = summary; } catch (_) {}
  return summary;
})();
