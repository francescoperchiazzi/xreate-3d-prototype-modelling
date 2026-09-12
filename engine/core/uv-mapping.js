export function canonicalizeUvMode(mode) {
  const raw = String(mode || '').trim().toLowerCase();
  if (!raw) return 'cylindrical';
  if (raw === 'sphere' || raw === 'spherical' || raw === 'polar' || raw === 'spheremap') return 'sphere';
  if (raw === 'box' || raw === 'cubic' || raw === 'cube' || raw === 'cube_map' || raw === 'cubemap') return 'box';
  if (raw === 'planar' || raw === 'flat' || raw === 'plane' || raw === 'orthographic') return 'planar';
  if (raw === 'cylindrical' || raw === 'cylinder' || raw === 'cyl') return 'cylindrical';
  return 'cylindrical';
}

export function applyUvModeToGeometry(ctx) {
  const geo = ctx?.geo || null;
  const modeOverride = ctx?.modeOverride || null;
  const defaultMode = ctx?.defaultMode || 'sphere';
  const THREE = ctx?.THREE || null;
  const UV_LAYOUT = ctx?.uvLayout || null;
  const CANVAS_SIZE = Number(ctx?.canvasSize) || 1024;

  if (!geo || !THREE || !UV_LAYOUT || !geo.attributes || !geo.attributes.position) {
    debugEvent('uv.apply.skipped', { hasGeometry: !!geo, hasThree: !!THREE, hasLayout: !!UV_LAYOUT });
    return null;
  }

  const mode = canonicalizeUvMode(modeOverride || defaultMode);
  debugEvent('uv.apply.start', { mode, geometryType: geo.type || null, vertexCount: geo.attributes.position.count || 0 });

  const srcGeo = geo;
  // toNonIndexed() returns a generic BufferGeometry. Preserve the source
  // archetype so a later mode switch can still restore native Sphere UVs.
  const sourceGeometryType = srcGeo?.userData?.xrUvSourceGeometryType || srcGeo?.type || '';
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g) {
    g.userData = g.userData || {};
    if (!g.userData.xrUvSourceGeometryType && sourceGeometryType) {
      g.userData.xrUvSourceGeometryType = sourceGeometryType;
    }
  }
  if (g !== srcGeo) g.computeVertexNormals();

  const pos = g.attributes.position;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const min = bb.min;
  const max = bb.max;
  const sx = Math.max(1e-6, max.x - min.x);
  const sy = Math.max(1e-6, max.y - min.y);
  const sz = Math.max(1e-6, max.z - min.z);

  const twoPi = Math.PI * 2;
  const uv = new Float32Array(pos.count * 2);

  const boxFace = UV_LAYOUT.box.face / CANVAS_SIZE;
  const boxV0 = UV_LAYOUT.box.originY / CANVAS_SIZE;
  function boxRect(col, row) {
    return { u0: col * boxFace, v0: boxV0 + row * boxFace, uw: boxFace, vh: boxFace };
  }
  function rectMap(rect, u0, v0) {
    return {
      u: rect.u0 + u0 * rect.uw,
      v: rect.v0 + v0 * rect.vh,
    };
  }

  const cyl = UV_LAYOUT.cylinder.norm;
  const cylWrapX = cyl.wrapX;
  const cylWrapW = cyl.wrapW;
  const cylWrapY = cyl.wrapY;
  const cylWrapH = cyl.wrapH;
  const cylR = cyl.capR;
  const cylCapTop = { u: 0.5, v: cyl.capTopV };
  const cylCapBottom = { u: 0.5, v: cyl.capBottomV };

  const planePad = UV_LAYOUT.planar.pad / CANVAS_SIZE;
  const planeRect = { u0: planePad, v0: planePad, uw: 1 - planePad * 2, vh: 1 - planePad * 2 };

  if (mode === 'sphere') {
    if (srcGeo && srcGeo.attributes && srcGeo.attributes.uv && sourceGeometryType === 'SphereGeometry') {
      debugEvent('uv.apply.success', { mode, geometryType: g.type || null, preservedNativeUv: true });
      return g;
    }
    if (srcGeo && srcGeo.type === 'DomeGeometry' && srcGeo.userData && srcGeo.userData.baseUv && g.attributes && g.attributes.uv && g.attributes.uv.array) {
      const baseUv = srcGeo.userData.baseUv;
      if (baseUv && baseUv.length === g.attributes.uv.array.length) {
        g.attributes.uv.array.set(baseUv);
        g.attributes.uv.needsUpdate = true;
        debugEvent('uv.apply.success', { mode, geometryType: g.type || null, preservedNativeUv: true });
        return g;
      }
    }
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.copy(v).normalize();
      const u0 = 0.5 + Math.atan2(n.z, n.x) / twoPi;
      const v0 = 0.5 - Math.asin(Math.max(-1, Math.min(1, n.y))) / Math.PI;
      uv[i * 2] = ((u0 % 1) + 1) % 1;
      uv[i * 2 + 1] = Math.max(0, Math.min(1, v0));
    }
  } else if (mode === 'planar') {
    const v = new THREE.Vector3();
    const useXY = sz <= sx && sz <= sy;
    const useXZ = !useXY && sy <= sx && sy <= sz;
    const useZY = !useXY && !useXZ;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      let u0 = 0;
      let v0 = 0;
      if (useXY) {
        u0 = (v.x - min.x) / sx;
        v0 = (v.y - min.y) / sy;
      } else if (useXZ) {
        u0 = (v.x - min.x) / sx;
        v0 = 1 - (v.z - min.z) / sz;
      } else {
        u0 = (v.z - min.z) / sz;
        v0 = 1 - (v.y - min.y) / sy;
      }
      const out = rectMap(planeRect, Math.max(0, Math.min(1, u0)), Math.max(0, Math.min(1, v0)));
      uv[i * 2] = out.u;
      uv[i * 2 + 1] = out.v;
    }
  } else if (mode === 'cylindrical') {
    const cy = (min.y + max.y) * 0.5;
    const cx = (min.x + max.x) * 0.5;
    const cz = (min.z + max.z) * 0.5;
    const rx = sx * 0.5;
    const rz = sz * 0.5;
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const fn = new THREE.Vector3();

    function setCapUv(i, vx, vy, vz, isTop) {
      let u0 = 0.5 + (vx - cx) / Math.max(1e-6, rx * 2);
      let v0 = 0.5 - (vz - cz) / Math.max(1e-6, rz * 2);
      if (isTop) {
        const ur = v0;
        const vr = 1 - u0;
        u0 = ur;
        v0 = vr;
      } else {
        const ur = 1 - v0;
        const vr = u0;
        u0 = ur;
        v0 = vr;
      }
      // CanvasTexture samples V in the inverse direction of the authoring
      // canvas. Map geometry's physical top to the bottom-island UV
      // coordinate so it renders the island labelled “Cap (top)”, and vice
      // versa for the physical bottom. The overlay stays in authoring order.
      const cap = isTop ? cylCapBottom : cylCapTop;
      const u = cap.u + (u0 - 0.5) * (cylR * 2);
      const vv = cap.v + (v0 - 0.5) * (cylR * 2);
      uv[i * 2] = Math.max(0, Math.min(1, u));
      uv[i * 2 + 1] = Math.max(0, Math.min(1, vv));
    }

    function setSideUv(i, vx, vy, vz, uAdj) {
      const uRaw = typeof uAdj === 'number' ? uAdj : (1 - (0.5 + Math.atan2(vz - cz, vx - cx) / twoPi));
      const u0 = uRaw;
      const v0 = (vy - min.y) / sy;
      const uf = Math.max(0, Math.min(1, u0));
      uv[i * 2] = cylWrapX + uf * cylWrapW;
      uv[i * 2 + 1] = cylWrapY + Math.max(0, Math.min(1, v0)) * cylWrapH;
    }

    const maxDim = Math.max(sx, sy, sz);
    const epsCap = maxDim * 1e-3;
    const allowCaps = !!(srcGeo && (
      srcGeo.type === 'CylinderGeometry' ||
      srcGeo.type === 'ConeGeometry' ||
      (srcGeo.userData && srcGeo.userData.allowCylCaps)
    ));
    for (let i = 0; i < pos.count; i += 3) {
      p0.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      p1.set(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      p2.set(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      e1.subVectors(p1, p0);
      e2.subVectors(p2, p0);
      fn.crossVectors(e1, e2).normalize();

      const nearTop = allowCaps
        && Math.abs(p0.y - max.y) < epsCap
        && Math.abs(p1.y - max.y) < epsCap
        && Math.abs(p2.y - max.y) < epsCap;
      const nearBottom = allowCaps
        && Math.abs(p0.y - min.y) < epsCap
        && Math.abs(p1.y - min.y) < epsCap
        && Math.abs(p2.y - min.y) < epsCap;
      const isCapTri = (nearTop || nearBottom) && Math.abs(fn.y) > 0.6;
      if (isCapTri) {
        const isTop = nearTop && !nearBottom ? true : (nearBottom && !nearTop ? false : ((p0.y + p1.y + p2.y) / 3 >= cy));
        setCapUv(i, p0.x, p0.y, p0.z, isTop);
        setCapUv(i + 1, p1.x, p1.y, p1.z, isTop);
        setCapUv(i + 2, p2.x, p2.y, p2.z, isTop);
        continue;
      }

      const uA = ((1 - (0.5 + Math.atan2(p0.z - cz, p0.x - cx) / twoPi)) % 1 + 1) % 1;
      const uB = ((1 - (0.5 + Math.atan2(p1.z - cz, p1.x - cx) / twoPi)) % 1 + 1) % 1;
      const uC = ((1 - (0.5 + Math.atan2(p2.z - cz, p2.x - cx) / twoPi)) % 1 + 1) % 1;
      const uMin = Math.min(uA, uB, uC);
      const uMax = Math.max(uA, uB, uC);

      let ua = uA, ub = uB, uc = uC;
      if ((uMax - uMin) > 0.5) {
        const hiA = uA >= 0.5, hiB = uB >= 0.5, hiC = uC >= 0.5;
        const hiCount = (hiA ? 1 : 0) + (hiB ? 1 : 0) + (hiC ? 1 : 0);
        if (hiCount >= 2) {
          if (!hiA) ua = 1;
          if (!hiB) ub = 1;
          if (!hiC) uc = 1;
        } else {
          if (hiA) ua = 0;
          if (hiB) ub = 0;
          if (hiC) uc = 0;
        }
      }

      setSideUv(i, p0.x, p0.y, p0.z, ua);
      setSideUv(i + 1, p1.x, p1.y, p1.z, ub);
      setSideUv(i + 2, p2.x, p2.y, p2.z, uc);
    }
  } else if (mode === 'box') {
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const fn = new THREE.Vector3();
    const v = new THREE.Vector3();
    const nor = g.getAttribute('normal');
    const c = new THREE.Vector3();
    const maxDim = Math.max(sx, sy, sz);
    const epsPlane = maxDim * 1e-3;

    const faceRects = {
      // CanvasTexture's vertical orientation means the displayed top row is
      // sampled through the lower V row on a horizontal upward-facing mesh.
      // Keep the net labels unchanged; swap only the two horizontal faces.
      top: boxRect(1, 2),
      // The authored atlas reads BACK, LEFT, FRONT, RIGHT from left to right.
      left: boxRect(1, 1),
      front: boxRect(2, 1),
      right: boxRect(3, 1),
      back: boxRect(0, 1),
      bottom: boxRect(1, 0),
    };
    function faceIdFromNormal(nx, ny, nz) {
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      if (ay >= ax && ay >= az) return ny >= 0 ? 'top' : 'bottom';
      if (az >= ax && az >= ay) return nz >= 0 ? 'front' : 'back';
      return nx >= 0 ? 'right' : 'left';
    }
    function faceUvForVertex(faceId, vx, vy, vz) {
      let u0 = 0;
      let v0 = 0;
      if (faceId === 'front' || faceId === 'back') {
        u0 = (vx - min.x) / sx;
        v0 = (vy - min.y) / sy;
        if (faceId === 'back') u0 = 1 - u0;
      } else if (faceId === 'left' || faceId === 'right') {
        u0 = (vz - min.z) / sz;
        v0 = (vy - min.y) / sy;
        if (faceId === 'right') u0 = 1 - u0;
      } else if (faceId === 'top' || faceId === 'bottom') {
        u0 = (vx - min.x) / sx;
        v0 = (vz - min.z) / sz;
        if (faceId === 'top') v0 = 1 - v0;
      }
      const rect = faceRects[faceId];
      return rectMap(rect, Math.max(0, Math.min(1, u0)), Math.max(0, Math.min(1, v0)));
    }

    for (let i = 0; i < pos.count; i += 3) {
      p0.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      p1.set(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      p2.set(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      c.set(
        (p0.x + p1.x + p2.x) / 3,
        (p0.y + p1.y + p2.y) / 3,
        (p0.z + p1.z + p2.z) / 3
      );

      const dTop = Math.abs(c.y - max.y);
      const dBottom = Math.abs(c.y - min.y);
      const dRight = Math.abs(c.x - max.x);
      const dLeft = Math.abs(c.x - min.x);
      const dFront = Math.abs(c.z - max.z);
      const dBack = Math.abs(c.z - min.z);

      let fid = 'top';
      let dMin = dTop;
      if (dBottom < dMin) { dMin = dBottom; fid = 'bottom'; }
      if (dRight < dMin) { dMin = dRight; fid = 'right'; }
      if (dLeft < dMin) { dMin = dLeft; fid = 'left'; }
      if (dFront < dMin) { dMin = dFront; fid = 'front'; }
      if (dBack < dMin) { dMin = dBack; fid = 'back'; }

      if (dMin > epsPlane) {
        if (nor) {
          fn.set(
            (nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2)) / 3,
            (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3,
            (nor.getZ(i) + nor.getZ(i + 1) + nor.getZ(i + 2)) / 3
          ).normalize();
        } else {
          e1.subVectors(p1, p0);
          e2.subVectors(p2, p0);
          fn.crossVectors(e1, e2).normalize();
        }
        fid = faceIdFromNormal(fn.x, fn.y, fn.z);
      }

      let out = faceUvForVertex(fid, p0.x, p0.y, p0.z);
      uv[i * 2] = out.u;
      uv[i * 2 + 1] = out.v;
      out = faceUvForVertex(fid, p1.x, p1.y, p1.z);
      uv[(i + 1) * 2] = out.u;
      uv[(i + 1) * 2 + 1] = out.v;
      out = faceUvForVertex(fid, p2.x, p2.y, p2.z);
      uv[(i + 2) * 2] = out.u;
      uv[(i + 2) * 2 + 1] = out.v;
    }
  }

  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.attributes.uv.needsUpdate = true;
  debugEvent('uv.apply.success', { mode, geometryType: g.type || null, vertexCount: g.attributes.position?.count || 0 });
  return g;
}

// This facade is consumed by the legacy bridge as well as modern modules.
// Keep normalization and application together: exporting only the latter
// silently turned "sphere" into the bridge's cylindrical fallback.
export const UVMapping = { canonicalizeUvMode, applyUvModeToGeometry };
import { event as debugEvent } from '../debug/event-log.js';
