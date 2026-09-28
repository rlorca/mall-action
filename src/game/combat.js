import { FLOORS, floorTop, feetY, WALL_L, WALL_R } from '../world/constants.js';
import { aabb, rectOf } from '../logic/physics.js';
import { fireCooldown, maxBullets, applyPowerup } from '../logic/powerups.js';
import { addScore } from '../logic/rules.js';
import { copSeesShot, startChase, walkerBlocking } from '../logic/npcs.js';
import { killSpy, alive } from './spies.js';
import { killPlayer } from './mallPlayer.js';
import { hitLight, lampHitBox } from './lights.js';

export const floorOfY = (y) => {
  for (let f = 0; f < FLOORS; f++) if (y >= floorTop(f) && y <= feetY(f)) return f;
  return null;
};
const rectOfBullet = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h });
const SHOOTING_MODES = new Set(['ground', 'air', 'car']);

export function firePlayer(world, pad, state) {
  const events = [];
  const p = world.player;
  if (p.shootT > 0) p.shootT--;
  if (p.poseT > 0) p.poseT--;
  if (!pad.pressed('a') || p.shootT > 0 || !SHOOTING_MODES.has(p.mode) || p.frozenT > 0) return events;
  if (world.bullets.filter((b) => b.owner === 'player').length >= maxBullets(state.power)) return events;
  p.shootT = fireCooldown(state.power);
  p.poseT = 10;
  const y = p.y - (p.duck ? 8 : 16);
  const floor = p.floor ?? floorOfY(p.y - 1);
  const x = p.facing > 0 ? p.x + 6 : p.x - 10;
  const spreads = state.power.weapon === 'spread' ? [0, -0.6, 0.6] : [0];
  for (const vy of spreads) world.bullets.push({ x, y, vx: 3 * p.facing, vy, floor, w: 4, h: 2, owner: 'player', life: 90 });
  events.push({ type: 'sfx', name: 'shot' });
  if (world.cop && copSeesShot(world.cop, p)) {
    startChase(world.cop);
    events.push({ type: 'sfx', name: 'whistle' }, { type: 'banner', text: 'HEY! STOP RIGHT THERE!' });
  }
  return events;
}

// extra bullet targets registered by later systems (e.g. fountains): (world, bullet, rect, state, rng, events) => consumed?
export const bulletHooks = [];

export function stepBullets(world, state, rng) {
  const events = [];
  const p = world.player;
  const keep = (b) => {
    b.x += b.vx; b.y += b.vy;
    if (--b.life <= 0 || b.x < WALL_L || b.x > WALL_R || b.floor === null || b.y < floorTop(b.floor) || b.y > feetY(b.floor)) return false;
    const r = rectOfBullet(b);
    const walker = walkerBlocking(world.walkers, r, b.floor);
    if (walker) {
      if (b.owner === 'player') { walker.heyT = 60; const { pts } = addScore(state, 'walkerShot'); events.push({ type: 'sfx', name: 'buzzer' }, { type: 'score', pts, x: walker.x, y: walker.y - 30 }); }
      return false;
    }
    if (b.owner === 'enemy') {
      if (p.mode !== 'hidden' && (p.floor === b.floor || p.floor === null) && aabb(rectOf(p), r)) { killPlayer(p, 'shot', state, events); return false; }
      return true;
    }
    for (const s of world.spies) {
      if (alive(s) && s.floor === b.floor && aabb(rectOf(s), r)) { killSpy(world, s, 'spyShot', state, events); return false; }
    }
    for (const l of world.lights) {
      if (l.floor === b.floor && l.state === 'hanging' && aabb(lampHitBox(l), r)) { hitLight(l, Math.sign(b.vx)); events.push({ type: 'sfx', name: 'lightFall' }); return false; }
    }
    const cop = world.cop;
    if (cop && cop.floor === b.floor && aabb(rectOf(cop), r)) { events.push({ type: 'sfx', name: 'ping' }); return false; }
    for (const hook of bulletHooks) if (hook(world, b, r, state, rng, events)) return false;
    return true;
  };
  world.bullets = world.bullets.filter(keep);
  world.enemyBullets = world.enemyBullets.filter(keep);
  return events;
}

export function playerContacts(world, state) {
  const events = [];
  const p = world.player;
  if (['dying', 'hidden', 'intro'].includes(p.mode)) return events;
  const pr = rectOf(p);
  for (const s of world.spies) {
    if (!alive(s) || s.state === 'emerge' || !aabb(pr, rectOf(s))) continue;
    if (p.kick && p.slideDir) killSpy(world, s, 'slideKill', state, events);
    else if ((p.mode === 'air' && p.kick) || state.power.invincibleT > 0) killSpy(world, s, 'spyShot', state, events);
    else killPlayer(p, 'contact', state, events);
  }
  // pickups fall to their floor and are collected on touch
  world.pickups = world.pickups.filter((it) => {
    if (it.y < feetY(it.floor) - 12) { it.vy = Math.min(it.vy + 0.2, 3); it.y = Math.min(it.y + it.vy, feetY(it.floor) - 12); }
    if (--it.t <= 0) return false;
    if (aabb(pr, { x: it.x - 6, y: it.y, w: 12, h: 12 })) {
      const { extraLife } = applyPowerup(state.power, it.id);
      if (extraLife) state.lives += extraLife;
      const { pts } = addScore(state, 'powerup');
      events.push({ type: 'sfx', name: 'powerup' }, { type: 'score', pts, x: it.x, y: it.y - 8 });
      return false;
    }
    return true;
  });
  return events;
}
