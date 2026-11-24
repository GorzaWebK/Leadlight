// Which top lane a plunge of each strength lands in (fine steps).
import { TABLES } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';
const def = TABLES.find((t) => t.id === (process.argv[2] || 'dawn'));
const res = [];
for (let hold = 0.3; hold <= 1.1; hold += 0.01) {
  const g = new Game({ table: def, mode: 'single', rand: () => 0.5 });
  for (let i = 0; i < Math.round(hold / STEP); i++) { g.input = { plunger: true }; g.fixed(STEP); }
  let lane = '.';
  for (let i = 0; i < 4 / STEP && lane === '.'; i++) {
    g.input = {}; g.fixed(STEP);
    for (const e of g.out) if (e.type === 'hit' && e.kind === 'lane') lane = String(e.index);
    g.out.length = 0;
    if (!g.world.balls.length) lane = 'D';
  }
  res.push(lane);
}
console.log('hold 0.30..1.10 step .01:\n' + res.join(''));
// The longest run of lane entries, as a plunger pull band.
let best = [0, 0], cur = null;
res.forEach((c, i) => {
  if (/\d/.test(c)) { if (!cur) cur = [i, i]; cur[1] = i; if (cur[1] - cur[0] > best[1] - best[0]) best = [...cur]; }
  else cur = null;
});
const toPull = (i) => Math.min(1, (0.3 + i * 0.01) / 1.1);
console.log('skillPull:', [toPull(best[0]).toFixed(3), toPull(best[1] + 1).toFixed(3)]);
