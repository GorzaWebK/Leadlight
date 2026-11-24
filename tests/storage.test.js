import { describe, it, expect } from 'vitest';
import { Store, STORAGE_KEY, insertScore } from '../src/storage.js';

class MemStorage {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}
const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('save data', () => {
  it('starts from defaults and round-trips through storage', () => {
    const mem = new MemStorage();
    const s = new Store(mem);
    expect(s.bestRun()).toBe(0);
    s.setSetting('music', 0.3);
    s.recordRun({ score: 5000, date: '2026-11-24' });
    s.addStats({ panesLit: 40, furthest: 2 });
    const t = new Store(mem);
    expect(t.settings.music).toBe(0.3);
    expect(t.bestRun()).toBe(5000);
    expect(t.data.stats.panesLit).toBe(40);
    expect(t.data.stats.furthest).toBe(2);
  });

  it('keeps playing from memory when storage throws', () => {
    const s = new Store(throwing);
    expect(s.settings.sfx).toBeGreaterThan(0);
    expect(() => s.recordRun({ score: 10 })).not.toThrow();
    expect(s.bestRun()).toBe(10);
    expect(s.save()).toBe(false);
  });

  it('works with no storage at all', () => {
    const s = new Store(null);
    s.recordSingle('dawn', { score: 99 });
    expect(s.bestSingle('dawn')).toBe(99);
  });

  it('survives corrupt or partial saved data, and fills in new defaults', () => {
    const mem = new MemStorage();
    mem.setItem(STORAGE_KEY, '{not json');
    expect(new Store(mem).bestRun()).toBe(0);
    mem.setItem(STORAGE_KEY, JSON.stringify({ settings: { music: 0.1 }, stats: { panesLit: 7 } }));
    const s = new Store(mem);
    expect(s.settings.music).toBe(0.1);
    expect(s.settings.sfx).toBe(0.8);
    expect(s.data.stats.windowsFinished).toBe(0);
    expect(s.data.best.run).toEqual([]);
  });

  it('keeps the five best scores, best first', () => {
    const list = [];
    for (const score of [5, 50, 1, 30, 20, 10, 40]) insertScore(list, { score });
    expect(list.map((e) => e.score)).toEqual([50, 40, 30, 20, 10]);
    expect(insertScore(list, { score: 2 })).toBe(-1);
    expect(insertScore(list, { score: 45 })).toBe(1);
  });

  it('records stats: counts add up, records keep the maximum', () => {
    const s = new Store(new MemStorage());
    s.addStats({ windowsFinished: 1, furthest: 3, 'completed:saints': 1 });
    s.addStats({ windowsFinished: 1, furthest: 1 });
    expect(s.data.stats.windowsFinished).toBe(2);
    expect(s.data.stats.furthest).toBe(3);
    expect(s.data.stats['completed:saints']).toBe(1);
  });

  it('resetting progress keeps settings and key bindings', () => {
    const s = new Store(new MemStorage());
    s.setSetting('highContrast', true);
    s.setBindings({ left: ['KeyA'] });
    s.recordRun({ score: 9 });
    s.resetProgress();
    expect(s.bestRun()).toBe(0);
    expect(s.settings.highContrast).toBe(true);
    expect(s.data.bindings.left[0]).toBe('KeyA');
  });
});
