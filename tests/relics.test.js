import { describe, it, expect } from 'vitest';
import { RELICS, computeMods, offerRelics, isUnlocked, DEFAULT_MODS } from '../src/relics/relics.js';
import { TABLE_BY_ID } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { Run, newlyUnlocked } from '../src/game/run.js';
import { STEP } from '../src/physics/world.js';

const seeded = (s = 3) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const dawn = TABLE_BY_ID.dawn;
function run(g, secs, inp = {}) {
  for (let i = 0; i < Math.round(secs / STEP); i++) {
    g.input = { left: false, right: false, plunger: false, ...inp };
    g.fixed(STEP);
  }
}
const game = (ids, o = {}) => new Game({ table: dawn, mode: 'run', mods: computeMods(ids), rand: seeded(), ...o });
function launch(g) {
  run(g, 0.9, { plunger: true });
  run(g, 1.2);
}
function drainNow(g) {
  for (const b of g.world.balls) Object.assign(b, { x: 299, y: 1070, vx: 0, vy: 800 });
  run(g, 0.1);
}
function hitBumper(g) {
  const B = g.T.bumpers[0];
  const b = g.world.balls[0];
  Object.assign(b, { x: B.x, y: B.y - B.r - b.r - 4, vx: 0, vy: 600, launched: true });
  run(g, 0.05);
}

describe('relic list', () => {
  it('has about fifteen relics, each with a name, a description and real modifiers', () => {
    expect(RELICS.length).toBeGreaterThanOrEqual(15);
    for (const r of RELICS) {
      expect(r.name && r.text && r.kind).toBeTruthy();
      for (const k of Object.keys(r.mods)) expect(k in DEFAULT_MODS).toBe(true);
    }
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length);
  });

  it('offers three different relics you have unlocked and do not hold', () => {
    const offer = offerRelics(['broad'], {}, [], seeded());
    expect(offer.length).toBe(3);
    expect(new Set(offer.map((r) => r.id)).size).toBe(3);
    for (const r of offer) {
      expect(r.id).not.toBe('broad');
      expect(isUnlocked(r, {})).toBe(true);
    }
  });

  it('locked relics unlock from saved stats', () => {
    const prism = RELICS.find((r) => r.id === 'prism');
    expect(isUnlocked(prism, { panesLit: 10 })).toBe(false);
    expect(isUnlocked(prism, { panesLit: 1500 })).toBe(true);
    const fresh = newlyUnlocked({ panesLit: 1400 }, { panesLit: 1600 });
    expect(fresh.map((r) => r.id)).toContain('prism');
  });
});

describe('relic effects', () => {
  it('Broad Came makes the flippers longer', () => {
    expect(game(['broad']).T.flippers[0].len).toBeCloseTo(game([]).T.flippers[0].len * 1.2);
  });

  it('Twin Panes lights panes in pairs', () => {
    const g = game(['twin']);
    expect(g.light.lightNear(300, 600, 1).length).toBe(2);
  });

  it("Martyr's Crown doubles points and removes ball save", () => {
    const g = game(['crown']);
    launch(g);
    expect(g.ballSave).toBeLessThanOrEqual(0);
    expect(g.scorer.add(100, false)).toBe(200);
  });

  it('Guardian Angel gives back the first lost ball on each window only', () => {
    const g = game(['angel'], { balls: 3 });
    launch(g);
    g.ballSave = 0;
    drainNow(g);
    expect(g.balls).toBe(3);
    launch(g);
    g.ballSave = 0;
    drainNow(g);
    expect(g.balls).toBe(2);
  });

  it('Feather of Gabriel lowers gravity', () => {
    expect(game(['feather']).world.gy).toBeCloseTo(1500 * 0.85);
  });

  it('Lantern Bumpers and Prism light more panes per bumper hit', () => {
    const plain = game([]);
    hitBumper(plain);
    hitBumper(plain);
    const lantern = game(['lantern']);
    hitBumper(lantern);
    hitBumper(lantern);
    expect(lantern.light.count).toBeGreaterThan(plain.light.count);
    const prism = game(['prism']);
    hitBumper(prism);
    expect(prism.light.count).toBeGreaterThanOrEqual(1);
  });

  it("St Christopher's Medal forgives nudges that would tilt", () => {
    const g = game(['medal']);
    launch(g);
    for (let i = 0; i < 3; i++) {
      g.nudge();
      run(g, 0.35);
    }
    expect(g.tilted).toBe(false);
  });

  it("Pilgrim's Return kicks a ball back out of the outlane once", () => {
    const g = game(['kickback']);
    expect(g.T.kickbacks.length).toBe(2);
    const b = g.world.balls[0];
    Object.assign(b, { x: 41, y: 760, vx: 0, vy: 400, launched: true });
    g.phase = 'play';
    run(g, 0.3);
    expect(g.out.some((e) => e.type === 'kickback')).toBe(true);
    expect(b.vy).toBeLessThan(0);
    expect(g.T.kickbacks[0].charged).toBe(false);
  });

  it('Sanctuary Post raises a post between the flippers at the start of a ball', () => {
    const g = game(['post']);
    launch(g);
    expect(g.T.centrePost.c.enabled).toBe(true);
  });

  it('Vespers Hourglass slows time after a nudge', () => {
    const g = game(['hourglass']);
    launch(g);
    g.update(0.016, { nudge: true });
    for (let i = 0; i < 20; i++) g.update(0.016, {});
    expect(g.timeScale).toBeLessThan(0.6);
  });

  it('Choir of Echoes releases another ball on a long combo', () => {
    const g = game(['choir']);
    launch(g);
    g.phase = 'play';
    g.scorer.combo = 8;
    g.comboCheck();
    expect(g.world.balls.length).toBe(2);
  });

  it('Molten Trail lights the pane under a fast ball', () => {
    const g = game(['molten']);
    launch(g);
    g.phase = 'play';
    const b = g.world.balls[0];
    const p = g.panes[40];
    Object.assign(b, { x: p.cx, y: p.cy, vx: 1800, vy: 0 });
    b.frozen = true; // hold it over the pane, still "moving fast"
    b.speedOverride = true;
    const orig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(b), 'speed');
    Object.defineProperty(b, 'speed', { get: () => 1800 });
    b.frozen = false;
    g.world.gy = 0;
    run(g, 0.15);
    expect(g.light.count).toBeGreaterThan(0);
    void orig;
  });

  it('Censer lengthens combos', () => {
    expect(game(['censer']).scorer.comboWindow).toBeGreaterThan(game([]).scorer.comboWindow);
  });
});

describe('a run', () => {
  it('goes through five windows, restores a ball each time, and takes relics between them', () => {
    const r = new Run({ rand: seeded() });
    let g = r.startWindow();
    expect(g.def.id).toBe('dawn');
    r.balls = 2;
    g.balls = 2;
    g.light.lightAll(300, 300);
    const t = r.completeWindow();
    expect(t.restored).toBe(1);
    expect(r.balls).toBe(3);
    expect(r.score).toBeGreaterThan(0);
    r.takeRelic('candle');
    expect(r.balls).toBe(4);
    r.takeRelic('gilded');
    expect(r.extraMult).toBeCloseTo(1.5);
    for (let i = 1; i < 5; i++) {
      g = r.nextWindow();
      expect(g.def.index).toBe(i);
      g.light.lightAll(300, 300);
      r.completeWindow();
    }
    expect(r.finished).toBe(true);
    expect(r.log[4].finalBonus).toBeGreaterThan(0);
  });

  it('carries the score from window to window', () => {
    const r = new Run({ rand: seeded() });
    const g = r.startWindow();
    g.scorer.addFlat(12345);
    r.completeWindow();
    const g2 = r.nextWindow();
    expect(g2.score).toBe(r.score);
  });
});
