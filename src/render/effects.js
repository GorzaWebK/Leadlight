// Moving light: sparks that run along the lead to the panes they light, panes
// igniting with a bloom and a ripple, embers from hits, score numerals, light shafts
// with dust drifting in them, and wind streaks.
import { leadPath } from '../tables/panes.js';
import { glowSprite } from './sprites.js';
import { rgba, mix } from './colour.js';
import { mulberry32 } from '../rng.js';

const SPARK_SPEED = 1500;
const IGNITE_TIME = 0.6;
const SERIF = '"Cormorant Garamond", Garamond, "Times New Roman", serif';

export class Effects {
  constructor(def, glass, opts = {}) {
    this.def = def;
    this.glass = glass;
    this.opts = opts;
    this.sparks = [];
    this.ignites = [];
    this.ripples = [];
    this.particles = [];
    this.popups = [];
    this.queue = []; // { at, fn }
    this.time = 0;
    const r = mulberry32(5);
    this.motes = Array.from({ length: 56 }, () => ({
      x: -40 + r() * 720,
      y: -60 + r() * 1100,
      vx: 4 + r() * 6,
      vy: 6 + r() * 10,
      s: 2 + r() * 3.5,
      ph: r() * 6.28,
    }));
    this.streaks = [];
    this.shafts = [
      { x: 140, w: 120, a: 0.3, p: 0 },
      { x: 330, w: 170, a: 0.3, p: 2.1 },
      { x: 520, w: 110, a: 0.3, p: 4.2 },
    ];
  }

  at(delay, fn) {
    this.queue.push({ at: this.time + delay, fn });
  }

  /** Light travels along the lead from (x, y) to pane i, which then ignites. */
  spark(i, x, y, delay = 0, onIgnite) {
    const pane = this.glass.panes[i];
    if (this.sparks.length > 36) {
      this.at(delay, () => this.ignite(i, onIgnite));
      return;
    }
    const pts = leadPath(this.def.glass, x, y, pane);
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    this.sparks.push({ i, pts, cum, total: cum[cum.length - 1], s: -delay * SPARK_SPEED, colour: this.glass.styles[pane.colour % this.glass.styles.length].glow, trail: [], onIgnite });
  }

  ignite(i, onIgnite) {
    if (this.ignites.some((g) => g.i === i)) return;
    const p = this.glass.panes[i];
    const colour = this.glass.styles[p.colour % this.glass.styles.length].glow;
    this.ignites.push({ i, t: 0, colour });
    this.ripples.push({ x: p.cx, y: p.cy, t: 0, colour, max: 40 + Math.sqrt(p.area) * 0.8 });
    if (onIgnite) onIgnite(i);
  }

  burst(x, y, colour, n = 8, speed = 220) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0, max: 0.4 + Math.random() * 0.5, colour, size: 6 + Math.random() * 8 });
    }
  }

  popup(x, y, text, big = false) {
    this.popups.push({ x, y, text, t: 0, big });
  }

  update(dt, wind) {
    this.time += dt;
    for (let k = this.queue.length - 1; k >= 0; k--) {
      if (this.queue[k].at <= this.time) {
        const q = this.queue[k];
        this.queue.splice(k, 1);
        q.fn();
      }
    }
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k];
      s.s += SPARK_SPEED * dt;
      if (s.s >= 0) {
        const p = this.posAt(s, s.s);
        s.trail.push(p);
        if (s.trail.length > 9) s.trail.shift();
      }
      if (s.s >= s.total) {
        this.sparks.splice(k, 1);
        this.ignite(s.i, s.onIgnite);
      }
    }
    for (let k = this.ignites.length - 1; k >= 0; k--) {
      const g = this.ignites[k];
      g.t += dt / IGNITE_TIME;
      if (g.t >= 1) {
        this.ignites.splice(k, 1);
        this.glass.commit(g.i, true);
      }
    }
    for (let k = this.ripples.length - 1; k >= 0; k--) {
      const r = this.ripples[k];
      r.t += dt / 0.9;
      if (r.t >= 1) this.ripples.splice(k, 1);
    }
    for (let k = this.particles.length - 1; k >= 0; k--) {
      const p = this.particles[k];
      p.life += dt;
      p.vy += 500 * dt;
      p.vx *= 1 - 2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= p.max) this.particles.splice(k, 1);
    }
    for (let k = this.popups.length - 1; k >= 0; k--) {
      const p = this.popups[k];
      p.t += dt / (p.big ? 1.6 : 1.0);
      p.y -= (p.big ? 30 : 45) * dt;
      if (p.t >= 1) this.popups.splice(k, 1);
    }
    const slow = this.opts.reducedMotion ? 0.35 : 1;
    for (const m of this.motes) {
      m.ph += dt * 0.7;
      m.x += (m.vx + Math.sin(m.ph) * 6 + (wind ? wind.power * wind.dir * 120 : 0)) * dt * slow;
      m.y += (m.vy + Math.cos(m.ph * 0.7) * 4) * dt * slow;
      if (m.y > 1080) m.y = -60;
      if (m.x > 700) m.x = -50;
      if (m.x < -60) m.x = 690;
    }
    // Wind streaks across the upper glass.
    if (wind && wind.power > 0.05) {
      const n = wind.power * 60 * dt * (this.opts.reducedMotion ? 0.3 : 1);
      for (let k = 0; k < n + (Math.random() < n % 1 ? 1 : 0); k++) {
        this.streaks.push({ x: wind.dir > 0 ? -20 : 660, y: 40 + Math.random() * 640, l: 30 + Math.random() * 70, v: (700 + Math.random() * 500) * wind.dir, life: 0 });
      }
    }
    for (let k = this.streaks.length - 1; k >= 0; k--) {
      const s = this.streaks[k];
      s.x += s.v * dt;
      s.y += 90 * dt;
      s.life += dt;
      if (s.life > 1.4) this.streaks.splice(k, 1);
    }
  }

  posAt(s, d) {
    const { pts, cum } = s;
    if (d <= 0) return pts[0];
    for (let k = 1; k < pts.length; k++) {
      if (cum[k] >= d) {
        const t = (d - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
        return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t];
      }
    }
    return pts[pts.length - 1];
  }

  /** On the glass: igniting panes, ripples and sparks along the lead. */
  drawGlass(g) {
    for (const ig of this.ignites) {
      const p = this.glass.panes[ig.i];
      const e = 1 - (1 - ig.t) ** 3;
      this.glass.drawPane(g, p, true, e);
      g.save();
      g.globalAlpha = e;
      this.glass.strokeLead(g, this.glass.paneLead[ig.i], false);
      g.restore();
      // Bloom as it catches.
      const size = Math.sqrt(p.area) * (2.2 + ig.t * 1.2);
      const a = this.opts.reducedMotion ? 0.35 * (1 - ig.t) : (1 - ig.t) ** 1.5;
      this.sprite(g, p.cx, p.cy, size, ig.colour, a);
      // Lead around it glows gold for a moment.
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#ffd27a', 0.7 * (1 - ig.t));
      g.lineWidth = 2.5;
      g.lineJoin = 'round';
      g.stroke(this.glass.paneLead[ig.i]);
      g.restore();
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const r of this.ripples) {
      g.strokeStyle = rgba(mix(r.colour, '#fff2d0', 0.3), 0.45 * (1 - r.t));
      g.lineWidth = 3 * (1 - r.t) + 0.5;
      g.beginPath();
      g.arc(r.x, r.y, 6 + r.t * r.max, 0, Math.PI * 2);
      g.stroke();
    }
    for (const s of this.sparks) {
      if (s.s < 0 || !s.trail.length) continue;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = rgba('#ffe3a0', 0.6);
      g.lineWidth = 3;
      g.beginPath();
      s.trail.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      const [hx, hy] = s.trail[s.trail.length - 1];
      g.restore();
      this.sprite(g, hx, hy, 34, '#ffd27a', 0.95);
      g.save();
      g.globalCompositeOperation = 'lighter';
    }
    g.restore();
  }

  sprite(g, x, y, size, colour, alpha) {
    if (alpha <= 0.01) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(glowSprite(colour, 128, 0.75), x - size / 2, y - size / 2, size, size);
    g.restore();
  }

  /** Above the fixtures: embers and score numerals. */
  drawOver(g) {
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      this.sprite(g, p.x, p.y, p.size * k + 2, p.colour, k);
    }
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of this.popups) {
      const a = p.t < 0.15 ? p.t / 0.15 : 1 - (p.t - 0.15) / 0.85;
      g.globalAlpha = Math.max(0, a);
      g.font = `italic 600 ${p.big ? 34 : 20}px ${SERIF}`;
      g.fillStyle = 'rgba(10,6,20,0.7)';
      g.fillText(p.text, p.x + 1.5, p.y + 2);
      g.fillStyle = p.big ? '#fff1c4' : '#f2d595';
      g.fillText(p.text, p.x, p.y);
    }
    g.restore();
  }

  /** Light shafts falling through the window, with dust in them. */
  drawShafts(g, power, time) {
    const sky = this.def.sky || '#f2a24a';
    const col = mix(sky, '#ffe9c0', 0.4);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const tilt = 0.36;
    for (const s of this.shafts) {
      const breathe = this.opts.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(time * 0.35 + s.p);
      const a = (0.035 + 0.07 * power) * breathe;
      const y0 = -120;
      const y1 = 1120;
      const dx = (y1 - y0) * tilt;
      const gr = g.createLinearGradient(s.x - s.w / 2, 0, s.x + s.w / 2, 0);
      gr.addColorStop(0, rgba(col, 0));
      gr.addColorStop(0.5, rgba(col, a));
      gr.addColorStop(1, rgba(col, 0));
      g.save();
      g.transform(1, 0, tilt, 1, -y0 * tilt, 0);
      const fade = g.createLinearGradient(0, y0, 0, y1);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(s.x - s.w / 2, y0, s.w, y1 - y0);
      g.restore();
      void dx;
    }
    // Dust motes, bright only inside a shaft.
    const sprite = glowSprite(rgba(col), 64, 0.8);
    for (const m of this.motes) {
      let b = 0;
      for (const s of this.shafts) {
        const sx = s.x + (m.y + 120) * tilt;
        b = Math.max(b, 1 - Math.abs(m.x - sx) / (s.w * 0.55));
      }
      if (b <= 0) continue;
      g.globalAlpha = Math.min(1, b * (0.25 + 0.55 * power) * (0.6 + 0.4 * Math.sin(m.ph * 3)));
      g.drawImage(sprite, m.x - m.s, m.y - m.s, m.s * 2, m.s * 2);
    }
    g.globalAlpha = 1;
    // Wind streaks.
    if (this.streaks.length) {
      g.strokeStyle = 'rgba(200,220,255,0.22)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (const s of this.streaks) {
        g.moveTo(s.x, s.y);
        g.lineTo(s.x - Math.sign(s.v) * s.l, s.y - s.l * 0.12);
      }
      g.stroke();
    }
    g.restore();
  }
}
