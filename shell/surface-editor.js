// Responsibility: own surface editor shell UI for layer list and image transform controls.
// Reads from: DOM and callbacks passed from the legacy runtime.
// Writes to: layer list DOM, surface control states, and image transform input bindings.
// Exposes to: window.XR.__modules.ShellSurfaceEditor

const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const onWithSignal = (opts && typeof opts.onWithSignal === 'function') ? opts.onWithSignal : null;
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const ensureLayersOnPart = (opts && typeof opts.ensureLayersOnPart === 'function') ? opts.ensureLayersOnPart : (() => {});
  const getActiveLayer = (opts && typeof opts.getActiveLayer === 'function') ? opts.getActiveLayer : (() => null);
  const getActiveLayerIndex = (opts && typeof opts.getActiveLayerIndex === 'function') ? opts.getActiveLayerIndex : (() => 0);
  const setActiveLayer = (opts && typeof opts.setActiveLayer === 'function') ? opts.setActiveLayer : (() => {});
  const getImageTransform = (opts && typeof opts.getImageTransform === 'function') ? opts.getImageTransform : (() => null);
  const updateImageTransform = (opts && typeof opts.updateImageTransform === 'function') ? opts.updateImageTransform : null;
  const toggleLayerVisibility = (opts && typeof opts.toggleLayerVisibility === 'function') ? opts.toggleLayerVisibility : (() => {});
  const renameLayer = (opts && typeof opts.renameLayer === 'function') ? opts.renameLayer : (() => {});
  const layerHasPolygonMask = (opts && typeof opts.layerHasPolygonMask === 'function') ? opts.layerHasPolygonMask : (() => false);
  const toggleLayerPolygonMask = (opts && typeof opts.toggleLayerPolygonMask === 'function') ? opts.toggleLayerPolygonMask : (() => {});
  const duplicateLayer = (opts && typeof opts.duplicateLayer === 'function') ? opts.duplicateLayer : (() => {});
  const moveLayer = (opts && typeof opts.moveLayer === 'function') ? opts.moveLayer : (() => {});
  const deleteLayer = (opts && typeof opts.deleteLayer === 'function') ? opts.deleteLayer : (() => {});
  const commitActiveLayerTransform = (opts && typeof opts.commitActiveLayerTransform === 'function') ? opts.commitActiveLayerTransform : (() => {});
  const drawBaseLayer = (opts && typeof opts.drawBaseLayer === 'function') ? opts.drawBaseLayer : (() => {});
  const requestApplyTexture = (opts && typeof opts.requestApplyTexture === 'function') ? opts.requestApplyTexture : (() => {});
  const isRatioAllowedForPart = (opts && typeof opts.isRatioAllowedForPart === 'function') ? opts.isRatioAllowedForPart : (() => true);
  const canImportImagesNow = (opts && typeof opts.canImportImagesNow === 'function') ? opts.canImportImagesNow : (() => false);
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((key) => String(key || ''));
  const fillImageToCanvas = (opts && typeof opts.fillImageToCanvas === 'function') ? opts.fillImageToCanvas : (() => {});
  const loadImageFromFile = (opts && typeof opts.loadImageFromFile === 'function') ? opts.loadImageFromFile : (() => {});

  let renderLayerListAbortController = null;
  let renameLayerModalState = null;
  let renameLayerPending = null;
  let renameLayerValidate = null;
  let renameLayerMaxLen = 32;
  let uvWorkspaceModalState = null;
  let uvWorkspacePortals = [];
  let uvWorkspaceViewAbortController = null;
  let uvWorkspaceView = { zoom: 1, x: 0, y: 0, pan: false };
  let uvWorkspaceWheelTarget = 'texture';

  function setRenameLayerModalStacking(modal, active) {
    if (!modal) return;
    if (!active) {
      modal.style.removeProperty('z-index');
      return;
    }
    const workspace = document.getElementById('uvWorkspaceModal');
    if (!workspace || workspace.hidden) return;
    const workspaceZ = Number.parseInt(window.getComputedStyle(workspace).zIndex, 10);
    modal.style.zIndex = String((Number.isFinite(workspaceZ) ? workspaceZ : 1000) + 2);
  }

  function bindAbortable(signal, target, ev, fn, opts2) {
    if (!target) return;
    if (onWithSignal) {
      onWithSignal(signal, target, ev, fn, opts2);
      return;
    }
    target.addEventListener(ev, fn, opts2);
  }

  function getTransform() {
    return getImageTransform() || {
      x: 0,
      y: 0,
      scale: 1,
      rot: 0,
      ratio: 1,
      tile: false,
      tileScale: 1,
      tileAnchor: 'center',
      tileRepeat: 'repeat',
    };
  }

  function syncImageSliderControlsFromTransform() {
    const imageTransform = getTransform();
    const sliderS = document.getElementById('imgScale');
    const sliderR = document.getElementById('imgRotate');
    const sliderRatio = document.getElementById('imgRatio');
    const sliderTile = document.getElementById('imgTile');
    if (sliderS) sliderS.value = String(Math.round(imageTransform.scale * 100));
    if (sliderR) sliderR.value = String(Math.round(imageTransform.rot));
    if (sliderRatio) sliderRatio.value = String(Math.round((Number.isFinite(imageTransform.ratio) ? imageTransform.ratio : 1) * 100));
    if (sliderTile) sliderTile.value = String(Math.round((Number.isFinite(imageTransform.tileScale) ? imageTransform.tileScale : 1) * 100));
  }

  function renderLayerListUI() {
    const el = document.getElementById('layerList');
    if (!el) return;
    try { renderLayerListAbortController?.abort?.(); } catch (_) {}
    renderLayerListAbortController = new AbortController();
    const sig = renderLayerListAbortController.signal;
    const on = (target, ev, fn, opts2) => bindAbortable(sig, target, ev, fn, opts2);
    const emptyHint = document.getElementById('layerEmptyHint');
    const part = getSelectedPart();
    if (!part) {
      el.innerHTML = '';
      el.hidden = true;
      if (emptyHint) emptyHint.hidden = false;
      return;
    }
    ensureLayersOnPart(part);
    const layers = part.layers || [];
    el.innerHTML = '';
    el.hidden = layers.length === 0;
    if (emptyHint) emptyHint.hidden = layers.length > 0;
    const activeLayerIndex = getActiveLayerIndex();
    for (let idx = layers.length - 1; idx >= 0; idx -= 1) {
      const layer = layers[idx] || {};
      const row = document.createElement('div');
      row.className = 'xr-layer-row' + (idx === activeLayerIndex ? ' is-active' : '');
      row.dataset.idx = String(idx);
      row.setAttribute('role', 'listitem');

      const vis = document.createElement('button');
      vis.type = 'button';
      vis.className = 'xr-layer-vis';
      vis.setAttribute('aria-label', 'Toggle layer visibility');
      vis.textContent = (layer.visible === false) ? '○' : '●';
      on(vis, 'click', (e) => { e.stopPropagation(); toggleLayerVisibility(idx); });

      const label = document.createElement('span');
      label.className = 'xr-layer-label';
      label.textContent = String(layer.label || ('Layer ' + (idx + 1)));

      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'xr-layer-rename';
      rename.textContent = '✎';
      rename.setAttribute('aria-label', 'Rename layer');
      on(rename, 'click', (e) => { e.stopPropagation(); renameLayer(idx); });

      const mask = document.createElement('button');
      mask.type = 'button';
      mask.className = 'xr-layer-mask' + (layerHasPolygonMask(layer) ? ' is-on' : '');
      mask.textContent = 'Mask';
      mask.setAttribute('aria-label', 'Toggle polygon mask');
      on(mask, 'click', (e) => { e.stopPropagation(); toggleLayerPolygonMask(idx); });

      const dup = document.createElement('button');
      dup.type = 'button';
      dup.className = 'xr-layer-dup';
      dup.textContent = '⧉';
      dup.setAttribute('aria-label', 'Duplicate layer');
      on(dup, 'click', (e) => { e.stopPropagation(); duplicateLayer(idx); });

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'xr-layer-move';
      up.textContent = '↑';
      up.disabled = idx === layers.length - 1;
      up.setAttribute('aria-label', 'Move layer up');
      on(up, 'click', (e) => { e.stopPropagation(); moveLayer(idx, +1); });

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'xr-layer-move';
      down.textContent = '↓';
      down.disabled = idx === 0;
      down.setAttribute('aria-label', 'Move layer down');
      on(down, 'click', (e) => { e.stopPropagation(); moveLayer(idx, -1); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'xr-layer-del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Delete layer');
      on(del, 'click', (e) => { e.stopPropagation(); deleteLayer(idx); });

      row.append(vis, label, rename, mask, dup, up, down, del);
      on(row, 'click', () => setActiveLayer(idx));
      el.appendChild(row);
    }
  }

  function updateTransformUi() {
    const imageTransform = getTransform();
    const scaleVal = document.getElementById('imgScaleVal');
    const rotVal = document.getElementById('imgRotateVal');
    const ratioVal = document.getElementById('imgRatioVal');
    const tileVal = document.getElementById('imgTileVal');
    if (scaleVal) scaleVal.textContent = '×' + imageTransform.scale.toFixed(2);
    if (rotVal) rotVal.textContent = `${Math.round(imageTransform.rot)}°`;
    if (ratioVal) ratioVal.textContent = (Number.isFinite(imageTransform.ratio) ? imageTransform.ratio : 1).toFixed(2);
    if (tileVal) tileVal.textContent = '×' + (Number.isFinite(imageTransform.tileScale) ? imageTransform.tileScale : 1).toFixed(2);
    const part = getSelectedPart();
    const layer = getActiveLayer();
    const canMap = !!(layer && layer.imageBitmap);
    const canTile = canMap;
    const imgScaleSlider = document.getElementById('imgScale');
    const imgRotateSlider = document.getElementById('imgRotate');
    const ratioSlider = document.getElementById('imgRatio');
    const uvWorkspaceButton = document.getElementById('btn-uv-workspace');
    if (imgScaleSlider) imgScaleSlider.disabled = !canMap;
    if (imgRotateSlider) imgRotateSlider.disabled = !canMap;
    if (ratioSlider) ratioSlider.disabled = !canMap || !isRatioAllowedForPart(part);
    if (scaleVal) scaleVal.disabled = !canMap;
    if (rotVal) rotVal.disabled = !canMap;
    if (ratioVal) ratioVal.disabled = !canMap || !isRatioAllowedForPart(part);
    if (uvWorkspaceButton) uvWorkspaceButton.disabled = !canMap;
    const imgXformHint = document.getElementById('imgXformHint');
    if (imgXformHint) imgXformHint.hidden = canMap || !canImportImagesNow();
  }

  function updateTextureImportAvailability() {
    const btn = document.getElementById('btn-import-image');
    const input = document.getElementById('imgFileInput');
    const ok = canImportImagesNow();
    if (btn) btn.disabled = !ok;
    if (input) input.disabled = !ok;
    const uvSelect = document.getElementById('uvModeSelect');
    if (uvSelect) uvSelect.disabled = !ok;
    const bChecker = document.getElementById('btn-uv-checker');
    if (bChecker) bChecker.disabled = !ok;
    const uvWorkspaceButton = document.getElementById('btn-uv-workspace');
    if (uvWorkspaceButton) uvWorkspaceButton.disabled = !getActiveLayer()?.imageBitmap;
  }

  function openRenameLayerModal(currentValue, onSubmit, opts2) {
    const modal = document.getElementById('renameLayerModal');
    const input = document.getElementById('renameLayerInput');
    const errorEl = document.getElementById('renameLayerError');
    const btnCancel = document.getElementById('renameLayerCancel');
    const btnOk = document.getElementById('renameLayerOk');
    if (!modal || !input || !btnCancel || !btnOk) return;
    const open = XR?.openModal || XR?.__modules?.ShellModal?.openModal || null;
    const close = XR?.closeModal || XR?.__modules?.ShellModal?.closeModal || null;

    if (!modal.dataset.bound) {
      modal.dataset.bound = '1';
      const doClose = (apply) => {
        if (apply && typeof renameLayerPending === 'function') {
          const name = String(input.value || '').trim();
          let err = '';
          if (!name) err = tr('layer_name_empty');
          else if (name.length > renameLayerMaxLen) err = tr('layer_name_too_long').replace('{n}', String(renameLayerMaxLen));
          else if (renameLayerValidate && !renameLayerValidate(name)) err = tr('layer_name_duplicate');
          if (err) {
            if (errorEl) {
              errorEl.hidden = false;
              errorEl.textContent = err;
            }
            input.setAttribute('aria-invalid', 'true');
            return;
          }
          if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = '';
          }
          input.removeAttribute('aria-invalid');
          const pending = renameLayerPending;
          renameLayerPending = null;
          try { if (renameLayerModalState && close) close(renameLayerModalState); } catch (_) {}
          renameLayerModalState = null;
          setRenameLayerModalStacking(modal, false);
          pending(name);
          return;
        }
        renameLayerPending = null;
        try { if (renameLayerModalState && close) close(renameLayerModalState); } catch (_) {}
        renameLayerModalState = null;
        setRenameLayerModalStacking(modal, false);
      };
      btnCancel.addEventListener('click', () => doClose(false));
      btnOk.addEventListener('click', () => doClose(true));
      modal.addEventListener('click', (e) => { if (e.target === modal) doClose(false); });
      input.addEventListener('keydown', (e) => {
        if (!e) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          doClose(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          doClose(false);
        }
      });
    }

    renameLayerMaxLen = (opts2 && typeof opts2.maxLen === 'number') ? opts2.maxLen : 32;
    renameLayerValidate = (opts2 && typeof opts2.validate === 'function') ? opts2.validate : null;
    renameLayerPending = (name) => {
      try {
        if (typeof onSubmit === 'function') onSubmit(String(name || '').trim());
      } catch (_) {}
    };
    input.value = String(currentValue || '');
    try { input.maxLength = renameLayerMaxLen; } catch (_) {}
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    input.removeAttribute('aria-invalid');
    try {
      setRenameLayerModalStacking(modal, true);
      renameLayerModalState = open ? (open(modal, { initialFocusEl: input, returnFocusEl: document.activeElement }) || null) : null;
    } catch (_) {
      setRenameLayerModalStacking(modal, false);
      renameLayerModalState = null;
    }
  }

  function applyLayerTransformChange() {
    updateTransformUi();
    commitActiveLayerTransform();
    drawBaseLayer();
    requestApplyTexture(true);
  }

  function restoreUvWorkspacePortals() {
    for (let i = uvWorkspacePortals.length - 1; i >= 0; i -= 1) {
      const portal = uvWorkspacePortals[i];
      if (!portal?.node || !portal.parent) continue;
      if (portal.next && portal.next.parentNode === portal.parent) portal.parent.insertBefore(portal.node, portal.next);
      else portal.parent.appendChild(portal.node);
    }
    uvWorkspacePortals = [];
  }

  function getUvWorkspaceDrawWrap() {
    const drawWrap = document.getElementById('drawWrap');
    return drawWrap?.parentElement?.id === 'uvWorkspaceCanvasHost' ? drawWrap : null;
  }

  function syncUvWorkspaceViewUi() {
    const zoomValue = document.getElementById('uvWorkspaceZoomValue');
    const panButton = document.getElementById('uvWorkspacePan');
    const wheelTextureButton = document.getElementById('uvWorkspaceWheelTexture');
    const wheelViewButton = document.getElementById('uvWorkspaceWheelView');
    if (zoomValue) zoomValue.value = `${Math.round(uvWorkspaceView.zoom * 100)}%`;
    if (panButton) panButton.setAttribute('aria-pressed', uvWorkspaceView.pan ? 'true' : 'false');
    if (wheelTextureButton) wheelTextureButton.setAttribute('aria-pressed', uvWorkspaceWheelTarget === 'texture' ? 'true' : 'false');
    if (wheelViewButton) wheelViewButton.setAttribute('aria-pressed', uvWorkspaceWheelTarget === 'view' ? 'true' : 'false');
  }

  function applyUvWorkspaceView() {
    const drawWrap = getUvWorkspaceDrawWrap();
    if (!drawWrap) return false;
    drawWrap.style.transformOrigin = 'center center';
    drawWrap.style.transform = `translate3d(${Math.round(uvWorkspaceView.x)}px, ${Math.round(uvWorkspaceView.y)}px, 0) scale(${uvWorkspaceView.zoom})`;
    drawWrap.classList.toggle('is-uv-workspace-panning', uvWorkspaceView.pan);
    syncUvWorkspaceViewUi();
    return true;
  }

  function resetUvWorkspaceView() {
    uvWorkspaceView = { zoom: 1, x: 0, y: 0, pan: false };
    return applyUvWorkspaceView();
  }

  function setUvWorkspaceZoom(nextZoom) {
    uvWorkspaceView.zoom = Math.max(0.5, Math.min(4, Number(nextZoom) || 1));
    return applyUvWorkspaceView();
  }

  function toggleUvWorkspacePan() {
    uvWorkspaceView.pan = !uvWorkspaceView.pan;
    return applyUvWorkspaceView();
  }

  function setUvWorkspaceWheelTarget(target) {
    uvWorkspaceWheelTarget = target === 'view' ? 'view' : 'texture';
    syncUvWorkspaceViewUi();
  }

  function zoomTextureFromWorkspaceWheel(factor) {
    const slider = document.getElementById('imgScale');
    if (!slider || slider.disabled) return false;
    const current = Number(slider.value) || 100;
    slider.value = String(Math.max(5, Math.min(2000, Math.round(current * factor))));
    try { slider.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    return true;
  }

  function uninstallUvWorkspaceViewGestures() {
    try { uvWorkspaceViewAbortController?.abort?.(); } catch (_) {}
    uvWorkspaceViewAbortController = null;
  }

  function installUvWorkspaceViewGestures() {
    uninstallUvWorkspaceViewGestures();
    const host = document.getElementById('uvWorkspaceCanvasHost');
    if (!host) return false;
    const controller = new AbortController();
    const signal = controller.signal;
    let drag = null;
    host.addEventListener('pointerdown', (event) => {
      if (!uvWorkspaceView.pan || event.target?.closest?.('.xr-uv-workspace__view-tools')) return;
      if (event.button !== undefined && event.button !== 0) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: uvWorkspaceView.x, originY: uvWorkspaceView.y };
      try { host.setPointerCapture?.(event.pointerId); } catch (_) {}
      try { event.preventDefault(); event.stopImmediatePropagation(); } catch (_) {}
    }, { capture: true, signal });
    host.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      uvWorkspaceView.x = drag.originX + event.clientX - drag.x;
      uvWorkspaceView.y = drag.originY + event.clientY - drag.y;
      applyUvWorkspaceView();
      try { event.preventDefault(); event.stopImmediatePropagation(); } catch (_) {}
    }, { capture: true, signal });
    const endDrag = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      try { host.releasePointerCapture?.(event.pointerId); } catch (_) {}
      drag = null;
      try { event.preventDefault(); event.stopImmediatePropagation(); } catch (_) {}
    };
    host.addEventListener('pointerup', endDrag, { capture: true, signal });
    host.addEventListener('pointercancel', endDrag, { capture: true, signal });
    host.addEventListener('wheel', (event) => {
      if (event.target?.closest?.('.xr-uv-workspace__view-tools')) return;
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      if (uvWorkspaceWheelTarget === 'texture') zoomTextureFromWorkspaceWheel(factor);
      else setUvWorkspaceZoom(uvWorkspaceView.zoom * factor);
      try { event.preventDefault(); event.stopImmediatePropagation(); } catch (_) {}
    }, { capture: true, passive: false, signal });
    uvWorkspaceViewAbortController = controller;
    return true;
  }

  function scheduleWorkspaceRedraw() {
    const nextFrame = window.requestAnimationFrame || ((fn) => window.setTimeout(fn, 0));
    nextFrame(() => {
      try { drawBaseLayer(); } catch (_) {}
      try { requestApplyTexture(true); } catch (_) {}
    });
  }

  function closeUvWorkspace() {
    const modal = document.getElementById('uvWorkspaceModal');
    const close = XR?.closeModal || XR?.__modules?.ShellModal?.closeModal || null;
    uninstallUvWorkspaceViewGestures();
    resetUvWorkspaceView();
    restoreUvWorkspacePortals();
    if (uvWorkspaceModalState && close) {
      const state = uvWorkspaceModalState;
      uvWorkspaceModalState = null;
      try { close(state); } catch (_) {}
    } else if (modal && close) {
      try { close(modal); } catch (_) {}
    }
    scheduleWorkspaceRedraw();
  }

  function openUvWorkspace() {
    const modal = document.getElementById('uvWorkspaceModal');
    const closeButton = document.getElementById('uvWorkspaceClose');
    const canvasHost = document.getElementById('uvWorkspaceCanvasHost');
    const transformHost = document.getElementById('uvWorkspaceTransformHost');
    const layersHost = document.getElementById('uvWorkspaceLayersHost');
    const activeLayer = getActiveLayer();
    const open = XR?.openModal || XR?.__modules?.ShellModal?.openModal || null;
    if (!modal || !canvasHost || !transformHost || !layersHost || !open || !activeLayer?.imageBitmap) return false;
    closeUvWorkspace();

    const portals = [
      [document.getElementById('drawWrap'), canvasHost],
      [document.querySelector('.xr-img-zoom-bar'), transformHost],
      [document.getElementById('imgXformHint'), transformHost],
      [document.getElementById('surfaceImgXformControls'), transformHost],
      [document.getElementById('btn-import-image'), layersHost],
      [document.getElementById('layerEmptyHint'), layersHost],
      [document.getElementById('layerList'), layersHost],
    ];
    uvWorkspacePortals = portals.reduce((saved, [node, host]) => {
      if (!node || !host || !node.parentNode) return saved;
      saved.push({ node, parent: node.parentNode, next: node.nextSibling });
      host.appendChild(node);
      return saved;
    }, []);
    setUvWorkspaceWheelTarget('texture');
    resetUvWorkspaceView();
    installUvWorkspaceViewGestures();
    uvWorkspaceModalState = open(modal, {
      initialFocusEl: closeButton,
      returnFocusEl: document.getElementById('btn-uv-workspace'),
      onRequestClose: closeUvWorkspace,
    });
    scheduleWorkspaceRedraw();
    return true;
  }

  function bindInlineImageNumberEditor(valId, sliderId, kind) {
    const span = document.getElementById(valId);
    const slider = document.getElementById(sliderId);
    if (!span || !slider) return;
    if (span.dataset && span.dataset.boundInlineSurface === '1') return;
    if (span.dataset) span.dataset.boundInlineSurface = '1';

    const readInitial = () => {
      if (kind === 'scale') return String((parseInt(slider.value, 10) / 100).toFixed(2));
      if (kind === 'ratio') return String((parseInt(slider.value, 10) / 100).toFixed(2));
      if (kind === 'tileScale') return String((parseInt(slider.value, 10) / 100).toFixed(2));
      return String(parseInt(slider.value, 10));
    };

    const commit = (raw) => {
      const cleaned = String(raw || '').trim().replace(/[^\d.\-]+/g, '');
      let v = parseFloat(cleaned);
      if (!Number.isFinite(v)) return false;
      if (kind === 'rot') v = Math.max(-180, Math.min(180, v));
      if (kind === 'scale') v = Math.max(0.05, Math.min(20.0, v));
      if (kind === 'ratio') v = Math.max(0.25, Math.min(4.0, v));
      if (kind === 'tileScale') v = Math.max(0.05, Math.min(20.0, v));
      if (kind === 'scale' || kind === 'ratio' || kind === 'tileScale') slider.value = String(Math.round(v * 100));
      else slider.value = String(Math.round(v));
      slider.dispatchEvent(new Event('input'));
      return true;
    };

    const begin = () => {
      const current = span.textContent || '';
      if (current === '—') return;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'xr-inline-number-input';
      input.value = readInitial();
      const parent = span.parentElement;
      if (!parent) return;
      parent.replaceChild(input, span);
      input.focus();
      input.select();
      let finished = false;
      let onKeyDown = null;
      let onBlur = null;
      const finish = (save) => {
        if (finished) return;
        finished = true;
        try { if (onKeyDown) input.removeEventListener('keydown', onKeyDown); } catch (_) {}
        try { if (onBlur) input.removeEventListener('blur', onBlur); } catch (_) {}
        commit(save ? input.value : readInitial());
        try { if (input.parentElement === parent) parent.replaceChild(span, input); } catch (_) {}
        updateTransformUi();
        span.focus();
      };
      onKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      };
      onBlur = () => finish(true);
      input.addEventListener('keydown', onKeyDown);
      input.addEventListener('blur', onBlur);
    };

    span.addEventListener('click', begin);
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        begin();
      }
    });
  }

  function bindControls() {
    if (document.documentElement.dataset.xrSurfaceEditorBound === '1') return;
    document.documentElement.dataset.xrSurfaceEditorBound = '1';

    const btnImportImage = document.getElementById('btn-import-image');
    const imgInput = document.getElementById('imgFileInput');
    const imgScale = document.getElementById('imgScale');
    const imgRotate = document.getElementById('imgRotate');
    const imgRatio = document.getElementById('imgRatio');
    const btnImgZoomIn = document.getElementById('btn-img-zoom-in');
    const btnImgZoomOut = document.getElementById('btn-img-zoom-out');
    const btnImgZoomReset = document.getElementById('btn-img-zoom-reset');
    const btnUvWorkspace = document.getElementById('btn-uv-workspace');
    const btnUvWorkspaceClose = document.getElementById('uvWorkspaceClose');
    const btnUvWorkspaceZoomIn = document.getElementById('uvWorkspaceZoomIn');
    const btnUvWorkspaceZoomOut = document.getElementById('uvWorkspaceZoomOut');
    const btnUvWorkspaceViewFit = document.getElementById('uvWorkspaceViewFit');
    const btnUvWorkspacePan = document.getElementById('uvWorkspacePan');
    const btnUvWorkspaceWheelTexture = document.getElementById('uvWorkspaceWheelTexture');
    const btnUvWorkspaceWheelView = document.getElementById('uvWorkspaceWheelView');

    bindInlineImageNumberEditor('imgScaleVal', 'imgScale', 'scale');
    bindInlineImageNumberEditor('imgRatioVal', 'imgRatio', 'ratio');
    bindInlineImageNumberEditor('imgRotateVal', 'imgRotate', 'rot');

    if (btnImportImage) btnImportImage.addEventListener('click', () => imgInput?.click());
    if (btnUvWorkspace) btnUvWorkspace.addEventListener('click', openUvWorkspace);
    if (btnUvWorkspaceClose) btnUvWorkspaceClose.addEventListener('click', closeUvWorkspace);
    if (btnUvWorkspaceZoomIn) btnUvWorkspaceZoomIn.addEventListener('click', () => setUvWorkspaceZoom(uvWorkspaceView.zoom * 1.25));
    if (btnUvWorkspaceZoomOut) btnUvWorkspaceZoomOut.addEventListener('click', () => setUvWorkspaceZoom(uvWorkspaceView.zoom / 1.25));
    if (btnUvWorkspaceViewFit) btnUvWorkspaceViewFit.addEventListener('click', resetUvWorkspaceView);
    if (btnUvWorkspacePan) btnUvWorkspacePan.addEventListener('click', toggleUvWorkspacePan);
    if (btnUvWorkspaceWheelTexture) btnUvWorkspaceWheelTexture.addEventListener('click', () => setUvWorkspaceWheelTarget('texture'));
    if (btnUvWorkspaceWheelView) btnUvWorkspaceWheelView.addEventListener('click', () => setUvWorkspaceWheelTarget('view'));
    if (imgInput) imgInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      loadImageFromFile(file);
      e.target.value = '';
    });
    if (imgScale) imgScale.addEventListener('input', () => {
      const imageTransform = getTransform();
      const scale = Math.max(0.05, Math.min(20.0, parseFloat(imgScale.value) / 100));
      if (updateImageTransform) updateImageTransform({ scale });
      else imageTransform.scale = scale;
      applyLayerTransformChange();
    });
    const applyImgScaleSlider = (newVal) => {
      if (!imgScale) return;
      const clamped = Math.max(5, Math.min(2000, Math.round(newVal)));
      imgScale.value = String(clamped);
      try { imgScale.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    };
    if (btnImgZoomIn) btnImgZoomIn.addEventListener('click', () => {
      const cur = imgScale ? parseFloat(imgScale.value || '100') : 100;
      applyImgScaleSlider(cur * 1.25);
    });
    if (btnImgZoomOut) btnImgZoomOut.addEventListener('click', () => {
      const cur = imgScale ? parseFloat(imgScale.value || '100') : 100;
      applyImgScaleSlider(cur * 0.8);
    });
    if (btnImgZoomReset) btnImgZoomReset.addEventListener('click', () => {
      applyImgScaleSlider(100);
    });
    if (imgRotate) imgRotate.addEventListener('input', () => {
      const imageTransform = getTransform();
      const rot = parseInt(imgRotate.value, 10);
      if (updateImageTransform) updateImageTransform({ rot });
      else imageTransform.rot = rot;
      applyLayerTransformChange();
    });
    if (imgRatio) imgRatio.addEventListener('input', () => {
      const part = getSelectedPart();
      if (!isRatioAllowedForPart(part)) return;
      const imageTransform = getTransform();
      const ratio = Math.max(0.25, Math.min(4.0, parseFloat(imgRatio.value) / 100));
      if (updateImageTransform) updateImageTransform({ ratio });
      else imageTransform.ratio = ratio;
      applyLayerTransformChange();
    });
  }

  return {
    syncImageSliderControlsFromTransform,
    renderLayerListUI,
    updateTransformUi,
    updateTextureImportAvailability,
    openRenameLayerModal,
    bindControls,
  };
}

XR.__modules.ShellSurfaceEditor = XR.__modules.ShellSurfaceEditor || {};
XR.__modules.ShellSurfaceEditor.create = create;
