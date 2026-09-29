import {
  BANNER_FRAMES,
  BOT_HITS,
  FITTING_ROOM_SPY_CHANCE,
  GUARD_GRACE_FRAMES,
  PACKAGES_TOTAL,
  SCORE_JOKE_ITEM,
  SCORE_PACKAGE,
  SCORE_SPY,
  SEARCH_FRAMES,
  SEARCH_FRAMES_SNEAKERS,
  STORE_SNEAKER_SPEED,
  STORE_SPRITE_H,
  STORE_WALK_SPEED,
  SCREEN_W,
  TILE,
  TRAP_STUN_FRAMES,
  VIEW_H,
  sec,
} from './constants';
import {
  FIRST_VISIT_LINES,
  FITTING_ROOM_BUBBLE,
  JOKE_ITEMS,
  LISTENING_BOOTH,
  NOTHING_BANNER,
  TRAP_BANNER,
  ZELDA_CAVE_LINES,
} from './copy';
import { Button, type Pad } from './input';
import { fixtureKey } from './level';
import { absorbHit, applyPowerUp, POWERUPS, type PowerUpId } from './powerups';
import {
  SEARCHABLE,
  STORE_BY_ID,
  TILE_BOOTH,
  TILE_DOOR,
  TILE_FITTING,
  TILE_PEDESTAL,
  TILE_TOYSHELF,
  WALKABLE,
  type StoreDef,
} from './storeDefs';
import type { Banner, Fixture, GameState, StoreGuard, StoreState } from './types';

/** dir: 0 down, 1 left, 2 right, 3 up. */
/** Startle window after a fitting-room ambush. */
export const AMBUSH_GRACE = sec(1);

export const DIR_DX = [0, -1, 1, 0] as const;
export const DIR_DY = [1, 0, 0, -1] as const;

const HITBOX = 11;
const BULLET_SPEED = 3;
const GUARD_SPEED = 0.6;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function roomWidth(st: StoreState): number {
  return st.tiles[0].length * TILE;
}
export function roomHeight(st: StoreState): number {
  return st.tiles.length * TILE;
}

export function tileAt(st: StoreState, tx: number, ty: number): string {
  if (ty < 0 || ty >= st.tiles.length) return '#';
  const row = st.tiles[ty];
  if (tx < 0 || tx >= row.length) return '#';
  return row[tx];
}

export function isWalkable(st: StoreState, tx: number, ty: number): boolean {
  return WALKABLE.has(tileAt(st, tx, ty));
}

/** The door tile columns on the bottom row. */
export function doorTiles(st: StoreState): number[] {
  const out: number[] = [];
  const ty = st.tiles.length - 1;
  for (let tx = 0; tx < st.tiles[ty].length; tx++) {
    if (st.tiles[ty][tx] === TILE_DOOR) out.push(tx);
  }
  return out;
}

export function newStoreState(g: GameState, def: StoreDef): StoreState {
  const rt = g.level.stores[def.id];
  const tiles = [...(def.layout ?? [])];

  const fixtures: Fixture[] = [];
  for (let ty = 0; ty < tiles.length; ty++) {
    for (let tx = 0; tx < tiles[ty].length; tx++) {
      const ch = tiles[ty][tx];
      if (!SEARCHABLE.has(ch)) continue;
      const key = fixtureKey(tx, ty);
      const c = rt.contents[key] ?? { content: 'nothing' as const, powerup: null };
      fixtures.push({
        tx,
        ty,
        char: ch,
        content: c.content,
        powerup: c.powerup,
        // Searched fixtures stay open for the rest of the level, including
        // after leaving and coming back.
        opened: rt.opened[key] === true,
      });
    }
  }

  const st: StoreState = {
    storeId: def.id,
    tiles,
    fixtures,
    guards: [],
    bullets: [],
    toys: [],
    player: {
      x: 0,
      y: 0,
      dir: 3,
      stunFrames: 0,
      searchFrames: 0,
      searchTarget: null,
      searchLatch: true, // B may still be held from opening the door
      holdFrames: 0,
      holdText: '',
      shootCooldown: 0,
      invulnFrames: 0,
      anim: 0,
    },
    camX: 0,
    camY: 0,
    banners: [],
    bubbles: [],
    popups: [],
    graceFrames: GUARD_GRACE_FRAMES,
    cutscene: 'none',
    cutsceneFrames: 0,
    cutsceneText: [],
    pedestalItem: null,
    clerkVisible: false,
    onBooth: false,
    fade: 0,
    fadeOut: false,
    nextGuardId: 1,
    exiting: false,
  };

  // Enter just INSIDE the doorway. Standing on the door tile itself would trip
  // the walk-out check on the very first frame and bounce us back to the mall.
  const door = doorTiles(st);
  const dx = door.length ? (door[0] + door[door.length - 1] + 1) / 2 : tiles[0].length / 2;
  st.player.x = dx * TILE;
  st.player.y = (tiles.length - 2) * TILE + TILE / 2;

  spawnGuards(g, st, def);

  // First visit this game: guards hold still and say their lines.
  if (!g.visitedStores[def.id] && FIRST_VISIT_LINES[def.id]) {
    g.visitedStores[def.id] = true;
    st.cutscene = 'firstVisit';
    st.cutsceneFrames = 0;
  } else {
    g.visitedStores[def.id] = true;
  }

  // GameStonk easter egg: the first time each game.
  if (def.id === 'gamestonk' && !g.zeldaEggUsed) {
    g.zeldaEggUsed = true;
    st.cutscene = 'zelda';
    st.cutsceneFrames = 0;
    st.cutsceneText = [...ZELDA_CAVE_LINES];
    st.clerkVisible = true;
  }

  return st;
}

/**
 * 1 to 3 guards per store. They come back if you leave and re-enter a store
 * whose package is still inside, which falls out of rebuilding them here.
 */
function spawnGuards(g: GameState, st: StoreState, def: StoreDef): void {
  const n = g.rng.range(1, 3);
  const spots: { x: number; y: number }[] = [];
  for (let ty = 1; ty < st.tiles.length - 2; ty++) {
    for (let tx = 1; tx < st.tiles[ty].length - 1; tx++) {
      if (!isWalkable(st, tx, ty)) continue;
      const py = ty * TILE + TILE / 2;
      // Keep them away from the doorway so the player is not ambushed on entry.
      if (Math.abs(py - st.player.y) < TILE * 3) continue;
      spots.push({ x: tx * TILE + TILE / 2, y: py });
    }
  }
  g.rng.shuffle(spots);
  for (let i = 0; i < n && i < spots.length; i++) {
    const isBot = def.theme === 'gadgets' || def.theme === 'electronics' ? g.rng.chance(0.5) : g.rng.chance(0.25);
    st.guards.push({
      id: st.nextGuardId++,
      kind: isBot ? 'bot' : 'spy',
      x: spots[i].x,
      y: spots[i].y,
      dir: 0,
      hp: isBot ? BOT_HITS : 1,
      think: 0,
      shootTimer: sec(1.5),
      stunFrames: 0,
      deadFrames: 0,
      patrolDir: g.rng.chance(0.5) ? -1 : 1,
      patrolVertical: g.rng.chance(0.5),
      bubbleFrames: 0,
      bubbleText: '',
    });
  }
}

// ---------------------------------------------------------------------------
// Collision
// ---------------------------------------------------------------------------

function solidAtPixel(st: StoreState, x: number, y: number): boolean {
  return !isWalkable(st, Math.floor(x / TILE), Math.floor(y / TILE));
}

function boxBlocked(st: StoreState, x: number, y: number): boolean {
  const h = HITBOX / 2;
  return (
    solidAtPixel(st, x - h, y - h) ||
    solidAtPixel(st, x + h, y - h) ||
    solidAtPixel(st, x - h, y + h) ||
    solidAtPixel(st, x + h, y + h)
  );
}

/**
 * Move with a gentle Zelda-style corner assist: if the straight move is
 * blocked, try sliding up to 2px perpendicular so it is easy to slip through
 * a gap you are only slightly misaligned with.
 */
function moveWithAssist(st: StoreState, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  if (!boxBlocked(st, x + dx, y + dy)) return { x: x + dx, y: y + dy };

  const assist = dx !== 0 ? [0, -1, 1, -2, 2] : [0];
  if (dx !== 0) {
    for (const a of assist) {
      if (a !== 0 && !boxBlocked(st, x + dx, y + a)) return { x: x + dx, y: y + a };
    }
  }
  if (dy !== 0) {
    for (const a of [-1, 1, -2, 2]) {
      if (!boxBlocked(st, x + a, y + dy)) return { x: x + a, y: y + dy };
    }
  }
  return { x, y };
}

// ---------------------------------------------------------------------------
// Search targeting
// ---------------------------------------------------------------------------

/**
 * The fixture the agent is touching, preferring the one he faces, then either
 * side, then behind. Deliberately forgiving: the agent's box is expanded so a
 * fixture touched at a gap still counts.
 */
export function searchTargetFor(st: StoreState): Fixture | null {
  const p = st.player;
  const order = [p.dir, ...([0, 1, 2, 3] as const).filter((d) => d !== p.dir && d !== opposite(p.dir)), opposite(p.dir)];

  for (const dir of order) {
    const tx = Math.floor((p.x + DIR_DX[dir] * TILE * 0.8) / TILE);
    const ty = Math.floor((p.y + DIR_DY[dir] * TILE * 0.8) / TILE);
    const f = st.fixtures.find((x) => x.tx === tx && x.ty === ty && !x.opened);
    if (f) return f;
  }

  // Fallback: any unopened fixture overlapping a slightly expanded hitbox.
  const h = HITBOX / 2 + 5;
  let best: Fixture | null = null;
  let bestD = Infinity;
  for (const f of st.fixtures) {
    if (f.opened) continue;
    const fx = f.tx * TILE;
    const fy = f.ty * TILE;
    if (p.x + h < fx || p.x - h > fx + TILE || p.y + h < fy || p.y - h > fy + TILE) continue;
    const d = Math.hypot(p.x - (fx + TILE / 2), p.y - (fy + TILE / 2));
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function opposite(d: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
  return ([3, 2, 1, 0] as const)[d];
}

function faceFixture(st: StoreState, f: Fixture): void {
  const p = st.player;
  const cx = f.tx * TILE + TILE / 2;
  const cy = f.ty * TILE + TILE / 2;
  if (Math.abs(cy - p.y) >= Math.abs(cx - p.x)) p.dir = cy > p.y ? 0 : 3;
  else p.dir = cx > p.x ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Main step
// ---------------------------------------------------------------------------

export function stepStore(g: GameState, pad: Pad): void {
  const st = g.store!;
  const def = STORE_BY_ID.get(st.storeId)!;
  st.player.anim++;
  if (st.graceFrames > 0) st.graceFrames--;
  if (st.player.shootCooldown > 0) st.player.shootCooldown--;
  if (st.player.invulnFrames > 0) st.player.invulnFrames--;
  if (st.player.holdFrames > 0) st.player.holdFrames--;

  decay(st);
  // Before the cutscene check: the camera must be right on the very first
  // frame, or a room opening on a cutscene would be drawn off-centre.
  updateStoreCamera(st);

  if (st.cutscene !== 'none') {
    stepCutscene(g, st, pad);
    return;
  }

  if (st.player.stunFrames > 0) {
    st.player.stunFrames--;
  } else {
    stepStorePlayer(g, st, def, pad);
  }

  stepGuards(g, st);
  stepStoreBullets(g, st);
  stepToys(g, st);
  updateStoreCamera(st);
}

function decay(st: StoreState): void {
  for (const b of st.banners) b.frames--;
  st.banners = st.banners.filter((b) => b.frames > 0);
  for (const b of st.bubbles) b.frames--;
  st.bubbles = st.bubbles.filter((b) => b.frames > 0);
  for (const p of st.popups) {
    p.frames--;
    p.y -= 0.5;
  }
  st.popups = st.popups.filter((p) => p.frames > 0);
}

function storeBanner(st: StoreState, lines: string[], kind: Banner['kind'] = 'info'): void {
  st.banners = [{ lines, frames: BANNER_FRAMES, kind }];
}

export function updateStoreCamera(st: StoreState): void {
  // Built for ANY room size. Every room is one screen for now, but the camera
  // is here so the big anchor department stores can be added later.
  // The usable height excludes the bottom info strip, so a one-screen room
  // sits centred in what the player actually sees.
  const rw = roomWidth(st);
  const rh = roomHeight(st);
  const usableH = VIEW_H - STORE_STRIP_H;
  st.camX = rw <= SCREEN_W ? Math.round((SCREEN_W - rw) / -2) : clamp(st.player.x - SCREEN_W / 2, 0, rw - SCREEN_W);
  st.camY =
    rh <= usableH
      ? Math.round((usableH - rh) / -2)
      : clamp(st.player.y - usableH / 2, 0, rh - usableH);
  st.camX = Math.round(st.camX);
  st.camY = Math.round(st.camY);
}

/** Height of the bottom strip the store scene reserves for its labels. */
export const STORE_STRIP_H = 14;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function stepStorePlayer(g: GameState, st: StoreState, def: StoreDef, pad: Pad): void {
  const p = st.player;
  const speed = g.powerups.speed ? STORE_SNEAKER_SPEED : STORE_WALK_SPEED;

  // Vertical input takes priority.
  let dx = 0;
  let dy = 0;
  let newDir: 0 | 1 | 2 | 3 | null = null;
  if (pad.down(Button.Up)) {
    dy = -speed;
    newDir = 3;
  } else if (pad.down(Button.Down)) {
    dy = speed;
    newDir = 0;
  } else if (pad.down(Button.Left)) {
    dx = -speed;
    newDir = 1;
  } else if (pad.down(Button.Right)) {
    dx = speed;
    newDir = 2;
  }

  const freshDirection =
    pad.pressed(Button.Up) || pad.pressed(Button.Down) || pad.pressed(Button.Left) || pad.pressed(Button.Right);

  // --- searching ---------------------------------------------------------
  if (p.searchFrames > 0) {
    // Only a FRESH press of a different direction, or shooting, cancels it.
    if (freshDirection || pad.pressed(Button.A)) {
      p.searchFrames = 0;
      p.searchTarget = null;
    } else {
      p.searchFrames++;
      const total = g.powerups.speed ? SEARCH_FRAMES_SNEAKERS : SEARCH_FRAMES;
      if (p.searchFrames % 6 === 0) g.bus.sfx('searchTick');
      if (p.searchFrames >= total) {
        const target = p.searchTarget!;
        p.searchFrames = 0;
        p.searchTarget = null;
        // Holding B after a search must not immediately search the next one.
        p.searchLatch = pad.down(Button.B);
        resolveSearch(g, st, def, target);
      }
      return;
    }
  }

  if (!pad.down(Button.B)) p.searchLatch = false;

  if (newDir !== null) p.dir = newDir;

  if (dx !== 0 || dy !== 0) {
    const moved = moveWithAssist(st, p.x, p.y, dx, dy);
    p.x = moved.x;
    p.y = moved.y;
  }

  // --- walking out through the door --------------------------------------
  const rh = roomHeight(st);
  if (p.y > rh - TILE / 2 - 2 && !st.exiting) {
    const tx = Math.floor(p.x / TILE);
    if (tileAt(st, tx, st.tiles.length - 1) === TILE_DOOR) {
      st.exiting = true;
      g.bus.sfx('door');
      exitStore(g);
      return;
    }
  }

  // --- listening booth ---------------------------------------------------
  const onBooth = tileAt(st, Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === TILE_BOOTH;
  if (onBooth !== st.onBooth) {
    st.onBooth = onBooth;
    if (onBooth) {
      storeBanner(st, [LISTENING_BOOTH]);
      g.bus.music('bonus');
    } else {
      g.bus.music(def.music ?? 'mallAmbient');
    }
  }

  // --- GameStonk pedestal ------------------------------------------------
  if (st.pedestalItem && tileAt(st, Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === TILE_PEDESTAL) {
    const item = st.pedestalItem;
    st.pedestalItem = null;
    st.clerkVisible = false;
    st.cutscene = 'itemGet';
    st.cutsceneFrames = 0;
    st.cutsceneText = [`YOU GOT: ${item}`];
    g.inventory.push(item);
    g.score += SCORE_JOKE_ITEM;
    g.bus.sfx('itemGet');
    g.bus.sfx('smoke');
    return;
  }

  // --- shooting ----------------------------------------------------------
  if (pad.pressed(Button.A) && p.shootCooldown === 0) {
    p.shootCooldown = g.powerups.weapon === 'rapid' ? sec(0.12) : sec(0.28);
    const vx = DIR_DX[p.dir] * BULLET_SPEED;
    const vy = DIR_DY[p.dir] * BULLET_SPEED;
    st.bullets.push({ x: p.x, y: p.y, vx, vy, fromPlayer: true });
    if (g.powerups.weapon === 'spread') {
      const perp = p.dir === 1 || p.dir === 2 ? 1 : 0;
      st.bullets.push({ x: p.x, y: p.y, vx: perp ? vx : 1.6, vy: perp ? 1.6 : vy, fromPlayer: true });
      st.bullets.push({ x: p.x, y: p.y, vx: perp ? vx : -1.6, vy: perp ? -1.6 : vy, fromPlayer: true });
    }
    g.bus.sfx('shot');
    shootToyShelf(g, st);
  }

  // --- starting a search --------------------------------------------------
  if (pad.pressed(Button.B) && !p.searchLatch) {
    const target = searchTargetFor(st);
    if (target) {
      faceFixture(st, target);
      p.searchTarget = target;
      p.searchFrames = 1;
      g.bus.sfx('searchTick');
    }
  }

  checkGuardContact(g, st);
}

/** The bottom-strip hint the renderer shows. */
export function searchHintVisible(st: StoreState): boolean {
  return st.player.searchFrames === 0 && searchTargetFor(st) !== null;
}

// ---------------------------------------------------------------------------
// Search resolution
// ---------------------------------------------------------------------------

function resolveSearch(g: GameState, st: StoreState, def: StoreDef, f: Fixture): void {
  const rt = g.level.stores[def.id];

  // Forever 12 fitting rooms: 25% chance of a spy mid-change. The fitting
  // room's real contents stay unsearched.
  if (f.char === TILE_FITTING && !rt.fittingRoomUsed && g.rng.chance(FITTING_ROOM_SPY_CHANCE)) {
    rt.fittingRoomUsed = true;
    st.bubbles.push({
      x: f.tx * TILE + TILE / 2,
      y: f.ty * TILE,
      text: FITTING_ROOM_BUBBLE,
      frames: sec(1.8),
    });
    g.bus.sfx('shriek');
    // Being ambushed mid-search must not be an unavoidable death: the startle
    // window covers the shoe and the spy's first step out of the cubicle.
    st.player.invulnFrames = Math.max(st.player.invulnFrames, AMBUSH_GRACE);
    const spyX = f.tx * TILE + TILE / 2;
    const spyY = f.ty * TILE + TILE + TILE / 2;
    st.guards.push({
      id: st.nextGuardId++,
      kind: 'spy',
      x: spyX,
      y: spyY,
      dir: 0,
      hp: 1,
      think: sec(0.6),
      shootTimer: sec(1.2),
      stunFrames: 0,
      deadFrames: 0,
      patrolDir: 1,
      patrolVertical: false,
      bubbleFrames: 0,
      bubbleText: '',
    });
    // He throws a shoe as he comes out, aimed at whoever opened the curtain.
    const dx = st.player.x - spyX;
    const dy = st.player.y - spyY;
    const len = Math.hypot(dx, dy) || 1;
    st.bullets.push({
      x: spyX,
      y: spyY,
      vx: (dx / len) * BULLET_SPEED,
      vy: (dy / len) * BULLET_SPEED,
      fromPlayer: false,
    });
    return;
  }

  f.opened = true;
  rt.opened[fixtureKey(f.tx, f.ty)] = true;

  switch (f.content) {
    case 'package': {
      rt.cleared = true;
      g.level.packages++;
      g.score += SCORE_PACKAGE;
      st.player.holdFrames = sec(1.6);
      st.player.holdText = 'PACKAGE';
      storeBanner(st, [`PACKAGE ${g.level.packages}/${PACKAGES_TOTAL}`]);
      g.bus.sfx('packageFanfare');
      break;
    }
    case 'powerup': {
      const id = f.powerup as PowerUpId;
      const extra = applyPowerUp(g.powerups, id);
      if (extra) g.lives += extra;
      st.player.holdFrames = sec(1.2);
      st.player.holdText = POWERUPS[id].name;
      storeBanner(st, [POWERUPS[id].name]);
      g.bus.sfx(id === 'oneup' ? 'itemGet' : 'powerup');
      break;
    }
    case 'trap': {
      st.player.stunFrames = TRAP_STUN_FRAMES;
      storeBanner(st, [TRAP_BANNER]);
      g.bus.sfx('smoke');
      g.bus.shake(8, 2);
      break;
    }
    case 'nothing':
      storeBanner(st, [NOTHING_BANNER]);
      g.bus.sfx('smoke');
      break;
  }
}

/** KGB Toys: shooting a toy shelf releases 3 wind-up toys. */
function shootToyShelf(g: GameState, st: StoreState): void {
  const p = st.player;
  const tx = Math.floor((p.x + DIR_DX[p.dir] * TILE) / TILE);
  const ty = Math.floor((p.y + DIR_DY[p.dir] * TILE) / TILE);
  if (tileAt(st, tx, ty) !== TILE_TOYSHELF) return;
  for (let i = 0; i < 3; i++) {
    st.toys.push({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      dir: ([0, 1, 2, 3] as const)[i % 4],
      frames: sec(12),
    });
  }
  g.bus.sfx('blip');
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function stepGuards(g: GameState, st: StoreState): void {
  const p = st.player;
  const keep: StoreGuard[] = [];

  for (const gd of st.guards) {
    if (gd.bubbleFrames > 0) gd.bubbleFrames--;
    if (gd.deadFrames > 0) {
      gd.deadFrames--;
      if (gd.deadFrames > 0) keep.push(gd);
      continue;
    }
    if (gd.stunFrames > 0) {
      gd.stunFrames--;
      keep.push(gd);
      continue;
    }

    if (gd.kind === 'bot') {
      // Patrol back and forth.
      const dx = gd.patrolVertical ? 0 : gd.patrolDir * GUARD_SPEED;
      const dy = gd.patrolVertical ? gd.patrolDir * GUARD_SPEED : 0;
      const moved = moveWithAssist(st, gd.x, gd.y, dx, dy);
      if (moved.x === gd.x && moved.y === gd.y) gd.patrolDir = (-gd.patrolDir) as -1 | 1;
      gd.x = moved.x;
      gd.y = moved.y;
      gd.dir = gd.patrolVertical ? (gd.patrolDir > 0 ? 0 : 3) : gd.patrolDir > 0 ? 2 : 1;
    } else {
      // Spies move tile by tile, favouring the player.
      if (--gd.think <= 0) {
        gd.think = sec(0.35);
        const ddx = p.x - gd.x;
        const ddy = p.y - gd.y;
        gd.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 2 : 1) : ddy > 0 ? 0 : 3;
      }
      const moved = moveWithAssist(st, gd.x, gd.y, DIR_DX[gd.dir] * GUARD_SPEED, DIR_DY[gd.dir] * GUARD_SPEED);
      if (moved.x === gd.x && moved.y === gd.y) {
        gd.dir = ([0, 1, 2, 3] as const)[g.rng.int(4)];
        gd.think = sec(0.3);
      }
      gd.x = moved.x;
      gd.y = moved.y;

      // Shoot along straight lines when lined up with a clear path.
      if (gd.shootTimer > 0) gd.shootTimer--;
      if (gd.shootTimer <= 0 && st.graceFrames === 0) {
        const aligned = alignment(st, gd, p.x, p.y);
        if (aligned) {
          gd.dir = aligned;
          st.bullets.push({
            x: gd.x,
            y: gd.y,
            vx: DIR_DX[aligned] * 2,
            vy: DIR_DY[aligned] * 2,
            fromPlayer: false,
          });
          gd.shootTimer = Math.max(sec(0.8), Math.round(sec(2) / g.level.fireMult));
          g.bus.sfx('enemyShot');
        }
      }
    }

    keep.push(gd);
  }

  st.guards = keep;
}

/** The direction a guard could shoot the player along, or null. */
function alignment(st: StoreState, gd: StoreGuard, px: number, py: number): 0 | 1 | 2 | 3 | null {
  if (Math.abs(py - gd.y) < 8) {
    const dir = px > gd.x ? 2 : 1;
    if (clearLine(st, gd.x, gd.y, px, gd.y)) return dir;
  }
  if (Math.abs(px - gd.x) < 8) {
    const dir = py > gd.y ? 0 : 3;
    if (clearLine(st, gd.x, gd.y, gd.x, py)) return dir;
  }
  return null;
}

function clearLine(st: StoreState, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
  for (let i = 1; i < steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (solidAtPixel(st, x, y)) return false;
  }
  return true;
}

function checkGuardContact(g: GameState, st: StoreState): void {
  const p = st.player;
  if (p.invulnFrames > 0) return;
  for (const gd of st.guards) {
    if (gd.deadFrames > 0) continue;
    if (Math.abs(gd.x - p.x) > 11 || Math.abs(gd.y - p.y) > 11) continue;
    if (g.powerups.invulnFrames > 0) {
      killGuard(g, st, gd);
      continue;
    }
    if (absorbHit(g.powerups)) {
      p.invulnFrames = sec(1.2);
      g.bus.sfx('ping');
      continue;
    }
    playerDiedInStore(g);
    return;
  }
}

function killGuard(g: GameState, st: StoreState, gd: StoreGuard): void {
  gd.deadFrames = sec(0.4);
  g.score += SCORE_SPY;
  st.popups.push({ x: gd.x, y: gd.y - STORE_SPRITE_H, text: `+${SCORE_SPY}`, frames: sec(0.8) });
  g.bus.sfx('death');
}

// ---------------------------------------------------------------------------
// Bullets and toys
// ---------------------------------------------------------------------------

function stepStoreBullets(g: GameState, st: StoreState): void {
  const p = st.player;
  st.bullets = st.bullets.filter((b) => {
    b.x += b.vx;
    b.y += b.vy;
    if (solidAtPixel(st, b.x, b.y)) return false;
    if (b.x < 0 || b.y < 0 || b.x > roomWidth(st) || b.y > roomHeight(st)) return false;

    if (b.fromPlayer) {
      for (const gd of st.guards) {
        if (gd.deadFrames > 0) continue;
        if (Math.abs(gd.x - b.x) < 8 && Math.abs(gd.y - b.y) < 8) {
          gd.hp--;
          if (gd.hp <= 0) killGuard(g, st, gd);
          else g.bus.sfx('ping');
          return false;
        }
      }
    } else if (p.invulnFrames === 0 && Math.abs(p.x - b.x) < 7 && Math.abs(p.y - b.y) < 7) {
      if (g.powerups.invulnFrames > 0) return false;
      if (absorbHit(g.powerups)) {
        p.invulnFrames = sec(1.2);
        g.bus.sfx('ping');
        return false;
      }
      playerDiedInStore(g);
      return false;
    }
    return true;
  });
}

function stepToys(g: GameState, st: StoreState): void {
  st.toys = st.toys.filter((t) => {
    t.frames--;
    if (t.frames <= 0) return false;
    const moved = moveWithAssist(st, t.x, t.y, DIR_DX[t.dir] * 0.8, DIR_DY[t.dir] * 0.8);
    if (moved.x === t.x && moved.y === t.y) {
      // Turn at walls.
      t.dir = ([2, 3, 0, 1] as const)[t.dir];
    }
    t.x = moved.x;
    t.y = moved.y;
    for (const gd of st.guards) {
      if (gd.deadFrames > 0 || gd.stunFrames > 0) continue;
      if (Math.abs(gd.x - t.x) < 10 && Math.abs(gd.y - t.y) < 10) {
        gd.stunFrames = sec(2);
        g.bus.sfx('smoke');
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Cutscenes
// ---------------------------------------------------------------------------

function stepCutscene(g: GameState, st: StoreState, pad: Pad): void {
  st.cutsceneFrames++;

  if (st.cutscene === 'firstVisit') {
    const lines = FIRST_VISIT_LINES[st.storeId] ?? [];
    // Guards hold still and say their lines; the second about 1 s later.
    if (st.cutsceneFrames === 1 && lines[0]) sayLine(st, 0, lines[0]);
    if (st.cutsceneFrames === sec(1) && lines[1]) sayLine(st, 1, lines[1]);
    if (st.cutsceneFrames > sec(1) + sec(1.8) || pad.pressed(Button.Start)) {
      st.cutscene = 'none';
      st.cutsceneFrames = 0;
    }
    return;
  }

  if (st.cutscene === 'zelda') {
    // Guards and input freeze while the typewriter box prints.
    const typed = Math.floor(st.cutsceneFrames / 2);
    const total = st.cutsceneText.join('').length;
    if (st.cutsceneFrames % 4 === 0 && typed <= total) g.bus.sfx('blip');
    if (typed >= total + 30 || pad.pressed(Button.Start)) {
      st.cutscene = 'none';
      st.cutsceneFrames = 0;
      // The item is random, and useless.
      st.pedestalItem = g.rng.pick(JOKE_ITEMS);
      g.bus.sfx('itemGet');
    }
    return;
  }

  if (st.cutscene === 'itemGet') {
    if (st.cutsceneFrames > sec(2.2) || pad.pressed(Button.Start)) {
      st.cutscene = 'none';
      st.cutsceneFrames = 0;
    }
  }
}

function sayLine(st: StoreState, idx: number, text: string): void {
  const gd = st.guards[Math.min(idx, st.guards.length - 1)];
  const x = gd ? gd.x : roomWidth(st) / 2;
  const y = gd ? gd.y - STORE_SPRITE_H : roomHeight(st) / 2;
  st.bubbles.push({ x, y, text, frames: sec(2) });
}

// ---------------------------------------------------------------------------
// Leaving / dying, wired up by game.ts
// ---------------------------------------------------------------------------

export let exitStore: (g: GameState) => void = () => {};
export function setExitStore(fn: (g: GameState) => void): void {
  exitStore = fn;
}

export let playerDiedInStore: (g: GameState) => void = () => {};
export function setPlayerDiedInStore(fn: (g: GameState) => void): void {
  playerDiedInStore = fn;
}
