const { createArchetypes } = await import('../engine/shapes/archetype-catalog.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const buildCube = () => ({ geometry: 'cube' });
const catalog = createArchetypes({
  shapeMeta: { Primitives: [{ id: 'cube', label: 'Cube', icon: 'cube' }, { id: 'pyr_frustum', label: 'Pyramid frustum' }, { id: 'doodle', label: 'Doodle' }] },
  builders: { buildCube, buildPyramidFrustum: () => ({ geometry: 'pyramid' }), doodle: () => null },
});
assert(catalog.Primitives.length === 3, 'catalog did not preserve archetype metadata');
assert(catalog.Primitives[0].build === buildCube, 'catalog did not connect the matching injected builder');
assert(catalog.Primitives[1].build().geometry === 'pyramid', 'catalog did not resolve the explicit pyramid-frustum builder');
assert(catalog.Primitives[2].build() === null, 'catalog did not preserve the deliberate doodle placeholder');
console.log('archetype-catalog: PASS');
