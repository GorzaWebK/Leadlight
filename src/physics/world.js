// Leadlight's small 2D pinball physics.
//
// Everything is in table units (the table is 640 x 1060, y points down the table).
// The world steps at a fixed 120 Hz. Each step is split into substeps so that no
// ball and no moving surface (a flipper tip, a spinning rosette) travels more than
// about a third of the ball's radius per substep. Contacts are detected while the
// ball's centre is still well outside every surface, so a ball can't tunnel through
// even a zero-thickness wall at any speed the game allows.
//
// Colliders:
//   seg      a capsule from a to b with radius `r` (0 for a thin wall)
//   circle   a post, a bumper, a bell
//   flipper  a rotating tapered capsule, handled by the Flipper class
// Any collider can be a `sensor` (reports enter/exit, no bounce), `oneWay` (solid only
// from the side its normal points to), have a `kick` (bumpers and slingshots), and a
// moving surface (`surf`: a function giving the surface velocity at a point).

export const STEP = 1 / 120;
export const MAX_SPEED = 4600;

let nextId = 1;

function base(o) {
  return {
    id: nextId++,
    e: o.e ?? 0.45, // restitution
    f: o.f ?? 0.04, // tangential friction per contact (0..1)
    kick: o.kick ?? 0, // outward speed given by an active surface
    kickMin: o.kickMin ?? 70, // impact speed (along the normal) needed to fire the kick
    kickNormal: o.kickNormal || null, // only kick when hit on this side (slingshot face)
    cooldown: o.cooldown ?? 0.06, // seconds between hit events (and kicks)
    sensor: !!o.sensor,
    enabled: o.enabled ?? true,
    tag: o.tag || null,
    data: o.data || null,
    oneWay: o.oneWay || null, // {x, y}: solid only for a ball on this side, moving against it
    surf: o.surf || null, // (px, py) => [vx, vy]
    onHit: o.onHit || null, // (impulse, nx, ny, ball) after a bounce (used by bells)
    lastHit: -1,
  };
}

export function seg(ax, ay, bx, by, o = {}) {
  return { ...base(o), type: 'seg', ax, ay, bx, by, r: o.r ?? 0 };
}

export function circle(x, y, r, o = {}) {
  return { ...base(o), type: 'circle', x, y, r };
}

/** A chain of segments through points [[x, y], ...]. */
export function chain(points, o = {}, closed = false) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    out.push(seg(a[0], a[1], b[0], b[1], o));
  }
  return out;
}

export class Ball {
  constructor(x, y, r = 12) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = r;
    this.fx = 0; // extra acceleration (wind)
    this.fy = 0;
    this.active = true;
    this.frozen = false; // held by a saucer or the plunger
    this.inside = new Set(); // sensor ids the ball overlaps
    this.id = nextId++;
  }
  get speed() {
    return Math.hypot(this.vx, this.vy);
  }
}

export class Flipper {
  /**
   * @param {object} o pivot x/y, length, r0 (pivot radius), r1 (tip radius),
   *   rest and up angles in radians (0 = pointing right, y down), up/down speeds.
   */
  constructor(o) {
    this.id = nextId++;
    this.type = 'flipper';
    this.px = o.x;
    this.py = o.y;
    this.len = o.length ?? 92;
    this.r0 = o.r0 ?? 13;
    this.r1 = o.r1 ?? 7;
    this.rest = o.rest;
    this.up = o.up;
    this.upSpeed = o.upSpeed ?? 24;
    this.downSpeed = o.downSpeed ?? 16;
    this.e = o.e ?? 0.3;
    this.f = o.f ?? 0.02;
    this.angle = this.rest;
    this.w = 0;
    this.pressed = false;
    this.enabled = true;
    this.side = o.side || 'left';
    this.tag = 'flipper';
    this.lastHit = -1;
    this.cooldown = 0.05;
  }
  get tipX() {
    return this.px + Math.cos(this.angle) * this.len;
  }
  get tipY() {
    return this.py + Math.sin(this.angle) * this.len;
  }
  /** Fastest the tip can move this step (used to size substeps). */
  potentialSpeed() {
    const target = this.pressed && this.enabled ? this.up : this.rest;
    if (Math.abs(target - this.angle) < 1e-6) return 0;
    return Math.max(this.upSpeed, this.downSpeed) * (this.len + this.r1);
  }
  update(h) {
    const target = this.pressed && this.enabled ? this.up : this.rest;
    const d = target - this.angle;
    if (Math.abs(d) < 1e-9) {
      this.w = 0;
      return;
    }
    const speed = this.pressed && this.enabled ? this.upSpeed : this.downSpeed;
    const step = Math.sign(d) * speed * h;
    if (Math.abs(step) >= Math.abs(d)) {
      this.angle = target;
      this.w = d / h; // keep the true velocity for this substep
      this._settle = true;
    } else {
      this.angle += step;
      this.w = Math.sign(d) * speed;
      this._settle = false;
    }
  }
  /** After a substep that reached the limit, the flipper is still. */
  endSubstep() {
    if (this._settle) {
      this.w = 0;
      this._settle = false;
    }
  }
}

const GRID = 64;

export class World {
  constructor(o = {}) {
    this.gx = o.gx ?? 0;
    this.gy = o.gravity ?? 1500;
    this.drag = o.drag ?? 0.05; // per second, a little rolling resistance
    this.statics = [];
    this.dynamics = []; // moving or toggling colliders, always checked
    this.flippers = [];
    this.balls = [];
    this.updaters = []; // (h) => void, run every substep (kinematic bodies, bells)
    this.speedHints = []; // () => fastest moving-surface speed, for sizing substeps
    this.events = [];
    this.time = 0;
    this.grid = null;
    this.bounds = o.bounds || { x0: -200, y0: -200, x1: 900, y1: 1600 };
    this.lastSubsteps = 1;
  }

  addStatic(c) {
    if (Array.isArray(c)) c.forEach((x) => this.addStatic(x));
    else this.statics.push(c);
    this.grid = null;
    return c;
  }
  addDynamic(c) {
    if (Array.isArray(c)) c.forEach((x) => this.addDynamic(x));
    else this.dynamics.push(c);
    return c;
  }
  remove(c) {
    for (const list of [this.statics, this.dynamics]) {
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    this.grid = null;
  }
  addFlipper(f) {
    this.flippers.push(f);
    return f;
  }
  addBall(b) {
    this.balls.push(b);
    return b;
  }
  removeBall(b) {
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }

  buildGrid() {
    const { x0, y0, x1, y1 } = this.bounds;
    const cols = Math.ceil((x1 - x0) / GRID);
    const rows = Math.ceil((y1 - y0) / GRID);
    const cells = Array.from({ length: cols * rows }, () => []);
    const pad = 20; // largest ball radius plus a margin
    this.statics.forEach((c) => {
      let ax, ay, bx, by;
      if (c.type === 'seg') {
        ax = Math.min(c.ax, c.bx) - c.r;
        bx = Math.max(c.ax, c.bx) + c.r;
        ay = Math.min(c.ay, c.by) - c.r;
        by = Math.max(c.ay, c.by) + c.r;
      } else {
        ax = c.x - c.r;
        bx = c.x + c.r;
        ay = c.y - c.r;
        by = c.y + c.r;
      }
      const cx0 = Math.max(0, Math.floor((ax - pad - x0) / GRID));
      const cx1 = Math.min(cols - 1, Math.floor((bx + pad - x0) / GRID));
      const cy0 = Math.max(0, Math.floor((ay - pad - y0) / GRID));
      const cy1 = Math.min(rows - 1, Math.floor((by + pad - y0) / GRID));
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) cells[y * cols + x].push(c);
    });
    this.grid = { cols, rows, cells };
  }

  cellAt(x, y) {
    const g = this.grid;
    const cx = Math.floor((x - this.bounds.x0) / GRID);
    const cy = Math.floor((y - this.bounds.y0) / GRID);
    if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return null;
    return g.cells[cy * g.cols + cx];
  }

  /** One fixed step. Returns the number of substeps used. */
  step(dt = STEP, extraSurfaceSpeed = 0) {
    if (!this.grid) this.buildGrid();
    let maxV = extraSurfaceSpeed;
    let minR = 12;
    for (const b of this.balls) {
      if (!b.active || b.frozen) continue;
      maxV = Math.max(maxV, b.speed + (Math.hypot(this.gx, this.gy) + Math.hypot(b.fx, b.fy)) * dt);
      minR = Math.min(minR, b.r);
    }
    for (const f of this.flippers) maxV = Math.max(maxV, f.potentialSpeed());
    for (const s of this.speedHints) maxV = Math.max(maxV, s());
    const n = Math.min(64, Math.max(1, Math.ceil((maxV * dt) / (minR * 0.33))));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h);
    this.lastSubsteps = n;
    return n;
  }

  substep(h) {
    this.time += h;
    for (const f of this.flippers) f.update(h);
    for (const u of this.updaters) u(h);
    const balls = this.balls;
    for (const b of balls) {
      if (!b.active || b.frozen) continue;
      b.vx += (this.gx + b.fx) * h;
      b.vy += (this.gy + b.fy) * h;
      const k = 1 - this.drag * h;
      b.vx *= k;
      b.vy *= k;
      const s = b.speed;
      if (s > MAX_SPEED) {
        b.vx *= MAX_SPEED / s;
        b.vy *= MAX_SPEED / s;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
      for (let it = 0; it < 3; it++) {
        if (!this.collideBall(b)) break;
      }
      this.sensors(b);
    }
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) this.ballBall(balls[i], balls[j]);
    for (const f of this.flippers) f.endSubstep();
  }

  /** Resolve all contacts for one ball. Returns true if anything was touched. */
  collideBall(b) {
    let touched = false;
    const cell = this.cellAt(b.x, b.y);
    if (cell) for (let i = 0; i < cell.length; i++) touched = this.contact(b, cell[i]) || touched;
    const d = this.dynamics;
    for (let i = 0; i < d.length; i++) touched = this.contact(b, d[i]) || touched;
    for (const f of this.flippers) touched = this.flipperContact(b, f) || touched;
    return touched;
  }

  contact(b, c) {
    if (!c.enabled || c.sensor) return false;
    let qx, qy, R;
    if (c.type === 'seg') {
      const ex = c.bx - c.ax;
      const ey = c.by - c.ay;
      const len2 = ex * ex + ey * ey;
      let t = len2 > 0 ? ((b.x - c.ax) * ex + (b.y - c.ay) * ey) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      qx = c.ax + ex * t;
      qy = c.ay + ey * t;
      R = b.r + c.r;
    } else {
      qx = c.x;
      qy = c.y;
      R = b.r + c.r;
    }
    let dx = b.x - qx;
    let dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return false;
    if (c.oneWay) {
      // Solid only while the ball's centre is on the normal's side of the line.
      if ((b.x - c.ax) * c.oneWay.x + (b.y - c.ay) * c.oneWay.y < 0) return false;
    }
    let d = Math.sqrt(d2);
    let nx, ny;
    if (d < 1e-6) {
      if (c.type === 'seg') {
        const l = Math.hypot(c.bx - c.ax, c.by - c.ay) || 1;
        nx = -(c.by - c.ay) / l;
        ny = (c.bx - c.ax) / l;
      } else {
        nx = 0;
        ny = -1;
      }
      d = 0;
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    if (c.oneWay) {
      // A gate pushes straight out along its own normal.
      nx = c.oneWay.x;
      ny = c.oneWay.y;
    }
    // Push out of the surface.
    const pen = R - d;
    b.x += nx * pen;
    b.y += ny * pen;
    const cpx = qx + nx * (R - b.r);
    const cpy = qy + ny * (R - b.r);
    const sx = c.surf ? c.surf(cpx, cpy) : null;
    this.respond(b, c, nx, ny, sx ? sx[0] : 0, sx ? sx[1] : 0, cpx, cpy);
    return true;
  }

  flipperContact(b, f) {
    const ex = Math.cos(f.angle) * f.len;
    const ey = Math.sin(f.angle) * f.len;
    let t = ((b.x - f.px) * ex + (b.y - f.py) * ey) / (f.len * f.len);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ax = f.px + ex * t;
    const ay = f.py + ey * t;
    const rad = f.r0 + (f.r1 - f.r0) * t;
    const R = b.r + rad;
    const dx = b.x - ax;
    const dy = b.y - ay;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return false;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    b.x += nx * (R - d);
    b.y += ny * (R - d);
    // Surface point and its velocity (w x r).
    const qx = ax + nx * rad;
    const qy = ay + ny * rad;
    const svx = -f.w * (qy - f.py);
    const svy = f.w * (qx - f.px);
    this.respond(b, f, nx, ny, svx, svy, qx, qy, t);
    return true;
  }

  respond(b, c, nx, ny, svx, svy, qx, qy, t = 0) {
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return; // already separating
    const tx = rvx - vn * nx;
    const ty = rvy - vn * ny;
    let out = -vn * c.e;
    const now = this.time;
    const fresh = now - c.lastHit >= c.cooldown;
    let kicked = false;
    if (c.kick && fresh && -vn > c.kickMin) {
      if (!c.kickNormal || nx * c.kickNormal.x + ny * c.kickNormal.y > 0.5) {
        out = Math.max(out, c.kick);
        kicked = true;
      }
    }
    const keep = 1 - c.f;
    const nvx = svx + tx * keep + nx * out;
    const nvy = svy + ty * keep + ny * out;
    const jx = nvx - b.vx;
    const jy = nvy - b.vy;
    b.vx = nvx;
    b.vy = nvy;
    if (c.onHit) c.onHit(jx, jy, b, qx, qy);
    if (fresh && -vn > 25) {
      c.lastHit = now;
      this.events.push({ type: 'hit', c, ball: b, speed: -vn, kicked, x: qx, y: qy, nx, ny, t });
    }
  }

  sensors(b) {
    const check = (c) => {
      if (!c.sensor) return;
      let d2, R;
      if (c.type === 'seg') {
        const ex = c.bx - c.ax;
        const ey = c.by - c.ay;
        const len2 = ex * ex + ey * ey;
        let t = len2 > 0 ? ((b.x - c.ax) * ex + (b.y - c.ay) * ey) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = b.x - (c.ax + ex * t);
        const dy = b.y - (c.ay + ey * t);
        d2 = dx * dx + dy * dy;
        R = b.r + c.r;
      } else {
        const dx = b.x - c.x;
        const dy = b.y - c.y;
        d2 = dx * dx + dy * dy;
        R = b.r + c.r;
      }
      const inside = c.enabled && d2 < R * R;
      const was = b.inside.has(c.id);
      if (inside && !was) {
        b.inside.add(c.id);
        this.events.push({ type: 'enter', c, ball: b, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
      } else if (!inside && was) {
        b.inside.delete(c.id);
        this.events.push({ type: 'exit', c, ball: b, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
      }
    };
    const cell = this.cellAt(b.x, b.y);
    if (cell) for (let i = 0; i < cell.length; i++) check(cell[i]);
    for (let i = 0; i < this.dynamics.length; i++) check(this.dynamics[i]);
  }

  ballBall(a, b) {
    if (!a.active || !b.active || a.frozen || b.frozen) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const R = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R || d2 < 1e-9) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const pen = (R - d) / 2;
    a.x -= nx * pen;
    a.y -= ny * pen;
    b.x += nx * pen;
    b.y += ny * pen;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn >= 0) return;
    const j = (-(1 + 0.9) * vn) / 2;
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
    this.events.push({ type: 'clack', x: a.x + nx * a.r, y: a.y + ny * a.r, speed: -vn });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}

/** Kinetic plus potential energy of a ball (per unit mass), for tests and sanity checks. */
export function ballEnergy(world, b) {
  return 0.5 * (b.vx * b.vx + b.vy * b.vy) - world.gy * b.y - world.gx * b.x;
}
