import { describe, it, expect } from 'vitest';
import { WindowLight } from '../src/game/lighting.js';
import { buildPanes, leadPath, pointInPane } from '../src/tables/panes.js';
import { TABLES } from '../src/tables/index.js';

const square = [[0, 0], [400, 0], [400, 400], [0, 400]];

describe('pane cutting', () => {
  it('cuts a window into panes that cover it exactly', () => {
    const g = buildPanes(square, [{ type: 'lattice', w: 100, h: 100 }]);
    expect(g.panes.length).toBe(16);
    const area = g.panes.reduce((s, p) => s + p.area, 0);
    expect(area).toBeCloseTo(400 * 400, 0);
  });

  it('every pane in every window has neighbours and the lead connects them all', () => {
    for (const t of TABLES) {
      const { panes, verts, adj } = t.glass;
      expect(panes.length).toBeGreaterThan(50);
      for (const p of panes) expect(p.neighbours.length).toBeGreaterThan(0);
      // Flood the lead graph from vertex 0: every vertex is reachable.
      const seen = new Set([0]);
      const stack = [0];
      while (stack.length) for (const [v] of adj[stack.pop()]) if (!seen.has(v)) seen.add(v), stack.push(v);
      expect(seen.size).toBe(verts.length);
    }
  });

  it('rose rings meet without gaps', () => {
    const g = buildPanes(square, [{ type: 'rose', cx: 200, cy: 200, rings: [{ r: 40, n: 1 }, { r: 100, n: 8 }, { r: 180, n: 16, split: true }], outer: { r: 900, n: 16 } }]);
    const area = g.panes.reduce((s, p) => s + p.area, 0);
    expect(area).toBeCloseTo(400 * 400, -1);
  });

  it('light can travel along the lead from a point to any pane', () => {
    const t = TABLES[0];
    const p = t.panes[t.panes.length - 1];
    const path = leadPath(t.glass, 300, 400, p);
    expect(path.length).toBeGreaterThan(2);
    const end = path[path.length - 1];
    expect(p.poly.some((v) => v === end)).toBe(true);
  });

  it('finds the pane under a point', () => {
    const t = TABLES[0];
    const p = t.panes[10];
    expect(pointInPane(p, p.cx, p.cy)).toBe(true);
  });
});

describe('lighting', () => {
  const g = buildPanes(square, [{ type: 'lattice', w: 100, h: 100 }]);

  it('a hit lights the nearest dark panes first', () => {
    const L = new WindowLight(g.panes);
    const lit = L.lightNear(10, 10, 1);
    expect(lit.length).toBe(1);
    expect(g.panes[lit[0]].cx).toBeCloseTo(50);
    expect(g.panes[lit[0]].cy).toBeCloseTo(50);
    // The same spot again lights the next nearest instead.
    const next = L.lightNear(10, 10, 1);
    expect(next[0]).not.toBe(lit[0]);
  });

  it('twin panes light a neighbour with each pane', () => {
    const L = new WindowLight(g.panes);
    L.twin = true;
    const lit = L.lightNear(10, 10, 1);
    expect(lit.length).toBe(2);
    expect(g.panes[lit[0]].neighbours).toContain(lit[1]);
  });

  it('the window is complete when every pane is lit, and can be dimmed again', () => {
    const L = new WindowLight(g.panes);
    L.lightAll(200, 200);
    expect(L.complete).toBe(true);
    expect(L.fraction).toBe(1);
    L.reset();
    expect(L.count).toBe(0);
  });

  it('a far bolt prefers distant panes', () => {
    const L = new WindowLight(g.panes);
    const [i] = L.lightFar(0, 0, () => 0);
    expect(Math.hypot(g.panes[i].cx, g.panes[i].cy)).toBeGreaterThan(400);
  });
});
