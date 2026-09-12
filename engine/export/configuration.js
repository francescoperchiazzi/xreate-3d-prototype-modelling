// Builds exporter contracts without owning globals, UI, or renderer state.
// The host injects live scene accessors; GLB/USDZ share exactly one payload
// builder resolution path, preventing a legacy writer fallback from drifting.
export function createExportConfigurations(ctx = {}) {
  const getPayloadBuilders = (typeof ctx.getPayloadBuilders === 'function')
    ? ctx.getPayloadBuilders
    : (() => null);
  const payloadContext = () => ({
    getShapeList: ctx.getShapeList,
    getProject: ctx.getProject,
    getAssemblyRoot: ctx.getAssemblyRoot,
    updateComposite: ctx.updateComposite,
    getCompositeCanvas: ctx.getCompositeCanvas,
    partHasAnyVisibleLayerImage: ctx.partHasAnyVisibleLayerImage,
    THREE: ctx.THREE,
  });
  const build = (method) => {
    const builders = getPayloadBuilders();
    if (typeof builders?.[method] !== 'function') {
      throw new Error(`ExportPayloadBuilders.${method} unavailable after engine bootstrap`);
    }
    return builders[method](payloadContext());
  };
  const binaryCommon = {
    getShapeList: ctx.getShapeList,
    THREE: ctx.THREE,
    tr: ctx.tr,
    showToast: ctx.showToast,
    onCheckerWarning: ctx.onCheckerWarning,
    getAssemblyRoot: ctx.getAssemblyRoot,
    syncVisibleToSelectedPart: ctx.syncVisibleToSelectedPart,
    applyTexture: ctx.applyTexture,
    getProject: ctx.getProject,
    download: ctx.download,
    showModal: ctx.showModal,
  };
  return {
    glb: { ...binaryCommon, buildPayload: () => build('buildGLB') },
    usdz: { ...binaryCommon, buildPayload: () => build('buildUSDZ') },
    atlas: {
      getShapeList: ctx.getShapeList,
      THREE: ctx.THREE,
      getProject: ctx.getProject,
      updateComposite: ctx.updateComposite,
      getCompositeCanvas: ctx.getCompositeCanvas,
      packTexturesToAtlas: ctx.packTexturesToAtlas,
      download: ctx.download,
      showToast: ctx.showToast,
    },
  };
}
