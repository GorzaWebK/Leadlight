import { TABLES } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';
const def = TABLES.find((t) => t.id === (process.argv[2] || 'dawn'));
const step = (g, inp, secs, cb) => { const n = Math.round(secs / STEP); for (let i = 0; i < n; i++) { g.input = inp; g.fixed(STEP); if (cb && cb(g) === false) return; } };
console.log('== plunger path (where the ball leaves the arch, then where it crosses y=170)');
for (let hold = 0.3; hold <= 1.01; hold += 0.05) {
  const g = new Game({ table: def, mode: 'single', rand: () => 0.5 });
  step(g, { plunger: true }, hold);
  let cross = null; let top = null; let prevY = 2000;
  step(g, { plunger: false }, 2.5, (g) => { const b = g.world.balls[0]; if (!b) return false; if (!top || b.y < top[1]) top = [b.x, b.y]; if (prevY < 170 && b.y >= 170 && b.vy > 0 && !cross) cross = [b.x.toFixed(0), b.vx.toFixed(0)]; prevY = b.y; });
  console.log(`hold ${hold.toFixed(2)} top ${top.map(v=>v.toFixed(0))} crosses170 ${cross}`);
}
console.log('== drop catch (cradle, release, re-flip)');
for (let delay = 0.2; delay <= 0.8; delay += 0.05) {
  const g = new Game({ table: def, mode: 'single' });
  const b = g.world.balls[0];
  step(g, { left: true }, 0.3);
  b.x = 250; b.y = 900; b.vx = 0; b.vy = 0; b.launched = true;
  step(g, { left: true }, 1.2);
  step(g, { left: false }, delay);
  const bx = b.x;
  let minY = 1e9, peak = 0; const kinds = new Set();
  step(g, { left: true }, 1.6, (g) => { const c = g.world.balls[0]; if (!c) return false; minY = Math.min(minY, c.y); peak = Math.max(peak, c.speed); for (const e of g.out) if (e.type === 'hit') kinds.add(e.kind); g.out.length = 0; });
  console.log(`delay ${delay.toFixed(2)} ballX@flip ${bx.toFixed(0)} peak ${peak.toFixed(0)} minY ${minY.toFixed(0)} hits ${[...kinds].join(',')}`);
}
