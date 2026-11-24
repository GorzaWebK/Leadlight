// Settings, key bindings, best scores, stats and unlocks in localStorage. Every access
// is wrapped in try/catch with an in-memory fallback: iframes and private windows can
// refuse storage, and the game must still play.

export const STORAGE_KEY = 'leadlight:v1';

export const DEFAULT_SETTINGS = {
  music: 0.6,
  sfx: 0.8,
  muted: false,
  reducedMotion: null, // null = follow the system setting
  highContrast: false,
  colourBlind: false,
};

export function defaults() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    bindings: null, // null = default keys
    best: { run: [], single: {} }, // lists of { score, date, ... }, best first, 5 each
    stats: { panesLit: 0, windowsFinished: 0, runsFinished: 0, runsStarted: 0, furthest: 0, bestRun: 0 },
    unlocked: [], // relic ids announced as unlocked
    seenHelp: false,
  };
}

const TOP = 5;

/** Insert a score into a best-first list of at most 5. Returns its rank (0-based) or -1. */
export function insertScore(list, entry) {
  const out = [...list, entry].sort((a, b) => b.score - a.score).slice(0, TOP);
  const rank = out.indexOf(entry);
  list.length = 0;
  list.push(...out);
  return rank;
}

export class Store {
  /** @param {Storage|null} backend localStorage-like, or null for memory only */
  constructor(backend = safeLocalStorage()) {
    this.backend = backend;
    this.data = this.load();
  }

  load() {
    const d = defaults();
    try {
      const raw = this.backend && this.backend.getItem(STORAGE_KEY);
      if (!raw) return d;
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return d;
      return {
        ...d,
        ...p,
        settings: { ...d.settings, ...(p.settings || {}) },
        best: { run: Array.isArray(p.best?.run) ? p.best.run : [], single: { ...(p.best?.single || {}) } },
        stats: { ...d.stats, ...(p.stats || {}) },
        unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
      };
    } catch {
      return d;
    }
  }

  save() {
    try {
      if (this.backend) this.backend.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false; // full or refused: keep playing from memory
    }
  }

  get settings() {
    return this.data.settings;
  }
  setSetting(k, v) {
    this.data.settings[k] = v;
    this.save();
  }
  setBindings(b) {
    this.data.bindings = b;
    this.save();
  }

  bestRun() {
    return this.data.best.run[0]?.score ?? 0;
  }
  bestSingle(id) {
    return this.data.best.single[id]?.[0]?.score ?? 0;
  }

  recordRun(entry) {
    const rank = insertScore(this.data.best.run, entry);
    this.data.stats.bestRun = Math.max(this.data.stats.bestRun, entry.score);
    this.save();
    return rank;
  }

  recordSingle(id, entry) {
    if (!this.data.best.single[id]) this.data.best.single[id] = [];
    const rank = insertScore(this.data.best.single[id], entry);
    this.save();
    return rank;
  }

  addStats(delta) {
    const s = this.data.stats;
    for (const [k, v] of Object.entries(delta)) {
      if (k === 'furthest' || k === 'bestRun' || k.startsWith('completed:')) s[k] = Math.max(s[k] || 0, v);
      else s[k] = (s[k] || 0) + v;
    }
    this.save();
  }

  markUnlocked(ids) {
    for (const id of ids) if (!this.data.unlocked.includes(id)) this.data.unlocked.push(id);
    this.save();
  }

  resetProgress() {
    const keep = { settings: this.data.settings, bindings: this.data.bindings };
    this.data = { ...defaults(), ...keep };
    this.save();
  }
}

function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const k = '__leadlight_test__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}
