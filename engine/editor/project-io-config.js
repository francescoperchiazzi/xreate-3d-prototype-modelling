// Builds the explicit dependency contract consumed by persistence/project-io.
// Keeping this object outside the legacy host makes the persistence boundary
// inspectable and prevents it from acquiring hidden compatibility reads.
export function createProjectIoConfig(deps = {}) {
  const {
    CANVAS_SIZE, THREE, projectState, projectStore, autosaveManager,
    getProject, getShapeList, setShapeList, setSelectedId, syncVisibleToSelectedPart,
    uuid, imageBitmapToPngDataUrlForSave, canvasToPngDataUrl, getDefaultUvModeForArchetypeId,
    getUndoLayerImageRef, getUndoCompositeRef, getBaseLayerRevision, sanitizeFilenameBase,
    download, setStatusKey, setStatus, showModal, tr, clearAssembly, updateProjectNameUi,
    resetProjectUndoArm, getEditorBg, createOffscreenCanvas, newPartId, newLayerId,
    createMaterial, getAssemblyRoot, getArchetypeById, createPartFromArchetype,
    buildDoodleRevolveFromPoints, buildDoodleMirrorFromPoints, buildDoodleFromPoints, applyUvModeToGeometry,
    applyMaterialStateToMesh, applyCustomUvToGeometry, resolveUndoAssetAsync,
    loadImageFromDataUrl, drawDataUrlToCanvas, ensureSrgbTexture, setSelectedPart,
    updateShapeTransformControlsFromSelected, renderShapeParamsUI, gcUndoAssets,
    applyUvCheckerToAllShapes, drawBaseLayer, renderUvOverlay, requestApplyTexture,
  } = deps;
  return {
    CANVAS_SIZE, THREE, projectState, projectStore, autosaveManager,
    getProject, getShapeList, setShapeList, setSelectedId, syncVisibleToSelectedPart,
    uuid, imageBitmapToPngDataUrlForSave, canvasToPngDataUrl, getDefaultUvModeForArchetypeId,
    getUndoLayerImageRef, getUndoCompositeRef, getBaseLayerRevision, sanitizeFilenameBase,
    download, setStatusKey, setStatus, showModal, tr, clearAssembly, updateProjectNameUi,
    resetProjectUndoArm, getEditorBg, createOffscreenCanvas, newPartId, newLayerId,
    createMaterial, getAssemblyRoot, getArchetypeById, createPartFromArchetype,
    buildDoodleRevolveFromPoints, buildDoodleMirrorFromPoints, buildDoodleFromPoints, applyUvModeToGeometry,
    applyMaterialStateToMesh, applyCustomUvToGeometry, resolveUndoAssetAsync,
    loadImageFromDataUrl, drawDataUrlToCanvas, ensureSrgbTexture, setSelectedPart,
    updateShapeTransformControlsFromSelected, renderShapeParamsUI, gcUndoAssets,
    applyUvCheckerToAllShapes, drawBaseLayer, renderUvOverlay, requestApplyTexture,
  };
}

export const ProjectIoConfig = { create: createProjectIoConfig };
