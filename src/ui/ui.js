// Menus, HUD, banners and toasts. Plain DOM: each screen is built when shown.
import { relicIcon, candleSVG, ribbonSVG, roseSVG, archFrameSVG, archGeometry, stoneDataURL } from './art.js';
import { RELICS, RELIC_BY_ID, isUnlocked } from '../relics/relics.js';
import { ACTIONS, keyName, cloneBindings, DEFAULT_BINDINGS, SLOTS } from '../input/input.js';
import { windowThumb } from '../render/thumb.js';

const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="wave" d="M16 9q2 3 0 6M18.5 7q4 5 0 10"/><path class="slash" d="M16 9l6 6M22 9l-6 6"/></svg>';
const ICON_WIND = '<svg viewBox="0 0 40 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6h22a4 4 0 1 0-4-4M2 12h30a4 4 0 1 1-4 4M6 18h10"/></svg>';

export class UI {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx; // { store, onAction(name, data), audio }
    this.screen = null;
    this.screenName = null;
    this.layoutInfo = null;
    this.shownScore = 0;
    this.thumbs = new Map();
    root.style.setProperty('--stone-tex', `url(${stoneDataURL()})`);
    this.buildHud();
    this.toasts = el('div', { id: 'toasts', 'aria-live': 'polite' });
    root.append(this.toasts);
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  act(name, data) {
    this.ctx.audio?.ui?.(name);
    this.ctx.onAction(name, data);
  }

  // ---------- Screens ----------

  open(name, html, opts = {}) {
    this.close();
    const scr = el('div', { class: 'screen' + (opts.clear ? ' clear' : '') + (opts.screenCls ? ' ' + opts.screenCls : ''), role: 'dialog', 'aria-label': opts.label || name });
    const panel = el('div', { class: 'panel' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '') });
    const arch = el('div', { class: 'arch' });
    const body = el('div', { class: 'panel-body' });
    body.innerHTML = html;
    panel.append(arch, body);
    scr.append(panel);
    this.root.append(scr);
    this.screen = scr;
    this.screenName = name;
    // Draw the arch for the panel's real shape, so the tracery never stretches.
    requestAnimationFrame(() => {
      const r = panel.getBoundingClientRect();
      if (!r.width) return;
      const w = 600;
      const h = Math.round((600 * r.height) / r.width);
      arch.innerHTML = archFrameSVG(w, h);
      // Content starts where the arch head is wide enough.
      panel.style.setProperty('--head', `${(archGeometry(w, h).head * r.height).toFixed(1)}px`);
    });
    body.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.classList.contains('locked')) return;
        this.act(b.dataset.act, b.dataset.arg);
      }),
    );
    if (opts.focus !== false) setTimeout(() => this.focusFirst(), 30);
    return body;
  }

  close() {
    if (this.screen) this.screen.remove();
    this.screen = null;
    this.screenName = null;
  }

  focusables() {
    if (!this.screen) return [];
    return [...this.screen.querySelectorAll('button:not([disabled]):not(.locked), input, [tabindex="0"]')].filter((e) => e.offsetParent !== null);
  }
  focusFirst() {
    const f = this.focusables();
    const pref = this.screen?.querySelector('[data-autofocus]');
    (pref || f[0])?.focus({ preventScroll: false });
  }

  /** Spatial navigation for arrow keys and the gamepad. */
  nav(dir) {
    if (!this.screen) return false;
    const list = this.focusables();
    if (!list.length) return false;
    const cur = document.activeElement;
    if (!list.includes(cur)) {
      list[0].focus();
      return true;
    }
    if (dir === 'ok') {
      cur.click();
      return true;
    }
    if (dir === 'back') {
      this.back();
      return true;
    }
    if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
      cur.value = String(Math.max(0, Math.min(1, +cur.value + (dir === 'left' ? -0.1 : 0.1))));
      cur.dispatchEvent(new Event('input'));
      return true;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bd = Infinity;
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax;
      const dy = b.top + b.height / 2 - ay;
      const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
      if (!ok) continue;
      const along = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
      const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      const d = along + across * 2.5;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView?.({ block: 'nearest' });
    }
    return true;
  }

  back() {
    const n = this.screenName;
    if (n === 'pause') this.act('resume');
    else if (n === 'settings' || n === 'help' || n === 'relics' || n === 'windows' || n === 'scores') this.act('back');
  }

  onKey(e) {
    if (!this.screen || this.capturing) return;
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.code]) {
      if (document.activeElement?.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;
      e.preventDefault();
      this.nav(map[e.code]);
    } else if (e.code === 'Escape' && this.screenName !== 'pause') {
      e.preventDefault();
      this.back();
    } else if (this.screenName === 'choose' && /^Digit[123]$/.test(e.code)) {
      const b = this.screen.querySelectorAll('.card')[+e.code.slice(5) - 1];
      b?.click();
    }
  }

  showTitle(info) {
    const best = this.ctx.store.bestRun();
    this.open(
      'title',
      `<h1 class="title">Leadlight</h1>
       <p class="subtitle">pinball in a rose window at dusk</p>
       <div class="fleuron">❦</div>
       <div class="menu">
         <button class="btn primary" data-act="run" data-autofocus>Begin a pilgrimage<small>Five windows · three balls · relics between</small></button>
         <button class="btn" data-act="windows">A single window<small>One window, played for the highest score</small></button>
         <div class="row">
           <button class="btn small" data-act="relics">Relics</button>
           <button class="btn small" data-act="settings">Settings</button>
           <button class="btn small" data-act="help">How to play</button>
         </div>
       </div>
       <p class="foot">${best ? `Best pilgrimage <span class="numerals">${fmt(best)}</span> · ` : ''}${info?.unlocked ?? 0} of ${RELICS.length} relics found</p>`,
      { label: 'Leadlight', cls: 'title-panel', screenCls: 'title-screen' },
    );
  }

  showWindows(tables, unlockedCount) {
    const cards = tables
      .map((t, i) => {
        const locked = i >= unlockedCount;
        const best = this.ctx.store.bestSingle(t.id);
        return `<button class="card${locked ? ' locked' : ''}" data-act="single" data-arg="${t.id}" ${locked ? 'aria-disabled="true"' : ''}>
          <canvas class="thumb" data-thumb="${t.id}" width="150" height="208"></canvas>
          <span class="name"><span class="muted">${t.numeral}.</span> ${esc(t.name)}</span>
          <span class="kind">${esc(t.epithet)}</span>
          <span class="best">${locked ? 'Reach it in a pilgrimage' : best ? 'Best ' + fmt(best) : 'Not yet played'}</span>
        </button>`;
      })
      .join('');
    const body = this.open(
      'windows',
      `<h2>A single window</h2><p class="subtitle">Three balls. Light the whole window and it dims again, worth more each time.</p>
       <div class="cards">${cards}</div>
       <div class="menu"><button class="btn small" data-act="back">Back</button></div>`,
      { wide: true },
    );
    body.querySelectorAll('canvas[data-thumb]').forEach((c) => {
      const t = tables.find((x) => x.id === c.dataset.thumb);
      const locked = tables.indexOf(t) >= unlockedCount;
      requestAnimationFrame(() => {
        const key = t.id + (locked ? ':dark' : '');
        if (!this.thumbs.has(key)) this.thumbs.set(key, windowThumb(t, 300, !locked));
        const src = this.thumbs.get(key);
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
      });
    });
  }

  showRelics(stats, unlockedIds) {
    const cards = RELICS.map((r) => {
      const open = isUnlocked(r, stats, unlockedIds);
      return `<div class="card${open ? '' : ' locked'}" tabindex="0">
        ${relicIcon(r.id, 44)}
        <span class="name">${esc(r.name)}</span>
        <span class="kind">${esc(r.kind)}</span>
        <span class="text">${open ? esc(r.text) : 'Locked: ' + esc(r.unlock.text)}</span>
      </div>`;
    }).join('');
    this.open('relics', `<h2>Relics</h2><p class="subtitle">Between windows you choose one of three.</p><div class="cards">${cards}</div><div class="menu"><button class="btn small" data-act="back">Back</button></div>`, { wide: true });
  }

  showHelp(fromPause) {
    this.open(
      'help',
      `<h2>How to play</h2>
       <p>The table is a stained-glass window. Its panes start dark. Every bumper, target, lane, spinner and bell you hit sends light running along the lead to the nearest dark panes. <b>Light every pane</b> to finish the window.</p>
       <p>A <b>pilgrimage</b> is five windows and three balls. Finishing a window gives one ball back (up to three), and then you choose one of three <b>relics</b>. Score is what counts.</p>
       <h3>On every window</h3>
       <p>Light all the candles at the top to raise the multiplier (up to ×5). Hit things in quick succession for a combo. Plunge into the candle that burns blue for a skill shot: the gilt marks on the plunger lane show the pull, and the flippers move the lit candle. A ball lost in the first seconds is saved.</p>
       <p>Nudge to save a ball, but gently: two quick nudges bring a warning, three tilt the table and the ball is lost.</p>
       <h3>Controls</h3>
       <table class="controls-table">
         <tr><th></th><th>Keyboard</th><th>Touch</th><th>Gamepad</th></tr>
         <tr><td>Flippers</td><td>← / Z and → / /</td><td>Hold the left or right half</td><td>LB / LT, RB / RT</td></tr>
         <tr><td>Plunger</td><td>Hold Space or ↓</td><td>Hold the lane at bottom right</td><td>Hold A</td></tr>
         <tr><td>Nudge</td><td>Shift or ↑</td><td>Swipe up</td><td>B or flick the stick</td></tr>
         <tr><td>Pause</td><td>Esc or P</td><td>Pause button</td><td>Start</td></tr>
         <tr><td>Mute</td><td>M</td><td>Sound button</td><td>Back</td></tr>
       </table>
       <p class="muted">Every key can be changed in Settings.</p>
       <div class="menu"><button class="btn small" data-act="${fromPause ? 'pause' : 'back'}" data-autofocus>Back</button></div>`,
      { wide: true },
    );
  }

  showSettings(fromPause) {
    const s = this.ctx.store.settings;
    const rm = s.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const toggle = (k, label, note, val) =>
      `<div class="setting"><label id="l-${k}">${label}<small>${note}</small></label><button class="toggle" role="switch" aria-labelledby="l-${k}" aria-checked="${!!val}" data-set="${k}"></button></div>`;
    const slider = (k, label) =>
      `<div class="setting"><label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="0" max="1" step="0.05" value="${s[k]}" data-range="${k}"></div>`;
    const body = this.open(
      'settings',
      `<h2>Settings</h2>
       ${slider('music', 'Music')}
       ${slider('sfx', 'Effects')}
       ${toggle('muted', 'Mute', 'All sound off (M)', s.muted)}
       ${toggle('reducedMotion', 'Reduced motion', 'No screen shake or flashes', rm)}
       ${toggle('highContrast', 'High-contrast lead', 'Thicker, outlined lead lines and rails', s.highContrast)}
       ${toggle('colourBlind', 'Colour-blind markings', 'Each glass colour gets its own pattern when lit', s.colourBlind)}
       <h3>Keys</h3>
       <table class="keys" id="keys"></table>
       <div class="row" style="margin-top:.6em">
         <button class="btn small" data-act="resetKeys">Default keys</button>
         <button class="btn small" data-act="resetProgress">Reset progress</button>
       </div>
       <div class="menu"><button class="btn small" data-act="${fromPause ? 'pause' : 'back'}">Back</button></div>`,
      { wide: true },
    );
    body.querySelector('#s-music')?.setAttribute('data-autofocus', '');
    body.querySelectorAll('[data-set]').forEach((t) =>
      t.addEventListener('click', () => {
        const v = t.getAttribute('aria-checked') !== 'true';
        t.setAttribute('aria-checked', String(v));
        this.ctx.onAction('setting', { key: t.dataset.set, value: v });
      }),
    );
    body.querySelectorAll('[data-range]').forEach((r) =>
      r.addEventListener('input', () => this.ctx.onAction('setting', { key: r.dataset.range, value: +r.value })),
    );
    this.fillKeys(body.querySelector('#keys'));
  }

  fillKeys(table) {
    const b = cloneBindings(this.ctx.store.data.bindings);
    table.innerHTML = ACTIONS.map(
      (a) =>
        `<tr><td>${esc(a.label)}</td>${Array.from({ length: SLOTS }, (_, i) => `<td><button class="key" data-action="${a.id}" data-slot="${i}">${esc(keyName(b[a.id][i]))}</button></td>`).join('')}</tr>`,
    ).join('');
    table.querySelectorAll('.key').forEach((k) =>
      k.addEventListener('click', () => {
        k.classList.add('waiting');
        k.textContent = 'press a key';
        this.capturing = true;
        this.ctx.input.capturing = (code) => {
          this.capturing = false;
          k.classList.remove('waiting');
          const nb = cloneBindings(this.ctx.store.data.bindings);
          if (code === 'Backspace' || code === 'Delete') nb[k.dataset.action][+k.dataset.slot] = null;
          else if (code !== 'Escape' || k.dataset.action === 'pause') {
            // A key belongs to one action only.
            for (const id of Object.keys(nb)) nb[id] = nb[id].map((c) => (c === code ? null : c));
            nb[k.dataset.action][+k.dataset.slot] = code;
          }
          this.ctx.onAction('bindings', nb);
          this.fillKeys(table);
          table.querySelector(`[data-action="${k.dataset.action}"][data-slot="${k.dataset.slot}"]`)?.focus();
        };
      }),
    );
  }

  showPause(mode) {
    this.open(
      'pause',
      `<h2>Paused</h2><div class="fleuron">❦</div>
       <div class="menu">
         <button class="btn primary" data-act="resume" data-autofocus>Resume</button>
         <button class="btn" data-act="restart">${mode === 'run' ? 'Restart the pilgrimage' : 'Restart this window'}</button>
         <div class="row"><button class="btn small" data-act="settings">Settings</button><button class="btn small" data-act="help">How to play</button></div>
         <button class="btn small" data-act="quit">Leave for the menu</button>
       </div>`,
    );
  }

  showTally(t) {
    const last = t.finalBonus !== undefined;
    this.open(
      'tally',
      `<div class="ribbon" style="margin:0 auto">${ribbonSVG(t.window.palette[0] && '#6a1430')}<span><span class="num">${t.window.numeral}</span>${esc(t.window.name)}</span></div>
       <h2 style="margin-top:.3em">The window is lit</h2>
       <table class="tally">
         <tr><td>Points on this window</td><td>${fmt(t.windowScore)}</td></tr>
         <tr><td>Window bonus</td><td>${fmt(t.bonus)}</td></tr>
         ${t.restored ? `<tr><td>A candle is relit: one ball back</td><td>${candleSVG(true).replace('class="candle lit"', 'class="candle lit" style="width:1em;height:2em;vertical-align:middle"')}</td></tr>` : ''}
         ${last ? `<tr><td>Balls in hand × ${fmt(25000)}</td><td>${fmt(t.finalBonus)}</td></tr>` : ''}
         <tr class="total"><td>Score</td><td>${fmt(t.score)}</td></tr>
       </table>
       <div class="menu"><button class="btn primary" data-act="next" data-autofocus>${last ? 'See the whole rose' : 'Choose a relic'}</button></div>`,
      { clear: true },
    );
  }

  showChoose(offer, nextTable) {
    if (!offer.length) {
      this.act('pick', null);
      return;
    }
    const cards = offer
      .map(
        (r, i) => `<button class="card" data-act="pick" data-arg="${r.id}" ${i === 0 ? 'data-autofocus' : ''}>
          ${relicIcon(r.id, 52)}
          <div><span class="name">${esc(r.name)}</span><br><span class="kind">${esc(r.kind)} · ${i + 1}</span>
          <p class="text">${esc(r.text)}</p></div>
        </button>`,
      )
      .join('');
    this.open('choose', `<h2>Choose a relic</h2><p class="subtitle">to carry into the ${esc(nextTable.name)} window</p><div class="cards">${cards}</div>`, { wide: true, cls: 'choose' });
  }

  showEnd(r) {
    const scores = r.list
      .map((e, i) => `<li class="${i === r.rank ? 'me' : ''}"><span>${esc(e.label || '')}</span><b>${fmt(e.score)}</b></li>`)
      .join('');
    const relics = (r.relics || []).map((id) => `<span title="${esc(RELIC_BY_ID[id]?.name || '')}">${relicIcon(id, 22)}</span>`).join('');
    this.open(
      'end',
      `<h2>${esc(r.title)}</h2>
       <p class="subtitle">${esc(r.subtitle)}</p>
       <div class="plaque" style="margin:0 auto .4em"><span class="numerals big-score">${fmt(r.score)}</span><span class="label">${esc(r.scoreLabel)}</span></div>
       ${r.rank === 0 ? '<p class="newbest">A new best</p>' : ''}
       ${relics ? `<div class="relic-row" style="margin:0 auto">${relics}</div>` : ''}
       <h3>Best</h3><ol class="scores">${scores}</ol>
       <div class="menu">
         <button class="btn primary" data-act="again" data-autofocus>${r.againLabel}</button>
         <button class="btn small" data-act="menu">Menu</button>
       </div>`,
    );
  }

  // ---------- Intro card, banner, toasts ----------

  showIntro(def, mode, device) {
    this.hideIntro(true);
    const hint = device === 'touch' ? 'Hold the lane at the bottom right, then let go' : device === 'gamepad' ? 'Hold A, then let go' : 'Hold Space, then let go';
    const d = el('div', { class: 'intro' });
    d.innerHTML = `<div class="ribbon">${ribbonSVG(introColour(def))}<span><span class="num">${def.numeral}</span>${esc(def.name)}</span></div>
      <div class="epithet">${esc(def.epithet)}</div>
      <div class="blurb">${esc(def.blurb)}</div>
      <div class="hint">${mode === 'single' ? 'A single window · ' : ''}${hint}</div>`;
    this.root.append(d);
    this.introEl = d;
  }
  hideIntro(now) {
    const d = this.introEl;
    if (!d) return;
    this.introEl = null;
    if (now) d.remove();
    else {
      d.classList.add('out');
      setTimeout(() => d.remove(), 650);
    }
  }

  banner(text) {
    const b = this.hud.banner;
    b.querySelector('span').textContent = text;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 1700);
  }

  toast(html, icon) {
    const t = el('div', { class: 'toast plaque' });
    t.innerHTML = `${icon ? relicIcon(icon, 28) : ''}<span>${html}</span>`;
    this.toasts.append(t);
    setTimeout(() => t.remove(), 3700);
  }

  touchHint() {
    if (this.root.querySelector('#touch-hint')) return;
    const h = el('div', { id: 'touch-hint' });
    h.innerHTML = '<div>Hold for the left flipper</div><div>Hold for the right flipper</div><span class="swipe">↑<br>Swipe up to nudge</span>';
    this.root.append(h);
    setTimeout(() => h.remove(), 5200);
  }

  // ---------- HUD ----------

  buildHud() {
    const hud = el('div', { id: 'hud', hidden: '' });
    hud.innerHTML = `
      <div class="hud-col hud-a">
        <div class="ribbon win">${ribbonSVG('#6a1430')}<span><span class="num"></span><span class="nm"></span></span></div>
        <div class="plaque score-plaque"><span class="numerals score">0</span><span class="label">score</span></div>
        <div class="mult"><span class="m">×1</span><span class="combo"></span></div>
      </div>
      <div class="hud-col hud-b"><div class="balls"></div><div class="status" aria-live="polite"></div></div>
      <div class="hud-col hud-c"><div class="rose"></div><div class="progress-text"></div><div class="wind" hidden>${ICON_WIND}<span>calm</span></div></div>
      <div class="hud-col hud-d"><div class="relic-row"></div></div>
      <div class="hud-btns">
        <button class="medallion" data-hud="pause" aria-label="Pause (Esc)" title="Pause (Esc)">${ICON_PAUSE}</button>
        <button class="medallion" data-hud="mute" aria-label="Mute (M)" title="Mute (M)">${ICON_SOUND}</button>
      </div>
      <div class="banner"><div class="ribbon">${ribbonSVG('#7a1630')}<span></span></div></div>`;
    this.root.append(hud);
    const q = (s) => hud.querySelector(s);
    this.hud = {
      root: hud,
      num: q('.win .num'),
      name: q('.win .nm'),
      winRibbon: q('.win'),
      score: q('.score'),
      mult: q('.mult .m'),
      combo: q('.mult .combo'),
      balls: q('.balls'),
      status: q('.status'),
      rose: q('.rose'),
      prog: q('.progress-text'),
      wind: q('.wind'),
      windLabel: q('.wind span'),
      relics: q('.relic-row'),
      banner: q('.banner'),
      mute: q('[data-hud="mute"]'),
    };
    hud.querySelectorAll('[data-hud]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.act(b.dataset.hud);
      }),
    );
    this.hudCache = {};
  }

  showHud(on) {
    this.hud.root.hidden = !on;
  }

  /** Place the HUD around the table. */
  layout(info) {
    this.layoutInfo = info;
    const h = this.hud.root;
    h.classList.toggle('tall', info.mode === 'tall');
    h.classList.toggle('wide', info.mode === 'wide');
    const set = (q, css) => Object.assign(h.querySelector(q).style, css);
    const reset = { left: '', right: '', top: '', bottom: '', transform: '', width: '' };
    for (const q of ['.hud-a', '.hud-b', '.hud-c', '.hud-d', '.hud-btns']) set(q, reset);
    const fs = parseFloat(getComputedStyle(this.root).fontSize) || 16;
    if (info.mode === 'tall') {
      const band = info.tt;
      const scale = Math.min(1, band / (fs * 9.6));
      h.style.setProperty('--hs', scale);
      set('.hud-a', { left: '50%', top: `${band * 0.04}px`, transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-b', { left: '0.6em', top: `${band * 0.36}px`, transform: `scale(${scale})`, transformOrigin: 'top left', alignItems: 'flex-start' });
      set('.hud-c', { right: '0.6em', top: `${band * 0.3}px`, transform: `scale(${scale})`, transformOrigin: 'top right' });
      set('.hud-d', { left: '50%', top: `${band - fs * 1.9 * scale}px`, transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-btns', { right: '0.5em', top: '0.4em', transform: `scale(${scale * 0.9})`, transformOrigin: 'top right' });
      h.querySelector('.banner').style.top = `${band + 0.18 * (info.h - band)}px`;
    } else {
      const lw = info.tl;
      const rw = info.w - info.tr;
      const scale = Math.min(1.25, Math.max(0.7, Math.min(lw, rw) / (fs * 13)));
      set('.hud-a', { left: `${lw / 2}px`, top: '9%', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-b', { left: `${lw / 2}px`, top: '42%', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-c', { left: `${info.tr + rw / 2}px`, top: '9%', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-d', { left: `${info.tr + rw / 2}px`, top: '45%', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' });
      set('.hud-btns', { left: `${info.tr + rw / 2}px`, bottom: '6%', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center' });
      h.querySelector('.banner').style.top = '22%';
    }
  }

  setWindow(def, relics) {
    this.hud.num.textContent = def.numeral;
    this.hud.name.textContent = def.name;
    this.hud.winRibbon.querySelector('svg').outerHTML = ribbonSVG(introColour(def));
    this.hud.relics.innerHTML = (relics || []).map((id) => `<span title="${esc(RELIC_BY_ID[id].name)}">${relicIcon(id, 22)}</span>`).join('');
    this.hud.wind.hidden = !def.wind;
    this.palette = def.palette;
    this.hudCache = {};
  }

  updateHud(game, dt) {
    const c = this.hudCache;
    const H = this.hud;
    const target = game.score;
    this.shownScore += (target - this.shownScore) * Math.min(1, dt * 7);
    if (Math.abs(target - this.shownScore) < 5) this.shownScore = target;
    const s = fmt(this.shownScore);
    if (c.score !== s) H.score.textContent = c.score = s;
    const m = `×${game.scorer.mult}${game.gloria > 1 ? ` · Gloria ${ROMAN[game.gloria - 1] || game.gloria}` : ''}`;
    if (c.mult !== m) H.mult.textContent = c.mult = m;
    const combo = game.scorer.combo >= 3 ? `combo ×${game.scorer.comboMult.toFixed(1)}` : '';
    if (c.combo !== combo) {
      c.combo = combo;
      H.combo.textContent = combo || H.combo.textContent;
      H.combo.classList.toggle('on', !!combo);
    }
    const balls = Math.max(0, game.balls);
    const ballKey = balls + ':' + Math.max(3, balls);
    if (c.balls !== ballKey) {
      c.balls = ballKey;
      let html = '';
      for (let i = 0; i < Math.max(3, balls); i++) html += candleSVG(i < balls);
      H.balls.innerHTML = html;
      H.balls.setAttribute('aria-label', `${balls} balls left`);
    }
    const frac = game.light.fraction;
    const fk = Math.round(frac * 120);
    if (c.frac !== fk) {
      c.frac = fk;
      H.rose.innerHTML = roseSVG(frac, this.palette || ['#c33']);
      H.prog.textContent = `${game.light.count} of ${game.light.total} panes`;
    }
    let status = '';
    let warn = false;
    if (game.tilted) {
      status = 'Tilt';
      warn = true;
    } else if (game.tilt >= 1.4) {
      status = 'Careful…';
      warn = true;
    } else if (game.ballSave > 0 && game.phase === 'play') status = 'Ball saved if lost';
    else if (game.T.scoop?.open) status = game.def.cellarOpenText || 'The cellar is open';
    const sk = status + warn;
    if (c.status !== sk) {
      c.status = sk;
      H.status.textContent = status;
      H.status.classList.toggle('warn', warn);
    }
    if (game.wind) {
      const w = game.wind;
      const wk = w.state + w.dir;
      if (c.wind !== wk) {
        c.wind = wk;
        H.wind.classList.toggle('on', w.state !== 'calm');
        H.windLabel.textContent = w.state === 'gust' ? 'gust' : w.state === 'warn' ? 'rising' : 'calm';
        H.wind.querySelector('svg').style.transform = w.dir < 0 ? 'scaleX(-1)' : '';
      }
    }
  }

  setMuted(m) {
    this.hud.mute.classList.toggle('muted', m);
  }
}

function introColour(def) {
  return { dawn: '#8a2a14', saints: '#1e2f8a', orchard: '#145a30', tempest: '#2a1f6a', rose: '#7a1630' }[def.id] || '#6a1430';
}

function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
