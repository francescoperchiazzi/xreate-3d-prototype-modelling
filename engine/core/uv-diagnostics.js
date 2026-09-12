export function computeUvTexelDensityRows(ctx) {
  const currentMesh = ctx?.currentMesh || null;
  const getIslandsForUvMode = ctx?.getIslandsForUvMode || (() => []);
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;

  if (!currentMesh || !currentMesh.geometry) return [];
  const geo = currentMesh.geometry;
  const posAttr = geo.attributes && geo.attributes.position ? geo.attributes.position : null;
  const uvAttr = geo.attributes && geo.attributes.uv ? geo.attributes.uv : null;
  if (!posAttr || !uvAttr || !uvAttr.count || !posAttr.count) return [];
  const idxAttr = geo.index || null;
  const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(uvAttr.count / 3);
  if (!triCount) return [];

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
  const islands = getIslandsForUvMode();
  const inside = (isl, x, y) => {
    if (!isl) return false;
    if (isl.type === 'rect') return x >= isl.x && x <= (isl.x + isl.w) && y >= isl.y && y <= (isl.y + isl.h);
    if (isl.type === 'circle') {
      const dx = x - isl.cx;
      const dy = y - isl.cy;
      return (dx * dx + dy * dy) <= (isl.r * isl.r);
    }
    return false;
  };
  const stats = new Map();
  for (const isl of islands) stats.set(isl.id, { id: isl.id, sum3d: 0, sumUv: 0, labelKey: isl.labelKey || null });
  const px = (u) => u * CANVAS_SIZE;
  const py = (v) => v * CANVAS_SIZE;

  for (let t = 0; t < triCount; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : (t * 3);
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : (t * 3 + 1);
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : (t * 3 + 2);
    const u0 = uvAttr.getX(i0), v0 = uvAttr.getY(i0);
    const u1 = uvAttr.getX(i1), v1 = uvAttr.getY(i1);
    const u2 = uvAttr.getX(i2), v2 = uvAttr.getY(i2);
    const cx = (px(u0) + px(u1) + px(u2)) / 3;
    const cy = (py(v0) + py(v1) + py(v2)) / 3;
    let islandId = islands.length ? islands[0].id : 'canvas';
    for (const isl of islands) {
      if (inside(isl, cx, cy)) {
        islandId = isl.id;
        break;
      }
    }
    const Auv = area2d(u0, v0, u1, v1, u2, v2) + eps;
    const A3d = area3d(
      posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0),
      posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1),
      posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2)
    ) + eps;
    const s = stats.get(islandId);
    if (!s) continue;
    s.sumUv += Auv;
    s.sum3d += A3d;
  }

  const rows = [];
  let mean = 0;
  let count = 0;
  for (const s of stats.values()) {
    if (s.sum3d <= 0) continue;
    const ratio = s.sumUv / (s.sum3d + eps);
    mean += ratio;
    count++;
    rows.push({ id: s.id, labelKey: s.labelKey || ('uv_island_' + s.id), ratio, factor: 1 });
  }
  if (!rows.length) return [];
  mean = mean / Math.max(1, count);
  for (const r of rows) r.factor = r.ratio / (mean || 1);
  rows.sort((a, b) => (b.factor - a.factor));
  return rows;
}

export const UVDiagnostics = { computeUvTexelDensityRows };
