import { describe, it, expect } from 'vitest';
import { World, Ball, Flipper, seg, circle, chain, ballEnergy, STEP } from '../src/physics/world.js';
import { addPendulum, addRotor } from '../src/physics/bodies.js';

function run(world, seconds, each) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    world.step(STEP);
    if (each) each(i);
  }
}

describe('no tunnelling', () => {
  it('a very fast ball never passes a zero-thickness wall', () => {
    for (const speed of [500, 2000, 4000, 4600, 20000]) {
      const w = new World({ gravity: 0 });
      w.addStatic(seg(-500, 300, 1100, 300));
      const b = w.addBall(new Ball(300, 100));
      b.vy = speed;
      let maxY = 0;
      run(w, 1, () => (maxY = Math.max(maxY, b.y)));
      expect(maxY).toBeLessThan(300);
      expect(b.vy).toBeLessThan(0); // it bounced back
    }
  });

  it('a fast ball at a shallow angle stays inside a closed box', () => {
    const w = new World({ gravity: 1500 });
    w.addStatic(chain([[0, 0], [600, 0], [600, 1000], [0, 1000]], { e: 0.95, f: 0 }, true));
    const b = w.addBall(new Ball(300, 500));
    b.vx = 4400;
    b.vy = 900;
    run(w, 8, () => {
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(600);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(1000);
    });
  });

  it('a fast ball cannot slip through a thin post', () => {
    const w = new World({ gravity: 0 });
    w.addStatic(circle(300, 300, 3));
    const b = w.addBall(new Ball(300, 0));
    b.vy = 4600;
    run(w, 0.3);
    expect(b.y).toBeLessThan(300);
  });

  it('a one-way gate lets the ball out but not back in', () => {
    const w = new World({ gravity: 0 });
    // Solid for balls above it (normal pointing up the table).
    w.addStatic(seg(0, 300, 600, 300, { oneWay: { x: 0, y: -1 } }));
    const b = w.addBall(new Ball(300, 500));
    b.vy = -1500;
    run(w, 0.4);
    expect(b.y).toBeLessThan(300); // passed through from below
    b.vy = 1500;
    run(w, 0.4);
    expect(b.y).toBeLessThan(300); // bounced off from above
  });
});

describe('flippers', () => {
  const make = () => {
    const w = new World({ gravity: 1500 });
    const f = w.addFlipper(
      new Flipper({ x: 200, y: 900, length: 92, rest: 0.52, up: -0.44, upSpeed: 24, downSpeed: 16 }),
    );
    return { w, f };
  };

  it('a ball resting on the flipper is fired up the table', () => {
    const { w, f } = make();
    // Drop the ball onto the flipper about two thirds along and let it settle.
    const b = w.addBall(new Ball(200 + Math.cos(0.52) * 60, 900 + Math.sin(0.52) * 60 - 30));
    run(w, 0.05);
    f.pressed = true;
    let best = 0;
    run(w, 0.2, () => (best = Math.max(best, -b.vy)));
    expect(best).toBeGreaterThan(1200);
    expect(b.speed).toBeLessThan(4600);
  });

  it('a held flipper cradles the ball (it does not keep kicking it)', () => {
    const { w, f } = make();
    f.pressed = true;
    run(w, 0.2);
    // A wall at the pivot end so the ball can come to rest against it.
    w.addStatic(seg(190, 800, 190, 905));
    const b = w.addBall(new Ball(260, 830));
    run(w, 3);
    expect(f.w).toBe(0);
    expect(b.speed).toBeLessThan(60);
    expect(b.y).toBeLessThan(900); // still on top of the flipper
  });

  it('the flipper tip never passes through a fast ball', () => {
    const { w, f } = make();
    const b = w.addBall(new Ball(200 + Math.cos(0.1) * 88, 900 + Math.sin(0.1) * 88 - 22));
    f.upSpeed = 60; // far faster than the game uses
    f.pressed = true;
    let below = false;
    run(w, 0.15, () => {
      // Relative to the flipper line, the ball must stay on the top side.
      const nx = -Math.sin(f.angle);
      const ny = Math.cos(f.angle);
      const side = (b.x - f.px) * nx + (b.y - f.py) * ny;
      const along = (b.x - f.px) * Math.cos(f.angle) + (b.y - f.py) * Math.sin(f.angle);
      if (along > 0 && along < f.len && side > 0) below = true;
    });
    expect(below).toBe(false);
  });
});

describe('energy', () => {
  it('a ball bouncing on still walls never gains energy', () => {
    const w = new World({ gravity: 1500 });
    w.addStatic(chain([[0, 0], [600, 0], [600, 1000], [0, 1000]], { e: 0.6 }, true));
    w.addStatic(seg(100, 600, 500, 700));
    w.addStatic(circle(300, 300, 30, { e: 0.8 }));
    const b = w.addBall(new Ball(310, 50));
    b.vx = 600;
    let e0 = ballEnergy(w, b);
    run(w, 10, () => {
      const e = ballEnergy(w, b);
      expect(e).toBeLessThanOrEqual(e0 + 1e-3 * Math.abs(e0) + 50);
      e0 = Math.min(e0, e);
    });
  });

  it('bumpers add a bounded kick, never runaway speed', () => {
    const w = new World({ gravity: 1500 });
    w.addStatic(chain([[0, 0], [600, 0], [600, 1000], [0, 1000]], { e: 0.5 }, true));
    for (const [x, y] of [[200, 300], [400, 300], [300, 450]]) w.addStatic(circle(x, y, 26, { kick: 900 }));
    const b = w.addBall(new Ball(290, 100));
    let top = 0;
    run(w, 15, () => (top = Math.max(top, b.speed)));
    expect(top).toBeLessThan(2600);
  });

  it('a resting ball settles instead of jittering', () => {
    const w = new World({ gravity: 1500 });
    w.addStatic(seg(0, 500, 600, 500));
    const b = w.addBall(new Ball(300, 400));
    run(w, 3);
    expect(Math.abs(b.vy)).toBeLessThan(30);
    expect(b.y).toBeGreaterThan(486);
    expect(b.y).toBeLessThan(489);
  });
});

describe('moving bodies', () => {
  it('a bell swings when hit and comes back to rest', () => {
    const w = new World({ gravity: 1500 });
    const bell = addPendulum(w, { x: 300, y: 100, len: 60, r: 20 });
    const b = w.addBall(new Ball(200, 160));
    b.vx = 1500;
    b.vy = 0;
    let maxTh = 0;
    run(w, 0.5, () => (maxTh = Math.max(maxTh, Math.abs(bell.th))));
    expect(maxTh).toBeGreaterThan(0.1);
    w.removeBall(b);
    run(w, 20);
    expect(Math.abs(bell.th)).toBeLessThan(0.05);
  });

  it('a rotor drags a touching ball round with it', () => {
    const w = new World({ gravity: 0 });
    addRotor(w, { x: 300, y: 300, w: 3, parts: [{ type: 'circle', x: 0, y: 0, r: 40 }] });
    const b = w.addBall(new Ball(300, 300 - 52));
    b.vy = 50; // pressing gently onto it
    run(w, 0.05);
    expect(b.vx).toBeGreaterThan(0); // the top of a clockwise (y down) rotor moves +x
  });
});
