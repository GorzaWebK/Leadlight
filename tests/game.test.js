import { describe, it, expect } from 'vitest';
import { TABLES } from '../src/tables/index.js';
import { Game, BALL_SAVE_SECONDS } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';
import { LANE_X } from '../src/tables/common.js';

const dawn = TABLES.find((t) => t.id === 'dawn');
const seeded = () => {
  let s = 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
function run(g, secs, inp = {}) {
  for (let i = 0; i < Math.round(secs / STEP); i++) {
    g.input = { left: false, right: false, plunger: false, ...inp };
    g.fixed(STEP);
  }
}
function launch(g) {
  run(g, 0.9, { plunger: true });
  run(g, 1.5);
}
function drainNow(g) {
  for (const b of g.world.balls) {
    b.x = 299;
    b.y = 1070;
    b.vx = 0;
    b.vy = 800;
  }
  run(g, 0.1);
}

describe('ball flow', () => {
  it('a full plunge launches the ball out of the shooter lane into play', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    expect(g.phase).toBe('play');
    const b = g.world.balls[0];
    expect(b.launched).toBe(true);
    expect(b.x < LANE_X || b.y < 300).toBe(true);
  });

  it('a ball lost during ball save comes back', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    expect(g.ballSave).toBeGreaterThan(0);
    drainNow(g);
    expect(g.balls).toBe(3);
    expect(g.out.some((e) => e.type === 'saved')).toBe(true);
    expect(g.world.balls.length).toBe(1);
  });

  it('after ball save runs out, a drain costs a ball, and the last drain ends the game', () => {
    const g = new Game({ table: dawn, mode: 'single', balls: 2, rand: seeded() });
    launch(g);
    g.ballSave = 0;
    drainNow(g);
    expect(g.balls).toBe(1);
    expect(g.phase).toBe('wait');
    run(g, 3);
    expect(g.phase).toBe('ready');
    launch(g);
    g.ballSave = 0;
    drainNow(g);
    expect(g.phase).toBe('over');
  });

  it(`ball save lasts about ${BALL_SAVE_SECONDS} seconds`, () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    expect(g.ballSave).toBeGreaterThan(BALL_SAVE_SECONDS - 2);
    g.world.balls[0].frozen = true; // keep it safe while the clock runs
    run(g, BALL_SAVE_SECONDS);
    expect(g.ballSave).toBeLessThanOrEqual(0);
  });
});

describe('nudge and tilt', () => {
  it('two quick nudges warn, three tilt and kill the flippers', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    g.nudge();
    run(g, 0.35);
    g.nudge();
    expect(g.out.some((e) => e.type === 'tiltWarn')).toBe(true);
    expect(g.tilted).toBe(false);
    run(g, 0.35);
    g.nudge();
    expect(g.tilted).toBe(true);
    run(g, 0.2, { left: true });
    expect(g.T.flippers[0].pressed).toBe(false);
  });

  it('spaced-out nudges never tilt', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    for (let i = 0; i < 6; i++) {
      g.nudge();
      run(g, 2.5);
    }
    expect(g.tilted).toBe(false);
  });

  it('a nudge pushes the ball up the table', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    const b = g.world.balls[0];
    const vy = b.vy;
    g.nudge();
    expect(b.vy).toBeLessThan(vy);
  });

  it('a tilted ball earns no end-of-ball bonus and the table recovers for the next ball', () => {
    const g = new Game({ table: dawn, mode: 'single', rand: seeded() });
    launch(g);
    g.panesThisBall = 20;
    g.doTilt();
    g.ballSave = 0;
    drainNow(g);
    const d = g.out.find((e) => e.type === 'drain');
    expect(d.bonus).toBe(0);
    run(g, 3);
    expect(g.tilted).toBe(false);
    expect(g.T.flippers[0].enabled).toBe(true);
  });
});
