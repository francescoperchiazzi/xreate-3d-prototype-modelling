const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

function resolveModalApi() {
  return {
    openModal: XR?.openModal || null,
    closeModal: XR?.closeModal || null,
  };
}

function bindOnce(el, key, eventName, handler) {
  if (!el || typeof handler !== 'function') return;
  if (el[key]) return;
  el[key] = true;
  el.addEventListener(eventName, handler);
}

export function create(opts) {
  const t = (opts && typeof opts.t === 'function') ? opts.t : ((key) => String(key));
  const storageGet = (opts && typeof opts.storageGet === 'function') ? opts.storageGet : (() => null);
  const storageSet = (opts && typeof opts.storageSet === 'function') ? opts.storageSet : (() => false);
  const closeAppMenu = (opts && typeof opts.closeAppMenu === 'function') ? opts.closeAppMenu : (() => {});

  const shortcutsBtn = document.getElementById('btn-shortcuts');
  const shortcutsModal = document.getElementById('shortcutsModal');
  const shortcutsClose = document.getElementById('shortcutsClose');

  const uvCompareModal = document.getElementById('uvCompareModal');
  const uvCompareClose = document.getElementById('uvCompareClose');

  const shareBtn = document.getElementById('btn-share');
  const shareModal = document.getElementById('share-modal');
  const shareClose = document.getElementById('share-close');
  const shareCopyLabel = document.getElementById('share-copy-label');

  const mastodonModal = document.getElementById('mastodon-modal');
  const mastodonClose = document.getElementById('mastodon-close');
  const mastodonCancel = document.getElementById('mastodon-cancel');
  const mastodonContinue = document.getElementById('mastodon-continue');
  const mastodonInput = document.getElementById('mastodon-instance-input');

  let shortcutsModalApi = null;
  let uvCompareModalApi = null;
  let shortcutsModalState = null;
  let uvCompareModalState = null;
  let shareModalState = null;
  let mastodonModalState = null;
  let mastodonResolve = null;
  let mastodonDefault = 'mastodon.social';
  let mastodonReturnFocusEl = null;

  function ensureShortcutsModalApi() {
    if (shortcutsModalApi) return shortcutsModalApi;
    const mod = XR?.__modules?.ShellEditorModals || null;
    if (!mod || typeof mod.createShortcutsModal !== 'function') return null;
    try {
      shortcutsModalApi = mod.createShortcutsModal({
        shortcutsBtn,
        shortcutsModal,
        shortcutsClose,
        closeAppMenu,
      });
      return shortcutsModalApi;
    } catch (_) {
      return null;
    }
  }

  function ensureUvCompareModalApi() {
    if (uvCompareModalApi) return uvCompareModalApi;
    const mod = XR?.__modules?.ShellEditorModals || null;
    if (!mod || typeof mod.createUvCompareModal !== 'function') return null;
    try {
      uvCompareModalApi = mod.createUvCompareModal({
        uvCompareModal,
        uvCompareClose,
      });
      return uvCompareModalApi;
    } catch (_) {
      return null;
    }
  }

  function openShortcutsModal() {
    const api = ensureShortcutsModalApi();
    if (api && typeof api.openShortcutsModal === 'function') {
      try { api.openShortcutsModal(); return; } catch (_) {}
    }
    const { openModal, closeModal } = resolveModalApi();
    if (!shortcutsModal || !openModal) return;
    try { if (shortcutsModalState && typeof closeModal === 'function') closeModal(shortcutsModalState); } catch (_) {}
    shortcutsModalState = openModal(shortcutsModal, {
      initialFocusEl: shortcutsClose,
      returnFocusEl: document.activeElement,
      onRequestClose: closeShortcutsModal,
    });
  }

  function closeShortcutsModal() {
    const api = ensureShortcutsModalApi();
    if (api && typeof api.closeShortcutsModal === 'function') {
      try { api.closeShortcutsModal(); return; } catch (_) {}
    }
    const { closeModal } = resolveModalApi();
    if (!shortcutsModal || !closeModal) return;
    if (shortcutsModalState) {
      const st = shortcutsModalState;
      shortcutsModalState = null;
      closeModal(st);
    } else {
      closeModal(shortcutsModal);
    }
  }

  function openUvCompareModal() {
    const api = ensureUvCompareModalApi();
    if (api && typeof api.openUvCompareModal === 'function') {
      try { api.openUvCompareModal(); return; } catch (_) {}
    }
    const { openModal, closeModal } = resolveModalApi();
    if (!uvCompareModal || !openModal) return;
    try { if (uvCompareModalState && typeof closeModal === 'function') closeModal(uvCompareModalState); } catch (_) {}
    uvCompareModalState = openModal(uvCompareModal, {
      initialFocusEl: uvCompareClose,
      returnFocusEl: document.activeElement,
      onRequestClose: closeUvCompareModal,
    });
  }

  function closeUvCompareModal() {
    const api = ensureUvCompareModalApi();
    if (api && typeof api.closeUvCompareModal === 'function') {
      try { api.closeUvCompareModal(); return; } catch (_) {}
    }
    const { closeModal } = resolveModalApi();
    if (!uvCompareModal || !closeModal) return;
    if (uvCompareModalState) {
      const st = uvCompareModalState;
      uvCompareModalState = null;
      closeModal(st);
    } else {
      closeModal(uvCompareModal);
    }
  }

  function getShareUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical?.href || window.location.href;
  }

  function getShareText() {
    const title = document.title || 'XReate';
    return `${title} — ${t('share_tagline')}`;
  }

  function openShareModal() {
    const { openModal, closeModal } = resolveModalApi();
    if (!shareModal || !openModal) return;
    try { shareBtn?.setAttribute?.('aria-expanded', 'true'); } catch (_) {}
    try { if (shareModalState && typeof closeModal === 'function') closeModal(shareModalState); } catch (_) {}
    shareModalState = openModal(shareModal, {
      initialFocusEl: shareClose,
      returnFocusEl: shareBtn,
      onRequestClose: closeShareModal,
    });
  }

  function closeShareModal() {
    const { closeModal } = resolveModalApi();
    if (!shareModal || !closeModal) return;
    try { shareBtn?.setAttribute?.('aria-expanded', 'false'); } catch (_) {}
    if (shareModalState) {
      const st = shareModalState;
      shareModalState = null;
      closeModal(st);
    } else {
      closeModal(shareModal);
    }
    if (shareCopyLabel) shareCopyLabel.textContent = t('share_copy_link');
  }

  function closeMastodonInstanceModal(value) {
    const { closeModal } = resolveModalApi();
    if (!mastodonModal || !closeModal) return;
    if (mastodonModalState) {
      const st = mastodonModalState;
      mastodonModalState = null;
      closeModal(st);
    } else {
      closeModal(mastodonModal);
    }
    const resolve = mastodonResolve;
    mastodonResolve = null;
    if (resolve) resolve(value || null);
    mastodonReturnFocusEl = null;
  }

  function openMastodonInstanceModal(defaultValue) {
    const { openModal, closeModal } = resolveModalApi();
    if (!mastodonModal || !mastodonInput || !openModal) return Promise.resolve(defaultValue || null);
    mastodonReturnFocusEl = document.activeElement || null;
    mastodonDefault = String(defaultValue || 'mastodon.social');
    mastodonInput.value = mastodonDefault;
    try { if (mastodonModalState && typeof closeModal === 'function') closeModal(mastodonModalState); } catch (_) {}
    mastodonModalState = openModal(mastodonModal, {
      initialFocusEl: mastodonInput,
      returnFocusEl: mastodonReturnFocusEl,
      onRequestClose: () => closeMastodonInstanceModal(null),
    });
    setTimeout(() => { try { mastodonInput.focus(); mastodonInput.select(); } catch (_) {} }, 0);
    return new Promise((resolve) => { mastodonResolve = resolve; });
  }

  function bindShareButtons() {
    bindOnce(shareBtn, '__xrShareOpenBound', 'click', async () => {
      const url = getShareUrl();
      const text = getShareText();
      if (navigator.share) {
        try {
          await navigator.share({ title: document.title || 'XReate', text, url });
          return;
        } catch (_) {}
      }
      openShareModal();
    });
    bindOnce(shareClose, '__xrShareCloseBound', 'click', closeShareModal);

    shareModal?.querySelectorAll?.('[data-share]')?.forEach((btn) => {
      bindOnce(btn, '__xrShareActionBound', 'click', async () => {
        const kind = btn.getAttribute('data-share');
        const url = getShareUrl();
        const text = getShareText();
        const encodedUrl = encodeURIComponent(url);
        const encodedText = encodeURIComponent(text);

        if (kind === 'copy') {
          try {
            await navigator.clipboard.writeText(url);
            if (shareCopyLabel) shareCopyLabel.textContent = t('share_copied');
          } catch (_) {}
          return;
        }

        let shareLink = '';
        if (kind === 'bluesky') shareLink = `https://bsky.app/intent/compose?text=${encodedText}%0A${encodedUrl}`;
        if (kind === 'x') shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        if (kind === 'linkedin') shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        if (kind === 'facebook') shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        if (kind === 'mastodon') {
          const stored = storageGet('mastodonInstance') || 'mastodon.social';
          const instance = await openMastodonInstanceModal(stored);
          if (!instance) return;
          const cleaned = String(instance).trim().replace(/^https?:\/\//, '');
          let host = '';
          try {
            const u = new URL('https://' + cleaned);
            if (u.username || u.password) throw new Error('bad-auth');
            if (u.pathname !== '/' || u.search || u.hash) throw new Error('bad-path');
            host = u.hostname || '';
          } catch (_) {
            host = '';
          }
          if (!host || host.includes('@')) return;
          storageSet('mastodonInstance', host);
          shareLink = `https://${host}/share?text=${encodedText}%0A${encodedUrl}`;
        }
        if (shareLink) window.open(shareLink, '_blank', 'noopener,noreferrer');
      });
    });
  }

  function bindMastodonModal() {
    bindOnce(mastodonClose, '__xrMastodonCloseBound', 'click', () => closeMastodonInstanceModal(null));
    bindOnce(mastodonCancel, '__xrMastodonCancelBound', 'click', () => closeMastodonInstanceModal(null));
    bindOnce(mastodonContinue, '__xrMastodonContinueBound', 'click', () => {
      const raw = (mastodonInput && typeof mastodonInput.value === 'string') ? mastodonInput.value.trim() : '';
      closeMastodonInstanceModal(raw || mastodonDefault);
    });
    bindOnce(mastodonModal, '__xrMastodonKeydownBound', 'keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const raw = (mastodonInput && typeof mastodonInput.value === 'string') ? mastodonInput.value.trim() : '';
      closeMastodonInstanceModal(raw || mastodonDefault);
    });
  }

  function normalizeOverlayParents() {
    try {
      document.querySelectorAll('.xr-modal-overlay, .xr-sheet-overlay, .xr-image-overlay, .xr-menu-overlay').forEach((el) => {
        try { if (el && el.parentElement !== document.body) document.body.appendChild(el); } catch (_) {}
      });
    } catch (_) {}
  }

  function bind() {
    const boundShortcutsApi = ensureShortcutsModalApi();
    if (boundShortcutsApi && typeof boundShortcutsApi.bind === 'function') {
      try { boundShortcutsApi.bind(); } catch (_) {}
    } else {
      bindOnce(shortcutsBtn, '__xrShortcutsOpenBound', 'click', () => { closeAppMenu(); openShortcutsModal(); });
      bindOnce(shortcutsClose, '__xrShortcutsCloseBound', 'click', closeShortcutsModal);
      XR.__modules.ShellEditorModals = XR.__modules.ShellEditorModals || {};
      XR.__modules.ShellEditorModals.openShortcutsModal = openShortcutsModal;
      XR.__modules.ShellEditorModals.closeShortcutsModal = closeShortcutsModal;
    }

    const boundUvCompareApi = ensureUvCompareModalApi();
    if (boundUvCompareApi && typeof boundUvCompareApi.bind === 'function') {
      try { boundUvCompareApi.bind(); } catch (_) {}
    } else {
      bindOnce(uvCompareClose, '__xrUvCompareCloseBound', 'click', closeUvCompareModal);
      XR.__modules.ShellEditorModals = XR.__modules.ShellEditorModals || {};
      XR.__modules.ShellEditorModals.openUvCompareModal = openUvCompareModal;
      XR.__modules.ShellEditorModals.closeUvCompareModal = closeUvCompareModal;
    }

    bindShareButtons();
    bindMastodonModal();
    normalizeOverlayParents();
  }

  return {
    bind,
    openShortcutsModal,
    closeShortcutsModal,
    openUvCompareModal,
    closeUvCompareModal,
    openShareModal,
    closeShareModal,
    openMastodonInstanceModal,
    closeMastodonInstanceModal,
  };
}

XR.__modules.ShellBodyOverlays = XR.__modules.ShellBodyOverlays || {};
XR.__modules.ShellBodyOverlays.create = create;
