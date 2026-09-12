// Responsibility: own scene tree rendering and shell-side panel interactions.
// Reads from: DOM, localStorage, and callbacks passed from the legacy runtime.
// Writes to: tree/inspector DOM state, scene drawer state, and button bindings.
// Exposes to: window.XR.__modules.ShellScenePanels

const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

let sceneDrawerEscHandler = null;

export function create(opts) {
  const onWithSignal = (opts && typeof opts.onWithSignal === 'function') ? opts.onWithSignal : null;
  const getShapeList = (opts && typeof opts.getShapeList === 'function') ? opts.getShapeList : (() => []);
  const getSelectedId = (opts && typeof opts.getSelectedId === 'function') ? opts.getSelectedId : (() => null);
  const updateTextureImportAvailability = (opts && typeof opts.updateTextureImportAvailability === 'function') ? opts.updateTextureImportAvailability : (() => {});
  const getGeoStats = (opts && typeof opts.getGeoStats === 'function') ? opts.getGeoStats : (() => ({ tris: 0, verts: 0 }));
  const updateMobilePreviewAvailability = (opts && typeof opts.updateMobilePreviewAvailability === 'function') ? opts.updateMobilePreviewAvailability : (() => {});
  const updateExportAvailability = (opts && typeof opts.updateExportAvailability === 'function') ? opts.updateExportAvailability : (() => {});
  const setSelectedPart = (opts && typeof opts.setSelectedPart === 'function') ? opts.setSelectedPart : (() => {});
  const getArchetypeById = (opts && typeof opts.getArchetypeById === 'function') ? opts.getArchetypeById : (() => null);
  const drawIcon = (opts && typeof opts.drawIcon === 'function') ? opts.drawIcon : (XR?.Icons?.drawIcon || XR?.__modules?.Icons?.drawIcon || null);
  const armProjectUndoSnapshot = (opts && typeof opts.armProjectUndoSnapshot === 'function') ? opts.armProjectUndoSnapshot : (() => {});
  const updatePartControlsFromSelected = (opts && typeof opts.updatePartControlsFromSelected === 'function') ? opts.updatePartControlsFromSelected : (() => {});
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((key) => String(key || ''));
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const sceneCommands = XR.SceneCommands || XR.__modules.SceneCommands || null;
  const duplicatePart = (sceneCommands && typeof sceneCommands.duplicatePart === 'function')
    ? sceneCommands.duplicatePart
    : ((opts && typeof opts.duplicatePart === 'function') ? opts.duplicatePart : (() => {}));
  const movePartInTree = (sceneCommands && typeof sceneCommands.movePartInTree === 'function')
    ? sceneCommands.movePartInTree
    : ((opts && typeof opts.movePartInTree === 'function') ? opts.movePartInTree : (() => {}));
  const deletePart = (sceneCommands && typeof sceneCommands.deletePart === 'function')
    ? sceneCommands.deletePart
    : ((opts && typeof opts.deletePart === 'function') ? opts.deletePart : (() => {}));
  const renamePart = (sceneCommands && typeof sceneCommands.renamePart === 'function')
    ? sceneCommands.renamePart
    : ((opts && typeof opts.renamePart === 'function') ? opts.renamePart : (() => null));
  const setPartVisibility = (sceneCommands && typeof sceneCommands.setPartVisibility === 'function')
    ? sceneCommands.setPartVisibility
    : ((opts && typeof opts.setPartVisibility === 'function') ? opts.setPartVisibility : (() => null));
  const togglePartLocked = (sceneCommands && typeof sceneCommands.togglePartLocked === 'function')
    ? sceneCommands.togglePartLocked
    : ((opts && typeof opts.togglePartLocked === 'function') ? opts.togglePartLocked : (() => null));

  let inspectorScrollRaf = 0;
  let renderTreeAbortController = null;

  function updateInspectorScrollState() {
    const els = document.querySelectorAll('.xr-panel-inspector, .xr-panel-surface');
    if (!els || !els.length) return;
    for (const el of els) {
      if (!el) continue;
      const scrollable = (el.scrollHeight - el.clientHeight) > 2;
      el.dataset.scrollable = scrollable ? 'true' : 'false';
    }
  }

  function scheduleInspectorScrollState() {
    if (inspectorScrollRaf) return;
    inspectorScrollRaf = requestAnimationFrame(() => {
      inspectorScrollRaf = 0;
      updateInspectorScrollState();
    });
  }

  function installInspectorScrollSync() {
    if (document.documentElement.dataset.xrInspectorScrollBound === '1') return;
    document.documentElement.dataset.xrInspectorScrollBound = '1';
    const prev = XR.__inspectorScrollResizeHandler || null;
    if (prev) {
      try { window.removeEventListener('resize', prev); } catch (_) {}
    }
    XR.__inspectorScrollResizeHandler = scheduleInspectorScrollState;
    window.addEventListener('resize', scheduleInspectorScrollState, { passive: true });
  }

  function bindInspectorAccordion(root) {
    if (!root || !root.dataset || root.dataset.boundScenePanels === '1') return;
    root.dataset.boundScenePanels = '1';
    root.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.xr-inspector-section__header') : null;
      if (!btn) return;
      const sec = btn.parentElement;
      if (!sec || !sec.classList || !sec.classList.contains('xr-inspector-section')) return;
      const collapsed = sec.getAttribute('data-collapsed') === 'true';
      sec.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
      scheduleInspectorScrollState();
    });
  }

  function renderTree() {
    const list = document.getElementById('treeList');
    const countVisEl = document.getElementById('treeCountVis');
    const countTotalEl = document.getElementById('treeCountTotal');
    const viewportGeoStatsEl = document.getElementById('viewportGeoStats');
    const delConfirm = document.getElementById('treeDeleteConfirm');
    if (delConfirm) delConfirm.hidden = true;
    try { renderTreeAbortController?.abort?.(); } catch (_) {}
    renderTreeAbortController = new AbortController();
    const sig = renderTreeAbortController.signal;
    const on = (target, ev, fn, opts2) => {
      if (!target) return;
      if (onWithSignal) {
        onWithSignal(sig, target, ev, fn, opts2);
        return;
      }
      target.addEventListener(ev, fn, opts2);
    };
    const shapes = getShapeList();
    const selectedId = getSelectedId();
    updateTextureImportAvailability();
    const isVisiblePart = (p) => !!(p && p.visible !== false && p._mesh && p._mesh.visible !== false);
    const visCount = shapes.reduce((n, p) => n + (isVisiblePart(p) ? 1 : 0), 0);
    const allStats = getGeoStats(null);
    const visStats = getGeoStats(isVisiblePart);
    const emptyState = document.getElementById('treeEmptyState');
    const viewportEmpty = document.getElementById('viewportEmptyOverlay');
    const editorRoot = document.getElementById('xreate-editor-root');

    if (countVisEl) countVisEl.textContent = String(visCount | 0);
    if (countTotalEl) countTotalEl.textContent = String(shapes.length | 0);
    const badge = document.getElementById('treeCountBadge');
    if (badge) badge.setAttribute('aria-label', `${visCount} of ${shapes.length} volumes`);
    try { updateMobilePreviewAvailability(shapes.length | 0); } catch (_) {}
    try { updateExportAvailability(shapes.length | 0); } catch (_) {}
    if (viewportGeoStatsEl) {
      viewportGeoStatsEl.textContent =
        String(visStats.tris) + '/' + String(allStats.tris) + tr('scene_tris_short') +
        ' · ' +
        String(visStats.verts) + '/' + String(allStats.verts) + tr('scene_verts_short');
    }

    if (emptyState) emptyState.hidden = shapes.length > 0;
    if (editorRoot) editorRoot.classList.toggle('is-empty-scene', shapes.length === 0);
    // An empty composition is an actionable state, not a one-time onboarding
    // message.  Keeping the invitation visible after a user deletes every
    // volume also makes a loaded-but-empty project understandable on mobile.
    if (viewportEmpty) viewportEmpty.hidden = shapes.length > 0;

    if (!list) return;

    list.innerHTML = '';
    if (!shapes.length) {
      const btnTreeUp = document.getElementById('btn-tree-up');
      const btnTreeDown = document.getElementById('btn-tree-down');
      if (btnTreeUp) btnTreeUp.disabled = true;
      if (btnTreeDown) btnTreeDown.disabled = true;
      return;
    }

    for (const p of shapes) {
      const row = document.createElement('div');
      row.className = 'xr-tree-row' + (p.id === selectedId ? ' is-active' : '');
      row.setAttribute('role', 'listitem');
      row.setAttribute('aria-selected', p.id === selectedId ? 'true' : 'false');
      row.tabIndex = (p.id === selectedId) ? 0 : -1;
      on(row, 'keydown', (e) => {
        const k = e && e.key ? e.key : '';
        if (!k) return;
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          setSelectedPart(p.id, { silent: true });
          return;
        }
        if (k !== 'ArrowUp' && k !== 'ArrowDown') return;
        e.preventDefault();
        const rows = Array.from(list.querySelectorAll('.xr-tree-row'));
        const idx = rows.indexOf(row);
        if (idx < 0) return;
        const nextIdx = k === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(rows.length - 1, idx + 1);
        const nextRow = rows[nextIdx];
        try { nextRow?.focus?.(); } catch (_) {}
      });

      const typeThumb = document.createElement('canvas');
      const typeThumbSize = 20;
      const typeThumbDpr = window.devicePixelRatio || 1;
      typeThumb.width = Math.max(1, Math.round(typeThumbSize * typeThumbDpr));
      typeThumb.height = Math.max(1, Math.round(typeThumbSize * typeThumbDpr));
      typeThumb.style.width = typeThumbSize + 'px';
      typeThumb.style.height = typeThumbSize + 'px';
      typeThumb.className = 'xr-tree-row__thumb';
      typeThumb.setAttribute('aria-hidden', 'true');
      try {
        const ctx = typeThumb.getContext('2d');
        if (ctx) {
          const arch = getArchetypeById(p.type);
          drawIcon(ctx, (arch && arch.icon) ? arch.icon : 'unknown', typeThumbSize, { bg: '#1c1a16', fg: '#e8e2d6' });
        }
      } catch (_) {}

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'xr-tree-row__name';
      nameBtn.textContent = p.name || p.id;
      nameBtn.title = 'Double-click to rename';
      on(nameBtn, 'click', (e) => {
        if (e && e.detail > 1) return;
        // Selection must be synchronous: texture controls can otherwise write
        // to the previously selected part during the double-click grace period.
        setSelectedPart(p.id, { silent: true });
      });
      on(nameBtn, 'dblclick', (e) => {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'xr-tree-row__name-edit';
        input.maxLength = 32;
        input.value = p.name || '';
        on(input, 'keydown', (ke) => {
          if (ke.key === 'Enter') input.blur();
          if (ke.key === 'Escape') { input.value = p.name || ''; input.blur(); }
        });
        on(input, 'blur', () => {
          let v = String(input.value || '').trim();
          if (!v) v = p.name || p.id;
          const prevName = p.name || '';
          const nextName = v;
          if (nextName !== prevName) armProjectUndoSnapshot();
          const updated = (nextName !== prevName) ? (renamePart(p.id, nextName) || p) : p;
          nameBtn.textContent = updated.name || updated.id;
          row.replaceChild(nameBtn, input);
          if (p.id === selectedId) updatePartControlsFromSelected();
        });
        row.replaceChild(input, nameBtn);
        input.focus();
        input.select();
      });

      const typeBadge = document.createElement('span');
      typeBadge.className = 'xr-tree-row__type';
      typeBadge.setAttribute('aria-hidden', 'true');
      const arch = getArchetypeById(p.type);
      typeBadge.textContent = arch ? (arch.label || p.type) : p.type;

      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = 'xr-tree-row__icon-btn is-vis';
      const visOn = (p.visible !== false);
      visBtn.dataset.state = visOn ? 'on' : 'off';
      visBtn.setAttribute('aria-pressed', visOn ? 'true' : 'false');
      try {
        const nm = p.name || p.id;
        const key = visOn ? 'aria_hide_volume' : 'aria_show_volume';
        visBtn.setAttribute('aria-label', tr(key).replace('{name}', nm));
      } catch (_) {}
      on(visBtn, 'click', (e) => {
        e.stopPropagation();
        armProjectUndoSnapshot();
        const next = !(p.visible !== false);
        const updated = setPartVisibility(p.id, next) || p;
        visBtn.dataset.state = next ? 'on' : 'off';
        visBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        try {
          const nm = updated.name || updated.id;
          const key = next ? 'aria_hide_volume' : 'aria_show_volume';
          visBtn.setAttribute('aria-label', tr(key).replace('{name}', nm));
        } catch (_) {}
        renderTree();
      });

      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'xr-tree-row__icon-btn is-lock';
      lockBtn.dataset.state = p.locked ? 'on' : 'off';
      lockBtn.setAttribute('aria-pressed', p.locked ? 'true' : 'false');
      try {
        const nm = p.name || p.id;
        const key = p.locked ? 'aria_unlock_volume' : 'aria_lock_volume';
        lockBtn.setAttribute('aria-label', tr(key).replace('{name}', nm));
      } catch (_) {}
      on(lockBtn, 'click', (e) => {
        e.stopPropagation();
        armProjectUndoSnapshot();
        const updated = togglePartLocked(p.id) || p;
        lockBtn.dataset.state = updated.locked ? 'on' : 'off';
        lockBtn.setAttribute('aria-pressed', updated.locked ? 'true' : 'false');
        try {
          const nm = updated.name || updated.id;
          const key = updated.locked ? 'aria_unlock_volume' : 'aria_lock_volume';
          lockBtn.setAttribute('aria-label', tr(key).replace('{name}', nm));
        } catch (_) {}
      });

      row.appendChild(typeThumb);
      row.appendChild(nameBtn);
      row.appendChild(typeBadge);
      row.appendChild(visBtn);
      row.appendChild(lockBtn);
      list.appendChild(row);
    }

    const btnTreeUp = document.getElementById('btn-tree-up');
    const btnTreeDown = document.getElementById('btn-tree-down');
    if (btnTreeUp || btnTreeDown) {
      const idx = selectedId ? shapes.findIndex((s) => s && s.id === selectedId) : -1;
      const canUp = idx > 0;
      const canDown = idx >= 0 && idx < shapes.length - 1;
      if (btnTreeUp) btnTreeUp.disabled = !canUp;
      if (btnTreeDown) btnTreeDown.disabled = !canDown;
    }
  }

  function hideTreeDeleteConfirm() {
    const treeDeleteConfirm = document.getElementById('treeDeleteConfirm');
    const btnTreeDel = document.getElementById('btn-tree-del');
    if (treeDeleteConfirm) treeDeleteConfirm.hidden = true;
    try { btnTreeDel?.focus?.(); } catch (_) {}
  }

  function bindTreeControls() {
    const btnTreeDup = document.getElementById('btn-tree-dup');
    const btnTreeUp = document.getElementById('btn-tree-up');
    const btnTreeDown = document.getElementById('btn-tree-down');
    const btnTreeDel = document.getElementById('btn-tree-del');
    const treeDeleteConfirm = document.getElementById('treeDeleteConfirm');
    const btnTreeDelConfirm = document.getElementById('btn-tree-del-confirm');
    const btnTreeDelCancel = document.getElementById('btn-tree-del-cancel');

    if (btnTreeDup && btnTreeDup.dataset.boundScenePanels !== '1') {
      btnTreeDup.dataset.boundScenePanels = '1';
      btnTreeDup.addEventListener('click', () => {
        const p = getSelectedPart();
        if (p) duplicatePart(p.id);
      });
    }

    if (treeDeleteConfirm && treeDeleteConfirm.dataset.boundScenePanels !== '1') {
      treeDeleteConfirm.dataset.boundScenePanels = '1';
      treeDeleteConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          hideTreeDeleteConfirm();
        }
      });
    }

    if (document.documentElement.dataset.xrTreeDeleteDismissBound !== '1') {
      document.documentElement.dataset.xrTreeDeleteDismissBound = '1';
      document.addEventListener('click', (e) => {
        const confirmEl = document.getElementById('treeDeleteConfirm');
        const deleteBtn = document.getElementById('btn-tree-del');
        if (!confirmEl || confirmEl.hidden || !deleteBtn) return;
        if (confirmEl.contains(e.target)) return;
        if (e.target === deleteBtn || deleteBtn.contains(e.target)) return;
        hideTreeDeleteConfirm();
      });
    }

    if (btnTreeUp && btnTreeUp.dataset.boundScenePanels !== '1') {
      btnTreeUp.dataset.boundScenePanels = '1';
      btnTreeUp.addEventListener('click', () => {
        const p = getSelectedPart();
        if (p) movePartInTree(p.id, -1);
      });
    }

    if (btnTreeDown && btnTreeDown.dataset.boundScenePanels !== '1') {
      btnTreeDown.dataset.boundScenePanels = '1';
      btnTreeDown.addEventListener('click', () => {
        const p = getSelectedPart();
        if (p) movePartInTree(p.id, +1);
      });
    }

    if (btnTreeDel && btnTreeDel.dataset.boundScenePanels !== '1') {
      btnTreeDel.dataset.boundScenePanels = '1';
      btnTreeDel.addEventListener('click', () => {
        const p = getSelectedPart();
        if (!p) return;
        if (treeDeleteConfirm) treeDeleteConfirm.hidden = false;
        try { btnTreeDelConfirm?.focus?.(); } catch (_) {}
      });
    }

    if (btnTreeDelCancel && btnTreeDelCancel.dataset.boundScenePanels !== '1') {
      btnTreeDelCancel.dataset.boundScenePanels = '1';
      btnTreeDelCancel.addEventListener('click', hideTreeDeleteConfirm);
    }

    if (btnTreeDelConfirm && btnTreeDelConfirm.dataset.boundScenePanels !== '1') {
      btnTreeDelConfirm.dataset.boundScenePanels = '1';
      btnTreeDelConfirm.addEventListener('click', () => {
        const p = getSelectedPart();
        if (!p) {
          hideTreeDeleteConfirm();
          return;
        }
        hideTreeDeleteConfirm();
        deletePart(p.id);
      });
    }
  }

  function closeSceneDrawer() {
    const sceneRootEl = document.documentElement;
    const btnScene = document.getElementById('btn-scene');
    const btnTreeToggleSheet = document.getElementById('btn-tree-toggle-sheet');
    if (!sceneRootEl) return;
    const wasOpenLegacy = sceneRootEl.dataset.sceneOpen === 'true';
    const wasOpenSheet = sceneRootEl.classList.contains('is-tree-open');
    if (!wasOpenLegacy && !wasOpenSheet) return;
    delete sceneRootEl.dataset.sceneOpen;
    if (btnScene) btnScene.setAttribute('aria-expanded', 'false');
    if (wasOpenSheet) {
      sceneRootEl.classList.remove('is-tree-open');
      if (btnTreeToggleSheet) btnTreeToggleSheet.classList.remove('is-active');
    }
  }

  function openSceneDrawer() {
    const sceneRootEl = document.documentElement;
    const btnScene = document.getElementById('btn-scene');
    const btnTreeToggleSheet = document.getElementById('btn-tree-toggle-sheet');
    if (!sceneRootEl) return;
    sceneRootEl.dataset.sceneOpen = 'true';
    if (btnScene) btnScene.setAttribute('aria-expanded', 'true');
    sceneRootEl.classList.add('is-tree-open');
    if (btnTreeToggleSheet) btnTreeToggleSheet.classList.add('is-active');
  }

  function toggleSceneDrawer() {
    const sceneRootEl = document.documentElement;
    if (!sceneRootEl) return;
    if (sceneRootEl.dataset.sceneOpen === 'true') closeSceneDrawer();
    else openSceneDrawer();
  }

  function bindSceneDrawer() {
    const btnScene = document.getElementById('btn-scene');
    const sceneOverlay = document.getElementById('sceneOverlay');

    if (btnScene && btnScene.dataset.boundScenePanels !== '1') {
      btnScene.dataset.boundScenePanels = '1';
      btnScene.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSceneDrawer();
      });
    }

    if (sceneOverlay && sceneOverlay.dataset.boundScenePanels !== '1') {
      sceneOverlay.dataset.boundScenePanels = '1';
      sceneOverlay.addEventListener('click', closeSceneDrawer);
    }

    if (sceneDrawerEscHandler) document.removeEventListener('keydown', sceneDrawerEscHandler, true);
    sceneDrawerEscHandler = (e) => {
      if (e && e.key === 'Escape') closeSceneDrawer();
    };
    document.addEventListener('keydown', sceneDrawerEscHandler, true);

    try {
      const mm = window.matchMedia('(min-width: 1728px)');
      if (mm && !mm.__xrScenePanelsBound) {
        mm.__xrScenePanelsBound = true;
        mm.addEventListener('change', () => {
          if (mm.matches) closeSceneDrawer();
        });
      }
    } catch (_) {}
  }

  function syncUniformScaleStateLabel() {
    // Anti-cascade lock: if any MO-driven UI sync is already writing the DOM, skip this call.
    try {
      const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
      if (xr && xr._uiSyncingInProgress) return;
    } catch (_) {}
    try {
      try {
        const xrGlobal = (typeof window !== 'undefined') ? (window.XR = window.XR || {}) : null;
        if (xrGlobal) xrGlobal._uiSyncingInProgress = true;
      } catch (_) {}
      try {
        const btn = document.getElementById('btn-scale-uniform');
        if (!btn) return;
        const label = btn.querySelector('[data-state-label]');
        if (!label) return;
        const pressed = btn.getAttribute('aria-pressed') === 'true';
        label.textContent = pressed ? 'ON' : 'OFF';
      } catch (_) {
      } finally {
        try {
          try {
            Promise.resolve().then(() => {
              try {
                const xrG = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
                try { window.setTimeout(() => { try { if (xrG) xrG._uiSyncingInProgress = false; } catch (_) {} }, 0); }
                catch (_) { try { if (xrG) xrG._uiSyncingInProgress = false; } catch (_) {} }
              } catch (_) {}
            });
          } catch (_) {
            try { const xrG2 = (typeof window !== 'undefined' && window.XR) ? window.XR : null; if (xrG2) xrG2._uiSyncingInProgress = false; } catch (_) {}
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  function bindUVHelpAndScaleStateLabel() {
    const root = (document && document.documentElement) ? document.documentElement : null;
    if (root && root.dataset && root.dataset.boundScenePanelsUvHelpers === '1') return;
    try { if (root && root.dataset) root.dataset.boundScenePanelsUvHelpers = '1'; } catch (_) {}

    syncUniformScaleStateLabel();
    setTimeout(syncUniformScaleStateLabel, 200);
    setTimeout(syncUniformScaleStateLabel, 800);

    document.addEventListener('click', (e) => {
      try {
        const tgt = e && e.target ? (e.target.closest ? e.target : null) : null;
        if (!tgt) return;

        if (tgt.id === 'btn-scale-uniform' || tgt.closest('#btn-scale-uniform')) {
          setTimeout(syncUniformScaleStateLabel, 0);
          setTimeout(syncUniformScaleStateLabel, 20);
          setTimeout(syncUniformScaleStateLabel, 100);
        }
      } catch (_) {}
    }, true);

    try {
      const btn = document.getElementById('btn-scale-uniform');
      if (btn) {
        // FIXED 20260903 (REV B) — True anti microtask infinite loop guard.
        // Same as viewport-controls MOs: DEFER .observe(target, opts) to
        // setTimeout(250ms) MACROTASK so the observer never sees the 220
        // boot DOM writes. Callback body also wrapped in setTimeout 0.
        try {
          window.setTimeout(() => {
            let _callCount3 = 0;
            let _hardDisabled3 = false;
            let _scheduled3 = false;
            const obs = new MutationObserver(() => {
              try {
                const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
                if (xr && xr._uiSyncingInProgress) return;
              } catch (_) {}
              if (_hardDisabled3) return;
              _callCount3 = (_callCount3 || 0) + 1;
              if ((_callCount3 || 0) > 50) {
                _hardDisabled3 = true;
                try { console.warn('[XR·MO-GUARD] scene-panels uniform-scale MutationObserver: >50 invocations in mount window. Permanently disconnecting to prevent microtask flood.'); } catch (_) {}
                try { obs && obs.disconnect && obs.disconnect(); } catch (_) {}
                return;
              }
              if (_scheduled3) return;
              _scheduled3 = true;
              try {
                window.setTimeout(() => {
                  _scheduled3 = false;
                  if (_hardDisabled3) return;
                  try { syncUniformScaleStateLabel(); } catch (_) {}
                }, 0);
              } catch (_) { _scheduled3 = false; }
            });
            obs.observe(btn, { attributes: true, attributeFilter: ['aria-pressed'] });
          }, 250);
        } catch (_) {}
      }
    } catch (_) {}
  }

  return {
    renderTree,
    updateInspectorScrollState,
    scheduleInspectorScrollState,
    installInspectorScrollSync,
    bindInspectorAccordion,
    bindTreeControls,
    openSceneDrawer,
    closeSceneDrawer,
    toggleSceneDrawer,
    bindSceneDrawer,
    bindUVHelpAndScaleStateLabel,
    syncUniformScaleStateLabel,
  };
}

XR.__modules.ShellScenePanels = XR.__modules.ShellScenePanels || {};
XR.__modules.ShellScenePanels.create = create;
XR.__modules.ShellScenePanels.getSceneDrawerEscHandler = () => sceneDrawerEscHandler;
