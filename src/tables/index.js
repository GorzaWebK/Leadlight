// The five windows of a run, in order, with their glass cut and lead graph built.
import dawn from './dawn.js';
import { buildPanes } from './panes.js';

const defs = [dawn];

for (const d of defs) {
  d.glass = buildPanes(d.outline, d.glass);
  d.panes = d.glass.panes;
}

export const TABLES = defs;
export const TABLE_BY_ID = Object.fromEntries(defs.map((d) => [d.id, d]));
