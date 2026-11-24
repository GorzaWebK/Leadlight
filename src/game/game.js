// One window being played: the ball(s), flippers, plunger, nudge and tilt, every
// fixture's rules, scoring and lighting. No DOM or drawing: main.js feeds it input,
// and the renderer, audio and HUD read its state and the events in `out`.
import { STEP, Ball } from '../physics/world.js';
import { buildTable } from './table.js';
import { Scorer, POINTS, endOfBallBonus } from './scoring.js';
import { WindowLight } from './lighting.js';
import { DEFAULT_MODS } from '../relics/relics.js';
import { PLUNGER_X, DRAIN_Y, BALL_R, LANE_X, LANE_TOP, RIGHT } from '../tables/common.js';
import { pointInPane } from '../tables/panes.js';

export const BALL_SAVE_SECONDS = 9;
export const TILT_WARN = 1.6;
export const TILT_LIMIT = 2.8;
export const TILT_DECAY = 0.5; // per second

// How many hits of each kind light one pane, and how many panes a hit lights.
export const LIGHT_RULES = {
  bumper: { every: 2, panes: 1 },
  sling: { every: 3, panes: 1 },
  target: { every: 1, panes: 2 },
  drop: { every: 1, panes: 1 },
  bank: { every: 1, panes: 6 },
  lane: { every: 1, panes: 2 },
  laneSet: { every: 1, panes: 3 },
  inlane: { every: 1, panes: 1 },
  outlane: { every: 1, panes: 1 },
  spinner: { every: 5, panes: 1 },
  bell: { every: 1, panes: 1 },
  angelus: { every: 1, panes: 8 },
  rotorLobe: { every: 1, panes: 1 },
  litany: { every: 1, panes: 10 },
  scoop: { every: 1, panes: 4 },
  peg: { every: 1, panes: 1 },
  rod: { every: 1, panes: 2 },
  thunder: { every: 1, panes: 8 },
  skillShot: { every: 1, panes: 4 },
};

export class Game {
  /**
   * @param {object} o
   *   table: table definition (with .panes), mode: 'run' | 'single',
   *   mods: relic modifiers, balls: balls in hand (including the next one),
   *   score: starting score, windowIndex, extraMult, rand
   */
  constructor(o) {
    this.def = o.table;
    this.mode = o.mode || 'run';
    this.mods = { ...DEFAULT_MODS, ...(o.mods || {}) };
    this.rand = o.rand || Math.random;
    this.T = buildTable(this.def, this.mods);
    this.world = this.T.world;
    this.panes = this.def.panes;
    this.light = new WindowLight(this.panes);
    this.light.twin = !!this.mods.twinPanes;
    this.scorer = new Scorer({
      score: o.score ?? 0,
      scoreMult: (this.mods.scoreMult ?? 1) * (o.extraMult ?? 1),
      comboTime: this.mods.comboTime,
      comboCap: this.mods.comboCap,
    });
    this.balls = o.balls ?? 3;
    this.windowIndex = o.windowIndex ?? 0;
    this.out = [];
    this.time = 0;
    this.acc = 0;
    this.timeScale = 1;
    this.slowTimer = 0;
    this.phase = 'ready'; // ready | play | wait | complete | over
    this.waitTimer = 0;
    this.waitThen = null;
    this.tilt = 0;
    this.tilted = false;
    this.tiltWarned = false;
    this.nudgeCooldown = 0;
    this.ballSave = 0;
    this.ballSaveArmed = true;
    this.savedThisWindow = false;
    this.panesThisBall = 0;
    this.charges = {};
    this.skillLane = -1;
    this.multiballCooldown = 0;
    this.gloria = 1;
    this.milestone = 0;
    this.prevLeft = false;
    this.prevRight = false;
    this.input = { left: false, right: false, plunger: false, nudge: false, nudgeX: 0 };
    this.stats = { panesLit: 0, hits: 0 };
    this.wind = this.def.wind ? { state: 'calm', timer: this.def.wind.firstCalm ?? 6, dir: 1, power: 0, gusts: 0 } : null;
    this.serveBall(false);
  }

  emit(e) {
    this.out.push(e);
  }

  drainOut() {
    const o = this.out;
    this.out = [];
    return o;
  }

  get score() {
    return this.scorer.score;
  }

  activeBalls() {
    return this.world.balls.filter((b) => b.active);
  }

  // ---- Ball serving and the plunger ----

  serveBall(auto) {
    const b = new Ball(PLUNGER_X, this.T.plunger.rest - BALL_R - 1.5, BALL_R);
    b.launched = false;
    b.still = 0;
    b.lastX = b.x;
    b.lastY = b.y;
    this.world.addBall(b);
    this.phase = 'ready';
    this.ballSaveArmed = true;
    this.skillLane = this.T.lanes.length ? Math.floor(this.rand() * this.T.lanes.filter((l) => l.group === 'top').length) : -1;
    if (this.T.centrePost && this.mods.centrePost) {
      this.T.centrePost.timer = this.mods.centrePost;
    }
    if (auto) this.autoPlunge = 0.7;
    this.emit({ type: 'serve', auto: !!auto });
    return b;
  }

  /** Extra ball for multiball: shoot it from the lane if the lane is free. */
  addBall() {
    const inLane = this.activeBalls().some((b) => b.x > LANE_X && b.y > LANE_TOP);
    if (inLane) return false;
    const b = this.serveBall(true);
    b.extra = true;
    this.phase = 'play';
    this.emit({ type: 'multiball' });
    return true;
  }

  updatePlunger(h) {
    const P = this.T.plunger;
    if (this.autoPlunge > 0) {
      this.autoPlunge -= h;
      P.pull = Math.min(0.82, P.pull + h / 0.5);
      if (this.autoPlunge <= 0) this.release(0.78 + this.rand() * 0.06);
    } else if (this.input.plunger && P.vy === 0) {
      if (P.pull === 0) this.emit({ type: 'pull' });
      P.pull = Math.min(1, P.pull + h / 0.9);
    } else if (!this.input.plunger && P.pull > 0 && P.vy === 0) {
      this.release(P.pull);
    }
    if (P.vy === 0) {
      P.y = P.rest + P.pull * 42;
      P.c.ay = P.c.by = P.y;
    }
  }

  release(power) {
    const P = this.T.plunger;
    P.vy = -(650 + power * 2350);
    P.pull = 0;
    this.emit({ type: 'plunge', power });
  }

  // ---- Input actions ----

  nudge(dirX = 0) {
    if (this.nudgeCooldown > 0 || this.phase === 'complete' || this.phase === 'over') return;
    this.nudgeCooldown = 0.3;
    if (this.tilted) return;
    const s = this.mods.nudgeStrength ?? 1;
    for (const b of this.activeBalls()) {
      if (b.frozen || (b.x > LANE_X && b.y > LANE_TOP)) continue;
      const side = dirX || (b.x < 299 ? 1 : -1) * 0.35;
      b.vx += side * 230 * s;
      b.vy -= 300 * s;
    }
    this.tilt += 1 / (this.mods.tiltTolerance ?? 1);
    if (this.mods.slowNudge) this.slowTimer = this.mods.slowNudge;
    this.emit({ type: 'nudge', dir: dirX });
    if (this.tilt >= TILT_LIMIT) this.doTilt();
    else if (this.tilt >= TILT_WARN && !this.tiltWarned) {
      this.tiltWarned = true;
      this.emit({ type: 'tiltWarn' });
    }
  }

  doTilt() {
    this.tilted = true;
    for (const f of this.T.flippers) f.enabled = false;
    for (const B of this.T.bumpers) B.c.kick = 0;
    for (const s of this.T.slings) s.collider.kick = 0;
    this.emit({ type: 'tilt' });
  }

  untilt() {
    this.tilted = false;
    this.tilt = 0;
    this.tiltWarned = false;
    for (const f of this.T.flippers) f.enabled = true;
    for (const B of this.T.bumpers) B.c.kick = 920 * (this.mods.bumperKick ?? 1);
    for (const s of this.T.slings) s.collider.kick = 780;
  }

  // ---- Main update ----

  update(dt, input) {
    this.input = input || this.input;
    if (this.input.nudge) {
      this.nudge(this.input.nudgeX || 0);
      this.input.nudge = false;
    }
    const target = this.slowTimer > 0 ? 0.35 : this.floodSlow > 0 ? 0.3 : 1;
    this.timeScale += (target - this.timeScale) * Math.min(1, dt * 10);
    this.realTime = (this.realTime || 0) + dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.floodSlow > 0) this.floodSlow -= dt;
    this.acc += Math.min(dt, 0.1) * this.timeScale;
    let n = 0;
    while (this.acc >= STEP && n < 16) {
      this.fixed(STEP);
      this.acc -= STEP;
      n++;
    }
    if (n >= 16) this.acc = 0;
  }

  fixed(h) {
    this.time += h;
    const T = this.T;
    const inp = this.input;
    // Flippers (with lane change on each new press).
    const L = inp.left && !this.tilted;
    const R = inp.right && !this.tilted;
    T.flippers[0].pressed = L;
    T.flippers[1].pressed = R;
    if (L && !this.prevLeft) this.flipEvent('left');
    if (R && !this.prevRight) this.flipEvent('right');
    this.prevLeft = L;
    this.prevRight = R;

    this.updatePlunger(h);
    if (this.nudgeCooldown > 0) this.nudgeCooldown -= h;
    this.tilt = Math.max(0, this.tilt - TILT_DECAY * h);
    if (this.tilt < 0.8) this.tiltWarned = false;
    if (this.ballSave > 0) this.ballSave -= h;
    if (this.multiballCooldown > 0) this.multiballCooldown -= h;
    this.scorer.update(h);
    this.updateFixtures(h);
    this.updateWind(h);

    this.world.step(h);
    for (const e of this.world.drainEvents()) this.onPhysics(e);
    this.checkBalls(h);

    if (this.phase === 'wait') {
      this.waitTimer -= h;
      if (this.waitTimer <= 0) {
        const f = this.waitThen;
        this.waitThen = null;
        this.phase = 'ready';
        if (f) f();
      }
    }
  }

  flipEvent(side) {
    this.emit({ type: 'flip', side });
    // Lane change: the lit top lanes shift with the flippers.
    const top = this.T.lanes.filter((l) => l.group === 'top');
    if (top.length > 1 && top.some((l) => l.lit) && !top.every((l) => l.lit)) {
      const lit = top.map((l) => l.lit);
      const n = lit.length;
      top.forEach((l, i) => (l.lit = side === 'left' ? lit[(i + 1) % n] : lit[(i - 1 + n) % n]));
    }
  }

  updateFixtures(h) {
    const T = this.T;
    for (const list of [T.bumpers, T.slings, T.lanes, T.targets, T.drops, T.spinners, T.inlanes, T.outlanes, T.bells])
      for (const x of list) if (x.flash > 0) x.flash = Math.max(0, x.flash - h * 3);
    // Drop target banks reset after a pause, once the ball is clear.
    for (const bank of Object.values(T.banks)) {
      if (bank.resetIn > 0) {
        bank.resetIn -= h;
        if (bank.resetIn <= 0) {
          const clear = bank.drops.every((d) => this.activeBalls().every((b) => segDist(d, b) > b.r + 8));
          if (clear) {
            for (const d of bank.drops) {
              d.down = false;
              d.c.enabled = true;
            }
            this.emit({ type: 'bankReset', bank: bank.id });
          } else bank.resetIn = 0.3;
        }
      }
    }
    for (const d of T.drops) d.anim += ((d.down ? 1 : 0) - d.anim) * Math.min(1, h * 14);
    // Spinners turn down.
    for (const S of T.spinners) {
      if (S.spin > 0) {
        const before = Math.floor(S.phase);
        S.phase += S.spin * h;
        S.spin = Math.max(0, S.spin - h * (2 + S.spin * 0.9));
        const turns = Math.floor(S.phase) - before;
        for (let i = 0; i < turns; i++) this.onSpin(S);
      }
    }
    // Bells: each ring lasts while the bell keeps swinging.
    for (const B of T.bells) if (B.swingTime > 0) B.swingTime -= h;
    // Rotor flashes.
    if (T.rotor) {
      T.rotor.flash = T.rotor.flash.map((f) => Math.max(0, f - h * 3));
      T.rotor.hubFlash = Math.max(0, T.rotor.hubFlash - h * 3);
      // Ease the rotor back to its cruising speed after a reversal.
      const R = T.rotor.R;
      const want = T.rotor.baseW * (T.rotor.dir ?? 1);
      R.w += (want - R.w) * Math.min(1, h * 1.5);
    }
    // Scoop: hold, then eject or drop into the cellar.
    const S = T.scoop;
    if (S) {
      if (S.flash > 0) S.flash = Math.max(0, S.flash - h * 2);
      if (S.held) {
        S.timer -= h;
        const b = S.held;
        b.x += (S.x - b.x) * Math.min(1, h * 12);
        b.y += (S.y - b.y) * Math.min(1, h * 12);
        if (S.timer <= 0) {
          if (S.open && T.cellar && this.activeBalls().length === 1) this.enterCellar(b);
          else this.ejectScoop(b);
        }
      }
      if (S.cooldown > 0) S.cooldown -= h;
    }
    if (T.cellar) {
      const C = T.cellar;
      for (const p of C.pegs) if (p.flash > 0) p.flash = Math.max(0, p.flash - h * 3);
      if (C.held) {
        C.timer -= h;
        if (C.timer <= 0) this.leaveCellar(C.held);
      }
    }
    for (const K of T.kickbacks) if (K.flash > 0) K.flash = Math.max(0, K.flash - h * 2);
    if (T.centrePost) {
      const C = T.centrePost;
      if (C.timer > 0 && this.phase !== 'wait') C.timer -= this.phase === 'play' ? h : 0;
      const want = C.timer > 0 ? 1 : 0;
      C.up += (want - C.up) * Math.min(1, h * 6);
      C.c.enabled = C.up > 0.5;
    }
    if (T.gate) T.gate.open = Math.max(0, T.gate.open - h * 4);
    // Molten Trail: a fast ball lights the dark pane under it.
    if (this.mods.moltenTrail && this.phase === 'play') {
      this.moltenTick = (this.moltenTick || 0) + h;
      if (this.moltenTick > 0.12) {
        this.moltenTick = 0;
        for (const b of this.activeBalls()) {
          if (b.frozen || b.speed < 1500) continue;
          const i = this.paneAt(b.x, b.y);
          if (i >= 0 && this.light.light(i)) this.afterLight([i], b.x, b.y, 'molten');
        }
      }
    }
  }

  updateWind(h) {
    const W = this.wind;
    if (!W) return;
    const cfg = this.def.wind;
    W.timer -= h;
    if (W.state === 'calm' && W.timer <= 0) {
      W.state = 'warn';
      W.timer = 1.4;
      W.dir = this.rand() < 0.5 ? -1 : 1;
      this.emit({ type: 'windWarn', dir: W.dir });
    } else if (W.state === 'warn' && W.timer <= 0) {
      W.state = 'gust';
      W.timer = cfg.gust ?? 4;
      W.gusts++;
      this.emit({ type: 'gust', dir: W.dir });
    } else if (W.state === 'gust' && W.timer <= 0) {
      W.state = 'calm';
      W.timer = (cfg.calm ?? 9) + this.rand() * (cfg.calmRand ?? 5);
      this.emit({ type: 'windCalm' });
    }
    const target = W.state === 'gust' ? 1 : 0;
    W.power += (target - W.power) * Math.min(1, h * 2.2);
    const f = W.power * (cfg.strength ?? 420) * W.dir;
    const lowest = cfg.below ?? 700;
    for (const b of this.world.balls) {
      // Wind blows across the upper glass only; the flipper area is sheltered.
      const k = b.y < lowest ? 1 : b.y < lowest + 80 ? 1 - (b.y - lowest) / 80 : 0;
      b.fx = b.x > LANE_X && b.y > LANE_TOP ? 0 : f * k * (0.85 + 0.15 * Math.sin(this.time * 7 + b.y * 0.02));
    }
  }

  // ---- Physics events: the rules of every fixture ----

  onPhysics(e) {
    if (this.phase === 'complete' || this.phase === 'over') return;
    const tag = e.c?.tag;
    const live = !this.tilted;
    if (e.type === 'clack') {
      this.emit({ type: 'clack', x: e.x, y: e.y, speed: e.speed });
      return;
    }
    if (e.type === 'hit') {
      if (tag === 'bumper') {
        if (!e.kicked) return this.emit({ type: 'thud', x: e.x, y: e.y, speed: e.speed });
        const B = e.c.data;
        B.flash = 1;
        if (!live) return;
        const pts = this.scorer.hit(POINTS.bumper * (this.mods.bumperScore ?? 1));
        this.emit({ type: 'hit', kind: 'bumper', x: B.x, y: B.y, pts, id: B, speed: e.speed });
        this.charge('bumper', B.x, B.y, this.mods.bumperPanes ?? 0);
        if (this.mods.prism) {
          const lit = this.light.lightFar(B.x, B.y, this.rand);
          if (lit.length) this.afterLight(lit, B.x, B.y, 'prism');
        }
        this.comboCheck();
      } else if (tag === 'sling') {
        if (!e.kicked) return this.emit({ type: 'thud', x: e.x, y: e.y, speed: e.speed });
        const S = e.c.data;
        S.flash = 1;
        if (!live) return;
        const pts = this.scorer.hit(POINTS.sling);
        this.emit({ type: 'hit', kind: 'sling', x: S.c0[0], y: S.c0[1], pts, side: S.side });
        this.charge('sling', S.c0[0], S.c0[1]);
        this.comboCheck();
      } else if (tag === 'target') {
        const Tg = e.c.data;
        Tg.flash = 1;
        if (!live) return;
        const mx = (Tg.a[0] + Tg.b[0]) / 2;
        const my = (Tg.a[1] + Tg.b[1]) / 2;
        if (Tg.rod) {
          const gust = this.wind && this.wind.state === 'gust';
          const pts = this.scorer.hit(gust ? POINTS.thunder : POINTS.rod);
          this.emit({ type: 'hit', kind: gust ? 'thunder' : 'rod', x: mx, y: my, pts });
          this.charge(gust ? 'thunder' : 'rod', mx, my);
        } else {
          Tg.lit = true;
          const pts = this.scorer.hit(POINTS.target);
          this.emit({ type: 'hit', kind: 'target', x: mx, y: my, pts });
          this.charge('target', mx, my);
          this.checkTargetSet(Tg);
        }
        this.comboCheck();
      } else if (tag === 'drop') {
        const D = e.c.data;
        if (D.down) return;
        D.down = true;
        D.c.enabled = false;
        D.flash = 1;
        if (!live) return;
        const mx = (D.a[0] + D.b[0]) / 2;
        const my = (D.a[1] + D.b[1]) / 2;
        const pts = this.scorer.hit(POINTS.drop);
        this.emit({ type: 'hit', kind: 'drop', x: mx, y: my, pts });
        this.charge('drop', mx, my);
        const bank = this.T.banks[D.bank];
        if (bank.drops.every((d) => d.down)) this.bankComplete(bank, mx, my);
        this.comboCheck();
      } else if (tag === 'bell') {
        const B = e.c.data;
        B.flash = 1;
        B.swingTime = 4.5;
        if (!live) return;
        const pts = this.scorer.hit(POINTS.bell);
        this.emit({ type: 'hit', kind: 'bell', x: B.p.c.x, y: B.p.c.y, pts, note: B.note, speed: e.speed });
        this.charge('bell', B.p.c.x, B.p.c.y);
        if (this.T.bells.length > 1 && this.T.bells.every((b) => b.swingTime > 0)) {
          for (const b of this.T.bells) b.swingTime = 0;
          const pts2 = this.scorer.add(POINTS.angelus);
          this.emit({ type: 'feature', kind: 'angelus', x: B.p.c.x, y: B.p.c.y, pts: pts2, text: 'Angelus' });
          this.charge('angelus', B.p.c.x, B.p.c.y);
        }
        this.comboCheck();
      } else if (tag === 'rotorLobe' || tag === 'rotorHub') {
        const { rotor, index } = e.c.data;
        if (!live) return;
        if (index < 0) {
          rotor.hubFlash = 1;
          const pts = this.scorer.hit(POINTS.rotorHub);
          this.emit({ type: 'hit', kind: 'rotorHub', x: rotor.x, y: rotor.y, pts });
        } else {
          rotor.flash[index] = 1;
          const already = rotor.lit[index];
          rotor.lit[index] = true;
          const pts = this.scorer.hit(POINTS.rotorLobe);
          this.emit({ type: 'hit', kind: 'rotorLobe', x: e.x, y: e.y, pts, index, fresh: !already });
          if (!already) this.charge('rotorLobe', e.x, e.y);
          if (rotor.lit.every(Boolean)) {
            rotor.lit.fill(false);
            rotor.dir = -(rotor.dir ?? 1);
            rotor.R.w = -rotor.R.w * 0.3;
            const pts2 = this.scorer.add(POINTS.litany);
            this.emit({ type: 'feature', kind: 'litany', x: rotor.x, y: rotor.y, pts: pts2, text: 'Litany of Saints' });
            this.charge('litany', rotor.x, rotor.y);
          }
        }
        this.comboCheck();
      } else if (tag === 'peg') {
        const P = e.c.data;
        P.flash = 1;
        if (!e.kicked) return;
        const pts = this.scorer.hit(POINTS.peg);
        this.emit({ type: 'hit', kind: 'peg', x: P.x, y: P.y, pts });
        // Pegs light panes in the window above.
        const pane = this.light.nearestUnlit(P.x, 300 + (P.y - this.T.cellar.top) * 1.4, 1);
        if (pane.length && this.light.light(pane[0])) this.afterLight(pane, P.x, P.y, 'cellar');
      } else if (tag === 'flipper' || tag === 'wall' || tag === 'post' || tag === 'gate') {
        if (e.speed > 140) this.emit({ type: 'thud', x: e.x, y: e.y, speed: e.speed, tag });
      }
      return;
    }
    if (e.type === 'enter') {
      if (tag === 'lane') this.onLane(e.c.data, e.ball);
      else if (tag === 'inlane' && live) {
        const l = e.c.data;
        l.flash = 1;
        const pts = this.scorer.hit(POINTS.inlane);
        this.emit({ type: 'hit', kind: 'inlane', x: l.x, y: l.y, pts });
        this.charge('inlane', l.x, l.y);
      } else if (tag === 'outlane') {
        const l = e.c.data;
        l.flash = 1;
        if (e.vy > 0 && live) {
          const pts = this.scorer.add(POINTS.outlane);
          this.emit({ type: 'hit', kind: 'outlane', x: l.x, y: l.y, pts });
          this.charge('outlane', l.x, l.y);
        }
      } else if (tag === 'spinner') {
        const S = e.c.data;
        S.spin = Math.min(40, S.spin + Math.hypot(e.vx, e.vy) / 70);
        S.flash = 1;
      } else if (tag === 'scoop') this.onScoop(e.c.data, e.ball);
      else if (tag === 'cup') this.onCup(e.c.data, e.ball);
      else if (tag === 'kickback') this.onKickback(e.c.data, e.ball);
    }
  }

  onLane(l, ball) {
    if (!ball.launched || this.tilted) return;
    l.flash = 1;
    const top = this.T.lanes.filter((x) => x.group === l.group);
    // The skill shot: the first top lane after a plunge, if it's the glowing one.
    if (ball.skill && l.group === 'top') {
      ball.skill = false;
      if (top.indexOf(l) === this.skillLane) {
        const pts = this.scorer.add(POINTS.skillShot, false);
        this.emit({ type: 'feature', kind: 'skillShot', x: l.x, y: l.y, pts, text: 'Skill shot' });
        this.charge('skillShot', l.x, l.y);
      }
      this.skillLane = -1;
    }
    const was = l.lit;
    l.lit = true;
    const pts = this.scorer.hit(was ? POINTS.lane / 4 : POINTS.lane);
    this.emit({ type: 'hit', kind: 'lane', x: l.x, y: l.y, pts, index: l.index, fresh: !was });
    if (!was) this.charge('lane', l.x, l.y);
    if (top.every((x) => x.lit)) {
      const m = this.scorer.raiseMult();
      const pts2 = this.scorer.add(POINTS.laneSet);
      this.emit({ type: 'feature', kind: 'laneSet', x: l.x, y: l.y, pts: pts2, text: `Multiplier ×${m}`, mult: m });
      this.charge('laneSet', l.x, l.y);
      for (const x of top) {
        x.lit = false;
        x.flash = 1;
      }
    }
    this.comboCheck();
  }

  onSpin(S) {
    if (this.tilted) return;
    S.count++;
    const pts = this.scorer.add(POINTS.spin);
    this.emit({ type: 'spin', x: S.x, y: S.y, pts, count: S.count });
    this.charge('spinner', S.x, S.y);
  }

  checkTargetSet(Tg) {
    if (!Tg.set) return;
    const set = this.T.targets.filter((t) => t.set === Tg.set);
    if (set.every((t) => t.lit)) {
      for (const t of set) t.lit = false;
      const pts = this.scorer.add(POINTS.bank);
      this.emit({ type: 'feature', kind: 'targets', x: Tg.a[0], y: Tg.a[1], pts, text: 'Targets complete' });
      this.charge('bank', Tg.a[0], Tg.a[1]);
    }
  }

  bankComplete(bank, x, y) {
    bank.completed++;
    bank.resetIn = 2.5;
    const pts = this.scorer.add(POINTS.bank);
    this.emit({ type: 'feature', kind: 'bank', x, y, pts, text: this.def.bankText || 'Bank cleared' });
    this.charge('bank', x, y);
    for (const K of this.T.kickbacks) {
      if (!K.charged) {
        K.charged = true;
        this.emit({ type: 'kickbackCharged', side: K.side });
      }
    }
    // Orchard and Rose: a cleared bank opens the cellar.
    if (this.T.scoop && this.T.cellar && bank.id === this.def.cellarBank && !this.T.scoop.open) {
      this.T.scoop.open = true;
      this.emit({ type: 'feature', kind: 'cellarOpen', x: this.T.scoop.x, y: this.T.scoop.y, pts: 0, text: this.def.cellarOpenText || 'The cellar is open' });
    }
  }

  onScoop(S, ball) {
    if (S.held || S.cooldown > 0 || ball.frozen) return;
    S.held = ball;
    ball.frozen = true;
    ball.vx = ball.vy = 0;
    S.timer = 0.9;
    S.flash = 1;
    if (!this.tilted) {
      const pts = this.scorer.hit(POINTS.scoop);
      this.emit({ type: 'hit', kind: 'scoop', x: S.x, y: S.y, pts });
      this.charge('scoop', S.x, S.y);
    }
    this.emit({ type: 'scoopHold', x: S.x, y: S.y });
  }

  ejectScoop(b) {
    const S = this.T.scoop;
    S.held = null;
    S.cooldown = 0.6;
    b.frozen = false;
    b.x = S.x;
    b.y = S.y;
    const a = S.eject ?? -Math.PI / 2;
    const sp = S.ejectSpeed ?? 1250;
    b.vx = Math.cos(a) * sp + (this.rand() - 0.5) * 60;
    b.vy = Math.sin(a) * sp;
    this.emit({ type: 'eject', x: S.x, y: S.y });
  }

  enterCellar(b) {
    const S = this.T.scoop;
    const C = this.T.cellar;
    S.held = null;
    S.open = false;
    C.active = true;
    b.inCellar = true;
    b.frozen = false;
    b.x = C.entry.x + (this.rand() - 0.5) * 20;
    b.y = C.entry.y;
    b.vx = (this.rand() - 0.5) * 160;
    b.vy = 200;
    b.inside.clear();
    this.emit({ type: 'cellarEnter', x: S.x, y: S.y });
  }

  onCup(C, ball) {
    if (C.held) return;
    C.held = ball;
    C.timer = 0.7;
    ball.frozen = true;
    ball.vx = ball.vy = 0;
    const pts = this.scorer.add(POINTS.cellar);
    this.emit({ type: 'feature', kind: 'cellar', x: ball.x, y: ball.y, pts, text: this.def.cellarText || 'The roots drink the light' });
  }

  leaveCellar(b) {
    const C = this.T.cellar;
    C.held = null;
    C.active = false;
    b.inCellar = false;
    b.inside.clear();
    const S = this.T.scoop;
    S.cooldown = 0.8;
    this.emit({ type: 'cellarLeave', x: S.x, y: S.y });
    this.ejectScoop(b);
  }

  onKickback(K, b) {
    if (!K.charged || this.tilted || b.vy < 0) return;
    K.charged = false;
    K.flash = 1;
    b.vx = 0;
    b.vy = -1900;
    b.x = K.x;
    this.emit({ type: 'kickback', x: K.x, y: K.y, side: K.side });
  }

  comboCheck() {
    const need = this.mods.comboMultiball;
    if (need && this.scorer.combo >= need && this.multiballCooldown <= 0 && this.activeBalls().length < 3 && this.phase === 'play') {
      if (this.addBall()) {
        this.multiballCooldown = 30;
        this.scorer.combo = 0;
      }
    }
  }

  /** Count a hit of a kind towards lighting, and light panes when it's due. */
  charge(kind, x, y, extra = 0) {
    const rule = LIGHT_RULES[kind];
    if (!rule) return;
    this.charges[kind] = (this.charges[kind] || 0) + 1;
    let n = 0;
    if (this.charges[kind] >= rule.every) {
      this.charges[kind] = 0;
      n = rule.panes;
    }
    n += extra;
    if (n <= 0) return;
    const lit = this.light.lightNear(x, y, n);
    if (lit.length) this.afterLight(lit, x, y, kind);
  }

  afterLight(ids, x, y, kind) {
    this.panesThisBall += ids.length;
    this.stats.panesLit += ids.length;
    const pts = this.scorer.add(POINTS.pane * ids.length, false);
    this.emit({ type: 'light', panes: ids, x, y, kind, pts });
    const q = Math.floor(this.light.fraction * 4);
    if (q > this.milestone && q < 4) {
      this.milestone = q;
      const p2 = this.scorer.add(POINTS.quarter * q, false);
      this.emit({ type: 'milestone', quarter: q, pts: p2 });
    }
    if (this.light.complete) this.windowComplete(x, y);
  }

  paneAt(x, y) {
    for (let i = 0; i < this.panes.length; i++) if (pointInPane(this.panes[i], x, y)) return i;
    return -1;
  }

  windowComplete(x, y) {
    this.milestone = 0;
    if (this.mode === 'single') {
      // The window floods, then dims again, and the next lighting is worth more.
      this.gloria++;
      this.scorer.gloria = this.gloria;
      const pts = this.scorer.addFlat(POINTS.windowBase * (this.gloria - 1));
      this.emit({ type: 'complete', x, y, pts, renew: true, gloria: this.gloria });
      this.floodSlow = 2.4;
      this.renewAt = this.time + 1.0;
      this.light.reset();
      this.emit({ type: 'renew', delay: 2.6 });
      return;
    }
    this.phase = 'complete';
    for (const b of this.world.balls) {
      b.frozen = true;
      b.ascending = true;
    }
    if (this.T.scoop) this.T.scoop.held = null;
    this.emit({ type: 'complete', x, y, pts: 0 });
  }

  // ---- Drains, ball save, stuck balls ----

  checkBalls(h) {
    for (const b of [...this.world.balls]) {
      if (!b.active) continue;
      // Leaving the shooter lane.
      if (!b.launched && b.y < LANE_TOP - 46 && b.x > LANE_X - 30) {
        b.launched = true;
        b.skill = !b.extra;
        if (this.T.gate) this.T.gate.open = 1;
        if (this.phase === 'ready') this.phase = 'play';
        if (this.ballSaveArmed && !b.extra) {
          this.ballSaveArmed = false;
          this.ballSave = BALL_SAVE_SECONDS * (this.mods.ballSave ?? 1);
          if (this.ballSave > 0) this.emit({ type: 'ballSaveOn', seconds: this.ballSave });
        }
      }
      if (b.ascending) {
        b.vy = 0;
        b.y -= 380 * h;
        if (b.y < -60) b.active = false;
        continue;
      }
      if (b.y > DRAIN_Y && !b.inCellar) {
        this.world.removeBall(b);
        this.onDrain(b);
        continue;
      }
      // A ball that stops somewhere it shouldn't gets a gentle shake loose.
      if (!b.frozen && !b.inCellar) {
        const moved = Math.hypot(b.x - b.lastX, b.y - b.lastY);
        const onFlipper = b.y > 860 && (this.input.left || this.input.right);
        const inLane = b.x > LANE_X && b.y > LANE_TOP;
        if (moved < 3 && !onFlipper && !inLane) b.still += h;
        else {
          b.still = 0;
          b.lastX = b.x;
          b.lastY = b.y;
        }
        if (b.still > 3.5) {
          b.still = 0;
          b.vy -= 520;
          b.vx += (this.rand() - 0.5) * 400;
          this.emit({ type: 'shake' });
        }
      }
    }
  }

  onDrain(b) {
    const left = this.activeBalls().filter((x) => !x.ascending).length;
    this.emit({ type: 'drainBall', x: b.x, extra: !!b.extra, remaining: left });
    if (this.phase === 'complete' || this.phase === 'over') return;
    if (left > 0) return; // multiball continues
    if (this.ballSave > 0 && !this.tilted) {
      this.ballSave = 0;
      this.emit({ type: 'saved', why: 'grace' });
      this.serveBall(true);
      return;
    }
    if (this.mods.saveFirstDrain && !this.savedThisWindow && !this.tilted) {
      this.savedThisWindow = true;
      this.emit({ type: 'saved', why: 'angel' });
      this.serveBall(true);
      return;
    }
    // The ball is lost.
    const bonus = endOfBallBonus(this.panesThisBall, this.scorer.mult, this.tilted);
    this.scorer.addFlat(bonus);
    this.balls--;
    this.emit({ type: 'drain', bonus, panes: this.panesThisBall, balls: this.balls, tilted: this.tilted });
    this.panesThisBall = 0;
    this.scorer.newBall();
    if (this.balls <= 0) {
      this.phase = 'over';
      this.emit({ type: 'over' });
      return;
    }
    this.phase = 'wait';
    this.waitTimer = 2.2;
    this.waitThen = () => {
      this.untilt();
      this.serveBall(false);
    };
  }
}

function segDist(d, b) {
  const ex = d.b[0] - d.a[0];
  const ey = d.b[1] - d.a[1];
  const l2 = ex * ex + ey * ey;
  let t = ((b.x - d.a[0]) * ex + (b.y - d.a[1]) * ey) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(b.x - d.a[0] - ex * t, b.y - d.a[1] - ey * t);
}

export { RIGHT };
