// Store (top-down room) simulation. Pure logic; mutates the Game's store state
// and emits events. No DOM/audio/canvas.

import type { Game } from "./game";
import type { PadFrame, Button } from "../input";
import type {
  StoreState,
  StoreGuard,
  StorePlayer,
  FixtureContent,
} from "./types";
import {
  ROOMS,
  buildRoomGrid,
  ROOM_W,
  ROOM_H,
  T_WALL,
  T_FIXTURE,
  T_COUNTER,
  T_DECOR,
  T_DOOR,
  storeById,
} from "./layout";
import { STORE_LINES, GAMESTONK_ITEMS } from "../copy";

const TILE = 16;
const SEARCH_FRAMES = 45; // ~0.75s

// ---------------------------------------------------------------------------
// Creation.
// ---------------------------------------------------------------------------

export function createStore(game: Game, storeId: string): StoreState {
  const def = storeById(storeId);
  const roomDef = ROOMS[storeId];
  const grid = buildRoomGrid(roomDef);

  // Assign fixture contents.
  const fixtures = roomDef.fixtures.map((f) => ({
    x: f.x,
    y: f.y,
    content: "nothing" as FixtureContent,
    opened: false,
  }));

  if (def.role === "target") {
    // Exactly one package.
    const idx = game.rng.int(fixtures.length);
    fixtures[idx].content = "package";
    for (let i = 0; i < fixtures.length; i++) {
      if (i === idx) continue;
      fixtures[i].content = game.rng.pick([
        "powerup",
        "trap",
        "nothing",
      ] as FixtureContent[]);
    }
  } else {
    // Power-up shop: only power-ups or nothing.
    for (const f of fixtures) {
      f.content = game.rng.pick(["powerup", "nothing"] as FixtureContent[]);
    }
  }

  const player: StorePlayer = {
    x: 7.5 * TILE,
    y: (ROOM_H - 1) * TILE,
    dir: 1,
    facing: "up",
    moving: false,
  };

  // Guards: 1-3.
  const guardCount = game.rng.range(1, 3);
  const guards: StoreGuard[] = [];
  for (let i = 0; i < guardCount; i++) {
    guards.push({
      type: game.rng.chance(0.7) ? "spy" : "bot",
      x: game.rng.range(2, ROOM_W - 3),
      y: game.rng.range(2, ROOM_H - 3),
      dir: game.rng.chance(0.5) ? 1 : -1,
      hp: 3,
      state: "idle",
      timer: 0,
      aimDir: 1,
      grace: 60,
      line: null,
      lineTimer: 0,
    });
  }

  // First-visit lines.
  const lines = STORE_LINES[def.name];
  if (lines) {
    guards[0].line = lines[0];
    guards[0].lineTimer = 60;
  }

  return {
    storeId,
    grid,
    fixtures,
    player,
    guards,
    searching: null,
    banner: null,
    firstVisit: true,
    cleared: false,
    listeningBooth: false,
    gamestonkEgg: false,
    eggPhase: 0,
    eggItem: null,
    windupToys: [],
    stunTimer: 0,
  };
}

// ---------------------------------------------------------------------------
// Step.
// ---------------------------------------------------------------------------

export function stepStore(game: Game, pad: PadFrame): void {
  const st = game.store;
  if (!st) return;

  if (st.banner && st.banner.timer-- <= 0) st.banner = null;
  if (st.stunTimer > 0) st.stunTimer--;

  // GameStonk easter egg (first time each game).
  if (st.storeId === "gamestonk" && !st.gamestonkEgg) {
    st.gamestonkEgg = true;
    st.eggItem = game.rng.pick(GAMESTONK_ITEMS);
    game.inventory.push(st.eggItem);
    game.addScore(1);
    st.banner = { text: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.", timer: 120 };
    game.emit("itemget");
  }

  const p = st.player;

  // Searching.
  if (st.searching) {
    st.searching.timer--;
    if (st.searching.timer <= 0) {
      finishSearch(game, st, st.searching.fx, st.searching.fy);
      st.searching = null;
    } else {
      // Cancel on a fresh direction press or shooting.
      const dirs: Button[] = ["up", "down", "left", "right"];
      if (dirs.some((d) => pad.pressed.includes(d)) || pad.pressed.includes("a")) {
        st.searching = null;
      }
    }
    stepGuards(game, st);
    return;
  }

  // Movement (vertical priority).
  const up = pad.held.has("up");
  const down = pad.held.has("down");
  const left = pad.held.has("left");
  const right = pad.held.has("right");

  if (st.stunTimer <= 0) {
    let dx = 0;
    let dy = 0;
    if (up) {
      dy = -1;
      p.facing = "up";
    } else if (down) {
      dy = 1;
      p.facing = "down";
    } else if (left) {
      dx = -1;
      p.facing = "left";
      p.dir = -1;
    } else if (right) {
      dx = 1;
      p.facing = "right";
      p.dir = 1;
    }
    p.moving = dx !== 0 || dy !== 0;

    if (dx !== 0 || dy !== 0) {
      movePlayer(st, dx, dy);
    }
  }

  // Shooting.
  if (pad.pressed.includes("a")) {
    shootStore(game, st);
  }

  // Searching (single tap of B).
  if (pad.pressed.includes("b") && !st.searching) {
    const f = touchingFixture(st);
    if (f) {
      st.searching = { fx: f.x, fy: f.y, timer: SEARCH_FRAMES };
      p.facing = facingToward(p, f.x * TILE + 8, f.y * TILE + 8);
      game.emit("search");
    }
  }

  // Exit through the door.
  if (isOnDoor(st)) {
    game.exitStore();
    return;
  }

  stepGuards(game, st);
}

// ---------------------------------------------------------------------------
// Movement & collision.
// ---------------------------------------------------------------------------

function isSolidTile(grid: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
  const t = grid[ty * ROOM_W + tx];
  return t === T_WALL || t === T_FIXTURE || t === T_COUNTER || t === T_DECOR;
}

function rectBlocked(grid: Uint8Array, px: number, py: number): boolean {
  const x0 = Math.floor(px / TILE);
  const y0 = Math.floor(py / TILE);
  const x1 = Math.floor((px + TILE - 1) / TILE);
  const y1 = Math.floor((py + TILE - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolidTile(grid, tx, ty)) return true;
    }
  }
  return false;
}

function movePlayer(st: StoreState, dx: number, dy: number): void {
  const p = st.player;
  const speed = 1;
  let nx = p.x + dx * speed;
  let ny = p.y + dy * speed;

  if (!rectBlocked(st.grid, nx, ny)) {
    p.x = nx;
    p.y = ny;
    return;
  }

  // Corner assist: nudge perpendicular.
  if (dx !== 0) {
    for (const nudge of [-4, 4, -8, 8]) {
      if (!rectBlocked(st.grid, p.x, p.y + nudge)) {
        p.y += nudge;
        if (!rectBlocked(st.grid, nx, p.y)) {
          p.x = nx;
          return;
        }
        p.y -= nudge;
      }
    }
  }
  if (dy !== 0) {
    for (const nudge of [-4, 4, -8, 8]) {
      if (!rectBlocked(st.grid, p.x + nudge, p.y)) {
        p.x += nudge;
        if (!rectBlocked(st.grid, p.x, ny)) {
          p.y = ny;
          return;
        }
        p.x -= nudge;
      }
    }
  }
}

function isOnDoor(st: StoreState): boolean {
  const p = st.player;
  const cx = Math.floor((p.x + 8) / TILE);
  const cy = Math.floor((p.y + 8) / TILE);
  return st.grid[cy * ROOM_W + cx] === T_DOOR;
}

// ---------------------------------------------------------------------------
// Searching.
// ---------------------------------------------------------------------------

function touchingFixture(st: StoreState): { x: number; y: number } | null {
  const p = st.player;
  const cx = Math.floor((p.x + 8) / TILE);
  const cy = Math.floor((p.y + 8) / TILE);
  // Check the tile the player is on and the four neighbours.
  const candidates = [
    [cx, cy],
    [cx + 1, cy],
    [cx - 1, cy],
    [cx, cy + 1],
    [cx, cy - 1],
  ];
  for (const [tx, ty] of candidates) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
    if (st.grid[ty * ROOM_W + tx] === T_FIXTURE) {
      const f = st.fixtures.find((f) => f.x === tx && f.y === ty);
      if (f && !f.opened) return f;
    }
  }
  return null;
}

function facingToward(
  p: StorePlayer,
  tx: number,
  ty: number,
): "up" | "down" | "left" | "right" {
  const dx = tx - (p.x + 8);
  const dy = ty - (p.y + 8);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function finishSearch(game: Game, st: StoreState, fx: number, fy: number): void {
  const f = st.fixtures.find((f) => f.x === fx && f.y === fy);
  if (!f) return;
  f.opened = true;

  switch (f.content) {
    case "package": {
      game.packages.add(st.storeId);
      st.cleared = true;
      const n = game.packages.size;
      st.banner = { text: `PACKAGE ${n}/6`, timer: 120 };
      game.addScore(500);
      game.emit("package");
      break;
    }
    case "powerup": {
      const kind = game.rng.pick([
        "rapid",
        "spread",
        "armor",
        "sneakers",
        "radar",
        "oneup",
      ] as const);
      game.applyPowerup(kind);
      st.banner = { text: powerupName(kind), timer: 90 };
      break;
    }
    case "trap": {
      st.stunTimer = 60;
      st.banner = { text: "IT'S A TRAP!", timer: 90 };
      game.emit("trap");
      break;
    }
    case "nothing": {
      st.banner = { text: "NOTHING HERE", timer: 60 };
      game.emit("nothing");
      break;
    }
  }
}

function powerupName(kind: string): string {
  const names: Record<string, string> = {
    rapid: "RAPID FIRE",
    spread: "SPREAD SHOT",
    armor: "ARMOR VEST",
    sneakers: "SNEAKERS",
    radar: "RADAR",
    oneup: "1-UP",
  };
  return names[kind] ?? kind.toUpperCase();
}

// ---------------------------------------------------------------------------
// Shooting.
// ---------------------------------------------------------------------------

function shootStore(game: Game, st: StoreState): void {
  const p = st.player;
  const dirs: Record<string, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const [dx, dy] = dirs[p.facing];
  // Fire a bullet along the facing direction; hit the first guard in line.
  let bx = p.x + 8;
  let by = p.y + 8;
  for (let i = 0; i < 16; i++) {
    bx += dx * 4;
    by += dy * 4;
    const tx = Math.floor(bx / TILE);
    const ty = Math.floor(by / TILE);
    if (isSolidTile(st.grid, tx, ty)) break;
    for (const g of st.guards) {
      if (g.state === "dead") continue;
      if (Math.abs(bx - (g.x * TILE + 8)) < 8 && Math.abs(by - (g.y * TILE + 8)) < 8) {
        hitGuard(game, g);
        game.emit("shot");
        return;
      }
    }
  }
  game.emit("shot");
}

function hitGuard(game: Game, g: StoreGuard): void {
  if (g.type === "bot") {
    g.hp--;
    if (g.hp <= 0) {
      g.state = "dead";
      game.addScore(100);
      game.emit("spydead");
    }
  } else {
    g.state = "dead";
    game.addScore(100);
    game.emit("spydead");
  }
}

// ---------------------------------------------------------------------------
// Guards.
// ---------------------------------------------------------------------------

function stepGuards(game: Game, st: StoreState): void {
  const p = st.player;
  for (const g of st.guards) {
    if (g.state === "dead") continue;
    if (g.grace > 0) g.grace--;
    if (g.lineTimer > 0) g.lineTimer--;

    if (g.state === "stunned") {
      g.timer--;
      if (g.timer <= 0) g.state = "idle";
      continue;
    }

    if (g.type === "bot") {
      // Patrol back and forth.
      g.timer--;
      if (g.timer <= 0) {
        g.dir = g.dir === 1 ? -1 : 1;
        g.timer = game.rng.range(30, 90);
      }
      const nx = g.x + g.dir;
      if (!isSolidTile(st.grid, nx, g.y)) g.x = nx;
      // Kill on contact.
      if (Math.abs(g.x * TILE + 8 - (p.x + 8)) < 12 && Math.abs(g.y * TILE + 8 - (p.y + 8)) < 12) {
        storeHitPlayer(game);
      }
      continue;
    }

    // Spy: move tile by tile toward the player, shoot when lined up.
    if (g.grace > 0) continue;
    const px = Math.floor((p.x + 8) / TILE);
    const py = Math.floor((p.y + 8) / TILE);
    const gx = g.x;
    const gy = g.y;

    // Shoot if lined up with a clear path.
    if (gx === px || gy === py) {
      const clear = clearLine(st.grid, gx, gy, px, py);
      if (clear) {
        g.state = "aim";
        g.timer = 30;
        g.aimDir = px > gx ? 1 : px < gx ? -1 : g.dir;
        continue;
      }
    }

    // Move toward player.
    if (game.rng.chance(0.5)) {
      const nx = gx + (px > gx ? 1 : px < gx ? -1 : 0);
      if (nx !== gx && !isSolidTile(st.grid, nx, gy)) g.x = nx;
    } else {
      const ny = gy + (py > gy ? 1 : py < gy ? -1 : 0);
      if (ny !== gy && !isSolidTile(st.grid, gx, ny)) g.y = ny;
    }
  }
}

function clearLine(
  grid: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  if (x0 === x1) {
    const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    for (let y = a + 1; y < b; y++) if (isSolidTile(grid, x0, y)) return false;
    return true;
  }
  const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
  for (let x = a + 1; x < b; x++) if (isSolidTile(grid, x, y0)) return false;
  return true;
}

function storeHitPlayer(game: Game): void {
  const p = game.mall.player;
  if (p.invincible > 0) return;
  if (p.armor) {
    p.armor = false;
    game.emit("armorbreak");
    return;
  }
  // Death in a store: return to the mall and lose a life.
  game.exitStore();
  game.playerDied();
}
