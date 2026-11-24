// Keyboard (rebindable), touch and gamepad, merged into one state each frame.

export const ACTIONS = [
  { id: 'left', label: 'Left flipper' },
  { id: 'right', label: 'Right flipper' },
  { id: 'plunger', label: 'Plunger (hold, release to launch)' },
  { id: 'nudge', label: 'Nudge' },
  { id: 'pause', label: 'Pause' },
  { id: 'mute', label: 'Mute' },
];

export const DEFAULT_BINDINGS = {
  left: ['ArrowLeft', 'KeyZ', null],
  right: ['ArrowRight', 'Slash', null],
  plunger: ['Space', 'ArrowDown', null],
  nudge: ['ShiftLeft', 'ArrowUp', 'ShiftRight'],
  pause: ['Escape', 'KeyP', null],
  mute: ['KeyM', null, null],
};

export const SLOTS = 3;

export function cloneBindings(b) {
  const out = {};
  for (const a of ACTIONS) {
    const src = b?.[a.id] || DEFAULT_BINDINGS[a.id];
    out[a.id] = Array.from({ length: SLOTS }, (_, i) => src[i] ?? null);
  }
  return out;
}

const NAMES = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  Space: 'Space',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Backspace',
  CapsLock: 'Caps Lock',
  Slash: '/',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '−',
  Equal: '=',
  Backquote: '`',
};

export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

// Standard gamepad mapping.
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Input {
  /**
   * @param {HTMLElement} surface element that receives touches during play
   * @param {object} bindings
   */
  constructor(surface, bindings) {
    this.surface = surface;
    this.setBindings(bindings);
    this.keys = new Set();
    this.touches = new Map(); // pointerId -> { zone, x0, y0, t0, nudged }
    this.nudgeQueued = false;
    this.nudgeX = 0;
    this.listeners = { action: [], menu: [], any: [] };
    this.capturing = null; // rebinding: (code) => void
    this.playing = false; // touches on the surface control the table
    this.zoneAt = () => null; // (clientX, clientY) => 'left' | 'right' | 'plunger'
    this.padPrev = [];
    this.padStick = { x: 0, y: 0, t: 0 };
    this.padAxisPrev = { x: 0, y: 0 };
    this.lastDevice = 'keyboard';

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touches.clear();
    });
    const opts = { passive: false };
    surface.addEventListener('pointerdown', (e) => this.onPointerDown(e), opts);
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), opts);
    window.addEventListener('pointerup', (e) => this.onPointerUp(e), opts);
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e), opts);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setBindings(b) {
    this.bindings = cloneBindings(b);
    this.codeToAction = new Map();
    for (const [act, codes] of Object.entries(this.bindings)) for (const c of codes) if (c) this.codeToAction.set(c, act);
  }

  on(kind, fn) {
    this.listeners[kind].push(fn);
  }
  fire(kind, ...args) {
    for (const fn of this.listeners[kind]) fn(...args);
  }

  onKey(e, down) {
    if (down) this.fire('any', 'keyboard');
    if (this.capturing && down) {
      e.preventDefault();
      const cb = this.capturing;
      this.capturing = null;
      cb(e.code);
      return;
    }
    const act = this.codeToAction.get(e.code);
    if (down) this.lastDevice = 'keyboard';
    if (act) {
      // Keep arrows and space from scrolling the host page while the game has focus.
      if (this.playing || act !== 'pause') e.preventDefault();
      if (down) {
        if (!e.repeat && !this.keys.has(e.code)) {
          if (act === 'nudge') this.queueNudge(0);
          if (act === 'pause' || act === 'mute') this.fire('action', act);
        }
        this.keys.add(e.code);
      } else this.keys.delete(e.code);
    } else if (down && !e.repeat) {
      // Menus: arrows/Enter/Escape navigation when not bound (they usually are bound,
      // so ui.js also listens for keys itself).
    }
  }

  queueNudge(x) {
    this.nudgeQueued = true;
    this.nudgeX = x;
  }

  held(act) {
    for (const c of this.bindings[act]) if (c && this.keys.has(c)) return true;
    return false;
  }

  onPointerDown(e) {
    this.fire('any', e.pointerType === 'mouse' ? 'mouse' : 'touch');
    if (!this.playing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.lastDevice = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    const zone = this.zoneAt(e.clientX, e.clientY);
    if (!zone) return;
    this.touches.set(e.pointerId, { zone, x0: e.clientX, y0: e.clientY, t0: performance.now(), nudged: false });
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* not all browsers */
    }
  }

  onPointerMove(e) {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    const dy = e.clientY - t.y0;
    const dx = e.clientX - t.x0;
    const dt = performance.now() - t.t0;
    const h = this.surface.clientHeight || 800;
    // A quick upward swipe nudges the table.
    if (!t.nudged && dy < -h * 0.07 && dt < 350 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      t.nudged = true;
      this.queueNudge(Math.max(-1, Math.min(1, dx / (h * 0.08))));
    }
  }

  onPointerUp(e) {
    this.touches.delete(e.pointerId);
  }

  touchHeld(zone) {
    for (const t of this.touches.values()) if (t.zone === zone) return true;
    return false;
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) pad = pad || p;
    if (!pad) return null;
    const btn = (i) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4);
    const now = pad.buttons.map((_, i) => btn(i));
    const edge = (i) => now[i] && !this.padPrev[i];
    if (now.some(Boolean)) this.lastDevice = 'gamepad';
    if (now.some(Boolean)) this.fire('any', 'gamepad');
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    // Stick flick: a fast push from near centre nudges in that direction.
    const mag = Math.hypot(ax, ay);
    const prevMag = Math.hypot(this.padAxisPrev.x, this.padAxisPrev.y);
    const tnow = performance.now();
    if (prevMag < 0.3) this.padStick.t = tnow;
    if (mag > 0.85 && prevMag <= 0.85 && tnow - this.padStick.t < 160 && this.playing) this.queueNudge(Math.abs(ax) > 0.4 ? Math.sign(ax) : 0);
    // Menu navigation from the d-pad and the stick.
    const dir = (cond, prevCond, name) => {
      if (cond && !prevCond) this.fire('menu', name);
    };
    dir(now[PAD.UP] || ay < -0.6, this.padPrev[PAD.UP] || this.padAxisPrev.y < -0.6, 'up');
    dir(now[PAD.DOWN] || ay > 0.6, this.padPrev[PAD.DOWN] || this.padAxisPrev.y > 0.6, 'down');
    dir(now[PAD.LEFT] || ax < -0.6, this.padPrev[PAD.LEFT] || this.padAxisPrev.x < -0.6, 'left');
    dir(now[PAD.RIGHT] || ax > 0.6, this.padPrev[PAD.RIGHT] || this.padAxisPrev.x > 0.6, 'right');
    if (edge(PAD.A)) this.fire('menu', 'ok');
    if (edge(PAD.B)) {
      this.fire('menu', 'back');
      if (this.playing) this.queueNudge(0);
    }
    if (edge(PAD.START)) this.fire('action', 'pause');
    if (edge(PAD.BACK)) this.fire('action', 'mute');
    this.padAxisPrev = { x: ax, y: ay };
    this.padPrev = now;
    return {
      left: btn(PAD.LB) || btn(PAD.LT),
      right: btn(PAD.RB) || btn(PAD.RT),
      plunger: btn(PAD.A),
    };
  }

  /** The merged state for this frame. Consumes a queued nudge. */
  state() {
    const pad = this.pollPad();
    const s = {
      left: this.held('left') || this.touchHeld('left') || !!pad?.left,
      right: this.held('right') || this.touchHeld('right') || !!pad?.right,
      plunger: this.held('plunger') || this.touchHeld('plunger') || !!pad?.plunger,
      nudge: this.nudgeQueued,
      nudgeX: this.nudgeX,
    };
    this.nudgeQueued = false;
    this.nudgeX = 0;
    return s;
  }

  vibrate(ms) {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: 0.4, weakMagnitude: 0.3 });
    } catch {
      /* optional */
    }
  }
}
