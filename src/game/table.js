// Turns a table definition (plain data from src/tables/) into physics bodies and the
// runtime state of each fixture. No drawing here: the renderer reads this state.
import { World, Flipper, seg, circle, chain } from '../physics/world.js';
import { addPendulum, addRotor } from '../physics/bodies.js';
import { lowerPlayfield, archWall, LANE_X, RIGHT, PLUNGER_REST_Y, TABLE_W, BALL_R } from '../tables/common.js';

const RAIL = { e: 0.45, f: 0.06, r: 3 };
const STONE = { e: 0.42, f: 0.08 };

function normalOf(a, b, towards) {
  // Unit normal of segment a-b, pointing towards the given point.
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  let nx = -dy / l;
  let ny = dx / l;
  const mxp = (a[0] + b[0]) / 2;
  const myp = (a[1] + b[1]) / 2;
  if ((towards[0] - mxp) * nx + (towards[1] - myp) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

export function buildTable(def, mods = {}) {
  const world = new World({ rand: mods.rand, gravity: 1500 * (mods.gravity ?? 1), bounds: { x0: -120, y0: -120, x1: 760, y1: 1500 } });
  const L = lowerPlayfield();
  const T = {
    def,
    world,
    walls: [], // polylines for drawing: { pts, kind }
    bumpers: [],
    slings: [],
    posts: [],
    lanes: [],
    inlanes: [],
    outlanes: [],
    targets: [],
    drops: [],
    banks: {},
    spinners: [],
    bells: [],
    rotor: null,
    scoop: null,
    flippers: [],
    plunger: null,
    kickbacks: [],
    centrePost: null,
  };
  const wall = (pts, kind = 'stone', o = STONE) => {
    world.addStatic(chain(pts, { ...o, tag: 'wall' }));
    T.walls.push({ pts, kind });
  };

  // Outer stone: the arch and side walls, the aprons, the lane.
  wall(archWall(def.arch), 'arch');
  wall(L.leftWall, 'stone');
  wall(L.rightApron, 'stone');
  wall(L.laneWall, 'stone');
  wall(L.leftGuide, 'rail', RAIL);
  wall(L.rightGuide, 'rail', RAIL);
  // The lane gate: solid for balls above it, open for the launch.
  {
    const { a, b } = L.laneGate;
    const n = normalOf(a, b, [a[0] - 40, a[1] - 60]);
    world.addStatic(seg(a[0], a[1], b[0], b[1], { e: 0.3, oneWay: n, tag: 'gate', r: 2 }));
    T.gate = { a, b, open: 0 };
  }
  // A rounded cap where the lane wall ends.
  world.addStatic(circle(LANE_X, L.laneWall[1][1], 3, STONE));

  for (const p of [...L.posts, ...(def.posts || [])]) {
    world.addStatic(circle(p.x, p.y, p.r ?? 6, { e: 0.6, tag: 'post' }));
    T.posts.push(p);
  }
  for (const r of def.rails || []) wall(r, 'rail', RAIL);
  for (const r of def.stones || []) wall(r, 'stone', STONE);

  // Slingshots.
  for (const s of L.slings) {
    const centroid = [(s.a[0] + s.b[0] + s.c[0]) / 3, (s.a[1] + s.b[1] + s.c[1]) / 3];
    const kickN = normalOf(s.a, s.c, [s.c[0] + (s.side === 'left' ? 60 : -60), s.a[1]]);
    const sl = { ...s, flash: 0, n: kickN };
    const face = seg(s.a[0], s.a[1], s.c[0], s.c[1], {
      e: 0.55,
      kick: 780 * (mods.slingKick ?? 1),
      kickMin: 60,
      kickNormal: kickN,
      tag: 'sling',
      data: sl,
      cooldown: 0.1,
      r: 2,
    });
    world.addStatic(face);
    world.addStatic(seg(s.a[0], s.a[1], s.b[0], s.b[1], { e: 0.4, r: 2 }));
    world.addStatic(seg(s.b[0], s.b[1], s.c[0], s.c[1], { e: 0.4, r: 2 }));
    for (const p of [s.a, s.b, s.c]) world.addStatic(circle(p[0], p[1], 6, { e: 0.55 }));
    sl.c0 = centroid;
    sl.collider = face;
    T.slings.push(sl);
  }

  // Flippers.
  const lenScale = mods.flipperLength ?? 1;
  for (const f of L.flippers) {
    const fl = new Flipper({ ...f, length: 88 * lenScale, r0: 13, r1: 7, upSpeed: 25, downSpeed: 17, e: 0.28 });
    world.addFlipper(fl);
    T.flippers.push(fl);
  }

  // Plunger: a moving stopper in the shooter lane.
  {
    const P = { y: PLUNGER_REST_Y, rest: PLUNGER_REST_Y, pull: 0, vy: 0, x0: LANE_X + 1, x1: RIGHT - 1 };
    P.c = seg(P.x0, P.y, P.x1, P.y, { e: 0, f: 0.0, tag: 'plunger', r: 2, surf: () => [0, P.vy] });
    world.addDynamic(P.c);
    world.updaters.push((h) => {
      if (P.vy < 0) {
        P.y += P.vy * h;
        if (P.y <= P.rest) {
          P.y = P.rest;
          P.vy = 0;
        }
        P.c.ay = P.c.by = P.y;
      }
    });
    world.speedHints.push(() => Math.abs(P.vy));
    T.plunger = P;
  }

  // Bumpers (pop bumpers).
  for (const b of def.bumpers || []) {
    const B = { ...b, r: b.r ?? 27, flash: 0 };
    B.c = circle(B.x, B.y, B.r, { e: 0.5, kick: 920 * (mods.bumperKick ?? 1), kickMin: 15, tag: 'bumper', data: B, cooldown: 0.07 });
    world.addStatic(B.c);
    T.bumpers.push(B);
  }

  // Rollover lanes (top lanes and others). Lane guides are rails.
  for (const g of def.laneGuides || []) {
    wall([[g[0], g[1]], [g[0], g[2]]], 'rail', RAIL);
    world.addStatic(circle(g[0], g[1], 4, { e: 0.5 }));
    world.addStatic(circle(g[0], g[2], 4, { e: 0.5 }));
  }
  (def.lanes || []).forEach((l, i) => {
    const Ln = { ...l, index: i, lit: false, flash: 0, group: l.group || 'top' };
    Ln.c = circle(l.x, l.y, 7, { sensor: true, tag: 'lane', data: Ln });
    world.addStatic(Ln.c);
    T.lanes.push(Ln);
  });
  for (const s of ['inlanes', 'outlanes']) {
    for (const l of L[s]) {
      const Ln = { ...l, flash: 0, kind: s };
      Ln.c = circle(l.x, l.y, 7, { sensor: true, tag: s === 'inlanes' ? 'inlane' : 'outlane', data: Ln });
      world.addStatic(Ln.c);
      T[s].push(Ln);
    }
  }

  // Standup targets and drop targets.
  for (const t of def.targets || []) {
    const Tg = { ...t, flash: 0, lit: false };
    Tg.c = seg(t.a[0], t.a[1], t.b[0], t.b[1], { e: 0.35, r: 4, tag: 'target', data: Tg, cooldown: 0.15 });
    world.addStatic(Tg.c);
    T.targets.push(Tg);
  }
  for (const t of def.drops || []) {
    const D = { ...t, down: false, flash: 0, anim: 0 };
    D.c = seg(t.a[0], t.a[1], t.b[0], t.b[1], { e: 0.3, r: 5, tag: 'drop', data: D, cooldown: 0.1 });
    world.addDynamic(D.c);
    T.drops.push(D);
    const bank = (T.banks[t.bank] ||= { id: t.bank, drops: [], resetIn: 0, completed: 0 });
    bank.drops.push(D);
  }

  // Spinners: a sensor line across a lane; the plate spins when the ball passes.
  for (const s of def.spinners || []) {
    const half = (s.len ?? 40) / 2;
    const ca = Math.cos(s.angle ?? 0);
    const sa = Math.sin(s.angle ?? 0);
    const S = { ...s, spin: 0, phase: 0, count: 0, flash: 0, ax: s.x - ca * half, ay: s.y - sa * half, bx: s.x + ca * half, by: s.y + sa * half };
    S.c = seg(S.ax, S.ay, S.bx, S.by, { sensor: true, tag: 'spinner', data: S });
    world.addStatic(S.c);
    T.spinners.push(S);
  }

  // Bells.
  for (const b of def.bells || []) {
    const P = addPendulum(world, { x: b.x, y: b.y, len: b.len ?? 52, r: b.r ?? 19, tag: 'bell' });
    const Bl = { ...b, p: P, ring: 0, flash: 0, swingTime: 0, note: b.note ?? 0 };
    P.c.data = Bl;
    T.bells.push(Bl);
  }

  // A rotating rosette.
  if (def.rotor) {
    const r = def.rotor;
    const parts = [{ type: 'circle', x: 0, y: 0, r: r.hub ?? 28, tag: 'rotorHub' }];
    for (let i = 0; i < (r.lobes ?? 6); i++) {
      const a = (i / (r.lobes ?? 6)) * Math.PI * 2;
      parts.push({ type: 'circle', x: Math.cos(a) * (r.arm ?? 56), y: Math.sin(a) * (r.arm ?? 56), r: r.lobe ?? 13, tag: 'rotorLobe', data: { index: i }, e: 0.55 });
    }
    const R = addRotor(world, { x: r.x, y: r.y, w: r.w ?? 1.4, parts });
    T.rotor = { ...r, R, lit: new Array(r.lobes ?? 6).fill(false), flash: new Array(r.lobes ?? 6).fill(0), hubFlash: 0, baseW: r.w ?? 1.4 };
    for (const p of R.parts) {
      if (p.def.tag === 'rotorLobe') p.c.data = { rotor: T.rotor, index: p.def.data.index };
      else p.c.data = { rotor: T.rotor, index: -1 };
    }
  }

  // A scoop (saucer) that catches the ball.
  if (def.scoop) {
    const s = def.scoop;
    const S = { ...s, held: null, timer: 0, flash: 0, open: false };
    S.c = circle(s.x, s.y, 9, { sensor: true, tag: 'scoop', data: S });
    world.addStatic(S.c);
    // A small horseshoe of stone around it, open on its mouth side.
    if (s.walls) for (const w of s.walls) wall(w, 'rail', RAIL);
    T.scoop = S;
  }

  // The hidden cellar (a separate chamber below the table).
  if (def.cellar) {
    const C = { ...def.cellar, pegs: [], cup: null, active: false };
    for (const w of def.cellar.walls) wall(w, 'cellar', { e: 0.5, f: 0.03 });
    for (const p of def.cellar.pegs) {
      const Pg = { ...p, flash: 0 };
      Pg.c = circle(p.x, p.y, p.r ?? 11, { e: 0.6, kick: 380, kickMin: 40, tag: 'peg', data: Pg, cooldown: 0.1 });
      world.addStatic(Pg.c);
      C.pegs.push(Pg);
    }
    C.cupC = circle(def.cellar.cup.x, def.cellar.cup.y, 10, { sensor: true, tag: 'cup', data: C });
    world.addStatic(C.cupC);
    T.cellar = C;
  }

  // Outlane kickbacks (a relic): an invisible kicker at the bottom of each outlane.
  if (mods.kickback) {
    for (const side of ['left', 'right']) {
      const x = side === 'left' ? 41 : 2 * 299 - 41;
      const K = { side, x, y: 850, charged: true, flash: 0 };
      K.c = circle(x, 850, 8, { sensor: true, tag: 'kickback', data: K });
      world.addStatic(K.c);
      T.kickbacks.push(K);
    }
  }

  // A stone post that can rise between the flippers (a relic).
  if (mods.centrePost) {
    const C = { x: 299, y: 1000, up: 0, timer: 0 };
    C.c = circle(299, 1000, 10, { e: 0.5, tag: 'centrePost', enabled: false });
    world.addDynamic(C.c);
    T.centrePost = C;
  }

  world.buildGrid();
  T.width = TABLE_W;
  T.ballR = BALL_R;
  return T;
}
