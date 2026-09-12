import { buildZip } from './zip-store.js';

let lastUsdDebug = null;
let lastZipReport = null;
let debugRuntime = null;

export function configureDebugRuntime(nextRuntime) {
  debugRuntime = (nextRuntime && typeof nextRuntime === 'object') ? nextRuntime : null;
}

function align4(n) {
  return Math.ceil(n / 4) * 4;
}

function canvasToJpegBytes(canvas, quality) {
  const texDataURL = canvas.toDataURL('image/jpeg', quality);
  const texBase64 = texDataURL.split(',')[1];
  const texBinary = atob(texBase64);
  const texArr = new Uint8Array(texBinary.length);
  for (let i = 0; i < texBinary.length; i++) texArr[i] = texBinary.charCodeAt(i);
  return texArr;
}

function canvasToPngBytes(canvas) {
  const texDataURL = canvas.toDataURL('image/png');
  const texBase64 = texDataURL.split(',')[1];
  const texBinary = atob(texBase64);
  const texArr = new Uint8Array(texBinary.length);
  for (let i = 0; i < texBinary.length; i++) texArr[i] = texBinary.charCodeAt(i);
  return texArr;
}

function canvasHasAlpha(canvas) {
  try {
    if (!canvas) return false;
    const w = canvas.width || 0;
    const h = canvas.height || 0;
    if (!w || !h) return false;
    const ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !ctx.getImageData) return false;
    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(1, Math.floor((w * h) / 4096));
    for (let i = 3; i < data.length; i += 4 * step) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function encodeCanvasTexture(canvas, quality, forcePng) {
  const hasAlpha = canvasHasAlpha(canvas);
  if (forcePng || hasAlpha) return { bytes: canvasToPngBytes(canvas), mime: 'image/png', ext: 'png', hasAlpha: hasAlpha || false };
  return { bytes: canvasToJpegBytes(canvas, quality), mime: 'image/jpeg', ext: 'jpg', hasAlpha: false };
}

// Canvas pixels have a top-left origin while glTF texture coordinates use a
// bottom-left V origin. Three.js compensates for this at render time through
// CanvasTexture.flipY; exported GLB image bytes do not carry that runtime flag.
// USD's UsdUVTexture convention already matches the authored canvas in the
// target viewer, so this conversion is deliberately GLB-only.
function exportGlbTextureUvs(uvArr) {
  if (!uvArr) return null;
  const out = new Float32Array(uvArr.length);
  for (let index = 0; index < uvArr.length; index += 2) {
    out[index] = uvArr[index];
    out[index + 1] = 1 - uvArr[index + 1];
  }
  return out;
}

// Capture is local by default. Remote debug upload is deliberately opt-in so
// exporting a model never silently sends project data to a fixed local port.
function captureUsdzDebugPayload(zipBuffer, usdaText, filesMeta) {
  try {
    debugRuntime?.captureUsdzPayload?.(zipBuffer, usdaText, filesMeta || []);
  } catch (err) {
    console.warn('[usdz] could not capture debug payload', err);
  }
}

export function getLastUsdDebug() {
  return lastUsdDebug;
}

export function getLastZipReport() {
  return lastZipReport;
}

function _sf(v) {
  // Short-float formatter, TheaXRe USD style:
  //   whole numbers → integer literal (0, 1, -2)
  //   decimals → up to 4 digits, no trailing zeros, no trailing decimal point.
  //   -0 normalized to 0, NaN/Infinity become 0.
  if (typeof v !== 'number') return '0';
  if (!isFinite(v)) return '0';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  let s = v.toFixed(4);
  if (s.indexOf('.') !== -1) {
    s = s.replace(/0+$/, '');
    if (s.endsWith('.')) s = s.slice(0, -1);
  }
  return s;
}

function _toColorTriple(baseColor, THREE) {
  if (!baseColor) baseColor = '#ffffff';
  try {
    const c = new THREE.Color(baseColor);
    return `${_sf(c.r)}, ${_sf(c.g)}, ${_sf(c.b)}`;
  } catch (_) {
    return '1, 1, 1';
  }
}
function _uid(s) {
  // USD Prim names: only [A-Za-z0-9_] allowed; dashes (-) from UUID v4 are invalid.
  return String(s || '').replace(/[^A-Za-z0-9_]+/g, '_');
}

export function buildGLB(ctx) {
  const getShapeList = ctx?.getShapeList || (() => []);
  const getProject = ctx?.getProject || (() => null);
  const getAssemblyRoot = ctx?.getAssemblyRoot || (() => null);
  const updateComposite = ctx?.updateComposite || (() => {});
  const getCompositeCanvas = ctx?.getCompositeCanvas || (() => null);
  const partHasAnyVisibleLayerImage = ctx?.partHasAnyVisibleLayerImage || (() => false);
  const THREE = ctx?.THREE || null;

  const src = getShapeList();
  const parts = src.filter(p => p && p._mesh && p._mesh.geometry);
  if (!parts.length) throw new Error('No mesh to export');

  const assemblyRoot = getAssemblyRoot();
  if (!assemblyRoot) throw new Error('No assembly root');

  const baseRot = assemblyRoot.rotation.y;
  assemblyRoot.rotation.y = 0;
  assemblyRoot.updateMatrixWorld(true);

  try {
    const project = getProject();
    const compositeCanvas = getCompositeCanvas();

    const bufferViews = [];
    const accessors = [];
    const meshes = [];
    const nodes = [];
    const materials = [];
    const textures = [];
    const images = [];
    const chunks = [];
    let offset = 0;

    const anyVisibleImageInProject = (project && project.textureMode === 'shared')
      ? parts.some(p => partHasAnyVisibleLayerImage(p))
      : false;

    function addChunk(data, target) {
      const bytes = (data instanceof Uint8Array)
        ? data
        : (data instanceof ArrayBuffer)
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
      const byteOffset = offset;
      const byteLength = bytes.byteLength;
      chunks.push({ data: bytes, byteOffset, byteLength });
      offset += align4(byteLength);
      const bv = { buffer: 0, byteOffset, byteLength };
      if (target) bv.target = target;
      bufferViews.push(bv);
      return bufferViews.length - 1;
    }

    let sharedTexIdx = -1;
    if (project && project.textureMode === 'shared' && anyVisibleImageInProject) {
      updateComposite();
      const sharedEnc = encodeCanvasTexture(compositeCanvas, 0.88);
      const texView = addChunk(sharedEnc.bytes, 0);
      images.push({ bufferView: texView, mimeType: sharedEnc.mime });
      textures.push({ source: 0 });
      sharedTexIdx = 0;
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const geo = part._mesh.geometry;
      const posArr = geo.attributes.position.array;
      const normArr = geo.attributes.normal ? geo.attributes.normal.array : null;
      const uvArr = geo.attributes.uv ? geo.attributes.uv.array : null;
      const indexArr = geo.index ? geo.index.array : null;
      const vertexCount = posArr.length / 3;
      const posBytes = new Float32Array(posArr).buffer;
      const posView = addChunk(posBytes, 34962);
      const posMin = [Infinity, Infinity, Infinity], posMax = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < posArr.length; k += 3) {
        posMin[0] = Math.min(posMin[0], posArr[k]);
        posMin[1] = Math.min(posMin[1], posArr[k + 1]);
        posMin[2] = Math.min(posMin[2], posArr[k + 2]);
        posMax[0] = Math.max(posMax[0], posArr[k]);
        posMax[1] = Math.max(posMax[1], posArr[k + 1]);
        posMax[2] = Math.max(posMax[2], posArr[k + 2]);
      }
      const posAcc = accessors.length;
      accessors.push({ bufferView: posView, componentType: 5126, count: vertexCount, type: 'VEC3', min: posMin, max: posMax });

      let normAcc = -1;
      if (normArr) {
        const normBytes = new Float32Array(normArr).buffer;
        const normView = addChunk(normBytes, 34962);
        normAcc = accessors.length;
        accessors.push({ bufferView: normView, componentType: 5126, count: vertexCount, type: 'VEC3' });
      }

      const wantsTexture = !!uvArr && (
        (project && project.textureMode === 'shared')
          ? anyVisibleImageInProject
          : partHasAnyVisibleLayerImage(part)
      );
      let uvAcc = -1;
      if (uvArr) {
        const exportedUvs = wantsTexture ? exportGlbTextureUvs(uvArr) : new Float32Array(uvArr);
        const uvBytes = exportedUvs.buffer;
        const uvView = addChunk(uvBytes, 34962);
        uvAcc = accessors.length;
        accessors.push({ bufferView: uvView, componentType: 5126, count: vertexCount, type: 'VEC2' });
      }

      let idxAcc = -1;
      if (indexArr) {
        const idxTyped = (vertexCount > 65535) ? new Uint32Array(indexArr) : new Uint16Array(indexArr);
        const idxBytes = idxTyped.buffer;
        const idxView = addChunk(idxBytes, 34963);
        idxAcc = accessors.length;
        accessors.push({
          bufferView: idxView,
          componentType: (vertexCount > 65535) ? 5125 : 5123,
          count: indexArr.length,
          type: 'SCALAR'
        });
      }

      const mState = (part && part.material) ? part.material : null;
      const mRuntime = (part && part._mesh && part._mesh.material) ? part._mesh.material : null;
      const rough = (mState && typeof mState.roughness === 'number') ? mState.roughness : ((mRuntime && typeof mRuntime.roughness === 'number') ? mRuntime.roughness : 0.6);
      const metal = (mState && typeof mState.metalness === 'number') ? mState.metalness : ((mRuntime && typeof mRuntime.metalness === 'number') ? mRuntime.metalness : 0.0);

      let baseColor = (mState && mState.baseColor) ? mState.baseColor : null;
      if (!baseColor && mRuntime && mRuntime.color && typeof mRuntime.color.getHexString === 'function') baseColor = '#' + mRuntime.color.getHexString();
      if (!baseColor) baseColor = '#ffffff';
      let baseColorFactor = [1, 1, 1, 1];
      try {
        const c = new THREE.Color(baseColor);
        baseColorFactor = [c.r, c.g, c.b, 1];
      } catch (_) {}

      let texIdx = -1;
      let texHasAlpha = false;
      if (wantsTexture) {
        if (project && project.textureMode === 'shared') {
          texIdx = sharedTexIdx;
          try { texHasAlpha = !!(part && part.type === 'plane' && images[0] && images[0].mimeType === 'image/png'); } catch (_) {}
        } else {
          const enc = encodeCanvasTexture(part._compositeCanvas || compositeCanvas, 0.88);
          texHasAlpha = enc.hasAlpha;
          const texView = addChunk(enc.bytes, 0);
          const imgIdx = images.length;
          images.push({ bufferView: texView, mimeType: enc.mime });
          texIdx = textures.length;
          textures.push({ source: imgIdx });
        }
      }
      const matIdx = materials.length;
      const matDef = {
        pbrMetallicRoughness: {
          baseColorTexture: (texIdx >= 0) ? { index: texIdx } : undefined,
          baseColorFactor,
          metallicFactor: Math.max(0, Math.min(1, metal)),
          roughnessFactor: Math.max(0, Math.min(1, rough))
        },
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} }
      };
      if (texIdx >= 0 && texHasAlpha) {
        matDef.alphaMode = 'BLEND';
      } else {
        matDef.alphaMode = 'MASK';
        matDef.alphaCutoff = 0.5;
      }
      materials.push(matDef);

      const primAttribs = { POSITION: posAcc };
      if (normAcc >= 0) primAttribs.NORMAL = normAcc;
      if (uvAcc >= 0) primAttribs.TEXCOORD_0 = uvAcc;
      const prim = { attributes: primAttribs, material: matIdx };
      if (idxAcc >= 0) prim.indices = idxAcc;
      const meshIdx = meshes.length;
      meshes.push({ primitives: [prim] });

      part._mesh.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      const worldScale = new THREE.Vector3();
      part._mesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

      const n = {
        mesh: meshIdx,
        name: part.name || ('Part ' + (i + 1)),
        translation: [worldPos.x, worldPos.y, worldPos.z],
        rotation: [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w],
        scale: [worldScale.x, worldScale.y, worldScale.z]
      };
      nodes.push(n);
    }

    const gltf = {
      asset: { version: '2.0', generator: 'XReate' },
      extensionsUsed: ['KHR_materials_unlit'],
      scene: 0,
      scenes: [{ nodes: nodes.map((_, i) => i) }],
      nodes,
      meshes,
      materials,
      textures,
      images,
      bufferViews,
      accessors,
      buffers: [{ byteLength: offset }]
    };

    const bin = new ArrayBuffer(offset);
    const binView = new Uint8Array(bin);
    for (const ch of chunks) binView.set(ch.data instanceof Uint8Array ? ch.data : new Uint8Array(ch.data), ch.byteOffset);

    const jsonStr = JSON.stringify(gltf);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonPadded = align4(jsonBytes.length);
    const jsonBuf = new Uint8Array(jsonPadded);
    jsonBuf.set(jsonBytes);
    for (let i = jsonBytes.length; i < jsonPadded; i++) jsonBuf[i] = 0x20;

    const totalSize = 12 + 8 + jsonPadded + 8 + offset;
    const out = new ArrayBuffer(totalSize);
    const view = new DataView(out);
    let p = 0;
    view.setUint32(p, 0x46546C67, true); p += 4;
    view.setUint32(p, 2, true); p += 4;
    view.setUint32(p, totalSize, true); p += 4;
    view.setUint32(p, jsonPadded, true); p += 4;
    view.setUint32(p, 0x4E4F534A, true); p += 4;
    new Uint8Array(out).set(jsonBuf, p); p += jsonPadded;
    view.setUint32(p, offset, true); p += 4;
    view.setUint32(p, 0x004E4942, true); p += 4;
    new Uint8Array(out).set(new Uint8Array(bin), p);
    return out;
  } finally {
    assemblyRoot.rotation.y = baseRot;
    assemblyRoot.updateMatrixWorld(true);
  }
}

export function buildUSDZ(ctx) {
  const getShapeList = ctx?.getShapeList || (() => []);
  const getProject = ctx?.getProject || (() => null);
  const getAssemblyRoot = ctx?.getAssemblyRoot || (() => null);
  const updateComposite = ctx?.updateComposite || (() => {});
  const getCompositeCanvas = ctx?.getCompositeCanvas || (() => null);
  const partHasAnyVisibleLayerImage = ctx?.partHasAnyVisibleLayerImage || (() => false);
  const THREE = ctx?.THREE || null;

  const src = getShapeList();
  const parts = src.filter(p => p && p._mesh && p._mesh.geometry);
  if (!parts.length) throw new Error('No mesh to export');

  const assemblyRoot = getAssemblyRoot();
  if (!assemblyRoot) throw new Error('No assembly root');

  const baseRot = assemblyRoot.rotation.y;
  assemblyRoot.rotation.y = 0;
  assemblyRoot.updateMatrixWorld(true);
  try {
    const project = getProject();
    const compositeCanvas = getCompositeCanvas();

    const rootName = 'XReate';
    const bodyParts = [];
    const materialDefs = [];
    const files = [];
    const bboxMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const bboxMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const clampFinite = (n) => (Number.isFinite(n) ? n : 0);
    const v3tmpA = new THREE.Vector3();
    const v3tmpB = new THREE.Vector3();
    const faceA = new THREE.Vector3();
    const faceB = new THREE.Vector3();
    const faceC = new THREE.Vector3();
    const faceEdgeA = new THREE.Vector3();
    const faceEdgeB = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();
    const authoredNormal = new THREE.Vector3();

    const anyVisibleImageInProject = (project && project.textureMode === 'shared')
      ? parts.some(p => partHasAnyVisibleLayerImage(p))
      : false;

    let sharedTexFile = 'texture.png';
    let sharedTexHasAlpha = false;
    let sharedTexBytes = null;
    if (project && project.textureMode === 'shared' && anyVisibleImageInProject) {
      updateComposite();
      const enc = encodeCanvasTexture(compositeCanvas, 0.88, true);
      sharedTexHasAlpha = enc.hasAlpha;
      sharedTexFile = 'texture.' + enc.ext;
      sharedTexBytes = enc.bytes;
    }
    function baseColorToUsdTuple(part) {
      const mState = (part && part.material) ? part.material : null;
      const mRuntime = (part && part._mesh && part._mesh.material) ? part._mesh.material : null;
      let baseColor = (mState && mState.baseColor) ? mState.baseColor : null;
      if (!baseColor && mRuntime && mRuntime.color && typeof mRuntime.color.getHexString === 'function') baseColor = '#' + mRuntime.color.getHexString();
      return _toColorTriple(baseColor, THREE);
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const srcGeo = part._mesh.geometry;
      const tempGeo = srcGeo.index ? srcGeo.toNonIndexed() : null;
      const geo = tempGeo || srcGeo;
      part._mesh.updateMatrixWorld(true);
      const worldM = part._mesh.matrixWorld;
      const normalM = new THREE.Matrix3().getNormalMatrix(worldM);
      const v3 = new THREE.Vector3();
      const n3 = new THREE.Vector3();
      if (!geo.attributes.normal) {
        try { geo.computeVertexNormals(); } catch (_) {}
      }
      const posArr = geo.attributes.position.array;
      const normArr = geo.attributes.normal ? geo.attributes.normal.array : new Float32Array(posArr.length);
      const uvArr = geo.attributes.uv ? geo.attributes.uv.array : new Float32Array((posArr.length / 3) * 2);
      const indexArr = geo.index ? geo.index.array : null;
      const wantsTexture = (project && project.textureMode === 'shared')
        ? anyVisibleImageInProject
        : partHasAnyVisibleLayerImage(part);

      const pointParts = new Array(posArr.length / 3);
      v3tmpA.set(Infinity, Infinity, Infinity);
      v3tmpB.set(-Infinity, -Infinity, -Infinity);
      for (let k = 0; k < posArr.length; k += 3) {
        v3.set(posArr[k], posArr[k + 1], posArr[k + 2]).applyMatrix4(worldM);
        v3.x = clampFinite(v3.x);
        v3.y = clampFinite(v3.y);
        v3.z = clampFinite(v3.z);
        bboxMin.min(v3);
        bboxMax.max(v3);
        v3tmpA.min(v3);
        v3tmpB.max(v3);
        pointParts[k / 3] = `(${_sf(v3.x)}, ${_sf(v3.y)}, ${_sf(v3.z)})`;
      }
      const points = pointParts.join(', ');
      const meshExtent = `float3[] extent = [(${_sf(v3tmpA.x)}, ${_sf(v3tmpA.y)}, ${_sf(v3tmpA.z)}), (${_sf(v3tmpB.x)}, ${_sf(v3tmpB.y)}, ${_sf(v3tmpB.z)})]`;

      const normalParts = new Array(normArr.length / 3);
      for (let k = 0; k < normArr.length; k += 3) {
        n3.set(normArr[k], normArr[k + 1], normArr[k + 2]).applyMatrix3(normalM).normalize();
        n3.x = clampFinite(n3.x);
        n3.y = clampFinite(n3.y);
        n3.z = clampFinite(n3.z);
        normalParts[k / 3] = `(${_sf(n3.x)}, ${_sf(n3.y)}, ${_sf(n3.z)})`;
      }
      const uvParts = new Array(uvArr.length / 2);
      for (let k = 0; k < uvArr.length; k += 2) {
        uvParts[k / 2] = `(${_sf(uvArr[k])}, ${_sf(uvArr[k + 1])})`;
      }
      // USD face-varying values are ordered by face corner, not by point
      // index.  Validate each triangle against its transformed normals and
      // repair an inverted winding while keeping its normal/UV corners in the
      // same order.  This protects Quick Look from displaying custom Doodles
      // as an inside-out, transparent shell.
      const triCount = indexArr ? Math.floor(indexArr.length / 3) : Math.floor(posArr.length / 9);
      const faceParts = new Array(triCount);
      const orderedNormalParts = new Array(triCount * 3);
      const orderedUvParts = new Array(triCount * 3);
      for (let t = 0; t < triCount; t++) {
        const a = indexArr ? indexArr[t * 3] : t * 3;
        const b = indexArr ? indexArr[t * 3 + 1] : t * 3 + 1;
        const c = indexArr ? indexArr[t * 3 + 2] : t * 3 + 2;
        faceA.set(posArr[a * 3], posArr[a * 3 + 1], posArr[a * 3 + 2]).applyMatrix4(worldM);
        faceB.set(posArr[b * 3], posArr[b * 3 + 1], posArr[b * 3 + 2]).applyMatrix4(worldM);
        faceC.set(posArr[c * 3], posArr[c * 3 + 1], posArr[c * 3 + 2]).applyMatrix4(worldM);
        faceNormal.crossVectors(faceEdgeA.subVectors(faceB, faceA), faceEdgeB.subVectors(faceC, faceA));
        authoredNormal.set(0, 0, 0);
        for (const vertex of [a, b, c]) {
          authoredNormal.x += normArr[vertex * 3];
          authoredNormal.y += normArr[vertex * 3 + 1];
          authoredNormal.z += normArr[vertex * 3 + 2];
        }
        authoredNormal.applyMatrix3(normalM);
        const flipped = faceNormal.lengthSq() > 1e-14 && authoredNormal.lengthSq() > 1e-14 && faceNormal.dot(authoredNormal) < 0;
        const order = flipped ? [a, c, b] : [a, b, c];
        faceParts[t] = `${order[0]}, ${order[1]}, ${order[2]}`;
        for (let corner = 0; corner < 3; corner++) {
          const vertex = order[corner];
          orderedNormalParts[t * 3 + corner] = normalParts[vertex];
          orderedUvParts[t * 3 + corner] = uvParts[vertex];
        }
      }
      const normals = orderedNormalParts.join(', ');
      const uvs = orderedUvParts.join(', ');
      const faceIndices = faceParts.join(', ');
      const faceCounts = new Array(triCount).fill('3').join(', ');

      const matName = `mat_${_uid(part.id)}`;
      const meshName = `mesh_${_uid(part.id)}`;
      const xformName = (part.name || `Part_${i + 1}`).replace(/[^A-Za-z0-9_]+/g, '_');
      // Closed volumes must retain their front-face contract in Quick Look.
      // Only intentionally open/sheet-like parts need a two-sided USD mesh.
      const doubleSided = (['plane', 'dome', 'hemi_open', 'arc_cyl', 'rod_arc_15', 'rod_arc_30', 'rod_arc_45'].includes(part.type) || !!part?.params?.openEnded) ? 1 : 0;

      let texFile = '';
      let texHasAlpha = false;
      const mat = part._mesh.material || null;
      const mState = (part && part.material) ? part.material : null;
      const rough = _sf((mState && typeof mState.roughness === 'number') ? mState.roughness : ((mat && typeof mat.roughness === 'number') ? mat.roughness : 0.6));
      const metal = _sf((mState && typeof mState.metalness === 'number') ? mState.metalness : ((mat && typeof mat.metalness === 'number') ? mat.metalness : 0.0));
      const baseTuple = baseColorToUsdTuple(part);
      if (wantsTexture) {
        if (project && project.textureMode === 'shared') {
          texFile = sharedTexFile;
          texHasAlpha = !!(sharedTexHasAlpha && part && part.type === 'plane');
        } else {
          const enc = encodeCanvasTexture(part._compositeCanvas || compositeCanvas, 0.88, true);
          texHasAlpha = enc.hasAlpha;
          texFile = `texture_${_uid(part.id)}.` + enc.ext;
          files.push({ name: texFile, data: enc.bytes });
        }
      }

      bodyParts.push(`def Xform "${xformName}"
{
    def Mesh "${meshName}" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        uniform bool doubleSided = ${doubleSided}
        uniform token orientation = "rightHanded"
        ${meshExtent}
        int[] faceVertexCounts = [${faceCounts}]
        int[] faceVertexIndices = [${faceIndices}]
        rel material:binding = </${rootName}/Materials/${matName}>
        point3f[] points = [${points}]
        normal3f[] normals = [${normals}] (
            interpolation = "faceVarying"
        )
        texCoord2f[] primvars:st = [${uvs}] (
            interpolation = "faceVarying"
        )
        uniform token subdivisionScheme = "none"
    }
}`);

      let matDef = '';
      if (wantsTexture) {
        // Single template for both alpha and non-alpha textured materials:
        // opacity ALWAYS connected + opacityThreshold ALWAYS present (Quick Look order-sensitive).
        matDef = `def Material "${matName}"
{
    token outputs:surface.connect = </${rootName}/Materials/${matName}/Surface_PreviewShader.outputs:surface>

    def Shader "Surface_PreviewShader"
    {
        uniform token info:id = "UsdPreviewSurface"
        color3f inputs:diffuseColor.connect = </${rootName}/Materials/${matName}/Diffuse_Texture.outputs:rgb>
        color3f inputs:emissiveColor = (0, 0, 0)
        float inputs:opacity.connect = </${rootName}/Materials/${matName}/Diffuse_Texture.outputs:a>
        float inputs:opacityThreshold = 0.0001
        float inputs:roughness = ${rough}
        float inputs:metallic = ${metal}
        token outputs:surface
    }

    def Shader "Diffuse_Texture"
    {
        uniform token info:id = "UsdUVTexture"
        asset inputs:file = @${texFile}@
        token inputs:wrapS = "clamp"
        token inputs:wrapT = "clamp"
        float4 inputs:scale = (1, 1, 1, 1)
        float2 inputs:st.connect = </${rootName}/Materials/${matName}/ST_UV_Reader.outputs:result>
        token outputs:rgb
        token outputs:a
    }

    def Shader "ST_UV_Reader"
    {
        uniform token info:id = "UsdPrimvarReader_float2"
        string inputs:varname = "st"
        float2 inputs:fallback = (0, 0)
        float2 outputs:result
    }

}`;
      } else {
        matDef = `def Material "${matName}"
{
    token outputs:surface.connect = </${rootName}/Materials/${matName}/Surface_PreviewShader.outputs:surface>

    def Shader "Surface_PreviewShader"
    {
        uniform token info:id = "UsdPreviewSurface"
        color3f inputs:diffuseColor = (${baseTuple})
        color3f inputs:emissiveColor = (0, 0, 0)
        float inputs:opacity = 1
        float inputs:roughness = ${rough}
        float inputs:metallic = ${metal}
        token outputs:surface
    }

}`;
      }
      materialDefs.push(matDef);

      if (tempGeo) {
        try { tempGeo.dispose(); } catch (_) {}
      }
    }

    if (project && project.textureMode === 'shared' && anyVisibleImageInProject && sharedTexBytes) {
      files.push({ name: sharedTexFile, data: sharedTexBytes });
    }

    const usda = `#usda 1.0
(
    defaultPrim = "${rootName}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${rootName}" (
    kind = "component"
)
{
${bodyParts.join('\n\n')}

    def Scope "Materials"
    {
${materialDefs.join('\n\n')}
    }
}
`;
    if (!Number.isFinite(bboxMin.x) || !Number.isFinite(bboxMax.x)) {
      throw new Error('USDZ export failed: invalid mesh bounds');
    }
    lastUsdDebug = {
      usda,
      bounds: {
        min: { x: bboxMin.x, y: bboxMin.y, z: bboxMin.z },
        max: { x: bboxMax.x, y: bboxMax.y, z: bboxMax.z },
      }
    };
    lastZipReport = null;

    // ============================================================
    // DEBUG BISECTION HOOK (one-click in Console before export)
    // Use these to isolate ZIP container bug vs USDA/texture bug:
    // The bootstrap may opt into a minimal USDA payload to bisect container
    // and texture failures without coupling this serializer to global state.
    // ============================================================
    try {
      const mode = debugRuntime?.getMinimalUsdaMode?.() || null;
      if (mode === 'noTex' || mode === 'withTex') {
        const rName = 'XReate';
        const minimalUsda = `#usda 1.0
(
    defaultPrim = "${rName}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${rName}" (
    kind = "component"
)
{
    def Xform "Debug_Cube"
    {
        def Mesh "mesh_debug"
        {
            float3[] extent = [(-0.5, -0.5, -0.5), (0.5, 0.5, 0.5)]
            int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
            int[] faceVertexIndices = [0, 1, 3, 2, 4, 5, 7, 6, 2, 3, 7, 6, 0, 4, 6, 2, 1, 5, 7, 3, 0, 1, 5, 4]
            normal3f[] normals = [(0, 0, -1), (0, 0, 1), (0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0)] (
                interpolation = "uniform"
            )
            point3f[] points = [(-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (-0.5, 0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (-0.5, 0.5, 0.5), (0.5, 0.5, 0.5)]
            texCoord2f[] primvars:st = [(0,0),(1,0),(0,1),(1,1),(0,0),(1,0),(0,1),(1,1),(0,0),(1,0),(0,1),(1,1),(0,0),(1,0),(0,1),(1,1),(0,0),(1,0),(0,1),(1,1),(0,0),(1,0),(0,1),(1,1)] (
                interpolation = "faceVarying"
            )
            uniform token subdivisionScheme = "none"
            rel material:binding = </${rName}/Materials/mat_debug>
            uniform bool doubleSided = 1
        }
    }

    def Scope "Materials"
    {
        def Material "mat_debug"
        {
            token outputs:surface.connect = </${rName}/Materials/mat_debug/pbr.outputs:surface>

            def Shader "pbr"
            {
                uniform token info:id = "UsdPreviewSurface"
${mode === 'withTex'
                ? `                color3f inputs:diffuseColor.connect = </${rName}/Materials/mat_debug/tex.outputs:rgb>
                color3f inputs:emissiveColor = (0, 0, 0)
                float inputs:opacity = 1
                float inputs:roughness = 0.60
                float inputs:metallic = 0.00
                token outputs:surface
            }

            def Shader "tex"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @debug_tex.png@
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                float4 inputs:scale = (1, 1, 1, 1)
                float2 inputs:st.connect = </${rName}/Materials/mat_debug/stReader.outputs:result>
                float3 outputs:rgb
                float outputs:a
            }

            def Shader "stReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }`
                : `                color3f inputs:diffuseColor = (1, 0, 0)
                color3f inputs:emissiveColor = (0, 0, 0)
                float inputs:opacity = 1
                float inputs:roughness = 0.60
                float inputs:metallic = 0.00
                token outputs:surface
            }`}
        }
    }
}
`;
        const dbgFiles = [{ name: rName + '.usda', data: new TextEncoder().encode(minimalUsda) }];
        if (mode === 'withTex') {
          const png1x1Red = new Uint8Array([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
            0x00, 0x00, 0x05, 0x00, 0x01, 0x52, 0x15, 0xB5,
            0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
          ]);
          dbgFiles.push({ name: 'debug_tex.png', data: png1x1Red });
        }
        const dbgBuf = buildZip(dbgFiles);
        captureUsdzDebugPayload(dbgBuf, minimalUsda, dbgFiles.map(f => ({ name: f.name, size: f.data.byteLength })));
        return dbgBuf;
      }
    } catch (_) {}

    const usdaBytes = new TextEncoder().encode(usda);
    // USDZ readers expect the default USDA layer to be the first ZIP member;
    // putting a texture first can pass a generic ZIP check yet be rejected by
    // Quick Look as a corrupt USDZ package.
    const allFiles = [{ name: rootName + '.usda', data: usdaBytes }, ...files];
    const zipBuffer = buildZip(allFiles);
    captureUsdzDebugPayload(zipBuffer, usda, allFiles.map(f => ({ name: f.name, size: f.data.byteLength })));
    return zipBuffer;
  } finally {
    assemblyRoot.rotation.y = baseRot;
    assemblyRoot.updateMatrixWorld(true);
  }
}
