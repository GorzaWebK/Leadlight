// Which panes of the window are lit. Pure logic: the renderer animates the rest.
//
// A hit lights the nearest *unlit* panes to where it happened, so light creeps
// outwards from each fixture as the window fills, and no pane is ever unreachable.

export class WindowLight {
  /** @param {Array<{cx:number, cy:number, neighbours:number[]}>} panes */
  constructor(panes) {
    this.panes = panes;
    this.lit = new Uint8Array(panes.length);
    this.count = 0;
    this.twin = false; // relic: each pane brings an unlit neighbour with it
  }

  get total() {
    return this.panes.length;
  }
  get fraction() {
    return this.total ? this.count / this.total : 1;
  }
  get complete() {
    return this.count >= this.total;
  }

  isLit(i) {
    return this.lit[i] === 1;
  }

  light(i) {
    if (this.lit[i]) return false;
    this.lit[i] = 1;
    this.count++;
    return true;
  }

  /** Unlit panes sorted by distance from (x, y). */
  nearestUnlit(x, y, n, filter) {
    const cand = [];
    for (let i = 0; i < this.panes.length; i++) {
      if (this.lit[i]) continue;
      if (filter && !filter(i)) continue;
      const p = this.panes[i];
      cand.push([i, (p.cx - x) ** 2 + (p.cy - y) ** 2]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    return cand.slice(0, n).map((c) => c[0]);
  }

  /**
   * Light up to n panes nearest to (x, y). Returns the newly lit pane ids in order,
   * including twins (each twin follows the pane that brought it).
   */
  lightNear(x, y, n = 1) {
    const out = [];
    for (const i of this.nearestUnlit(x, y, n)) {
      if (this.light(i)) out.push(i);
      if (this.twin) {
        const p = this.panes[i];
        let best = -1;
        let bd = Infinity;
        for (const j of p.neighbours) {
          if (this.lit[j]) continue;
          const q = this.panes[j];
          const d = (q.cx - x) ** 2 + (q.cy - y) ** 2;
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
        if (best < 0) {
          const far = this.nearestUnlit(p.cx, p.cy, 1);
          best = far.length ? far[0] : -1;
        }
        if (best >= 0 && this.light(best)) out.push(best);
      }
    }
    return out;
  }

  /** Light one random unlit pane, preferring ones far from (x, y). */
  lightFar(x, y, rand = Math.random) {
    const cand = [];
    for (let i = 0; i < this.panes.length; i++) {
      if (this.lit[i]) continue;
      const p = this.panes[i];
      cand.push([i, Math.hypot(p.cx - x, p.cy - y)]);
    }
    if (!cand.length) return [];
    cand.sort((a, b) => b[1] - a[1]);
    const pick = cand[Math.floor(rand() * Math.min(cand.length, Math.max(3, cand.length / 3)))][0];
    this.light(pick);
    return [pick];
  }

  /** The pane under a point (or -1). */
  paneAt(x, y, containsFn) {
    for (let i = 0; i < this.panes.length; i++) if (containsFn(this.panes[i], x, y)) return i;
    return -1;
  }

  /** Light every remaining pane, nearest first. */
  lightAll(x, y) {
    return this.lightNear(x, y, this.total);
  }

  /** Dim the window again (single-window renewals). */
  reset() {
    this.lit.fill(0);
    this.count = 0;
  }
}
