const trapState = new WeakMap();

function getFocusable(el) {
  if (!el) return [];
  const sel = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(',');
  let nodes = [];
  try { nodes = Array.from(el.querySelectorAll(sel)); } catch (_) {}
  return nodes.filter((n) => {
    if (!n) return false;
    if (n.offsetParent === null && n !== document.activeElement) return false;
    const tab = n.getAttribute('tabindex');
    if (tab === '-1') return false;
    return true;
  });
}

export function activate(el) {
  if (!el || !(el instanceof Element)) return;
  if (trapState.has(el)) return;
  const prevActive = document.activeElement;
  const onKeyDown = (e) => {
    if (!e || e.key !== 'Tab') return;
    const focusable = getFocusable(el);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !el.contains(active)) {
        e.preventDefault();
        try { last.focus(); } catch (_) {}
      }
    } else {
      if (active === last || !el.contains(active)) {
        e.preventDefault();
        try { first.focus(); } catch (_) {}
      }
    }
  };
  trapState.set(el, { prevActive, onKeyDown });
  try { el.addEventListener('keydown', onKeyDown, true); } catch (_) {}
  try {
    const focusable = getFocusable(el);
    if (focusable.length) focusable[0].focus();
  } catch (_) {}
}

export function deactivate(el) {
  if (!el || !(el instanceof Element)) return;
  const st = trapState.get(el) || null;
  if (!st) return;
  try { el.removeEventListener('keydown', st.onKeyDown, true); } catch (_) {}
  trapState.delete(el);
  try {
    const prev = st.prevActive;
    if (prev && prev.focus) prev.focus();
  } catch (_) {}
}

export const FocusTrap = { activate, deactivate };
