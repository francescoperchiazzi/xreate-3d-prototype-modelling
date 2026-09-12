const { computeUvTexelDensityRows } = await import('../engine/core/uv-diagnostics.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attribute(values, itemSize) {
  return {
    count: values.length / itemSize,
    getX: (index) => values[index * itemSize],
    getY: (index) => values[index * itemSize + 1],
    getZ: (index) => values[index * itemSize + 2],
  };
}

const rows = computeUvTexelDensityRows({
  currentMesh: {
    geometry: {
      attributes: {
        position: attribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
        uv: attribute([0, 0, 1, 0, 0, 1], 2),
      },
      index: null,
    },
  },
  canvasSize: 1,
  getIslandsForUvMode: () => [{ id: 'main', type: 'rect', x: 0, y: 0, w: 1, h: 1 }],
});

assert(rows.length === 1 && rows[0].id === 'main', 'UV diagnostics did not assign the triangle to its island');
assert(Math.abs(rows[0].ratio - 1) < 1e-9 && Math.abs(rows[0].factor - 1) < 1e-9, 'UV diagnostics produced an incorrect normalized density');
assert(computeUvTexelDensityRows({ currentMesh: null }).length === 0, 'UV diagnostics should tolerate a missing mesh');
console.log('uv-diagnostics: PASS');
