// Colour helpers for the renderer.
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const A = typeof a === 'string' ? hexToRgb(a) : a;
  const B = typeof b === 'string' ? hexToRgb(b) : b;
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

export function rgba(c, a = 1) {
  const C = typeof c === 'string' ? hexToRgb(c) : c;
  return `rgba(${C[0] | 0},${C[1] | 0},${C[2] | 0},${a})`;
}

/** Push a colour towards full saturation, keeping its brightness. */
export function saturate(c, t) {
  const C = typeof c === 'string' ? hexToRgb(c) : c;
  const avg = (C[0] + C[1] + C[2]) / 3;
  return C.map((v) => Math.max(0, Math.min(255, avg + (v - avg) * (1 + t))));
}

export const STONE = {
  deep: '#0d0b18',
  dark: '#15122a',
  mid: '#231e3c',
  light: '#3a3358',
  edge: '#5a5180',
  lead: '#0a0910',
  gilt: '#d9b56a',
  giltDark: '#7d5f2a',
  giltLight: '#fbe7b0',
  wax: '#f1e6cf',
  bronze: '#9a6b34',
};
