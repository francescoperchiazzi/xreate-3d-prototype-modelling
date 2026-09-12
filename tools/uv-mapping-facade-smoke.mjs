const { UVMapping } = await import('../engine/core/uv-mapping.js');
const legacySource = await (await import('node:fs/promises')).readFile(new URL('../engine/legacy/editor-inline.js', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(typeof UVMapping.canonicalizeUvMode === 'function', 'UVMapping facade must expose canonicalizeUvMode to the legacy bridge');
assert(UVMapping.canonicalizeUvMode('sphere') === 'sphere', 'sphere must remain a spherical UV mode');
assert(UVMapping.canonicalizeUvMode('spherical') === 'sphere', 'spherical alias must remain a spherical UV mode');
assert(UVMapping.canonicalizeUvMode('cylinder') === 'cylindrical', 'cylinder alias must canonicalize to cylindrical');
assert(legacySource.includes('xrUvRemapBaseGeometry'), 'UV projection changes must retain an untouched geometry baseline');
assert(legacySource.includes('baseGeo ? baseGeo.clone() : currentMesh.geometry'), 'each UV projection must be regenerated from the baseline, not the previous projection');
const uvMappingSource = await (await import('node:fs/promises')).readFile(new URL('../engine/core/uv-mapping.js', import.meta.url), 'utf8');
assert(uvMappingSource.includes('xrUvSourceGeometryType'), 'UV conversion must retain the original geometry archetype after de-indexing');
console.log('uv-mapping-facade: PASS');
