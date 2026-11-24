// The favicon: a tiny rose window, drawn in code.
export function drawFavicon() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#15122a';
    g.beginPath();
    g.arc(32, 32, 31, 0, Math.PI * 2);
    g.fill();
    const cols = ['#c82a52', '#2c4fc0', '#e8b030', '#138a52', '#6a2db0', '#e08a16'];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(32 + Math.cos(a0) * 12, 32 + Math.sin(a0) * 12);
      g.arc(32, 32, 27, a0, a1);
      g.lineTo(32 + Math.cos(a1) * 12, 32 + Math.sin(a1) * 12);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#ffe9a8';
    g.beginPath();
    g.arc(32, 32, 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0a0910';
    g.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10);
      g.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28);
      g.stroke();
    }
    for (const r of [10, 28]) {
      g.beginPath();
      g.arc(32, 32, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#d9b56a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(32, 32, 30.5, 0, Math.PI * 2);
    g.stroke();
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.append(link);
    }
    link.href = c.toDataURL('image/png');
  } catch {
    /* keep the inline SVG icon */
  }
}
