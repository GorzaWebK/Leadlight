// Points, combos and multipliers. Pure logic, no DOM.

export const POINTS = {
  bumper: 100,
  sling: 30,
  post: 0,
  lane: 1000,
  laneSet: 5000,
  inlane: 500,
  outlane: 2000,
  target: 500,
  drop: 750,
  bank: 5000,
  spin: 25,
  bell: 400,
  angelus: 20000,
  rotorLobe: 300,
  rotorHub: 150,
  litany: 25000,
  scoop: 2500,
  peg: 250,
  cellar: 15000,
  rod: 1500,
  thunder: 20000,
  pane: 60,
  skillShot: 25000,
  windowBase: 50000,
  quarter: 5000,
  endBonusPerPane: 150,
  ballLeftBonus: 25000,
};

export const COMBO_WINDOW = 2.2; // seconds between hits that keep a combo going
export const MAX_PLAYFIELD_MULT = 5;

export class Scorer {
  constructor(o = {}) {
    this.score = o.score ?? 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboWindow = COMBO_WINDOW * (o.comboTime ?? 1);
    this.comboCap = o.comboCap ?? 20;
    this.mult = 1; // playfield multiplier from the top lanes, resets each ball
    this.relicMult = o.scoreMult ?? 1; // from relics
    this.gloria = o.gloria ?? 1; // single-window renewals
    this.bestCombo = 0;
  }

  get comboMult() {
    return 1 + Math.min(this.combo, this.comboCap) * 0.1;
  }

  /** Multiplier applied to a scoring event right now. */
  factor(useCombo = true) {
    return this.mult * this.relicMult * this.gloria * (useCombo ? this.comboMult : 1);
  }

  /** A hit on a fixture: extends the combo, then scores. Returns points added. */
  hit(base) {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 0;
    this.comboTimer = this.comboWindow;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    return this.add(base);
  }

  /** Score without touching the combo. */
  add(base, useCombo = true) {
    const pts = Math.round((base * this.factor(useCombo)) / 10) * 10;
    this.score += pts;
    return pts;
  }

  /** Flat points (bonuses), no multipliers. */
  addFlat(pts) {
    this.score += Math.round(pts);
    return Math.round(pts);
  }

  raiseMult() {
    if (this.mult < MAX_PLAYFIELD_MULT) this.mult++;
    return this.mult;
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }
  }

  newBall() {
    this.mult = 1;
    this.combo = 0;
    this.comboTimer = 0;
  }
}

/** End-of-ball bonus for the panes lit during that ball. */
export function endOfBallBonus(panesThisBall, mult, tilted) {
  if (tilted) return 0;
  return panesThisBall * POINTS.endBonusPerPane * mult;
}

/** Bonus for finishing a window: grows through the run. */
export function windowBonus(windowIndex, ballsInHand) {
  return POINTS.windowBase * (windowIndex + 1) + ballsInHand * 5000;
}
