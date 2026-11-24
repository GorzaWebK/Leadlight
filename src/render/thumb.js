// A small picture of a window, lit or dark, for the window-select cards.
import { GlassLayer, LAYER_RECT } from './glass.js';
import { makeCanvas } from './sprites.js';

const CROP = { x0: -40, y0: -70, x1: 680, y1: 940 };

export function windowThumb(def, width = 300, lit = true) {
  const s = width / (CROP.x1 - CROP.x0);
  const layer = new GlassLayer(def, { scale: s });
  if (lit) for (let i = 0; i < def.panes.length; i++) layer.commit(i, true);
  const c = makeCanvas(width, (CROP.y1 - CROP.y0) * s);
  const g = c.getContext('2d');
  g.drawImage(layer.canvas, (CROP.x0 - LAYER_RECT.x0) * s, (CROP.y0 - LAYER_RECT.y0) * s, (CROP.x1 - CROP.x0) * s, (CROP.y1 - CROP.y0) * s, 0, 0, c.width, c.height);
  if (lit) {
    layer.updateBloom();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5;
    const b = layer.bloom;
    const k = b.width / layer.canvas.width;
    g.drawImage(b, (CROP.x0 - LAYER_RECT.x0) * s * k, (CROP.y0 - LAYER_RECT.y0) * s * k, (CROP.x1 - CROP.x0) * s * k, (CROP.y1 - CROP.y0) * s * k, 0, 0, c.width, c.height);
  }
  return c;
}
