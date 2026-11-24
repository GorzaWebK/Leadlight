// Moving bodies built from World colliders: swinging bells and rotating rosettes.
import { circle, seg } from './world.js';

/**
 * A bell hanging from an anchor that swings when the ball hits it.
 * The bell's angle `th` is 0 when it hangs straight down the table.
 */
export function addPendulum(world, o) {
  const p = {
    ax: o.x,
    ay: o.y,
    len: o.len ?? 60,
    r: o.r ?? 20,
    th: 0,
    w: 0,
    mass: o.mass ?? 2.2,
    damping: o.damping ?? 0.35,
    maxTh: o.maxTh ?? 1.15,
  };
  p.c = circle(p.ax, p.ay + p.len, p.r, {
    e: o.e ?? 0.55,
    tag: o.tag || 'bell',
    data: o.data,
    cooldown: 0.12,
    surf: () => [p.w * p.len * Math.cos(p.th), -p.w * p.len * Math.sin(p.th)],
    onHit: (jx, jy) => {
      // The ball's change of momentum pushes the bell the other way.
      const rx = p.c.x - p.ax;
      const ry = p.c.y - p.ay;
      const torque = rx * -jy - ry * -jx;
      p.w += torque / (p.mass * p.len * p.len);
    },
  });
  world.addDynamic(p.c);
  const g = world.gy;
  world.updaters.push((h) => {
    p.w += (-(g / p.len) * Math.sin(p.th)) * h;
    p.w *= 1 - p.damping * h;
    p.th += p.w * h;
    if (p.th > p.maxTh) {
      p.th = p.maxTh;
      p.w = -Math.abs(p.w) * 0.4;
    } else if (p.th < -p.maxTh) {
      p.th = -p.maxTh;
      p.w = Math.abs(p.w) * 0.4;
    }
    p.c.x = p.ax + p.len * Math.sin(p.th);
    p.c.y = p.ay + p.len * Math.cos(p.th);
  });
  world.speedHints.push(() => Math.abs(p.w) * p.len);
  return p;
}

/**
 * A rigid body turning about (cx, cy) at angular speed w (rad/s, can change).
 * parts: [{ type: 'circle', x, y, r }, { type: 'seg', ax, ay, bx, by, r }] in local
 * coordinates around the centre.
 */
export function addRotor(world, o) {
  const R = { cx: o.x, cy: o.y, angle: o.angle ?? 0, w: o.w ?? 1, parts: [] };
  const surf = (qx, qy) => [-R.w * (qy - R.cy), R.w * (qx - R.cx)];
  for (const part of o.parts) {
    const opts = { e: part.e ?? 0.5, tag: part.tag || o.tag || 'rotor', data: part.data, surf, kick: part.kick, cooldown: 0.08 };
    const c = part.type === 'circle' ? circle(0, 0, part.r, opts) : seg(0, 0, 0, 0, { ...opts, r: part.r ?? 4 });
    R.parts.push({ def: part, c });
    world.addDynamic(c);
  }
  let reach = 0;
  for (const { def } of R.parts) {
    if (def.type === 'circle') reach = Math.max(reach, Math.hypot(def.x, def.y) + def.r);
    else reach = Math.max(reach, Math.hypot(def.ax, def.ay) + (def.r ?? 4), Math.hypot(def.bx, def.by) + (def.r ?? 4));
  }
  R.reach = reach;
  const place = () => {
    const cs = Math.cos(R.angle);
    const sn = Math.sin(R.angle);
    for (const { def, c } of R.parts) {
      if (def.type === 'circle') {
        c.x = R.cx + def.x * cs - def.y * sn;
        c.y = R.cy + def.x * sn + def.y * cs;
      } else {
        c.ax = R.cx + def.ax * cs - def.ay * sn;
        c.ay = R.cy + def.ax * sn + def.ay * cs;
        c.bx = R.cx + def.bx * cs - def.by * sn;
        c.by = R.cy + def.bx * sn + def.by * cs;
      }
    }
  };
  place();
  world.updaters.push((h) => {
    R.angle += R.w * h;
    place();
  });
  world.speedHints.push(() => Math.abs(R.w) * reach);
  return R;
}
