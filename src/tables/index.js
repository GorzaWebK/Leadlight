// The five windows of a run, in order, with their glass cut and lead graph built.
import dawn from './dawn.js';
import saints from './saints.js';
import orchard from './orchard.js';
import tempest from './tempest.js';
import rose from './rose.js';
import { buildPanes } from './panes.js';

const defs = [dawn, saints, orchard, tempest, rose];

defs.forEach((d, i) => {
  d.index = i;
  d.glass = buildPanes(d.outline, d.glass);
  d.panes = d.glass.panes;
});

export const TABLES = defs;
export const TABLE_BY_ID = Object.fromEntries(defs.map((d) => [d.id, d]));
