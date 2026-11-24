// Pre-rendered sprites and textures, all made in code.
import { mulberry32 } from '../rng.js';
import { rgba } from './colour.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const glowCache = new Map();
/** A soft radial glow, white-hot in the middle, in the given colour. */
export function glowSprite(colour = '#ffd27a', size = 128, hot = 0.6) {
  const key = colour + size + hot;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba('#fffaf0', hot));
  grad.addColorStop(0.18, rgba(colour, 0.75));
  grad.addColorStop(0.45, rgba(colour, 0.25));
  grad.addColorStop(1, rgba(colour, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

/**
 * Neutral-grey glass texture (128 = no change under 'overlay'): striations from
 * hand-blown sheet glass, soft mottling for uneven thickness, and seed bubbles.
 */
export function glassTexture(size = 256, seed = 7) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  // Mottling.
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 10 + rnd() * 50;
    const light = rnd() < 0.5;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)');
        grad.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
  }
  // Striations: long wavy streaks.
  g.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const y0 = rnd() * size;
    const amp = 2 + rnd() * 5;
    const freq = (1 + Math.floor(rnd() * 3)) * ((Math.PI * 2) / size);
    const ph = rnd() * 6.28;
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.04 + rnd() * 0.08})` : `rgba(0,0,0,${0.04 + rnd() * 0.08})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const y = y0 + Math.sin(x * freq + ph) * amp;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // Seed bubbles.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.8 + rnd() * 2.4;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.6;
    g.stroke();
  }
  return c;
}

/** Fine stone grain, neutral grey for 'overlay'. */
export function stoneTexture(size = 256, seed = 3) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rnd = mulberry32(seed);
  // Value noise at two scales plus speckle.
  const grid = (n) => {
    const v = [];
    for (let i = 0; i < n * n; i++) v.push(rnd());
    return (x, y) => {
      const gx = (x / size) * n;
      const gy = (y / size) * n;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const at = (i, j) => v[((j % n) + n) % n * n + (((i % n) + n) % n)];
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const n1 = grid(8);
  const n2 = grid(32);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = 128 + (n1(x, y) - 0.5) * 50 + (n2(x, y) - 0.5) * 34 + (rnd() - 0.5) * 30;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}
