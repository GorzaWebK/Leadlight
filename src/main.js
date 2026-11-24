import { TABLES } from './tables/index.js';
import { Game } from './game/game.js';
import { Renderer } from './render/renderer.js';
import { Input } from './input/input.js';

const root = document.getElementById('game');
const canvas = document.getElementById('view');
const renderer = new Renderer(canvas, {});
const input = new Input(canvas, null);
input.playing = true;
input.zoneAt = (x, y) => renderer.zoneAt(x, y);

const pick = () => TABLES.find((t) => t.id === new URLSearchParams(location.search).get('table')) || TABLES[0];
let game = new Game({ table: pick(), mode: 'single', balls: 3 });
renderer.setGame(game);

function resize() {
  const w = root.clientWidth;
  const h = root.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, dpr, { x: 0, y: 0, w, h });
}
new ResizeObserver(resize).observe(root);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, input.state());
  renderer.handle(game.drainOut());
  renderer.frame(dt);
  if (game.phase === 'over') {
    game = new Game({ table: pick(), mode: 'single', balls: 3 });
    renderer.setGame(game);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.leadlight = { get game() { return game; }, renderer };
