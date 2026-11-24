// Where balls get stuck (the game's "shake loose" rescue), and where plunges drain.
import { TABLES } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';
import { mulberry32 } from '../src/rng.js';
import { botInput } from './bot.mjs';
const def = TABLES.find((t) => t.id === process.argv[2]);
const spots = [];
for (let r = 0; r < 4; r++) {
  const rnd = mulberry32(1000 + r);
  const g = new Game({ table: def, mode: 'single', balls: 3, rand: rnd });
  const mem = { decided: new Map(), plTarget: 20 };
  for (let t = 0; t < 600 && g.phase !== 'over'; t += STEP) {
    g.input = botInput(g, rnd, mem);
    g.fixed(STEP);
    for (const e of g.out) if (e.type === 'shake') { const b = g.world.balls.find((b) => b.still === 0); spots.push(g.world.balls.map((b) => `${b.x.toFixed(0)},${b.y.toFixed(0)}`).join('|')); }
    g.out.length = 0;
  }
}
console.log('stuck at:', spots.join('  '));
// Plunge paths that drain.
for (const hold of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
  const g = new Game({ table: def, mode: 'single', rand: () => 0.5 });
  for (let i = 0; i < hold / STEP; i++) { g.input = { plunger: true }; g.fixed(STEP); }
  const path = [];
  for (let i = 0; i < 4 / STEP; i++) { g.input = {}; g.fixed(STEP); const b = g.world.balls[0]; if (!b) { path.push('DRAIN'); break; } if (i % 24 === 0) path.push(`${b.x.toFixed(0)},${b.y.toFixed(0)}`); g.out.length = 0; }
  console.log('hold', hold, path.join(' '));
}
