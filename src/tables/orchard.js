// III. Orchard — a trefoil head in emerald, leaf and apple red. Feature: clear the
// three apples and the scoop opens onto the hidden root cellar beneath the window.
import { trefoilArch, glassOutline } from './common.js';
import { above, below, closer } from './zones.js';

const arch = trefoilArch(330, 130, 205, 150);
const L = [150, 340];
const C = [320, 215];
const R = [490, 340];

// 0 emerald, 1 leaf, 2 apple red, 3 amber, 4 plum, 5 pale green
export default {
  id: 'orchard',
  name: 'Orchard',
  numeral: 'III',
  epithet: 'The Tree of Roots',
  blurb: 'Knock down the three apples, then find the scoop: it drops the light into the root cellar below.',
  palette: ['#128a4c', '#4f9e28', '#c0202e', '#e09018', '#6a2a7a', '#9cc865'],
  sky: '#f0c060',
  arch,
  skillPull: [0.782, 0.836], // plunger band that reaches the top lanes (tools/skill.mjs)
  outline: glassOutline(arch),
  bumpers: [
    { x: 215, y: 455, r: 25 },
    { x: 335, y: 500, r: 25 },
    { x: 452, y: 430, r: 25 },
  ],
  // Open rollovers (no guides) right in the path of a plunged ball.
  lanes: [
    { x: 252, y: 252 },
    { x: 322, y: 246 },
    { x: 392, y: 252 },
  ],
  drops: [
    { a: [214, 318], b: [244, 306], bank: 'apples' },
    { a: [268, 300], b: [300, 298], bank: 'apples' },
    { a: [324, 298], b: [356, 300], bank: 'apples' },
  ],
  scoop: {
    // A mouth cut into the left wall: a sloped roof the ball rolls off, and a floor.
    x: 40,
    y: 524,
    eject: -0.75,
    ejectSpeed: 1350,
    walls: [
      [[20, 486], [70, 500]],
      [[20, 560], [72, 548]],
    ],
  },
  cellarBank: 'apples',
  cellarOpenText: 'The cellar door opens',
  cellarText: 'The roots drink the light',
  cellar: {
    rect: { x0: 140, y0: 1112, x1: 460, y1: 1400 },
    entry: { x: 300, y: 1140 },
    label: 'RADIX',
    walls: [
      [[150, 1112], [450, 1112]],
      [[150, 1112], [150, 1320], [282, 1388]],
      [[450, 1112], [450, 1320], [318, 1388]],
      [[282, 1388], [318, 1388]],
    ],
    pegs: [
      { x: 230, y: 1180 }, { x: 300, y: 1170 }, { x: 370, y: 1180 },
      { x: 195, y: 1240 }, { x: 265, y: 1235 }, { x: 335, y: 1235 }, { x: 405, y: 1240 },
      { x: 230, y: 1295 }, { x: 300, y: 1290 }, { x: 370, y: 1295 },
    ],
    cup: { x: 300, y: 1374 },
    top: 1112,
  },
  spinners: [{ x: 549, y: 560, len: 54, angle: 0 }],
  targets: [
    { a: [34, 615], b: [34, 655], set: 'left' },
  ],
  stones: [[[20, 593], [38, 611]]],
  bankText: 'The apples fall',
  glass: [
    {
      type: 'rose', cx: L[0], cy: L[1],
      rings: [{ r: 30, n: 1 }, { r: 72, n: 6 }, { r: 116, n: 12 }],
      outer: { r: 600, n: 12 },
      clip: [above(480), closer(L, C), closer(L, R)],
      colour: ({ ring, sector }) => [[3], [2, 0], [0, 1, 0, 5], [1, 0]][ring][sector % [1, 2, 4, 2][ring]],
    },
    {
      type: 'rose', cx: C[0], cy: C[1],
      rings: [{ r: 36, n: 1 }, { r: 84, n: 8 }, { r: 136, n: 16 }],
      outer: { r: 600, n: 16 },
      clip: [above(480), closer(C, L), closer(C, R)],
      colour: ({ ring, sector }) => [[3], [2, 4], [0, 1, 0, 2], [5, 0]][ring][sector % [1, 2, 4, 2][ring]],
    },
    {
      type: 'rose', cx: R[0], cy: R[1],
      rings: [{ r: 30, n: 1 }, { r: 72, n: 6 }, { r: 116, n: 12 }],
      outer: { r: 600, n: 12 },
      clip: [above(480), closer(R, C), closer(R, L)],
      colour: ({ ring, sector }) => [[3], [2, 0], [0, 1, 0, 5], [1, 0]][ring][sector % [1, 2, 4, 2][ring]],
    },
    {
      type: 'hex',
      size: 54,
      ox: 299,
      oy: 520,
      clip: [below(480)],
      colour: ({ i, j }) => ((((i * 3 + j * 5) % 7) + 7) % 7 === 0 ? 2 : (((i + j) % 3) + 3) % 3 === 0 ? 1 : (((i - 2 * j) % 5) + 5) % 5 === 0 ? 3 : 0),
    },
  ],
};
