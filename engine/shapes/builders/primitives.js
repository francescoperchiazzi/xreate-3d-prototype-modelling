function buildSphere(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 1.0;
  const ws = (typeof p.widthSegments === 'number') ? p.widthSegments : 64;
  const hs = (typeof p.heightSegments === 'number') ? p.heightSegments : 32;
  return new THREE.SphereGeometry(r, ws, hs);
}

function buildCube(params) {
  const p = params || {};
  const s = (typeof p.size === 'number') ? p.size : 1.0;
  const seg = (typeof p.segments === 'number') ? p.segments : 4;
  return new THREE.BoxGeometry(s, s, s, seg, seg, seg);
}

function buildBox(params) {
  const p = params || {};
  const w = (typeof p.width === 'number') ? p.width : 1.0;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const d = (typeof p.depth === 'number') ? p.depth : 2.4;
  const seg = (typeof p.segments === 'number') ? p.segments : 4;
  const taperTop = (typeof p.taperTop === 'number') ? p.taperTop : 1.0;
  const taperBottom = (typeof p.taperBottom === 'number') ? p.taperBottom : 1.0;
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const eps = 1e-5;
  if (Math.abs(taperTop - 1.0) > eps || Math.abs(taperBottom - 1.0) > eps) {
    const pos = g.attributes.position;
    const arr = pos.array;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = arr[i * 3 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const denom = Math.max(1e-6, maxY - minY);
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = arr[ix + 0];
      const y = arr[ix + 1];
      const z = arr[ix + 2];
      const t = (y - minY) / denom;
      const s = (taperBottom * (1 - t)) + (taperTop * t);
      arr[ix + 0] = x * s;
      arr[ix + 2] = z * s;
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

function buildCylinder(params) {
  const p = params || {};
  const rt = (typeof p.radiusTop === 'number') ? p.radiusTop : 0.8;
  const rb = (typeof p.radiusBottom === 'number') ? p.radiusBottom : 0.8;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const seg = (typeof p.segments === 'number') ? p.segments : 48;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 8;
  const openEnded = !!p.openEnded;
  return new THREE.CylinderGeometry(rt, rb, h, seg, segH, openEnded);
}

function buildCone(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 0.9;
  const h = (typeof p.height === 'number') ? p.height : 1.8;
  const seg = (typeof p.segments === 'number') ? p.segments : 48;
  const segH = (typeof p.heightSegments === 'number') ? p.heightSegments : 8;
  return new THREE.ConeGeometry(r, h, seg, segH);
}

function buildTorus(params) {
  const p = params || {};
  const r = (typeof p.radius === 'number') ? p.radius : 0.8;
  const tube = (typeof p.tube === 'number') ? p.tube : 0.35;
  const radSeg = (typeof p.radialSegments === 'number') ? p.radialSegments : 24;
  const tubeSeg = (typeof p.tubularSegments === 'number') ? p.tubularSegments : 64;
  return new THREE.TorusGeometry(r, tube, radSeg, tubeSeg);
}

function buildPlane(params) {
  const p = params || {};
  const w = (typeof p.width === 'number') ? p.width : 2.0;
  const h = (typeof p.height === 'number') ? p.height : 2.0;
  const seg = (typeof p.segments === 'number') ? p.segments : 16;
  return new THREE.PlaneGeometry(w, h, seg, seg);
}

export {
  buildSphere,
  buildCube,
  buildBox,
  buildCylinder,
  buildCone,
  buildTorus,
  buildPlane
};
