// Headless measurements of the table feel: plunger power, flipper shot reach, drains.
import { TABLES } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';

const id = process.argv[2] || 'dawn';
const def = TABLES.find((t) => t.id === id);

function step(g, inp, secs) {
  const n = Math.round(secs / STEP);
  for (let i = 0; i < n; i++) {
    g.input = inp;
    g.fixed(STEP);
  }
}

// 1. Plunger power: hold for a given time, release, see which top lane is hit first.
console.log('== plunger');
for (let hold = 0.2; hold <= 1.0; hold += 0.1) {
  const g = new Game({ table: def, mode: 'single', rand: () => 0.5 });
  step(g, { plunger: true }, hold);
  let first = null;
  let minY = 1e9;
  const n = Math.round(3 / STEP);
  for (let i = 0; i < n; i++) {
    g.input = { plunger: false };
    g.fixed(STEP);
    const b = g.world.balls[0];
    if (b) minY = Math.min(minY, b.y);
    for (const e of g.out) if (e.type === 'hit' && e.kind === 'lane' && first === null) first = e.index;
    g.out.length = 0;
  }
  console.log(`hold ${hold.toFixed(1)}s  minY ${minY.toFixed(0)}  first lane ${first}`);
}

// 2. Flipper shots from a cradle: release the cradle, re-flip after a delay.
console.log('== flipper shots (left flipper, cradled ball)');
for (let delay = 0.0; delay <= 0.3; delay += 0.03) {
  const g = new Game({ table: def, mode: 'single' });
  const b = g.world.balls[0];
  step(g, { left: true }, 0.3);
  b.x = 250; b.y = 900; b.vx = 0; b.vy = 0; b.launched = true;
  step(g, { left: true }, 1.2); // settle in the cradle
  const sx = b.x;
  step(g, { left: false }, delay);
  let minY = 1e9;
  let peak = 0;
  const kinds = new Set();
  const n = Math.round(1.6 / STEP);
  for (let i = 0; i < n; i++) {
    g.input = { left: true };
    g.fixed(STEP);
    if (!g.world.balls[0]) break;
    minY = Math.min(minY, g.world.balls[0].y);
    peak = Math.max(peak, g.world.balls[0].speed);
    for (const e of g.out) if (e.type === 'hit') kinds.add(e.kind);
    g.out.length = 0;
  }
  console.log(`delay ${delay.toFixed(2)}  cradleX ${sx.toFixed(0)}  peak ${peak.toFixed(0)}  minY ${minY.toFixed(0)}  hits ${[...kinds].join(',')}`);
}
