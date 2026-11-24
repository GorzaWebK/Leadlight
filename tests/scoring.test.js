import { describe, it, expect } from 'vitest';
import { Scorer, POINTS, endOfBallBonus, windowBonus, COMBO_WINDOW, MAX_PLAYFIELD_MULT } from '../src/game/scoring.js';

describe('scoring', () => {
  it('scores a hit with no multipliers at face value', () => {
    const s = new Scorer();
    expect(s.hit(POINTS.bumper)).toBe(100);
    expect(s.score).toBe(100);
  });

  it('quick hits build a combo that multiplies points', () => {
    const s = new Scorer();
    for (let i = 0; i < 6; i++) {
      s.hit(100);
      s.update(0.5);
    }
    expect(s.combo).toBe(5);
    expect(s.comboMult).toBeCloseTo(1.5);
    expect(s.hit(100)).toBe(160);
  });

  it('the combo breaks after a pause', () => {
    const s = new Scorer();
    s.hit(100);
    s.hit(100);
    s.update(COMBO_WINDOW + 0.1);
    expect(s.combo).toBe(0);
    s.hit(100);
    expect(s.combo).toBe(0);
  });

  it('the combo multiplier is capped', () => {
    const s = new Scorer();
    for (let i = 0; i < 60; i++) s.hit(1);
    expect(s.comboMult).toBeCloseTo(3);
  });

  it('the playfield multiplier stacks with relics and renewals, and resets each ball', () => {
    const s = new Scorer({ scoreMult: 2, gloria: 3 });
    s.raiseMult();
    expect(s.add(100, false)).toBe(100 * 2 * 2 * 3);
    for (let i = 0; i < 10; i++) s.raiseMult();
    expect(s.mult).toBe(MAX_PLAYFIELD_MULT);
    s.newBall();
    expect(s.mult).toBe(1);
  });

  it('bonuses: panes lit this ball, unless tilted; windows grow through the run', () => {
    expect(endOfBallBonus(10, 2, false)).toBe(10 * POINTS.endBonusPerPane * 2);
    expect(endOfBallBonus(10, 2, true)).toBe(0);
    expect(windowBonus(4, 0)).toBeGreaterThan(windowBonus(0, 0));
    expect(windowBonus(0, 2)).toBeGreaterThan(windowBonus(0, 0));
  });
});
