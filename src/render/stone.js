// Carved stone around the window: the masonry wall, the moulded frame with crockets
// and colonnettes, the sill, the aprons and drain under the flippers, the shooter lane
// and (for some windows) the cellar below. Drawn once into the window layer.
import { mulberry32 } from '../rng.js';
import { stoneTexture } from './sprites.js';
import { rgba, mix } from './colour.js';
import { LEFT, RIGHT, LANE_X, LANE_TOP, GLASS_BOTTOM } from '../tables/common.js';

let STONE_TEX = null;
const SERIF = '"Cormorant Garamond", "Cormorant", Garamond, "Times New Roman", serif';

function stonePattern(g) {
  if (!STONE_TEX) STONE_TEX = stoneTexture(256, 5);
  return g.createPattern(STONE_TEX, 'repeat');
}

function grain(g, x, y, w, h, alpha = 0.45) {
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = alpha;
  g.fillStyle = stonePattern(g);
  g.fillRect(x, y, w, h);
  g.restore();
}

export function drawBackdrop(g, def, R) {
  const rnd = mulberry32(17);
  const W = R.x1 - R.x0;
  const H = R.y1 - R.y0;
  const bg = g.createLinearGradient(0, R.y0, 0, R.y1);
  bg.addColorStop(0, '#0b0918');
  bg.addColorStop(0.5, '#120f24');
  bg.addColorStop(1, '#0a0814');
  g.fillStyle = bg;
  g.fillRect(R.x0, R.y0, W, H);
  // Ashlar courses.
  const course = 46;
  for (let y = R.y0; y < R.y1; y += course) {
    let x = R.x0 - rnd() * 100;
    while (x < R.x1) {
      const w = 70 + rnd() * 80;
      const t = rnd();
      g.fillStyle = rgba(mix('#15112a', '#251f40', t));
      g.fillRect(x + 1.5, y + 1.5, w - 3, course - 3);
      g.fillStyle = 'rgba(140,125,200,0.08)';
      g.fillRect(x + 1.5, y + 1.5, w - 3, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + 1.5, y + course - 4, w - 3, 2.5);
      x += w;
    }
  }
  grain(g, R.x0, R.y0, W, H, 0.5);
  // Dusk light spilling from the window onto the stone.
  const glow = g.createRadialGradient(320, 420, 120, 320, 460, 820);
  glow.addColorStop(0, rgba(mix(def.sky || '#e8a050', '#4a3a80', 0.6), 0.22));
  glow.addColorStop(1, 'rgba(20,16,40,0)');
  g.fillStyle = glow;
  g.fillRect(R.x0, R.y0, W, H);
  // The window opening behind the glass.
  g.fillStyle = '#030206';
  g.beginPath();
  def.outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

function framePath(def) {
  // The outline without its bottom edge: up the left side, over the arch, down the right.
  const p = new Path2D();
  const o = def.outline;
  o.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
}

export function drawFrame(g, def) {
  const path = framePath(def);
  g.save();
  // Only paint outside the glass.
  const clip = new Path2D();
  clip.rect(-1000, -1000, 3000, 3000);
  def.outline.forEach(([x, y], i) => (i ? clip.lineTo(x, y) : clip.moveTo(x, y)));
  clip.closePath();
  g.clip(clip, 'evenodd');
  g.lineJoin = 'round';
  g.lineCap = 'butt';
  const bands = [
    [62, '#09070f'],
    [54, '#2a2446'],
    [46, '#453c6a'],
    [38, '#1b172f'],
    [30, '#544a80'],
    [24, '#3a3260'],
    [17, '#16122a'],
    [10, '#5e5490'],
    [6, '#0a0812'],
  ];
  for (const [w, c] of bands) {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.stroke(path);
  }
  g.restore();
  // Crockets: little carved leaves along the outside of the arch.
  const arch = def.arch;
  const springY = arch[0][1];
  let acc = 0;
  for (let i = 1; i < arch.length; i++) {
    const [x0, y0] = arch[i - 1];
    const [x1, y1] = arch[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    acc += seg;
    if (acc < 58 || y1 > springY - 20) continue;
    acc = 0;
    const nx = (y1 - y0) / seg;
    const ny = -(x1 - x0) / seg; // outward (the arch runs left to right over the top)
    const cx = x1 + nx * 34;
    const cy = y1 + ny * 34;
    leaf(g, cx, cy, Math.atan2(ny, nx));
  }
  // A finial at the crown.
  let top = arch[0];
  for (const p of arch) if (p[1] < top[1]) top = p;
  finial(g, top[0], top[1] - 36);
  // Colonnettes with carved capitals at the springing.
  for (const x of [LEFT - 34, RIGHT + 34]) colonnette(g, x, springY - 10, x < 300 ? GLASS_BOTTOM + 30 : 1080);
}

function leaf(g, x, y, ang) {
  g.save();
  g.translate(x, y);
  g.rotate(ang + Math.PI / 2);
  for (const [dx, dy, r] of [[-5, 1, 4.6], [5, 1, 4.6], [0, -5, 5.2]]) {
    const grd = g.createRadialGradient(dx - 1.5, dy - 1.5, 0.5, dx, dy, r);
    grd.addColorStop(0, '#6f659e');
    grd.addColorStop(1, '#231e3a');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(dx, dy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function finial(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#2b2548';
  g.fillRect(-4, 0, 8, 26);
  for (const [dx, dy, r] of [[0, -10, 7], [-10, 0, 6], [10, 0, 6], [0, 2, 6]]) {
    const grd = g.createRadialGradient(dx - 2, dy - 2, 0.5, dx, dy, r);
    grd.addColorStop(0, '#776ca8');
    grd.addColorStop(1, '#221d38');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(dx, dy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function colonnette(g, x, y0, y1) {
  const w = 15;
  const shaft = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  shaft.addColorStop(0, '#120f22');
  shaft.addColorStop(0.35, '#4d4475');
  shaft.addColorStop(0.6, '#2c2648');
  shaft.addColorStop(1, '#0d0b18');
  g.fillStyle = shaft;
  g.fillRect(x - w / 2, y0, w, y1 - y0);
  // Capital: a flared block with a row of leaves.
  g.fillStyle = '#2f2850';
  g.beginPath();
  g.moveTo(x - 16, y0 - 6);
  g.lineTo(x + 16, y0 - 6);
  g.lineTo(x + 9, y0 + 18);
  g.lineTo(x - 9, y0 + 18);
  g.closePath();
  g.fill();
  g.fillStyle = '#4c4376';
  g.fillRect(x - 18, y0 - 12, 36, 7);
  for (const dx of [-9, 0, 9]) leaf(g, x + dx, y0 + 6, -Math.PI / 2);
  // Base.
  g.fillStyle = '#2f2850';
  g.fillRect(x - 13, y1 - 16, 26, 16);
  g.fillStyle = '#4c4376';
  g.fillRect(x - 13, y1 - 16, 26, 3);
  // Rings around the shaft.
  g.fillStyle = 'rgba(120,110,170,0.35)';
  for (let y = y0 + 90; y < y1 - 40; y += 150) g.fillRect(x - w / 2 - 1, y, w + 2, 4);
}

export function drawFloor(g, def) {
  // Below the glass: polished floor slab.
  const fl = g.createLinearGradient(0, GLASS_BOTTOM, 0, 1100);
  fl.addColorStop(0, '#1b1632');
  fl.addColorStop(1, '#09070f');
  g.fillStyle = fl;
  g.fillRect(LEFT, GLASS_BOTTOM, LANE_X - LEFT, 1110 - GLASS_BOTTOM);
  grain(g, LEFT, GLASS_BOTTOM, LANE_X - LEFT, 200, 0.35);
  // The window's colours reflected faintly in the polished stone.
  const pal = def.palette;
  for (let i = 0; i < 9; i++) {
    const x = LEFT + 20 + i * 62;
    const c = pal[i % pal.length];
    const r = g.createLinearGradient(0, GLASS_BOTTOM, 0, 1060);
    r.addColorStop(0, rgba(c, 0.1));
    r.addColorStop(1, rgba(c, 0));
    g.fillStyle = r;
    g.fillRect(x, GLASS_BOTTOM + 14, 34, 150);
  }
  // The sill: a moulded ledge under the glass.
  const sill = g.createLinearGradient(0, GLASS_BOTTOM - 2, 0, GLASS_BOTTOM + 22);
  sill.addColorStop(0, '#6a5f98');
  sill.addColorStop(0.25, '#3d355f');
  sill.addColorStop(0.6, '#221d3b');
  sill.addColorStop(1, 'rgba(10,8,18,0)');
  g.fillStyle = sill;
  g.fillRect(LEFT - 40, GLASS_BOTTOM - 2, LANE_X - LEFT + 80, 24);
  // The drain: a dark pit between the flippers.
  const pit = g.createLinearGradient(0, 990, 0, 1100);
  pit.addColorStop(0, 'rgba(0,0,0,0)');
  pit.addColorStop(1, 'rgba(0,0,0,0.95)');
  g.fillStyle = pit;
  g.fillRect(180, 990, 238, 120);
  // Aprons: the solid stone either side of the flippers.
  const apron = (pts, label, lx) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const a = g.createLinearGradient(0, 860, 0, 1100);
    a.addColorStop(0, '#2e2750');
    a.addColorStop(1, '#141126');
    g.fillStyle = a;
    g.fill();
    g.save();
    g.clip();
    grain(g, -100, 850, 800, 260, 0.5);
    g.restore();
    // Bevelled edge along the playfield side.
    g.strokeStyle = '#6a5f98';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    g.lineTo(pts[2][0], pts[2][1]);
    g.stroke();
    carve(g, label, lx, 1056, 22);
  };
  apron([[LEFT, 880], [180, 1010], [180, 1110], [LEFT - 30, 1110], [LEFT - 30, 880]], 'FIAT', 96);
  apron([[LANE_X, 880], [418, 1010], [418, 1110], [LANE_X + 4, 1110]], 'LVX', 500);
  // Shooter lane: a groove cut into the stone.
  const lx0 = LANE_X + 2;
  const lane = g.createLinearGradient(lx0, 0, RIGHT, 0);
  lane.addColorStop(0, '#07060c');
  lane.addColorStop(0.5, '#15122a');
  lane.addColorStop(1, '#07060c');
  g.fillStyle = lane;
  g.fillRect(lx0, LANE_TOP - 4, RIGHT - lx0, 1110 - LANE_TOP);
  const wallG = g.createLinearGradient(LANE_X - 5, 0, LANE_X + 5, 0);
  wallG.addColorStop(0, '#5a5084');
  wallG.addColorStop(1, '#1c1832');
  g.fillStyle = wallG;
  g.fillRect(LANE_X - 4, LANE_TOP, 8, 1110 - LANE_TOP);
  g.fillStyle = '#5a5084';
  g.fillRect(RIGHT, LANE_TOP - 60, 4, 1110 - LANE_TOP + 60);
}

/** Letters cut into stone: a dark cut with a lit lower edge. */
export function carve(g, text, x, y, size) {
  g.save();
  g.font = `600 ${size}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  if (g.letterSpacing !== undefined) g.letterSpacing = `${size * 0.25}px`;
  g.fillStyle = 'rgba(150,135,210,0.35)';
  g.fillText(text, x + 0.8, y + 1);
  g.fillStyle = '#07060c';
  g.fillText(text, x, y);
  g.restore();
}

export function drawCellar(g, def) {
  const C = def.cellar;
  const { x0, y0, x1, y1 } = C.rect;
  // Vaulted chamber.
  const bg = g.createLinearGradient(0, y0, 0, y1);
  bg.addColorStop(0, '#0d0a16');
  bg.addColorStop(1, '#040308');
  g.fillStyle = bg;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = 'rgba(110,95,170,0.22)';
  g.lineWidth = 10;
  for (let i = 0; i < 3; i++) {
    const cx = x0 + ((i + 0.5) * (x1 - x0)) / 3;
    g.beginPath();
    g.arc(cx, y1, (x1 - x0) / 6, Math.PI, 0);
    g.stroke();
  }
  // Roots creeping in from above.
  const rnd = mulberry32(31);
  g.strokeStyle = 'rgba(70,50,40,0.7)';
  for (let i = 0; i < 9; i++) {
    let x = x0 + rnd() * (x1 - x0);
    let y = y0;
    g.lineWidth = 2 + rnd() * 3;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 30;
      y += 12 + rnd() * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Its walls, as thick stone.
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const w of C.walls) {
    g.beginPath();
    w.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = '#2f2850';
    g.lineWidth = 14;
    g.stroke();
    g.strokeStyle = '#5a5084';
    g.lineWidth = 3;
    g.stroke();
  }
  carve(g, C.label || 'RADIX', (x0 + x1) / 2, y1 - 14, 18);
}
