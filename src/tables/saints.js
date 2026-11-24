// II. Saints — a broad four-centred arch in cobalt and ruby. Feature: a stone rosette
// turns at the heart of the window. Strike all six saints' haloes for the Litany.
import { tudorArch, glassOutline } from './common.js';
import { above, below } from './zones.js';

const arch = tudorArch(300, 120, Math.PI / 3, 420);

// 0 cobalt, 1 ruby, 2 gold, 3 pale, 4 violet, 5 emerald
export default {
  id: 'saints',
  name: 'Saints',
  numeral: 'II',
  epithet: 'The Wheel of Haloes',
  blurb: 'A stone rosette turns at the heart of the window. Strike all six haloes for the Litany of Saints.',
  palette: ['#2340b8', '#b8183a', '#dca022', '#d6cbb0', '#6a2fb0', '#178a5a'],
  sky: '#e6b070',
  arch,
  skillPull: [0.6, 0.645], // plunger band that reaches the top lanes (tools/skill.mjs)
  outline: glassOutline(arch),
  rotor: { x: 299, y: 440, hub: 28, arm: 58, lobes: 6, lobe: 13, w: 1.3 },
  bumpers: [
    { x: 160, y: 470, r: 26 },
    { x: 438, y: 470, r: 26 },
  ],
  laneGuides: [
    [372, 222, 270],
    [430, 222, 270],
  ],
  lanes: [
    { x: 343, y: 246 },
    { x: 401, y: 244 },
    { x: 459, y: 246 },
  ],
  spinners: [{ x: 50, y: 470, len: 56, angle: 0 }],
  drops: [
    { a: [36, 540], b: [36, 572], bank: 'left' },
    { a: [36, 585], b: [36, 617], bank: 'left' },
    { a: [36, 630], b: [36, 662], bank: 'left' },
  ],
  targets: [
    { a: [562, 545], b: [562, 585], set: 'right' },
    { a: [562, 600], b: [562, 640], set: 'right' },
  ],
  posts: [{ x: 230, y: 300, r: 6 }],
  stones: [
    [[20, 518], [40, 536]],
    [[578, 523], [558, 541]],
  ],
  bankText: 'Vespers rung',
  glass: [
    {
      type: 'rose',
      cx: 299,
      cy: 420,
      rings: [{ r: 46, n: 1 }, { r: 104, n: 8 }, { r: 172, n: 16 }, { r: 240, n: 16, split: true }],
      outer: { r: 800, n: 16 },
      clip: [above(650)],
      colour: ({ ring, sector }) => [[2], [1, 0], [0, 0, 2, 0], [4, 1], [0, 3, 0, 1]][ring][sector % [1, 2, 4, 2, 4][ring]],
    },
    {
      type: 'lattice',
      w: 78,
      h: 78,
      angle: Math.PI / 4,
      ox: 299,
      oy: 650,
      clip: [below(650)],
      colour: ({ i, j }) => ((i + j) % 4 === 0 ? 1 : (i - j) % 3 === 0 ? 4 : 0),
    },
  ],
};
