function buildDome(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 1.0;
  const ws = (typeof p.widthSegments === 'number') ? p.widthSegments : 48;
  const hs = (typeof p.heightSegments === 'number') ? p.heightSegments : 24;
  const hemi = new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2);
  const posAttr = hemi.attributes && hemi.attributes.position ? hemi.attributes.position : null;
  if (!posAttr || !posAttr.count) return hemi;
  const norAttr = hemi.attributes && hemi.attributes.normal ? hemi.attributes.normal : null;
  const uvAttr = hemi.attributes && hemi.attributes.uv ? hemi.attributes.uv : null;
  const hemiPos = posAttr.array;
  const hemiNor = norAttr ? norAttr.array : null;
  const hemiUv = uvAttr ? uvAttr.array : null;
  const hemiVertCount = posAttr.count;

  const capSeg = Math.max(3, ws | 0);
  const capVertCount = 1 + capSeg;
  const outPos = new Float32Array((hemiVertCount + capVertCount) * 3);
  const outNor = new Float32Array((hemiVertCount + capVertCount) * 3);
  const outUv = new Float32Array((hemiVertCount + capVertCount) * 2);

  outPos.set(hemiPos, 0);
  if (hemiNor) outNor.set(hemiNor, 0);
  if (hemiUv) outUv.set(hemiUv, 0);

  const baseVert = hemiVertCount;
  const centerI = baseVert;
  const ringStart = baseVert + 1;
  outPos[centerI * 3 + 0] = 0;
  outPos[centerI * 3 + 1] = 0;
  outPos[centerI * 3 + 2] = 0;
  outNor[centerI * 3 + 0] = 0;
  outNor[centerI * 3 + 1] = -1;
  outNor[centerI * 3 + 2] = 0;
  outUv[centerI * 2 + 0] = 0.5;
  outUv[centerI * 2 + 1] = 0.5;

  const denom = Math.max(1e-6, r * 2);
  for (let i = 0; i < capSeg; i++) {
    const a = (i / capSeg) * (Math.PI * 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const vi = ringStart + i;
    outPos[vi * 3 + 0] = x;
    outPos[vi * 3 + 1] = 0;
    outPos[vi * 3 + 2] = z;
    outNor[vi * 3 + 0] = 0;
    outNor[vi * 3 + 1] = -1;
    outNor[vi * 3 + 2] = 0;
    outUv[vi * 2 + 0] = 0.5 + (x / denom);
    outUv[vi * 2 + 1] = 0.5 - (z / denom);
  }

  const idxAttr = hemi.index ? hemi.index.array : null;
  const outIdx = [];
  if (idxAttr && idxAttr.length) {
    for (let i = 0; i < idxAttr.length; i++) outIdx.push(idxAttr[i] | 0);
  } else {
    for (let i = 0; i < hemiVertCount; i++) outIdx.push(i);
  }
  for (let i = 0; i < capSeg; i++) {
    const a = ringStart + i;
    const b = ringStart + ((i + 1) % capSeg);
    outIdx.push(centerI, b, a);
  }

  const g0 = new THREE.BufferGeometry();
  g0.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  g0.setAttribute('normal', new THREE.Float32BufferAttribute(outNor, 3));
  g0.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
  g0.setIndex(outIdx);
  g0.computeVertexNormals();
  const g = (g0.index && typeof g0.toNonIndexed === 'function') ? g0.toNonIndexed() : g0;
  if (g !== g0) { try { g0.dispose(); } catch (_) {} }
  g.type = 'DomeGeometry';
  if (!g.userData) g.userData = {};
  if (g.attributes && g.attributes.uv && g.attributes.uv.array) {
    g.userData.baseUv = new Float32Array(g.attributes.uv.array);
  }
  g.computeVertexNormals();
  return g;
}

function buildHemiOpen(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 1.0;
  const ws = (typeof p.widthSegments === 'number') ? p.widthSegments : 48;
  const hs = (typeof p.heightSegments === 'number') ? p.heightSegments : 24;
  return new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2);
}

function buildRod(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 0.08;
  const h = (typeof p.height === 'number') ? p.height : 2.2;
  const seg = (typeof p.segments === 'number') ? p.segments : 24;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 1;
  const openEnded = !!p.openEnded;
  return new THREE.CylinderGeometry(r, r, h, seg, segH, openEnded);
}

function buildCapsule(params) {
  const pts = [];
  const p = params || {};
  const R = (typeof p.radius === 'number') ? p.radius : 0.5;
  const H = (typeof p.halfHeight === 'number') ? p.halfHeight : 0.5;
  const segsArc = (typeof p.arcSegments === 'number') ? p.arcSegments : 16;
  const segsLine = 6;
  const segsLathe = (typeof p.latheSegments === 'number') ? p.latheSegments : 48;
  for (let i = 0; i <= segsArc; i++) {
    const a = (i / segsArc) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(R * Math.sin(a), H + R * Math.cos(a)));
  }
  for (let i = 1; i < segsLine; i++) {
    const t = i / segsLine;
    pts.push(new THREE.Vector2(R, H - t * (H * 2)));
  }
  for (let i = 0; i <= segsArc; i++) {
    const a = (i / segsArc) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(R * Math.cos(a), -H - R * Math.sin(a)));
  }
  const geo = new THREE.LatheGeometry(pts, segsLathe);
  try {
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const center = new THREE.Vector3();
    geo.boundingBox.getCenter(center);
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const d = new THREE.Vector3();
    let sum = 0;
    const step = Math.max(1, Math.floor(pos.count / 128));
    for (let i = 0; i < pos.count; i += step) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      d.subVectors(v, center);
      sum += n.dot(d);
    }
    if (sum < 0) {
      if (geo.index && geo.index.array && geo.index.array.length) {
        const idx = geo.index.array;
        for (let i = 0; i < idx.length; i += 3) {
          const b = idx[i + 1];
          idx[i + 1] = idx[i + 2];
          idx[i + 2] = b;
        }
        geo.index.needsUpdate = true;
      } else if (pos && pos.count >= 3) {
        const swap = (attr, a, b) => {
          if (!attr) return;
          const itemSize = attr.itemSize || 1;
          for (let k = 0; k < itemSize; k++) {
            const ia = a * itemSize + k;
            const ib = b * itemSize + k;
            const t = attr.array[ia];
            attr.array[ia] = attr.array[ib];
            attr.array[ib] = t;
          }
          attr.needsUpdate = true;
        };
        const uv = geo.getAttribute('uv');
        for (let i = 0; i < pos.count; i += 3) {
          swap(pos, i + 1, i + 2);
          swap(nor, i + 1, i + 2);
          swap(uv, i + 1, i + 2);
        }
      }
      geo.computeVertexNormals();
    }
  } catch (_) {}
  return geo;
}

function buildTriPrism(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 0.9;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 2;
  return new THREE.CylinderGeometry(r, r, h, 3, segH, false);
}

function buildFrustum(params) {
  const p = params || {};
  const rt = (typeof p.radiusTop === 'number') ? p.radiusTop : 0.5;
  const rb = (typeof p.radiusBottom === 'number') ? p.radiusBottom : 0.9;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const seg = (typeof p.segments === 'number') ? p.segments : 48;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 8;
  const openEnded = !!p.openEnded;
  return new THREE.CylinderGeometry(rt, rb, h, seg, segH, openEnded);
}

function buildPyramidFrustum(params) {
  const p = params || {};
  const rt = (typeof p.radiusTop === 'number') ? p.radiusTop : 0.6;
  const rb = (typeof p.radiusBottom === 'number') ? p.radiusBottom : 1.0;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 6;
  const openEnded = !!p.openEnded;
  return new THREE.CylinderGeometry(rt, rb, h, 4, segH, openEnded);
}

function buildWedge(params) {
  const p = params || {};
  const w = (typeof p.width === 'number') ? p.width : 2.0;
  const h = (typeof p.height === 'number') ? p.height : 1.2;
  const d = (typeof p.depth === 'number') ? p.depth : 2.0;
  const tip = (typeof p.tip === 'number') ? Math.max(0, Math.min(1, p.tip)) : 0.12;
  const y0 = -h / 2;
  const y2 = h / 2;
  const y1 = y0 + h * tip;
  const xL = -w / 2;
  const xR = w / 2;
  const zF = d / 2;
  const zB = -d / 2;
  const vertices = new Float32Array([
    xL, y0, zF,
    xR, y0, zF,
    xL, y0, zB,
    xR, y0, zB,
    xL, y2, zB,
    xR, y2, zB,
    xL, y1, zF,
    xR, y1, zF,
  ]);
  const indices = [
    0, 1, 7, 0, 7, 6,
    2, 4, 5, 2, 5, 3,
    0, 6, 4, 0, 4, 2,
    1, 3, 5, 1, 5, 7,
    0, 2, 3, 0, 3, 1,
    6, 7, 5, 6, 5, 4,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.center();
  return g;
}

function buildArcCylinder(params) {
  const p = params || {};
  const tube = (typeof p.tubeRadius === 'number') ? p.tubeRadius : 0.25;
  const bend = (typeof p.bendRadius === 'number') ? p.bendRadius : 1.0;
  const arcDeg = (typeof p.arcDegrees === 'number') ? p.arcDegrees : 120;
  const arc = Math.max(0.05, Math.min(Math.PI * 2, (arcDeg * Math.PI) / 180));
  const radSeg = (typeof p.radialSegments === 'number') ? p.radialSegments : 18;
  const tubSeg = (typeof p.tubularSegments === 'number') ? p.tubularSegments : 64;
  const steps = Math.max(6, Math.min(512, tubSeg | 0));
  const seg = Math.max(6, Math.min(256, radSeg | 0));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * arc;
    pts.push(new THREE.Vector3(Math.cos(a) * bend, 0, Math.sin(a) * bend));
  }
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const shape = new THREE.Shape();
  shape.moveTo(tube, 0);
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI * 2);
    shape.lineTo(Math.cos(a) * tube, Math.sin(a) * tube);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: path });
  g.center();
  g.computeVertexNormals();
  return g;
}

function buildRodArcFixed(arcDegrees, params) {
  const p = params || {};
  return buildArcCylinder({ ...p, arcDegrees });
}

function buildRodArc15(params) { return buildRodArcFixed(15, params); }
function buildRodArc30(params) { return buildRodArcFixed(30, params); }
function buildRodArc45(params) { return buildRodArcFixed(45, params); }

function buildCurvedBox(params) {
  const p = params || {};
  const w = (typeof p.width === 'number') ? p.width : 0.8;
  const h = (typeof p.height === 'number') ? p.height : 0.5;
  const bend = (typeof p.bendRadius === 'number') ? p.bendRadius : 1.2;
  const arcDeg = (typeof p.arcDegrees === 'number') ? p.arcDegrees : 100;
  const steps = (typeof p.steps === 'number') ? p.steps : 48;
  const arc = Math.max(0.05, Math.min(Math.PI * 2, (arcDeg * Math.PI) / 180));
  const pts = [];
  const seg = Math.max(6, Math.min(256, steps | 0));
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = -arc / 2 + t * arc;
    pts.push(new THREE.Vector3(Math.cos(a) * bend, 0, Math.sin(a) * bend));
  }
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { steps: seg, bevelEnabled: false, extrudePath: path });
  g.center();
  g.computeVertexNormals();
  return g;
}

function buildEllipsoid(params) {
  const p = params || {};
  const rx = (typeof p.radiusX === 'number') ? p.radiusX : 1.0;
  const ry = (typeof p.radiusY === 'number') ? p.radiusY : 0.75;
  const rz = (typeof p.radiusZ === 'number') ? p.radiusZ : 1.25;
  const ws = (typeof p.widthSegments === 'number') ? p.widthSegments : 64;
  const hs = (typeof p.heightSegments === 'number') ? p.heightSegments : 32;
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  g.computeVertexNormals();
  return g;
}

function buildHexPrism(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 0.9;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 6;
  return new THREE.CylinderGeometry(r, r, h, 6, segH, false);
}

function buildDoodleFromPoints(points, params) {
  if (!points || points.length < 3) {
    console.warn('[doodle-builder] insufficient polygon points', { pointCount: points?.length || 0 });
    return null;
  }
  const depth = (params && Number.isFinite(params.depth) && params.depth > 0) ? params.depth : 0.5;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const pts = [];
  const eps2 = 0.5 * 0.5;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = Number(p && p.x);
    const y = Number(p && p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const prev = pts.length ? pts[pts.length - 1] : null;
    if (prev) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      if ((dx * dx + dy * dy) <= eps2) continue;
    }
    pts.push({ x, y });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (pts.length < 3) {
    console.warn('[doodle-builder] polygon points collapsed during normalization', { pointCount: points.length, usablePointCount: pts.length });
    return null;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const norm = 1.0 / span;

  const npts = pts.map((p) => ({ x: (p.x - cx) * norm, y: -(p.y - cy) * norm }));
  let area2 = 0;
  for (let i = 0; i < npts.length; i++) {
    const a = npts[i];
    const b = npts[(i + 1) % npts.length];
    area2 += (a.x * b.y) - (b.x * a.y);
  }
  if (area2 < 0) npts.reverse();

  const pointToSegDistSq = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-12) {
      const px = p.x - a.x;
      const py = p.y - a.y;
      return px * px + py * py;
    }
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const ex = a.x + t * dx;
    const ey = a.y + t * dy;
    const rx = p.x - ex;
    const ry = p.y - ey;
    return rx * rx + ry * ry;
  };
  const rdp = (arr, epsSq) => {
    if (!arr || arr.length < 3) return arr || [];
    const end = arr.length - 1;
    let maxD = 0;
    let idx = -1;
    for (let i = 1; i < end; i++) {
      const d = pointToSegDistSq(arr[i], arr[0], arr[end]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx >= 0 && maxD > epsSq) {
      const left = rdp(arr.slice(0, idx + 1), epsSq);
      const right = rdp(arr.slice(idx), epsSq);
      return left.slice(0, -1).concat(right);
    }
    return [arr[0], arr[end]];
  };
  const simplified = (npts.length > 8) ? rdp(npts, 0.005 * 0.005) : npts;
  if (!simplified || simplified.length < 3) {
    console.warn('[doodle-builder] polygon simplification removed the shape', { pointCount: pts.length, simplifiedPointCount: simplified?.length || 0 });
    return null;
  }

  const shape = new THREE.Shape();
  shape.moveTo(simplified[0].x, simplified[0].y);
  for (let i = 1; i < simplified.length; i++) shape.lineTo(simplified[i].x, simplified[i].y);
  shape.closePath();

  const extrudeSettings = { steps: 1, depth, bevelEnabled: false };
  let geo;
  try {
    geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  } catch (e) {
    try { console.warn('[XReate] ExtrudeGeometry failed', e); } catch (_) {}
    return null;
  }
  const nonIndexed = (geo && geo.index && typeof geo.toNonIndexed === 'function') ? geo.toNonIndexed() : geo;
  if (nonIndexed !== geo) {
    try { geo.dispose(); } catch (_) {}
    geo = nonIndexed;
  }
  try { geo.translate(0, 0, -depth / 2); } catch (_) {}
  try { geo.computeVertexNormals(); } catch (_) {}
  return geo;
}

function buildDoodleRevolveFromPoints(points, params) {
  if (!points || points.length < 2) return null;
  const p = params || {};
  const seg = (Number.isFinite(p.segments) ? Math.round(p.segments) : 64);
  const segments = Math.max(12, Math.min(128, seg));

  const pts = [];
  const eps2 = 0.5 * 0.5;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const x = Number(pt && pt.x);
    const y = Number(pt && pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const r = Math.max(0, -x);
    const prev = pts.length ? pts[pts.length - 1] : null;
    if (prev) {
      const dr = r - prev.r;
      const dy = y - prev.y;
      if ((dr * dr + dy * dy) <= eps2) continue;
    }
    pts.push({ r, y });
  }
  if (pts.length < 2) return null;

  // LatheGeometry expects the profile from its lower Y extent to its upper
  // Y extent for outward-facing triangle winding. Canvas Y grows downward and
  // the following conversion flips it, so the authored points must arrive in
  // descending canvas-Y order. The previous condition did the opposite and
  // made every Revolve Doodle an inside-out shell.
  if (pts[0].y < pts[pts.length - 1].y) pts.reverse();

  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const y = pts[i].y;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const capEps = 1e-4;
  if (pts[0].r > capEps) pts.unshift({ r: 0, y: pts[0].y });
  if (pts[pts.length - 1].r > capEps) pts.push({ r: 0, y: pts[pts.length - 1].y });

  const ySpan = (maxY - minY) || 1;
  const cy = (minY + maxY) / 2;
  const halfH = Math.max(1e-6, ySpan / 2);

  const profile = [];
  for (const pt of pts) {
    const yy = -((pt.y - cy) / halfH);
    const rr = pt.r / halfH;
    profile.push(new THREE.Vector2(rr, yy));
  }

  let geo0;
  try {
    geo0 = new THREE.LatheGeometry(profile, segments);
  } catch (e) {
    try { console.warn('[XReate] LatheGeometry failed', e); } catch (_) {}
    return null;
  }

  const base = (geo0 && geo0.index && typeof geo0.toNonIndexed === 'function') ? geo0.toNonIndexed() : geo0;
  if (base !== geo0) {
    try { geo0.dispose(); } catch (_) {}
  }
  // Cylindrical UV projection needs to know that this generic, non-indexed
  // LatheGeometry has real end caps. Without this marker the mapper treats
  // the cap triangles as part of the wrap, leaving no selectable top/bottom
  // islands after a Revolve Doodle is created.
  if (base) {
    base.userData = base.userData || {};
    base.userData.allowCylCaps = true;
    base.userData.xrUvSourceGeometryType = 'LatheGeometry';
  }
  try { base.computeVertexNormals(); } catch (_) {}
  try { base.computeBoundingBox(); } catch (_) {}
  try { base.computeBoundingSphere(); } catch (_) {}
  return base;
}

// A bilateral Doodle is a single silhouette. The author traces its left outer
// contour from the symmetry axis to the symmetry axis; we close that contour
// through the axis and append the reflected right contour before extrusion.
// Building one outline (rather than merging two separately extruded islands)
// gives the expected continuous body and preserves face orientation.
function buildDoodleMirrorFromPoints(points, params) {
  const left = (Array.isArray(points) ? points : [])
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: -Math.abs(point.x), y: point.y }));
  if (left.length < 3) return null;
  const start = left[0];
  const end = left[left.length - 1];
  const right = left.slice().reverse().map((point) => ({ x: -point.x, y: point.y }));
  const silhouette = [
    { x: 0, y: start.y },
    ...left,
    { x: 0, y: end.y },
    ...right,
  ];
  return buildDoodleFromPoints(silhouette, params);
}

export {
  buildDome,
  buildHemiOpen,
  buildRod,
  buildCapsule,
  buildTriPrism,
  buildFrustum,
  buildPyramidFrustum,
  buildWedge,
  buildArcCylinder,
  buildRodArc15,
  buildRodArc30,
  buildRodArc45,
  buildCurvedBox,
  buildEllipsoid,
  buildHexPrism,
  buildDoodleFromPoints,
  buildDoodleMirrorFromPoints,
  buildDoodleRevolveFromPoints
};
