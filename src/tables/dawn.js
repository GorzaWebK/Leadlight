// I. Dawn — a tall lancet window, amber and rose. Feature: three swinging bells.
// Ring all three while they are still swinging for the Angelus.
import { lancetArch, glassOutline, LANE_X, LEFT } from './common.js';

const arch = lancetArch(380, 372);

// Palette indices: 0 amber, 1 rose, 2 gold, 3 cobalt, 4 peach, 5 pale straw
export default {
  id: 'dawn',
  name: 'Dawn',
  numeral: 'I',
  epithet: 'The Lancet of First Light',
  blurb: 'Three bells hang in the arch. Ring all three while they still swing to sound the Angelus.',
  palette: ['#e08a16', '#c82a52', '#e8b030', '#2c4fc0', '#e2602e', '#efcf86'],
  sky: '#f2a24a', // the light behind the glass
  arch,
  skillPull: [0.44, 0.5], // plunger band that reaches the top lanes (tools/skill.mjs)
  outline: glassOutline(arch),
  bumpers: [
    { x: 226, y: 400 },
    { x: 372, y: 400 },
    { x: 299, y: 488 },
  ],
  laneGuides: [
    [352, 128, 186],
    [412, 124, 186],
    [472, 128, 186],
  ],
  lanes: [
    { x: 322, y: 160 },
    { x: 382, y: 158 },
    { x: 442, y: 160 },
    { x: 502, y: 166 },
  ],
  bells: [
    { x: 196, y: 210, len: 44, note: 0 },
    { x: 299, y: 222, len: 44, note: 2 },
    { x: 402, y: 210, len: 44, note: 4 },
  ],
  spinners: [{ x: 50, y: 470, len: 56, angle: 0 }],
  targets: [
    { a: [34, 570], b: [34, 610], set: 'left' },
    { a: [34, 625], b: [34, 665], set: 'left' },
  ],
  drops: [
    { a: [562, 505], b: [562, 537], bank: 'right' },
    { a: [562, 550], b: [562, 582], bank: 'right' },
    { a: [562, 595], b: [562, 627], bank: 'right' },
  ],
  posts: [{ x: 120, y: 290, r: 6 }, { x: 478, y: 290, r: 6 }],
  stones: [
    [[20, 548], [38, 566]],
    [[578, 483], [558, 501]],
  ],
  bankText: 'Matins rung',
  glass: [
    {
      type: 'rose',
      cx: 299,
      cy: 300,
      rings: [{ r: 34, n: 1 }, { r: 84, n: 8 }, { r: 150, n: 16 }],
      outer: { r: 700, n: 16 },
      clip: [[0, 1, 470]],
      colour: ({ ring, sector }) => [[2], [1, 0], [3, 4, 3, 1], [3, 1, 3, 5]][ring][sector % [1, 2, 4, 4][ring]],
    },
    {
      type: 'lancets',
      cols: [LEFT, 113, 206, 299, 392, 485, LANE_X],
      rows: [470, 532, 594, 656, 718, 780, 842, 905],
      stagger: 31,
      clip: [[0, -1, -470]],
      colour: ({ col, row }) => ((row + 6) % 4 === 1 ? [3, 2, 1, 1, 2, 3][col] : (row + 6) % 2 ? [1, 3, 3, 3, 3, 1][col] : [3, 1, 0, 0, 1, 3][col]),
    },
  ],
};
