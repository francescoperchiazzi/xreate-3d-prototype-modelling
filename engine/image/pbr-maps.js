import {
  createLayerCanvas,
  createSquareCanvas,
  getActiveImageLayer,
} from './runtime.js';

export function generateNormalMap(imageData, strength = 1.0) {
  const width = imageData.width;
  const height = imageData.height;
  const pixels = imageData.data;
  const output = new ImageData(width, height);
  const outPixels = output.data;
  const strengthScaled = strength * 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const getGray = (px, py) => {
        const sx = Math.max(0, Math.min(width - 1, px));
        const sy = Math.max(0, Math.min(height - 1, py));
        const i = (sy * width + sx) * 4;
        return (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
      };

      const tl = getGray(x - 1, y - 1);
      const l = getGray(x - 1, y);
      const bl = getGray(x - 1, y + 1);
      const t = getGray(x, y - 1);
      const b = getGray(x, y + 1);
      const tr = getGray(x + 1, y - 1);
      const r = getGray(x + 1, y);
      const br = getGray(x + 1, y + 1);

      let dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      let dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      dx *= strengthScaled;
      dy *= strengthScaled;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) {
        nx /= len;
        ny /= len;
        nz /= len;
      }

      outPixels[idx] = Math.round((nx + 1) * 0.5 * 255);
      outPixels[idx + 1] = Math.round((ny + 1) * 0.5 * 255);
      outPixels[idx + 2] = Math.round(nz * 255);
      outPixels[idx + 3] = 255;
    }
  }

  return output;
}

export function generateAOMap(imageData, intensity = 1.0) {
  const width = imageData.width;
  const height = imageData.height;
  const pixels = imageData.data;
  const output = new ImageData(width, height);
  const outPixels = output.data;
  const radius = 3;
  const intensityScaled = intensity * 0.8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const centerGray = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
      let sum = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = Math.max(0, Math.min(width - 1, x + dx));
          const py = Math.max(0, Math.min(height - 1, y + dy));
          const i = (py * width + px) * 4;
          const gray = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
          sum += gray;
          count++;
        }
      }

      const avg = sum / count;
      let ao = 1.0 - ((avg - centerGray) * intensityScaled);
      ao = Math.max(0.2, Math.min(1.0, ao));
      const val = Math.round(ao * 255);
      outPixels[idx] = val;
      outPixels[idx + 1] = val;
      outPixels[idx + 2] = val;
      outPixels[idx + 3] = 255;
    }
  }

  return output;
}

export function generateRoughnessMap(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const pixels = imageData.data;
  const output = new ImageData(width, height);
  const outPixels = output.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const gray = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
      const roughness = 0.3 + gray * 0.5;
      const val = Math.round(roughness * 255);
      outPixels[idx] = val;
      outPixels[idx + 1] = val;
      outPixels[idx + 2] = val;
      outPixels[idx + 3] = 255;
    }
  }

  return output;
}

export function generatePBRMaps(normalStrength = 0.4, aoIntensity = 0.5) {
  const layer = getActiveImageLayer();
  if (!layer || !layer.imageBitmap) return null;

  const source = createLayerCanvas(layer);
  if (!source || !source.ctx) return null;
  const imageData = source.ctx.getImageData(0, 0, source.canvas.width, source.canvas.height);

  const normalMapData = generateNormalMap(imageData, normalStrength);
  const aoMapData = generateAOMap(imageData, aoIntensity);
  const roughnessMapData = generateRoughnessMap(imageData);

  const normalCanvas = createSquareCanvas(source.canvas.width);
  normalCanvas.getContext('2d')?.putImageData(normalMapData, 0, 0);

  const aoCanvas = createSquareCanvas(source.canvas.width);
  aoCanvas.getContext('2d')?.putImageData(aoMapData, 0, 0);

  const roughnessCanvas = createSquareCanvas(source.canvas.width);
  roughnessCanvas.getContext('2d')?.putImageData(roughnessMapData, 0, 0);

  return {
    normal: normalCanvas,
    ao: aoCanvas,
    roughness: roughnessCanvas,
  };
}
