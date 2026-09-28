import { feetY, WALL_L, WALL_R } from '../world/constants.js';
import { STORES, doorX } from '../world/mallLevel.js';
import { aabb, rectOf } from './physics.js';

export const WET_FRAMES = 600, WET_W = 48;
export const COP_RANGE = 128, COP_CHASE_FRAMES = 600, DETAIN_FRAMES = 180;

export const createWetPatch = (x, floor) => ({ x0: x, x1: x + WET_W, floor, t: WET_FRAMES });
export const tickWet = (patches) => patches.filter((p) => --p.t > 0);
export const onWet = (patches, e) => patches.some((p) => p.floor === e.floor && e.x >= p.x0 && e.x < p.x1);

export function slideStep(patches, e, speed) {
  if (!e.grounded || !onWet(patches, e)) { e.slideDir = 0; return false; }
  if (!e.slideDir) e.slideDir = e.facing;
  e.vx = e.slideDir * speed;
  return true;
}

export const createCop = (floor, x) => ({ x, y: feetY(floor), floor, w: 14, h: 24, facing: 1, state: 'patrol', t: 0 });
export function copSeesShot(cop, shooter) {
  const dx = shooter.x - cop.x;
  return cop.state === 'patrol' && shooter.floor === cop.floor && Math.abs(dx) <= COP_RANGE && (dx === 0 || Math.sign(dx) === cop.facing);
}
export function startChase(cop) { cop.state = 'chase'; cop.t = COP_CHASE_FRAMES; }
export function stepCop(cop, player, walk = 1) {
  if (cop.state === 'chase') {
    if (--cop.t <= 0) { cop.state = 'patrol'; return; }
    if (player.floor === cop.floor) { cop.facing = player.x < cop.x ? -1 : 1; cop.x += cop.facing * walk * 1.25; }
    return;
  }
  cop.x += cop.facing * 0.5;
  if (cop.x < WALL_L + 8 || cop.x > WALL_R - 8) { cop.facing *= -1; cop.x = Math.min(WALL_R - 8, Math.max(WALL_L + 8, cop.x)); }
}
export const copCatches = (cop, player) => cop.state === 'chase' && player.floor === cop.floor && Math.abs(player.x - cop.x) < 10;

export const createWalker = (floor, x, dir) => ({ x, y: feetY(floor), floor, w: 12, h: 22, facing: dir, heyT: 0 });
export function stepWalker(w, lo, hi) {
  w.x += w.facing * 0.6;
  if (w.x <= lo || w.x >= hi) { w.facing *= -1; w.x = Math.min(hi, Math.max(lo, w.x)); }
  if (w.heyT > 0) w.heyT--;
}
export const walkerBlocking = (walkers, bulletRect, floor) =>
  walkers.find((w) => w.floor === floor && aabb(rectOf(w), bulletRect)) ?? null;

export function nearestTarget(player, cleared) {
  let best = null, bestCost = Infinity;
  for (const s of STORES) {
    if (s.role !== 'target' || cleared.has(s.id)) continue;
    const cost = Math.abs(s.floor - player.floor) * 400 + Math.abs(doorX(s) - player.x);
    if (cost < bestCost) { bestCost = cost; best = s; }
  }
  return best;
}
