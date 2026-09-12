/**
 * XReate UI44 - Project Cycle Save/Load Stress Test
 * Adapted: 2026-09-02
 * Mapped placeholders:
 *   - YOUR_APP_PATH imports -> ST helper (window.XR runtime)
 *   - SceneManager.replacePlaylist / getPlaylistSnapshot / loadSceneState -> REMOVED (no scene-manager / playlist concept in XReate)
 *     → REPLACED with: ST.serialize() → ST.clear() → ST.load(payload) → shape count verify
 *   - Entities.getEntities / addEntityAt / clearAll -> ST.list/add/get/update/clear
 *   - typeA/B/C/D -> cube / cylinder / sphere / plane (D = dome = plane scaled 15x15 rotated)
 *   - Utils module -> REMOVED (no such module)
 * Sections REMOVED: playlist replacement (non-existent), SceneManager.* entirely, transitions between multiple scenes per project, "restore original playlist" step (no playlist to restore).
 * Preserved original test intent: Random Creation → Save (serialize payload) → Load (deserialize) → verify count matches → repeat N cycles → memory used (Chrome).
 */
/*
 * HOW TO USE:
 *   1. Open XReate at the local URL printed by `npm run dev`.
 *   2. Open DevTools > Console
 *   3. Paste the entire script and press Enter
 *   NOTE: Default iterations = 12 (template had 20, lowered to reduce manual QA time).
 */

(async function runProjectCycleStressTest() {
    console.clear();
    console.log('%c[PROJECT-CYCLE] STARTING…', 'color: white; background: #007bff; font-size: 14px; padding: 5px;');

    const CONFIG = {
        iterations: 12,
        minEntities: 10,
        maxEntities: 50,
        delayBetweenCycles: 350,
    };
    const TYPE_KEYS = ['A', 'B', 'C']; // cube / cylinder / sphere — no plane (avoids layout overlap with dome)
    const uvModes = ['cube','sphere','cylinder','plane'];

    // ========= SHARED ST HELPER =========
    const ST = (() => {
      const TYPES = { A:'cube', B:'cylinder', C:'sphere', D:'plane' };
      const _refs = { projectUndoArmed:false, projectUndoArmTimer:null };
      const XR = (typeof window!=='undefined') ? (window.XR||{}) : {};
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
      function list() { try { return XR.Shapes?.list?.() || XR.ProjectState?.getShapeList?.() || XR.getShapes?.() || []; } catch(_){ return []; } }
      function get(id) {
        const sid = String(id||'');
        try { return XR.Shapes?.getById?.(sid) || XR.ProjectState?.getShapeById?.(sid) || list().find(s=>s&&s.id===sid) || null; } catch(_){ return list().find(s=>s&&s.id===sid)||null; }
      }
      function add(typeId, opts) {
        const type = typeId in TYPES ? TYPES[typeId] : (String(typeId||'')||'cube');
        const o = opts || {};
        const pos = o.position || {x:0,y:1,z:-2}; const sca = o.scale||{x:1,y:1,z:1}; const rot = o.rotation||{x:0,y:0,z:0};
        const cr = { id: o.id, name: o.name||`PC_${type}_${Date.now().toString(36)}`, color:o.color||null, position:pos, scale:sca, rotation:rot, uvMode: o.uvMode||null };
        try {
          const arch = XR.Shapes?.getArchetype?.(type) || XR.getArchetypeById?.(type);
          let part = arch ? (XR.addPartFromArchetype?.(arch, cr)||null) : null;
          if (!part) part = XR.Shapes?.add?.(type, cr);
          if (!part) part = XR.addShape?.(type, cr);
          if (part) return part;
        } catch(e) { console.warn('[ST.add]', type, e?.message||e); }
        return null;
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
      async function load(payload) {
        try {
          if (XR.ProjectIO?.loadProjectFromPayload) {
            await XR.ProjectIO.loadProjectFromPayload(payload, {});
            return true;
          }
        } catch(e) { console.warn('[ST.load] failed', e?.message||e); }
        return false;
      }
      return { TYPES, list, get, add, clear, serialize, load, _ctx };
    })();
    // ========= END ST HELPER =========

    function hsl(i) { return `hsl(${Math.floor(i*47) % 360}, 65%, 55%)`; }
    function rand(min, max) { return min + Math.random() * (max - min); }

    function generateAndCreateShapes(index) {
        ST.clear();
        const entityCount = Math.floor(rand(CONFIG.minEntities, CONFIG.maxEntities + 1));

        // ONE Dome / Environment plane (type D) — every project
        ST.add('D', {
          position: { x:0, y:0, z:0 },
          scale: { x: 14, y: 14, z: 1 },
          rotation: { x: -Math.PI/2, y:0, z:0 },
          name: `The Dome #${index}`,
          color: '#121212',
          uvMode: 'cube',
        });

        // N random entities
        const ids = [];
        for (let i = 0; i < entityCount; i++) {
            const tKey = TYPE_KEYS[Math.floor(Math.random() * TYPE_KEYS.length)];
            const x = rand(-9, 9);
            const y = rand(0.6, 4.5);
            const z = rand(-11, -2);
            const scale = rand(0.35, 1.5);
            const id = (crypto?.randomUUID ? crypto.randomUUID() : ('k_'+Date.now().toString(36)+'_'+i));
            const ent = ST.add(tKey, {
                id,
                position: { x, y, z },
                rotation: { x: rand(-0.2, 0.2), y: rand(0, Math.PI), z: 0 },
                scale: { x:scale, y:scale, z:scale },
                color: hsl(index * 97 + i * 3),
                name: `Shape #${index}-${i} [${ST.TYPES[tKey]}]`,
                uvMode: uvModes[(index+i) % uvModes.length],
            });
            if (ent && ent.id) ids.push(ent.id);
        }

        const totalLive = ST.list().length;
        return { ids, entityCount, domeAdded: 1, totalLive, expectedTotal: entityCount + 1 };
    }

    // ---- MAIN LOOP ----
    let errors = 0;
    let criticalErrors = [];
    let totalEntitiesProcessed = 0;
    let firstSerializedPayload = null; // snapshot of cycle 1 for final check

    try {
        for (let i = 1; i <= CONFIG.iterations; i++) {
            console.groupCollapsed(`[PROJECT-CYCLE] Cycle ${i}/${CONFIG.iterations}`);

            // Step A: Create random shapes in the scene
            const stats = generateAndCreateShapes(i);
            console.log(`   Created: ${stats.totalLive} shapes (N entities=${stats.entityCount} + 1 dome). IDs tracked: ${stats.ids.length}`);

            // Step B: Serialize (save) the project
            const payloadBefore = ST.serialize();
            if (!payloadBefore || !payloadBefore?.project?.shapes) {
                console.error(`   ❌ Serialize returned invalid payload in cycle ${i}`);
                errors++; criticalErrors.push({cycle:i, phase:'serialize', reason:'payload empty / no project.shapes'});
                console.groupEnd();
                await new Promise(r => setTimeout(r, CONFIG.delayBetweenCycles));
                continue;
            }
            if (i === 1) firstSerializedPayload = payloadBefore;
            const expectedFromPayload = payloadBefore.project.shapes.length;

            // Step C: Clear everything
            ST.clear();
            await new Promise(r => setTimeout(r, 120));
            const afterClearCount = ST.list().length;
            if (afterClearCount !== 0) {
                console.error(`   ❌ After clear: expected 0 shapes, found ${afterClearCount} (cycle ${i})`);
                errors++; criticalErrors.push({cycle:i, phase:'clear', expected:0, found: afterClearCount});
            } else {
                console.log(`   ✅ Clear pass: 0 shapes remaining.`);
            }

            // Step D: Load the serialized payload back
            const loadOk = await ST.load(payloadBefore);
            await new Promise(r => setTimeout(r, 300));
            const afterLoadCount = ST.list().length;

            if (!loadOk) {
                console.error(`   ❌ ST.load returned FALSE (cycle ${i})`);
                errors++; criticalErrors.push({cycle:i, phase:'load-return', reason:'load() returned false'});
            }
            if (afterLoadCount !== expectedFromPayload) {
                console.error(`   ❌ Mismatch after load! Expected ${expectedFromPayload}, found ${afterLoadCount} (cycle ${i})`);
                errors++; criticalErrors.push({cycle:i, phase:'load-count', expected: expectedFromPayload, found: afterLoadCount});
            } else {
                const hasDome = ST.list().some(s => { const n = s.name || ''; return n.includes('Dome') || n.startsWith('The Dome'); });
                if (!hasDome) {
                    console.error(`   ❌ Dome missing after load in cycle ${i}!`);
                    errors++; criticalErrors.push({cycle:i, phase:'load-dome', reason:'Dome not present in shapes after load'});
                } else {
                    console.log(`   ✅ Load pass: ${afterLoadCount} shapes + Dome OK.`);
                }
            }

            totalEntitiesProcessed += (stats.totalLive + afterLoadCount);

            // Memory check (Chrome only)
            if (window.performance && window.performance.memory) {
                const used = Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024);
                console.log(`   💾 Memory (usedJSHeap): ${used} MB`);
            }

            console.groupEnd();
            await new Promise(r => setTimeout(r, CONFIG.delayBetweenCycles));
        }
    } catch (e) {
        console.error('[PROJECT-CYCLE] 💥 Critical uncaught error during stress test:', e);
        errors++;
        criticalErrors.push({cycle:'N/A', phase:'uncaught', reason: String(e?.message || e).slice(0, 300)});
    } finally {
        // Final verification: reload first cycle's payload and confirm shape count still matches
        if (firstSerializedPayload) {
          console.log('[PROJECT-CYCLE] 🔎 Final verify: reloading cycle 1 payload…');
          ST.clear(); await new Promise(r=>setTimeout(r,80));
          await ST.load(firstSerializedPayload); await new Promise(r=>setTimeout(r,250));
          const fCount = ST.list().length;
          const fExpected = firstSerializedPayload.project.shapes.length;
          if (fCount !== fExpected) {
            console.error(`   ❌ Final verification FAILED: cycle-1 expected=${fExpected}, after re-load=${fCount}`);
            errors++; criticalErrors.push({cycle:'final-verify', phase:'load-cycle1', expected:fExpected, found:fCount});
          } else {
            console.log(`   ✅ Final verification OK: cycle-1 payload still roundtrips (${fCount} shapes).`);
          }
        }

        console.log('%c[PROJECT-CYCLE] 🏁 COMPLETE', 'color: white; background: #28a745; font-size: 14px; padding: 5px;');
        if (errors === 0) {
            console.log(`%c✨ SUCCESS: ${CONFIG.iterations} cycles completed. ~${totalEntitiesProcessed} entities processed. No errors.`, 'color: green; font-weight: bold;');
        } else {
            console.log(`%c⚠️ COMPLETED WITH ${errors} ERROR(S):`, 'color: orange; font-weight: bold;', criticalErrors);
        }
        console.table?.([
          { metric: 'Iterations', value: CONFIG.iterations },
          { metric: 'Entities processed (est.)', value: totalEntitiesProcessed },
          { metric: 'Errors', value: errors },
          { metric: 'Critical errors list', value: criticalErrors.length },
        ]);
    }

    const RESULT = {
        status: errors === 0 ? 'SUCCESS' : 'FAILED',
        iterations: CONFIG.iterations,
        totalEntitiesProcessed,
        errorsCount: errors,
        criticalErrors,
    };
    try { window.__RESULTS__ = window.__RESULTS__ || {}; window.__RESULTS__.pcyc = RESULT; } catch (_) {}
    return RESULT;
})();
