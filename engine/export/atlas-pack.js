export function nextPowerOf2(n) {
  if (n <= 0) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function packTexturesToAtlas(items, maxSize = 2048) {
  const placements = [];
  const shelves = [];
  let currentY = 0;
  let maxWidthUsed = 0;

  const sorted = [...items].sort((a, b) => b.canvas.height - a.canvas.height);

  for (const item of sorted) {
    const w = item.canvas.width;
    const h = item.canvas.height;

    if (w > maxSize || h > maxSize) {
      console.warn('Item too large for atlas, skipping:', item);
      continue;
    }

    let placed = false;
    for (const shelf of shelves) {
      if (h <= shelf.height && (shelf.usedWidth + w) <= maxSize) {
        placements.push({ id: item.id, x: shelf.usedWidth, y: shelf.y, w, h });
        shelf.usedWidth += w;
        maxWidthUsed = Math.max(maxWidthUsed, shelf.usedWidth);
        placed = true;
        break;
      }
    }

    if (!placed) {
      if (currentY + h > maxSize) {
        console.warn('Not enough space in atlas for item:', item);
        continue;
      }
      shelves.push({ y: currentY, height: h, usedWidth: w });
      placements.push({ id: item.id, x: 0, y: currentY, w, h });
      currentY += h;
      maxWidthUsed = Math.max(maxWidthUsed, w);
    }
  }

  const atlasW = Math.max(1, Math.min(maxSize, nextPowerOf2(maxWidthUsed)));
  const atlasH = Math.max(1, Math.min(maxSize, nextPowerOf2(currentY)));
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const ctx = atlas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, atlasW, atlasH);
    for (const p of placements) {
      const item = items.find((i) => i.id === p.id);
      if (item) ctx.drawImage(item.canvas, p.x, p.y);
    }
  }

  return { atlas, placements };
}
