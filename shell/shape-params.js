// Responsibility: own dynamic inspector UI for shape/material parameters.
// Reads from: DOM and callbacks passed from the legacy runtime.
// Writes to: shape parameter DOM, selected part params/material, and related UI labels.
// Exposes to: window.XR.__modules.ShellShapeParams

const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const onWithSignal = (opts && typeof opts.onWithSignal === 'function') ? opts.onWithSignal : null;
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const getArchetypeById = (opts && typeof opts.getArchetypeById === 'function') ? opts.getArchetypeById : (() => null);
  const drawIcon = (opts && typeof opts.drawIcon === 'function') ? opts.drawIcon : (XR?.Icons?.drawIcon || XR?.__modules?.Icons?.drawIcon || null);
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((key) => String(key || ''));
  const armProjectUndoSnapshot = (opts && typeof opts.armProjectUndoSnapshot === 'function') ? opts.armProjectUndoSnapshot : (() => {});
  const applyMaterialStateToMesh = (opts && typeof opts.applyMaterialStateToMesh === 'function') ? opts.applyMaterialStateToMesh : (() => {});
  const buildDoodleRevolveFromPoints = (opts && typeof opts.buildDoodleRevolveFromPoints === 'function') ? opts.buildDoodleRevolveFromPoints : null;
  const buildDoodleMirrorFromPoints = (opts && typeof opts.buildDoodleMirrorFromPoints === 'function') ? opts.buildDoodleMirrorFromPoints : null;
  const buildDoodleFromPoints = (opts && typeof opts.buildDoodleFromPoints === 'function') ? opts.buildDoodleFromPoints : null;
  const applyUvModeToGeometry = (opts && typeof opts.applyUvModeToGeometry === 'function') ? opts.applyUvModeToGeometry : null;
  const updateInfoForMesh = (opts && typeof opts.updateInfoForMesh === 'function') ? opts.updateInfoForMesh : (() => {});
  const renderUvOverlay = (opts && typeof opts.renderUvOverlay === 'function') ? opts.renderUvOverlay : (() => {});
  const requestApplyTexture = (opts && typeof opts.requestApplyTexture === 'function') ? opts.requestApplyTexture : (() => {});
  const markViewportDirty = (opts && typeof opts.markViewportDirty === 'function') ? opts.markViewportDirty : (() => {});
  const getDefaultParamsForArchetypeId = (opts && typeof opts.getDefaultParamsForArchetypeId === 'function') ? opts.getDefaultParamsForArchetypeId : (() => null);
  const getArchetypeCategoryById = (opts && typeof opts.getArchetypeCategoryById === 'function') ? opts.getArchetypeCategoryById : (() => null);
  const getShapeScaleFactors = (opts && typeof opts.getShapeScaleFactors === 'function') ? opts.getShapeScaleFactors : (() => ({ x: 1, y: 1, z: 1 }));
  const applyTransformToMesh = (opts && typeof opts.applyTransformToMesh === 'function') ? opts.applyTransformToMesh : (() => {});
  const rebuildSelectedPartGeometry = (opts && typeof opts.rebuildSelectedPartGeometry === 'function') ? opts.rebuildSelectedPartGeometry : (() => {});
  const markProjectModified = (opts && typeof opts.markProjectModified === 'function') ? opts.markProjectModified : (() => {});

  let renderAbortController = null;

  function bindAbortable(signal, target, ev, fn, opts2) {
    if (!target) return;
    if (onWithSignal) {
      onWithSignal(signal, target, ev, fn, opts2);
      return;
    }
    target.addEventListener(ev, fn, opts2);
  }

  function installUndoArming(input, on, handler) {
    if (input && input.dataset) input.dataset.undoArmed = '0';
    on(input, 'focus', () => {
      if (input && input.dataset) input.dataset.undoArmed = '0';
    });
    on(input, 'blur', () => {
      if (input && input.dataset) input.dataset.undoArmed = '0';
    });
    on(input, 'input', handler);
  }

  function appendOpenEndedToggle(wrap, part, p, on) {
    const row = document.createElement('div');
    row.className = 'xr-ctl-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xr-ctl-btn' + (p.openEnded ? ' is-active' : '');
    btn.textContent = p.openEnded ? tr('param_open_ended_on') : tr('param_open_ended_off');
    on(btn, 'click', () => {
      p.openEnded = !p.openEnded;
      btn.classList.toggle('is-active', !!p.openEnded);
      btn.textContent = p.openEnded ? tr('param_open_ended_on') : tr('param_open_ended_off');
      rebuildSelectedPartGeometry();
    });
    row.appendChild(btn);
    wrap.appendChild(row);
  }

  function render() {
    const typeEl = document.getElementById('shapeTypeVal');
    const iconCv = document.getElementById('inspectorTypeIcon');
    const wrap = document.getElementById('shapeParams');
    if (!wrap) return;
    try { renderAbortController?.abort?.(); } catch (_) {}
    renderAbortController = new AbortController();
    const sig = renderAbortController.signal;
    const on = (el, ev, fn, opts2) => bindAbortable(sig, el, ev, fn, opts2);

    const part = getSelectedPart();
    if (!part) {
      if (typeEl) typeEl.textContent = '—';
      if (iconCv) {
        try {
          const ctx = iconCv.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, iconCv.width || 0, iconCv.height || 0);
        } catch (_) {}
      }
      wrap.innerHTML = '';
      return;
    }

    const arch = getArchetypeById(part.type);
    if (typeEl) typeEl.textContent = arch ? arch.label : (part.type || '—');
    if (iconCv) {
      try {
        const ctx = iconCv.getContext('2d');
        if (ctx) drawIcon && drawIcon(ctx, (arch && arch.icon) ? arch.icon : 'cube', 24, { bg: null, fg: '#e8e2d6' });
      } catch (_) {}
    }
    wrap.innerHTML = '';

    if (!part.material) part.material = { baseColor: '#ffffff', roughness: 0.6, metalness: 0.0, emissive: 0.0, emissiveColor: '#e8c88e' };
    if (!part.material.baseColor) part.material.baseColor = '#ffffff';

    const describeColor = (hex) => {
      const h = String(hex || '#000000').trim().toUpperCase();
      const map = {
        '#FFFFFF': 'White',
        '#000000': 'Black',
        '#FF0000': 'Red',
        '#00FF00': 'Green',
        '#0000FF': 'Blue',
        '#808080': 'Gray',
        '#C0C0C0': 'Silver',
      };
      const name = map[h] || null;
      return name ? `${name}, ${h}` : h;
    };

    const colorRow = document.createElement('div');
    colorRow.className = 'xr-field-row xr-field-row--material-color';
    const colorLabel = document.createElement('span');
    colorLabel.className = 'xr-field-label';
    colorLabel.textContent = 'Color';
    const colorValue = document.createElement('span');
    colorValue.className = 'xr-field-value';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'xr-color-input';
    colorInput.setAttribute('aria-label', tr('aria_volume_color'));
    try { colorInput.value = String(part.material.baseColor || '#ffffff'); } catch (_) { colorInput.value = '#ffffff'; }
    try { colorInput.setAttribute('aria-valuetext', describeColor(colorInput.value)); } catch (_) {}
    installUndoArming(colorInput, on, () => {
      if (colorInput.dataset && colorInput.dataset.undoArmed !== '1') {
        armProjectUndoSnapshot();
        colorInput.dataset.undoArmed = '1';
      }
      part.material.baseColor = colorInput.value;
      try { colorInput.setAttribute('aria-valuetext', describeColor(colorInput.value)); } catch (_) {}
      applyMaterialStateToMesh(part);
      markProjectModified();
    });
    colorValue.appendChild(colorInput);
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorValue);
    wrap.appendChild(colorRow);

    if (part.type === 'doodle') {
      if (!part.params) part.params = {};
      const mode = part.doodleMode === 'revolve'
        ? 'revolve'
        : (part.doodleMode === 'mirror' ? 'mirror' : 'polygon');
      const d0 = (part.params && Number.isFinite(part.params.depth)) ? part.params.depth : 0.5;
      const s0 = (part.params && Number.isFinite(part.params.segments)) ? part.params.segments : 64;
      const row = document.createElement('div');
      row.className = 'xr-field-row';
      const l = document.createElement('span');
      l.className = 'xr-field-label';
      l.textContent = (mode === 'revolve') ? 'Segments' : 'Depth (u)';
      const v = document.createElement('span');
      v.className = 'xr-field-value';
      const valInput = document.createElement('input');
      valInput.type = 'number';
      valInput.className = 'xr-inline-number-input';
      if (mode === 'revolve') {
        valInput.min = '12';
        valInput.max = '128';
        valInput.step = '1';
        valInput.value = String(Math.round(s0));
      } else {
        valInput.min = '0.05';
        valInput.max = '3.00';
        valInput.step = '0.01';
        valInput.value = d0.toFixed(2);
      }
      v.appendChild(valInput);
      row.appendChild(l);
      row.appendChild(v);

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'xr-field-slider';
      if (mode === 'revolve') {
        input.min = '12';
        input.max = '128';
        input.step = '1';
        input.value = String(Math.round(s0));
      } else {
        input.min = '5';
        input.max = '300';
        input.step = '1';
        input.value = String(Math.round(d0 * 100));
      }

      if (input && input.dataset) input.dataset.undoArmed = '0';
      on(input, 'focus', () => { if (input.dataset) input.dataset.undoArmed = '0'; });
      on(input, 'blur', () => { if (input.dataset) input.dataset.undoArmed = '0'; });
      if (valInput && valInput.dataset) valInput.dataset.undoArmed = '0';
      on(valInput, 'focus', () => { if (valInput.dataset) valInput.dataset.undoArmed = '0'; });
      on(valInput, 'blur', () => { if (valInput.dataset) valInput.dataset.undoArmed = '0'; });

      const rebuildDoodleGeo = () => {
        if (mode === 'revolve') {
          if (!part._mesh || !Array.isArray(part.doodlePoints) || part.doodlePoints.length < 2) return;
        } else if (!part._mesh || !Array.isArray(part.doodlePoints) || part.doodlePoints.length < 3) {
          return;
        }
        const geo0 = (mode === 'revolve')
          ? (buildDoodleRevolveFromPoints ? buildDoodleRevolveFromPoints(part.doodlePoints, part.params) : null)
          : (mode === 'mirror'
            ? (buildDoodleMirrorFromPoints ? buildDoodleMirrorFromPoints(part.doodlePoints, part.params) : null)
            : (buildDoodleFromPoints ? buildDoodleFromPoints(part.doodlePoints, part.params) : null));
        if (!geo0) return;
        const nextGeo = applyUvModeToGeometry ? (applyUvModeToGeometry(geo0, part.uvMode) || geo0) : geo0;
        if (nextGeo !== geo0) {
          try { geo0.dispose(); } catch (_) {}
        }
        if (part._mesh.geometry) part._mesh.geometry.dispose();
        part._mesh.geometry = nextGeo;
        try { part._mesh.geometry.computeVertexNormals(); } catch (_) {}
        // Keep the mirrored-Doodle wireframe overlay in sync with geometry
        // rebuilt by the depth control.
        applyMaterialStateToMesh(part);
        updateInfoForMesh(part._mesh);
        renderUvOverlay();
        markViewportDirty(30);
        requestApplyTexture(true);
        markProjectModified();
      };

      on(input, 'input', () => {
        if (input.dataset && input.dataset.undoArmed !== '1') {
          armProjectUndoSnapshot();
          input.dataset.undoArmed = '1';
        }
        if (mode === 'revolve') {
          const s = Math.max(12, Math.min(128, Math.round(input.valueAsNumber)));
          part.params.segments = s;
          valInput.value = String(s);
        } else {
          const d = input.valueAsNumber / 100;
          part.params.depth = d;
          valInput.value = d.toFixed(2);
        }
        rebuildDoodleGeo();
      });

      on(valInput, 'change', () => {
        if (valInput.dataset && valInput.dataset.undoArmed !== '1') {
          armProjectUndoSnapshot();
          valInput.dataset.undoArmed = '1';
        }
        if (mode === 'revolve') {
          const s = Math.max(12, Math.min(128, Math.round(valInput.valueAsNumber)));
          part.params.segments = s;
          input.value = String(s);
          valInput.value = String(s);
        } else {
          const d = Math.max(0.05, Math.min(3.0, valInput.valueAsNumber));
          part.params.depth = d;
          input.value = String(Math.round(d * 100));
          valInput.value = d.toFixed(2);
        }
        rebuildDoodleGeo();
      });

      wrap.appendChild(row);
      wrap.appendChild(input);
      return;
    }

    const defaults = getDefaultParamsForArchetypeId(part.type);
    const cat = getArchetypeCategoryById(part.type);
    if (!defaults) {
      if (cat === 'Containers' || cat === 'Solids' || cat === 'Furniture') {
        if (!part.shapeScale) part.shapeScale = { x: 1, y: 1, z: 1 };
        const makeScaleSlider = (label, getV, setV) => {
          const row = document.createElement('div');
          row.className = 'xr-field-row';
          const l = document.createElement('span');
          l.className = 'xr-field-label';
          l.textContent = label;
          const v = document.createElement('span');
          v.className = 'xr-field-value';
          v.textContent = getV().toFixed(2);
          row.appendChild(l);
          row.appendChild(v);

          const input = document.createElement('input');
          input.type = 'range';
          input.className = 'xr-field-slider';
          input.min = '0.30';
          input.max = '3.00';
          input.step = '0.05';
          input.value = String(getV());
          on(input, 'input', () => {
            const next = Math.max(0.3, Math.min(3.0, parseFloat(input.value)));
            setV(next);
            v.textContent = next.toFixed(2);
            applyTransformToMesh(part);
            markProjectModified();
          });

          wrap.appendChild(row);
          wrap.appendChild(input);
        };

        makeScaleSlider(tr('param_scale_x'), () => getShapeScaleFactors(part).x, (x) => {
          const cur = getShapeScaleFactors(part);
          part.shapeScale = { x, y: cur.y, z: x };
        });
        makeScaleSlider(tr('param_scale_y'), () => getShapeScaleFactors(part).y, (y) => {
          const cur = getShapeScaleFactors(part);
          part.shapeScale = { x: cur.x, y, z: cur.z };
        });
      }
      return;
    }

    if (!part.params) part.params = { ...defaults };
    const p = part.params;

    const addSlider = (key, label, min, max, step, format, isInt) => {
      const row = document.createElement('div');
      row.className = 'xr-field-row';
      const l = document.createElement('span');
      l.className = 'xr-field-label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'xr-field-value';
      const raw = (typeof p[key] === 'number') ? p[key] : defaults[key];
      v.textContent = format ? format(raw) : String(raw);
      row.appendChild(l);
      row.appendChild(v);

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'xr-field-slider';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.setAttribute('aria-valuemin', String(min));
      input.setAttribute('aria-valuemax', String(max));
      input.value = String(raw);
      on(input, 'input', () => {
        let next = parseFloat(input.value);
        if (isInt) next = Math.round(next);
        p[key] = next;
        v.textContent = format ? format(next) : String(next);
        rebuildSelectedPartGeometry();
      });

      wrap.appendChild(row);
      wrap.appendChild(input);
    };

    if (part.type === 'box') {
      addSlider('width', 'Width', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('depth', 'Depth', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('taperTop', 'Taper top', 0.1, 2.0, 0.05, (x) => x.toFixed(2));
      addSlider('taperBottom', 'Taper bottom', 0.1, 2.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 1, 16, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'cube') {
      addSlider('size', 'Size', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 1, 16, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'sphere' || part.type === 'dome' || part.type === 'hemi_open') {
      addSlider('radius', 'Radius', 0.01, 10.0, 0.01, (x) => x.toFixed(2));
      addSlider('widthSegments', 'W seg', 3, 128, 1, (x) => String(x | 0), true);
      addSlider('heightSegments', 'H seg', 2, 64, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'cylinder') {
      addSlider('radiusTop', 'R top', 0.0, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('radiusBottom', 'R bottom', 0.05, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 3, 128, 1, (x) => String(x | 0), true);
      appendOpenEndedToggle(wrap, part, p, on);
      return;
    }
    if (part.type === 'rod') {
      addSlider('radius', 'Radius', 0.02, 1.0, 0.01, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 6.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 3, 128, 1, (x) => String(x | 0), true);
      addSlider('heightSegments', 'H seg', 1, 32, 1, (x) => String(x | 0), true);
      appendOpenEndedToggle(wrap, part, p, on);
      return;
    }
    if (part.type === 'cone') {
      addSlider('radius', 'Radius', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 3, 128, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'tri_prism') {
      addSlider('radius', 'Radius', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('heightSegments', 'H seg', 1, 16, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'frustum') {
      addSlider('radiusTop', 'R top', 0.0, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('radiusBottom', 'R bottom', 0.05, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 3, 128, 1, (x) => String(x | 0), true);
      addSlider('heightSegments', 'H seg', 1, 32, 1, (x) => String(x | 0), true);
      appendOpenEndedToggle(wrap, part, p, on);
      return;
    }
    if (part.type === 'pyr_frustum') {
      addSlider('radiusTop', 'Top', 0.0, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('radiusBottom', 'Bottom', 0.05, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('heightSegments', 'H seg', 1, 32, 1, (x) => String(x | 0), true);
      appendOpenEndedToggle(wrap, part, p, on);
      return;
    }
    if (part.type === 'wedge') {
      addSlider('width', 'Width', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('depth', 'Depth', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('tip', 'Tip', 0.0, 0.8, 0.02, (x) => x.toFixed(2));
      return;
    }
    if (part.type === 'arc_cyl') {
      addSlider('tubeRadius', 'Tube', 0.05, 1.0, 0.05, (x) => x.toFixed(2));
      addSlider('bendRadius', 'Bend R', 0.2, 4.0, 0.05, (x) => x.toFixed(2));
      addSlider('arcDegrees', 'Arc deg', 15, 360, 5, (x) => String(x | 0), true);
      addSlider('radialSegments', 'Rad seg', 4, 64, 2, (x) => String(x | 0), true);
      addSlider('tubularSegments', 'Tub seg', 8, 256, 8, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'rod_arc_15' || part.type === 'rod_arc_30' || part.type === 'rod_arc_45') {
      addSlider('tubeRadius', 'Tube', 0.02, 1.0, 0.01, (x) => x.toFixed(2));
      addSlider('bendRadius', 'Bend R', 0.2, 4.0, 0.05, (x) => x.toFixed(2));
      addSlider('radialSegments', 'Rad seg', 4, 64, 2, (x) => String(x | 0), true);
      addSlider('tubularSegments', 'Tub seg', 8, 256, 8, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'curved_box') {
      addSlider('width', 'Width', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('bendRadius', 'Bend R', 0.2, 4.0, 0.05, (x) => x.toFixed(2));
      addSlider('arcDegrees', 'Arc deg', 15, 360, 5, (x) => String(x | 0), true);
      addSlider('steps', 'Steps', 6, 256, 2, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'ellipsoid') {
      addSlider('radiusX', 'R x', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('radiusY', 'R y', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('radiusZ', 'R z', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('widthSegments', 'W seg', 8, 128, 8, (x) => String(x | 0), true);
      addSlider('heightSegments', 'H seg', 4, 64, 4, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'hex_prism') {
      addSlider('radius', 'Radius', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('heightSegments', 'H seg', 1, 32, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'torus') {
      addSlider('radius', 'Radius', 0.2, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('tube', 'Tube', 0.05, 1.0, 0.05, (x) => x.toFixed(2));
      addSlider('radialSegments', 'Rad seg', 4, 64, 2, (x) => String(x | 0), true);
      addSlider('tubularSegments', 'Tub seg', 8, 256, 8, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'plane') {
      addSlider('width', 'Width', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('height', 'Height', 0.1, 5.0, 0.05, (x) => x.toFixed(2));
      addSlider('segments', 'Segments', 1, 64, 1, (x) => String(x | 0), true);
      return;
    }
    if (part.type === 'capsule') {
      addSlider('radius', 'Radius', 0.1, 2.0, 0.05, (x) => x.toFixed(2));
      addSlider('halfHeight', 'Half-height', 0.1, 3.0, 0.05, (x) => x.toFixed(2));
      addSlider('arcSegments', 'Arc seg', 4, 32, 2, (x) => String(x | 0), true);
      addSlider('latheSegments', 'Lathe seg', 8, 128, 8, (x) => String(x | 0), true);
    }
  }

  function updateMaterialControlsFromSelected() {
    render();
  }

  return {
    render,
    updateMaterialControlsFromSelected,
  };
}

XR.__modules.ShellShapeParams = XR.__modules.ShellShapeParams || {};
XR.__modules.ShellShapeParams.create = create;
