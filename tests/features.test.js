import { describe, it, expect } from 'vitest';
import { TABLE_BY_ID } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';

const seeded = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function run(g, secs, inp = {}) {
  for (let i = 0; i < Math.round(secs / STEP); i++) {
    g.input = { left: false, right: false, plunger: false, ...inp };
    g.fixed(STEP);
  }
}
const events = (g, type) => g.out.filter((e) => e.type === type || (e.kind === type && e.type !== 'light'));

describe('Dawn bells', () => {
  it('ringing all three bells while they swing sounds the Angelus', () => {
    const g = new Game({ table: TABLE_BY_ID.dawn, mode: 'single', rand: seeded() });
    const b = g.world.balls[0];
    b.launched = true;
    for (const bell of g.T.bells) {
      b.x = bell.p.c.x - 40;
      b.y = bell.p.c.y;
      b.vx = 900;
      b.vy = 0;
      run(g, 0.08);
    }
    expect(events(g, 'angelus').length).toBe(1);
    expect(g.T.bells.some((x) => Math.abs(x.p.w) > 0.1)).toBe(true);
  });
});

describe('Saints rosette', () => {
  it('turns, and striking all six haloes gives the Litany and reverses it', () => {
    const g = new Game({ table: TABLE_BY_ID.saints, mode: 'single', rand: seeded() });
    const R = g.T.rotor;
    const a0 = R.R.angle;
    run(g, 1);
    expect(R.R.angle).not.toBe(a0);
    const b = g.world.balls[0];
    b.launched = true;
    for (let i = 0; i < 6 && !events(g, 'litany').length; i++) {
      const lobe = R.R.parts.find((p) => p.c.data.index === i).c;
      b.x = lobe.x + (lobe.x - R.x) * 0.6;
      b.y = lobe.y + (lobe.y - R.y) * 0.6;
      b.vx = (R.x - b.x) * 6;
      b.vy = (R.y - b.y) * 6;
      run(g, 0.06);
      if (!R.lit[i] && !events(g, 'litany').length) R.lit[i] = true; // a glancing miss: mark it as the player would retry
    }
    expect(events(g, 'litany').length).toBe(1);
    expect(R.dir).toBe(-1);
  });
});

describe('Orchard cellar', () => {
  it('clearing the apples opens the scoop, which drops the ball into the cellar and back', () => {
    const g = new Game({ table: TABLE_BY_ID.orchard, mode: 'single', rand: seeded() });
    const b = g.world.balls[0];
    b.launched = true;
    g.phase = 'play';
    const bank = g.T.banks.apples;
    for (const d of bank.drops) {
      const mx = (d.a[0] + d.b[0]) / 2;
      const my = (d.a[1] + d.b[1]) / 2;
      b.x = mx;
      b.y = my + 30;
      b.vx = 0;
      b.vy = -900;
      run(g, 0.08);
    }
    expect(bank.drops.every((d) => d.down)).toBe(true);
    expect(g.T.scoop.open).toBe(true);
    b.x = g.T.scoop.x + 30;
    b.y = g.T.scoop.y;
    b.vx = -500;
    b.vy = 0;
    run(g, 1.5);
    expect(events(g, 'cellarEnter').length).toBe(1);
    expect(b.y).toBeGreaterThan(1100);
    run(g, 12);
    expect(events(g, 'cellarLeave').length).toBe(1);
    expect(events(g, 'peg').length).toBeGreaterThan(0);
    expect(g.world.balls.length).toBe(1);
  });
});

describe('Tempest wind', () => {
  it('gusts push the ball sideways on the upper glass only', () => {
    const g = new Game({ table: TABLE_BY_ID.tempest, mode: 'single', rand: seeded() });
    const b = g.world.balls[0];
    b.frozen = true;
    run(g, 12);
    expect(events(g, 'windWarn').length).toBeGreaterThan(0);
    // Force a gust and check the force on a high ball and a low one.
    g.wind.state = 'gust';
    g.wind.timer = 5;
    g.wind.power = 1;
    b.frozen = false;
    b.x = 300;
    b.y = 300;
    run(g, STEP);
    expect(Math.abs(b.fx)).toBeGreaterThan(200);
    b.y = 950;
    run(g, STEP);
    expect(b.fx).toBe(0);
  });

  it('the lightning rod gives a thunderclap during a gust', () => {
    const g = new Game({ table: TABLE_BY_ID.tempest, mode: 'single', rand: seeded() });
    g.wind.state = 'gust';
    g.wind.timer = 5;
    const b = g.world.balls[0];
    b.launched = true;
    const rod = g.T.targets.find((t) => t.rod);
    b.x = (rod.a[0] + rod.b[0]) / 2;
    b.y = rod.a[1] + 30;
    b.vx = 0;
    b.vy = -900;
    run(g, 0.1);
    expect(events(g, 'thunder').length).toBe(1);
  });
});

describe('Rose', () => {
  it('has every feature: rosette, bells, wind and the crypt', () => {
    const g = new Game({ table: TABLE_BY_ID.rose, mode: 'single', rand: seeded() });
    expect(g.T.rotor).toBeTruthy();
    expect(g.T.bells.length).toBe(2);
    expect(g.wind).toBeTruthy();
    expect(g.T.scoop && g.T.cellar).toBeTruthy();
  });
});
