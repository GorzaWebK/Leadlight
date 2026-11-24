// V. Rose — the great round rose in every jewel colour. It brings everything together:
// the turning rosette, two bells, gusts of wind and the cellar below.
import { roundArch, glassOutline, LEFT, LANE_X } from './common.js';
import { above, below } from './zones.js';

const arch = roundArch(360);

// 0 ruby, 1 cobalt, 2 emerald, 3 amber, 4 violet, 5 gold
export default {
  id: 'rose',
  name: 'Rose',
  numeral: 'V',
  epithet: 'The Great Rose',
  blurb: 'Everything at once: the turning rosette, two bells, the wind and the cellar beneath.',
  palette: ['#b81834', '#2443b8', '#138a52', '#e09018', '#6a2db0', '#e2bc44'],
  sky: '#ff9a6a',
  arch,
  skillPull: [0.436, 0.482], // plunger band that reaches the top lanes (tools/skill.mjs)
  outline: glassOutline(arch),
  rotor: { x: 299, y: 440, hub: 24, arm: 50, lobes: 6, lobe: 12, w: 1.1 },
  bells: [
    { x: 172, y: 236, len: 44, note: 0 },
    { x: 426, y: 236, len: 44, note: 4 },
  ],
  wind: { firstCalm: 12, gust: 3.2, calm: 13, calmRand: 8, strength: 320, below: 650 },
  bumpers: [
    { x: 168, y: 560, r: 25 },
    { x: 420, y: 600, r: 25 },
  ],
  laneGuides: [
    [362, 150, 198],
    [420, 152, 198],
  ],
  lanes: [
    { x: 333, y: 174 },
    { x: 391, y: 174 },
    { x: 449, y: 178 },
  ],
  scoop: {
    // A mouth cut into the right wall, roof sloping down into the playfield.
    x: 558,
    y: 478,
    eject: -2.35,
    ejectSpeed: 1300,
    walls: [
      [[578, 440], [528, 454]],
      [[578, 516], [530, 504]],
    ],
  },
  cellarBank: 'relic',
  cellarOpenText: 'The crypt is open',
  cellarText: 'The crypt fills with light',
  cellar: {
    rect: { x0: 140, y0: 1112, x1: 460, y1: 1400 },
    entry: { x: 300, y: 1140 },
    label: 'CRYPTA',
    walls: [
      [[150, 1112], [450, 1112]],
      [[150, 1112], [150, 1320], [282, 1388]],
      [[450, 1112], [450, 1320], [318, 1388]],
      [[282, 1388], [318, 1388]],
    ],
    pegs: [
      { x: 210, y: 1185 }, { x: 300, y: 1175 }, { x: 390, y: 1185 },
      { x: 255, y: 1245 }, { x: 345, y: 1245 },
      { x: 210, y: 1300 }, { x: 300, y: 1295 }, { x: 390, y: 1300 },
    ],
    cup: { x: 300, y: 1374 },
    top: 1112,
  },
  spinners: [{ x: 50, y: 470, len: 56, angle: 0 }],
  drops: [
    { a: [36, 540], b: [36, 572], bank: 'relic' },
    { a: [36, 585], b: [36, 617], bank: 'relic' },
    { a: [36, 630], b: [36, 662], bank: 'relic' },
  ],
  stones: [[[20, 518], [40, 536]]],
  bankText: 'The reliquary opens',
  glass: [
    {
      type: 'rose',
      cx: 299,
      cy: 380,
      rings: [{ r: 40, n: 1 }, { r: 94, n: 6 }, { r: 156, n: 12 }, { r: 220, n: 24 }, { r: 285, n: 24, split: true }],
      outer: { r: 800, n: 24 },
      clip: [above(660)],
      colour: ({ ring, sector }) => [[5], [0, 1], [1, 2, 1, 4], [0, 3, 1, 3], [4, 1, 0, 1, 2, 1], [1, 0]][ring][sector % [1, 2, 4, 4, 6, 2][ring]],
    },
    {
      type: 'lancets',
      cols: [LEFT, 113, 206, 299, 392, 485, LANE_X],
      rows: [660, 722, 784, 846, 905],
      stagger: 31,
      clip: [below(660)],
      colour: ({ col, row }) => ((row + col) % 3 === 0 ? 0 : (row + col) % 3 === 1 ? 1 : [2, 4, 3, 3, 4, 2][col]),
    },
  ],
};
