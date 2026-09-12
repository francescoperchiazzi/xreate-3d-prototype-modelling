let configuredMeta = {};

function resolveMeta() {
  const meta = configuredMeta;
  return (meta && typeof meta === 'object') ? meta : {};
}

function allFromMeta(meta) {
  try { return Object.values(meta).flat().filter(Boolean); } catch (_) { return []; }
}

export function configureShapeDefs(opts = {}) {
  configuredMeta = opts.shapeMeta && typeof opts.shapeMeta === 'object' ? opts.shapeMeta : {};
  return { shapeMeta: configuredMeta };
}

function getDefaultUvModeForArchetypeId(id) {
  if (id === 'sphere') return 'sphere';
  if (id === 'dome') return 'sphere';
  if (id === 'hemi_open') return 'sphere';
  if (id === 'ellipsoid') return 'sphere';
  if (id === 'plane') return 'planar';
  if (id === 'cube' || id === 'box' || id === 'tri_prism' || id === 'pyr_frustum' || id === 'wedge' || id === 'curved_box') return 'box';
  return 'cylindrical';
}

function getDefaultParamsForArchetypeId(id) {
  if (id === 'sphere') return { radius: 1.0, widthSegments: 64, heightSegments: 32 };
  if (id === 'dome') return { radius: 1.0, widthSegments: 48, heightSegments: 24 };
  if (id === 'hemi_open') return { radius: 1.0, widthSegments: 48, heightSegments: 24 };
  if (id === 'cube') return { size: 1.0, segments: 4 };
  if (id === 'box') return { width: 1.0, height: 1.8, depth: 2.4, segments: 4, taperTop: 1.0, taperBottom: 1.0 };
  if (id === 'cylinder') return { radiusTop: 0.8, radiusBottom: 0.8, height: 1.8, segments: 48, heightSegments: 8, openEnded: false };
  if (id === 'rod') return { radius: 0.08, height: 2.2, segments: 24, heightSegments: 1, openEnded: false };
  if (id === 'cone') return { radius: 0.9, height: 1.8, segments: 48, heightSegments: 8 };
  if (id === 'torus') return { radius: 0.8, tube: 0.35, radialSegments: 24, tubularSegments: 64 };
  if (id === 'plane') return { width: 2.0, height: 2.0, segments: 16 };
  if (id === 'capsule') return { radius: 0.5, halfHeight: 0.5, arcSegments: 16, latheSegments: 48 };
  if (id === 'tri_prism') return { radius: 0.9, height: 1.8, heightSegments: 2 };
  if (id === 'frustum') return { radiusTop: 0.55, radiusBottom: 0.95, height: 1.8, segments: 48, heightSegments: 8, openEnded: false };
  if (id === 'pyr_frustum') return { radiusTop: 0.65, radiusBottom: 1.05, height: 1.6, heightSegments: 6, openEnded: false };
  if (id === 'wedge') return { width: 2.0, height: 1.2, depth: 2.0, tip: 0.12 };
  if (id === 'arc_cyl') return { tubeRadius: 0.25, bendRadius: 1.0, arcDegrees: 120, radialSegments: 18, tubularSegments: 64 };
  if (id === 'rod_arc_15') return { tubeRadius: 0.08, bendRadius: 1.2, radialSegments: 18, tubularSegments: 48 };
  if (id === 'rod_arc_30') return { tubeRadius: 0.08, bendRadius: 1.2, radialSegments: 18, tubularSegments: 48 };
  if (id === 'rod_arc_45') return { tubeRadius: 0.08, bendRadius: 1.2, radialSegments: 18, tubularSegments: 48 };
  if (id === 'curved_box') return { width: 0.8, height: 0.5, bendRadius: 1.2, arcDegrees: 100, steps: 48 };
  if (id === 'ellipsoid') return { radiusX: 1.0, radiusY: 0.75, radiusZ: 1.25, widthSegments: 64, heightSegments: 32 };
  if (id === 'hex_prism') return { radius: 0.9, height: 1.8, heightSegments: 6 };
  return null;
}

const ShapeDefs = {
  get(id) {
    const sid = String(id || '');
    return allFromMeta(resolveMeta()).find(x => x && x.id === sid) || null;
  },
  all() {
    return allFromMeta(resolveMeta());
  },
  defaultParams(id) {
    return getDefaultParamsForArchetypeId(String(id || ''));
  },
  defaultUvMode(id) {
    return getDefaultUvModeForArchetypeId(String(id || ''));
  }
};

export { ShapeDefs };
