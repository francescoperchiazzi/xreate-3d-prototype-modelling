const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const bgColors = Array.isArray(opts?.bgColors) ? opts.bgColors : [];
  const getProject = (opts && typeof opts.getProject === 'function') ? opts.getProject : (() => null);
  const armProjectUndoSnapshot = (opts && typeof opts.armProjectUndoSnapshot === 'function') ? opts.armProjectUndoSnapshot : (() => {});
  const setProjectName = (opts && typeof opts.setProjectName === 'function') ? opts.setProjectName : (() => {});
  const updateProjectNameUi = (opts && typeof opts.updateProjectNameUi === 'function') ? opts.updateProjectNameUi : (() => {});
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((k) => String(k || ''));
  const setSceneBackground = (opts && typeof opts.setSceneBackground === 'function') ? opts.setSceneBackground : (() => {});

  function buildBackgroundRow() {
    const row = document.getElementById('bgRow');
    if (!row) return;
    row.innerHTML = '';
    bgColors.forEach((c, i) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'xr-bg-swatch' + (i === 0 ? ' is-active' : '');
      sw.style.background = c;
      sw.style.border = c === '#e8e2d6' ? '1px solid #3a3630' : 'none';
      sw.setAttribute('aria-label', `Background ${c}`);
      sw.setAttribute('aria-pressed', String(i === 0));
      sw.addEventListener('click', () => {
        document.querySelectorAll('.xr-bg-swatch').forEach((el) => el.setAttribute('aria-pressed', 'false'));
        sw.setAttribute('aria-pressed', 'true');
        try { setSceneBackground(c); } catch (_) {}
        document.querySelectorAll('.xr-bg-swatch').forEach((el) => el.classList.remove('is-active'));
        sw.classList.add('is-active');
      });
      row.appendChild(sw);
    });
  }

  function bindProjectNameEditor() {
    const projectNameBtn = document.getElementById('projectNameBtn');
    if (!projectNameBtn || projectNameBtn.dataset.boundProjectUi === '1') return;
    projectNameBtn.dataset.boundProjectUi = '1';

    const beginEditProjectName = () => {
      const currentProject = getProject();
      const cur = (currentProject && typeof currentProject.name === 'string') ? currentProject.name.trim() : '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'xr-project-name-input';
      input.value = cur || 'Untitled';
      input.setAttribute('aria-label', tr('aria_project_name'));
      input.setAttribute('aria-describedby', 'projectNameHint');
      const parent = projectNameBtn.parentElement;
      if (!parent) return;
      parent.replaceChild(input, projectNameBtn);
      input.focus();
      input.select();
      let finished = false;
      const finish = (save) => {
        // Enter replaces the input and synchronously triggers blur in some
        // browsers. Handle either event once so the second callback cannot
        // attempt to replace a node that is no longer a child of parent.
        if (finished) return;
        finished = true;
        if (save) {
          const next = String(input.value || '').trim() || 'Untitled';
          const liveProject = getProject();
          const prevName = String(liveProject?.name || '').trim();
          if (next !== prevName) armProjectUndoSnapshot();
          try { setProjectName(next); } catch (_) {}
        }
        parent.replaceChild(projectNameBtn, input);
        updateProjectNameUi();
        try { projectNameBtn.focus(); } catch (_) {}
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    };

    projectNameBtn.addEventListener('click', beginEditProjectName);
    projectNameBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        beginEditProjectName();
      }
    });
  }

  return {
    buildBackgroundRow,
    bindProjectNameEditor,
  };
}

XR.__modules.ShellProjectUi = XR.__modules.ShellProjectUi || {};
XR.__modules.ShellProjectUi.create = create;
