export function fromCanvasTransform(transform, canvasSize = 1024) {
  const t = transform || {};
  const scale = Number.isFinite(t.scale) ? t.scale : 1;
  const ratio = Number.isFinite(t.ratio) ? t.ratio : 1;
  const radians = (Number.isFinite(t.rot) ? t.rot : 0) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const center = (Number(canvasSize) || 1024) / 2;
  return {
    a: cosine * scale * ratio,
    b: sine * scale * ratio,
    c: -sine * scale,
    d: cosine * scale,
    e: center + (Number.isFinite(t.x) ? t.x : 0),
    f: center + (Number.isFinite(t.y) ? t.y : 0),
  };
}

export function invert(matrix) {
  if (!matrix) return null;
  const determinant = (matrix.a * matrix.d) - (matrix.b * matrix.c);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) return null;
  const reciprocal = 1 / determinant;
  return {
    a: matrix.d * reciprocal,
    b: -matrix.b * reciprocal,
    c: -matrix.c * reciprocal,
    d: matrix.a * reciprocal,
    e: ((matrix.c * matrix.f) - (matrix.d * matrix.e)) * reciprocal,
    f: ((matrix.b * matrix.e) - (matrix.a * matrix.f)) * reciprocal,
  };
}

export function multiply(left, right) {
  if (!left || !right) return null;
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export const ImageAffine = { fromCanvasTransform, invert, multiply };
