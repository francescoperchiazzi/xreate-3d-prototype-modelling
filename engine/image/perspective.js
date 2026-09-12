import {
  armUndoSnapshot,
  createLayerCanvas,
  getActiveImageLayer,
  getCanvasSize,
  updateLayerFromCanvas,
} from './runtime.js';

let perspectiveActive = false;
let perspectiveDragging = -1;
let perspectiveCtx = null;
let perspectivePoints = createDefaultPoints();

function createDefaultPoints() {
  const canvas = perspectiveCtx?.canvas || null;
  const width = Number(canvas?.width) || 512;
  const height = Number(canvas?.height) || 512;
  const insetX = Math.round(width / 8);
  const insetY = Math.round(height / 8);
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ];
}

function getPerspectiveEventCoords(e) {
  if (!perspectiveCtx) return { x: 0, y: 0 };
  const rect = perspectiveCtx.canvas.getBoundingClientRect();
  const scaleX = perspectiveCtx.canvas.width / rect.width;
  const scaleY = perspectiveCtx.canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function findNearestPoint(x, y) {
  let minDist = Infinity;
  let idx = -1;
  for (let i = 0; i < 4; i++) {
    const p = perspectivePoints[i];
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < minDist && dist < 400) {
      minDist = dist;
      idx = i;
    }
  }
  return idx;
}

function handlePerspectiveMouseDown(e) {
  const coords = getPerspectiveEventCoords(e);
  perspectiveDragging = findNearestPoint(coords.x, coords.y);
  if (perspectiveDragging !== -1) e.preventDefault();
}

function handlePerspectiveMouseMove(e) {
  if (perspectiveDragging === -1 || !perspectiveCtx) return;
  const coords = getPerspectiveEventCoords(e);
  perspectivePoints[perspectiveDragging].x = Math.max(0, Math.min(perspectiveCtx.canvas.width, coords.x));
  perspectivePoints[perspectiveDragging].y = Math.max(0, Math.min(perspectiveCtx.canvas.height, coords.y));
  drawPerspectiveOverlay();
}

function handlePerspectiveMouseUp() {
  perspectiveDragging = -1;
  drawPerspectiveOverlay();
}

function handlePerspectiveTouchStart(e) {
  e.preventDefault();
  const touch = e.touches?.[0];
  if (!touch) return;
  handlePerspectiveMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
}

function handlePerspectiveTouchMove(e) {
  e.preventDefault();
  const touch = e.touches?.[0];
  if (!touch) return;
  handlePerspectiveMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
}

function handlePerspectiveTouchEnd() {
  handlePerspectiveMouseUp();
}

export function setPerspectiveActive(active) {
  perspectiveActive = !!active;
  drawPerspectiveOverlay();
}

export function initPerspectiveOverlay() {
  const canvas = document.getElementById('perspectiveOverlay');
  if (!canvas) return;
  perspectiveCtx = canvas.getContext('2d');
  if (!canvas.__xrPerspectiveModuleBound) {
    canvas.__xrPerspectiveModuleBound = true;
    canvas.addEventListener('mousedown', handlePerspectiveMouseDown);
    canvas.addEventListener('mousemove', handlePerspectiveMouseMove);
    canvas.addEventListener('mouseup', handlePerspectiveMouseUp);
    canvas.addEventListener('mouseleave', handlePerspectiveMouseUp);
    canvas.addEventListener('touchstart', handlePerspectiveTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handlePerspectiveTouchMove, { passive: false });
    canvas.addEventListener('touchend', handlePerspectiveTouchEnd);
  }
  if (!Array.isArray(perspectivePoints) || perspectivePoints.length !== 4) {
    perspectivePoints = createDefaultPoints();
  }
  drawPerspectiveOverlay();
}

export function drawPerspectiveOverlay() {
  if (!perspectiveCtx) return;
  const canvas = perspectiveCtx.canvas;
  perspectiveCtx.setTransform(1, 0, 0, 1, 0, 0);
  perspectiveCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (!perspectiveActive) return;

  perspectiveCtx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
  perspectiveCtx.lineWidth = 2;
  perspectiveCtx.beginPath();
  perspectiveCtx.moveTo(perspectivePoints[0].x, perspectivePoints[0].y);
  for (let i = 1; i < 4; i++) {
    perspectiveCtx.lineTo(perspectivePoints[i].x, perspectivePoints[i].y);
  }
  perspectiveCtx.closePath();
  perspectiveCtx.stroke();

  for (let i = 0; i < 4; i++) {
    const p = perspectivePoints[i];
    perspectiveCtx.fillStyle = (perspectiveDragging === i) ? 'rgba(255, 150, 0, 1)' : 'rgba(255, 200, 0, 1)';
    perspectiveCtx.beginPath();
    perspectiveCtx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    perspectiveCtx.fill();
    perspectiveCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    perspectiveCtx.lineWidth = 2;
    perspectiveCtx.stroke();
  }
}

export function resetPerspectivePoints() {
  perspectivePoints = createDefaultPoints();
  drawPerspectiveOverlay();
}

export function gaussianElimination(A, b) {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = j;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    const pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-10) continue;
    for (let j = i; j <= n; j++) {
      augmented[i][j] /= pivot;
    }
    for (let j = 0; j < n; j++) {
      if (j !== i && Math.abs(augmented[j][i]) > 1e-10) {
        const factor = augmented[j][i];
        for (let k = i; k <= n; k++) {
          augmented[j][k] -= factor * augmented[i][k];
        }
      }
    }
  }

  return augmented.map((row) => row[n]);
}

export function computePerspectiveTransform(src, dst) {
  const A = [
    [src[0].x, src[0].y, 1, 0, 0, 0, -src[0].x * dst[0].x, -src[0].y * dst[0].x],
    [0, 0, 0, src[0].x, src[0].y, 1, -src[0].x * dst[0].y, -src[0].y * dst[0].y],
    [src[1].x, src[1].y, 1, 0, 0, 0, -src[1].x * dst[1].x, -src[1].y * dst[1].x],
    [0, 0, 0, src[1].x, src[1].y, 1, -src[1].x * dst[1].y, -src[1].y * dst[1].y],
    [src[2].x, src[2].y, 1, 0, 0, 0, -src[2].x * dst[2].x, -src[2].y * dst[2].x],
    [0, 0, 0, src[2].x, src[2].y, 1, -src[2].x * dst[2].y, -src[2].y * dst[2].y],
    [src[3].x, src[3].y, 1, 0, 0, 0, -src[3].x * dst[3].x, -src[3].y * dst[3].x],
    [0, 0, 0, src[3].x, src[3].y, 1, -src[3].x * dst[3].y, -src[3].y * dst[3].y],
  ];
  const b = [dst[0].x, dst[0].y, dst[1].x, dst[1].y, dst[2].x, dst[2].y, dst[3].x, dst[3].y];
  const x = gaussianElimination(A, b);
  return [
    [x[0], x[1], x[2]],
    [x[3], x[4], x[5]],
    [x[6], x[7], 1],
  ];
}

export function applyPerspectiveTransform(x, y, mat) {
  const w = mat[2][0] * x + mat[2][1] * y + mat[2][2];
  return {
    x: (mat[0][0] * x + mat[0][1] * y + mat[0][2]) / w,
    y: (mat[1][0] * x + mat[1][1] * y + mat[1][2]) / w,
  };
}

export function invertPerspectiveTransform(mat) {
  const det =
    mat[0][0] * (mat[1][1] * mat[2][2] - mat[1][2] * mat[2][1]) -
    mat[0][1] * (mat[1][0] * mat[2][2] - mat[1][2] * mat[2][0]) +
    mat[0][2] * (mat[1][0] * mat[2][1] - mat[1][1] * mat[2][0]);

  if (Math.abs(det) < 1e-10) return null;

  const invDet = 1 / det;
  return [
    [
      (mat[1][1] * mat[2][2] - mat[1][2] * mat[2][1]) * invDet,
      (mat[0][2] * mat[2][1] - mat[0][1] * mat[2][2]) * invDet,
      (mat[0][1] * mat[1][2] - mat[0][2] * mat[1][1]) * invDet,
    ],
    [
      (mat[1][2] * mat[2][0] - mat[1][0] * mat[2][2]) * invDet,
      (mat[0][0] * mat[2][2] - mat[0][2] * mat[2][0]) * invDet,
      (mat[0][2] * mat[1][0] - mat[0][0] * mat[1][2]) * invDet,
    ],
    [
      (mat[1][0] * mat[2][1] - mat[1][1] * mat[2][0]) * invDet,
      (mat[0][1] * mat[2][0] - mat[0][0] * mat[2][1]) * invDet,
      (mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0]) * invDet,
    ],
  ];
}

export function applyPerspectiveCorrection() {
  const layer = getActiveImageLayer();
  if (!layer || !layer.imageBitmap) return Promise.resolve(null);

  armUndoSnapshot();

  const size = getCanvasSize();
  const source = createLayerCanvas(layer, size);
  if (!source || !source.ctx) return Promise.resolve(null);
  const tempCanvas = source.canvas;
  const tempCtx = source.ctx;
  const srcImageData = tempCtx.getImageData(0, 0, size, size);
  const dstImageData = tempCtx.createImageData(size, size);

  const targetPoints = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];

  const transform = computePerspectiveTransform(perspectivePoints, targetPoints);
  const inverse = invertPerspectiveTransform(transform);
  if (!inverse) return Promise.resolve(null);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcPoint = applyPerspectiveTransform(x, y, inverse);
      const sx = Math.floor(srcPoint.x);
      const sy = Math.floor(srcPoint.y);

      if (sx >= 0 && sx < size - 1 && sy >= 0 && sy < size - 1) {
        const fx = srcPoint.x - sx;
        const fy = srcPoint.y - sy;
        const idxTL = (sy * size + sx) * 4;
        const idxTR = idxTL + 4;
        const idxBL = idxTL + size * 4;
        const idxBR = idxBL + 4;

        for (let c = 0; c < 4; c++) {
          const valTL = srcImageData.data[idxTL + c];
          const valTR = srcImageData.data[idxTR + c];
          const valBL = srcImageData.data[idxBL + c];
          const valBR = srcImageData.data[idxBR + c];
          const top = valTL * (1 - fx) + valTR * fx;
          const bottom = valBL * (1 - fx) + valBR * fx;
          dstImageData.data[(y * size + x) * 4 + c] = Math.round(top * (1 - fy) + bottom * fy);
        }
      }
    }
  }

  tempCtx.putImageData(dstImageData, 0, 0);
  resetPerspectivePoints();
  return updateLayerFromCanvas(layer, tempCanvas);
}
