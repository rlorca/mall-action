import { feetY, floorTop, WALL_L, WALL_R } from '../world/constants.js';
import { aabb, rectOf, supportedAt } from '../logic/physics.js';
import { killSpy, alive } from './spies.js';
import { killPlayer } from './mallPlayer.js';

export const LAMP_W = 12, LAMP_H = 12;
export const lampTop = (floor) => floorTop(floor) + 14;
// Cord + lamp column: a standing shot (y-16) hits it, a ducking shot (y-8) passes under.
export const lampHitBox = (l) => ({ x: l.x - 3, y: floorTop(l.floor) + 2, w: 6, h: feetY(l.floor) - 14 - (floorTop(l.floor) + 2) });

export function hitLight(l, dir) {
  if (l.state !== 'hanging') return false;
  Object.assign(l, { state: 'falling', vy: 0, rollDir: dir || 1 });
  return true;
}

function smash(world, l, state, events) {
  const rect = { x: l.x - LAMP_W / 2, y: l.y, w: LAMP_W, h: LAMP_H };
  for (const s of world.spies) if (alive(s) && s.floor === l.floor && aabb(rect, rectOf(s))) killSpy(world, s, l.kind === 'disco' ? 'discoKill' : 'spyLight', state, events);
  const p = world.player;
  if (p.floor === l.floor && aabb(rect, rectOf(p))) killPlayer(p, 'light', state, events);
}

export function stepLights(world, state) {
  const events = [];
  for (const l of world.lights) {
    if (l.state === 'falling') {
      l.vy += 0.2; l.y += l.vy;
      const ground = feetY(l.floor) - LAMP_H;
      if (l.y >= ground) {
        l.y = ground;
        smash(world, l, state, events);
        if (l.kind === 'disco') { l.state = 'rolling'; events.push({ type: 'sfx', name: 'glass' }); }
        else {
          l.state = 'broken';
          world.dark = { floor: l.floor, x0: l.x - 64, x1: l.x + 64, t: 120 };
          events.push({ type: 'sfx', name: 'glass' }, { type: 'shake', frames: 8 });
        }
      } else smash(world, l, state, events);
    } else if (l.state === 'rolling') {
      l.x += l.rollDir * 2;
      smash(world, l, state, events);
      if (l.x < WALL_L + 8 || l.x > WALL_R - 8 || !supportedAt(l.x + l.rollDir * 6, l.floor, world.cars)) {
        l.state = 'broken';
        events.push({ type: 'sfx', name: 'glass' }, { type: 'shake', frames: 6 });
      }
    }
  }
  if (world.dark && --world.dark.t <= 0) world.dark = null;
  return events;
}
