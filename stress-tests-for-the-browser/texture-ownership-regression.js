/*
 * Run in the XReate page DevTools console. This is intentionally DOM-driven:
 * it validates the public UI path rather than bypassing the legacy bridge, then
 * restores the project that was open when the check started.
 */
(async () => {
  // Tree selection is synchronous. This short wait only allows the inspector
  // to render; it is not a grace period before selecting the requested part.
  const wait = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
  const click = async (selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Missing control: ${selector}`);
    el.click();
    await wait();
  };
  const activeName = () => document.querySelector('.xr-tree-row.is-active .xr-tree-row__name')?.textContent?.trim() || '';
  const value = (id) => document.getElementById(id)?.textContent?.trim() || '';
  const waitForEnabled = async (id, timeoutMs = 5000) => {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const el = document.getElementById(id);
      if (el && !el.disabled) return el;
      await wait(80);
    }
    throw new Error(`Texture control ${id} did not become available after ${timeoutMs}ms`);
  };
  const setInput = async (id, nextValue) => {
    const el = document.getElementById(id);
    if (!el || el.disabled) throw new Error('Texture scale control is unavailable');
    el.value = String(nextValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
  };
  const activeLayerTransform = () => {
    const transform = window.XR?.ProjectStore?.getActiveLayerState?.()?.transform;
    if (!transform) throw new Error('Active layer state is unavailable');
    return {
      x: Number(transform.x || 0),
      y: Number(transform.y || 0),
      scale: Number(transform.scale || 1),
      rot: Number(transform.rot || 0),
      ratio: Number(transform.ratio || 1),
    };
  };
  const dragCanvas = async (dx = 48, dy = 36) => {
    const canvas = document.getElementById('imageCanvas');
    if (!canvas) throw new Error('Texture canvas is unavailable');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) throw new Error('Texture canvas is not visible');
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const pointer = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId: 91,
      pointerType: 'mouse',
      button: 0,
      buttons,
      clientX: x,
      clientY: y,
    }));
    pointer('pointerdown', startX, startY, 1);
    // The first move passes the intentional-drag threshold; the second applies it.
    pointer('pointermove', startX + dx / 2, startY + dy / 2, 1);
    pointer('pointermove', startX + dx, startY + dy, 1);
    pointer('pointerup', startX + dx, startY + dy, 0);
    await wait(180);
  };
  const report = { ok: true, checks: [] };
  const io = window.XR?.ProjectIO || window.XR?.__modules?.ProjectIO;
  if (!io?.buildProjectSavePayload || !io?.loadProjectFromPayload) throw new Error('Project IO is not ready');
  const originalProject = io.buildProjectSavePayload();
  const check = (name, ok, details) => {
    report.checks.push({ name, ok, details });
    report.ok &&= ok;
    console[ok ? 'info' : 'error'](`[texture ownership] ${ok ? 'PASS' : 'FAIL'} ${name}`, details || '');
  };

  try {
  await click('#btn-add-shape');
  await click('[aria-label="Add volume: Cube"]');
  await click('[data-mode-target="texture"]');
  await click('#btn-uv-checker');
  // Checker creation and the Texture panel selection update are asynchronous.
  // A fixed 200ms sleep raced that work on real machines.
  await waitForEnabled('imgScale');
  const originalName = activeName();
  await setInput('imgScale', 172);
  await setInput('imgRotate', 25);
  await setInput('imgRatio', 145);
  const original = { scale: value('imgScaleVal'), rotation: value('imgRotateVal'), ratio: value('imgRatioVal') };
  await dragCanvas();
  const originalAfterCanvasDrag = activeLayerTransform();
  await click('[data-mode-target="draft3d"]');
  await click('#btn-tree-dup'); // A -> B
  await click('#btn-tree-dup'); // B -> C
  await click('[data-mode-target="texture"]');
  const copyName = activeName();
  await setInput('imgScale', 180);
  await setInput('imgRotate', 70);
  await setInput('imgRatio', 80);
  const copy = { scale: value('imgScaleVal'), rotation: value('imgRotateVal'), ratio: value('imgRatioVal') };
  await dragCanvas(-64, 42);
  const copyAfterCanvasDrag = activeLayerTransform();
  await click('[data-mode-target="draft3d"]');
  const originalRow = Array.from(document.querySelectorAll('.xr-tree-row__name')).find(el => el.textContent.trim() === originalName);
  if (!originalRow) throw new Error('Original entity row not found');
  originalRow.click();
  await click('[data-mode-target="texture"]');
  const restoredOriginal = { scale: value('imgScaleVal'), rotation: value('imgRotateVal'), ratio: value('imgRatioVal') };
  const restoredOriginalTransform = activeLayerTransform();
  await setInput('imgScale', 164);
  await setInput('imgRotate', -15);
  await setInput('imgRatio', 120);
  const changedOriginal = { scale: value('imgScaleVal'), rotation: value('imgRotateVal'), ratio: value('imgRatioVal') };
  await dragCanvas(32, -52);
  const changedOriginalTransform = activeLayerTransform();
  await click('[data-mode-target="draft3d"]');
  const copyRow = Array.from(document.querySelectorAll('.xr-tree-row__name')).find(el => el.textContent.trim() === copyName);
  if (!copyRow) throw new Error('Copied entity row not found');
  copyRow.click();
  await click('[data-mode-target="texture"]');
  const restoredCopy = { scale: value('imgScaleVal'), rotation: value('imgRotateVal'), ratio: value('imgRatioVal') };
  const restoredCopyTransform = activeLayerTransform();
  check('A -> B -> C selects a distinct copy', Boolean(copyName && copyName !== originalName), { originalName, copyName });
  check('C UV transform does not mutate A', JSON.stringify(restoredOriginal) === JSON.stringify(original), { original, copy, restoredOriginal });
  check('A UV transform does not mutate C', JSON.stringify(restoredCopy) === JSON.stringify(copy), { changedOriginal, copy, restoredCopy });
  check('Canvas drag on C does not mutate A', JSON.stringify(restoredOriginalTransform) === JSON.stringify(originalAfterCanvasDrag), {
    originalAfterCanvasDrag,
    copyAfterCanvasDrag,
    restoredOriginalTransform,
  });
  check('Canvas drag on A does not mutate C', JSON.stringify(restoredCopyTransform) === JSON.stringify(copyAfterCanvasDrag), {
    changedOriginalTransform,
    copyAfterCanvasDrag,
    restoredCopyTransform,
  });
  } finally {
    try {
      await io.loadProjectFromPayload(originalProject);
      report.restored = true;
    } catch (restoreError) {
      report.restored = false;
      report.restoreError = String(restoreError?.message || restoreError);
      console.error('[texture ownership] project restore failed', restoreError);
    }
  }
  window.XR = window.XR || {};
  window.XR.__lastTextureOwnershipRegression = report;
  console[report.ok ? 'info' : 'error']('[texture ownership] final report', report);
  return report;
})().catch((error) => {
  const report = { ok: false, error: String(error?.message || error) };
  window.XR = window.XR || {};
  window.XR.__lastTextureOwnershipRegression = report;
  console.error('[texture ownership] setup or test failed', error);
  return report;
});
