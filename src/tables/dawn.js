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
  palette: ['#e8901a', '#d0345c', '#f0bd3c', '#3558c8', '#ec6f3f', '#f3d896'],
  sky: '#f2a24a', // the light behind the glass
  arch,
  outline: glassOutline(arch),
  bumpers: [
    { x: 226, y: 400 },
    { x: 372, y: 400 },
    { x: 299, y: 488 },
  ],
  laneGuides: [
    [214, 108, 166],
    [284, 100, 166],
    [354, 100, 166],
    [424, 108, 166],
  ],
  lanes: [
    { x: 249, y: 138 },
    { x: 319, y: 134 },
    { x: 389, y: 138 },
  ],
  bells: [
    { x: 196, y: 210, len: 44, note: 0 },
    { x: 299, y: 222, len: 44, note: 2 },
    { x: 402, y: 210, len: 44, note: 4 },
  ],
  spinners: [{ x: 50, y: 470, len: 56, angle: 0 }],
  targets: [
    { a: [34, 585], b: [34, 625], set: 'left' },
    { a: [34, 640], b: [34, 680], set: 'left' },
  ],
  drops: [
    { a: [562, 505], b: [562, 537], bank: 'right' },
    { a: [562, 550], b: [562, 582], bank: 'right' },
    { a: [562, 595], b: [562, 627], bank: 'right' },
  ],
  posts: [{ x: 120, y: 290, r: 6 }, { x: 478, y: 290, r: 6 }],
  bankText: 'Matins rung',
  glass: [
    {
      type: 'rose',
      cx: 299,
      cy: 300,
      rings: [{ r: 34, n: 1 }, { r: 84, n: 8 }, { r: 150, n: 16 }],
      outer: { r: 700, n: 16 },
      clip: [[0, 1, 470]],
      colour: ({ ring, sector }) => [[2], [1, 0], [3, 4], [5, 3]][ring][sector % [1, 2, 2, 2][ring]],
    },
    {
      type: 'lancets',
      cols: [LEFT, 113, 206, 299, 392, 485, LANE_X],
      rows: [470, 532, 594, 656, 718, 780, 842, 905],
      stagger: 31,
      clip: [[0, -1, -470]],
      colour: ({ col, row }) => ((row + 6) % 3 === 1 ? 5 : [3, 1, 0, 0, 1, 3][col]),
    },
  ],
};
