// Relics: the upgrades you choose between windows. Each relic is data plus a set of
// modifiers; computeMods() folds the relics you hold into one object the game reads.

export const DEFAULT_MODS = {
  flipperLength: 1,
  saveFirstDrain: false, // the first ball lost on each window comes back
  comboMultiball: 0, // a combo this long releases an extra ball (0 = off)
  twinPanes: false,
  slowNudge: 0, // seconds of slow motion after a nudge
  moltenTrail: false, // a fast ball lights the panes it crosses
  centrePost: 0, // seconds the centre post stays up at the start of each ball
  kickback: false,
  prism: false, // bumpers also light a far pane
  scoreMult: 1,
  ballSave: 1, // multiplier on the ball-save time (0 = none)
  gravity: 1,
  bumperPanes: 0, // extra panes per bumper hit
  bumperScore: 1,
  gildedPerWindow: 0, // extra score multiplier per finished window
  comboTime: 1,
  comboCap: 20,
  nudgeStrength: 1,
  tiltTolerance: 1,
};

/**
 * unlock: null = available from the start; otherwise { stat, value, text }, checked
 * against the saved stats (see storage.js).
 */
export const RELICS = [
  {
    id: 'broad',
    name: 'Broad Came',
    kind: 'Flippers',
    text: 'Your flippers are a fifth longer.',
    mods: { flipperLength: 1.2 },
    unlock: null,
  },
  {
    id: 'angel',
    name: 'Guardian Angel',
    kind: 'Ball saver',
    text: 'The first ball you lose on each window is given back.',
    mods: { saveFirstDrain: true },
    unlock: null,
  },
  {
    id: 'choir',
    name: 'Choir of Echoes',
    kind: 'Multiball',
    text: 'A combo of 8 hits releases another ball onto the table.',
    mods: { comboMultiball: 8 },
    unlock: { stat: 'completed:saints', value: 1, text: 'Finish the Saints window.' },
  },
  {
    id: 'twin',
    name: 'Twin Panes',
    kind: 'Glass',
    text: 'Every pane you light brings a neighbour with it.',
    mods: { twinPanes: true },
    unlock: null,
  },
  {
    id: 'hourglass',
    name: 'Vespers Hourglass',
    kind: 'Nudge',
    text: 'Nudging slows time for a moment, so you can line up the save.',
    mods: { slowNudge: 1.6 },
    unlock: { stat: 'runsFinished', value: 1, text: 'Finish a whole run.' },
  },
  {
    id: 'molten',
    name: 'Molten Trail',
    kind: 'Glass',
    text: 'A fast ball lights the dark panes it rolls across.',
    mods: { moltenTrail: true },
    unlock: { stat: 'furthest', value: 3, text: 'Reach the Tempest window in a run.' },
  },
  {
    id: 'post',
    name: 'Sanctuary Post',
    kind: 'Ball saver',
    text: 'A stone post rises between the flippers for the first 25 seconds of every ball.',
    mods: { centrePost: 25 },
    unlock: null,
  },
  {
    id: 'kickback',
    name: "Pilgrim's Return",
    kind: 'Outlanes',
    text: 'Both outlanes kick the ball back once. Clearing a target bank recharges them.',
    mods: { kickback: true },
    unlock: null,
  },
  {
    id: 'prism',
    name: 'Prism',
    kind: 'Bumpers',
    text: 'Every bumper hit also sends a bolt of light to a far, dark pane.',
    mods: { prism: true },
    unlock: { stat: 'panesLit', value: 1500, text: 'Light 1,500 panes in all.' },
  },
  {
    id: 'candle',
    name: 'Vigil Candle',
    kind: 'Extra ball',
    text: 'Light one more candle: an extra ball, now.',
    mods: {},
    extraBall: 1,
    unlock: null,
  },
  {
    id: 'crown',
    name: "Martyr's Crown",
    kind: 'Gamble',
    text: 'Every point counts double, but no ball is ever saved at the start.',
    mods: { scoreMult: 2, ballSave: 0 },
    unlock: { stat: 'bestRun', value: 750000, text: 'Score 750,000 in one run.' },
  },
  {
    id: 'feather',
    name: 'Feather of Gabriel',
    kind: 'Ball',
    text: 'The ball floats: the table pulls it down 15% more gently.',
    mods: { gravity: 0.85 },
    unlock: null,
  },
  {
    id: 'lantern',
    name: 'Lantern Bumpers',
    kind: 'Bumpers',
    text: 'Bumpers light an extra pane and score half as much again.',
    mods: { bumperPanes: 1, bumperScore: 1.5 },
    unlock: null,
  },
  {
    id: 'gilded',
    name: 'Gilded Lead',
    kind: 'Score',
    text: 'Each window you finish adds ×0.5 to all scoring for the rest of the run.',
    mods: { gildedPerWindow: 0.5 },
    unlock: { stat: 'windowsFinished', value: 8, text: 'Finish 8 windows in all.' },
  },
  {
    id: 'censer',
    name: 'Censer',
    kind: 'Combos',
    text: 'Combos last 60% longer and climb to ×4.',
    mods: { comboTime: 1.6, comboCap: 30 },
    unlock: null,
  },
  {
    id: 'medal',
    name: "St Christopher's Medal",
    kind: 'Nudge',
    text: 'Nudges are far stronger, and the table forgives twice as many.',
    mods: { nudgeStrength: 1.6, tiltTolerance: 2 },
    unlock: null,
  },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

/** Fold held relics into one modifier object. Multiplicative where that makes sense. */
export function computeMods(ids) {
  const m = { ...DEFAULT_MODS };
  for (const id of ids) {
    const r = RELIC_BY_ID[id];
    if (!r) continue;
    for (const [k, v] of Object.entries(r.mods)) {
      const d = DEFAULT_MODS[k];
      if (typeof d === 'boolean') m[k] = m[k] || v;
      else if (k === 'scoreMult' || k === 'ballSave' || k === 'gravity' || k === 'flipperLength' || k === 'comboTime' || k === 'nudgeStrength' || k === 'tiltTolerance' || k === 'bumperScore') m[k] = m[k] * v;
      else if (k === 'comboCap' || k === 'centrePost' || k === 'slowNudge' || k === 'comboMultiball') m[k] = Math.max(m[k], v);
      else m[k] = m[k] + v;
    }
  }
  return m;
}

/** Is a relic unlocked, given saved stats? */
export function isUnlocked(relic, stats, unlockedIds = []) {
  if (!relic.unlock) return true;
  if (unlockedIds.includes(relic.id)) return true;
  const v = stats?.[relic.unlock.stat] ?? 0;
  return v >= relic.unlock.value;
}

/**
 * Three different relics to choose from: unlocked, not already held. Uses rand()
 * so a seeded generator gives a repeatable offer.
 */
export function offerRelics(held, stats, unlockedIds, rand = Math.random, n = 3) {
  const pool = RELICS.filter((r) => !held.includes(r.id) && isUnlocked(r, stats, unlockedIds));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
