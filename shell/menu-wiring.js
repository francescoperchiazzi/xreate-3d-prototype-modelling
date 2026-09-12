const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const openAddShapeMenu = opts?.openAddShapeMenu || null;
  const closeAddShapeMenu = opts?.closeAddShapeMenu || null;
  const toggleAddShapeMenu = opts?.toggleAddShapeMenu || null;
  const openAutosaveModal = opts?.openAutosaveModal || null;
  const closeExportModal = opts?.closeExportModal || null;
  const exportGLB = opts?.exportGLB || null;
  const exportUSDZ = opts?.exportUSDZ || null;
  const exportTextureAtlas = opts?.exportTextureAtlas || null;
  const openModal = opts?.openModal || null;
  const closeModal = opts?.closeModal || null;

  const btnExportTrigger = document.getElementById('btn-export-trigger');
  const exportDropdown = document.getElementById('xr-export-dropdown');
  const exportGroup = btnExportTrigger ? btnExportTrigger.closest('.xr-export-group') : null;
  const btnGlb = document.getElementById('btn-export-glb');
  const btnUsdz = document.getElementById('btn-export-usdz');
  const btnExportAtlas = document.getElementById('btn-export-atlas');
  const exportClose = document.getElementById('exportModalClose');

  const btnAddShape = document.getElementById('btn-add-shape');
  const btnTreeAddVolume = document.getElementById('btn-tree-add-volume');
  const btnProjectAutosave = document.getElementById('btn-project-autosave');

  const appMenuBtn = document.getElementById('btn-app-menu');
  const appMenu = document.getElementById('app-menu');
  const appMenuClose = document.getElementById('btn-app-menu-close');
  const appMenuTabs = appMenu ? Array.from(appMenu.querySelectorAll('.xr-menu-tab')) : [];
  const appMenuSections = appMenu ? Array.from(appMenu.querySelectorAll('.xr-menu__section')) : [];
  let appMenuState = null;

  function setAppMenuTab(tabId) {
    const key = String(tabId || 'project');
    for (const sec of appMenuSections) {
      const on = sec && sec.dataset && sec.dataset.tab === key;
      if (sec) sec.hidden = !on;
    }
    for (const btn of appMenuTabs) {
      const on = btn && btn.dataset && btn.dataset.tab === key;
      if (btn) btn.classList.toggle('is-active', !!on);
      if (btn) btn.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) btn.removeAttribute('tabindex');
      else btn.setAttribute('tabindex', '-1');
    }
  }

  function openAppMenu() {
    if (!appMenu || !openModal) return;
    setAppMenuTab('project');
    try { if (appMenuState && typeof closeModal === 'function') closeModal(appMenuState); } catch (_) {}
    appMenuState = openModal(appMenu, {
      initialFocusEl: appMenuClose,
      returnFocusEl: appMenuBtn,
      onRequestClose: closeAppMenu,
    });
    try { appMenuBtn?.setAttribute?.('aria-expanded', 'true'); } catch (_) {}
  }

  function closeAppMenu() {
    if (!appMenu || !closeModal) return;
    try { appMenuBtn?.setAttribute?.('aria-expanded', 'false'); } catch (_) {}
    if (appMenuState) {
      const st = appMenuState;
      appMenuState = null;
      closeModal(st);
    } else {
      closeModal(appMenu);
    }
  }

  function bind() {
    if (btnExportTrigger && exportDropdown && !btnExportTrigger.dataset.boundMenuWiring) {
      btnExportTrigger.dataset.boundMenuWiring = '1';
      btnExportTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = !exportDropdown.hidden;
        exportDropdown.hidden = isOpen;
        btnExportTrigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });
      document.addEventListener('click', (e) => {
        if (!exportGroup || !exportDropdown || exportDropdown.hidden) return;
        const t = e.target;
        if (t && exportGroup.contains(t)) return;
        exportDropdown.hidden = true;
        btnExportTrigger.setAttribute('aria-expanded', 'false');
      }, true);
    }

    const closeExportDropdown = () => {
      if (!exportDropdown || exportDropdown.hidden) return;
      exportDropdown.hidden = true;
      btnExportTrigger?.setAttribute('aria-expanded', 'false');
    };
    if (btnGlb && !btnGlb.dataset.boundMenuWiring) {
      btnGlb.dataset.boundMenuWiring = '1';
      btnGlb.addEventListener('click', () => {
        closeExportDropdown();
        exportGLB && exportGLB();
      });
    }
    if (btnUsdz && !btnUsdz.dataset.boundMenuWiring) {
      btnUsdz.dataset.boundMenuWiring = '1';
      btnUsdz.addEventListener('click', () => {
        closeExportDropdown();
        exportUSDZ && exportUSDZ();
      });
    }
    if (btnExportAtlas && !btnExportAtlas.dataset.boundMenuWiring) {
      btnExportAtlas.dataset.boundMenuWiring = '1';
      btnExportAtlas.addEventListener('click', () => {
        closeExportDropdown();
        exportTextureAtlas && exportTextureAtlas();
      });
    }
    if (exportClose && !exportClose.dataset.boundMenuWiring) {
      exportClose.dataset.boundMenuWiring = '1';
      exportClose.addEventListener('click', () => closeExportModal && closeExportModal());
    }

    if (btnAddShape && !btnAddShape.dataset.boundMenuWiring) {
      btnAddShape.dataset.boundMenuWiring = '1';
      btnAddShape.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAddShapeMenu && toggleAddShapeMenu();
      });
      btnAddShape.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openAddShapeMenu && openAddShapeMenu(btnAddShape);
        }
      });
    }

    if (btnTreeAddVolume && !btnTreeAddVolume.dataset.boundMenuWiring) {
      btnTreeAddVolume.dataset.boundMenuWiring = '1';
      btnTreeAddVolume.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAddShapeMenu && openAddShapeMenu(btnTreeAddVolume);
      });
    }

    if (btnProjectAutosave && !btnProjectAutosave.dataset.boundMenuWiring) {
      btnProjectAutosave.dataset.boundMenuWiring = '1';
      btnProjectAutosave.addEventListener('click', async () => {
        try { await openAutosaveModal?.(); } catch (_) {}
      });
    }

    if (!document.documentElement.dataset.xrAddShapePointerBound) {
      document.documentElement.dataset.xrAddShapePointerBound = '1';
      document.addEventListener('pointerdown', (e) => {
        const menu = document.getElementById('add-shape-menu');
        if (!menu || menu.hidden) return;
        const btn = document.getElementById('btn-add-shape');
        const target = e.target;
        if (btn && btn.contains(target)) return;
        if (menu.contains(target)) return;
        closeAddShapeMenu && closeAddShapeMenu();
      }, true);
    }

    if (!document.documentElement.dataset.xrAutosaveShortcutBound) {
      document.documentElement.dataset.xrAutosaveShortcutBound = '1';
      document.addEventListener('keydown', (e) => {
        const k = String(e && e.key ? e.key : '');
        if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
        if (k.toLowerCase() !== 'a') return;
        e.preventDefault();
        try { void openAutosaveModal?.(); } catch (_) {}
      }, true);
    }

    for (const btn of appMenuTabs) {
      if (!btn || btn.dataset.boundMenuWiring) continue;
      btn.dataset.boundMenuWiring = '1';
      btn.addEventListener('click', () => {
        if (!btn || !btn.dataset) return;
        setAppMenuTab(btn.dataset.tab);
      });
      btn.addEventListener('keydown', (e) => {
        const k = (e && e.key) ? e.key : '';
        if (!k) return;
        if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
        e.preventDefault();
        if (!appMenuTabs.length) return;
        const idx = appMenuTabs.indexOf(btn);
        let nextIdx = idx;
        if (k === 'ArrowLeft') nextIdx = (idx - 1 + appMenuTabs.length) % appMenuTabs.length;
        else if (k === 'ArrowRight') nextIdx = (idx + 1) % appMenuTabs.length;
        else if (k === 'Home') nextIdx = 0;
        else if (k === 'End') nextIdx = appMenuTabs.length - 1;
        const nextBtn = appMenuTabs[nextIdx];
        if (!nextBtn) return;
        setAppMenuTab(nextBtn.dataset.tab);
        try { nextBtn.focus(); } catch (_) {}
      });
    }

    if (appMenuBtn && !appMenuBtn.dataset.boundMenuWiring) {
      appMenuBtn.dataset.boundMenuWiring = '1';
      appMenuBtn.addEventListener('click', openAppMenu);
    }
    if (appMenuClose && !appMenuClose.dataset.boundMenuWiring) {
      appMenuClose.dataset.boundMenuWiring = '1';
      appMenuClose.addEventListener('click', closeAppMenu);
    }
  }

  return { bind, setAppMenuTab, openAppMenu, closeAppMenu };
}

XR.__modules.ShellMenuWiring = XR.__modules.ShellMenuWiring || {};
XR.__modules.ShellMenuWiring.create = create;

try {
  create({
    openAddShapeMenu: (anchorEl) => {
      try { return XR?.openAddShapeMenu?.(anchorEl); } catch (_) { return null; }
    },
    closeAddShapeMenu: () => {
      try { return XR?.closeAddShapeMenu?.(); } catch (_) { return null; }
    },
    toggleAddShapeMenu: () => {
      try { return XR?.toggleAddShapeMenu?.(); } catch (_) { return null; }
    },
    openAutosaveModal: async () => {
      try { return await XR?.openAutosaveModal?.(); } catch (_) { return null; }
    },
    closeExportModal: () => {
      try { return XR?.closeExportModal?.(); } catch (_) { return null; }
    },
    exportGLB: () => {
      try {
        const fn = XR?.__modules?.exportGLB || null;
        if (typeof fn === 'function') return fn();
      } catch (_) {}
      return null;
    },
    exportUSDZ: () => {
      try {
        const fn = XR?.__modules?.exportUSDZ || null;
        if (typeof fn === 'function') return fn();
      } catch (_) {}
      return null;
    },
    exportTextureAtlas: () => {
      try {
        const fn = XR?.__modules?.exportTextureAtlas || null;
        if (typeof fn === 'function') return fn();
      } catch (_) {}
      return null;
    },
    openModal: (...args) => {
      try { return XR?.openModal?.(...args); } catch (_) { return null; }
    },
    closeModal: (...args) => {
      try { return XR?.closeModal?.(...args); } catch (_) { return null; }
    },
  }).bind();
} catch (_) {}
