// A simple autoplayer to measure ball life, lighting pace and stuck balls.
import { TABLES } from '../src/tables/index.js';
import { Game } from '../src/game/game.js';
import { STEP } from '../src/physics/world.js';
import { mulberry32 } from '../src/rng.js';

const id = process.argv[2] || 'dawn';
const runs = +(process.argv[3] || 6);
const skill = +(process.env.SKILL || process.argv[4] || 0.85); // chance the bot flips in time
const def = TABLES.find((t) => t.id === id);

export function botInput(g, rnd, mem) {
  const inp = { left: false, right: false, plunger: false };
  for (const b of g.world.balls) {
    if (b.frozen) continue;
    if (b.x > 578 && b.y > 900) {
      mem.pl = (mem.pl || 0) + 1;
      inp.plunger = mem.pl < 60 + mem.plTarget;
      if (mem.pl > 140) { mem.pl = 0; mem.plTarget = Math.floor(rnd() * 70); }
      continue;
    }
    const left = b.x < 299;
    if (b.y > 860 && b.vy > 150 && !mem.decided.has(b.id)) mem.decided.set(b.id, rnd() < skill);
    if (b.y < 820) mem.decided.delete(b.id);
    const go = mem.decided.get(b.id);
    if (b.y > 870 && b.y < 1000) {
      if (b.vy > 150) {
        // A live ball dropping onto the flipper: hit it.
        const lead = Math.min(40, b.vy * 0.02);
        if (go && b.y + lead > 905) left ? (inp.left = true) : (inp.right = true);
      } else {
        // Slow ball on the flipper: let it roll to the sweet spot, then shoot.
        const sweet = left ? b.x > 232 + (mem.aim || 0) : b.x < 366 - (mem.aim || 0);
        if (sweet) {
          left ? (inp.left = true) : (inp.right = true);
          mem.aim = Math.floor(rnd() * 40);
        }
      }
    }
  }
  return inp;
}

if (process.argv[1].endsWith("bot.mjs")) main();
function main() {
let tot = { time: 0, balls: 0, lit: 0, stuck: 0, completes: 0, score: 0 };
for (let r = 0; r < runs; r++) {
  const rnd = mulberry32(1000 + r);
  const g = new Game({ table: def, mode: 'single', balls: 3, rand: rnd });
  const mem = { decided: new Map(), plTarget: 20 };
  let t = 0;
  while (g.phase !== 'over' && t < 900) {
    g.input = botInput(g, rnd, mem);
    g.fixed(STEP);
    t += STEP;
    for (const e of g.out) {
      if (e.type === 'shake') tot.stuck++;
      if (e.type === 'complete') tot.completes++;
    }
    g.out.length = 0;
  }
  tot.time += t;
  tot.balls += 3;
  tot.lit += g.stats.panesLit;
  tot.score += g.score;
  console.log(`run ${r}: ${t.toFixed(0)}s, panes ${g.stats.panesLit}/${g.light.total}, score ${g.score}`);
}
console.log(`avg ball life ${(tot.time / tot.balls).toFixed(1)}s, panes/min ${((tot.lit / tot.time) * 60).toFixed(1)}, completes ${tot.completes}, stuck shakes ${tot.stuck}, avg score ${(tot.score / runs).toFixed(0)}`);
}
