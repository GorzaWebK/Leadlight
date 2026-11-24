// IV. Tempest — an ogee arch in storm blues and violet. Feature: gusts of wind bend the
// ball's path across the upper glass. Strike the lightning rod mid-gust for a thunderclap.
import { ogeeArch, glassOutline, LEFT, LANE_X } from './common.js';
import { above, below } from './zones.js';

const arch = ogeeArch(330, 150, 150);

// 0 storm cobalt, 1 violet, 2 teal, 3 silver, 4 indigo, 5 lightning gold
export default {
  id: 'tempest',
  name: 'Tempest',
  numeral: 'IV',
  epithet: 'The Window of Storms',
  blurb: 'Wind gusts across the upper glass and bends the ball. Hit the lightning rod mid-gust for a thunderclap.',
  palette: ['#1f3aa8', '#5a2aa0', '#14868a', '#aab8d0', '#2a1f70', '#e8c040'],
  sky: '#9fb4ff',
  arch,
  skillPull: [0.455, 0.491], // plunger band that reaches the top lanes (tools/skill.mjs)
  outline: glassOutline(arch),
  wind: { firstCalm: 7, gust: 4.2, calm: 8, calmRand: 6, strength: 440, below: 700 },
  bumpers: [
    { x: 230, y: 380, r: 25 },
    { x: 410, y: 380, r: 25 },
    { x: 320, y: 460, r: 25 },
  ],
  targets: [
    { a: [304, 132], b: [336, 132], rod: true },
    { a: [34, 560], b: [34, 600], set: 'left' },
    { a: [34, 615], b: [34, 655], set: 'left' },
  ],
  laneGuides: [
    [188, 276, 322],
    [440, 276, 322],
  ],
  lanes: [
    { x: 160, y: 300 },
    { x: 468, y: 300 },
    { x: 520, y: 360 },
  ],
  spinners: [
    { x: 50, y: 520, len: 56, angle: 0 },
    { x: 548, y: 520, len: 56, angle: 0 },
  ],
  drops: [
    { a: [214, 612], b: [246, 612], bank: 'storm' },
    { a: [283, 606], b: [315, 606], bank: 'storm' },
    { a: [352, 612], b: [384, 612], bank: 'storm' },
  ],
  posts: [{ x: 120, y: 420, r: 6 }, { x: 478, y: 420, r: 6 }],
  stones: [[[20, 538], [38, 556]]],
  bankText: 'The storm breaks',
  glass: [
    {
      type: 'rose',
      cx: 320,
      cy: 300,
      rings: [{ r: 34, n: 1 }, { r: 86, n: 8 }, { r: 150, n: 16 }],
      outer: { r: 700, n: 16 },
      clip: [above(500)],
      colour: ({ ring, sector }) => [[5], [1, 2], [0, 4, 0, 3], [4, 0, 1, 0]][ring][sector % [1, 2, 4, 4][ring]],
    },
    {
      // Slanted panes like driven rain.
      type: 'lattice',
      w: 70,
      h: 58,
      skewCell: 0.45,
      skew: 0.45,
      ox: LEFT,
      oy: 500,
      clip: [below(500)],
      colour: ({ i, j }) => ((((i + j) % 5) + 5) % 5 === 0 ? 3 : (((i - j) % 3) + 3) % 3 === 0 ? 1 : j % 2 ? 0 : 4),
    },
  ],
  _laneX: LANE_X,
};
