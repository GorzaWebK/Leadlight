// The renderer: camera, the cached window layer, bloom, fixtures, balls and effects.
import { GlassLayer, LAYER_RECT } from './glass.js';
import { FixtureArt, glowAt } from './fixtures.js';
import { Effects } from './effects.js';
import { glowSprite, makeCanvas } from './sprites.js';
import { rgba, mix } from './colour.js';
import { masonryTile } from './stone.js';
import { LANE_X, RIGHT, LANE_TOP, TABLE_H } from '../tables/common.js';

const VIEW = { x0: -8, y0: -4, x1: 648, y1: 1086 }; // the table as framed during play
const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas, settings = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.settings = settings;
    this.cssW = 1;
    this.cssH = 1;
    this.dpr = 1;
    this.area = { x: 0, y: 0, w: 1, h: 1 }; // where the table goes, in CSS px
    this.cam = { x: 320, y: 541, zoom: 1 };
    this.camTarget = { x: 320, y: 541, zoom: 1 };
    this.shake = { x: 0, y: 0, vx: 0, vy: 0 };
    this.flash = 0;
    this.flashColour = '#fff3d0';
    this.flood = 0;
    this.floodTarget = 0;
    this.trails = new Map();
    this.game = null;
    this.time = 0;
    this.lightning = 0;
    this.quality = 1;
  }

  setSettings(s) {
    this.settings = s;
    if (this.glass) {
      const changed = this.glass.setOptions({ highContrast: !!s.highContrast, colourBlind: !!s.colourBlind });
      if (changed) this.rebuildGlass();
    }
    if (this.fx) this.fx.opts.reducedMotion = !!s.reducedMotion;
    if (this.art) this.art.opts.highContrast = !!s.highContrast;
  }

  /** Attach a game (or a display-only table for the menus). */
  setGame(game, def = game?.def) {
    this.game = game;
    this.def = def;
    this.T = game ? game.T : null;
    this.trails.clear();
    this.flood = 0;
    this.floodTarget = 0;
    this.buildLayers();
    if (this.T) this.art = new FixtureArt(this.T, { highContrast: this.settings.highContrast });
    else this.art = null;
    this.cam = { x: 320, y: 541, zoom: 1 };
    this.camTarget = { ...this.cam };
  }

  buildLayers() {
    const s = this.layerScale();
    this.glass = new GlassLayer(this.def, { scale: s, highContrast: !!this.settings.highContrast, colourBlind: !!this.settings.colourBlind });
    this.fx = new Effects(this.def, this.glass, { reducedMotion: !!this.settings.reducedMotion });
    this.layerBuiltScale = s;
    if (this.game) for (let i = 0; i < this.def.panes.length; i++) if (this.game.light.isLit(i)) this.glass.commit(i, true);
  }

  rebuildGlass() {
    const lit = [];
    if (this.game) for (let i = 0; i < this.def.panes.length; i++) if (this.game.light.isLit(i)) lit.push(i);
    const old = this.glass;
    this.glass = new GlassLayer(this.def, { ...old.opts, scale: this.layerScale() });
    this.fx.glass = this.glass;
    this.layerBuiltScale = this.glass.scale;
    for (const i of lit) this.glass.commit(i, true);
  }

  /** Display-only: light every pane (menu backdrops). */
  lightAll() {
    for (let i = 0; i < this.def.panes.length; i++) this.glass.commit(i, true);
  }

  layerScale() {
    return Math.min(2.4, this.baseScale() * this.dpr * this.quality);
  }

  baseScale() {
    return Math.min(this.area.w / (VIEW.x1 - VIEW.x0), this.area.h / (VIEW.y1 - VIEW.y0));
  }

  resize(cssW, cssH, dpr, area) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.area = area;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.vignette = null;
    if (this.def && Math.abs(this.layerScale() - this.layerBuiltScale) / this.layerBuiltScale > 0.25) this.rebuildGlass();
  }

  // ---- Coordinates ----

  get scale() {
    return this.baseScale() * this.cam.zoom;
  }
  screenCentre() {
    return [this.area.x + this.area.w / 2, this.area.y + this.area.h / 2];
  }
  worldToScreen(x, y) {
    const [cx, cy] = this.screenCentre();
    const s = this.scale;
    return [cx + (x - this.cam.x) * s, cy + (y - this.cam.y) * s];
  }
  screenToWorld(x, y) {
    const [cx, cy] = this.screenCentre();
    const s = this.scale;
    return [(x - cx) / s + this.cam.x, (y - cy) / s + this.cam.y];
  }

  /** Which touch zone a point (client coordinates) falls in. */
  zoneAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const [wx, wy] = this.screenToWorld(x, y);
    if (wx > LANE_X - 24 && wy > 700 && this.game && this.game.phase !== 'complete') {
      const inLane = this.game.world.balls.some((b) => b.x > LANE_X && b.y > LANE_TOP);
      if (inLane) return 'plunger';
    }
    return x < rect.width / 2 ? 'left' : 'right';
  }

  // ---- Events from the game ----

  handle(events) {
    const fx = this.fx;
    const rm = !!this.settings.reducedMotion;
    for (const e of events) {
      switch (e.type) {
        case 'light': {
          e.panes.forEach((i, k) => fx.spark(i, e.x, e.y, k * 0.07));
          break;
        }
        case 'hit':
          if (e.kind === 'bumper') {
            fx.burst(e.x, e.y, '#ffcf70', 7, 260);
            this.kick(1.6);
          } else if (e.kind === 'sling') this.kick(1.2);
          else if (e.kind === 'bell') fx.burst(e.x, e.y, '#ffd27a', 6, 180);
          else fx.burst(e.x, e.y, '#ffe0a0', 4, 150);
          if (e.pts >= 1000) fx.popup(e.x, e.y - 20, '+' + e.pts.toLocaleString('en-GB'));
          break;
        case 'feature':
          fx.burst(e.x, e.y, '#fff0c0', 18, 360);
          if (e.pts) fx.popup(e.x, e.y - 34, '+' + e.pts.toLocaleString('en-GB'), true);
          if (!rm) this.doFlash(0.18, '#ffe9b8');
          break;
        case 'nudge':
          if (!rm) {
            this.shake.vy -= 260;
            this.shake.vx += (e.dir || (Math.random() - 0.5)) * 160;
          }
          break;
        case 'tilt':
          if (!rm) this.doFlash(0.25, '#5a2040');
          this.kick(6);
          break;
        case 'complete':
          this.floodWindow(e.x, e.y, e.renew);
          break;
        case 'renew':
          fx.at(e.delay, () => this.dimSweep());
          break;
        case 'gust':
          this.lightning = rm ? 0 : 1;
          break;
        case 'thud':
          if (e.speed > 900) this.kick(e.speed / 900);
          break;
        case 'drain':
          if (!rm) this.doFlash(0.12, '#20102a');
          break;
        case 'cellarEnter':
          this.camTarget = { x: 320, y: 1180, zoom: 1 };
          break;
        case 'cellarLeave':
          this.camTarget = { x: 320, y: 541, zoom: 1 };
          break;
        case 'kickback':
        case 'eject':
        case 'multiball':
          fx.burst(e.x ?? 600, e.y ?? 900, '#ffd27a', 10, 300);
          break;
        default:
      }
    }
  }

  kick(amount) {
    if (this.settings.reducedMotion) return;
    this.shake.vx += (Math.random() - 0.5) * 30 * amount;
    this.shake.vy += (Math.random() - 0.5) * 30 * amount;
  }

  doFlash(a, colour) {
    this.flash = Math.max(this.flash, a);
    this.flashColour = colour;
  }

  /** The window floods: every pane not yet shown ignites in a wave from the last hit. */
  floodWindow(x, y, renew) {
    const fx = this.fx;
    const panes = this.def.panes;
    const order = panes.map((p, i) => [i, Math.hypot(p.cx - x, p.cy - y)]).sort((a, b) => a[1] - b[1]);
    fx.sparks.length = 0;
    for (const [i, d] of order) {
      const lit = fx.ignites.some((g) => g.i === i);
      if (!lit) fx.at(d / 1600, () => fx.ignite(i));
    }
    this.floodTarget = 1;
    fx.at(1.0, () => (this.floodTarget = renew ? 0 : 0.35));
    if (!renew) {
      fx.at(0.9, () => (this.camTarget = { x: 320, y: 470, zoom: 0.74 }));
    } else {
      this.camTarget = { x: 320, y: 500, zoom: 0.86 };
      fx.at(2.3, () => (this.camTarget = { x: 320, y: 541, zoom: 1 }));
    }
    if (!this.settings.reducedMotion) this.doFlash(0.35, '#fff3d0');
  }

  /** Single-window renewal: the glass dims again from the top down. */
  dimSweep() {
    const panes = this.def.panes;
    const order = panes.map((p, i) => [i, p.cy]).sort((a, b) => a[1] - b[1]);
    for (const [i, y] of order)
      this.fx.at((y / 1000) * 1.2, () => {
        if (!this.game || !this.game.light.isLit(i)) this.glass.commit(i, false);
      });
  }

  // ---- Drawing ----

  frame(dt) {
    this.time += dt;
    const g = this.ctx;
    const game = this.game;
    const rm = !!this.settings.reducedMotion;
    // Camera easing and shake.
    const k = Math.min(1, dt * 2.2);
    this.cam.x += (this.camTarget.x - this.cam.x) * k;
    this.cam.y += (this.camTarget.y - this.cam.y) * k;
    this.cam.zoom += (this.camTarget.zoom - this.cam.zoom) * k;
    const sh = this.shake;
    sh.vx += -sh.x * 900 * dt - sh.vx * 18 * dt;
    sh.vy += -sh.y * 900 * dt - sh.vy * 18 * dt;
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (rm) sh.x = sh.y = sh.vx = sh.vy = 0;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.flood += (this.floodTarget - this.flood) * Math.min(1, dt * 3);
    this.lightning = Math.max(0, this.lightning - dt * 2.5);
    const wind = game?.wind;
    this.fx.update(dt, wind);

    const dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#07060d';
    g.fillRect(0, 0, this.cssW, this.cssH);
    const s = this.scale * dpr;
    const [scx, scy] = this.screenCentre();
    const tx = (scx + sh.x * this.scale) * dpr - this.cam.x * s;
    const ty = (scy + sh.y * this.scale) * dpr - this.cam.y * s;
    g.setTransform(s, 0, 0, s, tx, ty);
    g.imageSmoothingEnabled = true;
    const R = LAYER_RECT;
    // Plain masonry wherever the view reaches past the window layer.
    const [vx0, vy0] = this.screenToWorld(0, 0);
    const [vx1, vy1] = this.screenToWorld(this.cssW, this.cssH);
    if (vx0 < R.x0 || vy0 < R.y0 || vx1 > R.x1 || vy1 > R.y1) {
      if (!this.wallPattern) this.wallPattern = g.createPattern(masonryTile(), 'repeat');
      g.fillStyle = this.wallPattern;
      g.fillRect(vx0 - 50, vy0 - 50, vx1 - vx0 + 100, vy1 - vy0 + 100);
    }
    // Masonry continues beyond the cached layer on very wide screens.
    g.drawImage(this.glass.canvas, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    const lit = game ? game.light.fraction : 1;
    // Bloom: the lit glass bleeds light over the lead.
    this.glass.updateBloom();
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 + 0.25 * lit + this.flood * 0.3;
    g.drawImage(this.glass.bloom, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    g.restore();
    this.fx.drawGlass(g);
    if (this.def.cellar) this.drawCellarVeil(g, dt);
    // The flood when a window completes.
    if (this.flood > 0.01) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = this.flood * 0.5;
      const fl = g.createRadialGradient(320, 360, 40, 320, 400, 700);
      fl.addColorStop(0, '#fff6dc');
      fl.addColorStop(0.5, rgba(this.def.sky || '#f2a24a', 0.7));
      fl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fl;
      g.beginPath();
      this.def.outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.restore();
    }
    if (this.art) {
      this.art.skillLane = game.skillLane;
      this.art.draw(g, this.time);
    }
    if (game) this.drawBalls(g, dt);
    this.fx.drawOver(g);
    this.fx.drawShafts(g, Math.max(lit, this.flood), this.time);
    // Screen-space finish.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.lightning > 0) {
      g.fillStyle = rgba('#d8e4ff', 0.28 * this.lightning * (0.6 + 0.4 * Math.sin(this.time * 70)));
      g.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (this.flash > 0 && !rm) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba(this.flashColour, this.flash * 0.5);
      g.fillRect(0, 0, this.cssW, this.cssH);
      g.restore();
    }
    if (!this.vignette) this.vignette = this.makeVignette();
    g.drawImage(this.vignette, 0, 0, this.cssW, this.cssH);
    if (game && game.tilted) {
      g.fillStyle = 'rgba(30,0,20,0.25)';
      g.fillRect(0, 0, this.cssW, this.cssH);
    }
  }

  /** The cellar stays hidden under a stone slab until its door opens. */
  drawCellarVeil(g, dt) {
    const T = this.T;
    const open = T && (T.scoop?.open || T.cellar?.active || T.cellar?.held);
    this.veil = this.veil ?? 1;
    this.veil += ((open ? 0 : 1) - this.veil) * Math.min(1, dt * 2);
    if (this.veil < 0.02) return;
    const { x0, y0, x1, y1 } = this.def.cellar.rect;
    if (!this.wallPattern) this.wallPattern = g.createPattern(masonryTile(), 'repeat');
    g.save();
    g.globalAlpha = this.veil;
    g.fillStyle = this.wallPattern;
    g.fillRect(x0 - 12, y0 - 2, x1 - x0 + 24, y1 - y0 + 14);
    g.fillStyle = 'rgba(8,6,16,0.35)';
    g.fillRect(x0 - 12, y0 - 2, x1 - x0 + 24, y1 - y0 + 14);
    g.restore();
  }

  makeVignette() {
    const c = makeCanvas(256, 256);
    const v = c.getContext('2d');
    const gr = v.createRadialGradient(128, 118, 60, 128, 128, 190);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(2,1,6,0.6)');
    v.fillStyle = gr;
    v.fillRect(0, 0, 256, 256);
    return c;
  }

  drawBalls(g, dt) {
    const game = this.game;
    const glow = glowSprite('#ffae42', 128, 0.9);
    const seen = new Set();
    for (const b of game.world.balls) {
      if (!b.active) continue;
      seen.add(b.id);
      let tr = this.trails.get(b.id);
      if (!tr) this.trails.set(b.id, (tr = []));
      tr.push([b.x, b.y]);
      if (tr.length > 12) tr.shift();
      // Shadow on the glass.
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(b.x + 3, b.y + 5, b.r, 0, TAU);
      g.fill();
      // A short trail of light.
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < tr.length - 1; k++) {
        const t = k / tr.length;
        const [x, y] = tr[k];
        const size = b.r * (1 + t * 2.2);
        g.globalAlpha = t * 0.35;
        g.drawImage(glow, x - size, y - size, size * 2, size * 2);
      }
      g.globalAlpha = b.ascending ? 1 : 0.85;
      const gs = b.r * (b.ascending ? 9 : 5.2);
      g.drawImage(glow, b.x - gs / 2, b.y - gs / 2, gs, gs);
      g.restore();
      // The molten drop itself.
      const core = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.35, '#fff1c0');
      core.addColorStop(0.75, '#ffc458');
      core.addColorStop(1, '#e0711c');
      g.fillStyle = core;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(110,40,0,0.55)';
      g.lineWidth = 1;
      g.stroke();
    }
    for (const id of this.trails.keys()) if (!seen.has(id)) this.trails.delete(id);
    if (game.ballSave > 0 && game.phase === 'play') {
      // The ball-save halo above the drain.
      const a = 0.35 + 0.25 * Math.sin(this.time * 6);
      glowAt(g, 299, 1030, 90, '#c8d8ff', a * Math.min(1, game.ballSave));
    }
  }
}

export { VIEW, TABLE_H, RIGHT, mix };
