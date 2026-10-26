// Mall (side-scrolling) simulation. Pure logic; mutates the Game's mall state
// and emits events. No DOM/audio/canvas.

import type { Game } from "./game";
import type { PadFrame } from "../input";
import { Rng } from "../rng";
import {
  FLOOR_Y,
  MALL_W,
  WALK_SPEED,
  BULLET_SPEED,
  SPY_BULLET_SPEED,
  MAX_PLAYER_BULLETS,
  MAX_SPIES,
  AGENT_W,
} from "./types";
import type {
  MallState,
  Player,
  Spy,
  ElevatorCar,
  PowerupKind,
  FloorId,
  Dir,
} from "./types";
import { SHAFTS, STORES, ESCALATORS } from "./layout";
import type { ShaftDef } from "./layout";
import { SPY_LAST_WORDS, PA_LINES } from "../copy";

const GRAVITY = 0.5;
const JUMP_VY = -4.5;
const CAR_H = 24;
const SHAFT_W = 24;

const FLOOR_IDS: FloorId[] = ["R", "4F", "3F", "2F", "1F", "P"];

function floorIndex(f: FloorId): number {
  return FLOOR_IDS.indexOf(f);
}

// ---------------------------------------------------------------------------
// Creation.
// ---------------------------------------------------------------------------

export function createMall(rng: Rng): MallState {
  const player: Player = {
    x: 40,
    y: FLOOR_Y.R,
    vx: 0,
    vy: 0,
    floor: "R",
    dir: 1,
    onGround: true,
    ducking: false,
    jumping: false,
    jumpKick: false,
    invuln: 0,
    frozen: 0,
    hidden: false,
    riding: false,
    ridingShaft: null,
    onRoof: false,
    dead: false,
    deadTimer: 0,
    respawn: { x: 40, y: FLOOR_Y.R },
    weapon: "normal",
    weaponTimer: 0,
    armor: false,
    speedTimer: 0,
    radar: false,
    invincible: 0,
    photoStrip: false,
    jokeItems: [],
    shootCooldown: 0,
    falling: false,
    fallTarget: 0,
    fallFatal: false,
  };

  const elevators: ElevatorCar[] = SHAFTS.map((s) => ({
    shaft: s.id,
    y: FLOOR_Y[s.floors[0]] - CAR_H,
    dir: 0,
    targetFloor: null,
    doorsOpen: true,
    auto: s.auto,
    autoTimer: 0,
    dinged: false,
  }));

  // Lamps: hang in corridor gaps. Disco balls on 2F.
  const lamps = [];
  const lampXs = [40, 160, 280, 400, 520, 640, 760];
  for (const f of ["4F", "3F", "2F", "1F"] as FloorId[]) {
    for (const x of lampXs) {
      const overStore = STORES.some(
        (s) => s.floor === f && x >= s.x && x < s.x + s.w,
      );
      if (overStore) continue;
      lamps.push({
        x,
        y: FLOOR_Y[f] - 40,
        floor: f,
        state: "lit" as const,
        timer: 0,
        vy: 0,
        disco: f === "2F",
        rollDir: 0 as Dir | 0,
      });
    }
  }

  const janitor = {
    x: 200,
    dir: 1 as Dir,
    mopping: false,
    mopTimer: 0,
    wetPatch: null as { x: number; w: number; timer: number } | null,
  };

  const walkers = [
    { x: 100, dir: 1 as Dir, range: [80, 300] as [number, number] },
    { x: 500, dir: -1 as Dir, range: [420, 700] as [number, number] },
  ];

  const cop = {
    floor: rng.pick(["4F", "3F", "2F", "1F"] as FloorId[]),
    x: 300,
    dir: 1 as Dir,
    state: "patrol" as const,
    chaseTimer: 0,
  };

  return {
    player,
    spies: [],
    bullets: [],
    elevators,
    powerups: [],
    coins: [],
    lamps,
    janitor,
    walkers,
    cop,
    popups: [],
    banner: null,
    bubbles: [],
    alarm: false,
    alarmTimer: 0,
    paTimer: 0,
    paLine: null,
    paLineTimer: 0,
    kioskCooldown: 0,
    fountainCooldown: {},
    levelClearFired: false,
    time: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function shaftAt(x: number): ShaftDef | null {
  for (const s of SHAFTS) {
    if (x >= s.x && x < s.x + SHAFT_W) return s;
  }
  return null;
}

function carFor(mall: MallState, shaft: ShaftDef): ElevatorCar {
  const c = mall.elevators.find((e) => e.shaft === shaft.id);
  if (!c) throw new Error(`no car for shaft ${shaft.id}`);
  return c;
}

function carFloorY(c: ElevatorCar): number {
  return c.y + CAR_H;
}

function carAtFloor(c: ElevatorCar, f: FloorId): boolean {
  return Math.abs(carFloorY(c) - FLOOR_Y[f]) < 0.5;
}

function openingState(
  mall: MallState,
  shaft: ShaftDef,
  f: FloorId,
): "board" | "grate" | "pit" | "none" {
  if (!shaft.floors.includes(f)) return "none";
  const c = carFor(mall, shaft);
  if (carAtFloor(c, f)) return "board";
  if (carFloorY(c) < FLOOR_Y[f]) return "grate";
  return "pit";
}

function storeAt(x: number, f: FloorId): (typeof STORES)[number] | null {
  for (const s of STORES) {
    if (s.floor === f && x >= s.x && x < s.x + s.w) return s;
  }
  return null;
}

function escalatorAt(
  x: number,
  f: FloorId,
): { lower: FloorId; upper: FloorId } | null {
  for (const e of ESCALATORS) {
    if (Math.abs(x - e.x) < 16 && (e.lower === f || e.upper === f)) return e;
  }
  return null;
}

function playerSpeed(p: Player): number {
  return WALK_SPEED * (p.speedTimer > 0 ? 1.5 : 1);
}

function floorAtY(y: number): FloorId {
  let best: FloorId = "P";
  let bestDist = Infinity;
  for (const f of FLOOR_IDS) {
    const d = Math.abs(FLOOR_Y[f] - y);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

function shaftById(id: "A" | "B" | "C"): ShaftDef {
  const s = SHAFTS.find((s) => s.id === id);
  if (!s) throw new Error(`unknown shaft ${id}`);
  return s;
}

// ---------------------------------------------------------------------------
// Step.
// ---------------------------------------------------------------------------

export function stepMall(game: Game, pad: PadFrame): void {
  const mall = game.mall;
  const p = mall.player;
  mall.time++;

  // Timers.
  if (p.invuln > 0) p.invuln--;
  if (p.frozen > 0) p.frozen--;
  if (p.shootCooldown > 0) p.shootCooldown--;
  if (p.weaponTimer > 0) {
    p.weaponTimer--;
    if (p.weaponTimer === 0) p.weapon = "normal";
  }
  if (p.speedTimer > 0) p.speedTimer--;
  if (p.invincible > 0) p.invincible--;
  if (mall.kioskCooldown > 0) mall.kioskCooldown--;
  for (const k of Object.keys(mall.fountainCooldown)) {
    if (mall.fountainCooldown[k] > 0) mall.fountainCooldown[k]--;
  }
  if (mall.banner && mall.banner.timer-- <= 0) mall.banner = null;
  if (mall.paLine && mall.paLineTimer-- <= 0) mall.paLine = null;
  mall.popups = mall.popups.filter((pp) => --pp.timer > 0);
  mall.bubbles = mall.bubbles.filter((b) => --b.timer > 0);

  // Alarm.
  const alarmAt = Math.max(60, 150 * 60 - (game.loop - 1) * 20 * 60);
  if (!mall.alarm && mall.time >= alarmAt) {
    mall.alarm = true;
    game.emit("alarm");
  }

  // PA announcements.
  if (mall.paTimer <= 0) {
    mall.paTimer = 60 * 60;
    let line = game.rng.pick(PA_LINES);
    if (line === mall.paLine) {
      line = PA_LINES[(PA_LINES.indexOf(line) + 1) % PA_LINES.length];
    }
    mall.paLine = line;
    mall.paLineTimer = 4 * 60;
    game.emit("pa");
  } else {
    mall.paTimer--;
  }

  // Player death / respawn.
  if (p.dead) {
    p.deadTimer--;
    if (p.deadTimer <= 0) respawnPlayer(mall);
    stepElevators(mall, game);
    stepSpies(mall, game);
    stepBullets(mall, game);
    stepLamps(mall, game);
    stepNpcs(mall, game);
    stepCoins(mall, game);
    stepPowerups(mall, game);
    return;
  }

  if (p.frozen <= 0) stepPlayer(game, pad);

  stepElevators(mall, game);
  stepSpies(mall, game);
  stepBullets(mall, game);
  stepLamps(mall, game);
  stepNpcs(mall, game);
  stepCoins(mall, game);
  stepPowerups(mall, game);
}

// ---------------------------------------------------------------------------
// Player.
// ---------------------------------------------------------------------------

function stepPlayer(game: Game, pad: PadFrame): void {
  const mall = game.mall;
  const p = mall.player;

  // Falling down a shaft.
  if (p.falling) {
    p.y += 3;
    if (p.y >= p.fallTarget) {
      p.y = p.fallTarget;
      p.falling = false;
      if (p.fallFatal) {
        killPlayer(game, "fall");
        return;
      }
      p.onGround = true;
      p.floor = floorAtY(p.y);
      p.onRoof = true;
    }
    return;
  }

  // Jumping / gravity.
  if (!p.onGround) {
    p.vy += GRAVITY;
    p.y += p.vy;
    const target = FLOOR_Y[p.floor];
    if (p.y >= target) {
      p.y = target;
      p.vy = 0;
      p.onGround = true;
      p.jumping = false;
      p.jumpKick = false;
    }
  }

  const left = pad.held.has("left");
  const right = pad.held.has("right");
  const down = pad.held.has("down");
  const up = pad.held.has("up");

  if (p.onGround && !p.riding) {
    if (left && !right) {
      p.x -= playerSpeed(p);
      p.dir = -1;
    } else if (right && !left) {
      p.x += playerSpeed(p);
      p.dir = 1;
    }
    p.x = Math.max(0, Math.min(MALL_W - AGENT_W, p.x));
  }

  p.ducking = p.onGround && down && !p.riding;

  if (pad.pressed.includes("b") && p.onGround && !p.riding && !p.ducking) {
    p.vy = JUMP_VY;
    p.onGround = false;
    p.jumping = true;
    p.jumpKick = left || right;
    game.emit("jump");
  }

  if (pad.pressed.includes("a") && p.shootCooldown <= 0) {
    shootPlayer(game);
  }

  if (pad.pressed.includes("up") || pad.pressed.includes("down")) {
    contextualAction(game, up, down);
  }

  // Falling into a pit.
  if (p.onGround && !p.riding && !p.falling) {
    const s = shaftAt(p.x + AGENT_W / 2);
    if (s && openingState(mall, s, p.floor) === "pit") {
      startFall(game, s);
    }
  }

  if (p.onGround && !p.riding && !p.falling && !p.onRoof) {
    p.respawn = { x: p.x, y: p.y };
  }
}

function shootPlayer(game: Game): void {
  const mall = game.mall;
  const p = mall.player;
  const maxBullets = p.weapon === "rapid" ? 4 : MAX_PLAYER_BULLETS;
  const count = () => mall.bullets.filter((b) => b.from === "player").length;
  if (count() >= maxBullets) return;

  const y = p.ducking ? p.y - 6 : p.y - 16;
  const shots: { vx: number; vy: number }[] = [];
  if (p.weapon === "spread") {
    shots.push({ vx: BULLET_SPEED * p.dir, vy: 0 });
    shots.push({ vx: BULLET_SPEED * p.dir, vy: -1 });
    shots.push({ vx: BULLET_SPEED * p.dir, vy: 1 });
  } else {
    shots.push({ vx: BULLET_SPEED * p.dir, vy: 0 });
  }

  for (const s of shots) {
    if (count() >= maxBullets) break;
    mall.bullets.push({
      x: p.x + AGENT_W / 2,
      y,
      vx: s.vx,
      vy: s.vy,
      from: "player",
      high: !p.ducking,
    });
  }
  p.shootCooldown = p.weapon === "rapid" ? 6 : 12;
  game.emit("shot");
}

function contextualAction(game: Game, up: boolean, down: boolean): void {
  const mall = game.mall;
  const p = mall.player;
  const cx = p.x + AGENT_W / 2;

  const store = storeAt(cx, p.floor);
  if (store && store.role !== "closed") {
    if (store.role === "target" && game.packages.has(store.id)) return;
    game.enterStore(store.id);
    return;
  }

  const s = shaftAt(cx);
  if (s && openingState(mall, s, p.floor) === "board") {
    boardElevator(game, s);
    return;
  }

  const esc = escalatorAt(cx, p.floor);
  if (esc) {
    if (up && esc.lower === p.floor) {
      p.floor = esc.upper;
      p.y = FLOOR_Y[esc.upper];
      game.emit("escalator");
    } else if (down && esc.upper === p.floor) {
      p.floor = esc.lower;
      p.y = FLOOR_Y[esc.lower];
      game.emit("escalator");
    }
    return;
  }

  if (p.floor === "P" && Math.abs(cx - 200) < 24) {
    if (game.packages.size >= 6) {
      game.triggerLevelClear();
    } else {
      mall.banner = {
        text: `PACKAGES LEFT: ${6 - game.packages.size}`,
        timer: 90,
      };
      game.emit("buzzer");
    }
    return;
  }

  if (up && mall.kioskCooldown <= 0 && isKioskAt(cx, p.floor)) {
    mall.kioskCooldown = 20 * 60;
    mall.banner = { text: "NEAREST PACKAGE: " + nearestPackage(game), timer: 120 };
    game.emit("kiosk");
    return;
  }

  if (up && p.floor === "3F" && Math.abs(cx - 500) < 16) {
    p.hidden = true;
    game.emit("booth");
    return;
  }
}

function nearestPackage(game: Game): string {
  const remaining = STORES.filter(
    (s) => s.role === "target" && !game.packages.has(s.id),
  );
  if (remaining.length === 0) return "NONE";
  return remaining[0].name;
}

function isKioskAt(x: number, f: FloorId): boolean {
  if (f === "R" || f === "P") return false;
  return Math.abs(x - 700) < 12;
}

function boardElevator(game: Game, shaft: ShaftDef): void {
  const mall = game.mall;
  const p = mall.player;
  const c = carFor(mall, shaft);
  p.riding = true;
  p.ridingShaft = shaft.id;
  p.onRoof = false;
  p.x = shaft.x + (SHAFT_W - AGENT_W) / 2;
  p.y = carFloorY(c);
  p.floor = floorAtY(p.y);
  c.doorsOpen = false;
  game.emit("door");
}

function startFall(game: Game, shaft: ShaftDef): void {
  const mall = game.mall;
  const p = mall.player;
  const c = carFor(mall, shaft);
  const carY = c.y;
  const fallDist = carY - p.y;
  p.falling = true;
  p.fallTarget = carY;
  p.fallFatal = fallDist > 48;
  p.onGround = false;
  p.riding = false;
  p.ridingShaft = null;
}

// ---------------------------------------------------------------------------
// Elevators.
// ---------------------------------------------------------------------------

function stepElevators(mall: MallState, game: Game): void {
  for (const c of mall.elevators) {
    const shaft = shaftById(c.shaft);

    if (c.auto) {
      c.autoTimer--;
      if (c.dir === 0 && c.autoTimer <= 0) {
        const cur = floorAtY(carFloorY(c));
        const others = shaft.floors.filter((f) => f !== cur);
        if (others.length > 0) {
          const target = game.rng.pick(others);
          c.targetFloor = target;
          c.dir = FLOOR_Y[target] > carFloorY(c) ? 1 : -1;
          c.doorsOpen = false;
        }
        c.autoTimer = 2 * 60;
      }
    }

    if (c.dir !== 0) {
      c.y += c.dir;
      const targetY = c.targetFloor ? FLOOR_Y[c.targetFloor] - CAR_H : c.y;
      if ((c.dir === 1 && c.y >= targetY) || (c.dir === -1 && c.y <= targetY)) {
        c.y = targetY;
        c.dir = 0;
        c.targetFloor = null;
        c.doorsOpen = true;
        c.dinged = false;
        game.emit("ding");
        if (c.auto) c.autoTimer = 2 * 60;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Spies.
// ---------------------------------------------------------------------------

function stepSpies(mall: MallState, game: Game): void {
  const p = mall.player;

  const spyCap = game.blackFriday ? MAX_SPIES * 2 : MAX_SPIES;
  if (mall.spies.length < spyCap && mall.time > 5 * 60) {
    const spawnRate = game.blackFriday
      ? 0.02
      : 0.008 * (1 + (game.loop - 1) * 0.15);
    if (game.rng.chance(spawnRate)) spawnSpy(mall, game);
  }

  for (const s of mall.spies) {
    if (s.state === "dead") {
      s.deadTimer--;
      if (s.deadTimer <= 0) mall.spies = mall.spies.filter((x) => x !== s);
      continue;
    }

    if (s.firstShotDelay > 0) s.firstShotDelay--;
    if (s.shootCooldown > 0) s.shootCooldown--;

    const speed = 0.5 * (1 + (game.loop - 1) * 0.1) * (mall.alarm ? 1.25 : 1);

    if (s.state === "aim") {
      s.aimTimer--;
      if (s.aimTimer <= 0) {
        s.state = "shoot";
        spyShoot(mall, game, s);
      }
      continue;
    }

    const canSee =
      s.floor === p.floor && Math.abs(s.x - p.x) < 160 && !p.hidden && !p.dead;
    if (canSee && s.firstShotDelay <= 0 && s.shootCooldown <= 0) {
      s.state = "aim";
      s.aimTimer = 30;
      s.aimHigh = game.rng.chance(0.5);
      s.dodge = game.rng.chance(0.1);
      continue;
    }

    if (canSee) {
      const dist = p.x - s.x;
      if (Math.abs(dist) > 40) {
        s.dir = dist > 0 ? 1 : -1;
        s.x += s.dir * speed;
      }
    } else {
      if (game.rng.chance(0.02)) s.dir = s.dir === 1 ? -1 : 1;
      s.x += s.dir * speed * 0.5;
    }
    s.x = Math.max(0, Math.min(MALL_W - 16, s.x));
  }
}

function spawnSpy(mall: MallState, game: Game): void {
  const p = mall.player;
  const candidates = STORES.filter(
    (s) =>
      s.role !== "closed" &&
      !(s.role === "target" && game.packages.has(s.id)) &&
      Math.abs(floorIndex(s.floor) - floorIndex(p.floor)) <= 1,
  );
  if (candidates.length === 0) return;
  const store = game.rng.pick(candidates);
  const x = store.x + store.w / 2;
  const dist = Math.abs(x - p.x);
  if (dist < 64 || dist > 200) return;
  const spy: Spy = {
    id: mall.spies.length,
    x,
    y: FLOOR_Y[store.floor],
    floor: store.floor,
    dir: p.x > x ? 1 : -1,
    state: "walk",
    aimTimer: 0,
    aimHigh: false,
    shootCooldown: 0,
    firstShotDelay: 2 * 60,
    dodge: false,
    deadTimer: 0,
    lastWords: null,
    dropPowerup: game.rng.chance(0.05),
    dropFood: game.rng.chance(0.5),
  };
  mall.spies.push(spy);
}

function spyShoot(mall: MallState, game: Game, s: Spy): void {
  const y = s.aimHigh ? s.y - 16 : s.y - 6;
  mall.bullets.push({
    x: s.x + 8,
    y,
    vx: SPY_BULLET_SPEED * s.dir,
    vy: 0,
    from: "spy",
    high: s.aimHigh,
  });
  s.state = "walk";
  const base = 2.5 * 60;
  const faster = base / (1 + (game.loop - 1) * 0.15);
  s.shootCooldown = Math.max(60, faster);
  game.emit("enemyshot");
}

// ---------------------------------------------------------------------------
// Bullets.
// ---------------------------------------------------------------------------

function stepBullets(mall: MallState, game: Game): void {
  const p = mall.player;
  for (const b of mall.bullets) {
    b.x += b.vx;
    b.y += b.vy;
  }

  for (const b of mall.bullets) {
    if (b.from !== "player") continue;
    for (const s of mall.spies) {
      if (s.state === "dead") continue;
      if (Math.abs(b.x - (s.x + 8)) < 8 && Math.abs(b.y - (s.y - 12)) < 12) {
        if (s.dodge && b.high) {
          s.dodge = false;
          continue;
        }
        killSpy(mall, game, s);
        b.x = -100;
        break;
      }
    }
  }

  for (const b of mall.bullets) {
    if (b.from !== "spy") continue;
    if (p.dead || p.invuln > 0 || p.hidden) continue;
    const py = p.ducking ? p.y - 6 : p.y - 16;
    if (Math.abs(b.x - (p.x + 8)) < 8 && Math.abs(b.y - py) < 12) {
      if (p.ducking && b.high) continue;
      hitPlayer(game, "bullet");
      b.x = -100;
    }
  }

  mall.bullets = mall.bullets.filter(
    (b) => b.x > -50 && b.x < MALL_W + 50 && b.y > -50 && b.y < 400,
  );
}

function killSpy(mall: MallState, game: Game, s: Spy): void {
  s.state = "dead";
  s.deadTimer = 24;
  game.addScore(100);
  if (game.rng.chance(0.35)) {
    s.lastWords = game.rng.pick(SPY_LAST_WORDS);
    mall.bubbles.push({ x: s.x, y: s.y - 30, text: s.lastWords, timer: 60 });
  }
  if (s.dropPowerup) {
    const kind: PowerupKind = s.dropFood
      ? game.rng.pick(["cinnabomb", "juliooze", "pretzel"] as PowerupKind[])
      : game.rng.pick(
          ["rapid", "spread", "armor", "sneakers", "radar", "oneup"] as PowerupKind[],
        );
    mall.powerups.push({ kind, x: s.x, y: s.y, floor: s.floor });
  }
  game.emit("spydead");
}

function hitPlayer(game: Game, cause: string): void {
  const p = game.mall.player;
  if (p.invincible > 0) return;
  if (p.armor) {
    p.armor = false;
    game.emit("armorbreak");
    return;
  }
  killPlayer(game, cause);
}

function killPlayer(game: Game, cause: string): void {
  const mall = game.mall;
  const p = mall.player;
  if (p.dead) return;
  p.dead = true;
  p.deadTimer = 60;
  p.riding = false;
  p.ridingShaft = null;
  p.falling = false;
  mall.spies = [];
  mall.bullets = [];
  game.emit("death", { cause });
  game.playerDied();
}

function respawnPlayer(mall: MallState): void {
  const p = mall.player;
  p.dead = false;
  p.x = p.respawn.x;
  p.y = p.respawn.y;
  p.floor = floorAtY(p.y);
  p.vy = 0;
  p.onGround = true;
  p.riding = false;
  p.ridingShaft = null;
  p.onRoof = false;
  p.falling = false;
  p.invuln = 2 * 60;
  p.weapon = "normal";
  p.weaponTimer = 0;
  p.armor = false;
  p.speedTimer = 0;
  p.invincible = 0;
}

// ---------------------------------------------------------------------------
// Lamps / disco balls.
// ---------------------------------------------------------------------------

function stepLamps(mall: MallState, game: Game): void {
  const p = mall.player;
  for (const l of mall.lamps) {
    if (l.state === "falling") {
      l.vy += GRAVITY;
      l.y += l.vy;
      const groundY = FLOOR_Y[l.floor];
      if (l.y >= groundY) {
        l.state = "dark";
        l.timer = 2 * 60;
        game.emit("lamp");
        if (Math.abs(p.x + 8 - l.x) < 12 && p.floor === l.floor) {
          killPlayer(game, "lamp");
        }
        for (const s of mall.spies) {
          if (
            s.state !== "dead" &&
            Math.abs(s.x + 8 - l.x) < 12 &&
            s.floor === l.floor
          ) {
            killSpy(mall, game, s);
            game.addScore(200);
          }
        }
      }
    } else if (l.state === "dark") {
      l.timer--;
      if (l.timer <= 0) l.state = "lit";
    }
  }
}

// ---------------------------------------------------------------------------
// NPCs (janitor, walkers, cop).
// ---------------------------------------------------------------------------

function stepNpcs(mall: MallState, game: Game): void {
  const p = mall.player;

  const j = mall.janitor;
  j.x += j.dir * 0.5;
  if (j.x > 500 || j.x < 100) j.dir = j.dir === 1 ? -1 : 1;
  if (j.mopTimer > 0) j.mopTimer--;
  else if (game.rng.chance(0.005)) {
    j.mopping = true;
    j.mopTimer = 60;
    j.wetPatch = { x: j.x, w: 48, timer: 10 * 60 };
  }
  if (j.wetPatch) {
    j.wetPatch.timer--;
    if (j.wetPatch.timer <= 0) j.wetPatch = null;
  }

  for (const w of mall.walkers) {
    w.x += w.dir * 0.8;
    if (w.x > w.range[1] || w.x < w.range[0]) w.dir = w.dir === 1 ? -1 : 1;
  }

  const c = mall.cop;
  if (c.state === "patrol") {
    c.x += c.dir * 0.6;
    if (c.x > 700 || c.x < 60) c.dir = c.dir === 1 ? -1 : 1;
    if (
      p.floor === c.floor &&
      Math.abs(p.x - c.x) < 128 &&
      ((c.dir === 1 && p.x > c.x) || (c.dir === -1 && p.x < c.x))
    ) {
      c.state = "chase";
      c.chaseTimer = 10 * 60;
      game.emit("whistle");
    }
  } else {
    c.chaseTimer--;
    c.x += c.dir * 1.2;
    if (p.x > c.x) c.dir = 1;
    else c.dir = -1;
    if (Math.abs(p.x - c.x) < 12 && p.floor === c.floor) {
      p.frozen = 3 * 60;
      game.addScore(-500);
      mall.banner = { text: "DETAINED! -500", timer: 90 };
      c.state = "patrol";
      c.chaseTimer = 0;
    }
    if (c.chaseTimer <= 0) c.state = "patrol";
  }
}

// ---------------------------------------------------------------------------
// Coins.
// ---------------------------------------------------------------------------

function stepCoins(mall: MallState, game: Game): void {
  const p = mall.player;
  for (const c of mall.coins) {
    c.vy += GRAVITY;
    c.x += c.vx;
    c.y += c.vy;
    if (c.y >= FLOOR_Y[c.floor]) {
      c.y = FLOOR_Y[c.floor];
      c.vy = 0;
      c.vx = 0;
    }
    if (Math.abs(c.x - (p.x + 8)) < 10 && Math.abs(c.y - (p.y - 8)) < 12) {
      if (c.gold) {
        game.lives++;
        game.emit("oneup");
      } else {
        game.addScore(50);
      }
      c.y = -100;
    }
  }
  mall.coins = mall.coins.filter((c) => c.y > -50);
}

// ---------------------------------------------------------------------------
// Power-ups.
// ---------------------------------------------------------------------------

function stepPowerups(mall: MallState, game: Game): void {
  const p = mall.player;
  for (const pu of mall.powerups) {
    if (Math.abs(pu.x - (p.x + 8)) < 12 && Math.abs(pu.y - (p.y - 8)) < 14) {
      game.applyPowerup(pu.kind);
      pu.y = -100;
    }
  }
  mall.powerups = mall.powerups.filter((pu) => pu.y > -50);
}
