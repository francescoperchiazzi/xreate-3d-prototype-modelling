// Responsibility: create the core Three.js scene/bootstrap objects for the editor.
// Reads from: `window.devicePixelRatio`, `ctx.THREE`, `ctx.threeCanvas`.
// Writes to: none directly; returns created objects to the caller.
// Published by the compatibility boundary in engine/main.js.

const GRID_SIZE = 6;
const GRID_DIVISIONS = 20;
const GRID_UNITS = 'm';

export function createSceneCore(ctx) {
  const THREE = ctx?.THREE;
  const threeCanvas = ctx?.threeCanvas || null;
  const devicePixelRatio = ctx?.devicePixelRatio ?? 1;

  if (!THREE || !threeCanvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: false });

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer && 'SRGBColorSpace' in THREE) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0908');
  renderer.setClearColor(0x0a0908, 1);

  const assemblyRoot = new THREE.Group();
  scene.add(assemblyRoot);

  const perspCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  perspCamera.position.set(0, 1.2, 3.5);
  perspCamera.lookAt(0, 0, 0);

  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  orthoCamera.position.copy(perspCamera.position);
  orthoCamera.lookAt(0, 0, 0);

  const VIEWPORT_LIGHT_BASE = { ambient: 0.25, key: 0.9, fill: 0.35, rim: 0.2 };
  const ambientLight = new THREE.AmbientLight(0xffffff, VIEWPORT_LIGHT_BASE.ambient);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff8e8, VIEWPORT_LIGHT_BASE.key);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  try {
    if (keyLight.shadow && keyLight.shadow.mapSize) keyLight.shadow.mapSize.set(2048, 2048);
    if (keyLight.shadow) keyLight.shadow.bias = -0.00025;
    if (keyLight.shadow) keyLight.shadow.normalBias = 0.02;
    if (keyLight.shadow) keyLight.shadow.radius = 2;
    if (keyLight.shadow && keyLight.shadow.camera) {
      keyLight.shadow.camera.near = 0.1;
      keyLight.shadow.camera.far = 40;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.camera.updateProjectionMatrix();
    }
  } catch (_) {}
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8aaabb, VIEWPORT_LIGHT_BASE.fill);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xc8a96e, VIEWPORT_LIGHT_BASE.rim);
  rimLight.position.set(0, -2, -4);
  scene.add(rimLight);


  return {
    renderer,
    scene,
    assemblyRoot,
    perspCamera,
    orthoCamera,
    camera: perspCamera,
    viewportView: 'free',
    viewportProjection: 'perspective',
    orthoZoom: 1.0,
    orbitTarget: new THREE.Vector3(0, 0, 0),
    ambientLight,
    keyLight,
    fillLight,
    rimLight,
    VIEWPORT_LIGHT_BASE,
  };
}

export function sphericalToXYZ(ctx) {
  const refs = ctx?.refs || {};
  const spherical = refs.spherical || null;
  const orbitTarget = refs.orbitTarget || null;
  const perspCamera = refs.perspCamera || null;
  const orthoCamera = refs.orthoCamera || null;
  if (!spherical || !orbitTarget || !perspCamera || !orthoCamera) return false;
  const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  const y = spherical.radius * Math.cos(spherical.phi);
  const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
  const px = orbitTarget.x + x;
  const py = orbitTarget.y + y;
  const pz = orbitTarget.z + z;
  perspCamera.position.set(px, py, pz);
  perspCamera.lookAt(orbitTarget);
  orthoCamera.position.set(px, py, pz);
  orthoCamera.lookAt(orbitTarget);
  return true;
}

export function setActiveCamera(ctx) {
  const refs = ctx?.refs || {};
  const kind = ctx?.kind;
  const perspCamera = refs.perspCamera || null;
  const orthoCamera = refs.orthoCamera || null;
  if (!perspCamera || !orthoCamera) return false;
  const k = (kind === 'ortho') ? 'ortho' : 'perspective';
  refs.viewportProjection = (k === 'ortho') ? 'ortho' : 'perspective';
  if (k === 'ortho') {
    orthoCamera.position.copy(perspCamera.position);
    orthoCamera.quaternion.copy(perspCamera.quaternion);
    refs.camera = orthoCamera;
  } else {
    perspCamera.position.copy(orthoCamera.position);
    perspCamera.quaternion.copy(orthoCamera.quaternion);
    refs.camera = perspCamera;
  }
  return true;
}

export function setViewportView(ctx) {
  const refs = ctx?.refs || {};
  const nextView = ctx?.nextView;
  const setActiveCameraFn = ctx?.setActiveCamera || null;
  const updateViewportViewButtons = ctx?.updateViewportViewButtons || null;
  const persistViewportSettings = ctx?.persistViewportSettings || null;
  const sphericalToXYZFn = ctx?.sphericalToXYZ || null;
  const v = String(nextView || 'free');
  refs.viewportView = v;
  if (v === 'free') {
    setActiveCameraFn && setActiveCameraFn('perspective');
    updateViewportViewButtons && updateViewportViewButtons();
    try { persistViewportSettings && persistViewportSettings(); } catch (_) {}
    return true;
  }
  setActiveCameraFn && setActiveCameraFn('ortho');
  const spherical = refs.spherical || null;
  const orthoCamera = refs.orthoCamera || null;
  if (!spherical || !orthoCamera) return false;
  const eps = 0.001;
  if (v === 'front') { spherical.theta = 0; spherical.phi = Math.PI / 2; }
  else if (v === 'back') { spherical.theta = Math.PI; spherical.phi = Math.PI / 2; }
  else if (v === 'right') { spherical.theta = Math.PI / 2; spherical.phi = Math.PI / 2; }
  else if (v === 'left') { spherical.theta = -Math.PI / 2; spherical.phi = Math.PI / 2; }
  else if (v === 'top') { spherical.theta = 0; spherical.phi = eps; }
  else if (v === 'bottom') { spherical.theta = 0; spherical.phi = Math.PI - eps; }
  else if (v === 'iso') { spherical.theta = Math.PI / 4; spherical.phi = Math.acos(1 / Math.sqrt(3)); }
  refs.orthoZoom = 1.0;
  orthoCamera.zoom = refs.orthoZoom;
  orthoCamera.updateProjectionMatrix();
  sphericalToXYZFn && sphericalToXYZFn();
  updateViewportViewButtons && updateViewportViewButtons();
  try { persistViewportSettings && persistViewportSettings(); } catch (_) {}
  return true;
}

export function readViewportSettings(ctx) {
  const Storage = ctx?.Storage || null;
  const devWarn = ctx?.devWarn || null;
  try {
    const s = Storage && typeof Storage.getJSON === 'function'
      ? Storage.getJSON('xreate_viewport')
      : null;
    if (!s || typeof s !== 'object') return null;
    return s;
  } catch (e) {
    try { devWarn && devWarn('[XReate] readViewportSettings failed:', e); } catch (_) {}
    return null;
  }
}

export function persistViewportSettings(ctx) {
  const refs = ctx?.refs || {};
  const Storage = ctx?.Storage || null;
  const devWarn = ctx?.devWarn || null;
  try {
    Storage && typeof Storage.setJSON === 'function' && Storage.setJSON('xreate_viewport', {
      view: refs.viewportView,
      orthoZoom: refs.orthoZoom,
      spherical: refs.spherical,
      flatLightingOn: refs.flatLightingOn,
      target: refs.orbitTarget ? { x: refs.orbitTarget.x, y: refs.orbitTarget.y, z: refs.orbitTarget.z } : { x: 0, y: 0, z: 0 },
    });
  } catch (err) {
    try { devWarn && devWarn('[XReate] persistViewportSettings failed:', err); } catch (_) {}
  }
  return true;
}

export function fitViewportView(ctx) {
  const refs = ctx?.refs || {};
  const THREE = ctx?.THREE || null;
  const getShapeList = ctx?.getShapeList || null;
  const clampSnap = ctx?.clampSnap || null;
  const sphericalToXYZFn = ctx?.sphericalToXYZ || null;
  const persistViewportSettingsFn = ctx?.persistViewportSettings || null;
  if (!THREE || !getShapeList || !clampSnap || !sphericalToXYZFn || !persistViewportSettingsFn) return false;
  const shapes = getShapeList();
  const box = new THREE.Box3();
  let has = false;
  for (const p of shapes) {
    if (!p || p.visible === false) continue;
    const m = p._mesh || null;
    if (!m || m.visible === false) continue;
    try { box.expandByObject(m); has = true; } catch (_) {}
  }
  if (!has) return false;
  const sizeV = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(sizeV);
  box.getCenter(center);
  refs.orbitTarget.copy(center);
  const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z);
  const pad = 1.25;
  if (refs.camera === refs.orthoCamera) {
    const w = Math.max(0.001, (refs.orthoCamera.right - refs.orthoCamera.left));
    const h = Math.max(0.001, (refs.orthoCamera.top - refs.orthoCamera.bottom));
    let planeW = maxDim;
    let planeH = maxDim;
    if (refs.viewportView === 'front' || refs.viewportView === 'back') { planeW = sizeV.x; planeH = sizeV.y; }
    else if (refs.viewportView === 'left' || refs.viewportView === 'right') { planeW = sizeV.z; planeH = sizeV.y; }
    else if (refs.viewportView === 'top' || refs.viewportView === 'bottom') { planeW = sizeV.x; planeH = sizeV.z; }
    const needW = Math.max(0.001, planeW * pad);
    const needH = Math.max(0.001, planeH * pad);
    refs.orthoZoom = clampSnap(Math.min(w / needW, h / needH), 0.3, 3.0, 0);
    refs.orthoCamera.zoom = refs.orthoZoom;
    refs.orthoCamera.updateProjectionMatrix();
  } else {
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const r = Math.max(0.001, sphere.radius * pad);
    const vFov = (refs.perspCamera.fov || 45) * Math.PI / 180;
    const aspect = Math.max(0.001, refs.perspCamera.aspect || 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const halfMin = Math.max(0.001, Math.min(vFov / 2, hFov / 2));
    const dist = r / Math.sin(halfMin);
    refs.spherical.radius = Math.max(1, Math.min(200, dist));
  }
  sphericalToXYZFn();
  persistViewportSettingsFn();
  return true;
}

export function getGridConfig() {
  return {
    size: GRID_SIZE,
    divisions: GRID_DIVISIONS,
    units: GRID_UNITS,
  };
}

export function disposeGridLabelGroup(ctx) {
  const refs = ctx?.refs || {};
  const group = refs.gridLabelGroup || null;
  if (!group) return false;
  const kids = group.children ? [...group.children] : [];
  for (const o of kids) {
    try {
      const mat = o && o.material ? o.material : null;
      const map = mat && mat.map ? mat.map : null;
      if (map && map.dispose) map.dispose();
      if (mat && mat.dispose) mat.dispose();
    } catch (_) {}
    try { group.remove(o); } catch (_) {}
  }
  return true;
}

export function makeGridTextSprite(ctx) {
  const THREE = ctx?.THREE || null;
  const ensureSrgbTexture = ctx?.ensureSrgbTexture || null;
  const text = ctx?.text;
  if (!THREE) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) return null;
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.fillStyle = 'rgba(0,0,0,0)';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.font = '700 44px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  canvasCtx.textAlign = 'center';
  canvasCtx.textBaseline = 'middle';
  canvasCtx.lineWidth = 7;
  canvasCtx.strokeStyle = 'rgba(0,0,0,0.35)';
  canvasCtx.strokeText(String(text), canvas.width / 2, canvas.height / 2);
  canvasCtx.fillStyle = 'rgba(245,240,232,0.92)';
  canvasCtx.fillText(String(text), canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  try { ensureSrgbTexture && ensureSrgbTexture(tex); } catch (_) {}
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(0.55, 0.275);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

export function rebuildGridLabels(ctx) {
  const refs = ctx?.refs || {};
  const THREE = ctx?.THREE || null;
  const ensureSrgbTexture = ctx?.ensureSrgbTexture || null;
  const gridHelper = refs.gridHelper || null;
  const gridLabelGroup = refs.gridLabelGroup || null;
  if (!THREE || !gridHelper || !gridLabelGroup) return false;
  disposeGridLabelGroup({ refs: { gridLabelGroup } });
  const half = GRID_SIZE / 2;
  const max = Math.floor(half);
  const y = (gridHelper.position && typeof gridHelper.position.y === 'number') ? gridHelper.position.y : -1;
  const baseY = y + 0.01;

  for (let i = -max; i <= max; i++) {
    const sprX = makeGridTextSprite({ THREE, ensureSrgbTexture, text: `${i}${GRID_UNITS}` });
    if (sprX) {
      sprX.position.set(i, baseY, 0);
      gridLabelGroup.add(sprX);
    }
    if (i !== 0) {
      const sprZ = makeGridTextSprite({ THREE, ensureSrgbTexture, text: `${i}${GRID_UNITS}` });
      if (sprZ) {
        sprZ.position.set(0, baseY, i);
        gridLabelGroup.add(sprZ);
      }
    }
  }
  return true;
}

export function createViewportGrid(ctx) {
  const THREE = ctx?.THREE || null;
  const scene = ctx?.scene || null;
  const ensureSrgbTexture = ctx?.ensureSrgbTexture || null;
  if (!THREE || !scene) return null;
  const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x2a2720, 0x1c1a16);
  gridHelper.position.y = -1;
  scene.add(gridHelper);
  const gridLabelGroup = new THREE.Group();
  scene.add(gridLabelGroup);
  rebuildGridLabels({ THREE, ensureSrgbTexture, refs: { gridHelper, gridLabelGroup } });
  return { gridHelper, gridLabelGroup };
}

export function resizeRenderer(ctx) {
  const refs = ctx?.refs || {};
  const threeWrap = ctx?.threeWrap || null;
  const renderer = refs.renderer || null;
  const perspCamera = refs.perspCamera || null;
  const orthoCamera = refs.orthoCamera || null;
  const orthoZoom = refs.orthoZoom;
  if (!threeWrap || !renderer || !perspCamera || !orthoCamera) return false;

  const wrapRect = threeWrap.getBoundingClientRect();
  const w = Math.max(1, Math.floor(wrapRect.width));
  const h = Math.max(1, Math.floor(wrapRect.height));
  renderer.setSize(w, h, true);
  const aspect = w / h;
  perspCamera.aspect = aspect;
  perspCamera.updateProjectionMatrix();
  const size = 2.6;
  orthoCamera.left = -size * aspect;
  orthoCamera.right = size * aspect;
  orthoCamera.top = size;
  orthoCamera.bottom = -size;
  orthoCamera.zoom = orthoZoom;
  orthoCamera.updateProjectionMatrix();
  return true;
}

export function applyViewportSettings(ctx) {
  const refs = ctx?.refs || {};
  const settings = ctx?.settings || null;
  const clampSnap = ctx?.clampSnap || null;
  const setActiveCameraFn = ctx?.setActiveCamera || null;
  const sphericalToXYZFn = ctx?.sphericalToXYZ || null;
  if (!settings || typeof settings !== 'object') return false;

  let appliedFlatLighting = false;
  if (typeof settings.flatLightingOn === 'boolean') {
    refs.flatLightingOn = settings.flatLightingOn;
    appliedFlatLighting = true;
  }

  if (settings.spherical && typeof settings.spherical === 'object' && refs.spherical) {
    const th = Number(settings.spherical.theta);
    const ph = Number(settings.spherical.phi);
    const ra = Number(settings.spherical.radius);
    if (isFinite(th)) refs.spherical.theta = th;
    if (isFinite(ph)) refs.spherical.phi = ph;
    if (isFinite(ra)) refs.spherical.radius = ra;
  }

  if (settings.target && typeof settings.target === 'object' && refs.orbitTarget && typeof refs.orbitTarget.set === 'function') {
    const tx = Number(settings.target.x);
    const ty = Number(settings.target.y);
    const tz = Number(settings.target.z);
    if (isFinite(tx) && isFinite(ty) && isFinite(tz)) refs.orbitTarget.set(tx, ty, tz);
  }

  const storedView = (typeof settings.view === 'string') ? settings.view : null;
  const storedZoom = (typeof settings.orthoZoom === 'number' && isFinite(settings.orthoZoom)) ? settings.orthoZoom : null;
  if (storedView) {
    refs.viewportView = storedView;
    if (storedView === 'free') {
      try { setActiveCameraFn && setActiveCameraFn('perspective'); } catch (_) {}
    } else {
      try { setActiveCameraFn && setActiveCameraFn('ortho'); } catch (_) {}
      const spherical = refs.spherical || null;
      const orthoCamera = refs.orthoCamera || null;
      if (spherical && orthoCamera) {
        const eps = 0.001;
        if (storedView === 'front') { spherical.theta = 0; spherical.phi = Math.PI / 2; }
        else if (storedView === 'back') { spherical.theta = Math.PI; spherical.phi = Math.PI / 2; }
        else if (storedView === 'right') { spherical.theta = Math.PI / 2; spherical.phi = Math.PI / 2; }
        else if (storedView === 'left') { spherical.theta = -Math.PI / 2; spherical.phi = Math.PI / 2; }
        else if (storedView === 'top') { spherical.theta = 0; spherical.phi = eps; }
        else if (storedView === 'bottom') { spherical.theta = 0; spherical.phi = Math.PI - eps; }
        else if (storedView === 'iso') { spherical.theta = Math.PI / 4; spherical.phi = Math.acos(1 / Math.sqrt(3)); }
        refs.orthoZoom = (storedZoom !== null && typeof clampSnap === 'function')
          ? clampSnap(storedZoom, 0.3, 3.0, 0)
          : 1.0;
        orthoCamera.zoom = refs.orthoZoom;
        orthoCamera.updateProjectionMatrix();
      }
    }
    try { sphericalToXYZFn && sphericalToXYZFn(); } catch (_) {}
  }

  return {
    appliedFlatLighting,
    storedViewApplied: !!storedView,
    storedZoomApplied: storedZoom !== null,
    persistRecommended: !!storedView,
  };
}

export function setSceneBackground(ctx) {
  const THREE = ctx?.THREE || null;
  const refs = ctx?.refs || {};
  const scene = refs.scene || null;
  const renderer = refs.renderer || null;
  const colorValue = ctx?.color;
  if (!THREE || !scene || !renderer || !colorValue) return false;
  const color = new THREE.Color(colorValue);
  scene.background = color;
  renderer.setClearColor(color, 1);
  return true;
}
