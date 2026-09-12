const exportRuntimeState = {
  inProgress: false,
};

function getProjectExportMeta(getProject) {
  const project = (typeof getProject === 'function') ? getProject() : null;
  const baseName = ((project && project.name) ? project.name : 'Untitled').trim() || 'Untitled';
  const safe = baseName.replace(/[^a-z0-9_\-]+/gi, '_');
  return { project, baseName, safe };
}

export function createBinaryExportAction(opts) {
  const getShapeList = opts?.getShapeList || (() => []);
  const tr = opts?.tr || ((key) => String(key || ''));
  const showToast = opts?.showToast || (() => {});
  const onCheckerWarning = opts?.onCheckerWarning || (() => {});
  const getAssemblyRoot = opts?.getAssemblyRoot || (() => null);
  const syncVisibleToSelectedPart = opts?.syncVisibleToSelectedPart || (() => {});
  const applyTexture = opts?.applyTexture || (() => {});
  const buildPayload = opts?.buildPayload || (() => null);
  const getProject = opts?.getProject || (() => null);
  const download = opts?.download || (() => {});
  const showModal = opts?.showModal || (() => {});
  const extension = String(opts?.extension || 'bin');
  const mimeType = String(opts?.mimeType || 'application/octet-stream');
  const successTitleKey = String(opts?.successTitleKey || '');
  const successMessageKey = String(opts?.successMessageKey || '');

  return function runBinaryExport() {
    if (exportRuntimeState.inProgress) return;
    let shapes = null;
    try {
      shapes = getShapeList();
    } catch (e) {
      exportRuntimeState.inProgress = false;
      showToast(tr('status_export_error_prefix') + (e && e.message ? e.message : String(e)), 'error');
      console.error(e);
      return;
    }
    if (!shapes.length) {
      try { showToast(tr('status_no_mesh_to_export'), 'warning'); } catch (err) { console.warn('[export] unable to display empty-scene warning', err); }
      return;
    }
    try {
      onCheckerWarning();
    } catch (err) { console.warn('[export] checker warning hook failed', err); }

    exportRuntimeState.inProgress = true;
    const assemblyRoot = getAssemblyRoot();
    const rotSnap = assemblyRoot ? assemblyRoot.rotation.y : 0;

    setTimeout(() => {
      const restore = () => {
        if (assemblyRoot) {
          assemblyRoot.rotation.y = rotSnap;
          assemblyRoot.updateMatrixWorld(true);
        }
        exportRuntimeState.inProgress = false;
      };
      try {
        syncVisibleToSelectedPart();
        applyTexture(true);
        if (assemblyRoot) {
          assemblyRoot.rotation.y = rotSnap;
          assemblyRoot.updateMatrixWorld(true);
        }
        const payload = buildPayload();
        // A project ID/timestamp is useful in storage, but is noise in a file
        // a person will send to a teammate. Browsers already add “(1)” when a
        // duplicate download exists, so keep user-facing exports human-named.
        const { safe } = getProjectExportMeta(getProject);
        download(payload, `${safe}.${extension}`, mimeType);
        showModal(tr(successTitleKey), tr(successMessageKey));
        showToast(tr('toast_export_ready'), 'success');
      } catch (e) {
        showToast(tr('status_export_error_prefix') + e.message, 'error');
        console.error(e);
      } finally {
        restore();
      }
    }, 80);
  };
}

export function createTextureAtlasExportAction(opts) {
  const getShapeList = opts?.getShapeList || (() => []);
  const getProject = opts?.getProject || (() => null);
  const updateComposite = opts?.updateComposite || (() => {});
  const getCompositeCanvas = opts?.getCompositeCanvas || (() => null);
  const packTexturesToAtlas = opts?.packTexturesToAtlas || (() => ({ atlas: null, placements: [] }));
  const download = opts?.download || (() => {});
  const showToast = opts?.showToast || (() => {});

  return function runTextureAtlasExport() {
    const shapes = getShapeList();
    if (!shapes.length) {
      showToast('No shapes to export', 'warning');
      return;
    }

    const project = getProject();
    const items = [];
    if (project && project.textureMode === 'shared') {
      updateComposite();
      items.push({ canvas: getCompositeCanvas(), id: 'shared' });
    } else {
      for (const part of shapes) {
        if (part && part._compositeCanvas) {
          items.push({ canvas: part._compositeCanvas, id: part.id || part.name });
        }
      }
      if (!items.length) {
        updateComposite();
        items.push({ canvas: getCompositeCanvas(), id: 'composite' });
      }
    }

    if (!items.length) {
      showToast('No textures to pack', 'warning');
      return;
    }

    const { safe } = getProjectExportMeta(getProject);
    const { atlas, placements } = packTexturesToAtlas(items, 2048);
    if (!atlas || typeof atlas.toBlob !== 'function') {
      throw new Error('Texture atlas not available');
    }

    atlas.toBlob((blob) => {
      if (!blob) {
        showToast('Atlas export failed', 'error');
        return;
      }
      download(blob, `${safe}_texture_atlas.png`, 'image/png');
    }, 'image/png');

    const placementBlob = new Blob([JSON.stringify(placements, null, 2)], { type: 'application/json' });
    download(placementBlob, `${safe}_atlas_placements.json`, 'application/json');
    showToast('Atlas exported successfully!', 'success');
  };
}
