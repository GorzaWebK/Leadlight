// The window layer: stone, frame, glass and lead, drawn once into an offscreen canvas.
// Lighting a pane redraws only that pane (and its lead) into the layer, so a normal
// frame is just one image copy. A small blurred copy of the layer gives the bloom.
import { makeCanvas, glassTexture } from './sprites.js';
import { mix, rgba, saturate } from './colour.js';
import { mulberry32 } from '../rng.js';
import { drawBackdrop, drawFrame, drawFloor, drawCellar } from './stone.js';

export const LAYER_RECT = { x0: -240, y0: -420, x1: 880, y1: 1430 };
const MAX_PIXELS = 6.5e6;

let TEX = null;
const PATTERNS = [];

function cbPattern(kind) {
  // Colour-blind markings: a distinct texture for each palette slot.
  const c = makeCanvas(18, 18);
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(10,8,20,0.55)';
  g.fillStyle = 'rgba(10,8,20,0.55)';
  g.lineWidth = 1.6;
  const line = (x0, y0, x1, y1) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  if (kind === 0) {
    g.beginPath();
    g.arc(9, 9, 2.4, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 1) {
    line(0, 5, 18, 5);
    line(0, 14, 18, 14);
  } else if (kind === 2) {
    line(-2, 20, 20, -2);
    line(7, 20, 20, 7);
    line(-2, 11, 11, -2);
  } else if (kind === 3) {
    line(0, 9, 18, 9);
    line(9, 0, 9, 18);
  } else if (kind === 4) {
    line(5, 0, 5, 18);
    line(14, 0, 14, 18);
  } else {
    g.beginPath();
    g.arc(9, 9, 5, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

export class GlassLayer {
  constructor(def, opts = {}) {
    this.def = def;
    this.opts = opts;
    this.glass = def.glass;
    this.panes = def.panes;
    const R = LAYER_RECT;
    const w = R.x1 - R.x0;
    const h = R.y1 - R.y0;
    let s = opts.scale ?? 1;
    if (w * h * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h));
    this.scale = s;
    this.canvas = makeCanvas(w * s, h * s);
    this.ctx = this.canvas.getContext('2d');
    this.bloom = makeCanvas((w * s) / 8, (h * s) / 8);
    this.bloomMid = makeCanvas((w * s) / 3, (h * s) / 3);
    this.bloomDirty = true;
    if (!TEX) {
      TEX = glassTexture(256, 11);
      for (let i = 0; i < 6; i++) PATTERNS.push(cbPattern(i));
    }
    this.tex = this.ctx.createPattern(TEX, 'repeat');
    this.cb = PATTERNS.map((p) => this.ctx.createPattern(p, 'repeat'));
    this.prepare();
    this.build();
  }

  worldTransform(g) {
    const s = this.scale;
    g.setTransform(s, 0, 0, s, -LAYER_RECT.x0 * s, -LAYER_RECT.y0 * s);
  }

  prepare() {
    const def = this.def;
    const pal = def.palette;
    const dusk = '#241d4a';
    this.styles = pal.map((c) => {
      const deep = mix(saturate(c, 0.3), '#0a0410', 0.12);
      return {
        base: deep,
        lit: rgba(deep),
        litHot: rgba(mix(deep, '#fff3d0', 0.42)),
        litMid: rgba(mix(deep, '#fff0c8', 0.12)),
        litEdge: rgba(mix(deep, '#120414', 0.42)),
        dark: rgba(mix(mix(c, dusk, 0.5), '#040308', 0.8)),
        darkHot: rgba(mix(mix(c, dusk, 0.4), '#040308', 0.66)),
        darkEdge: rgba(mix(c, '#020206', 0.9)),
        glow: c,
      };
    });
    // Paths for every pane and its lead.
    const wob = mulberry32(99);
    const { verts, edges, border } = this.glass;
    // Each lead edge gets a slight hand-made wobble (shared by both panes).
    this.edgePts = new Map();
    for (const [a, b] of edges) {
      const A = verts[a];
      const B = verts[b];
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const n = Math.max(1, Math.round(len / 26));
      const pts = [A];
      const nx = -(B[1] - A[1]) / (len || 1);
      const ny = (B[0] - A[0]) / (len || 1);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const o = (wob() - 0.5) * 1.4;
        pts.push([A[0] + (B[0] - A[0]) * t + nx * o, A[1] + (B[1] - A[1]) * t + ny * o]);
      }
      pts.push(B);
      this.edgePts.set(a * 1e6 + b, pts);
    }
    const edgePath = (p, list) => {
      for (const pts of list) {
        p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
      }
    };
    this.leadAll = new Path2D();
    this.leadBorder = new Path2D();
    const inner = [];
    const outer = [];
    for (const [k, pts] of this.edgePts) (border.has(k) ? outer : inner).push(pts);
    edgePath(this.leadAll, inner);
    edgePath(this.leadBorder, outer);
    // Per-pane fill and lead paths.
    this.paneFill = [];
    this.paneLead = [];
    const deg = new Map();
    for (const [a, b] of edges) {
      deg.set(a, (deg.get(a) || 0) + 1);
      deg.set(b, (deg.get(b) || 0) + 1);
    }
    this.solder = [];
    for (const [v, d] of deg) if (d >= 3) this.solder.push(verts[v]);
    for (const p of this.panes) {
      const f = new Path2D();
      p.poly.forEach(([x, y], i) => (i ? f.lineTo(x, y) : f.moveTo(x, y)));
      f.closePath();
      this.paneFill.push(f);
      const l = new Path2D();
      const set = new Set(p.vi);
      for (const [k, pts] of this.edgePts) {
        const a = Math.floor(k / 1e6);
        const b = k % 1e6;
        if (set.has(a) && set.has(b)) edgePath(l, [pts]);
      }
      this.paneLead.push(l);
      // A few bubbles and a seeded texture offset for each pane.
      const r = mulberry32(p.id * 7919 + 13);
      p.texOff = [r() * 256, r() * 256, (r() - 0.5) * 50];
      p.bubbles = [];
      const nb = Math.floor(p.area / 1400 + r() * 2);
      for (let i = 0; i < nb; i++) p.bubbles.push([p.x0 + r() * (p.x1 - p.x0), p.y0 + r() * (p.y1 - p.y0), 0.8 + r() * 1.8]);
      p.hot = [(r() - 0.5) * 0.5, -0.25 - r() * 0.3];
      p.tone = (r() - 0.5) * 0.36;
    }
    this.outline = new Path2D();
    def.outline.forEach(([x, y], i) => (i ? this.outline.lineTo(x, y) : this.outline.moveTo(x, y)));
    this.outline.closePath();
  }

  build() {
    const g = this.ctx;
    this.worldTransform(g);
    drawBackdrop(g, this.def, LAYER_RECT);
    if (this.def.cellar) drawCellar(g, this.def);
    for (const p of this.panes) this.drawPane(g, p, false);
    this.strokeLead(g, this.leadAll, false);
    this.strokeLead(g, this.leadBorder, true);
    this.drawSolder(g, this.solder);
    drawFrame(g, this.def);
    drawFloor(g, this.def);
    this.bloomDirty = true;
  }

  drawPane(g, p, lit, alpha = 1) {
    const st = this.styles[p.colour % this.styles.length];
    const path = this.paneFill[p.id];
    g.save();
    g.clip(path);
    g.globalAlpha = alpha;
    const size = Math.sqrt(p.area);
    const hx = p.cx + p.hot[0] * size;
    const hy = p.cy + p.hot[1] * size;
    const grad = g.createRadialGradient(hx, hy, size * 0.04, p.cx, p.cy, size * 0.95);
    if (lit) {
      // Each pane is its own piece of glass: a little lighter or deeper than its neighbours.
      const t = p.tone;
      const base = t > 0 ? mix(st.base, '#fff4dc', t * 0.6) : mix(st.base, '#0a0410', -t);
      grad.addColorStop(0, rgba(mix(base, '#fff3d6', 0.28)));
      grad.addColorStop(0.3, rgba(mix(base, '#ffeccc', 0.1)));
      grad.addColorStop(0.72, rgba(base));
      grad.addColorStop(1, rgba(mix(base, '#10030f', 0.58)));
    } else {
      grad.addColorStop(0, st.darkHot);
      grad.addColorStop(0.6, st.dark);
      grad.addColorStop(1, st.darkEdge);
    }
    g.fillStyle = grad;
    g.fillRect(p.x0 - 2, p.y0 - 2, p.x1 - p.x0 + 4, p.y1 - p.y0 + 4);
    // Glass texture: streaks, mottling, seeds.
    if (this.tex.setTransform) {
      const m = new DOMMatrix().translateSelf(p.texOff[0], p.texOff[1]).rotateSelf(p.texOff[2]).scaleSelf(0.55, 0.55);
      this.tex.setTransform(m);
    }
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = alpha * (lit ? 0.85 : 0.4);
    g.fillStyle = this.tex;
    g.fillRect(p.x0 - 2, p.y0 - 2, p.x1 - p.x0 + 4, p.y1 - p.y0 + 4);
    g.globalCompositeOperation = 'source-over';
    // Thicker, darker glass at the edges.
    g.globalAlpha = alpha * (lit ? 0.4 : 0.55);
    g.strokeStyle = lit ? st.litEdge : st.darkEdge;
    g.lineWidth = 10;
    g.stroke(path);
    g.globalAlpha = alpha;
    // Bubbles catch the light.
    for (const [x, y, r] of p.bubbles) {
      g.fillStyle = lit ? 'rgba(255,250,235,0.45)' : 'rgba(170,160,220,0.12)';
      g.beginPath();
      g.ellipse(x, y, r * 1.5, r, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    if (lit) {
      // A soft sheen across the pane.
      const sh = g.createLinearGradient(p.x0, p.y0, p.x1, p.y1);
      sh.addColorStop(0.25, 'rgba(255,255,255,0)');
      sh.addColorStop(0.42, 'rgba(255,248,225,0.13)');
      sh.addColorStop(0.55, 'rgba(255,255,255,0)');
      g.fillStyle = sh;
      g.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      if (this.opts.colourBlind) {
        g.globalAlpha = alpha * 0.8;
        g.fillStyle = this.cb[p.colour % 6];
        g.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      }
    }
    g.restore();
  }

  strokeLead(g, path, border) {
    const hc = this.opts.highContrast;
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (hc) {
      g.strokeStyle = 'rgba(245,235,210,0.7)';
      g.lineWidth = border ? 11 : 8.5;
      g.stroke(path);
      g.strokeStyle = '#000';
      g.lineWidth = border ? 8 : 6;
      g.stroke(path);
    } else {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = border ? 9 : 6;
      g.stroke(path);
      g.strokeStyle = '#0a0910';
      g.lineWidth = border ? 7 : 4.2;
      g.stroke(path);
      // The soft sheen of the lead's rounded face.
      g.translate(-0.6, -0.7);
      g.strokeStyle = 'rgba(170,160,210,0.2)';
      g.lineWidth = 1;
      g.stroke(path);
    }
    g.restore();
  }

  drawSolder(g, pts) {
    g.fillStyle = this.opts.highContrast ? '#000' : '#0c0a12';
    for (const [x, y] of pts) {
      g.beginPath();
      g.arc(x, y, this.opts.highContrast ? 4 : 3, 0, Math.PI * 2);
      g.fill();
    }
    if (!this.opts.highContrast) {
      g.fillStyle = 'rgba(190,180,230,0.18)';
      for (const [x, y] of pts) {
        g.beginPath();
        g.arc(x - 0.8, y - 0.9, 1.1, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /** Redraw a pane into the layer, lit or dark. */
  commit(i, lit) {
    const g = this.ctx;
    this.worldTransform(g);
    const p = this.panes[i];
    this.drawPane(g, p, lit);
    this.strokeLead(g, this.paneLead[i], false);
    // Restore border lead and solder around this pane.
    g.save();
    g.beginPath();
    g.rect(p.x0 - 8, p.y0 - 8, p.x1 - p.x0 + 16, p.y1 - p.y0 + 16);
    g.clip();
    this.strokeLead(g, this.leadBorder, true);
    g.restore();
    const set = new Set(p.poly);
    this.drawSolder(g, this.solder.filter((v) => set.has(v)));
    this.bloomDirty = true;
  }

  updateBloom() {
    if (!this.bloomDirty) return;
    this.bloomDirty = false;
    const m = this.bloomMid.getContext('2d');
    m.globalCompositeOperation = 'copy';
    m.imageSmoothingEnabled = true;
    m.drawImage(this.canvas, 0, 0, this.bloomMid.width, this.bloomMid.height);
    const b = this.bloom.getContext('2d');
    b.globalCompositeOperation = 'copy';
    b.imageSmoothingEnabled = true;
    b.drawImage(this.bloomMid, 0, 0, this.bloom.width, this.bloom.height);
    // Squaring the image keeps bright glass and drops the dark stone.
    b.globalCompositeOperation = 'multiply';
    b.drawImage(this.bloom, 0, 0);
    b.drawImage(this.bloom, 0, 0);
    b.globalCompositeOperation = 'source-over';
  }

  setOptions(o) {
    const changed = o.highContrast !== this.opts.highContrast || o.colourBlind !== this.opts.colourBlind;
    this.opts = { ...this.opts, ...o };
    return changed;
  }
}
