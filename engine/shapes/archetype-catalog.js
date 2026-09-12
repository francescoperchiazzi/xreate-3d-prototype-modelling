// Converts serializable shape metadata into the runtime catalog consumed by
// menus and factories. Geometry builders are injected to keep this module
// independent of both Three.js and the legacy bridge.
export function createArchetypes({ shapeMeta, builders } = {}) {
  const meta = shapeMeta && typeof shapeMeta === 'object' ? shapeMeta : {};
  const sourceBuilders = builders && typeof builders === 'object' ? builders : {};
  const result = {};
  const builderNames = {
    pyr_frustum: 'buildPyramidFrustum',
    arc_cyl: 'buildArcCylinder',
  };
  for (const [category, items] of Object.entries(meta)) {
    if (!Array.isArray(items)) continue;
    result[category] = items
      .map((item) => {
        const id = item?.id ? String(item.id) : '';
        const generatedName = `build${id.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
        const builder = sourceBuilders[builderNames[id] || generatedName] || sourceBuilders[id] || (() => null);
        return {
          id,
          label: item?.label ? String(item.label) : '',
          icon: item?.icon ? String(item.icon) : '',
          build: typeof builder === 'function' ? builder : (() => null),
        };
      })
      .filter((item) => item.id);
  }
  return result;
}

export function getArchetypeById(archetypes, id) {
  const target = String(id || '');
  for (const items of Object.values(archetypes || {})) {
    if (!Array.isArray(items)) continue;
    const found = items.find((item) => item?.id === target);
    if (found) return found;
  }
  return null;
}

export function getArchetypeCategoryById(archetypes, id) {
  const target = String(id || '');
  for (const [category, items] of Object.entries(archetypes || {})) {
    if (Array.isArray(items) && items.some((item) => item?.id === target)) return category;
  }
  return null;
}
