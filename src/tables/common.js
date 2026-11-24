// Shared table geometry. Every window uses the same lower playfield (flippers,
// slingshots, inlanes, outlanes, shooter lane), so the flipper game feels the same
// everywhere, and each window gets its own outline and upper playfield.
//
// Table units: 640 wide, 1060 tall, y grows down the table towards the player.

export const TABLE_W = 640;
export const TABLE_H = 1060;
export const BALL_R = 12;
export const LEFT = 20; // left wall
export const RIGHT = 620; // outer right wall (shooter lane side)
export const LANE_X = 578; // shooter lane inner wall, also the playfield's right side below the gate
export const CX = (LEFT + LANE_X) / 2; // 299, the flippers' centre line
export const GLASS_BOTTOM = 905;
export const DRAIN_Y = 1078;
export const LANE_TOP = 340; // where the shooter lane opens onto the playfield
export const PLUNGER_X = (LANE_X + RIGHT) / 2;
export const PLUNGER_REST_Y = 1012;

const mx = (x) => 2 * CX - x; // mirror across the flipper centre line

export function arcPts(cx, cy, r, a0, a1, step = 0.07) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) out.push(p);
  }
  return out;
}

/** Intersection of two circles, the point with the smaller y (upper one). */
function circleMeet(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const px = c1[0] + (dx * a) / d;
  const py = c1[1] + (dy * a) / d;
  const p1 = [px + (h * dy) / d, py - (h * dx) / d];
  const p2 = [px - (h * dy) / d, py + (h * dx) / d];
  return p1[1] < p2[1] ? p1 : p2;
}

// ---- Window outlines: the arch from the left springer to the right one (left to right) ----

/** Pointed two-centred (lancet) arch. */
export function lancetArch(springY, radius) {
  const span = RIGHT - LEFT;
  const cL = [LEFT + radius, springY]; // centre of the left arc
  const cR = [RIGHT - radius, springY];
  const midX = (LEFT + RIGHT) / 2;
  const apexY = springY - Math.sqrt(radius * radius - (radius - span / 2) ** 2);
  const aApexL = Math.atan2(apexY - cL[1], midX - cL[0]);
  const aApexR = Math.atan2(apexY - cR[1], midX - cR[0]);
  const left = arcPts(cL[0], cL[1], radius, Math.PI, Math.PI * 2 + aApexL);
  const right = arcPts(cR[0], cR[1], radius, aApexR, 0);
  return dedupe([...left, ...right]);
}

/** Round (semicircular) arch. */
export function roundArch(springY) {
  const r = (RIGHT - LEFT) / 2;
  return arcPts((LEFT + RIGHT) / 2, springY, r, Math.PI, Math.PI * 2, 0.05);
}

/** Four-centred (Tudor) arch: tight curves at the springers, a long flat rise to a low point. */
export function tudorArch(springY, r1, turn, r2) {
  const c1 = [LEFT + r1, springY];
  const a1 = Math.PI + turn;
  const p = [c1[0] + Math.cos(a1) * r1, c1[1] + Math.sin(a1) * r1];
  const c2 = [p[0] - Math.cos(a1) * r2, p[1] - Math.sin(a1) * r2];
  const midX = (LEFT + RIGHT) / 2;
  const aTop = -Math.acos((midX - c2[0]) / r2);
  const left = [...arcPts(c1[0], c1[1], r1, Math.PI, a1), ...arcPts(c2[0], c2[1], r2, a1, Math.PI * 2 + aTop, 0.03)];
  const right = left.map(([x, y]) => [LEFT + RIGHT - x, y]).reverse();
  return dedupe([...left, ...right]);
}

/** Trefoil head: a tall centre lobe between two side lobes, meeting in cusps. */
export function trefoilArch(springY, sideR, centreY, centreR) {
  const cL = [LEFT + sideR, springY];
  const cR = [RIGHT - sideR, springY];
  const cC = [(LEFT + RIGHT) / 2, centreY];
  const kL = circleMeet(cL, sideR, cC, centreR);
  const kR = [LEFT + RIGHT - kL[0], kL[1]];
  const aL = Math.atan2(kL[1] - cL[1], kL[0] - cL[0]);
  const aC0 = Math.atan2(kL[1] - cC[1], kL[0] - cC[0]);
  const aC1 = Math.atan2(kR[1] - cC[1], kR[0] - cC[0]);
  const aR = Math.atan2(kR[1] - cR[1], kR[0] - cR[0]);
  const left = arcPts(cL[0], cL[1], sideR, Math.PI, Math.PI * 2 + aL);
  const mid = arcPts(cC[0], cC[1], centreR, Math.PI * 2 + aC0, Math.PI * 2 + aC1 + (aC1 < aC0 ? Math.PI * 2 : 0));
  const right = arcPts(cR[0], cR[1], sideR, aR, 0);
  return dedupe([...left, ...mid, ...right]);
}

/** Ogee: a convex sweep up from each springer that turns concave into a pointed tip. */
export function ogeeArch(springY, r1, r2) {
  const c1 = [LEFT + r1, springY];
  const top1 = [c1[0], springY - r1];
  const c2 = [top1[0], top1[1] - r2];
  const left = [...arcPts(c1[0], c1[1], r1, Math.PI, Math.PI * 1.5), ...arcPts(c2[0], c2[1], r2, Math.PI / 2, 0)];
  // Stop the concave part where it reaches the centre line.
  const midX = (LEFT + RIGHT) / 2;
  const cut = left.filter(([x]) => x <= midX - 2);
  const tipY = cut[cut.length - 1][1];
  const half = [...cut, [midX, tipY - 6]];
  const right = cut.map(([x, y]) => [LEFT + RIGHT - x, y]).reverse();
  return dedupe([...half, ...right]);
}

// ---- The lower playfield, shared by every table ----

export function lowerPlayfield() {
  const L = {};
  // Outer walls below the arch: the left wall, the apron under the left flipper,
  // and the mirror on the right (whose outer boundary is the shooter lane wall).
  L.leftWall = [[LEFT, 880], [180, 1010], [180, 1090]];
  L.rightApron = [[LANE_X, 880], [mx(180), 1010], [mx(180), 1090]];
  // Inlane guides: separate the outlane (outside) from the inlane (inside).
  L.leftGuide = [[62, 700], [62, 860], [186, 930]];
  L.rightGuide = L.leftGuide.map(([x, y]) => [mx(x), y]);
  // Slingshots: triangles A (top), B (bottom outer), C (bottom inner). The A-C face kicks.
  L.slings = [
    { a: [104, 730], b: [104, 830], c: [172, 874], side: 'left' },
    { a: [mx(104), 730], b: [mx(104), 830], c: [mx(172), 874], side: 'right' },
  ];
  L.flippers = [
    { x: 199, y: 948, side: 'left', rest: 0.52, up: -0.46 },
    { x: mx(199), y: 948, side: 'right', rest: Math.PI - 0.52, up: Math.PI + 0.46 },
  ];
  // Rollover sensors in the inlanes and outlanes.
  L.inlanes = [
    { x: 83, y: 790, side: 'left' },
    { x: mx(83), y: 790, side: 'right' },
  ];
  L.outlanes = [
    { x: 41, y: 790, side: 'left' },
    { x: mx(41), y: 790, side: 'right' },
  ];
  // Rubber posts at the tops of the guides.
  L.posts = [
    { x: 62, y: 700, r: 5 },
    { x: mx(62), y: 700, r: 5 },
  ];
  // Shooter lane.
  L.laneWall = [[LANE_X, 1090], [LANE_X, LANE_TOP]];
  L.laneGate = { a: [RIGHT, LANE_TOP - 44], b: [LANE_X, LANE_TOP] };
  L.plunger = { x: PLUNGER_X, y: PLUNGER_REST_Y, x0: LANE_X + 1, x1: RIGHT - 1 };
  return L;
}

/**
 * The glass outline: the arch, then down the right side to the shooter lane gate,
 * down the lane wall to the sill, across, and back up the left wall.
 */
export function glassOutline(arch) {
  const pts = [[LEFT, GLASS_BOTTOM], ...arch];
  const last = arch[arch.length - 1];
  if (last[1] < LANE_TOP - 44) pts.push([RIGHT, LANE_TOP - 44]);
  pts.push([LANE_X, LANE_TOP], [LANE_X, GLASS_BOTTOM]);
  return pts;
}

/** The arch as physics wall: from the left wall top, over the arch, down to the lane. */
export function archWall(arch) {
  const pts = [[LEFT, 880], ...arch];
  const last = arch[arch.length - 1];
  pts.push([RIGHT, Math.max(last[1], 1090)]);
  return pts;
}

/** Point-in-polygon (even-odd). */
export function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
