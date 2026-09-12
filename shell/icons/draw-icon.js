const XR = window.XR = window.XR || {};
XR.__modules = XR.__modules || {};

export function drawIcon(ctx, name, size, opts) {
  if (!ctx) return;
  const s = size || 24;
  const bg = opts && Object.prototype.hasOwnProperty.call(opts, 'bg') ? opts.bg : null;
  const fg = (opts && opts.fg) ? opts.fg : '#e8e2d6';
  const pxW = ctx.canvas && typeof ctx.canvas.width === 'number' ? ctx.canvas.width : s;
  const pxH = ctx.canvas && typeof ctx.canvas.height === 'number' ? ctx.canvas.height : s;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pxW, pxH);
  ctx.restore();

  const sx = pxW / s;
  const sy = pxH / s;
  const scale = (isFinite(sx) && isFinite(sy) && sx > 0 && sy > 0) ? Math.min(sx, sy) : 1;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
  }
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.lineWidth = Math.max(1, Math.round(s * 0.085));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pad = s * 0.18;
  const x0 = pad;
  const y0 = pad;
  const w = s - pad * 2;
  const cx = s / 2;
  const cy = s / 2;

  function rect(x, y, ww, hh) {
    ctx.beginPath();
    ctx.rect(x, y, ww, hh);
    ctx.stroke();
  }
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  function roundedRect(x, y, ww, hh, r) {
    const rr = Math.max(0, Math.min(r, ww / 2, hh / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + ww - rr, y);
    ctx.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    ctx.lineTo(x + ww, y + hh - rr);
    ctx.quadraticCurveTo(x + ww, y + hh, x + ww - rr, y + hh);
    ctx.lineTo(x + rr, y + hh);
    ctx.quadraticCurveTo(x, y + hh, x, y + hh - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.stroke();
  }

  switch (name) {
    case 'sphere': {
      circle(cx, cy, w * 0.42);
      break;
    }
    case 'dome': {
      ctx.beginPath();
      ctx.arc(cx, cy + w * 0.08, w * 0.40, Math.PI, 0);
      ctx.lineTo(cx + w * 0.40, cy + w * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.40, cy + w * 0.08);
      ctx.lineTo(cx + w * 0.40, cy + w * 0.08);
      ctx.stroke();
      break;
    }
    case 'hemi_open': {
      ctx.beginPath();
      ctx.arc(cx, cy + w * 0.08, w * 0.40, Math.PI, 0);
      ctx.stroke();
      const bx = w * 0.40;
      const by = cy + w * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx - bx, by - w * 0.06);
      ctx.lineTo(cx - bx, by + w * 0.06);
      ctx.moveTo(cx + bx, by - w * 0.06);
      ctx.lineTo(cx + bx, by + w * 0.06);
      const seg = w * 0.16;
      ctx.moveTo(cx - bx, by);
      ctx.lineTo(cx - bx + seg, by);
      ctx.moveTo(cx + bx, by);
      ctx.lineTo(cx + bx - seg, by);
      ctx.stroke();
      break;
    }
    case 'cube': {
      rect(x0, y0, w, w);
      break;
    }
    case 'box': {
      rect(x0, y0 + w * 0.18, w, w * 0.64);
      break;
    }
    case 'plane': {
      rect(x0, y0 + w * 0.18, w, w * 0.64);
      ctx.beginPath();
      ctx.moveTo(x0, y0 + w * 0.82);
      ctx.lineTo(x0 + w, y0 + w * 0.18);
      ctx.stroke();
      break;
    }
    case 'torus': {
      circle(cx, cy, w * 0.44);
      circle(cx, cy, w * 0.22);
      break;
    }
    case 'capsule': {
      roundedRect(x0, y0 + w * 0.18, w, w * 0.64, w * 0.32);
      break;
    }
    case 'cylinder': {
      const rx = w * 0.44;
      const ry = w * 0.18;
      const topY = y0 + w * 0.28;
      const botY = y0 + w * 0.72;
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY);
      ctx.lineTo(cx - rx, botY);
      ctx.moveTo(cx + rx, topY);
      ctx.lineTo(cx + rx, botY);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'cone': {
      const rx = w * 0.44;
      const ry = w * 0.16;
      const baseY = y0 + w * 0.74;
      const tipY = y0 + w * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.lineTo(cx - rx, baseY);
      ctx.lineTo(cx + rx, baseY);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'tri_prism': {
      const x1 = cx - w * 0.3;
      const x2 = cx + w * 0.3;
      const yBase = y0 + w * 0.74;
      const yTip = y0 + w * 0.18;
      const dx = w * 0.16;
      const dy = -w * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx, yTip);
      ctx.lineTo(x1, yBase);
      ctx.lineTo(x2, yBase);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dx, yTip + dy);
      ctx.lineTo(x1 + dx, yBase + dy);
      ctx.lineTo(x2 + dx, yBase + dy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, yTip);
      ctx.lineTo(cx + dx, yTip + dy);
      ctx.moveTo(x1, yBase);
      ctx.lineTo(x1 + dx, yBase + dy);
      ctx.moveTo(x2, yBase);
      ctx.lineTo(x2 + dx, yBase + dy);
      ctx.stroke();
      break;
    }
    case 'frustum': {
      const rxTop = w * 0.26;
      const rxBot = w * 0.44;
      const ryTop = w * 0.12;
      const ryBot = w * 0.18;
      const topY = y0 + w * 0.28;
      const botY = y0 + w * 0.76;
      ctx.beginPath();
      ctx.ellipse(cx, topY, rxTop, ryTop, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - rxTop, topY);
      ctx.lineTo(cx - rxBot, botY);
      ctx.moveTo(cx + rxTop, topY);
      ctx.lineTo(cx + rxBot, botY);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, botY, rxBot, ryBot, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'pyr_frustum': {
      const topY = y0 + w * 0.28;
      const botY = y0 + w * 0.78;
      const topW = w * 0.46;
      const botW = w * 0.74;
      ctx.beginPath();
      ctx.moveTo(cx - topW * 0.5, topY);
      ctx.lineTo(cx + topW * 0.5, topY);
      ctx.lineTo(cx + botW * 0.5, botY);
      ctx.lineTo(cx - botW * 0.5, botY);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'wedge': {
      const left = x0 + w * 0.08;
      const right = x0 + w * 0.92;
      const bot = y0 + w * 0.82;
      const topBack = y0 + w * 0.22;
      const topFront = y0 + w * 0.52;
      ctx.beginPath();
      ctx.moveTo(left, bot);
      ctx.lineTo(right, bot);
      ctx.lineTo(right, topBack);
      ctx.lineTo(left, topFront);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'arc_cyl': {
      const r1 = w * 0.34;
      const r2 = w * 0.22;
      const a0 = Math.PI * 0.15;
      const a1 = Math.PI * 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy + w * 0.08, r1, a0, a1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + w * 0.08, r2, a0, a1);
      ctx.stroke();
      ctx.beginPath();
      const xA1 = cx + Math.cos(a0) * r1;
      const yA1 = cy + w * 0.08 + Math.sin(a0) * r1;
      const xA2 = cx + Math.cos(a0) * r2;
      const yA2 = cy + w * 0.08 + Math.sin(a0) * r2;
      const xB1 = cx + Math.cos(a1) * r1;
      const yB1 = cy + w * 0.08 + Math.sin(a1) * r1;
      const xB2 = cx + Math.cos(a1) * r2;
      const yB2 = cy + w * 0.08 + Math.sin(a1) * r2;
      ctx.moveTo(xA1, yA1);
      ctx.lineTo(xA2, yA2);
      ctx.moveTo(xB1, yB1);
      ctx.lineTo(xB2, yB2);
      ctx.stroke();
      break;
    }
    case 'curved_box': {
      const r = w * 0.40;
      const topCy = cy - w * 0.06;
      const bottom = y0 + w * 0.88;
      const left = cx - r;
      const right = cx + r;
      ctx.beginPath();
      ctx.arc(cx, topCy, r, Math.PI, 0);
      ctx.lineTo(right, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(left, topCy);
      ctx.moveTo(right, bottom);
      ctx.lineTo(right, topCy);
      ctx.stroke();
      break;
    }
    case 'ellipsoid': {
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.44, w * 0.30, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'hex_prism': {
      const r = w * 0.44;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'disc': {
      const rx = w * 0.44;
      const ry = w * 0.18;
      const topY = y0 + w * 0.42;
      const botY = y0 + w * 0.62;
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY);
      ctx.lineTo(cx - rx, botY);
      ctx.moveTo(cx + rx, topY);
      ctx.lineTo(cx + rx, botY);
      ctx.stroke();
      break;
    }
    case 'bottle': {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.14, y0);
      ctx.lineTo(cx - w * 0.14, y0 + w * 0.18);
      ctx.lineTo(cx - w * 0.26, y0 + w * 0.3);
      ctx.quadraticCurveTo(cx - w * 0.38, y0 + w * 0.48, cx - w * 0.3, y0 + w * 0.84);
      ctx.lineTo(cx + w * 0.3, y0 + w * 0.84);
      ctx.quadraticCurveTo(cx + w * 0.38, y0 + w * 0.48, cx + w * 0.26, y0 + w * 0.3);
      ctx.lineTo(cx + w * 0.14, y0 + w * 0.18);
      ctx.lineTo(cx + w * 0.14, y0);
      ctx.stroke();
      break;
    }
    case 'cup': {
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.2, y0 + w * 0.26);
      ctx.lineTo(x0 + w * 0.18, y0 + w * 0.78);
      ctx.lineTo(x0 + w * 0.62, y0 + w * 0.78);
      ctx.lineTo(x0 + w * 0.6, y0 + w * 0.26);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x0 + w * 0.72, y0 + w * 0.5, w * 0.16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      break;
    }
    case 'vase': {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, y0 + w * 0.2);
      ctx.quadraticCurveTo(cx - w * 0.08, y0 + w * 0.18, cx - w * 0.1, y0 + w * 0.34);
      ctx.quadraticCurveTo(cx - w * 0.3, y0 + w * 0.62, cx - w * 0.14, y0 + w * 0.84);
      ctx.lineTo(cx + w * 0.14, y0 + w * 0.84);
      ctx.quadraticCurveTo(cx + w * 0.3, y0 + w * 0.62, cx + w * 0.1, y0 + w * 0.34);
      ctx.quadraticCurveTo(cx + w * 0.08, y0 + w * 0.18, cx + w * 0.2, y0 + w * 0.2);
      ctx.stroke();
      break;
    }
    case 'bowl': {
      ctx.beginPath();
      ctx.ellipse(cx, y0 + w * 0.62, w * 0.42, w * 0.24, 0, Math.PI, 0, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.14, y0 + w * 0.62);
      ctx.lineTo(x0 + w * 0.86, y0 + w * 0.62);
      ctx.stroke();
      break;
    }
    case 'chair': {
      rect(x0 + w * 0.16, y0 + w * 0.46, w * 0.68, w * 0.22);
      rect(x0 + w * 0.16, y0 + w * 0.22, w * 0.2, w * 0.26);
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.2, y0 + w * 0.68);
      ctx.lineTo(x0 + w * 0.2, y0 + w * 0.86);
      ctx.moveTo(x0 + w * 0.8, y0 + w * 0.68);
      ctx.lineTo(x0 + w * 0.8, y0 + w * 0.86);
      ctx.stroke();
      break;
    }
    case 'table': {
      rect(x0 + w * 0.12, y0 + w * 0.32, w * 0.76, w * 0.16);
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.22, y0 + w * 0.48);
      ctx.lineTo(x0 + w * 0.22, y0 + w * 0.86);
      ctx.moveTo(x0 + w * 0.78, y0 + w * 0.48);
      ctx.lineTo(x0 + w * 0.78, y0 + w * 0.86);
      ctx.stroke();
      break;
    }
    case 'lamp': {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.26, y0 + w * 0.34);
      ctx.lineTo(cx + w * 0.26, y0 + w * 0.34);
      ctx.lineTo(cx + w * 0.18, y0 + w * 0.12);
      ctx.lineTo(cx - w * 0.18, y0 + w * 0.12);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, y0 + w * 0.34);
      ctx.lineTo(cx, y0 + w * 0.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, y0 + w * 0.78, w * 0.22, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'doodle': {
      const p0 = { x: x0 + w * 0.18, y: y0 + w * 0.68 };
      const p1 = { x: x0 + w * 0.34, y: y0 + w * 0.34 };
      const p2 = { x: x0 + w * 0.56, y: y0 + w * 0.58 };
      const p3 = { x: x0 + w * 0.78, y: y0 + w * 0.28 };

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();

      const pr = w * 0.09;
      for (const p of [p0, p1, p2, p3]) {
        rect(p.x - pr / 2, p.y - pr / 2, pr, pr);
      }
      break;
    }
    default: {
      roundedRect(x0, y0 + w * 0.18, w, w * 0.64, w * 0.12);
      break;
    }
  }

  ctx.restore();
}

try {
  XR.Icons = XR.Icons || {};
  XR.Icons.drawIcon = XR.Icons.drawIcon || drawIcon;
  XR.__modules.Icons = XR.Icons;
} catch (_) {}
