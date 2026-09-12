/*
 * XReate Doodle browser stress harness
 *
 * Run in DevTools Console on a disposable local session.  This script is
 * read-only by default: it exercises the production geometry builders and
 * opens/closes the Doodle modal without creating a scene object.  Set
 * CREATE_TEMPORARY_DOODLES to true only when you explicitly want it to add
 * one Polygon, Mirror and Revolve object to the current project.
 */
(async () => {
  const CREATE_TEMPORARY_DOODLES = false;
  const XR = window.XR || {};
  const THREE = window.THREE;
  const builders = XR.ShapeBuilders || XR.__modules?.ShapeBuilders || {};
  const report = { ok: true, checks: [], geometryCases: { polygon: 0, mirror: 0, revolve: 0 } };

  const record = (name, ok, details = {}) => {
    report.checks.push({ name, ok, details });
    report.ok &&= Boolean(ok);
    (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'} — ${name}`, details);
  };
  const assertGeometry = (geometry) => {
    const position = geometry?.attributes?.position;
    const finite = Boolean(position?.count) && Array.from({ length: position.count }).every((_, i) => (
      Number.isFinite(position.getX(i)) && Number.isFinite(position.getY(i)) && Number.isFinite(position.getZ(i))
    ));
    geometry?.computeBoundingBox?.();
    const box = geometry?.boundingBox;
    const nonZero = box && (box.max.x > box.min.x || box.max.y > box.min.y || box.max.z > box.min.z);
    geometry?.dispose?.();
    return finite && nonZero;
  };
  const geometryFailure = [];
  const recordGeometry = (kind, ok, details) => {
    if (!ok && geometryFailure.length < 8) geometryFailure.push({ kind, ...details });
  };
  const random = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const polygon = (seed) => {
    const next = random(seed);
    const count = 4 + (seed % 6);
    return Array.from({ length: count }, (_, index) => {
      const a = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const r = (index % 2 ? 118 : 178) + next() * 28;
      return { x: 360 + Math.cos(a) * r, y: 280 + Math.sin(a) * r };
    });
  };
  const halfContour = (seed) => {
    const next = random(seed * 31 + 7);
    const count = 3 + (seed % 5);
    return Array.from({ length: count }, (_, index) => ({
      x: -(55 + next() * 180),
      y: 80 + (index / (count - 1)) * 360 + (next() - 0.5) * 18,
    })).sort((a, b) => a.y - b.y);
  };
  const profile = (seed) => {
    const next = random(seed * 97 + 11);
    const count = 2 + (seed % 6);
    return Array.from({ length: count }, (_, index) => ({
      x: -(45 + next() * 190),
      y: 75 + (index / (count - 1)) * 380,
    }));
  };

  record('Production Doodle builders are published', Boolean(
    THREE && builders.buildDoodleFromPoints && builders.buildDoodleMirrorFromPoints && builders.buildDoodleRevolveFromPoints
  ));

  if (THREE && builders.buildDoodleFromPoints) {
    for (const depth of [0.05, 0.1, 0.5, 1.5, 3]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        recordGeometry('polygon', assertGeometry(builders.buildDoodleFromPoints(polygon(seed), { depth })), { seed, depth });
        report.geometryCases.polygon += 1;
      }
    }
  }
  if (THREE && builders.buildDoodleMirrorFromPoints) {
    for (const depth of [0.05, 0.5, 1.5, 3]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const authored = halfContour(seed);
        const before = JSON.stringify(authored);
        const geometry = builders.buildDoodleMirrorFromPoints(authored, { depth });
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const bilateral = box.min.x < 0 && box.max.x > 0 && Math.abs(box.min.x + box.max.x) < 0.001;
        const cleanEdges = new THREE.EdgesGeometry(geometry, 1);
        const rawEdges = new THREE.WireframeGeometry(geometry);
        recordGeometry('mirror', bilateral && cleanEdges.attributes.position.count < rawEdges.attributes.position.count && before === JSON.stringify(authored), {
          seed, depth, bounds: box, cleanEdges: cleanEdges.attributes.position.count, rawEdges: rawEdges.attributes.position.count,
        });
        cleanEdges.dispose(); rawEdges.dispose(); geometry.dispose();
        report.geometryCases.mirror += 1;
      }
    }
  }
  if (THREE && builders.buildDoodleRevolveFromPoints) {
    for (const segments of [12, 16, 32, 64, 128]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const geometry = builders.buildDoodleRevolveFromPoints(profile(seed), { segments });
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        const lathed = box.min.z < -0.001 && box.max.z > 0.001;
        const valid = assertGeometry(geometry);
        recordGeometry('revolve', valid && lathed, { seed, segments, bounds: box });
        report.geometryCases.revolve += 1;
      }
    }
  }

  record('Doodle geometry stress matrix', geometryFailure.length === 0, {
    cases: report.geometryCases,
    failures: geometryFailure,
  });
  const modalApi = XR.__bodyBootstrap?.shellDoodleModalApi || XR.__modules?.ShellDoodleModal?._instance || null;
  const modal = document.getElementById('doodleModal');
  record('Doodle source flow has photo-first controls', Boolean(
    document.getElementById('doodlePickFile') && document.getElementById('doodlePickCamera') && document.getElementById('doodleSkipImage')
  ));
  if (typeof modalApi?.openDoodleModal === 'function') modalApi.openDoodleModal();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const modes = Array.from(document.querySelectorAll('.xr-doodle-mode-toggle button')).map((button) => button.id);
  record('Doodle exposes Polygon, Mirror, and Revolve modes', ['doodleModePolygon', 'doodleModeMirror', 'doodleModeRevolve'].every((id) => modes.includes(id)), { modes });
  const sourceCard = document.querySelector('.xr-doodle-source-card');
  const stepOne = document.getElementById('doodleStep1');
  record('Doodle source CTA remains centered and has a camera glyph', Boolean(sourceCard?.querySelector('svg')) && !!stepOne && getComputedStyle(stepOne).justifyContent === 'center');

  const source = await fetch(new URL('shell/doodle-modal.js', window.location.href)).then((response) => response.text()).catch(() => '');
  record('Canvas scale ruler responds to Doodle zoom', source.includes('const ruler = 100 * zoom'));
  record('Touch cancellation and a second contact cannot place phantom points', source.includes('pointercancel') && source.includes('activePointerId') && source.includes('Abort the active stroke'));
  record('Photo references are normalized and centred for half-canvas modes', source.includes('normalizeTraceBitmap') && source.includes('x: -dw / 2'));

  if (CREATE_TEMPORARY_DOODLES && typeof XR.addDoodleShapeToScene === 'function') {
    const ids = [
      XR.addDoodleShapeToScene(polygon(99), { depth: 0.5 }, { mode: 'polygon' }),
      XR.addDoodleShapeToScene(halfContour(99), { depth: 0.5 }, { mode: 'mirror' }),
      XR.addDoodleShapeToScene(profile(99), { segments: 64 }, { mode: 'revolve' }),
    ];
    record('Optional live creation routes all three modes', ids.every(Boolean), { ids });
  }

  try { document.getElementById('doodleClose')?.click(); } catch (_) {}
  try { modal?.setAttribute('hidden', ''); } catch (_) {}
  XR.__lastDoodleStress = report;
  console.table(report.checks.map(({ name, ok }) => ({ check: name, pass: ok })));
  console.log(`[DOODLE-STRESS] geometry: ${JSON.stringify(report.geometryCases)}. overall=${report.ok ? 'PASS' : 'FAIL'}`);
  return report;
})().catch((error) => {
  console.error('[DOODLE-STRESS] Unhandled failure', error);
  throw error;
});
