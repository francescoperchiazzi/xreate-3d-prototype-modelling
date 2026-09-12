const { fromCanvasTransform, invert, multiply } = await import('../engine/image/affine-transform.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const transform = fromCanvasTransform({ x: 10, y: -5, scale: 2, ratio: 1, rot: 0 }, 100);
const inverse = invert(transform);
const identity = multiply(transform, inverse);
assert(transform.e === 60 && transform.f === 45, 'canvas transform did not preserve translation');
assert(Math.abs(identity.a - 1) < 1e-9 && Math.abs(identity.d - 1) < 1e-9, 'affine inverse did not produce identity scale');
assert(invert({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }) === null, 'singular affine matrix must be rejected');
console.log('image-affine: PASS');
