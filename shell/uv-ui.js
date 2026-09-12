const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((k) => String(k || ''));
  const getShapeList = (opts && typeof opts.getShapeList === 'function') ? opts.getShapeList : (() => []);
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const getUvMode = (opts && typeof opts.getUvMode === 'function') ? opts.getUvMode : (() => 'sphere');
  const getUvStretchOn = (opts && typeof opts.getUvStretchOn === 'function') ? opts.getUvStretchOn : (() => false);
  const updateComposite = (opts && typeof opts.updateComposite === 'function') ? opts.updateComposite : (() => {});
  const getCompositeCanvas = (opts && typeof opts.getCompositeCanvas === 'function') ? opts.getCompositeCanvas : (() => null);
  const getCanvasSize = (opts && typeof opts.getCanvasSize === 'function') ? opts.getCanvasSize : (() => 1024);
  const getUvLayout = (opts && typeof opts.getUvLayout === 'function') ? opts.getUvLayout : (() => null);
  const getPrimaryIsland = (opts && typeof opts.getPrimaryIsland === 'function') ? opts.getPrimaryIsland : (() => null);

  function updateUvModeHint() {
    const el = document.getElementById('uvHint');
    if (!el) return;
    const shapes = getShapeList();
    if (!shapes || !shapes.length) {
      el.setAttribute('data-i18n', 'uv_hint_empty_scene');
      el.textContent = tr('uv_hint_empty_scene');
      return;
    }
    if (!getSelectedPart()) {
      el.setAttribute('data-i18n', 'uv_hint_no_selection');
      el.textContent = tr('uv_hint_no_selection');
      return;
    }
    const uvMode = getUvMode();
    const key = (uvMode === 'sphere') ? 'uv_hint_sphere'
      : (uvMode === 'box') ? 'uv_hint_box'
      : (uvMode === 'cylindrical') ? 'uv_hint_cylindrical'
      : (uvMode === 'planar') ? 'uv_hint_planar'
      : 'uv_hint_sphere';
    el.setAttribute('data-i18n', key);
    el.textContent = tr(key);
  }

  function updateUVPreview() {
    const canvas = document.getElementById('uvPreview');
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    const previewSize = 130;
    const canvasSize = getCanvasSize();
    const uvLayout = getUvLayout();
    const uvMode = getUvMode();
    c.clearRect(0, 0, previewSize, previewSize);

    updateComposite();
    const compositeCanvas = getCompositeCanvas();
    if (compositeCanvas) c.drawImage(compositeCanvas, 0, 0, previewSize, previewSize);

    if (!uvLayout || !canvasSize) {
      c.strokeStyle = 'rgba(200,170,110,0.85)';
      c.lineWidth = 1.5;
      c.strokeRect(1, 1, previewSize - 2, previewSize - 2);
      return;
    }

    const px = (u) => u * previewSize;
    const py = (v) => v * previewSize;

    c.save();
    c.strokeStyle = 'rgba(40, 35, 28, 0.45)';
    c.lineWidth = 1;
    c.setLineDash([2, 3]);

    if (uvMode === 'sphere') {
      for (let i = 1; i <= 4; i += 1) {
        c.beginPath();
        c.ellipse(previewSize / 2, previewSize / 2, previewSize / 2, (20 * i) / 4, 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (let i = 0; i < 8; i += 1) {
        const x = (previewSize / 2) + (previewSize / 2) * Math.cos(i * Math.PI / 4);
        c.beginPath();
        c.moveTo(previewSize / 2, 0);
        c.lineTo(x, previewSize / 2);
        c.lineTo(previewSize / 2, previewSize);
        c.stroke();
      }
    } else if (uvMode === 'box') {
      const face = uvLayout.box.face / canvasSize;
      const v0 = uvLayout.box.originY / canvasSize;
      const rects = [
        { u0: 1 * face, v0: v0 + 0 * face, uw: face, vh: face },
        { u0: 0 * face, v0: v0 + 1 * face, uw: face, vh: face },
        { u0: 1 * face, v0: v0 + 1 * face, uw: face, vh: face },
        { u0: 2 * face, v0: v0 + 1 * face, uw: face, vh: face },
        { u0: 3 * face, v0: v0 + 1 * face, uw: face, vh: face },
        { u0: 1 * face, v0: v0 + 2 * face, uw: face, vh: face },
      ];
      for (const rect of rects) {
        c.strokeRect(px(rect.u0), py(rect.v0), px(rect.uw), py(rect.vh));
      }
    } else if (uvMode === 'cylindrical') {
      const cy = uvLayout.cylinder.norm;
      c.strokeRect(px(cy.wrapX), py(cy.wrapY), px(cy.wrapW), py(cy.wrapH));
      c.beginPath();
      c.arc(px(0.5), py(cy.capTopV), px(cy.capR), 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(px(0.5), py(cy.capBottomV), px(cy.capR), 0, Math.PI * 2);
      c.stroke();
    } else if (uvMode === 'planar') {
      const pad = uvLayout.planar.pad / canvasSize;
      c.strokeRect(px(pad), py(pad), px(1 - pad * 2), py(1 - pad * 2));
    }

    c.restore();

    try {
      const isl = getPrimaryIsland(uvMode);
      if (isl && isl.type === 'rect') {
        const ox = (isl.x / canvasSize) * previewSize + 6;
        const oy = (isl.y / canvasSize) * previewSize + 10;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = 'rgba(40, 35, 28, 0.8)';
        c.font = '700 10px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText('(0,0)', ox, oy);
        c.strokeStyle = 'rgba(40, 35, 28, 0.8)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(ox, oy + 3);
        c.lineTo(ox + 16, oy + 3);
        c.stroke();
        c.beginPath();
        c.moveTo(ox, oy + 3);
        c.lineTo(ox, oy + 18);
        c.stroke();
        c.restore();
      }
    } catch (_) {}

    c.strokeStyle = 'rgba(200,170,110,0.85)';
    c.lineWidth = 1.5;
    c.strokeRect(1, 1, previewSize - 2, previewSize - 2);
  }

  return {
    updateUVPreview,
    updateUvModeHint,
  };
}

XR.__modules.ShellUvUi = XR.__modules.ShellUvUi || {};
XR.__modules.ShellUvUi.create = create;
