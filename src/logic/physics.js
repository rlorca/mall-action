import { feetY, FLOORS } from '../world/constants.js';
import { doorwayState, inShaftX, CAR_H } from './elevator.js';

export const GRAVITY = 0.25;
export const MAX_FALL_V = 4;
export const MAX_SAFE_FALL = 48;

export const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const rectOf = (e) => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h });

export function stepAir(e) {
  e.vy = Math.min(e.vy + GRAVITY, MAX_FALL_V);
  e.y += e.vy; e.x += e.vx;
}

export function supportedAt(x, floor, cars) {
  for (const c of cars) if (inShaftX(c, x) && doorwayState(c, floor) === 'pit') return false;
  return true;
}

// Entity feet moved from prevY down to y this frame; return the first surface crossed.
export function findLanding(x, prevY, y, cars) {
  let best = null;
  for (const c of cars) {
    if (!inShaftX(c, x)) continue;
    const roof = c.y - CAR_H;
    if (prevY <= roof && y >= roof) best = { y: roof, floor: null, roof: c.id };
  }
  for (let f = 0; f < FLOORS; f++) {
    const fy = feetY(f);
    if (prevY <= fy && y >= fy && supportedAt(x, f, cars) && (!best || fy < best.y)) best = { y: fy, floor: f, roof: null };
  }
  return best;
}

export function moveInRoom(box, dx, dy, isSolidAt) {
  const blocked = (b) => {
    const pts = [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1]];
    return pts.some(([px, py]) => isSolidAt(Math.floor(px), Math.floor(py)));
  };
  let hitX = false, hitY = false;
  const stepAxis = (axis, d) => {
    const s = Math.sign(d); let rem = Math.abs(d);
    while (rem > 0) {
      const inc = Math.min(1, rem) * s;
      box[axis] += inc;
      if (blocked(box)) { box[axis] -= inc; return true; }
      rem -= Math.abs(inc);
    }
    return false;
  };
  if (dx) hitX = stepAxis('x', dx);
  if (dy) hitY = stepAxis('y', dy);
  return { hitX, hitY };
}
