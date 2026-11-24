// A run: five windows in order, three balls, a relic chosen between windows.
// Pure logic: main.js drives the screens around it.
import { TABLES } from '../tables/index.js';
import { Game } from './game.js';
import { windowBonus, POINTS } from './scoring.js';
import { computeMods, offerRelics, RELIC_BY_ID, RELICS, isUnlocked } from '../relics/relics.js';

export const START_BALLS = 3;
export const MAX_BALLS_RESTORED = 3;

export class Run {
  constructor(o = {}) {
    this.tables = o.tables || TABLES;
    this.index = 0;
    this.balls = START_BALLS;
    this.score = 0;
    this.relics = [];
    this.rand = o.rand || Math.random;
    this.windowsDone = 0;
    this.finished = false;
    this.over = false;
    this.log = []; // per-window results
  }

  get table() {
    return this.tables[this.index];
  }

  get mods() {
    return computeMods(this.relics);
  }

  /** Score multiplier from Gilded Lead. */
  get extraMult() {
    return 1 + this.mods.gildedPerWindow * this.windowsDone;
  }

  startWindow() {
    this.game = new Game({
      table: this.table,
      mode: 'run',
      mods: this.mods,
      balls: this.balls,
      score: this.score,
      windowIndex: this.index,
      extraMult: this.extraMult,
      rand: this.rand,
    });
    return this.game;
  }

  /** Call when the window's flood is done. Returns the tally shown to the player. */
  completeWindow() {
    const g = this.game;
    const before = g.score;
    const bonus = windowBonus(this.index, g.balls);
    g.scorer.addFlat(bonus);
    const restored = Math.min(MAX_BALLS_RESTORED, g.balls + 1) - g.balls;
    this.balls = g.balls + Math.max(0, restored);
    this.windowsDone++;
    const tally = {
      window: this.table,
      windowScore: before - this.score,
      bonus,
      restored: Math.max(0, restored),
      balls: this.balls,
      combo: g.scorer.bestCombo,
      panes: g.light.total,
    };
    if (this.index === this.tables.length - 1) {
      const last = this.balls * POINTS.ballLeftBonus;
      g.scorer.addFlat(last);
      tally.finalBonus = last;
      this.finished = true;
    }
    this.score = g.score;
    this.log.push(tally);
    return tally;
  }

  /** Three relics to choose from (unlocked, not already held). */
  offer(stats, unlockedIds) {
    return offerRelics(this.relics, stats, unlockedIds, this.rand);
  }

  takeRelic(id) {
    const r = RELIC_BY_ID[id];
    if (!r || this.relics.includes(id)) return;
    this.relics.push(id);
    if (r.extraBall) this.balls += r.extraBall;
  }

  nextWindow() {
    this.index++;
    return this.startWindow();
  }

  /** Call when the game reports 'over' (all balls lost). */
  lose() {
    this.over = true;
    this.score = this.game.score;
  }
}

/** Relics whose unlock condition is met now but weren't before. */
export function newlyUnlocked(statsBefore, statsAfter, known = []) {
  return RELICS.filter((r) => r.unlock && !known.includes(r.id) && !isUnlocked(r, statsBefore) && isUnlocked(r, statsAfter));
}
