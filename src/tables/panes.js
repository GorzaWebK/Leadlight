// Cuts a window into glass panes and builds the lead (came) network between them.
//
// A window design is a list of zones. Each zone is a convex region (an intersection of
// half-planes) filled with a pattern of convex cells: rose rings, a rectangular or
// diamond lattice, honeycomb, lancet panels or slanted rain panes. Each pane is the
// window outline clipped by one cell (Sutherland–Hodgman; the outline may be concave,
// the clipping cell is always convex).
//
// Vertices are welded so neighbouring panes share them. The lead graph is every pane
// edge, split wherever another pane's vertex lies on it, so light can travel along
// the lead from any pane to any other.

const EPS = 0.35;

// ---- Polygon helpers ----

export function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return a / 2; // sign depends on winding
}

export function centroid(p) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    cx += (p[j][0] + p[i][0]) * f;
    cy += (p[j][1] + p[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = p.length;
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Keep the part of polygon p where a*x + b*y <= c. */
export function clipHalf(p, a, b, c) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const P = p[i];
    const Q = p[(i + 1) % p.length];
    const dp = a * P[0] + b * P[1] - c;
    const dq = a * Q[0] + b * Q[1] - c;
    if (dp <= 0) out.push(P);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
    }
  }
  return out;
}

/** Half-planes (a, b, c) of a convex polygon, keeping its inside. */
export function halfPlanesOf(poly) {
  const s = Math.sign(polyArea(poly)) || 1;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % poly.length];
    // For counter-clockwise (positive area in y-down maths), inside is to the left.
    let a = Q[1] - P[1];
    let b = -(Q[0] - P[0]);
    if (s < 0) {
      a = -a;
      b = -b;
    }
    const c = a * P[0] + b * P[1];
    out.push([-a, -b, -c]);
  }
  return out;
}

/** Clip a (possibly concave) subject by a convex clip polygon. */
export function clipConvex(subject, clip) {
  let out = subject;
  for (const [a, b, c] of halfPlanesOf(clip)) {
    if (!out.length) break;
    out = clipHalf(out, a, b, c);
  }
  return out;
}

function clean(p) {
  const out = [];
  for (const q of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > EPS * 2) out.push(q);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= EPS * 2) out.pop();
  // Drop collinear points.
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const A = out[(i - 1 + out.length) % out.length];
    const B = out[i];
    const C = out[(i + 1) % out.length];
    const cross = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]);
    if (Math.abs(cross) > 0.05) res.push(B);
  }
  return res;
}

export function pointInPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function pointInPane(p, x, y) {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;
  return pointInPoly(p.poly, x, y);
}

// ---- Cell patterns ----

function ringPoint(cx, cy, r, a) {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/**
 * Rose cells. rings: [{ r, n, split? }], innermost first. Ring 0 with n = 1 is the
 * central disc. Each ring's n must divide the next ring's n so lead lines meet.
 * `outer`: { n, r } adds sectors from the last ring out to r (the spandrels).
 */
function roseCells(z) {
  const { cx, cy, rings } = z;
  const rot = z.rot ?? -Math.PI / 2;
  const cells = [];
  const all = z.outer ? [...rings, z.outer] : rings;
  for (let k = 0; k < all.length; k++) {
    const ring = all[k];
    const r0 = k === 0 ? 0 : all[k - 1].r;
    const r1 = ring.r;
    const next = all[k + 1];
    const outerRes = next ? next.n : Math.max(ring.n * 4, 64);
    const per = outerRes / ring.n; // outer chords per cell
    const n = ring.n;
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2 + (ring.offset ?? 0);
      const a1 = rot + ((i + 1) / n) * Math.PI * 2 + (ring.offset ?? 0);
      const poly = [];
      if (n === 1) {
        for (let j = 0; j < outerRes; j++) poly.push(ringPoint(cx, cy, r1, rot + (j / outerRes) * Math.PI * 2));
        cells.push({ poly, info: { ring: k, sector: 0, n } });
        continue;
      }
      if (r0 === 0) poly.push([cx, cy]);
      else {
        poly.push(ringPoint(cx, cy, r0, a0));
        poly.push(ringPoint(cx, cy, r0, a1));
      }
      if (r0 === 0) {
        for (let j = 0; j <= per; j++) poly.push(ringPoint(cx, cy, r1, a0 + ((a1 - a0) * j) / per));
      } else {
        for (let j = per; j >= 0; j--) poly.push(ringPoint(cx, cy, r1, a0 + ((a1 - a0) * j) / per));
      }
      if (ring.split && r0 > 0 && per % 2 === 0) {
        // Split the cell down its middle into two convex halves that share its inner chord.
        const am = (a0 + a1) / 2;
        const P0 = ringPoint(cx, cy, r0, a0);
        const P1 = ringPoint(cx, cy, r0, a1);
        const mi = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2];
        const m = per / 2;
        const left = [P0, mi];
        for (let j = m; j >= 0; j--) left.push(ringPoint(cx, cy, r1, a0 + ((am - a0) * j) / m));
        const right = [mi, P1];
        for (let j = m; j >= 0; j--) right.push(ringPoint(cx, cy, r1, am + ((a1 - am) * j) / m));
        cells.push({ poly: left, info: { ring: k, sector: i * 2, n: n * 2 } });
        cells.push({ poly: right, info: { ring: k, sector: i * 2 + 1, n: n * 2 } });
        continue;
      }
      cells.push({ poly, info: { ring: k, sector: i, n } });
    }
  }
  return cells;
}

/** A rotated rectangular lattice. With angle 45° it's the classic diamond quarry. */
function latticeCells(z, bbox) {
  const w = z.w;
  const h = z.h ?? z.w;
  const ang = z.angle ?? 0;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const ox = z.ox ?? 0;
  const oy = z.oy ?? 0;
  const toWorld = (u, v) => [ox + u * ca - v * sa, oy + u * sa + v * ca];
  // Bounds in lattice space.
  const corners = [
    [bbox.x0, bbox.y0],
    [bbox.x1, bbox.y0],
    [bbox.x0, bbox.y1],
    [bbox.x1, bbox.y1],
  ].map(([x, y]) => [(x - ox) * ca + (y - oy) * sa, -(x - ox) * sa + (y - oy) * ca]);
  const u0 = Math.min(...corners.map((c) => c[0]));
  const u1 = Math.max(...corners.map((c) => c[0]));
  const v0 = Math.min(...corners.map((c) => c[1]));
  const v1 = Math.max(...corners.map((c) => c[1]));
  const cells = [];
  for (let j = Math.floor(v0 / h) - 1; j <= Math.ceil(v1 / h); j++) {
    const shift = z.brick && j % 2 ? w / 2 : 0;
    const skew = (z.skew ?? 0) * j * h;
    for (let i = Math.floor((u0 - skew) / w) - 2; i <= Math.ceil((u1 - skew) / w) + 1; i++) {
      const u = i * w + shift + skew;
      const v = j * h;
      const k = z.skewCell ?? 0;
      cells.push({
        poly: [toWorld(u, v), toWorld(u + w, v), toWorld(u + w + k * h, v + h), toWorld(u + k * h, v + h)],
        info: { i, j },
      });
    }
  }
  return cells;
}

function hexCells(z, bbox) {
  const s = z.size;
  const w = Math.sqrt(3) * s;
  const cells = [];
  const ox = z.ox ?? 0;
  const oy = z.oy ?? 0;
  for (let j = Math.floor((bbox.y0 - oy) / (1.5 * s)) - 1; j <= Math.ceil((bbox.y1 - oy) / (1.5 * s)) + 1; j++) {
    for (let i = Math.floor((bbox.x0 - ox) / w) - 1; i <= Math.ceil((bbox.x1 - ox) / w) + 1; i++) {
      const cx = ox + i * w + (j % 2 ? w / 2 : 0);
      const cy = oy + j * 1.5 * s;
      const poly = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        poly.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s]);
      }
      cells.push({ poly, info: { i, j } });
    }
  }
  return cells;
}

/** Lancets: columns between mullions, cut into stacked panels. */
function lancetCells(z) {
  const cells = [];
  const cols = z.cols; // x boundaries
  for (let c = 0; c < cols.length - 1; c++) {
    const xa = cols[c];
    const xb = cols[c + 1];
    const rows = z.rows; // y boundaries
    const off = (z.stagger ?? 0) * (c % 2);
    for (let r = -1; r < rows.length; r++) {
      const ya = (r < 0 ? rows[0] - 2000 : rows[r]) + (r < 0 ? 0 : off);
      const yb = r + 1 < rows.length ? rows[r + 1] + off : rows[rows.length - 1] + 2000;
      if (z.diamond && r >= 0 && r + 1 < rows.length) {
        // A diamond in the middle of the panel and four corner pieces.
        const mxp = (xa + xb) / 2;
        const myp = (ya + yb) / 2;
        cells.push({ poly: [[mxp, ya], [xb, myp], [mxp, yb], [xa, myp]], info: { col: c, row: r, part: 'diamond' } });
        cells.push({ poly: [[xa, ya], [mxp, ya], [xa, myp]], info: { col: c, row: r, part: 'corner' } });
        cells.push({ poly: [[mxp, ya], [xb, ya], [xb, myp]], info: { col: c, row: r, part: 'corner' } });
        cells.push({ poly: [[xb, myp], [xb, yb], [mxp, yb]], info: { col: c, row: r, part: 'corner' } });
        cells.push({ poly: [[xa, myp], [mxp, yb], [xa, yb]], info: { col: c, row: r, part: 'corner' } });
      } else {
        cells.push({ poly: [[xa, ya], [xb, ya], [xb, yb], [xa, yb]], info: { col: c, row: r } });
      }
    }
  }
  return cells;
}

function zoneCells(z, bbox) {
  if (z.type === 'rose') return roseCells(z);
  if (z.type === 'lattice') return latticeCells(z, bbox);
  if (z.type === 'hex') return hexCells(z, bbox);
  if (z.type === 'lancets') return lancetCells(z);
  throw new Error('unknown zone ' + z.type);
}

// ---- Building a window ----

/**
 * @param {number[][]} outline the glass outline
 * @param {object[]} zones each { type, ..., clip: [[a, b, c], ...] half-planes a*x+b*y<=c,
 *   colour: (info, cx, cy) => palette index, minArea }
 */
export function buildPanes(outline, zones) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const bbox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const raw = [];
  zones.forEach((z, zi) => {
    for (const cell of zoneCells(z, bbox)) {
      let clip = cell.poly;
      for (const [a, b, c] of z.clip || []) {
        clip = clipHalf(clip, a, b, c);
        if (clip.length < 3) break;
      }
      clip = clean(clip);
      if (clip.length < 3 || Math.abs(polyArea(clip)) < 1) continue;
      let poly = clean(clipConvex(outline, clip));
      if (poly.length < 3) continue;
      const area = Math.abs(polyArea(poly));
      if (area < (z.minArea ?? 90)) continue;
      const [cx, cy] = centroid(poly);
      raw.push({ poly, area, cx, cy, zone: zi, info: cell.info });
    }
  });

  // Weld vertices onto a shared list.
  const verts = [];
  const key = new Map();
  const weld = (x, y) => {
    const kx = Math.round(x / 0.75);
    const ky = Math.round(y / 0.75);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const k = key.get((kx + dx) * 100003 + (ky + dy));
        if (k !== undefined && Math.hypot(verts[k][0] - x, verts[k][1] - y) < 1.2) return k;
      }
    const id = verts.length;
    verts.push([x, y]);
    key.set(kx * 100003 + ky, id);
    return id;
  };
  const panes = raw.map((r, i) => {
    const vi = r.poly.map(([x, y]) => weld(x, y));
    const poly = vi.map((k) => verts[k]);
    const xs2 = poly.map((p) => p[0]);
    const ys2 = poly.map((p) => p[1]);
    const z = zones[r.zone];
    return {
      id: i,
      poly,
      vi,
      cx: r.cx,
      cy: r.cy,
      area: r.area,
      x0: Math.min(...xs2),
      y0: Math.min(...ys2),
      x1: Math.max(...xs2),
      y1: Math.max(...ys2),
      zone: r.zone,
      info: r.info,
      colour: z.colour ? z.colour(r.info, r.cx, r.cy) : 0,
      neighbours: [],
    };
  });

  // Lead graph: edges split at any welded vertex lying on them (T-junctions).
  const edges = new Map();
  const addEdge = (a, b) => {
    if (a === b) return;
    const k = a < b ? a * 1e6 + b : b * 1e6 + a;
    if (!edges.has(k)) edges.set(k, [Math.min(a, b), Math.max(a, b)]);
  };
  const grid = new Map();
  const G = 40;
  verts.forEach((v, i) => {
    const k = Math.floor(v[0] / G) * 1000 + Math.floor(v[1] / G);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const near = (x0, y0, x1, y1) => {
    const out = [];
    for (let gx = Math.floor(Math.min(x0, x1) / G); gx <= Math.floor(Math.max(x0, x1) / G); gx++)
      for (let gy = Math.floor(Math.min(y0, y1) / G); gy <= Math.floor(Math.max(y0, y1) / G); gy++) {
        const l = grid.get(gx * 1000 + gy);
        if (l) out.push(...l);
      }
    return out;
  };
  const paneEdges = panes.map(() => []);
  panes.forEach((p, pi) => {
    for (let i = 0; i < p.vi.length; i++) {
      const a = p.vi[i];
      const b = p.vi[(i + 1) % p.vi.length];
      const A = verts[a];
      const B = verts[b];
      const ex = B[0] - A[0];
      const ey = B[1] - A[1];
      const l2 = ex * ex + ey * ey;
      const on = [];
      for (const k of near(A[0], A[1], B[0], B[1])) {
        if (k === a || k === b) continue;
        const V = verts[k];
        const t = ((V[0] - A[0]) * ex + (V[1] - A[1]) * ey) / l2;
        if (t <= 0.001 || t >= 0.999) continue;
        const d = Math.abs((V[0] - A[0]) * ey - (V[1] - A[1]) * ex) / Math.sqrt(l2);
        if (d < 0.8) on.push([t, k]);
      }
      on.sort((x, y) => x[0] - y[0]);
      const chainV = [a, ...on.map((o) => o[1]), b];
      for (let j = 0; j < chainV.length - 1; j++) {
        addEdge(chainV[j], chainV[j + 1]);
        paneEdges[pi].push(chainV[j] < chainV[j + 1] ? chainV[j] * 1e6 + chainV[j + 1] : chainV[j + 1] * 1e6 + chainV[j]);
      }
    }
  });
  // Neighbours share at least one lead edge.
  const owner = new Map();
  paneEdges.forEach((list, pi) => {
    for (const k of list) {
      if (!owner.has(k)) owner.set(k, []);
      owner.get(k).push(pi);
    }
  });
  for (const list of owner.values()) {
    for (const a of list)
      for (const b of list) if (a !== b && !panes[a].neighbours.includes(b)) panes[a].neighbours.push(b);
  }
  const adj = verts.map(() => []);
  for (const [a, b] of edges.values()) {
    const d = Math.hypot(verts[a][0] - verts[b][0], verts[a][1] - verts[b][1]);
    adj[a].push([b, d]);
    adj[b].push([a, d]);
  }
  // Edges on the outline border (only one pane) are the window frame.
  const border = new Set();
  for (const [k, list] of owner) if (list.length === 1) border.add(k);
  return { panes, verts, edges: [...edges.values()], adj, border, bbox };
}

/** Shortest path along the lead from the vertex nearest (x, y) to any vertex of pane p. */
export function leadPath(glass, x, y, pane) {
  const { verts, adj } = glass;
  let start = -1;
  let bd = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const d = (verts[i][0] - x) ** 2 + (verts[i][1] - y) ** 2;
    if (d < bd) {
      bd = d;
      start = i;
    }
  }
  const goal = new Set(pane.vi);
  const dist = new Float64Array(verts.length).fill(Infinity);
  const prev = new Int32Array(verts.length).fill(-1);
  dist[start] = 0;
  // A small binary heap.
  const heap = [[0, start]];
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  let found = -1;
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    if (goal.has(u)) {
      found = u;
      break;
    }
    for (const [v, w] of adj[u]) {
      const nd = d + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        push([nd, v]);
      }
    }
  }
  const pts = [[x, y]];
  if (found < 0) return pts.concat([[pane.cx, pane.cy]]);
  const path = [];
  for (let v = found; v >= 0; v = prev[v]) path.push(verts[v]);
  path.reverse();
  return pts.concat(path);
}
