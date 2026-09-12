// Read-only geometry metrics used by Shell panels. Keeping this independent of
// XR/window prevents UI code from becoming a second owner of mesh traversal.
export function getGeometryStats(ctx = {}) {
  const shapes = Array.isArray(ctx.shapes) ? ctx.shapes : [];
  const filter = (typeof ctx.filter === 'function') ? ctx.filter : null;
  let tris = 0;
  let verts = 0;
  for (const part of shapes) {
    if (filter && !filter(part)) continue;
    const geometry = part?._mesh?.geometry || null;
    const position = geometry?.attributes?.position || null;
    if (!position || typeof position.count !== 'number') continue;
    verts += position.count;
    tris += (geometry?.index && typeof geometry.index.count === 'number')
      ? geometry.index.count / 3
      : position.count / 3;
  }
  return { tris: tris | 0, verts: verts | 0 };
}
