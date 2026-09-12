// Project-level UI policy, intentionally independent from Three.js. The shell
// can later consume this controller directly instead of receiving callbacks
// from the legacy editor host.
export function create(opts = {}) {
  const getProject = typeof opts.getProject === 'function' ? opts.getProject : (() => null);
  const tr = typeof opts.tr === 'function' ? opts.tr : ((key) => String(key || ''));
  const setMobilePreviewMode = typeof opts.setMobilePreviewMode === 'function' ? opts.setMobilePreviewMode : (() => {});

  function updateProjectNameUi() {
    const button = document.getElementById('projectNameBtn');
    if (!button) return false;
    const name = String(getProject()?.name || '').trim();
    button.textContent = name || 'Untitled';
    return true;
  }

  function updateMobilePreviewAvailability(totalShapes) {
    // Device Preview was removed: a screen-sized frame is neither an export
    // preview nor an editor tool. Clear a restored legacy state defensively.
    setMobilePreviewMode(false);
    return false;
  }

  function updateExportAvailability(totalShapes) {
    const available = (Number(totalShapes) | 0) > 0;
    const trigger = document.getElementById('btn-export-trigger');
    const dropdown = document.getElementById('xr-export-dropdown');
    for (const id of ['btn-export-glb', 'btn-export-usdz', 'btn-export-atlas']) {
      const button = document.getElementById(id);
      if (button) button.disabled = !available;
    }
    if (trigger) {
      trigger.disabled = !available;
      trigger.setAttribute('aria-disabled', available ? 'false' : 'true');
      trigger.title = available ? 'Export as GLB or USDZ' : tr('export_disabled_hint');
      if (!available) trigger.setAttribute('aria-expanded', 'false');
    }
    if (!available && dropdown) dropdown.hidden = true;
    return available;
  }

  return { updateProjectNameUi, updateMobilePreviewAvailability, updateExportAvailability };
}
