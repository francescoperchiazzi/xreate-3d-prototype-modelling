const { ShapeDefs, configureShapeDefs } = await import('../engine/shapes/shapedefs.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

configureShapeDefs({ shapeMeta: { primitives: [{ id: 'cube', label: 'Cube' }], advanced: [{ id: 'torus', label: 'Torus' }] } });
assert(ShapeDefs.get('cube')?.label === 'Cube', 'shape definitions did not resolve injected metadata');
assert(ShapeDefs.all().map((entry) => entry.id).join(',') === 'cube,torus', 'shape definitions did not flatten injected metadata');
assert(ShapeDefs.defaultUvMode('plane') === 'planar', 'shape definitions returned the wrong default UV mode');
assert(ShapeDefs.defaultParams('cube')?.size === 1, 'shape definitions returned the wrong default parameters');
configureShapeDefs();
assert(ShapeDefs.get('cube') === null, 'shape definitions retained stale metadata after reconfiguration');
console.log('shapedefs: PASS');
