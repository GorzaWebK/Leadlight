// Drawing the table's fixtures, every frame, in world units.
import { rgba, mix, STONE } from './colour.js';
import { glowSprite } from './sprites.js';

const TAU = Math.PI * 2;

function giltGrad(g, x0, y0, x1, y1, bright = 0) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, rgba(mix(STONE.giltLight, '#ffffff', bright * 0.5)));
  gr.addColorStop(0.45, rgba(mix(STONE.gilt, '#fff2c0', bright * 0.6)));
  gr.addColorStop(1, rgba(mix(STONE.giltDark, STONE.gilt, bright * 0.5)));
  return gr;
}

function glowAt(g, x, y, size, colour, alpha) {
  if (alpha <= 0.01) return;
  const s = glowSprite(colour, 128, 0.7);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(s, x - size / 2, y - size / 2, size, size);
  g.restore();
}

export class FixtureArt {
  constructor(T, opts = {}) {
    this.T = T;
    this.opts = opts;
    const pal = T.def.palette;
    this.jewels = [pal[1], pal[3], pal[0], pal[2], pal[4] || pal[0]];
    // Small carved corbels (wedges above wall-side targets).
    this.corbels = T.walls.filter((w) => w.kind === 'corbel').map((w) => w.pts);
    // One path for all rails.
    this.rails = new Path2D();
    for (const w of T.walls) {
      if (w.kind !== 'rail') continue;
      w.pts.forEach(([x, y], i) => (i ? this.rails.lineTo(x, y) : this.rails.moveTo(x, y)));
    }
  }

  draw(g, time) {
    const T = this.T;
    for (const pts of this.corbels) this.corbel(g, pts);
    this.drawRails(g);
    this.drawSlings(g);
    for (const p of T.posts) this.post(g, p.x, p.y, p.r ?? 6);
    for (const l of T.inlanes) this.rollover(g, l, false);
    for (const l of T.outlanes) this.rollover(g, l, true);
    T.lanes.forEach((l, i) => this.candle(g, l, time, i));
    for (const t of T.targets) this.target(g, t, time);
    for (const d of T.drops) this.drop(g, d);
    for (const s of T.spinners) this.spinner(g, s);
    T.bumpers.forEach((b, i) => this.bumper(g, b, i, time));
    for (const b of T.bells) this.bell(g, b);
    if (T.rotor) this.rotor(g, T.rotor, time);
    if (T.scoop) this.scoop(g, T.scoop, time);
    if (T.cellar) this.cellar(g, T.cellar);
    for (const k of T.kickbacks) this.kickback(g, k, time);
    if (T.centrePost) this.centrePost(g, T.centrePost);
    this.plunger(g, T.plunger, T.def.skillPull, time);
    this.gate(g, T.gate);
    for (const f of T.flippers) this.flipper(g, f);
  }

  drawRails(g) {
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 11;
    g.translate(1.5, 2.5);
    g.stroke(this.rails);
    g.translate(-1.5, -2.5);
    g.strokeStyle = '#17131f';
    g.lineWidth = 8;
    g.stroke(this.rails);
    g.strokeStyle = this.opts.highContrast ? '#ffe9b0' : STONE.gilt;
    g.lineWidth = 2.6;
    g.translate(-0.8, -0.8);
    g.stroke(this.rails);
    g.restore();
  }

  corbel(g, pts) {
    const [a, b] = pts;
    const wallX = Math.abs(a[0] - 20) < 2 || Math.abs(a[0] - 578) < 2 ? a[0] : b[0];
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(wallX, b[1] + 6);
    g.closePath();
    const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    gr.addColorStop(0, '#5a5084');
    gr.addColorStop(1, '#2a2446');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = '#6a5f98';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
  }

  post(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(x + 1.5, y + 2.5, r + 1, 0, TAU);
    g.fill();
    g.fillStyle = giltGrad(g, x - r, y - r, x + r, y + r);
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = '#3a2a14';
    g.beginPath();
    g.arc(x, y, r * 0.42, 0, TAU);
    g.fill();
  }

  drawSlings(g) {
    for (const s of this.T.slings) {
      const { a, b, c } = s;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(c[0], c[1]);
      g.closePath();
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.save();
      g.translate(2, 3);
      g.fill();
      g.restore();
      const st = g.createLinearGradient(a[0], a[1], c[0], c[1]);
      st.addColorStop(0, '#4b4274');
      st.addColorStop(1, '#1d1934');
      g.fillStyle = st;
      g.fill();
      // Carved quatrefoil on the body.
      const cx = (a[0] + b[0] + c[0]) / 3;
      const cy = (a[1] + b[1] + c[1]) / 3;
      g.strokeStyle = 'rgba(150,135,210,0.35)';
      g.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(cx + Math.cos((k * TAU) / 4) * 5, cy + Math.sin((k * TAU) / 4) * 5, 4.5, 0, TAU);
        g.stroke();
      }
      // The gilded kicking face.
      const f = s.flash;
      g.lineCap = 'round';
      g.strokeStyle = giltGrad(g, a[0], a[1], c[0], c[1], f);
      g.lineWidth = 5 + f * 2;
      const push = f * 3;
      g.beginPath();
      g.moveTo(a[0] + s.n.x * push, a[1] + s.n.y * push);
      g.lineTo(c[0] + s.n.x * push, c[1] + s.n.y * push);
      g.stroke();
      if (f > 0) glowAt(g, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 140, '#ffd27a', f * 0.9);
      for (const p of [a, b, c]) this.post(g, p[0], p[1], 6);
    }
  }

  bumper(g, B, i, time) {
    const { x, y, r } = B;
    const f = B.flash;
    const jewel = this.jewels[i % this.jewels.length];
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(x + 2, y + 4, r + 2, 0, TAU);
    g.fill();
    // Gilt boss with a carved rim.
    const rr = r * (1 + f * 0.06);
    g.fillStyle = giltGrad(g, x - rr, y - rr, x + rr, y + rr, f);
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(60,40,10,0.7)';
    g.lineWidth = 1.5;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * rr * 0.78, y + Math.sin(a) * rr * 0.78);
      g.lineTo(x + Math.cos(a) * rr * 0.96, y + Math.sin(a) * rr * 0.96);
      g.stroke();
    }
    g.fillStyle = '#1b1426';
    g.beginPath();
    g.arc(x, y, rr * 0.72, 0, TAU);
    g.fill();
    // Cabochon: a glass jewel that blazes when struck.
    const jr = rr * 0.6;
    const jg = g.createRadialGradient(x - jr * 0.35, y - jr * 0.4, jr * 0.05, x, y, jr);
    jg.addColorStop(0, rgba(mix(jewel, '#ffffff', 0.55 + f * 0.4)));
    jg.addColorStop(0.5, rgba(mix(jewel, '#fff3d0', f * 0.5)));
    jg.addColorStop(1, rgba(mix(jewel, '#000000', 0.45 - f * 0.3)));
    g.fillStyle = jg;
    g.beginPath();
    g.arc(x, y, jr, 0, TAU);
    g.fill();
    glowAt(g, x, y, r * 3.2, jewel, 0.18 + f * 0.9);
    if (f > 0) {
      g.strokeStyle = rgba('#fff3c8', f * 0.8);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, r + (1 - f) * 22, 0, TAU);
      g.stroke();
    }
  }

  rollover(g, l, out) {
    const f = l.flash;
    g.fillStyle = rgba(mix('#2b2548', '#ffe6a0', f), 0.9);
    g.beginPath();
    g.moveTo(l.x, l.y - 9);
    g.lineTo(l.x + 6, l.y + 2);
    g.lineTo(l.x - 6, l.y + 2);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(STONE.gilt, 0.6);
    g.lineWidth = 1;
    g.stroke();
    if (out) {
      g.fillStyle = rgba(STONE.gilt, 0.4);
      g.fillRect(l.x - 5, l.y + 6, 10, 2);
    }
    if (f > 0) glowAt(g, l.x, l.y, 60, '#ffd27a', f);
  }

  /** Top lanes are candles: lit once the ball rolls over them. */
  candle(g, l, time, i) {
    const x = l.x;
    const y = l.y;
    const T = this.T;
    // Wax.
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x - 5 + 1.5, y - 6 + 2.5, 10, 22);
    const wax = g.createLinearGradient(x - 5, 0, x + 5, 0);
    wax.addColorStop(0, '#b9ab90');
    wax.addColorStop(0.4, STONE.wax);
    wax.addColorStop(1, '#9d907a');
    g.fillStyle = wax;
    g.fillRect(x - 5, y - 6, 10, 22);
    g.fillStyle = '#c9b996';
    g.beginPath();
    g.ellipse(x, y - 6, 5, 1.8, 0, 0, TAU);
    g.fill();
    // Gilt pricket holder.
    g.fillStyle = giltGrad(g, x - 9, y + 14, x + 9, y + 20);
    g.fillRect(x - 9, y + 15, 18, 4);
    g.strokeStyle = '#2a2018';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - 6);
    g.lineTo(x, y - 9);
    g.stroke();
    const skill = l.group === 'top' && T.lanes.filter((q) => q.group === 'top').indexOf(l) === this.skillLane;
    const on = l.lit || l.flash > 0.05;
    if (on || skill) {
      const flick = 0.85 + 0.15 * Math.sin(time * 23 + i * 1.7) * Math.sin(time * 9.3 + i);
      const h = (on ? 11 : 7) * flick;
      const fg = g.createRadialGradient(x, y - 10 - h * 0.35, 0.5, x, y - 10 - h * 0.3, h);
      fg.addColorStop(0, skill && !on ? '#e6f0ff' : '#fffbe6');
      fg.addColorStop(0.35, skill && !on ? '#8fb2ff' : '#ffc94a');
      fg.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.ellipse(x, y - 10 - h * 0.35, h * 0.38, h * 0.75, 0, 0, TAU);
      g.fill();
      glowAt(g, x, y - 14, on ? 70 : 44, skill && !on ? '#8fb2ff' : '#ffb347', (on ? 0.6 : 0.35 + 0.25 * Math.sin(time * 6)) + l.flash * 0.6);
    }
  }

  target(g, t, time) {
    const [ax, ay] = t.a;
    const [bx, by] = t.b;
    const len = Math.hypot(bx - ax, by - ay);
    const ang = Math.atan2(by - ay, bx - ax);
    g.save();
    g.translate((ax + bx) / 2, (ay + by) / 2);
    g.rotate(ang);
    g.fillStyle = '#17131f';
    g.fillRect(-len / 2 - 3, -6, len + 6, 12);
    const lit = t.lit || t.flash > 0;
    const c = t.rod ? '#bfe0ff' : this.jewels[1];
    const gr = g.createLinearGradient(0, -5, 0, 5);
    gr.addColorStop(0, rgba(mix(c, '#ffffff', lit ? 0.6 : 0.1), 1));
    gr.addColorStop(1, rgba(mix(c, '#000000', lit ? 0.1 : 0.6), 1));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(-len / 2 + 6, -4.5);
    g.lineTo(len / 2 - 6, -4.5);
    g.lineTo(len / 2, 0);
    g.lineTo(len / 2 - 6, 4.5);
    g.lineTo(-len / 2 + 6, 4.5);
    g.closePath();
    g.fill();
    g.strokeStyle = STONE.gilt;
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
    if (lit) glowAt(g, (ax + bx) / 2, (ay + by) / 2, 80, c, 0.35 + t.flash * 0.6 + (t.rod ? 0.15 * Math.sin(time * 12) : 0));
  }

  drop(g, d) {
    const [ax, ay] = d.a;
    const [bx, by] = d.b;
    const len = Math.hypot(bx - ax, by - ay);
    const ang = Math.atan2(by - ay, bx - ax);
    const k = d.anim; // 0 up, 1 down
    g.save();
    g.translate((ax + bx) / 2, (ay + by) / 2);
    g.rotate(ang);
    g.fillStyle = '#0a0812';
    g.fillRect(-len / 2 - 2, -5, len + 4, 10);
    if (k < 0.98) {
      g.globalAlpha = 1 - k * 0.8;
      const s = 1 - k * 0.4;
      g.scale(s, s);
      const gr = g.createLinearGradient(0, -7, 0, 7);
      gr.addColorStop(0, '#6a5f98');
      gr.addColorStop(1, '#2a2446');
      g.fillStyle = gr;
      g.fillRect(-len / 2, -6.5, len, 13);
      g.fillStyle = giltGrad(g, -len / 2, -6, len / 2, 6, d.flash);
      g.fillRect(-len / 2, -1.2, len, 2.4);
    }
    g.restore();
  }

  spinner(g, s) {
    const half = Math.hypot(s.bx - s.ax, s.by - s.ay) / 2;
    const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
    const c = Math.cos(s.phase * TAU);
    g.save();
    g.translate(s.x, s.y);
    g.rotate(ang);
    // Bracket posts.
    this.post(g, -half, 0, 4);
    this.post(g, half, 0, 4);
    // The plate seen edge-on as it turns.
    const w = Math.max(1.2, Math.abs(c) * 9);
    g.fillStyle = giltGrad(g, -half, -w, half, w, s.flash * 0.5);
    g.fillRect(-half + 4, -w / 2, half * 2 - 8, w);
    if (Math.abs(c) > 0.5) {
      g.fillStyle = c > 0 ? '#5a2030' : '#1f2a60';
      g.fillRect(-4, -w / 2 + 1, 8, w - 2);
    }
    g.restore();
    if (s.spin > 1) glowAt(g, s.x, s.y, 80, '#ffd27a', Math.min(0.6, s.spin / 30));
  }

  bell(g, B) {
    const p = B.p;
    const bx = p.c.x;
    const by = p.c.y;
    const f = B.flash;
    // Rope from the yoke.
    g.strokeStyle = '#2b2018';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p.ax, p.ay);
    g.lineTo(bx, by);
    g.stroke();
    this.post(g, p.ax, p.ay, 5);
    g.save();
    g.translate(bx, by);
    g.rotate(-p.th);
    const r = p.r;
    // A bronze bell seen from the side: crown, waist and flared lip, mouth down the table.
    const shape = () => {
      g.beginPath();
      g.moveTo(-r * 0.32, -r * 0.95);
      g.quadraticCurveTo(0, -r * 1.12, r * 0.32, -r * 0.95);
      g.bezierCurveTo(r * 0.62, -r * 0.6, r * 0.55, r * 0.25, r * 1.02, r * 0.78);
      g.quadraticCurveTo(0, r * 1.0, -r * 1.02, r * 0.78);
      g.bezierCurveTo(-r * 0.55, r * 0.25, -r * 0.62, -r * 0.6, -r * 0.32, -r * 0.95);
      g.closePath();
    };
    g.save();
    g.translate(3, 4);
    shape();
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fill();
    g.restore();
    shape();
    const bg = g.createLinearGradient(-r, 0, r, 0);
    bg.addColorStop(0, '#3a2512');
    bg.addColorStop(0.3, rgba(mix('#e2b06a', '#fff4d0', f * 0.6)));
    bg.addColorStop(0.55, rgba(mix(STONE.bronze, '#ffd27a', f * 0.5)));
    bg.addColorStop(1, '#2a1a0c');
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = 'rgba(30,18,6,0.9)';
    g.lineWidth = 1.4;
    g.stroke();
    // Bands cast round the bell.
    g.strokeStyle = 'rgba(255,225,160,0.35)';
    g.lineWidth = 1.2;
    for (const k of [-0.45, 0.42]) {
      g.beginPath();
      const w = k < 0 ? 0.5 : 0.82;
      g.moveTo(-r * w, r * k);
      g.quadraticCurveTo(0, r * (k + 0.1), r * w, r * k);
      g.stroke();
    }
    // The clapper swings a little behind the bell.
    g.fillStyle = '#1e1208';
    g.beginPath();
    g.arc(Math.sin(p.th * 2.5) * r * 0.35, r * 0.95, r * 0.2, 0, TAU);
    g.fill();
    g.restore();
    const ringing = B.swingTime > 0;
    glowAt(g, bx, by, r * 4, '#ffcf70', f * 0.9 + (ringing ? 0.22 : 0));
    if (ringing) {
      g.strokeStyle = rgba('#ffe2a0', 0.35 * Math.min(1, B.swingTime));
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(bx, by, r + 6, 0, TAU);
      g.stroke();
    }
  }

  rotor(g, R, time) {
    const { x, y } = R;
    const ang = R.R.angle;
    const n = R.lit.length;
    const arm = R.arm ?? 56;
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(4, 6, arm + 14, 0, TAU);
    g.fill();
    g.rotate(ang);
    // Stone wheel with tracery spokes.
    const wg = g.createRadialGradient(-20, -20, 10, 0, 0, arm + 16);
    wg.addColorStop(0, '#5a5084');
    wg.addColorStop(1, '#1d1934');
    g.fillStyle = wg;
    g.beginPath();
    g.arc(0, 0, arm - 6, 0, TAU);
    g.fill();
    g.strokeStyle = '#0c0a14';
    g.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      g.lineTo(Math.cos(a) * (arm - 8), Math.sin(a) * (arm - 8));
      g.stroke();
    }
    // Lobes: each one a saint's halo that stays lit once struck.
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const lx = Math.cos(a) * arm;
      const ly = Math.sin(a) * arm;
      const lr = R.lobe ?? 13;
      const lit = R.lit[i];
      const f = R.flash[i];
      g.fillStyle = giltGrad(g, lx - lr, ly - lr, lx + lr, ly + lr, f + (lit ? 0.3 : 0));
      g.beginPath();
      g.arc(lx, ly, lr, 0, TAU);
      g.fill();
      g.fillStyle = lit ? rgba(mix(this.jewels[i % 3], '#fff', 0.35)) : '#2a2140';
      g.beginPath();
      g.arc(lx, ly, lr * 0.55, 0, TAU);
      g.fill();
    }
    // Hub jewel.
    const hr = R.hub ?? 28;
    g.fillStyle = giltGrad(g, -hr, -hr, hr, hr, R.hubFlash);
    g.beginPath();
    g.arc(0, 0, hr, 0, TAU);
    g.fill();
    const jg = g.createRadialGradient(-6, -8, 2, 0, 0, hr * 0.75);
    jg.addColorStop(0, '#fff6e0');
    jg.addColorStop(0.4, this.jewels[1]);
    jg.addColorStop(1, '#1a0a20');
    g.fillStyle = jg;
    g.beginPath();
    g.arc(0, 0, hr * 0.7, 0, TAU);
    g.fill();
    g.restore();
    for (let i = 0; i < n; i++) {
      if (!R.lit[i] && R.flash[i] <= 0) continue;
      const a = (i / n) * TAU + ang;
      glowAt(g, x + Math.cos(a) * arm, y + Math.sin(a) * arm, 64, '#ffd27a', 0.3 + R.flash[i] * 0.7);
    }
    glowAt(g, x, y, 120, this.jewels[1], 0.25 + R.hubFlash * 0.6 + 0.05 * Math.sin(time * 2));
  }

  scoop(g, S, time) {
    const open = S.open;
    g.fillStyle = '#020104';
    g.beginPath();
    g.arc(S.x, S.y, 15, 0, TAU);
    g.fill();
    g.strokeStyle = open ? rgba('#9cff9a', 0.6 + 0.4 * Math.sin(time * 5)) : STONE.gilt;
    g.lineWidth = 3.5;
    g.beginPath();
    g.arc(S.x, S.y, 16, 0, TAU);
    g.stroke();
    if (open) glowAt(g, S.x, S.y, 110, '#7fe08a', 0.5 + 0.3 * Math.sin(time * 5));
    if (S.flash > 0) glowAt(g, S.x, S.y, 120, '#ffd27a', S.flash);
  }

  cellar(g, C) {
    for (const p of C.pegs) {
      const f = p.flash;
      const r = p.r ?? 11;
      const cg = g.createRadialGradient(p.x - 3, p.y - 4, 1, p.x, p.y, r);
      cg.addColorStop(0, rgba(mix('#d6fff0', '#ffffff', f)));
      cg.addColorStop(0.5, rgba(mix('#3cae7a', '#c8ffe0', f)));
      cg.addColorStop(1, '#0a2a1e');
      g.fillStyle = cg;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.3;
        g.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      glowAt(g, p.x, p.y, 60, '#6fe0a0', 0.2 + f * 0.8);
    }
    const cup = C.cup;
    g.strokeStyle = STONE.gilt;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cup.x, cup.y, 15, 0, Math.PI);
    g.stroke();
  }

  kickback(g, K, time) {
    g.fillStyle = K.charged ? rgba('#ffd27a', 0.7 + 0.3 * Math.sin(time * 4)) : 'rgba(80,70,110,0.5)';
    g.beginPath();
    g.moveTo(K.x, K.y - 16);
    g.lineTo(K.x + 8, K.y - 2);
    g.lineTo(K.x - 8, K.y - 2);
    g.closePath();
    g.fill();
    if (K.charged) glowAt(g, K.x, K.y - 8, 50, '#ffd27a', 0.4);
    if (K.flash > 0) glowAt(g, K.x, K.y, 120, '#ffd27a', K.flash);
  }

  centrePost(g, C) {
    if (C.up < 0.02) return;
    const r = 10 * C.up;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.arc(C.x + 2, C.y + 3, r + 2, 0, TAU);
    g.fill();
    const pg = g.createRadialGradient(C.x - 3, C.y - 3, 1, C.x, C.y, r);
    pg.addColorStop(0, '#8a80bc');
    pg.addColorStop(1, '#2a2446');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(C.x, C.y, r, 0, TAU);
    g.fill();
    glowAt(g, C.x, C.y, 60, '#c0b0ff', 0.3 * C.up);
  }

  plunger(g, P, band, time) {
    if (band) {
      // A gilt notch on the lane wall marks the pull that reaches the candles.
      const y0 = P.rest + band[0] * 42;
      const y1 = P.rest + band[1] * 42;
      g.fillStyle = rgba(STONE.gilt, 0.75);
      g.fillRect(P.x0 - 5, y0 + 4, 4, y1 - y0 + 2);
      g.fillRect(P.x1 + 1, y0 + 4, 4, y1 - y0 + 2);
      if (P.pull >= band[0] && P.pull <= band[1]) glowAt(g, (P.x0 + P.x1) / 2, P.y + 4, 90, '#bfe0ff', 0.7 + 0.3 * Math.sin(time * 20));
    }
    const x0 = P.x0 + 4;
    const x1 = P.x1 - 4;
    const cx = (x0 + x1) / 2;
    const y = P.y;
    // Spring: tighter as it's pulled.
    g.strokeStyle = '#8a7350';
    g.lineWidth = 2;
    g.beginPath();
    const coils = 9;
    const top = y + 8;
    const bottom = 1092;
    for (let i = 0; i <= coils * 2; i++) {
      const yy = top + ((bottom - top) * i) / (coils * 2);
      g.lineTo(i % 2 ? x1 - 3 : x0 + 3, yy);
    }
    g.stroke();
    g.fillStyle = giltGrad(g, x0, y, x1, y + 10, P.pull * 0.6);
    g.fillRect(x0, y, x1 - x0, 9);
    g.fillStyle = '#3a2a14';
    g.fillRect(cx - 3, y + 9, 6, 10);
    if (P.pull > 0) glowAt(g, cx, y, 40 + P.pull * 50, '#ffb347', P.pull * 0.7);
  }

  gate(g, G) {
    if (!G) return;
    const [ax, ay] = G.a;
    const [bx, by] = G.b;
    const t = G.open;
    g.strokeStyle = '#17131f';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx + (ax - bx) * t * 0.6, by - t * 12);
    g.stroke();
    g.strokeStyle = STONE.gilt;
    g.lineWidth = 1.6;
    g.stroke();
  }

  flipper(g, f) {
    const { px, py, angle, len, r0, r1 } = f;
    g.save();
    g.translate(px, py);
    g.rotate(angle);
    const shape = () => {
      // External tangents between the pivot circle and the tip circle.
      const d = len;
      const phi = Math.acos((r0 - r1) / d);
      g.beginPath();
      g.arc(0, 0, r0, phi, Math.PI * 2 - phi);
      g.lineTo(d + r1 * Math.cos(-phi), r1 * Math.sin(-phi));
      g.arc(d, 0, r1, -phi, phi);
      g.closePath();
    };
    g.save();
    g.translate(2, 4);
    shape();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    g.restore();
    shape();
    const lift = f.pressed && f.enabled ? 0.35 : 0;
    const fg = g.createLinearGradient(0, -r0, 0, r0);
    fg.addColorStop(0, rgba(mix(STONE.giltLight, '#fff', lift)));
    fg.addColorStop(0.45, rgba(mix(STONE.gilt, '#ffe9b0', lift)));
    fg.addColorStop(1, STONE.giltDark);
    g.fillStyle = fg;
    g.fill();
    g.strokeStyle = this.opts.highContrast ? '#fff6d8' : '#2a1d0c';
    g.lineWidth = 1.6;
    g.stroke();
    // Engraved vine along the blade.
    g.strokeStyle = 'rgba(80,55,20,0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = 14; x < len - 6; x += 3) g.lineTo(x, Math.sin(x * 0.25) * 2.2);
    g.stroke();
    // Pivot jewel.
    g.fillStyle = '#1b1426';
    g.beginPath();
    g.arc(0, 0, r0 * 0.55, 0, TAU);
    g.fill();
    g.fillStyle = rgba(this.jewels[0]);
    g.beginPath();
    g.arc(0, 0, r0 * 0.38, 0, TAU);
    g.fill();
    g.restore();
  }
}

export { glowAt };
