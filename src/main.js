// Start-up, the main loop and the flow between menus, windows and runs.
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/spectral/latin-400-italic.css';
import './ui/style.css';
import { TABLES, TABLE_BY_ID } from './tables/index.js';
import { Game } from './game/game.js';
import { Run, newlyUnlocked } from './game/run.js';
import { Renderer } from './render/renderer.js';
import { Input } from './input/input.js';
import { UI } from './ui/ui.js';
import { Store } from './storage.js';
import { AudioEngine } from './audio/audio.js';
import { RELICS, RELIC_BY_ID, isUnlocked } from './relics/relics.js';
import { drawFavicon } from './render/favicon.js';
import { mulberry32 } from './rng.js';

const root = document.getElementById('game');
const canvas = document.getElementById('view');
const params = new URLSearchParams(location.search);
const UNLOCK_ALL = params.get('unlock') === 'all';

const store = new Store();
const prefersReduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const settings = () => ({ ...store.settings, reducedMotion: store.settings.reducedMotion ?? prefersReduced() });

const renderer = new Renderer(canvas, settings());
const input = new Input(canvas, store.data.bindings);
const audio = new AudioEngine();
const ui = new UI(root, { store, input, audio, onAction: (n, d) => action(n, d) });

let mode = 'menu'; // menu | play | paused | between | end
let game = null;
let run = null;
let singleId = null;
let pendingPanes = 0;
let resetArmed = false;
let shownTouchHint = false;
let timers = [];
let dprCap = 2; // lowered if the device can't keep up

const later = (secs, fn) => timers.push({ t: secs, fn });
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

function stats() {
  if (!UNLOCK_ALL) return store.data.stats;
  return { ...store.data.stats, panesLit: 1e9, windowsFinished: 1e9, runsFinished: 1e9, furthest: 9, bestRun: 1e12, 'completed:saints': 1 };
}
function unlockedWindows() {
  return UNLOCK_ALL ? TABLES.length : Math.min(TABLES.length, Math.max(1, (store.data.stats.furthest || 0) + 1));
}
function relicsFound() {
  return RELICS.filter((r) => isUnlocked(r, stats(), store.data.unlocked)).length;
}

/** Save stats, then announce any relics they unlocked. */
function addStats(delta) {
  const before = { ...store.data.stats };
  store.addStats(delta);
  const fresh = newlyUnlocked(before, store.data.stats, store.data.unlocked);
  if (fresh.length) {
    store.markUnlocked(fresh.map((r) => r.id));
    fresh.forEach((r, i) => setTimeout(() => ui.toast(`Relic found: <b>${r.name}</b>`, r.id), 600 + i * 900));
  }
}
function flushPanes() {
  if (pendingPanes) addStats({ panesLit: pendingPanes });
  pendingPanes = 0;
}

// ---------- Attract mode behind the menus ----------

const attract = { def: null, lit: null, t: 0, idx: Math.floor(Math.random() * TABLES.length), sun: 0, rest: 0 };

function startAttract() {
  game = null;
  attract.def = TABLES[attract.idx % TABLES.length];
  attract.lit = new Set();
  attract.rest = 0;
  renderer.setGame(null, attract.def);
  aimAttract(true);
}

/** Frame the attract window beside the menu (wide) or above it (tall). */
function aimAttract(snap) {
  const w = root.clientWidth;
  const h = root.clientHeight;
  const zoom = 0.86;
  const s = renderer.baseScale() * zoom || 1;
  const wide = w / h > 1.1;
  const [scx, scy] = renderer.screenCentre();
  const tx = wide ? w * 0.7 : w / 2;
  const ty = wide ? h / 2 : h * 0.3;
  renderer.camTarget = { x: 330 - (tx - scx) / s, y: 470 - (ty - scy) / s, zoom };
  if (snap) renderer.cam = { ...renderer.camTarget };
}

function updateAttract(dt) {
  const a = attract;
  const panes = a.def.panes;
  if (a.lit.size >= panes.length) {
    a.rest += dt;
    if (a.rest > 5) {
      a.idx++;
      renderer.dimSweep();
      later(1.6, () => {
        if (mode === 'menu' && !game) startAttract();
      });
      a.rest = -999;
    }
    return;
  }
  a.t += dt;
  a.sun += dt * 0.6;
  if (a.t < 0.14) return;
  a.t = 0;
  // A wandering point of light ignites the dark panes nearest to it.
  const x = 320 + Math.cos(a.sun) * 220;
  const y = 470 + Math.sin(a.sun * 1.3) * 330;
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < panes.length; i++) {
    if (a.lit.has(i)) continue;
    const d = (panes[i].cx - x) ** 2 + (panes[i].cy - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  if (best >= 0) {
    a.lit.add(best);
    renderer.fx.spark(best, x, y);
  }
}

// ---------- Flow ----------

function toTitle() {
  flushPanes();
  mode = 'menu';
  run = null;
  timers = [];
  input.playing = false;
  ui.showHud(false);
  ui.hideIntro(true);
  startAttract();
  ui.showTitle({ unlocked: relicsFound() });
  audio.music('menu');
}

function startRun() {
  run = new Run({ rand: mulberry32((Math.random() * 1e9) | 0) });
  singleId = null;
  addStats({ runsStarted: 1 });
  beginWindow(run.startWindow());
}

function startSingle(id) {
  run = null;
  singleId = id;
  beginWindow(new Game({ table: TABLE_BY_ID[id], mode: 'single', balls: 3 }));
}

function beginWindow(g) {
  game = g;
  timers = [];
  renderer.setGame(g);
  renderer.setSettings(settings());
  ui.close();
  ui.setWindow(g.def, run ? run.relics : null);
  ui.shownScore = g.score;
  ui.showHud(true);
  layout();
  ui.showIntro(g.def, run ? 'run' : 'single', input.lastDevice);
  if (run) addStats({ furthest: g.def.index });
  mode = 'play';
  input.playing = true;
  audio.music('table', g.def);
  if (input.lastDevice === 'touch' && !shownTouchHint) {
    shownTouchHint = true;
    ui.touchHint();
  }
}

function pause() {
  if (mode !== 'play') return;
  mode = 'paused';
  input.playing = false;
  ui.showPause(run ? 'run' : 'single');
  audio.music('pause');
}

function resume() {
  if (mode !== 'paused') return;
  ui.close();
  mode = 'play';
  input.playing = true;
  audio.music('resume');
}

function windowDone() {
  flushPanes();
  const t = run.completeWindow();
  t.score = run.score;
  addStats({ windowsFinished: 1, [`completed:${game.def.id}`]: 1, furthest: Math.min(TABLES.length - 1, game.def.index + 1) });
  mode = 'between';
  input.playing = false;
  ui.showTally(t);
}

function nextAfterTally() {
  if (run.finished) return endRun(true);
  const offer = run.offer(stats(), store.data.unlocked);
  ui.showChoose(offer, run.tables[run.index + 1]);
}

function pick(id) {
  if (id) {
    run.takeRelic(id);
    const r = RELIC_BY_ID[id];
    ui.toast(`<b>${r.name}</b> · ${r.kind}`, id);
  }
  beginWindow(run.nextWindow());
}

function endRun(won) {
  flushPanes();
  if (!won) run.lose();
  const entry = { score: run.score, label: `${won ? 'The whole rose' : `${run.windowsDone} of 5 windows`} · ${new Date().toLocaleDateString('en-GB')}` };
  const rank = store.recordRun(entry);
  if (won) addStats({ runsFinished: 1 });
  addStats({ bestRun: run.score });
  mode = 'end';
  input.playing = false;
  ui.showHud(false);
  if (won) {
    renderer.camTarget = { x: 320, y: 470, zoom: 0.74 };
  }
  ui.showEnd({
    title: won ? 'The Rose is lit' : 'The light fades',
    subtitle: won ? 'Every window glows. The pilgrimage is complete.' : `${run.windowsDone} of 5 windows lit, on the ${run.table.name} window`,
    score: run.score,
    scoreLabel: 'pilgrimage',
    rank,
    list: store.data.best.run,
    relics: run.relics,
    againLabel: 'Another pilgrimage',
  });
  audio.music(won ? 'victory' : 'over');
}

function endSingle() {
  flushPanes();
  const def = game.def;
  const entry = { score: game.score, label: `${game.gloria > 1 ? `Gloria ${game.gloria}` : `${game.light.count} panes`} · ${new Date().toLocaleDateString('en-GB')}` };
  const rank = store.recordSingle(def.id, entry);
  mode = 'end';
  input.playing = false;
  ui.showHud(false);
  ui.showEnd({
    title: 'The vigil ends',
    subtitle: `${def.numeral}. ${def.name}`,
    score: game.score,
    scoreLabel: def.name,
    rank,
    list: store.data.best.single[def.id] || [],
    relics: null,
    againLabel: 'Play this window again',
  });
  audio.music('over');
}

function onGameEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'plunge':
        ui.hideIntro();
        break;
      case 'light':
        pendingPanes += e.panes.length;
        break;
      case 'feature':
        if (e.text) ui.banner(e.text);
        break;
      case 'milestone':
        ui.banner(['', 'A quarter of the window glows', 'Half the window glows', 'Three quarters lit'][e.quarter]);
        break;
      case 'tilt':
        ui.banner('Tilt');
        break;
      case 'saved':
        ui.banner(e.why === 'angel' ? 'The angel gives the ball back' : 'Ball saved');
        break;
      case 'multiball':
        ui.banner('Another ball descends');
        break;
      case 'kickback':
        ui.banner("Pilgrim's return");
        break;
      case 'cellarEnter':
        ui.banner(game.def.id === 'rose' ? 'Down into the crypt' : 'Down into the cellar');
        break;
      case 'drain':
        if (e.balls > 0) ui.banner(e.tilted ? 'No bonus after a tilt' : `Ball bonus ${fmt(e.bonus)}`);
        break;
      case 'complete':
        if (e.renew) ui.banner(`Gloria ${e.gloria}: every pane counts more`);
        else {
          ui.banner(`The ${game.def.name} window is lit`);
          later(3.6, windowDone);
        }
        break;
      case 'over':
        later(1.8, () => (run ? endRun(false) : endSingle()));
        break;
      default:
    }
  }
}

function applySettings() {
  const s = settings();
  renderer.setSettings(s);
  audio.setVolumes(s.music, s.sfx);
  audio.setMuted(s.muted);
  ui.setMuted(s.muted);
  root.classList.toggle('reduced', !!s.reducedMotion);
}

function action(name, data) {
  switch (name) {
    case 'run':
      return startRun();
    case 'windows':
      return ui.showWindows(TABLES, unlockedWindows());
    case 'single':
      return startSingle(data);
    case 'relics':
      return ui.showRelics(stats(), store.data.unlocked);
    case 'settings':
      return ui.showSettings(mode === 'paused');
    case 'help':
      return ui.showHelp(mode === 'paused');
    case 'back':
      return mode === 'paused' ? ui.showPause(run ? 'run' : 'single') : ui.showTitle({ unlocked: relicsFound() });
    case 'pause':
      if (mode === 'paused') return ui.screenName === 'pause' ? resume() : ui.showPause(run ? 'run' : 'single');
      return pause();
    case 'resume':
      return resume();
    case 'restart':
      flushPanes();
      return run ? startRun() : startSingle(singleId);
    case 'quit':
    case 'menu':
      return toTitle();
    case 'again':
      return singleId ? startSingle(singleId) : startRun();
    case 'next':
      return nextAfterTally();
    case 'pick':
      return pick(data);
    case 'mute':
      store.setSetting('muted', !store.settings.muted);
      return applySettings();
    case 'setting':
      store.setSetting(data.key, data.value);
      return applySettings();
    case 'bindings':
      store.setBindings(data);
      return input.setBindings(data);
    case 'resetKeys':
      store.setBindings(null);
      input.setBindings(null);
      return ui.showSettings(mode === 'paused');
    case 'resetProgress':
      if (!resetArmed) {
        resetArmed = true;
        setTimeout(() => (resetArmed = false), 4000);
        return ui.toast('Press <b>Reset progress</b> again to forget all scores and relics');
      }
      resetArmed = false;
      store.resetProgress();
      return ui.toast('Progress reset');
    default:
  }
}

input.on('action', (a) => {
  if (a === 'pause') {
    if (mode === 'play' || mode === 'paused') action('pause');
  } else if (a === 'mute') action('mute');
});
input.on('menu', (dir) => {
  if (ui.screen) ui.nav(dir);
});
input.on('any', () => {
  audio.unlock();
  try {
    window.focus();
  } catch {
    /* cross-origin parent */
  }
});
input.zoneAt = (x, y) => renderer.zoneAt(x, y);
// Sound may only start inside a user gesture: unlock on the first tap, click or key anywhere.
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true, passive: true });

// ---------- Layout ----------

function layout() {
  const w = root.clientWidth || 1;
  const h = root.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2, dprCap);
  const TW = 656;
  const TH = 1090;
  const tableW = (h * TW) / TH;
  let area;
  let info;
  if ((w - tableW) / 2 >= Math.max(150, w * 0.16)) {
    area = { x: 0, y: 0, w, h };
    const s = Math.min(w / TW, h / TH);
    info = { mode: 'wide', w, h, tl: w / 2 - (TW * s) / 2, tr: w / 2 + (TW * s) / 2, tt: 0 };
  } else {
    const band = Math.round(Math.max(96, Math.min(190, h * 0.16)));
    area = { x: 0, y: band, w, h: h - band - 4 };
    info = { mode: 'tall', w, h, tt: band, tl: 0, tr: w };
  }
  if (!game) area = { x: 0, y: 0, w, h };
  renderer.resize(w, h, dpr, area);
  ui.layout(info);
  if (!game && attract.def) aimAttract(true);
}
new ResizeObserver(layout).observe(root);
layout();

// ---------- Main loop ----------

let last = performance.now();
let slowFrames = 0;
function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) {
      const f = timers[i].fn;
      timers.splice(i, 1);
      f();
    }
  }
  const inp = input.state();
  if (game && mode === 'play') {
    game.update(dt, inp);
    const ev = game.drainOut();
    renderer.handle(ev);
    audio.handle(ev, game);
    onGameEvents(ev);
  } else if (game && (mode === 'between' || mode === 'end')) {
    // Keep the flood and the rising balls moving behind the tally.
    game.update(dt, { left: false, right: false, plunger: false });
    renderer.handle(game.drainOut());
  } else if (!game) updateAttract(dt);
  if (game) ui.updateHud(game, dt);
  audio.update(dt, game);
  if (mode !== 'paused' || !game) renderer.frame(dt);
  else renderer.frame(0);
  // Drop the layer resolution a notch if frames are consistently slow.
  slowFrames = dt > 0.024 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
  // Weak devices: first draw fewer pixels on screen, then a coarser window layer.
  if (slowFrames > 90 && mode === 'play') {
    slowFrames = 0;
    if (dprCap > 1.01 && (window.devicePixelRatio || 1) > 1) {
      dprCap = Math.max(1, Math.min(window.devicePixelRatio || 1, 2) - 0.5);
      layout();
    } else if (renderer.quality > 0.6) {
      renderer.quality -= 0.15;
      renderer.rebuildGlass();
    }
  }
  requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else audio.resume();
});
window.addEventListener('blur', () => pause());

applySettings();
drawFavicon();
const fontsReady = document.fonts?.ready ?? Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  toTitle();
  requestAnimationFrame(loop);
});

window.leadlight = {
  get game() {
    return game;
  },
  get run() {
    return run;
  },
  renderer,
  store,
  audio,
  action,
  startSingle,
  startRun,
};
