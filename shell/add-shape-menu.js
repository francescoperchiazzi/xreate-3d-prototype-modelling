const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const archetypes = opts?.archetypes || {};
  const drawIcon = opts?.drawIcon || XR?.Icons?.drawIcon || XR?.__modules?.Icons?.drawIcon || null;
  const setCurrentArchetype = opts?.setCurrentArchetype || null;
  const addPartFromArchetype = opts?.addPartFromArchetype || null;
  const openDoodleModal = opts?.openDoodleModal || null;
  const tr = (typeof opts?.tr === 'function') ? opts.tr : ((key) => String(key));

  // The tracing canvas needs substantially more continuous space than a phone
  // can offer. Keep the entry visible (so the feature is discoverable), but
  // never start a modal that cannot provide an acceptable drawing experience.
  const isDoodleUnavailable = () => {
    try {
      return window.matchMedia('(max-width: 767px), (max-height: 520px) and (pointer: coarse)').matches;
    } catch (_) {
      return (window.innerWidth || 0) <= 767;
    }
  };

  // Add Volume can be constructed before the asynchronous locale catalog has
  // finished loading. Never expose a raw translation key in that interval.
  const localized = (key, fallback) => {
    try {
      const value = tr(key);
      return value && value !== key ? value : fallback;
    } catch (_) {
      return fallback;
    }
  };

  function getMenu() {
    return document.getElementById('add-shape-menu');
  }

  function getDefaultButton() {
    return document.getElementById('btn-add-shape');
  }

  function getItems() {
    const menu = getMenu();
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('button.xr-add-shape__item'));
  }

  function focusItem(nextIndex) {
    const items = getItems();
    if (!items.length) return;
    const n = items.length;
    const idx = ((Number(nextIndex) | 0) % n + n) % n;
    for (let i = 0; i < items.length; i++) items[i].tabIndex = (i === idx) ? 0 : -1;
    try { items[idx].focus(); } catch (_) {}
  }

  function close() {
    const menu = getMenu();
    const btn = getDefaultButton();
    if (!menu) return;
    menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function build() {
    const body = document.getElementById('add-shape-body');
    if (!body) return;
    body.innerHTML = '';

    for (const [catName, items] of Object.entries(archetypes)) {
      const cat = document.createElement('div');
      cat.className = 'xr-add-shape__cat';
      cat.textContent = catName;
      body.appendChild(cat);

      const row = document.createElement('div');
      row.className = 'xr-add-shape__row';
      for (const arch of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'xr-add-shape__item';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('aria-label', `Add volume: ${arch.label}`);
        btn.setAttribute('tabindex', '-1');
        if (arch && typeof arch.id !== 'undefined' && arch.id !== null) {
          btn.setAttribute('data-shape-id', String(arch.id));
        }
        const doodleUnavailable = arch?.id === 'doodle' && isDoodleUnavailable();
        if (doodleUnavailable) {
          // Set this before the icon is painted: canvas drawing reads the
          // inherited foreground colour only once.
          btn.classList.add('is-unavailable');
          btn.setAttribute('aria-disabled', 'true');
          btn.title = localized('doodle_phone_unavailable', 'Doodle needs a larger drawing canvas. It is available on tablet and desktop.');
          btn.setAttribute('aria-description', btn.title);
        }

        const iconCanvas = document.createElement('canvas');
        const addIconSize = (arch && arch.id === 'doodle') ? 52 : 34;
        const addIconDpr = window.devicePixelRatio || 1;
        iconCanvas.width = Math.max(1, Math.round(addIconSize * addIconDpr));
        iconCanvas.height = Math.max(1, Math.round(addIconSize * addIconDpr));
        iconCanvas.style.width = addIconSize + 'px';
        iconCanvas.style.height = addIconSize + 'px';
        iconCanvas.className = 'xr-add-shape__icon';
        iconCanvas.setAttribute('aria-hidden', 'true');
        iconCanvas.dataset.icon = arch.icon;

        const label = document.createElement('span');
        label.textContent = arch.label;
        btn.appendChild(iconCanvas);
        btn.appendChild(label);
        if (arch && arch.id === 'doodle') {
          const badge = document.createElement('span');
          badge.className = 'xr-add-shape__doodle-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.textContent = 'PRINCIPAL';
          btn.appendChild(badge);

          const phoneNote = document.createElement('span');
          phoneNote.className = 'xr-add-shape__doodle-phone-note';
          phoneNote.setAttribute('aria-hidden', 'true');
          phoneNote.textContent = localized('doodle_phone_unavailable_short', 'Use on tablet or desktop');
          btn.appendChild(phoneNote);
        }
        btn.addEventListener('click', () => {
          if (arch && arch.id === 'doodle') {
            if (isDoodleUnavailable()) {
              btn.setAttribute('aria-disabled', 'true');
              btn.title = localized('doodle_phone_unavailable', 'Doodle needs a larger drawing canvas. It is available on tablet and desktop.');
              return;
            }
            try { setCurrentArchetype && setCurrentArchetype(arch); } catch (_) {}
            try { openDoodleModal && openDoodleModal(); } catch (_) {}
            close();
            return;
          }
          try { setCurrentArchetype && setCurrentArchetype(arch); } catch (_) {}
          try { addPartFromArchetype && addPartFromArchetype(arch); } catch (_) {}
          close();
        });
        row.appendChild(btn);
      }
      body.appendChild(row);
    }

    for (const iconCanvas of body.querySelectorAll('canvas.xr-add-shape__icon')) {
      try {
        const ctx = iconCanvas.getContext('2d');
        if (!ctx) continue;
        const color = getComputedStyle(iconCanvas).color || '#1c1a16';
        drawIcon && drawIcon(ctx, iconCanvas.dataset.icon || 'unknown', 34, { fg: color });
      } catch (_) {}
    }

  }

  function open(anchorEl) {
    const menu = getMenu();
    const btn = anchorEl || getDefaultButton();
    if (!menu || !btn) return;
    const body = document.getElementById('add-shape-body');
    if (body && !body.children.length) {
      try { build(); } catch (_) {}
    }
    if (!menu.dataset.kbdBound) {
      menu.dataset.kbdBound = '1';
      menu.addEventListener('keydown', (e) => {
        const items = getItems();
        if (!items.length) return;
        const ae = document.activeElement;
        const cur = Math.max(0, items.indexOf(ae));
        if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(cur + 1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(cur - 1); return; }
        if (e.key === 'Home') { e.preventDefault(); focusItem(0); return; }
        if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); return; }
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          try { getDefaultButton()?.focus?.(); } catch (_) {}
          return;
        }
        if (e.key === 'Tab') {
          close();
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          if (ae && ae.click && items.includes(ae)) {
            e.preventDefault();
            ae.click();
          }
        }
      });
    }
    const r = btn.getBoundingClientRect();
    const w = Math.min(640, Math.max(280, window.innerWidth - 16));
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    menu.style.left = left + 'px';
    menu.style.top = (r.bottom + 6) + 'px';
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    focusItem(0);
  }

  function toggle() {
    const menu = getMenu();
    if (!menu) return;
    if (menu.hidden) open();
    else close();
  }

  return {
    build,
    getItems,
    focusItem,
    open,
    close,
    toggle,
  };
}

XR.__modules.ShellAddShapeMenu = XR.__modules.ShellAddShapeMenu || {};
XR.__modules.ShellAddShapeMenu.create = create;
