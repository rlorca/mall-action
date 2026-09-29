import { TILE } from '../world/storeRooms.js';
import { aabb } from '../logic/physics.js';
import { addScore } from '../logic/rules.js';
import { pickJokeItem } from '../logic/secrets.js';
import { storeHooks, isSolidAt, createGuard } from './storeWorld.js';

export const EGG_TEXT = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
export const JOKE_SPRITES = {
  'EXPIRED COUPON': 'joke_coupon', 'PRE-OWNED STRATEGY GUIDE': 'joke_guide', 'PET ROCK': 'joke_rock',
  'MOOD RING': 'joke_ring', '1 SHARE (DOWN 99%)': 'joke_share',
};
const TYPE_FRAMES = 3, GET_FRAMES = 90, TOY_LIFE = 480, TOY_SPEED = 0.75;
const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const CLOCKWISE = { up: 'right', right: 'down', down: 'left', left: 'up' };
const tileRect = (t) => ({ x: t.col * TILE, y: t.row * TILE, w: TILE, h: TILE });
const center = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

// ---- GameStonk easter egg --------------------------------------------------------
function createEgg(world, state, rng) {
  if (world.store.id !== 'gamestonk' || state.gameStonkDone || !world.room.oldMan) return;
  world.egg = { phase: 'type', i: 0, t: 0, item: pickJokeItem(rng) };
  world.frozen = true;
  world.oldManGone = false;
}

function stepEgg(world, pad, state, rng, events) {
  const egg = world.egg;
  if (!egg) return;
  const p = world.player;
  if (egg.phase === 'type') {
    egg.t++;
    if (egg.t % TYPE_FRAMES === 0 && egg.i < EGG_TEXT.length) {
      egg.i++;
      events.push({ type: 'sfx', name: 'blip' });
      if (egg.i === EGG_TEXT.length) egg.phase = 'offer';
    }
  } else if (egg.phase === 'offer') {
    if (aabb(p, tileRect(world.room.pedestal))) {
      Object.assign(egg, { phase: 'get', t: GET_FRAMES });
      Object.assign(p, { holdT: GET_FRAMES, holdItem: JOKE_SPRITES[egg.item] });
      events.push({ type: 'music', name: 'itemGet' });
    }
  } else if (egg.phase === 'get' && --egg.t <= 0) {
    state.inventory.push(egg.item);
    addScore(state, 'jokeItem');
    state.gameStonkDone = true;
    world.oldManGone = true;
    world.frozen = false;
    world.pops.push({ name: 'smoke', col: world.room.oldMan.col, row: world.room.oldMan.row, t: 36 });
    events.push({ type: 'banner', text: `YOU GOT: ${egg.item}` }, { type: 'sfx', name: 'smoke' }, { type: 'music', name: `store_${world.store.id}` });
    world.egg = null;
  }
}

// ---- Sam Baddy listening booth -----------------------------------------------------
function stepBooth(world, events) {
  const b = world.room.booth;
  if (!b || world.booth) return;
  const c = center(world.player);
  if (Math.floor(c.x / TILE) === b.col && Math.floor(c.y / TILE) === b.row) {
    world.booth = true;
    events.push({ type: 'music', name: 'booth' }, { type: 'banner', text: 'NOW PLAYING: SIDE B' });
  }
}

// ---- KGB Toys wind-up toys ---------------------------------------------------------
export function releaseToys(world, idx, rng) {
  if (world.released.has(idx)) return;
  world.released.add(idx);
  const f = world.room.fixtures[idx];
  const dirs = rng.shuffle(Object.keys(DIRS)).slice(0, 3);
  for (const dir of dirs) world.toys.push({ x: f.col * TILE + 4, y: (f.row + 1) * TILE + 4, w: 8, h: 8, dir, life: TOY_LIFE });
}

function stepToys(world, events) {
  const boxFree = (x, y) => ![[x, y], [x + 7, y], [x, y + 7], [x + 7, y + 7]].some(([a, b]) => isSolidAt(world, a, b));
  world.toys = world.toys.filter((t) => {
    const [dx, dy] = DIRS[t.dir];
    const nx = t.x + dx * TOY_SPEED, ny = t.y + dy * TOY_SPEED;
    if (boxFree(nx, ny)) { t.x = nx; t.y = ny; } else t.dir = CLOCKWISE[t.dir];
    for (const g of world.guards) if (!g.dead && aabb(g, t)) g.stunT = 120;
    // a toy walking onto an unsearched trap's front tile sets it off — the smoke stuns nearby guards
    world.room.fixtures.forEach((f, i) => {
      const fx = world.fixtures[i];
      if (fx.searched || fx.type !== 'trap' || !aabb(t, tileRect({ col: f.col, row: f.row + 1 }))) return;
      fx.searched = true;
      world.pops.push({ name: 'smoke', col: f.col, row: f.row + 1, t: 36 });
      events.push({ type: 'sfx', name: 'smoke' });
      const c = { x: f.col * TILE + 8, y: (f.row + 1) * TILE + 8 };
      for (const g of world.guards) if (Math.hypot(g.x + 6 - c.x, g.y + 6 - c.y) <= 24) g.stunT = 60;
    });
    return --t.life > 0;
  });
}

// ---- Forever 12 fitting rooms --------------------------------------------------------
function fittingRoomSurprise(world, idx, state, rng, events) {
  const at = world.room.fixtures[idx];
  const f = world.fixtures[idx];
  if (at.kind !== 'R' || f.surprised || !rng.chance(0.25)) return false;
  f.surprised = true;
  const spots = [[at.col - 1, at.row + 1], [at.col + 1, at.row + 1], [at.col, at.row + 2]];
  const [col, row] = spots.find(([c, r]) => !isSolidAt(world, c * TILE + 8, r * TILE + 8)) ?? [at.col, at.row + 1];
  const g = createGuard({ col, row, type: 'spy' });
  Object.assign(g, { state: 'shriek', t: 30, shoe: true, dir: 'down' });
  world.guards.push(g);
  events.push({ type: 'sfx', name: 'shriek' }, { type: 'banner', text: 'OCCUPIED!!' });
  return true;
}

function stepShoes(world) {
  const p = world.player;
  for (const g of world.guards) {
    if (!g.shoe || g.state !== 'active') continue;
    g.shoe = false;
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
    world.enemyBullets.push({ x: g.x + 2, y: g.y + 2, vx: dx / d, vy: dy / d, w: 8, h: 8, life: 240, shoe: true });
  }
}

storeHooks.create.push(createEgg);
storeHooks.beforeReveal.push(fittingRoomSurprise);
storeHooks.bulletSolid.push((world, b, col, row, state, rng) => {
  const idx = world.room.fixtures.findIndex((f) => f.col === col && f.row === row && f.kind === 'T');
  if (idx >= 0) releaseToys(world, idx, rng);
});
storeHooks.step.push((world, pad, state, rng, events) => {
  stepEgg(world, pad, state, rng, events);
  stepBooth(world, events);
  stepToys(world, events);
  stepShoes(world);
});
