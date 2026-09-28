import { STORES } from '../world/mallLevel.js';
import { roomFor, TILE } from '../world/storeRooms.js';
import { aabb, moveInRoom } from '../logic/physics.js';
import { walkSpeed, searchFrames, fireCooldown, maxBullets, resolveHit, applyPowerup } from '../logic/powerups.js';
import { addScore, difficulty, TARGET_COUNT } from '../logic/rules.js';

export const EXIT_Y = 10 * TILE + 4;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIR_NAMES = Object.keys(DIRS);

// Extension points for Task 17 (store extras): each is an array of functions.
export const storeHooks = {
  create: [],       // (world, state, rng) => void
  beforeReveal: [], // (world, idx, state, rng, events) => handled? (true skips the normal reveal)
  bulletSolid: [],  // (world, bullet, col, row, state, rng, events) => void
  step: [],         // (world, pad, state, rng, events) => void
};

function createGuard({ col, row, type }) {
  return { type, x: col * TILE + 2, y: row * TILE + 2, w: 12, h: 12, dir: 'left', acc: 0, fireT: 120 /* grace period after entering */, stunT: 0, dead: false, deadT: 0, hp: type === 'bot' ? 3 : 1, state: 'active' };
}
export { createGuard };

export function createStoreWorld(storeId, state, rng) {
  const store = STORES.find((s) => s.id === storeId);
  const room = roomFor(store);
  const world = {
    store, room, frame: 0,
    fixtures: state.setup.stores[storeId].fixtures,
    player: { x: 7.5 * TILE - 6, y: 9 * TILE + 2, w: 12, h: 12, facing: 'up', shootT: 0, stunT: 0, holdT: 0, holdItem: null, invulnT: 0, dead: false, dieT: 0 },
    guards: room.guards.map(createGuard),
    bullets: [], enemyBullets: [], search: null, pops: [], toys: [],
    frozen: false, egg: null, booth: false, oldManGone: true, exiting: false,
    released: new Set(),
  };
  for (const h of storeHooks.create) h(world, state, rng);
  return world;
}

const tileAt = (world, px, py) => {
  const col = Math.floor(px / TILE), row = Math.floor(py / TILE);
  if (row < 0 || row >= world.room.rows || col < 0 || col >= world.room.cols) return null;
  return { col, row, kind: world.room.tiles[row][col], ch: world.room.template[row][col] };
};

export function isSolidAt(world, px, py) {
  const t = tileAt(world, px, py);
  if (!t) return true;
  if (t.ch === 'O') return !world.oldManGone;
  return t.kind === 'wall' || t.kind === 'solid';
}
const guardSolidAt = (world, px, py) => isSolidAt(world, px, py) || tileAt(world, px, py)?.kind === 'door';

export function fixtureInFront(world) {
  const p = world.player;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const [fx, fy] = { up: [cx, p.y - 2], down: [cx, p.y + p.h + 1], left: [p.x - 2, cy], right: [p.x + p.w + 1, cy] }[p.facing];
  const col = Math.floor(fx / TILE), row = Math.floor(fy / TILE);
  const i = world.room.fixtures.findIndex((f) => f.col === col && f.row === row);
  return i < 0 ? null : i;
}

function hurtPlayer(world, state, events) {
  const p = world.player;
  if (p.dead || p.invulnT > 0) return;
  const r = resolveHit(state.power);
  if (r === 'ignored') return;
  if (r === 'absorbed') { p.invulnT = 60; events.push({ type: 'sfx', name: 'hurt' }); return; }
  Object.assign(p, { dead: true, dieT: 90 });
  events.push({ type: 'sfx', name: 'death' });
}

export function reveal(world, idx, state, rng, events) {
  for (const h of storeHooks.beforeReveal) if (h(world, idx, state, rng, events)) return;
  const f = world.fixtures[idx];
  const at = world.room.fixtures[idx];
  const p = world.player;
  f.searched = true;
  switch (f.type) {
    case 'package': {
      state.packages.add(world.store.id); state.cleared.add(world.store.id);
      const { pts } = addScore(state, 'package');
      Object.assign(p, { holdT: 60, holdItem: 'package' });
      events.push({ type: 'sfx', name: 'package' }, { type: 'banner', text: `PACKAGE ${state.packages.size}/${TARGET_COUNT}` }, { type: 'score', pts });
      break;
    }
    case 'powerup': {
      const { extraLife } = applyPowerup(state.power, f.id);
      if (extraLife) state.lives += extraLife;
      addScore(state, 'powerup');
      Object.assign(p, { holdT: 30, holdItem: f.id });
      events.push({ type: 'sfx', name: 'powerup' });
      break;
    }
    case 'trap':
      p.stunT = 60;
      world.pops.push({ name: 'smoke', col: at.col, row: at.row, t: 36 });
      events.push({ type: 'sfx', name: 'smoke' });
      break;
    default:
      world.pops.push({ name: 'nothingPuff', col: at.col, row: at.row, t: 24 });
      events.push({ type: 'sfx', name: 'searchTick' });
  }
}

function movePlayer(world, pad, state) {
  const p = world.player;
  const speed = walkSpeed(state.power);
  let dx = 0, dy = 0;
  if (pad.held('up')) { dy = -speed; p.facing = 'up'; }
  else if (pad.held('down')) { dy = speed; p.facing = 'down'; }
  else if (pad.held('left')) { dx = -speed; p.facing = 'left'; }
  else if (pad.held('right')) { dx = speed; p.facing = 'right'; }
  if (!dx && !dy) return false;
  const solid = (x, y) => isSolidAt(world, x, y);
  const { hitX, hitY } = moveInRoom(p, dx, dy, solid);
  // corner assist: when nearly lined up with a gap, nudge sideways so the player slides around tile corners (Zelda-style)
  const boxFree = (x, y) => ![[x, y], [x + p.w - 1, y], [x, y + p.h - 1], [x + p.w - 1, y + p.h - 1]].some(([a, b]) => solid(Math.floor(a), Math.floor(b)));
  const nudge = (axis, d) => {
    for (let o = 1; o <= 4; o++) for (const sgn of [1, -1]) {
      const ox = axis === 'x' ? o * sgn : 0, oy = axis === 'y' ? o * sgn : 0;
      if (boxFree(p.x + ox, p.y + oy) && boxFree(p.x + ox + (axis === 'y' ? d : 0), p.y + oy + (axis === 'x' ? d : 0))) { p[axis] += sgn; return; }
    }
  };
  if (hitY && dx === 0) nudge('x', dy);
  if (hitX && dy === 0) nudge('y', dx);
  return true;
}

function fire(world, state, events) {
  const p = world.player;
  if (p.shootT > 0) return;
  if (world.bullets.length >= maxBullets(state.power)) return;
  p.shootT = fireCooldown(state.power);
  const [ux, uy] = DIRS[p.facing];
  const cx = p.x + p.w / 2 - 2, cy = p.y + p.h / 2 - 2;
  const shots = [[ux * 3, uy * 3]];
  if (state.power.weapon === 'spread') shots.push([ux * 2.6 - uy * 1.5, uy * 2.6 - ux * 1.5], [ux * 2.6 + uy * 1.5, uy * 2.6 + ux * 1.5]);
  for (const [vx, vy] of shots) world.bullets.push({ x: cx, y: cy, vx, vy, w: 4, h: 4, life: 90 });
  events.push({ type: 'sfx', name: 'shot' });
}

function clearLine(world, a, b) {
  const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 4);
  for (let i = 1; i < steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps + 6, y = a.y + ((b.y - a.y) * i) / steps + 6;
    if (isSolidAt(world, x, y)) return false;
  }
  return true;
}

function stepGuard(world, g, state, rng, diff, events) {
  const p = world.player;
  if (g.dead) { g.deadT--; return; }
  if (g.stunT > 0) { g.stunT--; return; }
  if (g.state === 'shriek') { if (--g.t <= 0) g.state = 'active'; return; }
  if (g.type === 'bot') {
    const [dx, dy] = DIRS[g.dir === 'left' || g.dir === 'right' ? g.dir : 'left'];
    const r = moveInRoom(g, dx * 0.8, dy * 0.8, (x, y) => guardSolidAt(world, x, y));
    if (r.hitX) g.dir = g.dir === 'left' ? 'right' : 'left';
  } else {
    g.acc += diff.spySpeed * 0.8;
    while (g.acc >= 1) {
      g.acc -= 1;
      if ((g.x - 2) % TILE === 0 && (g.y - 2) % TILE === 0) {
        const open = DIR_NAMES.filter((d) => { const [ox, oy] = DIRS[d]; return !guardSolidAt(world, g.x + 6 + ox * TILE, g.y + 6 + oy * TILE); });
        const dx = p.x - g.x, dy = p.y - g.y;
        const toward = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        if (open.includes(toward) && rng.chance(0.6)) g.dir = toward;
        else if (!open.includes(g.dir) || rng.chance(0.25)) g.dir = open.length ? rng.pick(open) : g.dir;
        if (!open.includes(g.dir)) break;
      }
      const [ox, oy] = DIRS[g.dir];
      g.x += ox; g.y += oy;
    }
    if (--g.fireT <= 0 && !p.dead) {
      const alignedX = Math.abs(g.x - p.x) <= 4, alignedY = Math.abs(g.y - p.y) <= 4;
      if ((alignedX || alignedY) && clearLine(world, g, p)) {
        const vx = alignedY ? Math.sign(p.x - g.x) * 2 : 0, vy = alignedX ? Math.sign(p.y - g.y) * 2 : 0;
        world.enemyBullets.push({ x: g.x + 4, y: g.y + 4, vx, vy, w: 4, h: 4, life: 150 });
        events.push({ type: 'sfx', name: 'enemyShot' });
        g.fireT = diff.fireInterval;
      }
    }
  }
  if (!p.dead && aabb(g, p)) hurtPlayer(world, state, events);
}

function stepBullets(world, state, rng, events) {
  world.bullets = world.bullets.filter((b) => {
    b.x += b.vx; b.y += b.vy;
    if (--b.life <= 0) return false;
    const cx = b.x + 2, cy = b.y + 2;
    if (isSolidAt(world, cx, cy)) {
      const t = tileAt(world, cx, cy);
      if (t) for (const h of storeHooks.bulletSolid) h(world, b, t.col, t.row, state, rng, events);
      return false;
    }
    for (const g of world.guards) {
      if (g.dead || !aabb(g, b)) continue;
      if (--g.hp <= 0) {
        Object.assign(g, { dead: true, deadT: 24 });
        const { pts } = addScore(state, 'spyShot');
        events.push({ type: 'sfx', name: 'hurt' }, { type: 'score', pts });
      } else events.push({ type: 'sfx', name: 'ping' });
      return false;
    }
    return true;
  });
  world.enemyBullets = world.enemyBullets.filter((b) => {
    b.x += b.vx; b.y += b.vy;
    if (--b.life <= 0 || isSolidAt(world, b.x + 2, b.y + 2)) return false;
    if (!world.player.dead && aabb(world.player, b)) { hurtPlayer(world, state, events); return false; }
    return true;
  });
  world.guards = world.guards.filter((g) => !g.dead || g.deadT > 0);
}

export function stepStore(world, pad, state, rng) {
  const events = [];
  const p = world.player;
  world.frame++;
  state.levelFrames++;
  const diff = difficulty(state.loop, { blackFriday: state.blackFriday });
  world.pops = world.pops.filter((x) => --x.t > 0);
  if (p.invulnT > 0) p.invulnT--;
  if (p.shootT > 0) p.shootT--;

  for (const h of storeHooks.step) h(world, pad, state, rng, events);

  if (p.dead) {
    if (--p.dieT === 0) events.push({ type: 'playerDied' });
    return events;
  }

  const inputLocked = world.frozen && world.egg?.phase === 'type';
  if (p.holdT > 0) { if (--p.holdT === 0) p.holdItem = null; }
  else if (p.stunT > 0) p.stunT--;
  else if (!inputLocked) {
    const idx = fixtureInFront(world);
    if (pad.held('b') && idx !== null && !world.fixtures[idx].searched) {
      if (world.search?.idx !== idx) world.search = { idx, t: 0 };
      world.search.t++;
      if (world.search.t % 8 === 0) events.push({ type: 'sfx', name: 'searchTick' });
      if (world.search.t >= searchFrames(state.power)) { world.search = null; reveal(world, idx, state, rng, events); }
    } else {
      world.search = null;
      movePlayer(world, pad, state);
      if (pad.pressed('a')) fire(world, state, events);
    }
  }

  if (!world.exiting && p.y + p.h > EXIT_Y) {
    world.exiting = true;
    events.push({ type: 'exitStore', storeId: world.store.id });
    return events;
  }

  if (!world.frozen) for (const g of world.guards) stepGuard(world, g, state, rng, diff, events);
  stepBullets(world, state, rng, events);
  return events;
}
