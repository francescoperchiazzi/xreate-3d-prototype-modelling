export function drawUvOverlaySphere(args) {
  const { uvCtx, CANVAS_SIZE, getUvOverlayTheme } = args || {};
  const th = getUvOverlayTheme();
  uvCtx.save();
  uvCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  uvCtx.strokeStyle = th.gridDash;
  uvCtx.lineWidth = 1;
  uvCtx.setLineDash([4, 6]);
  for (let i = 1; i < 16; i++) {
    const x = (i * CANVAS_SIZE) / 16;
    uvCtx.beginPath();
    uvCtx.moveTo(x, 0);
    uvCtx.lineTo(x, CANVAS_SIZE);
    uvCtx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const y = (i * CANVAS_SIZE) / 8;
    uvCtx.beginPath();
    uvCtx.moveTo(0, y);
    uvCtx.lineTo(CANVAS_SIZE, y);
    uvCtx.stroke();
  }
  uvCtx.setLineDash([]);
  uvCtx.strokeStyle = th.labelStrong;
  uvCtx.lineWidth = 2;
  uvCtx.beginPath();
  uvCtx.moveTo(0, CANVAS_SIZE / 2);
  uvCtx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
  uvCtx.stroke();
  uvCtx.lineWidth = 2;
  uvCtx.beginPath();
  uvCtx.moveTo(0, 0);
  uvCtx.lineTo(0, CANVAS_SIZE);
  uvCtx.stroke();
  uvCtx.fillStyle = th.labelStrong;
  uvCtx.font = '700 11px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  uvCtx.textBaseline = 'middle';
  uvCtx.textAlign = 'left';
  uvCtx.fillText('SEAM', 8, 14);
  uvCtx.textAlign = 'right';
  uvCtx.fillText('EQUATOR', CANVAS_SIZE - 8, (CANVAS_SIZE / 2) - 14);
  uvCtx.textAlign = 'center';
  uvCtx.fillText('N', CANVAS_SIZE / 2, 14);
  uvCtx.fillText('S', CANVAS_SIZE / 2, CANVAS_SIZE - 14);
  uvCtx.strokeStyle = th.labelStrong;
  uvCtx.lineWidth = 2;
  uvCtx.beginPath();
  uvCtx.arc(CANVAS_SIZE / 2, 14, 8, 0, Math.PI * 2);
  uvCtx.stroke();
  uvCtx.beginPath();
  uvCtx.arc(CANVAS_SIZE / 2, CANVAS_SIZE - 14, 8, 0, Math.PI * 2);
  uvCtx.stroke();
  try { drawUvOriginAxesOverlay({ ...args, ctx: uvCtx, mode: 'sphere' }); } catch (_) {}
  uvCtx.restore();
}

export function setUvStretch(args) {
  const { on, refs } = args || {};
  refs.uvStretchOn = !!on;
}

export function uvModePrimaryIsland(args) {
  const { mode, uvMode, UV_LAYOUT, CANVAS_SIZE } = args || {};
  const m = String(mode || uvMode || 'sphere');
  if (m === 'box') {
    const face = UV_LAYOUT.box.face;
    const originX = UV_LAYOUT.box.originX;
    const originY = UV_LAYOUT.box.originY;
    return { type: 'rect', x: originX + 2 * face, y: originY + 1 * face, w: face, h: face };
  }
  if (m === 'cylindrical') {
    const { wrapH, wrapY, wrapX, wrapW } = UV_LAYOUT.cylinder;
    return { type: 'rect', x: wrapX, y: wrapY, w: wrapW, h: wrapH };
  }
  if (m === 'planar') {
    const pad = UV_LAYOUT.planar.pad;
    return { type: 'rect', x: pad, y: pad, w: CANVAS_SIZE - pad * 2, h: CANVAS_SIZE - pad * 2 };
  }
  return { type: 'rect', x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE };
}

export function drawUvOriginAxesOverlay(args) {
  const { ctx, mode, getUvOverlayTheme } = args || {};
  if (!ctx) return;
  const th = getUvOverlayTheme();
  const isl = uvModePrimaryIsland(args);
  if (!isl || isl.type !== 'rect') return;
  const ox = isl.x + 8;
  const oy = isl.y + 12;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '700 11px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  ctx.fillStyle = th.labelStrong;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('(0,0)', ox, oy);
  ctx.strokeStyle = th.labelStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox, oy + 4);
  ctx.lineTo(ox + 26, oy + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox, oy + 4);
  ctx.lineTo(ox, oy + 30);
  ctx.stroke();
  ctx.fillText('U→', ox + 30, oy + 8);
  ctx.fillText('V↓', ox + 2, oy + 44);
  ctx.restore();
}

export function getIslandsForUvMode(args) {
  const { uvMode, UV_LAYOUT, CANVAS_SIZE } = args || {};
  if (uvMode === 'box') {
    const face = UV_LAYOUT.box.face;
    const originX = UV_LAYOUT.box.originX;
    const originY = UV_LAYOUT.box.originY;
    const rect = (col, row) => ({ x: originX + col * face, y: originY + row * face, w: face, h: face });
    return [
      { id: 'top', type: 'rect', labelKey: 'uv_island_top', ...rect(1, 0) },
      { id: 'back', type: 'rect', labelKey: 'uv_island_back', ...rect(0, 1) },
      { id: 'left', type: 'rect', labelKey: 'uv_island_left', ...rect(1, 1) },
      { id: 'front', type: 'rect', labelKey: 'uv_island_front', ...rect(2, 1) },
      { id: 'right', type: 'rect', labelKey: 'uv_island_right', ...rect(3, 1) },
      { id: 'bottom', type: 'rect', labelKey: 'uv_island_bottom', ...rect(1, 2) },
    ];
  }
  if (uvMode === 'cylindrical') {
    const { wrapH, wrapY, wrapX, wrapW, capR: r, capTopY, capBottomY } = UV_LAYOUT.cylinder;
    const cx = CANVAS_SIZE / 2;
    return [
      { id: 'wrap', type: 'rect', labelKey: 'uv_island_wrap', x: wrapX, y: wrapY, w: wrapW, h: wrapH },
      { id: 'cap_top', type: 'circle', labelKey: 'uv_island_cap_top', cx, cy: capTopY, r },
      { id: 'cap_bottom', type: 'circle', labelKey: 'uv_island_cap_bottom', cx, cy: capBottomY, r },
    ];
  }
  if (uvMode === 'planar') {
    const pad = UV_LAYOUT.planar.pad;
    return [{ id: 'plane', type: 'rect', labelKey: 'uv_island_plane', x: pad, y: pad, w: CANVAS_SIZE - pad * 2, h: CANVAS_SIZE - pad * 2 }];
  }
  return [{ id: 'canvas', type: 'rect', labelKey: 'uv_island_canvas', x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE }];
}

export function drawUvOverlayBoxNet(args) {
  const { uvCtx, CANVAS_SIZE, UV_LAYOUT, getUvOverlayTheme, selectedIslandId } = args || {};
  const th = getUvOverlayTheme();
  uvCtx.save();
  uvCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const face = UV_LAYOUT.box.face;
  const originX = UV_LAYOUT.box.originX;
  const originY = UV_LAYOUT.box.originY;
  function faceRect(col, row) {
    return { x: originX + col * face, y: originY + row * face, w: face, h: face };
  }

  const faces = [
    { id: 'top', name: 'TOP',  ...faceRect(1, 0) },
    { id: 'back', name: 'BACK', ...faceRect(0, 1) },
    { id: 'left', name: 'LEFT', ...faceRect(1, 1) },
    { id: 'front', name: 'FRONT',...faceRect(2, 1) },
    { id: 'right', name: 'RIGHT',...faceRect(3, 1) },
    { id: 'bottom', name: 'BOT',  ...faceRect(1, 2) },
  ];

  uvCtx.fillStyle = th.faceFill;
  uvCtx.strokeStyle = th.faceStroke;
  uvCtx.lineWidth = 1;
  for (const f of faces) {
    uvCtx.fillRect(f.x, f.y, f.w, f.h);
    uvCtx.strokeRect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
  }

  uvCtx.font = '700 12px \"IBM Plex Sans\", \"Noto Sans Arabic\", \"Noto Sans Hebrew\", \"Noto Sans JP\", \"Noto Sans KR\", \"Noto Sans SC\", sans-serif';
  uvCtx.fillStyle = th.label;
  uvCtx.textAlign = 'center';
  uvCtx.textBaseline = 'middle';
  for (const f of faces) uvCtx.fillText(f.name, f.x + f.w / 2, f.y + f.h / 2);

  if (selectedIslandId) {
    const sel = faces.find((f) => f.id === selectedIslandId);
    if (sel) {
      uvCtx.strokeStyle = 'rgba(200, 170, 110, 0.9)';
      uvCtx.lineWidth = 4;
      uvCtx.strokeRect(sel.x + 2, sel.y + 2, sel.w - 4, sel.h - 4);
    }
  }

  try { drawUvOriginAxesOverlay({ ...args, ctx: uvCtx, mode: 'box' }); } catch (_) {}
  uvCtx.restore();
}

export function drawUvOverlayCylinderNet(args) {
  const { uvCtx, CANVAS_SIZE, UV_LAYOUT, getUvOverlayTheme, selectedIslandId, t } = args || {};
  const th = getUvOverlayTheme();
  uvCtx.save();
  uvCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const { wrapH, wrapY, wrapX, wrapW, capR: r, capTopY, capBottomY } = UV_LAYOUT.cylinder;
  const cx = CANVAS_SIZE / 2;
  const capTop = { cx, cy: capTopY, r };
  const capBottom = { cx, cy: capBottomY, r };

  uvCtx.fillStyle = th.faceFill;
  uvCtx.strokeStyle = th.faceStroke;
  uvCtx.lineWidth = 1;
  uvCtx.fillRect(wrapX, wrapY, wrapW, wrapH);
  uvCtx.strokeRect(wrapX + 1, wrapY + 1, wrapW - 2, wrapH - 2);

  uvCtx.beginPath();
  uvCtx.arc(capTop.cx, capTop.cy, capTop.r, 0, Math.PI * 2);
  uvCtx.fill();
  uvCtx.stroke();

  uvCtx.beginPath();
  uvCtx.arc(capBottom.cx, capBottom.cy, capBottom.r, 0, Math.PI * 2);
  uvCtx.fill();
  uvCtx.stroke();

  // Keep the circular islands self-explanatory: a Revolve Doodle has the
  // same independent cap targets as a primitive cylinder.
  uvCtx.fillStyle = th.labelStrong;
  uvCtx.font = '700 10px "IBM Plex Sans", sans-serif';
  uvCtx.textAlign = 'center';
  uvCtx.textBaseline = 'middle';
  uvCtx.fillText(typeof t === 'function' ? t('uv_island_cap_top') : 'CAP TOP', capTop.cx, capTop.cy);
  uvCtx.fillText(typeof t === 'function' ? t('uv_island_cap_bottom') : 'CAP BOTTOM', capBottom.cx, capBottom.cy);

  uvCtx.setLineDash([4, 6]);
  uvCtx.lineWidth = 1;
  uvCtx.strokeStyle = th.gridDash;
  for (let i = 1; i < 8; i++) {
    const x = wrapX + (i * wrapW) / 8;
    uvCtx.beginPath();
    uvCtx.moveTo(x, wrapY);
    uvCtx.lineTo(x, wrapY + wrapH);
    uvCtx.stroke();
  }
  uvCtx.setLineDash([]);

  if (selectedIslandId) {
    uvCtx.strokeStyle = 'rgba(200, 170, 110, 0.9)';
    uvCtx.lineWidth = 4;
    if (selectedIslandId === 'wrap') {
      uvCtx.strokeRect(wrapX + 2, wrapY + 2, wrapW - 4, wrapH - 4);
    } else if (selectedIslandId === 'cap_top') {
      uvCtx.beginPath();
      uvCtx.arc(capTop.cx, capTop.cy, capTop.r - 2, 0, Math.PI * 2);
      uvCtx.stroke();
    } else if (selectedIslandId === 'cap_bottom') {
      uvCtx.beginPath();
      uvCtx.arc(capBottom.cx, capBottom.cy, capBottom.r - 2, 0, Math.PI * 2);
      uvCtx.stroke();
    }
  }

  try { drawUvOriginAxesOverlay({ ...args, ctx: uvCtx, mode: 'cylindrical' }); } catch (_) {}
  uvCtx.restore();
}

export function drawUvOverlayPlanar(args) {
  const { uvCtx, CANVAS_SIZE, UV_LAYOUT, getUvOverlayTheme, selectedIslandId, currentMesh } = args || {};
  const th = getUvOverlayTheme();
  uvCtx.save();
  uvCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const pad = UV_LAYOUT.planar.pad;
  uvCtx.strokeStyle = th.faceStroke;
  uvCtx.lineWidth = 1;
  uvCtx.strokeRect(pad, pad, CANVAS_SIZE - pad * 2, CANVAS_SIZE - pad * 2);
  uvCtx.setLineDash([4, 6]);
  uvCtx.lineWidth = 1;
  uvCtx.strokeStyle = th.gridDash;
  for (let i = 1; i < 8; i++) {
    const x = (i * CANVAS_SIZE) / 8;
    uvCtx.beginPath();
    uvCtx.moveTo(x, 0);
    uvCtx.lineTo(x, CANVAS_SIZE);
    uvCtx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const y = (i * CANVAS_SIZE) / 8;
    uvCtx.beginPath();
    uvCtx.moveTo(0, y);
    uvCtx.lineTo(CANVAS_SIZE, y);
    uvCtx.stroke();
  }
  uvCtx.setLineDash([]);
  if (selectedIslandId === 'plane') {
    uvCtx.strokeStyle = 'rgba(200, 170, 110, 0.9)';
    uvCtx.lineWidth = 4;
    uvCtx.strokeRect(pad * 2, pad * 2, CANVAS_SIZE - pad * 4, CANVAS_SIZE - pad * 4);
  }
  let proj = 'Z';
  let uAxis = 'X';
  let vAxis = 'Y';
  let vFlip = false;
  try {
    const geo = currentMesh && currentMesh.geometry ? currentMesh.geometry : null;
    if (geo && geo.attributes && geo.attributes.position) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const min = bb.min;
      const max = bb.max;
      const sx = Math.max(1e-6, max.x - min.x);
      const sy = Math.max(1e-6, max.y - min.y);
      const sz = Math.max(1e-6, max.z - min.z);
      const useXY = (sz <= sx && sz <= sy);
      const useXZ = (!useXY) && (sy <= sx && sy <= sz);
      if (useXY) {
        proj = 'Z';
        uAxis = 'X';
        vAxis = 'Y';
        vFlip = false;
      } else if (useXZ) {
        proj = 'Y';
        uAxis = 'X';
        vAxis = 'Z';
        vFlip = true;
      } else {
        proj = 'X';
        uAxis = 'Z';
        vAxis = 'Y';
        vFlip = true;
      }
    }
  } catch (_) {}
  const bx = pad + 10;
  const by = pad + 10;
  const bw = 190;
  const bh = 52;
  uvCtx.fillStyle = th.faceFill;
  uvCtx.strokeStyle = th.faceStroke;
  uvCtx.lineWidth = 1;
  uvCtx.fillRect(bx, by, bw, bh);
  uvCtx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  uvCtx.fillStyle = th.labelStrong;
  uvCtx.font = '700 11px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  uvCtx.textAlign = 'left';
  uvCtx.textBaseline = 'alphabetic';
  uvCtx.fillText(`PLANAR PROJ ${proj}`, bx + 10, by + 20);
  uvCtx.fillStyle = th.label;
  uvCtx.font = '600 11px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
  uvCtx.fillText(`U = ${uAxis}`, bx + 10, by + 38);
  uvCtx.fillText(`V = ${vAxis}${vFlip ? ' (flip)' : ''}`, bx + 88, by + 38);
  try { drawUvOriginAxesOverlay({ ...args, ctx: uvCtx, mode: 'planar' }); } catch (_) {}
  uvCtx.restore();
}

export function drawUvOverlayMeshUv(args) {
  const { uvCtx, currentMesh, CANVAS_SIZE, refs } = args || {};
  if (!uvCtx) return;
  if (!currentMesh || !currentMesh.geometry) return;
  const geo = currentMesh.geometry;
  const posAttr = geo.attributes && geo.attributes.position ? geo.attributes.position : null;
  const uvAttr = geo.attributes && geo.attributes.uv ? geo.attributes.uv : null;
  if (!uvAttr || !uvAttr.count) return;
  const idxAttr = geo.index || null;
  const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(uvAttr.count / 3);
  if (!triCount) return;

  const maxTris = 9000;
  const step = (triCount > maxTris) ? Math.ceil(triCount / maxTris) : 1;

  uvCtx.save();
  uvCtx.setTransform(1, 0, 0, 1, 0, 0);
  if (refs.uvStretchOn && posAttr && posAttr.count) {
    const bins = 9;
    const paths = Array.from({ length: bins }, () => new Path2D());
    const eps = 1e-12;
    const area2d = (ax, ay, bx, by, cx, cy) => Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) * 0.5;
    const area3d = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      const cxp = (aby * acz) - (abz * acy);
      const cyp = (abz * acx) - (abx * acz);
      const czp = (abx * acy) - (aby * acx);
      return Math.sqrt((cxp * cxp) + (cyp * cyp) + (czp * czp)) * 0.5;
    };
    const px = (u) => u * CANVAS_SIZE;
    const py = (v) => v * CANVAS_SIZE;
    const getU = (i) => uvAttr.getX(i);
    const getV = (i) => uvAttr.getY(i);
    const getX = (i) => posAttr.getX(i);
    const getY = (i) => posAttr.getY(i);
    const getZ = (i) => posAttr.getZ(i);
    for (let t = 0; t < triCount; t += step) {
      const i0 = idxAttr ? idxAttr.getX(t * 3) : (t * 3);
      const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : (t * 3 + 1);
      const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : (t * 3 + 2);
      const u0 = getU(i0), v0 = getV(i0);
      const u1 = getU(i1), v1 = getV(i1);
      const u2 = getU(i2), v2 = getV(i2);
      const Auv = area2d(u0, v0, u1, v1, u2, v2) + eps;
      const A3d = area3d(getX(i0), getY(i0), getZ(i0), getX(i1), getY(i1), getZ(i1), getX(i2), getY(i2), getZ(i2)) + eps;
      const s = Math.log2(Auv / A3d);
      const tt = Math.max(-2.0, Math.min(2.0, s));
      const x = (tt + 2.0) / 4.0;
      const b = Math.max(0, Math.min(bins - 1, Math.round(x * (bins - 1))));
      const p = paths[b];
      p.moveTo(px(u0), py(v0));
      p.lineTo(px(u1), py(v1));
      p.lineTo(px(u2), py(v2));
      p.closePath();
    }
    const colorForBin = (b) => {
      const t = (bins <= 1) ? 0.5 : (b / (bins - 1));
      const r = Math.round(255 * Math.max(0, Math.min(1, (t - 0.5) * 2)));
      const bb = Math.round(255 * Math.max(0, Math.min(1, (0.5 - t) * 2)));
      const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
      return `rgba(${r},${g},${bb},0.32)`;
    };
    for (let b = 0; b < bins; b++) {
      uvCtx.fillStyle = colorForBin(b);
      uvCtx.fill(paths[b]);
    }
  }

  uvCtx.strokeStyle = 'rgba(255, 150, 0, 0.55)';
  uvCtx.lineWidth = 1;
  uvCtx.beginPath();

  const px = (u) => u * CANVAS_SIZE;
  const py = (v) => v * CANVAS_SIZE;

  const getU = (i) => uvAttr.getX(i);
  const getV = (i) => uvAttr.getY(i);

  let batch = 0;
  for (let t = 0; t < triCount; t += step) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : (t * 3);
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : (t * 3 + 1);
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : (t * 3 + 2);

    const u0 = getU(i0), v0 = getV(i0);
    const u1 = getU(i1), v1 = getV(i1);
    const u2 = getU(i2), v2 = getV(i2);

    const x0 = px(u0), y0 = py(v0);
    const x1 = px(u1), y1 = py(v1);
    const x2 = px(u2), y2 = py(v2);

    uvCtx.moveTo(x0, y0); uvCtx.lineTo(x1, y1);
    uvCtx.lineTo(x2, y2); uvCtx.closePath();

    batch++;
    if (batch >= 1500) {
      uvCtx.stroke();
      uvCtx.beginPath();
      batch = 0;
    }
  }
  if (batch) uvCtx.stroke();
  uvCtx.restore();
}

export function renderUvOverlay(args) {
  const { uvMode, uvCtx, CANVAS_SIZE, currentMesh } = args || {};
  if (!uvCtx) {
    debugEvent('uv.overlay.skipped', { reason: 'missing-context', uvMode: uvMode || null });
    return false;
  }
  debugEvent('uv.overlay.start', {
    uvMode: uvMode || 'sphere',
    canvasSize: CANVAS_SIZE || null,
    canvasWidth: uvCtx.canvas?.width || null,
    canvasHeight: uvCtx.canvas?.height || null,
    hasMesh: !!currentMesh,
  });
  try {
    if (uvMode === 'box') drawUvOverlayBoxNet(args);
    else if (uvMode === 'cylindrical') drawUvOverlayCylinderNet(args);
    else if (uvMode === 'planar') drawUvOverlayPlanar(args);
    else drawUvOverlaySphere(args);
    drawUvOverlayMeshUv(args);
    debugEvent('uv.overlay.success', { uvMode: uvMode || 'sphere' });
    return true;
  } catch (err) {
    debugError('uv.overlay.failure', err, { uvMode: uvMode || 'sphere' });
    return false;
  }
}

export function renderUvNetToCanvas(args) {
  const { canvas, mode, CANVAS_SIZE, UV_LAYOUT, isDarkThemeActive, rgba, getUvOverlayTheme, uvMode } = args || {};
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let th = null;
  try {
    const dark = isDarkThemeActive();
    if (dark) {
      const inkRgb = { r: 40, g: 35, b: 28 };
      th = {
        gridDash: rgba(inkRgb, 0.35),
        frame: rgba(inkRgb, 0.55),
        faceFill: rgba(inkRgb, 0.06),
        faceStroke: rgba(inkRgb, 0.65),
        label: rgba(inkRgb, 0.55),
        labelStrong: rgba(inkRgb, 0.85),
      };
    }
  } catch (_) {}
  if (!th) th = getUvOverlayTheme();
  const w = canvas.width || 0;
  const h = canvas.height || 0;
  if (!w || !h) return;
  const scale = Math.min(w, h) / CANVAS_SIZE;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const m = String(mode || 'sphere');
  if (m === 'box') {
    const face = UV_LAYOUT.box.face;
    const originX = UV_LAYOUT.box.originX;
    const originY = UV_LAYOUT.box.originY;
    const faceRect = (col, row) => ({ x: originX + col * face, y: originY + row * face, w: face, h: face });
    const faces = [
      { name: 'TOP',  ...faceRect(1, 0) },
      { name: 'LEFT', ...faceRect(0, 1) },
      { name: 'FRONT',...faceRect(1, 1) },
      { name: 'RIGHT',...faceRect(2, 1) },
      { name: 'BACK', ...faceRect(3, 1) },
      { name: 'BOT',  ...faceRect(1, 2) },
    ];
    ctx.fillStyle = th.faceFill;
    ctx.strokeStyle = th.faceStroke;
    ctx.lineWidth = 1;
    for (const f of faces) {
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeRect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
    }
    ctx.font = '700 12px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
    ctx.fillStyle = th.label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of faces) ctx.fillText(f.name, f.x + f.w / 2, f.y + f.h / 2);
  } else if (m === 'cylindrical') {
    const { wrapH, wrapY, wrapX, wrapW, capR: r, capTopY, capBottomY } = UV_LAYOUT.cylinder;
    const cx = CANVAS_SIZE / 2;
    ctx.fillStyle = th.faceFill;
    ctx.strokeStyle = th.faceStroke;
    ctx.lineWidth = 1;
    ctx.fillRect(wrapX, wrapY, wrapW, wrapH);
    ctx.strokeRect(wrapX + 1, wrapY + 1, wrapW - 2, wrapH - 2);
    ctx.beginPath(); ctx.arc(cx, capTopY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, capBottomY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = th.gridDash;
    for (let i = 1; i < 8; i++) {
      const x = wrapX + (i * wrapW) / 8;
      ctx.beginPath(); ctx.moveTo(x, wrapY); ctx.lineTo(x, wrapY + wrapH); ctx.stroke();
    }
    ctx.setLineDash([]);
  } else if (m === 'planar') {
    const pad = UV_LAYOUT.planar.pad;
    ctx.strokeStyle = th.faceStroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, CANVAS_SIZE - pad * 2, CANVAS_SIZE - pad * 2);
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = th.gridDash;
    for (let i = 1; i < 8; i++) {
      const x = (i * CANVAS_SIZE) / 8;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_SIZE); ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const y = (i * CANVAS_SIZE) / 8;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_SIZE, y); ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = th.gridDash;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (let i = 1; i < 16; i++) {
      const x = (i * CANVAS_SIZE) / 16;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_SIZE); ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      const y = (i * CANVAS_SIZE) / 8;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_SIZE, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = th.labelStrong;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, CANVAS_SIZE / 2); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, CANVAS_SIZE); ctx.stroke();
  }

  try {
    const isl = uvModePrimaryIsland({ mode: m, uvMode, UV_LAYOUT, CANVAS_SIZE });
    if (isl && isl.type === 'rect') {
      const ox = isl.x + 8;
      const oy = isl.y + 12;
      ctx.font = '700 11px "IBM Plex Sans", "Noto Sans Arabic", "Noto Sans Hebrew", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif';
      ctx.fillStyle = th.labelStrong;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('(0,0)', ox, oy);
      ctx.strokeStyle = th.labelStrong;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, oy + 4); ctx.lineTo(ox + 26, oy + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oy + 4); ctx.lineTo(ox, oy + 30); ctx.stroke();
    }
  } catch (_) {}

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = 'rgba(200,170,110,0.75)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.restore();
}

export function renderUvCompareNets(args) {
  const { document } = args || {};
  try { renderUvNetToCanvas({ ...args, canvas: document.getElementById('uvCompareSphere'), mode: 'sphere' }); } catch (_) {}
  try { renderUvNetToCanvas({ ...args, canvas: document.getElementById('uvCompareBox'), mode: 'box' }); } catch (_) {}
  try { renderUvNetToCanvas({ ...args, canvas: document.getElementById('uvComparePlanar'), mode: 'planar' }); } catch (_) {}
  try { renderUvNetToCanvas({ ...args, canvas: document.getElementById('uvCompareCyl'), mode: 'cylindrical' }); } catch (_) {}
}

export function applyCustomUvToGeometry(args) {
  const { geo, cu } = args || {};
  if (!geo || !cu || !cu.uv) return false;
  const uvAttr = geo.attributes && geo.attributes.uv ? geo.attributes.uv : null;
  if (!uvAttr || !uvAttr.count) return false;
  if (!Array.isArray(cu.uv)) return false;
  if (Number.isFinite(cu.count) && uvAttr.count !== cu.count) return false;
  if (cu.uv.length !== uvAttr.count * 2) return false;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setXY(i, cu.uv[i * 2], cu.uv[i * 2 + 1]);
  }
  uvAttr.needsUpdate = true;
  return true;
}

export function applyCustomUvToCurrentMesh(args) {
  const { part, currentMesh, uvMode, updateInfoForMesh } = args || {};
  if (!part || !currentMesh || !currentMesh.geometry) return false;
  const cu = part.customUv || null;
  if (!cu || !cu.uv || cu.mode !== uvMode) return false;
  const ok = applyCustomUvToGeometry({ geo: currentMesh.geometry, cu });
  if (ok) return true;
  const geo = currentMesh.geometry;
  if (geo && geo.index && typeof geo.toNonIndexed === 'function') {
    try {
      const nextGeo = geo.toNonIndexed();
      if (!nextGeo) return false;
      currentMesh.geometry = nextGeo;
      try { geo.dispose(); } catch (_) {}
      updateInfoForMesh(currentMesh);
      return applyCustomUvToGeometry({ geo: currentMesh.geometry, cu });
    } catch (_) {}
  }
  return false;
}
import { error as debugError, event as debugEvent } from '../debug/event-log.js';
