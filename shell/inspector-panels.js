// Responsibility: own shell-side inspector panel visibility and transform control sync.
// Reads from: DOM and callbacks passed from the legacy runtime.
// Writes to: inspector/surface panel DOM and slider/value labels.
// Exposes to: window.XR.__modules.ShellInspectorPanels

const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function create(opts) {
  const tr = (opts && typeof opts.tr === 'function') ? opts.tr : ((key) => String(key || ''));
  const getSelectedPart = (opts && typeof opts.getSelectedPart === 'function') ? opts.getSelectedPart : (() => null);
  const ensureTransformState = (opts && typeof opts.ensureTransformState === 'function') ? opts.ensureTransformState : (() => null);

  function syncSelectionPanels(payload) {
    const shapes = Array.isArray(payload?.shapes) ? payload.shapes : [];
    const next = payload?.next || null;
    const currentArchetypeLabel = payload?.currentArchetypeLabel || null;

    const surfaceEmptyMessage = document.getElementById('surfaceEmptyMessage');
    const surfaceEmptyMessageText = document.getElementById('surfaceEmptyMessageText');
    const surfaceSections = document.getElementById('surfaceSections');
    const inspectorEmptyMessage = document.getElementById('inspectorEmptyMessage');
    const inspectorEmptyMessageText = document.getElementById('inspectorEmptyMessageText');
    const inspectorSections = document.getElementById('inspectorSections');
    const surfacePanelTitle = document.getElementById('surfacePanelTitle');
    const inspectorPanelTitle = document.getElementById('inspectorPanelTitle');
    const selectedShapeVal = document.getElementById('selectedShapeVal');
    const infoArchetype = document.getElementById('infoArchetype');

    if (shapes.length === 0) {
      if (surfacePanelTitle) surfacePanelTitle.textContent = tr('inspector_surface');
      if (inspectorPanelTitle) inspectorPanelTitle.textContent = tr('inspector_shape');
      if (surfaceEmptyMessage) {
        surfaceEmptyMessage.hidden = false;
        if (surfaceEmptyMessageText) {
          surfaceEmptyMessageText.setAttribute('data-i18n', 'surface_empty_msg');
          surfaceEmptyMessageText.textContent = tr('surface_empty_msg');
        }
      }
      if (surfaceSections) surfaceSections.hidden = true;
      if (inspectorEmptyMessage) {
        inspectorEmptyMessage.hidden = false;
        if (inspectorEmptyMessageText) {
          inspectorEmptyMessageText.setAttribute('data-i18n', 'inspector_empty_msg');
          inspectorEmptyMessageText.textContent = tr('inspector_empty_msg');
        }
      }
      if (inspectorSections) inspectorSections.hidden = true;
      if (selectedShapeVal) selectedShapeVal.textContent = '—';
      return;
    }

    if (!next) {
      if (surfacePanelTitle) surfacePanelTitle.textContent = tr('inspector_surface');
      if (inspectorPanelTitle) inspectorPanelTitle.textContent = tr('inspector_shape');
      if (surfaceEmptyMessage) {
        surfaceEmptyMessage.hidden = false;
        if (surfaceEmptyMessageText) {
          surfaceEmptyMessageText.setAttribute('data-i18n', 'surface_no_selection_msg');
          surfaceEmptyMessageText.textContent = tr('surface_no_selection_msg');
        }
      }
      if (surfaceSections) surfaceSections.hidden = true;
      if (inspectorEmptyMessage) {
        inspectorEmptyMessage.hidden = false;
        if (inspectorEmptyMessageText) {
          inspectorEmptyMessageText.setAttribute('data-i18n', 'inspector_no_selection_msg');
          inspectorEmptyMessageText.textContent = tr('inspector_no_selection_msg');
        }
      }
      if (inspectorSections) inspectorSections.hidden = true;
      if (selectedShapeVal) selectedShapeVal.textContent = '—';
      return;
    }

    const partName = String(next.name || next.id || '').trim();
    if (surfacePanelTitle) surfacePanelTitle.textContent = tr('inspector_surface') + ' — ' + partName;
    if (inspectorPanelTitle) inspectorPanelTitle.textContent = tr('inspector_shape') + ' — ' + partName;
    if (surfaceEmptyMessage) surfaceEmptyMessage.hidden = true;
    if (surfaceSections) surfaceSections.hidden = false;
    if (inspectorEmptyMessage) inspectorEmptyMessage.hidden = true;
    if (inspectorSections) inspectorSections.hidden = false;
    if (selectedShapeVal) selectedShapeVal.textContent = partName || '—';
    if (infoArchetype && currentArchetypeLabel) infoArchetype.textContent = currentArchetypeLabel;
  }

  function updatePartControlsFromSelected() {
    const part = getSelectedPart();
    const mesh = part && part._mesh ? part._mesh : null;

    const name = document.getElementById('partName');
    const scale = document.getElementById('partScale');
    const posX = document.getElementById('partPosX');
    const posY = document.getElementById('partPosY');
    const posZ = document.getElementById('partPosZ');
    const rotY = document.getElementById('partRotY');

    const vScale = document.getElementById('partScaleVal');
    const vX = document.getElementById('partPosXVal');
    const vY = document.getElementById('partPosYVal');
    const vZ = document.getElementById('partPosZVal');
    const vRY = document.getElementById('partRotYVal');

    if (!mesh) {
      if (name) name.value = '';
      if (scale) scale.value = '100';
      if (posX) posX.value = '0';
      if (posY) posY.value = '0';
      if (posZ) posZ.value = '0';
      if (rotY) rotY.value = '0';
      if (vScale) vScale.textContent = '—';
      if (vX) vX.textContent = '—';
      if (vY) vY.textContent = '—';
      if (vZ) vZ.textContent = '—';
      if (vRY) vRY.textContent = '—';
      return;
    }

    if (name) name.value = part.name || '';
    if (scale) scale.value = String(Math.round(mesh.scale.x * 100));
    if (posX) posX.value = String(Math.round(mesh.position.x * 100));
    if (posY) posY.value = String(Math.round(mesh.position.y * 100));
    if (posZ) posZ.value = String(Math.round(mesh.position.z * 100));
    if (rotY) rotY.value = String(Math.round((mesh.rotation.y * 180) / Math.PI));

    if (vScale) vScale.textContent = mesh.scale.x.toFixed(2);
    if (vX) vX.textContent = mesh.position.x.toFixed(2);
    if (vY) vY.textContent = mesh.position.y.toFixed(2);
    if (vZ) vZ.textContent = mesh.position.z.toFixed(2);
    if (vRY) vRY.textContent = `${Math.round((mesh.rotation.y * 180) / Math.PI)} deg`;
  }

  function updateShapeTransformControlsFromSelected() {
    const part = getSelectedPart();
    const mesh = part && part._mesh ? part._mesh : null;
    const t = part ? ensureTransformState(part) : null;

    const posX = document.getElementById('shapePosX');
    const posY = document.getElementById('shapePosY');
    const posZ = document.getElementById('shapePosZ');
    const rotX = document.getElementById('shapeRotX');
    const rotY = document.getElementById('shapeRotY');
    const rotZ = document.getElementById('shapeRotZ');
    const scaleX = document.getElementById('shapeScaleX');
    const scaleY = document.getElementById('shapeScaleY');
    const scaleZ = document.getElementById('shapeScaleZ');

    const vX = document.getElementById('shapePosXVal');
    const vY = document.getElementById('shapePosYVal');
    const vZ = document.getElementById('shapePosZVal');
    const vRX = document.getElementById('shapeRotXVal');
    const vRY = document.getElementById('shapeRotYVal');
    const vRZ = document.getElementById('shapeRotZVal');
    const vSX = document.getElementById('shapeScaleXVal');
    const vSY = document.getElementById('shapeScaleYVal');
    const vSZ = document.getElementById('shapeScaleZVal');

    if (!mesh) {
      if (posX) posX.value = '0';
      if (posY) posY.value = '0';
      if (posZ) posZ.value = '0';
      if (rotX) rotX.value = '0';
      if (rotY) rotY.value = '0';
      if (rotZ) rotZ.value = '0';
      if (scaleX) scaleX.value = '100';
      if (scaleY) scaleY.value = '100';
      if (scaleZ) scaleZ.value = '100';
      if (vX) vX.textContent = '—';
      if (vY) vY.textContent = '—';
      if (vZ) vZ.textContent = '—';
      if (vRX) vRX.textContent = '—';
      if (vRY) vRY.textContent = '—';
      if (vRZ) vRZ.textContent = '—';
      if (vSX) vSX.textContent = '—';
      if (vSY) vSY.textContent = '—';
      if (vSZ) vSZ.textContent = '—';
      if (posX) posX.removeAttribute('aria-valuetext');
      if (posY) posY.removeAttribute('aria-valuetext');
      if (posZ) posZ.removeAttribute('aria-valuetext');
      if (rotX) rotX.removeAttribute('aria-valuetext');
      if (rotY) rotY.removeAttribute('aria-valuetext');
      if (rotZ) rotZ.removeAttribute('aria-valuetext');
      if (scaleX) scaleX.removeAttribute('aria-valuetext');
      if (scaleY) scaleY.removeAttribute('aria-valuetext');
      if (scaleZ) scaleZ.removeAttribute('aria-valuetext');
      return;
    }

    const px = t && t.position ? (t.position.x || 0) : mesh.position.x;
    const py = t && t.position ? (t.position.y || 0) : mesh.position.y;
    const pz = t && t.position ? (t.position.z || 0) : mesh.position.z;
    const rx = t && t.rotation ? (t.rotation.x || 0) : mesh.rotation.x;
    const ry = t && t.rotation ? (t.rotation.y || 0) : mesh.rotation.y;
    const rz = t && t.rotation ? (t.rotation.z || 0) : mesh.rotation.z;
    const sx = t && t.scale ? ((typeof t.scale.x === 'number') ? t.scale.x : 1) : mesh.scale.x;
    const sy = t && t.scale ? ((typeof t.scale.y === 'number') ? t.scale.y : 1) : mesh.scale.y;
    const sz = t && t.scale ? ((typeof t.scale.z === 'number') ? t.scale.z : 1) : mesh.scale.z;

    if (posX) posX.value = String(Math.round(px * 100));
    if (posY) posY.value = String(Math.round(py * 100));
    if (posZ) posZ.value = String(Math.round(pz * 100));
    if (rotX) rotX.value = String(Math.round((rx * 180) / Math.PI));
    if (rotY) rotY.value = String(Math.round((ry * 180) / Math.PI));
    if (rotZ) rotZ.value = String(Math.round((rz * 180) / Math.PI));
    if (scaleX) scaleX.value = String(Math.round(sx * 100));
    if (scaleY) scaleY.value = String(Math.round(sy * 100));
    if (scaleZ) scaleZ.value = String(Math.round(sz * 100));

    const degX = Math.round((rx * 180) / Math.PI);
    const degY = Math.round((ry * 180) / Math.PI);
    const degZ = Math.round((rz * 180) / Math.PI);
    if (vX) vX.textContent = `${px.toFixed(2)} m`;
    if (vY) vY.textContent = `${py.toFixed(2)} m`;
    if (vZ) vZ.textContent = `${pz.toFixed(2)} m`;
    if (vRX) vRX.textContent = `${degX}°`;
    if (vRY) vRY.textContent = `${degY}°`;
    if (vRZ) vRZ.textContent = `${degZ}°`;
    if (vSX) vSX.textContent = `×${sx.toFixed(2)}`;
    if (vSY) vSY.textContent = `×${sy.toFixed(2)}`;
    if (vSZ) vSZ.textContent = `×${sz.toFixed(2)}`;
    if (posX) posX.setAttribute('aria-valuetext', `${px.toFixed(2)} meters`);
    if (posY) posY.setAttribute('aria-valuetext', `${py.toFixed(2)} meters`);
    if (posZ) posZ.setAttribute('aria-valuetext', `${pz.toFixed(2)} meters`);
    if (rotX) rotX.setAttribute('aria-valuetext', `${degX} degrees`);
    if (rotY) rotY.setAttribute('aria-valuetext', `${degY} degrees`);
    if (rotZ) rotZ.setAttribute('aria-valuetext', `${degZ} degrees`);
    if (scaleX) scaleX.setAttribute('aria-valuetext', `×${sx.toFixed(2)}`);
    if (scaleY) scaleY.setAttribute('aria-valuetext', `×${sy.toFixed(2)}`);
    if (scaleZ) scaleZ.setAttribute('aria-valuetext', `×${sz.toFixed(2)}`);
  }

  return {
    syncSelectionPanels,
    updatePartControlsFromSelected,
    updateShapeTransformControlsFromSelected,
  };
}

XR.__modules.ShellInspectorPanels = XR.__modules.ShellInspectorPanels || {};
XR.__modules.ShellInspectorPanels.create = create;
