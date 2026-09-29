import { feetY, WALL_L, WALL_R } from '../world/constants.js';
import { KIOSKS, FOUNTAINS, PHOTO_BOOTH, JANITOR_FLOOR, WALKER_FLOOR, COP_FLOORS } from '../world/mallLevel.js';
import { aabb, rectOf, supportedAt } from '../logic/physics.js';
import { createWetPatch, tickWet, createCop, stepCop, copCatches, createWalker, stepWalker, nearestTarget, DETAIN_FRAMES } from '../logic/npcs.js';
import { walkSpeed } from '../logic/powerups.js';
import { addScore, isAlarm } from '../logic/rules.js';
import { bulletHooks } from './combat.js';
import { PA_FRAMES, pickPA } from './humor.js';

const JANITOR_RANGE = [40, 344]; // 1F: the 48 px patch (x±24) must stay clear of shaft B at 376
const WALKER_RANGES = [[150, 360], [410, 620]];
export const KIOSK_COOLDOWN = 1200;
export const FOUNTAIN_COOLDOWN = 900;
export const PHOTO_FRAMES = 300;

export function createNpcs(world, rng) {
  world.janitor = { x: 200, y: feetY(JANITOR_FLOOR), floor: JANITOR_FLOOR, w: 10, h: 24, facing: 1, state: 'walk', t: 900 };
  world.walkers = WALKER_RANGES.map(([lo, hi], i) => Object.assign(createWalker(WALKER_FLOOR, lo + 40, i ? -1 : 1), { lo, hi }));
  world.cop = createCop(rng.pick(COP_FLOORS), 440);
  world.upHooks.push(kioskHook, boothHook);
}

export function kioskHook(p, world, state) {
  const i = KIOSKS.findIndex((k) => k.floor === p.floor && Math.abs(p.x - k.x) <= 8);
  if (i < 0) return null;
  if (world.kioskCooldown[i] > 0) return [];
  world.kioskCooldown[i] = KIOSK_COOLDOWN;
  return [{ type: 'kiosk', storeId: nearestTarget(p, state.cleared)?.id ?? null }, { type: 'sfx', name: 'blip' }];
}

export function boothHook(p) {
  if (p.floor !== PHOTO_BOOTH.floor || p.x < PHOTO_BOOTH.x || p.x > PHOTO_BOOTH.x + PHOTO_BOOTH.w) return null;
  Object.assign(p, { mode: 'hidden', hiddenT: PHOTO_FRAMES, vx: 0, duck: false });
  return [{ type: 'sfx', name: 'door' }];
}

function sprayCoins(world, i, rng) {
  const f = FOUNTAINS[i];
  const n = rng.int(3, 5);
  const gold = rng.chance(0.05) ? rng.int(0, n - 1) : -1;
  for (let k = 0; k < n; k++) {
    world.coins.push({ x: f.x + f.w / 2, y: feetY(f.floor) - 20, vx: rng.next() * 3 - 1.5, vy: -2 - rng.next(), floor: f.floor, gold: k === gold, life: 300 });
  }
}

// player bullets hitting a fountain spray coins (registered once)
bulletHooks.push((world, b, r, state, rng, events) => {
  if (b.owner !== 'player') return false;
  const i = FOUNTAINS.findIndex((f) => f.floor === b.floor && aabb(r, { x: f.x, y: feetY(f.floor) - 16, w: f.w, h: 16 }));
  if (i < 0) return false;
  if (world.fountainCooldown[i] === 0) {
    world.fountainCooldown[i] = FOUNTAIN_COOLDOWN;
    sprayCoins(world, i, rng);
    events.push({ type: 'sfx', name: 'coin' });
  }
  return true;
});

function stepJanitor(world) {
  const j = world.janitor;
  if (!j) return;
  if (j.state === 'mop') {
    if (--j.t <= 0) {
      world.wet.push(createWetPatch(Math.round(j.x) - 24, j.floor));
      Object.assign(j, { state: 'walk', t: 900 });
    }
    return;
  }
  j.x += j.facing * 0.4;
  if (j.x < JANITOR_RANGE[0] || j.x > JANITOR_RANGE[1]) { j.facing *= -1; j.x = Math.min(JANITOR_RANGE[1], Math.max(JANITOR_RANGE[0], j.x)); }
  if (--j.t <= 0) Object.assign(j, { state: 'mop', t: 60 });
}

function stepCoins(world, state, events) {
  const p = world.player;
  const pr = rectOf(p);
  world.coins = world.coins.filter((c) => {
    c.vy += 0.2; c.x += c.vx; c.y += c.vy;
    const ground = feetY(c.floor) - 8;
    if (c.y >= ground) { c.y = ground; c.vy = Math.abs(c.vy) < 0.6 ? 0 : -c.vy * 0.5; c.vx *= 0.9; }
    c.x = Math.min(WALL_R - 8, Math.max(WALL_L, c.x));
    if (--c.life <= 0) return false;
    if (p.mode !== 'dying' && p.floor === c.floor && aabb(pr, { x: c.x, y: c.y, w: 8, h: 8 })) {
      const { pts } = addScore(state, 'coin');
      events.push({ type: 'sfx', name: 'coin' }, { type: 'score', pts, x: c.x, y: c.y - 8 });
      if (c.gold) { state.lives++; events.push({ type: 'banner', text: '1UP!' }); }
      return false;
    }
    return true;
  });
}

export function stepNpcs(world, state, rng) {
  const events = [];
  const p = world.player;

  const wasAlarm = world.alarm;
  world.alarm = isAlarm(state.levelFrames, state.loop);
  if (world.alarm && !wasAlarm) {
    if (p.mode !== 'car') events.push({ type: 'music', name: 'mallAlarm' });
    events.push({ type: 'banner', text: 'ALARM! SECURITY ALERTED' });
  }

  if (world.frame % PA_FRAMES === 0) events.push({ type: 'pa', text: pickPA(world, rng) });

  world.wet = tickWet(world.wet);
  stepJanitor(world);

  for (const w of world.walkers) {
    stepWalker(w, w.lo, w.hi);
    if (p.floor === w.floor && p.mode === 'ground' && aabb(rectOf(p), rectOf(w))) {
      const nx = Math.min(WALL_R - 6, Math.max(WALL_L + 6, p.x + w.facing * 0.6));
      if (supportedAt(nx, p.floor, world.cars)) p.x = nx;
    }
  }

  const cop = world.cop;
  if (cop) {
    stepCop(cop, p, walkSpeed(state.power));
    if (p.mode === 'ground' && p.frozenT === 0 && copCatches(cop, p)) {
      p.frozenT = DETAIN_FRAMES;
      const { pts } = addScore(state, 'detained');
      cop.state = 'patrol';
      events.push({ type: 'sfx', name: 'whistle' }, { type: 'banner', text: 'DETAINED! -500' }, { type: 'score', pts, x: p.x, y: p.y - 30 });
    }
  }

  world.kioskCooldown = world.kioskCooldown.map((c) => Math.max(0, c - 1));
  world.fountainCooldown = world.fountainCooldown.map((c) => Math.max(0, c - 1));
  stepCoins(world, state, events);
  return events;
}
