const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((k) => String(k || ''));
  const setGizmoMode = (opts && typeof opts.setGizmoMode === 'function') ? opts.setGizmoMode : (() => {});
  const getGizmoMode = (opts && typeof opts.getGizmoMode === 'function') ? opts.getGizmoMode : (() => 'move');
  const showToast = (opts && typeof opts.showToast === 'function') ? opts.showToast : (() => {});
  const fitViewportView = (opts && typeof opts.fitViewportView === 'function') ? opts.fitViewportView : (() => {});
  const setViewportView = (opts && typeof opts.setViewportView === 'function') ? opts.setViewportView : (() => {});
  const updateViewportViewButtons = (opts && typeof opts.updateViewportViewButtons === 'function') ? opts.updateViewportViewButtons : (() => {});
  const setUVMode = (opts && typeof opts.setUVMode === 'function') ? opts.setUVMode : (() => {});
  const setUvStretch = (opts && typeof opts.setUvStretch === 'function') ? opts.setUvStretch : (() => {});
  const getUvStretchOn = (opts && typeof opts.getUvStretchOn === 'function') ? opts.getUvStretchOn : (() => false);
  const scaleDrawCanvas = (opts && typeof opts.scaleDrawCanvas === 'function') ? opts.scaleDrawCanvas : (() => {});
  const applyUvChecker = (opts && typeof opts.applyUvChecker === 'function') ? opts.applyUvChecker : (async () => {});
  const openUvCompareModal = (opts && typeof opts.openUvCompareModal === 'function') ? opts.openUvCompareModal : (() => {});

  function syncUvWideButton() {
    const btn = document.getElementById('btn-uv-wide');
    if (!btn) return;
    const wideOn = !!document.getElementById('xreate-editor-root')?.classList.contains('is-uvwide');
    const key = wideOn ? 'uv_wide_on' : 'uv_wide_off';
    btn.setAttribute('aria-pressed', wideOn ? 'true' : 'false');
    try { btn.removeAttribute('data-i18n'); } catch (_) {}
    const label = btn.querySelector('.xr-ctl-btn__label');
    if (label) label.textContent = tr(key);
    else btn.textContent = tr(key);
  }

  function toggleUvWideUi() {
    const editorRoot = document.getElementById('xreate-editor-root');
    if (editorRoot) editorRoot.classList.toggle('is-uvwide');
    syncUvWideButton();
    try {
      requestAnimationFrame(() => requestAnimationFrame(() => scaleDrawCanvas()));
    } catch (_) {
      try { scaleDrawCanvas(); } catch (_) {}
    }
  }

  function bind() {
    const btnGizmoMove = document.getElementById('btn-gizmo-move');
    const btnGizmoRotate = document.getElementById('btn-gizmo-rotate');
    const btnGizmoScale = document.getElementById('btn-gizmo-scale');
    const gizmoToolGroup = document.getElementById('gizmoToolGroup');
    const btnUvWide = document.getElementById('btn-uv-wide');
    const btnViewFit = document.getElementById('btn-view-fit');
    const uvModeSelect = document.getElementById('uvModeSelect');
    const btnUvChecker = document.getElementById('btn-uv-checker');

    syncUvWideButton();
    updateViewportViewButtons();
    try { setGizmoMode(getGizmoMode(), { silent: true }); } catch (_) {}

    if (btnGizmoMove && !btnGizmoMove.dataset.boundViewportControls) {
      btnGizmoMove.dataset.boundViewportControls = '1';
      btnGizmoMove.addEventListener('click', () => { setGizmoMode('move'); try { btnGizmoMove.focus(); } catch (_) {} });
    }
    if (btnGizmoRotate && !btnGizmoRotate.dataset.boundViewportControls) {
      btnGizmoRotate.dataset.boundViewportControls = '1';
      btnGizmoRotate.addEventListener('click', () => { setGizmoMode('rotate'); try { btnGizmoRotate.focus(); } catch (_) {} });
    }
    if (btnGizmoScale && !btnGizmoScale.dataset.boundViewportControls) {
      btnGizmoScale.dataset.boundViewportControls = '1';
      btnGizmoScale.addEventListener('click', () => { setGizmoMode('scale'); try { btnGizmoScale.focus(); } catch (_) {} });
    }
    if (gizmoToolGroup && !gizmoToolGroup.dataset.boundViewportControls) {
      gizmoToolGroup.dataset.boundViewportControls = '1';
      gizmoToolGroup.addEventListener('keydown', (e) => {
        const k = e && e.key ? e.key : '';
        const prev = (k === 'ArrowLeft' || k === 'ArrowUp');
        const next = (k === 'ArrowRight' || k === 'ArrowDown');
        const home = (k === 'Home');
        const end = (k === 'End');
        if (!(prev || next || home || end)) return;
        e.preventDefault();
        const order = ['move', 'rotate', 'scale'];
        let idx = order.indexOf(getGizmoMode());
        if (idx < 0) idx = 0;
        if (home) idx = 0;
        else if (end) idx = order.length - 1;
        else if (prev) idx = (idx - 1 + order.length) % order.length;
        else if (next) idx = (idx + 1) % order.length;
        const mode = order[idx];
        setGizmoMode(mode);
        try { document.getElementById('btn-gizmo-' + mode)?.focus?.(); } catch (_) {}
      });
    }

    if (btnUvWide && !btnUvWide.dataset.boundViewportControls) {
      btnUvWide.dataset.boundViewportControls = '1';
      btnUvWide.addEventListener('click', () => toggleUvWideUi());
    }

    const viewButtons = [
      ['btn-view-free', 'free'],
      ['btn-view-front', 'front'],
      ['btn-view-top', 'top'],
      ['btn-view-iso', 'iso'],
    ];
    for (const [id, v] of viewButtons) {
      const el = document.getElementById(id);
      if (!el || el.dataset.boundViewportControls) continue;
      el.dataset.boundViewportControls = '1';
      el.addEventListener('click', () => setViewportView(v));
    }
    if (btnViewFit && !btnViewFit.dataset.boundViewportControls) {
      btnViewFit.dataset.boundViewportControls = '1';
      btnViewFit.addEventListener('click', () => fitViewportView());
    }
    const btnViewPan = document.getElementById('btn-view-pan');
    if (btnViewPan && !btnViewPan.dataset.boundViewportControls) {
      btnViewPan.dataset.boundViewportControls = '1';
      btnViewPan.addEventListener('click', () => {
        const on = (btnViewPan.getAttribute('aria-pressed') !== 'true');
        btnViewPan.setAttribute('aria-pressed', on ? 'true' : 'false');
        btnViewPan.classList.toggle('is-active', on);
        try {
          if (typeof window.XR.__setPanLockMode === 'function') {
            window.XR.__setPanLockMode(on);
          } else {
            window.XR.__panLockMode = !!on;
          }
        } catch (_) {
          window.XR.__panLockMode = !!on;
        }
        try { showToast(tr(on ? 'Pan mode ON' : 'Pan mode OFF'), 'info'); } catch (_) {}
      });
    }
    if (uvModeSelect && !uvModeSelect.dataset.boundViewportControls) {
      uvModeSelect.dataset.boundViewportControls = '1';
      uvModeSelect.addEventListener('change', () => {
        const v = uvModeSelect.value;
        if (v) setUVMode(v);
      });
    }
    if (btnUvChecker && !btnUvChecker.dataset.boundViewportControls) {
      btnUvChecker.dataset.boundViewportControls = '1';
      btnUvChecker.addEventListener('click', () => {
        try {
          if (typeof XR?.applyUvChecker === 'function') {
            XR.applyUvChecker();
          } else if (typeof applyUvChecker === 'function') {
            applyUvChecker();
          }
        } catch (_) {}
      });
    }
    document.querySelectorAll('.xr-editor .xr-ctl-btn[data-uv]').forEach((btn) => {
      if (!btn || btn.dataset.boundViewportControls) return;
      btn.dataset.boundViewportControls = '1';
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-uv');
        if (v) setUVMode(v);
      });
    });

    initMobileCollapsiblePanels();
    initResponsiveSheetUI();
  }

  function initMobileCollapsiblePanels() {
    // In Wide (≥1728) or Compact (1160–1727) the mobile panel CHEVRONS are HIDDEN by CSS,
    // and the body wrapper fills 100% regardless of data-collapsed. To keep DOM state
    // coherent with visual state, default all panels to expanded on large viewports.
    const isLargeViewport = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
      ? window.matchMedia('(min-width: 1160px)').matches
      : false;
    const panels = [
      { selector: '.xr-panel-viewport',  title: 'VIEWPORT',   defaultCollapsed: false },
      { selector: '.xr-panel-tree',      title: 'COMPOSITION', defaultCollapsed: isLargeViewport ? false : true  },
      { selector: '.xr-panel-inspector', title: 'VOLUME',     defaultCollapsed: isLargeViewport ? false : true  },
      { selector: '.xr-panel-surface',   title: '3D TEXTURE', defaultCollapsed: isLargeViewport ? false : true  },
    ];
    for (const cfg of panels) {
      const panel = document.querySelector(cfg.selector);
      if (!panel) continue;
      if (panel.dataset.mobileWrapApplied === '1') continue;
      panel.dataset.mobileWrapApplied = '1';

      const head = document.createElement('div');
      head.className = 'xr-mobile-panel-head';
      head.setAttribute('data-collapsed', cfg.defaultCollapsed ? 'true' : 'false');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', cfg.defaultCollapsed ? 'false' : 'true');
      head.setAttribute('aria-label', cfg.title + ' panel toggle');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'xr-mobile-panel-head__title';
      titleSpan.textContent = cfg.title;

      const chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chev.setAttribute('class', 'xr-mobile-panel-head__chevron');
      chev.setAttribute('viewBox', '0 0 20 20');
      chev.setAttribute('aria-hidden', 'true');
      chev.setAttribute('fill', 'none');
      chev.setAttribute('stroke', 'currentColor');
      chev.setAttribute('stroke-width', '2');
      chev.setAttribute('stroke-linecap', 'round');
      chev.setAttribute('stroke-linejoin', 'round');
      const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      chevPath.setAttribute('d', 'M7 4 L13 10 L7 16');
      chev.appendChild(chevPath);

      head.appendChild(titleSpan);
      head.appendChild(chev);

      const body = document.createElement('div');
      body.className = 'xr-mobile-panel-body';
      body.setAttribute('data-collapsed', cfg.defaultCollapsed ? 'true' : 'false');

      while (panel.firstChild) {
        body.appendChild(panel.firstChild);
      }

      panel.appendChild(head);
      panel.appendChild(body);

      const toggle = function(ev) {
        try {
          if (ev && ev.type === 'keydown') {
            const k = ev.key;
            if (k !== 'Enter' && k !== ' ') return;
            ev.preventDefault();
          }
          const nowCollapsed = head.getAttribute('data-collapsed') !== 'false';
          const next = !nowCollapsed;
          head.setAttribute('data-collapsed', String(next));
          body.setAttribute('data-collapsed', String(next));
          head.setAttribute('aria-expanded', String(!next));
        } catch (_) {}
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', toggle);
    }

    // Phone accordions are workflow sections, not another nesting layer for
    // desktop panels.  In particular, UV Mapping belongs to the 3D Texture
    // workflow beside Texture Editing, never above the Volume controls.  Move
    // the live node (rather than cloning it) at the breakpoint so all existing
    // bindings, selected UV mode and accessibility relationships remain intact.
    const inspectorSections = document.getElementById('inspectorSections');
    const uvControls = document.getElementById('inspector-uv-controls');
    const surfaceSections = document.getElementById('surfaceSections');
    if (!inspectorSections || !uvControls || !surfaceSections) return;

    let uvSlot = document.getElementById('xr-mobile-uv-slot');
    if (!uvSlot) {
      uvSlot = document.createElement('span');
      uvSlot.id = 'xr-mobile-uv-slot';
      uvSlot.hidden = true;
      uvControls.before(uvSlot);
    }

    const syncMobilePanelContent = () => {
      const isPhone = window.matchMedia?.('(max-width: 767px)')?.matches === true;
      let textureControls = document.getElementById('xr-mobile-texture-controls');

      if (isPhone) {
        if (!textureControls) {
          textureControls = document.createElement('div');
          textureControls.id = 'xr-mobile-texture-controls';
          textureControls.className = 'xr-mobile-texture-controls';
          surfaceSections.appendChild(textureControls);
        }
        if (uvControls.parentElement !== textureControls) textureControls.appendChild(uvControls);
      } else {
        if (uvControls.previousElementSibling !== uvSlot) uvSlot.after(uvControls);
        textureControls?.remove();
      }
    };

    syncMobilePanelContent();
    if (!document.documentElement.dataset.xrMobilePanelContentBound) {
      document.documentElement.dataset.xrMobilePanelContentBound = '1';
      window.matchMedia?.('(max-width: 767px)')?.addEventListener?.('change', syncMobilePanelContent);
    }
  }

  /**
   * Task 4 + Task 5 + Task 6 responsive sheet behavior.
   * - Adds Close (X) button to Inspector sheet head.
   * - Auto-opens Inspector bottom-sheet on selection (closes on deselect).
   * - Sheet close never triggers deselection (toggles class only).
   * - Console mirror (info) for sheet state transitions (UX toast policy).
   * - Selection detection via DOM MutationObserver on Composition part-list
   *   (DOM-driven, zero dependency on internal engine selection API surface).
   */
  function initResponsiveSheetUI() {
    const inspectorPanel = document.querySelector('.xr-panel-inspector');
    const inspectorHead = inspectorPanel?.querySelector('.xr-mobile-panel-head');
    const inspectorTitle = inspectorHead?.querySelector('.xr-mobile-panel-head__title');
    // `treeList` is the canonical Composition container. The former
    // `.xr-part-list` selector no longer exists; its fallback to `body` made
    // this observer watch every Shell mutation and eventually self-disable.
    const treeList = document.getElementById('treeList');
    const root = document.documentElement;

    const FALLBACK_INSPECTOR_TITLE = 'INSPECTOR';
    const getInspectorPanelTitle = () => isPhoneViewport() ? 'VOLUME' : FALLBACK_INSPECTOR_TITLE;
    let lastSelectedName = null;
    const isFocusedViewport = () => {
      try { return window.matchMedia?.('(max-width: 1159px)')?.matches === true; } catch (_) { return false; }
    };
    const isPhoneViewport = () => {
      try { return window.matchMedia?.('(max-width: 767px)')?.matches === true; } catch (_) { return false; }
    };
    const isTextureMode = () => (root.getAttribute('data-ui-mode') || '').trim() === 'texture';
    // Phone panels are in document-flow accordions. Legacy focused-sheet
    // classes detach their bodies and can place Volume over 3D Texture.
    const clearPhoneSheetState = () => {
      if (!isPhoneViewport()) return;
      root.classList.remove('is-tree-open', 'is-inspector-open', 'is-surface-open');
      document.getElementById('btn-tree-toggle-sheet')?.classList.remove('is-active');
    };
    clearPhoneSheetState();
    try { window.matchMedia?.('(max-width: 767px)')?.addEventListener?.('change', clearPhoneSheetState); } catch (_) {}

    // The empty viewport is the primary first action on a phone.  Reuse the
    // canonical header action so there is only one path for creating volumes.
    const viewportAddVolume = document.getElementById('btn-viewport-add-volume');
    if (viewportAddVolume && !viewportAddVolume.dataset.xrBound) {
      viewportAddVolume.dataset.xrBound = 'true';
      viewportAddVolume.addEventListener('click', () => {
        document.getElementById('btn-add-shape')?.click();
      });
    }

    // All focused sheets need an explicit, reachable close action. The old
    // Composition and Surface sheets relied on their header chevron, which is
    // intentionally hidden by the focused CSS and therefore trapped touch users
    // in an open overlay.
    const addSheetClose = (panel, className, label, close) => {
      const head = panel?.querySelector('.xr-mobile-panel-head');
      if (!head || head.querySelector(`.${className}`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `xr-sheet-close-btn ${className}`;
      button.textContent = '×';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      });
      head.appendChild(button);
    };

    // ------------------------------------------------------------------
    // 1. Inject Close (X) button into Inspector sheet head.
    //    (Chevron is hidden by Focused CSS; close-btn replaces it.)
    // ------------------------------------------------------------------
    if (inspectorHead && !inspectorHead.querySelector('.xr-sheet-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'xr-sheet-close-btn';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Close inspector panel');
      closeBtn.title = 'Close inspector (keeps selection)';
      closeBtn.addEventListener('click', () => {
        try {
          root.classList.remove('is-inspector-open');
          try { console.info('[XR·Sheet] Inspector sheet closed (selection preserved).'); } catch (_) {}
        } catch (_) {}
      });
      const chev = inspectorHead.querySelector('.xr-mobile-panel-head__chevron');
      if (chev) inspectorHead.insertBefore(closeBtn, chev);
      else inspectorHead.appendChild(closeBtn);
    }

    addSheetClose(document.querySelector('.xr-panel-tree'), 'xr-tree-sheet-close-btn', 'Close Composition panel', () => {
      root.classList.remove('is-tree-open');
      document.getElementById('btn-tree-toggle-sheet')?.classList.remove('is-active');
    });
    addSheetClose(document.querySelector('.xr-panel-surface'), 'xr-surface-sheet-close-btn', 'Close Surface panel', () => {
      root.classList.remove('is-surface-open');
    });

    // ------------------------------------------------------------------
    // 2. Sync Inspector title + open/close state with selected entity.
    //    Reads name from .xr-tree-row.is-active .xr-tree-row__name
    //    (single selection source of truth — rendered by scene-panels.js).
    // ------------------------------------------------------------------
    const syncInspectorFromSelection = () => {
      // Anti-cascade lock: if any MO-driven UI sync is already writing the DOM, skip this call.
      try {
        const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
        if (xr && xr._uiSyncingInProgress) return;
      } catch (_) {}
      try {
        // Acquire shared anti-cascade lock for ALL 3 MO sync functions.
        // Prevents: syncInspectorFromSelection → writes DOM → fires MO1/MO2/MO3 callbacks → calls them again → infinite cascade.
        try {
          const xrGlobal = (typeof window !== 'undefined') ? (window.XR = window.XR || {}) : null;
          if (xrGlobal) xrGlobal._uiSyncingInProgress = true;
        } catch (_) {}
        try {
          const activeRow = treeList?.querySelector('.xr-tree-row.is-active');
          const nameBtn = activeRow?.querySelector('.xr-tree-row__name');
          const name = (nameBtn?.textContent || '').trim() || null;

          if (name && name !== lastSelectedName) {
            // The mobile accordion must use the same stable panel vocabulary
            // as desktop.  The selected object's name remains in the panel
            // body, rather than turning the accordion label into a new name.
            if (inspectorTitle) inspectorTitle.textContent = isPhoneViewport() ? getInspectorPanelTitle() : 'INSPECTOR — ' + name;
            // In focused layouts Surface is the active editing sheet in Texture
            // mode. Opening Inspector underneath it made the two sheets overlap
            // and left controls visually present but unreachable.
            if (!isPhoneViewport() && !(isFocusedViewport() && isTextureMode())) {
              root.classList.add('is-inspector-open');
              try { console.info('[XR·Sheet] Inspector opened for: ' + name); } catch (_) {}
            }
            lastSelectedName = name;
          }

          if (!name) {
            if (inspectorTitle) inspectorTitle.textContent = getInspectorPanelTitle();
            if (root.classList.contains('is-inspector-open')) {
              root.classList.remove('is-inspector-open');
              try { console.info('[XR·Sheet] Inspector closed (no entity selected).'); } catch (_) {}
            }
            lastSelectedName = null;
          }
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
    };

    // Initial sync (covers case where selection exists before UI bootstrap)
    syncInspectorFromSelection();

    // ------------------------------------------------------------------
    // 3. MutationObserver on part-list — detects selection row class
    //    changes, renames, add/remove rows, etc.
    // Delay observation until after startup, then react only to the semantic
    // selection name. Rendering a tree can produce many DOM mutations without
    // a selection change; filtering those mutations prevents a microtask flood
    // without disconnecting the observer that keeps the inspector in sync.
    // ------------------------------------------------------------------
    try {
      // Do not widen this to `document.body`: selection changes are rendered
      // exclusively in the Composition list and observing the whole Shell
      // turns inspector-title/class writes into a MutationObserver cascade.
      const target = treeList;
      if (!target) return;
      try {
        window.setTimeout(() => {
          try {
            let _scheduled = false;
            let observedSelectionName = (treeList.querySelector('.xr-tree-row.is-active .xr-tree-row__name')?.textContent || '').trim() || null;
            const obs = new MutationObserver(() => {
              try {
                const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
                if (xr && xr._uiSyncingInProgress) return;
              } catch (_) {}
              const nextSelectionName = (treeList.querySelector('.xr-tree-row.is-active .xr-tree-row__name')?.textContent || '').trim() || null;
              if (nextSelectionName === observedSelectionName) return;
              observedSelectionName = nextSelectionName;
              if (_scheduled) return;
              _scheduled = true;
              try {
                window.setTimeout(() => {
                  _scheduled = false;
                  try { syncInspectorFromSelection(); } catch (_) {}
                }, 0);
              } catch (_) { _scheduled = false; }
            });
            obs.observe(target, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['class'],
              characterData: true,
            });
          } catch (_) {
            try { window.setTimeout(() => { try { syncInspectorFromSelection(); } catch (_) {} }, 750); } catch (_) {}
          }
        }, 250);
      } catch (_) {
        try { window.setTimeout(() => { try { syncInspectorFromSelection(); } catch (_) {} }, 750); } catch (_) {}
      }
    } catch (_) {
      try { window.setTimeout(() => { try { syncInspectorFromSelection(); } catch (_) {} }, 750); } catch (_) {}
    }

    // ------------------------------------------------------------------
    // 4. Task 5: Sticky Scene Browser toggle button (top-left viewport).
    //    Opens/closes the left-side Composition sheet (non-destructive).
    // ------------------------------------------------------------------
    const viewportPanel = document.querySelector('.xr-panel-viewport');
    if (viewportPanel && !viewportPanel.querySelector('.xr-btn-tree-toggle')) {
      const treeToggle = document.createElement('button');
      treeToggle.type = 'button';
      treeToggle.className = 'xr-btn-tree-toggle';
      treeToggle.id = 'btn-tree-toggle-sheet';
      treeToggle.setAttribute('aria-label', 'Toggle scene browser');
      treeToggle.title = 'Scene browser (Composition list)';
      treeToggle.innerHTML = '<span class="xr-btn-tree-toggle__icon"><span></span></span>';
      treeToggle.addEventListener('click', () => {
        const nowOpen = root.classList.toggle('is-tree-open');
        treeToggle.classList.toggle('is-active', nowOpen);
        const btnScene = document.getElementById('btn-scene');
        if (nowOpen) {
          root.dataset.sceneOpen = 'true';
          if (btnScene) btnScene.setAttribute('aria-expanded', 'true');
        } else {
          delete root.dataset.sceneOpen;
          if (btnScene) btnScene.setAttribute('aria-expanded', 'false');
        }
        try { console.info('[XR·Sheet] Scene Browser sheet: ' + (nowOpen ? 'OPEN' : 'CLOSED')); } catch (_) {}
      });
      // Prepend as first child of viewport panel (sticky absolute inside relative viewport)
      try { viewportPanel.prepend(treeToggle); } catch (_) { viewportPanel.appendChild(treeToggle); }
    }

    // A labelled dock is clearer than an icon-only hamburger on a phone. It
    // deliberately changes only sheet visibility, never the selection or the
    // editing mode, so a student can inspect an object and return to the canvas
    // without losing work.
    if (viewportPanel && !viewportPanel.querySelector('.xr-mobile-panel-dock')) {
      const dock = document.createElement('nav');
      dock.className = 'xr-mobile-panel-dock';
      dock.setAttribute('aria-label', 'Editor panels');
      const addDockButton = (name, action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'xr-mobile-panel-dock__button';
        button.textContent = name;
        button.addEventListener('click', action);
        dock.appendChild(button);
        return button;
      };
      addDockButton('Composition', () => {
        const open = !root.classList.contains('is-tree-open');
        root.classList.toggle('is-tree-open', open);
        root.classList.remove('is-inspector-open', 'is-surface-open');
        document.getElementById('btn-tree-toggle-sheet')?.classList.toggle('is-active', open);
      });
      addDockButton('Inspector', () => {
        root.classList.add('is-inspector-open');
        root.classList.remove('is-tree-open', 'is-surface-open');
        document.getElementById('btn-tree-toggle-sheet')?.classList.remove('is-active');
      });
      const surfaceButton = document.createElement('button');
      surfaceButton.type = 'button';
      surfaceButton.className = 'xr-mobile-panel-dock__button xr-mobile-panel-dock__surface';
      surfaceButton.textContent = 'Surface';
      surfaceButton.addEventListener('click', () => {
        if (!isTextureMode()) return;
        root.classList.add('is-surface-open');
        root.classList.remove('is-tree-open', 'is-inspector-open');
        document.getElementById('btn-tree-toggle-sheet')?.classList.remove('is-active');
      });
      dock.appendChild(surfaceButton);
      viewportPanel.appendChild(dock);
    }

    // Empty scene: the dock describes the next workflow but does not lead to
    // three empty sheets.  It becomes available immediately after the first
    // volume is created, without moving the user's attention away from canvas.
    const syncEmptySceneDock = () => {
      const dock = viewportPanel?.querySelector('.xr-mobile-panel-dock');
      if (!dock) return;
      const isEmpty = document.getElementById('xreate-editor-root')?.classList.contains('is-empty-scene') === true;
      dock.querySelectorAll('button').forEach((button) => {
        button.disabled = isEmpty;
        button.setAttribute('aria-disabled', isEmpty ? 'true' : 'false');
      });
    };
    syncEmptySceneDock();
    try {
      new MutationObserver(syncEmptySceneDock).observe(document.getElementById('xreate-editor-root'), {
        attributes: true,
        attributeFilter: ['class'],
      });
    } catch (_) {}

    // ------------------------------------------------------------------
    // 5. Task 5: Auto-close Composition sheet after user selects a row.
    //    (User picked entity → return to canvas context automatically.)
    // ------------------------------------------------------------------
    try {
      if (treeList) {
        treeList.addEventListener('click', (e) => {
          const row = e?.target?.closest?.('.xr-tree-row');
          if (!row) return;
          // Skip if double-click rename flow (non-primary click pattern).
          try {
            setTimeout(() => {
              if (root.classList.contains('is-tree-open')) {
                root.classList.remove('is-tree-open');
                const btn = document.getElementById('btn-tree-toggle-sheet');
                if (btn) btn.classList.remove('is-active');
                try { console.info('[XR·Sheet] Scene Browser closed after entity selection.'); } catch (_) {}
              }
            }, 220);
          } catch (_) {}
        }, true);
      }
    } catch (_) {}

    // ------------------------------------------------------------------
    // 6. Task 6: Texture mode → auto-open Surface bottom sheet;
    //    Draft3D → close Surface sheet.
    //    Observed via :root data-ui-mode attribute (mutations on <html>).
    // ------------------------------------------------------------------
    const syncSurfaceSheetByMode = () => {
      clearPhoneSheetState();
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
          const uiMode = (root.getAttribute('data-ui-mode') || '').trim() || 'draft3d';
          if (uiMode === 'texture') {
            // A phone opens in a usable canvas-first state. Surface is an
            // intentional edit panel, opened from the labelled dock, rather
            // than a blank sheet that immediately covers the canvas.
            if (isPhoneViewport()) root.classList.remove('is-surface-open');
            else root.classList.add('is-surface-open');
            // A narrow screen has room for one bottom editing sheet. Surface
            // owns that space in Texture mode; Inspector remains available in
            // Draft mode after returning to it.
            if (isFocusedViewport()) root.classList.remove('is-inspector-open');
          } else {
            root.classList.remove('is-surface-open');
          }
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
    };
    syncSurfaceSheetByMode();
    try {
      // FIXED 20260903 (REV B) — True anti microtask infinite loop guard.
      // Same pattern as selection MO: DEFER .observe(target, opts) to
      // setTimeout(250ms) MACROTASK so the observer never witnesses the
      // boot DOM mutation storm. syncSurfaceSheetByMode() also mutates
      // root.classList (DOM mutation), so callback body is setTimeout 0.
      try {
        window.setTimeout(() => {
          let _callCount2 = 0;
          let _hardDisabled2 = false;
          let _scheduled2 = false;
          const modeObs = new MutationObserver(() => {
            try {
              const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
              if (xr && xr._uiSyncingInProgress) return;
            } catch (_) {}
            if (_hardDisabled2) return;
            _callCount2 = (_callCount2 || 0) + 1;
            if ((_callCount2 || 0) > 50) {
              _hardDisabled2 = true;
              try { console.warn('[XR·MO-GUARD] viewport-controls ui-mode MutationObserver: >50 invocations in mount window. Permanently disconnecting to prevent microtask flood.'); } catch (_) {}
              try { modeObs && modeObs.disconnect && modeObs.disconnect(); } catch (_) {}
              return;
            }
            if (_scheduled2) return;
            _scheduled2 = true;
            try {
              window.setTimeout(() => {
                _scheduled2 = false;
                if (_hardDisabled2) return;
                try { syncSurfaceSheetByMode(); } catch (_) {}
              }, 0);
            } catch (_) { _scheduled2 = false; }
          });
          modeObs.observe(root, { attributes: true, attributeFilter: ['data-ui-mode'] });
        }, 250);
      } catch (_) {}
    } catch (_) {}

    // ------------------------------------------------------------------
    // Task C4: Orientation / Resize stability handler for Focused sheets.
    // Pattern anti-thrash: (1) idempotence guard, (2) macrotask wrap 120ms,
    // (3) hard-cap 12 invocations → permanent disconnect, (4) lock respect.
    // Debounce delta 120px on resize to ignore small subpixel scrollbars.
    // ------------------------------------------------------------------
    try {
      if (root.dataset.orientationHandlersBound !== '1') {
        root.dataset.orientationHandlersBound = '1';
        let _orCallCount = 0;
        let _orDisabled = false;
        let _orScheduled = false;
        let _lastW = window.innerWidth;
        let _lastH = window.innerHeight;
        const runOrStabilize = () => {
          try {
            const xr = (typeof window !== 'undefined' && window.XR) ? window.XR : null;
            if (xr && xr._uiSyncingInProgress) return;
          } catch (_) {}
          if (_orDisabled) return;
          _orCallCount = (_orCallCount || 0) + 1;
          if ((_orCallCount || 0) > 12) {
            _orDisabled = true;
            try { console.warn('[XR·OR-GUARD] orientation/resize stability handler: >12 invocations. Permanently disabling to avoid layout thrash.'); } catch (_) {}
            try { window.removeEventListener('orientationchange', orientationHandler, true); } catch (_) {}
            try { window.removeEventListener('resize', resizeHandler, true); } catch (_) {}
            return;
          }
          if (_orScheduled) return;
          _orScheduled = true;
          try {
            window.setTimeout(() => {
              _orScheduled = false;
              if (_orDisabled) return;
              try { syncSurfaceSheetByMode(); } catch (_) {}
              try {
                const threeWrap = document.querySelector('.xr-three-wrap');
                if (threeWrap && typeof window !== 'undefined') {
                  try { window.dispatchEvent(new Event('resize', { bubbles: false, cancelable: false })); } catch (_) {}
                }
              } catch (_) {}
              try { console.info('[XR·OR] Sheet + viewport stabilized after orientation/resize.'); } catch (_) {}
            }, 120);
          } catch (_) { _orScheduled = false; }
        };
        const orientationHandler = () => { runOrStabilize(); };
        const resizeHandler = () => {
          try {
            const w = window.innerWidth;
            const h = window.innerHeight;
            if (Math.abs(w - _lastW) < 120 && Math.abs(h - _lastH) < 120) return;
            _lastW = w; _lastH = h;
            runOrStabilize();
          } catch (_) {}
        };
        try { window.addEventListener('orientationchange', orientationHandler, true); } catch (_) {}
        try { window.addEventListener('resize', resizeHandler, true); } catch (_) {}
      }
    } catch (_) {}

    // Expose small debug surface (no-ops in release, safe)
    XR.__dbg = XR.__dbg || {};
    XR.__dbg.sheetUI = {
      openInspector:  () => root.classList.add('is-inspector-open'),
      closeInspector: () => root.classList.remove('is-inspector-open'),
      openTree:       () => { root.classList.add('is-tree-open'); document.getElementById('btn-tree-toggle-sheet')?.classList.add('is-active'); },
      closeTree:      () => { root.classList.remove('is-tree-open'); document.getElementById('btn-tree-toggle-sheet')?.classList.remove('is-active'); },
      openSurface:    () => root.classList.add('is-surface-open'),
      closeSurface:   () => root.classList.remove('is-surface-open'),
      sync: syncInspectorFromSelection,
      syncMode: syncSurfaceSheetByMode,
    };
  }

  return {
    bind,
    syncUvWideButton,
    toggleUvWideUi,
  };
}

XR.__modules.ShellViewportControls = XR.__modules.ShellViewportControls || {};
XR.__modules.ShellViewportControls.create = create;
