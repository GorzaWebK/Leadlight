// SVG drawn in code for the menus and HUD: relic icons, candles, the ribbon banner,
// the progress rose and the pointed-arch frame with its tracery.

const G = '#d9b56a'; // gilt

// Line-art glyphs for the relics, on a 48 x 48 grid.
const ICONS = {
  broad: '<path d="M8 34 Q24 24 40 14" stroke-width="7" stroke-linecap="round"/><circle cx="10" cy="33" r="5" fill="#1b1426"/><path d="M14 30 Q24 25 36 17" stroke="#7d5f2a" stroke-width="1.5"/>',
  angel: '<circle cx="24" cy="12" r="5"/><path d="M24 18 L24 38 M18 40 L30 40"/><path d="M22 22 Q8 14 6 30 Q14 26 22 30 M26 22 Q40 14 42 30 Q34 26 26 30"/>',
  choir: '<path d="M8 40 V24 Q8 14 14 14 Q20 14 20 24 V40 M20 40 V20 Q20 10 26 10 Q32 10 32 20 V40 M32 40 V24 Q32 16 37 16 Q42 16 42 24 V40"/><circle cx="14" cy="26" r="2.5"/><circle cx="26" cy="22" r="2.5"/><circle cx="37" cy="27" r="2.5"/>',
  twin: '<path d="M6 10 H22 V38 H6 Z M26 10 H42 V38 H26 Z M6 24 H22 M26 24 H42"/><path d="M14 10 L14 38 M34 10 L34 38" stroke-width="1" opacity=".6"/>',
  hourglass: '<path d="M12 6 H36 M12 42 H36 M14 6 Q14 20 24 24 Q34 20 34 6 M14 42 Q14 28 24 24 Q34 28 34 42"/><path d="M18 38 Q24 30 30 38 Z" fill="#d9b56a"/>',
  molten: '<path d="M24 6 Q36 22 36 30 A12 12 0 0 1 12 30 Q12 22 24 6 Z"/><path d="M18 30 A6 6 0 0 0 24 36" stroke-width="2"/><path d="M6 44 L14 40 M42 44 L34 40" opacity=".7"/>',
  post: '<path d="M16 42 H32 M18 42 V14 M30 42 V14 M15 14 H33 L24 6 Z"/><path d="M22 20 V36 M26 20 V36" opacity=".6" stroke-width="1.5"/>',
  kickback: '<path d="M14 42 V22 Q14 10 26 10 H34"/><path d="M28 4 L36 10 L28 16"/><path d="M8 42 H22" opacity=".6"/>',
  prism: '<path d="M24 8 L40 38 H8 Z"/><path d="M2 22 L18 24 M30 26 L46 18 M30 28 L46 28 M30 30 L46 38" stroke-width="2"/>',
  candle: '<path d="M18 22 H30 V42 H18 Z"/><path d="M24 22 V17"/><path d="M24 4 Q30 11 24 16 Q18 11 24 4 Z" fill="#ffd27a" stroke="#ffd27a"/><path d="M12 42 H36"/>',
  crown: '<path d="M8 36 L6 14 L16 24 L24 8 L32 24 L42 14 L40 36 Z"/><path d="M8 42 H40"/><circle cx="24" cy="30" r="3"/>',
  feather: '<path d="M38 6 Q16 12 12 38 M12 38 L8 44 M38 6 Q34 26 12 38"/><path d="M30 12 L22 22 M34 16 L20 30 M26 26 L17 33" stroke-width="1.5"/>',
  lantern: '<path d="M16 14 H32 L34 36 H14 Z M20 14 Q24 4 28 14 M14 36 H34 L30 42 H18 Z"/><circle cx="24" cy="25" r="4" fill="#ffd27a" stroke="none"/>',
  gilded: '<path d="M6 6 H42 V42 H6 Z M6 24 H42 M24 6 V42 M6 6 L42 42 M42 6 L6 42"/>',
  censer: '<path d="M24 4 V14 M14 14 H34 L36 26 Q24 40 12 26 Z"/><path d="M18 22 H30" stroke-width="1.5"/><path d="M18 34 Q14 40 18 44 M30 34 Q34 40 30 44" opacity=".6" stroke-width="1.5"/>',
  medal: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="11" stroke-width="1.5"/><path d="M24 15 V33 M15 24 H33"/>',
};

export function relicIcon(id, size = 48, colour = G) {
  const body = ICONS[id] || ICONS.medal;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="${colour}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
}

/** A candle for the HUD ball count: lit or spent. */
export function candleSVG(lit) {
  const flame = lit
    ? '<path class="flame" d="M10 1 Q15 8 10 12 Q5 8 10 1 Z" fill="url(#cf)"/><circle cx="10" cy="7" r="6" fill="#ffb347" opacity=".25"/>'
    : '<path d="M10 12 Q8 8 11 5 Q13 3 11 0" stroke="#8a80a8" stroke-width="1" fill="none" opacity=".6"/>';
  return `<svg viewBox="0 0 20 40" class="candle${lit ? ' lit' : ''}" aria-hidden="true">
    <defs><radialGradient id="cf" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#ffc94a"/><stop offset="1" stop-color="#ff7a1a"/></radialGradient>
    <linearGradient id="cw" x1="0" x2="1"><stop offset="0" stop-color="#a99c80"/><stop offset=".45" stop-color="#f1e6cf"/><stop offset="1" stop-color="#8f836c"/></linearGradient></defs>
    ${flame}<path d="M10 12 V15" stroke="#2a2018" stroke-width="1"/>
    <rect x="5" y="15" width="10" height="20" rx="1" fill="${lit ? 'url(#cw)' : '#6a6070'}"/>
    <rect x="2" y="35" width="16" height="3" fill="${G}"/></svg>`;
}

/** A ribbon banner with folded tails. Text sits on top in HTML. */
export function ribbonSVG(colour = '#7a1630') {
  return `<svg viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 18 L26 18 L26 52 L0 52 L12 35 Z" fill="${colour}" filter="brightness(.6)"/>
    <path d="M300 18 L274 18 L274 52 L300 52 L288 35 Z" fill="${colour}" filter="brightness(.6)"/>
    <path d="M18 10 L26 18 L26 52 L18 44 Z M282 10 L274 18 L274 52 L282 44 Z" fill="#1a0810"/>
    <path d="M18 10 Q150 0 282 10 L282 44 Q150 34 18 44 Z" fill="${colour}"/>
    <path d="M18 13 Q150 3 282 13 M18 41 Q150 31 282 41" stroke="${G}" stroke-width="1.6" fill="none"/></svg>`;
}

/** A small rose that fills petal by petal as the window lights. */
export function roseSVG(fraction, palette) {
  const n = 12;
  let petals = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const fill = Math.max(0, Math.min(1, fraction * n - i));
    const c = palette[i % palette.length];
    const x = 32 + Math.cos(a) * 17;
    const y = 32 + Math.sin(a) * 17;
    const rot = (a * 180) / Math.PI + 90;
    petals += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="11" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${c}" fill-opacity="${(0.12 + fill * 0.88).toFixed(2)}" stroke="#0a0910" stroke-width="2"/>`;
  }
  const inner = fraction >= 1 ? '#fff1c4' : '#2a2140';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#120f22" stroke="${G}" stroke-width="1.5"/>${petals}<circle cx="32" cy="32" r="7" fill="${inner}" stroke="#0a0910" stroke-width="2"/></svg>`;
}

/**
 * The pointed-arch frame of a menu panel: carved mouldings, a cusped inner arch,
 * a trefoil in the head and crockets up the extrados. Drawn for a given aspect.
 */
/**
 * Geometry of a panel's arch for a viewBox w x h. Tall panels get a pointed
 * two-centred arch; wide ones a flatter four-centred (Tudor) arch, so the head
 * never swallows the panel.
 */
export function archGeometry(w, h) {
  const span = w - 40;
  const tudor = h / w < 0.95;
  const rise = tudor ? Math.min(span * 0.3, h * 0.22) : Math.max(span / 2, Math.min(span * 0.78, h * 0.3));
  const apexY = 34;
  const springY = apexY + rise;
  return { span, rise, apexY, springY, tudor, head: (apexY + rise * (tudor ? 0.72 : 0.42) + (tudor ? 40 : 26)) / h };
}

/** Points of the left half of the arch, from the springing to the apex, inset by `inset`. */
function archHalf(w, h, inset) {
  const { span, rise, apexY, springY, tudor } = archGeometry(w, h);
  const x0 = 20 + inset;
  const mid = w / 2;
  const pts = [];
  if (tudor) {
    const r1 = rise * 0.8 - inset * 0.5;
    const th = (58 * Math.PI) / 180;
    for (let i = 0; i <= 12; i++) {
      const a = (th * i) / 12;
      pts.push([x0 + r1 * (1 - Math.cos(a)), springY - r1 * Math.sin(a)]);
    }
    const [px, py] = pts[pts.length - 1];
    const ax = mid;
    const ay = apexY + inset;
    // A gentle curve from the end of the tight arc up to the point.
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const cx = px + (ax - px) * 0.45;
      const cy = py - (py - ay) * 0.85;
      pts.push([(1 - t) ** 2 * px + 2 * (1 - t) * t * cx + t * t * ax, (1 - t) ** 2 * py + 2 * (1 - t) * t * cy + t * t * ay]);
    }
  } else {
    const r = (rise * rise + (span * span) / 4) / span;
    const c = [20 + r, springY];
    const R = r - inset;
    const aApex = Math.atan2(apexY - springY, mid - c[0]);
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI + ((Math.PI * 2 + aApex - Math.PI) * i) / 28;
      pts.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]);
    }
    pts[pts.length - 1][0] = Math.min(pts[pts.length - 1][0], mid);
  }
  return pts;
}

function pointAlong(pts, t) {
  let total = 0;
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push((total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
  const d = t * total;
  for (let i = 1; i < pts.length; i++)
    if (L[i] >= d) {
      const k = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
      const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      const nx = pts[i][1] - pts[i - 1][1];
      const ny = -(pts[i][0] - pts[i - 1][0]);
      const l = Math.hypot(nx, ny) || 1;
      return { p, n: [nx / l, ny / l] }; // n points outwards (up and left)
    }
  return { p: pts[pts.length - 1], n: [0, -1] };
}

export function archFrameSVG(w = 600, h = 900) {
  const { apexY } = archGeometry(w, h);
  const mid = w / 2;
  const path = (inset) => {
    const half = archHalf(w, h, inset);
    const right = half.map(([x, y]) => [w - x, y]).reverse();
    const all = [[half[0][0], h - inset], ...half, ...right.slice(1), [w - half[0][0], h - inset]];
    return 'M' + all.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
  };
  const inner = archHalf(w, h, 30);
  const outer = archHalf(w, h, -7);
  let cusps = '';
  for (const t of [0.3, 0.55, 0.8]) {
    const { p } = pointAlong(inner, t);
    for (const x of [p[0], w - p[0]]) cusps += `<circle cx="${x.toFixed(1)}" cy="${p[1].toFixed(1)}" r="8" fill="#0d0b18" stroke="#5a5084" stroke-width="2"/>`;
  }
  let crockets = '';
  for (const t of [0.2, 0.38, 0.56, 0.74, 0.9]) {
    const { p } = pointAlong(outer, t);
    for (const x of [p[0], w - p[0]])
      crockets += `<g transform="translate(${x.toFixed(1)} ${p[1].toFixed(1)})"><circle r="4.5" cx="-3.5" fill="#3d355f"/><circle r="4.5" cx="3.5" fill="#3d355f"/><circle r="5" cy="-4.5" fill="#4a4272"/></g>`;
  }
  const tre = (cx, cy, s) =>
    `<g transform="translate(${cx} ${cy})" fill="none" stroke="#6a5f98" stroke-width="3"><circle r="${s}" cy="${-s * 0.9}"/><circle r="${s}" cx="${-s * 0.85}" cy="${s * 0.45}"/><circle r="${s}" cx="${s * 0.85}" cy="${s * 0.45}"/></g>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" class="arch-svg">
    <defs>
      <linearGradient id="st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d355f"/><stop offset="1" stop-color="#1a162e"/></linearGradient>
      <radialGradient id="glow" cx=".5" cy=".25" r=".8"><stop offset="0" stop-color="#2a2150" stop-opacity=".96"/><stop offset="1" stop-color="#0b0918" stop-opacity=".97"/></radialGradient>
    </defs>
    ${crockets}
    <path d="${path(0)}" fill="url(#st)" stroke="#0a0812" stroke-width="3"/>
    <path d="${path(8)}" fill="none" stroke="#5a5084" stroke-width="3"/>
    <path d="${path(16)}" fill="none" stroke="#14112a" stroke-width="5"/>
    <path d="${path(24)}" fill="url(#glow)" stroke="#d9b56a" stroke-width="1.6" stroke-opacity=".7"/>
    ${cusps}
    ${tre(mid, apexY + 70, 12)}
    <circle cx="${mid}" cy="${apexY - 14}" r="8" fill="#4a4272"/>
  </svg>`;
}

/** Stone grain for CSS backgrounds, drawn once into a data URL. */
export function stoneDataURL() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#211c38';
  g.fillRect(0, 0, 160, 160);
  let s = 9;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.08 + r() * 0.12})` : `rgba(160,145,220,${0.03 + r() * 0.06})`;
    g.fillRect(r() * 160, r() * 160, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = r() * 160;
    const y = r() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 30);
    gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 160, 160);
  }
  try {
    return c.toDataURL('image/png');
  } catch {
    return '';
  }
}
