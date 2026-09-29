import { ui } from "./copy";
import {
  RNG,
  clamp,
  codeProgress,
  type Pad,
  type Button,
  buttons,
} from "./core";
import {
  stores,
  shaftDefs,
  escalators,
  floorY,
  roomTemplate,
  difficulty,
  powers,
  type Power,
  type Room,
  type Fixture,
} from "./data";
import {
  arrivalPosts,
  completePosts,
  headlines,
  lastWords,
  liftWords,
  firstLines,
  pa,
  jokeItems,
  floorLines,
  labels,
} from "./copy";
export type Scene =
  | "splash"
  | "title"
  | "arrival"
  | "mall"
  | "store"
  | "clear"
  | "continue"
  | "over";
export interface Actor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: number;
  face: number;
  floor: number;
  duck: boolean;
  ground: boolean;
  kick: boolean;
  lift: number;
  roof: number;
  inv: number;
  stun: number;
  hidden: number;
  slide: number;
}
export interface Spy {
  id: number;
  x: number;
  y: number;
  floor: number;
  dir: number;
  age: number;
  aim: number;
  low: boolean;
  cool: number;
  dead: number;
  duck: number;
  volley: number;
  stun: number;
  hp: number;
  bot: boolean;
  wait: number;
  bubble: string;
  bubbleTime: number;
  nav: { x: number; y: number } | null;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  enemy: boolean;
  life: number;
  id: number;
}
export interface Lift {
  x: number;
  y: number;
  min: number;
  max: number;
  auto: boolean;
  dir: number;
  target: number | null;
  called: number | null;
  wait: number;
  moving: boolean;
}
export interface Lamp {
  x: number;
  y: number;
  floor: number;
  disco: boolean;
  mode: "hang" | "fall" | "roll" | "gone";
  vx: number;
  vy: number;
  dark: number;
}
export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  kind: "coin" | Power;
  life: number;
}
export interface Toy {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
}
export interface Game {
  seed: number;
  rng: RNG;
  scene: Scene;
  frame: number;
  sceneFrame: number;
  time: number;
  loop: number;
  score: number;
  high: number;
  lives: number;
  continues: number;
  extra: boolean;
  packages: number;
  black: boolean;
  code: Button[];
  overlay: "map" | "pause" | null;
  player: Actor;
  safe: { x: number; floor: number };
  rooms: Room[];
  store: number;
  spies: Spy[];
  bullets: Bullet[];
  lifts: Lift[];
  lamps: Lamp[];
  pickups: Pickup[];
  toys: Toy[];
  events: string[];
  banner: string;
  bannerTime: number;
  shake: number;
  fade: number;
  weapon: Power | null;
  weaponTime: number;
  speed: Power | null;
  speedTime: number;
  armor: boolean;
  radar: boolean;
  food: number;
  cool: number;
  spawn: number;
  alarm: boolean;
  search: { fixture: number; frame: number; face: number } | null;
  inventory: string[];
  photo: boolean;
  gameStonk: boolean;
  egg: number;
  eggItem: string | null;
  firstVisit: number;
  post: string[];
  headline: string;
  clearStage: number;
  clearAwarded: boolean;
  bonus: number;
  paIndex: number;
  paTimer: number;
  kiosks: number[];
  fountains: number[];
  cop: { x: number; floor: number; dir: number; chase: number };
  janitor: { x: number; dir: number; timer: number };
  wet: { x: number; life: number } | null;
  walkers: { x: number; dir: number }[];
  serial: number;
  death: number;
  listening: boolean;
  returnX: number;
  returnFloor: number;
  popups: { x: number; y: number; n: number; life: number }[];
  photoPopup: number;
  callWait: number;
  transit: { x: number; from: number; to: number; frame: number } | null;
}
export function actor(x = 80, floor = 0): Actor {
  return {
    x,
    y: floorY(floor),
    vx: 0,
    vy: 0,
    dir: 1,
    face: 1,
    floor,
    duck: false,
    ground: true,
    kick: false,
    lift: -1,
    roof: -1,
    inv: 0,
    stun: 0,
    hidden: 0,
    slide: 0,
  };
}
export function createGame(seed = 1, debug = false): Game {
  const rng = new RNG(seed);
  const g: Game = {
    seed,
    rng,
    scene: debug ? "title" : "splash",
    frame: 0,
    sceneFrame: 0,
    time: 0,
    loop: 1,
    score: 0,
    high: 0,
    lives: 3,
    continues: 3,
    extra: false,
    packages: 0,
    black: false,
    code: [],
    overlay: null,
    player: actor(),
    safe: { x: 80, floor: 0 },
    rooms: [],
    store: -1,
    spies: [],
    bullets: [],
    lifts: [],
    lamps: [],
    pickups: [],
    toys: [],
    events: [],
    banner: "",
    bannerTime: 0,
    shake: 0,
    fade: 0,
    weapon: null,
    weaponTime: 0,
    speed: null,
    speedTime: 0,
    armor: false,
    radar: false,
    food: 0,
    cool: 0,
    spawn: 300,
    alarm: false,
    search: null,
    inventory: [],
    photo: false,
    gameStonk: false,
    egg: 0,
    eggItem: null,
    firstVisit: 0,
    post: arrivalPosts[0],
    headline: headlines[0],
    clearStage: 0,
    clearAwarded: false,
    bonus: 0,
    paIndex: -1,
    paTimer: 3600,
    kiosks: [0, 0, 0, 0, 0, 0],
    fountains: [0, 0],
    cop: { x: 460, floor: 2, dir: 1, chase: 0 },
    janitor: { x: 430, dir: 1, timer: 180 },
    wet: null,
    walkers: [
      { x: 615, dir: 1 },
      { x: 725, dir: -1 },
    ],
    serial: 0,
    death: 0,
    listening: false,
    returnX: 0,
    returnFloor: 0,
    popups: [],
    photoPopup: 0,
    callWait: 0,
    transit: null,
  };
  setupLevel(g);
  return g;
}
export function setupLevel(g: Game) {
  g.rooms = stores.map((s) => {
    const r = roomTemplate(s);
    if (!r.fixtures.length) return r;
    const packageId = s.role === "target" ? g.rng.int(r.fixtures.length) : -1;
    for (const f of r.fixtures) {
      f.content =
        f.id === packageId
          ? "package"
          : g.black || s.role === "shop"
            ? "power"
            : g.rng.next() < 0.2
              ? "trap"
              : g.rng.next() < 0.35
                ? "power"
                : "nothing";
      f.power =
        s.theme === "food" ? g.rng.pick(powers.slice(6)) : g.rng.pick(powers);
    }
    return r;
  });
  g.lifts = shaftDefs.map((d) => ({
    x: d.x,
    y: floorY(d.min),
    min: d.min,
    max: d.max,
    auto: d.auto,
    dir: 0,
    target: null,
    called: null,
    wait: 120,
    moving: false,
  }));
  g.lamps = [1, 2, 3, 4].flatMap((floor) =>
    [140, 330, 530, 740].map((x) => ({
      x,
      y: floorY(floor) - 32,
      floor,
      disco: floor === 3,
      mode: "hang" as const,
      vx: 0,
      vy: 0,
      dark: 0,
    })),
  );
  g.player = actor();
  g.safe = { x: 80, floor: 0 };
  g.spies = [];
  g.bullets = [];
  g.pickups = [];
  g.popups = [];
  g.toys = [];
  g.packages = 0;
  g.time = 0;
  g.alarm = false;
  g.spawn = 300;
  g.clearAwarded = false;
  g.death = 0;
  g.store = -1;
  g.search = null;
  g.overlay = null;
  g.paTimer = 3600;
  g.kiosks.fill(0);
  g.fountains.fill(0);
  g.cop = { x: 460, floor: 1 + g.rng.int(4), dir: 1, chase: 0 };
  g.wet = null;
  g.transit = null;
  g.callWait = 0;
  resetPowers(g, false);
}
export function scene(g: Game, s: Scene) {
  g.scene = s;
  g.sceneFrame = 0;
  g.fade = 12;
  g.overlay = null;
}
export function banner(g: Game, s: string, t = 150) {
  g.banner = s;
  g.bannerTime = t;
}
export function score(g: Game, n: number) {
  if (n) g.popups.push({ x: g.player.x, y: g.player.y - 24, n, life: 60 });
  g.score = clamp(g.score + n, 0, 999999);
  g.high = Math.max(g.high, g.score);
  if (g.score >= 20000 && !g.extra) {
    g.extra = true;
    g.lives++;
    g.events.push("power");
    banner(g, "20,000 POINTS! 1-UP");
  }
}
export function grant(g: Game, p: Power) {
  score(g, 50);
  g.events.push("power");
  banner(g, p);
  if (p === ui.RAPID_FIRE || p === ui.SPREAD_SHOT) {
    g.weapon = p;
    g.weaponTime = 1200;
  } else if (p === ui.SNEAKERS || p === ui.ORANGE_JULI_OOZE) {
    g.speed = p;
    g.speedTime = p === ui.SNEAKERS ? 1200 : 720;
  } else if (p === ui.ARMOR_VEST || p === ui.SOFT_PRETZEL) g.armor = true;
  else if (p === ui.RADAR) g.radar = true;
  else if (p === "1-UP") g.lives++;
  else g.food = 360;
}
export function exitBooth(g: Game) {
  g.player.hidden = 0;
  if (!g.photo) {
    g.photo = true;
    g.inventory.push(ui.PHOTO_STRIP);
    g.photoPopup = 180;
    banner(g, ui.PHOTO_STRIP_ADDED, 150);
  }
}
function resetPowers(g: Game, keepRadar = true) {
  g.weapon = null;
  g.weaponTime = 0;
  g.speed = null;
  g.speedTime = 0;
  g.armor = false;
  g.food = 0;
  if (!keepRadar) g.radar = false;
}
export function hurt(g: Game) {
  const p = g.player;
  if (p.inv || g.food || g.death || !["mall", "store"].includes(g.scene))
    return;
  if (g.armor) {
    g.armor = false;
    p.inv = 60;
    g.events.push("ping");
    banner(g, ui.ARMOR_SAVED_YOU);
    return;
  }
  g.lives--;
  g.death = 45;
  g.events.push("death");
  g.search = null;
  g.spies = [];
  g.bullets = [];
  p.stun = 0;
  g.cop.chase = 0;
  resetPowers(g);
  banner(g, ui.BARGAIN_BASEMENT_BUSTED, 90);
}
function respawn(g: Game) {
  g.player = actor(g.safe.x, g.safe.floor);
  g.player.inv = 120;
  g.spies = [];
  g.bullets = [];
  g.death = 0;
  if (g.scene === "store") {
    g.player = actor(g.rooms[g.store].w / 2, 0);
    g.player.y = g.rooms[g.store].h - 22;
    g.player.inv = 120;
    spawnGuards(g);
  }
}
export function killSpy(g: Game, s: Spy, points = 100) {
  if (s.dead) return;
  s.hp--;
  if (s.hp > 0) {
    s.stun = 20;
    g.events.push("ping");
    return;
  }
  s.dead = 24;
  s.aim = 0;
  score(g, points);
  g.events.push(points === 300 ? "crush" : "hurt");
  if (points === 300) g.shake = 10;
  if (g.rng.next() < 0.35) {
    s.bubble = g.rng.pick(lastWords);
    s.bubbleTime = 90;
  }
  if (g.rng.next() < 0.05)
    g.pickups.push({
      x: s.x,
      y: s.y - 8,
      vx: 0,
      vy: 0,
      floor: s.floor,
      kind:
        g.rng.next() < 0.5
          ? g.rng.pick(powers.slice(6))
          : g.rng.pick(powers.slice(0, 6)),
      life: 600,
    });
}
export function makeSpy(g: Game, x: number, floor: number, bot = false): Spy {
  return {
    id: ++g.serial,
    x,
    y: floorY(floor),
    floor,
    dir: -1,
    age: 0,
    aim: 0,
    low: false,
    cool: 120,
    dead: 0,
    duck: 0,
    volley: -1,
    stun: 0,
    hp: bot ? 3 : 1,
    bot,
    wait: 0,
    bubble: "",
    bubbleTime: 0,
    nav: null,
  };
}
function spawnGuards(g: Game) {
  const r = g.rooms[g.store];
  g.spies = [
    makeSpy(g, 55, 0),
    makeSpy(g, 195, 0, g.store === 1 || g.store === 8),
  ];
  g.spies[0].y = 72;
  g.spies[1].y = 80;
  if (r.cleared) g.spies = [];
}
export function enterStore(g: Game, id: number) {
  const s = stores[id],
    r = g.rooms[id];
  if (s.role === "closed" || r.cleared) return;
  g.returnX = s.x + 40;
  g.returnFloor = s.floor;
  g.store = id;
  g.player = actor(r.w / 2, 0);
  g.player.y = r.h - 22;
  g.player.face = 0;
  g.bullets = [];
  g.pickups = [];
  g.search = null;
  g.toys = [];
  scene(g, "store");
  spawnGuards(g);
  g.firstVisit = r.visited ? 0 : 150;
  r.visited = true;
  g.egg = id === 3 && !g.gameStonk ? 180 : 0;
  if (g.egg) {
    g.gameStonk = true;
    g.eggItem = g.rng.pick(jokeItems);
  }
  g.events.push("door");
}
export function leaveStore(g: Game) {
  const p = g.player;
  g.player = actor(g.returnX, g.returnFloor);
  g.player.inv = Math.max(p.inv, 45);
  g.safe = { x: g.returnX, floor: g.returnFloor };
  g.spies = [];
  g.bullets = [];
  g.toys = [];
  g.search = null;
  g.listening = false;
  g.store = -1;
  scene(g, "mall");
  g.events.push("door");
}
export function touching(p: Actor, f: Fixture) {
  return (
    p.x + 7 >= f.x - 3 &&
    p.x - 7 <= f.x + f.w + 3 &&
    p.y + 6 >= f.y - 3 &&
    p.y - 6 <= f.y + f.h + 3
  );
}
export function fixtureFace(p: Actor, f: Fixture) {
  const dx = f.x + f.w / 2 - p.x,
    dy = f.y + f.h / 2 - p.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
export function startSearch(g: Game) {
  const r = g.rooms[g.store],
    p = g.player;
  const f = r.fixtures
    .filter((f) => !f.open && touching(p, f))
    .sort(
      (a, b) =>
        Math.hypot(a.x + a.w / 2 - p.x, a.y + a.h / 2 - p.y) -
        Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y),
    )[0];
  if (!f) return;
  p.face = fixtureFace(p, f);
  g.search = { fixture: f.id, frame: 0, face: p.face };
  g.events.push("search");
}
export function finishSearch(g: Game, f: Fixture) {
  g.search = null;
  if (
    g.store === 0 &&
    f.kind === "fitting" &&
    !f.surprise &&
    g.rng.next() < 0.25
  ) {
    f.surprise = true;
    const s = makeSpy(g, f.x + f.w + 10, 0);
    s.y = f.y + 12;
    s.bubble = labels.occupied;
    s.bubbleTime = 90;
    g.spies.push(s);
    g.bullets.push({
      x: s.x,
      y: s.y,
      vx: -2,
      vy: 0,
      enemy: true,
      life: 90,
      id: ++g.serial,
    });
    banner(g, labels.occupied);
    g.events.push("shriek");
    return;
  }
  f.open = true;
  if (f.content === "package") {
    g.packages++;
    score(g, 500);
    g.rooms[g.store].cleared = true;
    banner(g, `PACKAGE ${g.packages}/6`, 180);
    g.events.push("package");
    g.player.inv = Math.max(90, g.player.inv);
  } else if (f.content === "power") grant(g, f.power!);
  else if (f.content === "trap") {
    g.player.stun = 60;
    banner(g, labels.trap);
    g.events.push("smoke");
  } else {
    banner(g, labels.nothing);
    g.events.push("smoke");
  }
}
function timers(g: Game) {
  const p = g.player;
  for (const k of ["inv", "stun", "hidden"] as const)
    if (p[k] > 0) {
      p[k]--;
      if (k === "hidden" && p[k] === 0) exitBooth(g);
    }
  if (g.weaponTime > 0 && !--g.weaponTime) g.weapon = null;
  if (g.speedTime > 0 && !--g.speedTime) g.speed = null;
  if (g.food > 0) g.food--;
  if (g.cool > 0) g.cool--;
  if (g.bannerTime > 0) g.bannerTime--;
  if (g.shake > 0) g.shake--;
  if (g.photoPopup > 0) g.photoPopup--;
  g.kiosks = g.kiosks.map((n) => Math.max(0, n - 1));
  g.fountains = g.fountains.map((n) => Math.max(0, n - 1));
  g.popups = g.popups.filter((p) => --p.life > 0);
  g.time++;
  if (!g.alarm && g.time >= difficulty(g.loop).alarm) {
    g.alarm = true;
    banner(g, labels.alarm, 200);
    g.events.push("alarm");
  }
  if (--g.paTimer <= 0) {
    let i = g.rng.int(pa.length - 1);
    if (i >= g.paIndex) i++;
    g.paIndex = i;
    banner(g, pa[i], 240);
    g.events.push("chime");
    g.paTimer = 3600;
  }
}
export function step(g: Game, held: Pad = {}, pressed: Pad = {}): Game {
  g.events = [];
  g.frame++;
  if (g.overlay) {
    if (pressed.select || pressed.start) {
      g.overlay = null;
      g.events.push("pause");
    }
    return g;
  }
  const any = buttons.some((b) => pressed[b]);
  g.sceneFrame++;
  if (g.fade > 0) g.fade--;
  if (g.scene === "splash") {
    if (g.sceneFrame === 60) g.events.push("jingle");
    if (any || g.sceneFrame >= 180) scene(g, "title");
    return g;
  }
  if (g.scene === "title") {
    for (const b of buttons)
      if (pressed[b]) {
        g.code = codeProgress(g.code, b);
        if (g.code.length === 10) {
          g.black = true;
          banner(g, ui.BLACK_FRIDAY_70_OFF_EVERYTHING, 240);
          g.events.push("power");
          g.code = [];
        }
      }
    if (g.bannerTime > 0) g.bannerTime--;
    if (pressed.start) {
      g.score = 0;
      g.lives = 3;
      g.continues = 3;
      g.loop = 1;
      g.extra = false;
      g.inventory = [];
      g.photo = false;
      g.gameStonk = false;
      setupLevel(g);
      g.post = g.rng.pick(arrivalPosts);
      scene(g, "arrival");
      g.events.push("zip");
    }
    return g;
  }
  if (g.scene === "arrival") {
    const t = g.sceneFrame;
    g.player.x = t < 90 ? 28 + t * 0.62 : 84;
    g.player.y = t < 90 ? -32 + t * 0.85 : 48;
    if (t === 90) g.events.push("land");
    if (t === 115) g.events.push("camera");
    if (t > 120 && (any || t >= 270)) {
      scene(g, "mall");
      g.player = actor(84, 0);
    }
    return g;
  }
  if (g.scene === "continue") {
    if (g.sceneFrame % 60 === 1) g.events.push("beep");
    if (pressed.start && g.continues > 0) {
      g.continues--;
      g.lives = 3;
      resetPowers(g, false);
      scene(g, g.store >= 0 ? "store" : "mall");
      respawn(g);
    } else if (g.sceneFrame >= 600) {
      scene(g, "over");
      g.events.push("chime");
    }
    return g;
  }
  if (g.scene === "over") {
    if (g.sceneFrame < 150 && g.sceneFrame % 3 === 0) g.events.push("text");
    if (g.sceneFrame === 150) g.events.push("gameover");
    if (g.sceneFrame > 330 || (pressed.start && g.sceneFrame > 100))
      scene(g, "title");
    return g;
  }
  if (g.scene === "clear") {
    if (pressed.start || g.sceneFrame >= (g.clearStage === 0 ? 240 : 210)) {
      g.clearStage++;
      g.sceneFrame = 0;
      if (g.clearStage === 1) g.headline = g.rng.pick(headlines);
      if (g.clearStage === 2) g.post = g.rng.pick(completePosts);
      if (g.clearStage >= 3) {
        g.loop++;
        setupLevel(g);
        scene(g, "arrival");
        g.post = g.rng.pick(arrivalPosts);
      }
    }
    return g;
  }
  if (pressed.select) {
    g.overlay = "map";
    g.events.push("pause");
    return g;
  }
  if (pressed.start) {
    g.overlay = "pause";
    g.events.push("pause");
    return g;
  }
  timers(g);
  if (g.death) {
    if (--g.death === 0) {
      if (g.lives > 0) respawn(g);
      else {
        scene(g, g.continues > 0 ? "continue" : "over");
        if (g.continues === 0) g.events.push("chime");
      }
    }
    return g;
  }
  if (g.scene === "store") updateStore(g, held, pressed);
  else updateMall(g, held, pressed);
  updateBullets(g);
  updatePickups(g);
  return g;
}
export function updateLifts(g: Game, h: Pad) {
  const p = g.player;
  for (let i = 0; i < g.lifts.length; i++) {
    const l = g.lifts[i];
    const before = l.y;
    const inside = p.lift === i,
      roof = p.roof === i;
    const aligned = Math.abs((l.y - 48) % 48) < 0.01;
    if (inside && !l.auto) {
      if (h.up && l.y > floorY(l.min)) {
        l.dir = -1;
        l.target = null;
      } else if (h.down && l.y < floorY(l.max)) {
        l.dir = 1;
        l.target = null;
      } else if (l.dir && l.target === null)
        l.target = clamp(
          l.dir > 0 ? Math.ceil((l.y - 48) / 48) : Math.floor((l.y - 48) / 48),
          l.min,
          l.max,
        );
    }
    if (l.auto && !inside && l.target === null && aligned && --l.wait <= 0) {
      const floors = Array.from(
        { length: l.max - l.min + 1 },
        (_, j) => l.min + j,
      ).filter((f) => floorY(f) !== l.y);
      l.target = g.rng.pick(floors);
      l.dir = Math.sign(floorY(l.target) - l.y);
    }
    if (l.target !== null) l.dir = Math.sign(floorY(l.target) - l.y);
    if (l.dir) {
      l.y = clamp(l.y + l.dir, floorY(l.min), floorY(l.max));
      l.moving = true;
      const reached =
        (l.target !== null && l.y === floorY(l.target)) ||
        l.y === floorY(l.min) ||
        l.y === floorY(l.max);
      if (reached) {
        l.dir = 0;
        l.target = null;
        l.wait = 120;
        if (l.moving) {
          g.events.push("ding");
          l.moving = false;
          if (inside) banner(g, floorLines[Math.round((l.y - 48) / 48)], 120);
          if (l.called !== null && l.y === floorY(l.called)) {
            if (p.floor === l.called && Math.abs(p.x - l.x) < 26) {
              p.lift = i;
              p.roof = -1;
              p.x = l.x;
              p.y = l.y;
              p.ground = true;
            }
            l.called = null;
          } else if (
            g.rng.next() < 0.12 &&
            Math.abs(p.x - l.x) < 200 &&
            g.spies.length < difficulty(g.loop, g.black).cap
          ) {
            const s = makeSpy(g, l.x + 18, Math.round((l.y - 48) / 48));
            s.bubble = g.rng.pick(liftWords);
            s.bubbleTime = 100;
            g.spies.push(s);
          }
        }
      }
    }
    if (inside || roof) {
      p.y = l.y - (roof ? 23 : 0);
      p.x = clamp(p.x, l.x - 9, l.x + 9);
      p.floor = clamp(Math.round((l.y - 48) / 48), 0, 5);
      p.ground = true;
      if (roof && l.y <= floorY(l.min) + 23) hurt(g);
      if (!l.dir && Math.abs((l.y - 48) % 48) < 0.01 && (h.left || h.right)) {
        p.x = l.x + (h.left ? -24 : 24);
        p.y = l.y;
        p.floor = Math.round((l.y - 48) / 48);
        p.lift = -1;
        p.roof = -1;
        g.safe = { x: p.x, floor: p.floor };
      }
    }
    if (l.y > before) {
      for (const s of g.spies)
        if (
          !s.dead &&
          Math.abs(s.x - l.x) < 12 &&
          before - 23 <= s.y &&
          l.y >= s.y
        )
          killSpy(g, s, 300);
      if (
        p.lift !== i &&
        p.roof !== i &&
        Math.abs(p.x - l.x) < 11 &&
        before - 23 <= p.y &&
        l.y >= p.y &&
        l.called !== p.floor
      )
        hurt(g);
    }
  }
}
export function callLift(g: Game, i: number, floor: number) {
  const l = g.lifts[i];
  if (floor < l.min || floor > l.max) return;
  l.called = floor;
  l.target = floor;
  l.dir = Math.sign(floorY(floor) - l.y);
  g.events.push("call");
}
function updateMall(g: Game, h: Pad, e: Pad) {
  const p = g.player;
  updateLifts(g, h);
  updateNPCs(g, h, e);
  if (g.transit) {
    const t = g.transit;
    t.frame++;
    p.x =
      t.x +
      (t.from > t.to ? -12 + (24 * t.frame) / 48 : 12 - (24 * t.frame) / 48);
    p.y = floorY(t.from) + ((floorY(t.to) - floorY(t.from)) * t.frame) / 48;
    if (t.frame >= 48) {
      p.floor = t.to;
      p.y = floorY(t.to);
      p.ground = true;
      g.transit = null;
      g.safe = { x: p.x, floor: p.floor };
    }
    return;
  }
  if (p.hidden) {
    if (e.up || e.down || e.left || e.right) exitBooth(g);
    else return;
  }
  if (p.stun) return;
  const speed = g.speed === ui.SNEAKERS ? 1.6 : g.speed ? 1.5 : 1;
  const move = h.left ? -1 : h.right ? 1 : 0;
  p.duck = !!h.down && p.ground && p.lift < 0;
  if (p.lift < 0 && p.roof < 0) {
    if (p.slide) {
      p.vx = p.slide * speed;
    } else if (p.ground) p.vx = move * speed;
    else if (move) p.vx = move * speed;
    if (move) p.dir = move;
    if (e.b && p.ground) {
      p.vy = g.speed === ui.SNEAKERS ? -4.4 : -3.8;
      p.ground = false;
      p.kick = move !== 0;
      g.events.push("jump");
    }
    p.x = clamp(p.x + p.vx, 8, 760);
    if (!p.ground) {
      p.vy += 0.34;
      p.y += p.vy;
      const land = floorY(p.floor);
      if (p.vy > 0 && p.y >= land) {
        p.y = land;
        p.vy = 0;
        p.ground = true;
        if (g.wet && p.floor === 4 && p.x > g.wet.x && p.x < g.wet.x + 48)
          p.slide = p.dir;
        if (!p.slide) p.kick = false;
      }
    }
    const shaft = g.lifts.findIndex(
      (l) => Math.abs(p.x - l.x) < 10 && p.floor >= l.min && p.floor <= l.max,
    );
    if (shaft >= 0 && p.ground) {
      const l = g.lifts[shaft],
        fy = floorY(p.floor);
      if (Math.abs(l.y - fy) < 1) {
        if (e.up || e.down) {
          p.lift = shaft;
          p.x = l.x;
        }
      } else if (l.y > fy) {
        if (l.called === p.floor) {
          p.y = fy;
        } else if (l.y - fy <= 48) {
          p.roof = shaft;
          p.y = l.y - 23;
          p.ground = true;
        } else {
          hurt(g);
          banner(g, ui.WATCH_THE_OPEN_SHAFT);
        }
      } else if (e.up || e.down) {
        callLift(g, shaft, p.floor);
        p.vy = 0;
      }
    }
    if (shaft < 0 && p.ground) p.vy = 0;
    const waiting = g.lifts.findIndex(
      (l) =>
        Math.abs(p.x - l.x) < 25 &&
        p.floor >= l.min &&
        p.floor <= l.max &&
        l.y !== floorY(p.floor),
    );
    if (waiting >= 0 && !move && p.ground) {
      if (++g.callWait >= 30) {
        callLift(g, waiting, p.floor);
        g.callWait = 0;
      }
    } else g.callWait = 0;
    if (p.ground && shaft < 0 && p.floor >= 0)
      g.safe = { x: p.x, floor: p.floor };
  }
  if (e.a || (h.a && g.weapon === ui.RAPID_FIRE)) shoot(g);
  if ((e.up || e.down) && p.lift < 0 && p.roof < 0 && p.ground) {
    const nearLift = g.lifts.findIndex(
      (l) => Math.abs(p.x - l.x) < 25 && p.floor >= l.min && p.floor <= l.max,
    );
    if (nearLift >= 0) {
      const l = g.lifts[nearLift];
      if (Math.abs(l.y - floorY(p.floor)) < 1) {
        p.lift = nearLift;
        p.x = l.x;
      } else callLift(g, nearLift, p.floor);
    } else {
      const esc = escalators.find(
        (x) =>
          Math.abs(p.x - x.x) < 18 &&
          ((e.up && p.floor === x.bottom) || (e.down && p.floor === x.top)),
      );
      if (esc) {
        g.transit = {
          x: esc.x,
          from: p.floor,
          to: e.up ? esc.top : esc.bottom,
          frame: 0,
        };
        p.ground = false;
        p.inv = Math.max(p.inv, 60);
        g.events.push("slide");
        banner(g, ui.TAKING_THE_MOVING_STAIRS, 75);
      } else {
        const s = stores.find(
          (s) => s.floor === p.floor && Math.abs(p.x - (s.x + 40)) < 15,
        );
        if (s && e.up) {
          enterStore(g, s.id);
          return;
        }
        if (p.floor === 5 && Math.abs(p.x - 690) < 36 && e.up) {
          exit(g);
          return;
        }
        if (
          e.up &&
          Math.abs(p.x - 486) < 15 &&
          p.floor >= 1 &&
          p.floor <= 4 &&
          g.kiosks[p.floor] === 0
        ) {
          const target = stores
            .filter((s) => s.role === "target" && !g.rooms[s.id].cleared)
            .sort(
              (a, b) =>
                Math.abs(a.floor - p.floor) - Math.abs(b.floor - p.floor) ||
                Math.abs(a.x - p.x) - Math.abs(b.x - p.x),
            )[0];
          banner(
            g,
            target
              ? `NEXT: ${target.name} / ${["R", "4F", "3F", "2F", "1F", "P"][target.floor]}`
              : ui.ALL_PACKAGES_FOUND_GO_TO_P,
            200,
          );
          g.kiosks[p.floor] = 1200;
          g.events.push("chime");
        }
        if (e.up && p.floor === 2 && Math.abs(p.x - 450) < 15) {
          p.hidden = 300;
          banner(g, ui.PHOTO_BOOTH_SAY_SPY, 90);
          g.events.push("camera");
        }
      }
    }
  }
  for (const l of g.lamps) {
    if (l.dark > 0) l.dark--;
    if (l.mode === "fall") {
      l.vy += 0.25;
      l.y += l.vy;
      if (l.y >= floorY(l.floor) - 5) {
        l.y = floorY(l.floor) - 5;
        l.mode = l.disco ? "roll" : "gone";
        l.dark = 120;
        g.shake = 10;
        g.events.push("glass");
      }
    }
    if (l.mode === "roll") {
      l.x += l.vx * 2;
      if (
        l.x < 8 ||
        l.x > 760 ||
        g.lifts.some((s) => Math.abs(s.x - l.x) < 12 && s.y > floorY(l.floor))
      )
        l.mode = "gone";
    }
    if (l.mode === "fall" || l.mode === "roll") {
      for (const s of g.spies)
        if (!s.dead && Math.abs(s.x - l.x) < 14 && Math.abs(s.y - l.y) < 24)
          killSpy(g, s, 300);
      if (Math.abs(p.x - l.x) < 12 && Math.abs(p.y - l.y) < 22) hurt(g);
    }
  }
  updateSpies(g, false);
  if (--g.spawn <= 0) {
    g.spawn = difficulty(g.loop, g.black).spawn * (g.alarm ? 0.7 : 1);
    const candidates = stores.filter(
      (s) =>
        s.role !== "closed" &&
        !g.rooms[s.id].cleared &&
        Math.abs(s.floor - p.floor) <= 1 &&
        Math.abs(s.x + 40 - p.x) >= 64 &&
        Math.abs(s.x + 40 - p.x) <= 200,
    );
    if (
      g.spies.filter((s) => !s.dead).length < difficulty(g.loop, g.black).cap &&
      candidates.length
    ) {
      const s = g.rng.pick(candidates);
      g.spies.push(makeSpy(g, s.x + 40, s.floor));
    }
  }
}
export function exit(g: Game) {
  if (g.packages < 6) {
    banner(g, `PACKAGES LEFT: ${6 - g.packages}`);
    g.events.push("buzzer");
    return;
  }
  if (g.clearAwarded) return;
  g.clearAwarded = true;
  g.bonus = Math.max(0, 300 - Math.floor(g.time / 60)) * 10;
  score(g, 1000 + g.bonus);
  g.clearStage = 0;
  scene(g, "clear");
  g.events.push("clear");
}
export function shoot(g: Game) {
  const p = g.player;
  if (g.cool || p.stun || p.hidden) return;
  const cap = g.weapon === ui.RAPID_FIRE ? 4 : 2;
  if (g.bullets.filter((b) => !b.enemy).length >= cap) return;
  g.search = null;
  g.cool = g.weapon === ui.RAPID_FIRE ? 6 : 14;
  g.events.push("shot");
  const store = g.scene === "store",
    dx = store ? [0, 1, 0, -1][p.face] : p.dir,
    dy = store ? [-1, 0, 1, 0][p.face] : 0;
  const x = p.x + dx * 10,
    y = store ? p.y + dy * 10 : p.y - (p.duck ? 7 : 16),
    volley = ++g.serial;
  for (const spread of g.weapon === ui.SPREAD_SHOT ? [-0.65, 0, 0.65] : [0])
    g.bullets.push({
      x,
      y,
      vx: dx * 4 + (dy ? spread : 0),
      vy: dy * 4 + (dx ? spread : 0),
      enemy: false,
      life: 80,
      id: volley,
    });
  if (
    !store &&
    g.cop.floor === p.floor &&
    Math.abs(g.cop.x - p.x) < 128 &&
    Math.sign(p.x - g.cop.x) === g.cop.dir
  ) {
    g.cop.chase = 600;
    banner(g, labels.cop);
    g.events.push("whistle");
  }
}
function solid(r: Room, x: number, y: number) {
  return (
    x < 23 ||
    x > r.w - 23 ||
    y < 23 ||
    y > r.h - 10 ||
    (y > r.h - 22 && Math.abs(x - r.w / 2) > 12) ||
    r.fixtures.some(
      (f) =>
        x + 6 > f.x && x - 6 < f.x + f.w && y + 6 > f.y && y - 6 < f.y + f.h,
    )
  );
}
export function roomMove(r: Room, p: Actor, dx: number, dy: number) {
  if (!solid(r, p.x + dx, p.y + dy)) {
    p.x += dx;
    p.y += dy;
    return;
  } // gentle corner assistance, no tunnelling through fixtures
  for (const offset of [-1, 1, -2, 2]) {
    const nx = p.x + dx + (dy ? offset : 0),
      ny = p.y + dy + (dx ? offset : 0);
    if (!solid(r, nx, ny)) {
      p.x = nx;
      p.y = ny;
      return;
    }
  }
}
/** An eight-pixel navigation grid keeps guards moving around solid fixtures. */
export function roomWaypoint(
  r: Room,
  x: number,
  y: number,
  tx: number,
  ty: number,
): { x: number; y: number } | null {
  const cols = Math.ceil(r.w / 8),
    rows = Math.ceil(r.h / 8),
    key = (cx: number, cy: number) => cy * cols + cx;
  const sx = Math.floor(x / 8),
    sy = Math.floor(y / 8),
    start = key(sx, sy);
  const candidates = [];
  for (let cy = Math.floor(ty / 8) - 1; cy <= Math.floor(ty / 8) + 1; cy++)
    for (let cx = Math.floor(tx / 8) - 1; cx <= Math.floor(tx / 8) + 1; cx++)
      if (!solid(r, cx * 8 + 4, cy * 8 + 4))
        candidates.push({
          cx,
          cy,
          d: Math.hypot(cx * 8 + 4 - tx, cy * 8 + 4 - ty),
        });
  candidates.sort((a, b) => a.d - b.d);
  if (!candidates.length) return null;
  const goal = key(candidates[0].cx, candidates[0].cy),
    queue = [start],
    parents = new Map<number, number>();
  parents.set(start, start);
  for (let i = 0; i < queue.length && i < 8192; i++) {
    const k = queue[i];
    if (k === goal) break;
    const cx = k % cols,
      cy = Math.floor(k / cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy,
        n = key(nx, ny);
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= cols ||
        ny >= rows ||
        parents.has(n) ||
        solid(r, nx * 8 + 4, ny * 8 + 4)
      )
        continue;
      parents.set(n, k);
      queue.push(n);
    }
  }
  if (!parents.has(goal)) return null;
  let next = goal;
  while (parents.get(next) !== start && next !== start)
    next = parents.get(next)!;
  return { x: (next % cols) * 8 + 4, y: Math.floor(next / cols) * 8 + 4 };
}
function updateStore(g: Game, h: Pad, e: Pad) {
  const p = g.player,
    r = g.rooms[g.store];
  if (g.egg) {
    g.egg--;
    if (g.egg % 3 === 0) g.events.push("text");
    return;
  }
  if (g.firstVisit > 0) {
    g.firstVisit--;
    if (g.firstVisit === 0) p.inv = Math.max(p.inv, 120);
    const key = g.store === 2 ? "crook" : stores[g.store].theme,
      lines = firstLines[key] ?? [];
    g.spies.forEach((s, i) => {
      s.bubble =
        i === 0 && g.firstVisit > 90
          ? (lines[0] ?? "")
          : i === 1 && g.firstVisit <= 90
            ? (lines[1] ?? "")
            : "";
      s.bubbleTime = 2;
    });
    return;
  }
  if (
    g.store === 3 &&
    g.eggItem &&
    Math.abs(p.x - 128) < 13 &&
    Math.abs(p.y - 72) < 15
  ) {
    g.inventory.push(g.eggItem);
    score(g, 1);
    banner(g, ui.YOU_GOT + g.eggItem, 180);
    g.eggItem = null;
    g.events.push("item");
  }
  if (g.search) {
    const dir = e.up ? 0 : e.right ? 1 : e.down ? 2 : e.left ? 3 : -1;
    if (e.a || (dir >= 0 && dir !== g.search.face)) g.search = null;
    else {
      g.search.frame++;
      if (g.search.frame % 10 === 0) g.events.push("search");
      if (g.search.frame >= (g.speed ? 30 : 45))
        finishSearch(g, r.fixtures[g.search.fixture]);
    }
  }
  if (!g.search && !p.stun) {
    const dx = h.up || h.down ? 0 : h.left ? -1 : h.right ? 1 : 0,
      dy = h.up ? -1 : h.down ? 1 : 0;
    if (dx || dy) {
      p.face = dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3;
      p.dir = dx || p.dir;
      roomMove(r, p, dx * (g.speed ? 1.5 : 1), dy * (g.speed ? 1.5 : 1));
    }
    if (e.b) startSearch(g);
    if (e.a || (h.a && g.weapon === ui.RAPID_FIRE)) shoot(g);
    if (p.y > r.h - 28 && Math.abs(p.x - r.w / 2) < 14 && h.down) {
      leaveStore(g);
      return;
    }
  }
  const listening = g.store === 7 && p.x > 164 && p.y < 42;
  if (listening && !g.listening) banner(g, ui.NOW_PLAYING_SIDE_B);
  g.listening = listening;
  for (const t of g.toys) {
    t.life--;
    if (solid(r, t.x + t.dx, t.y + t.dy)) {
      t.dx = -t.dx;
      t.dy = -t.dy;
    }
    t.x += t.dx;
    t.y += t.dy;
    for (const s of g.spies)
      if (Math.hypot(t.x - s.x, t.y - s.y) < 14) s.stun = 120;
    for (const f of r.fixtures)
      if (
        !f.open &&
        f.content === "trap" &&
        Math.hypot(t.x - f.x - 12, t.y - f.y - 12) < 24
      ) {
        f.open = true;
        g.events.push("smoke");
        for (const s of g.spies)
          if (Math.hypot(s.x - f.x, s.y - f.y) < 64) s.stun = 120;
      }
  }
  g.toys = g.toys.filter((t) => t.life > 0);
  updateSpies(g, true);
}
function updateSpies(g: Game, room: boolean) {
  const p = g.player,
    d = difficulty(g.loop, g.black);
  for (const s of g.spies) {
    s.age++;
    if (s.bubbleTime > 0) s.bubbleTime--;
    if (s.dead) {
      s.dead--;
      if (!s.dead) s.hp = 0;
      continue;
    }
    if (s.stun) {
      s.stun--;
      continue;
    }
    if (s.duck) s.duck--;
    const visible =
      !p.hidden &&
      !g.death &&
      g.sceneFrame > 30 &&
      (room || s.floor === p.floor) &&
      Math.abs(p.x - s.x) < 160;
    const dx = p.x - s.x,
      dy = p.y - s.y;
    if (!s.aim) {
      if (room) {
        const mx = visible ? Math.sign(dx) : s.dir,
          my = visible ? Math.sign(dy) : 0;
        const a = actor(s.x, 0);
        a.y = s.y;
        if (s.bot) {
          roomMove(g.rooms[g.store], a, s.dir * 0.55, 0);
          if (a.x === s.x) s.dir = -s.dir;
        } else {
          if (
            visible &&
            (s.age % 16 === 1 ||
              !s.nav ||
              Math.hypot(s.nav.x - s.x, s.nav.y - s.y) < 1)
          )
            s.nav = roomWaypoint(g.rooms[g.store], s.x, s.y, p.x, p.y);
          const nx = visible && s.nav ? s.nav.x - s.x : mx,
            ny = visible && s.nav ? s.nav.y - s.y : my;
          roomMove(
            g.rooms[g.store],
            a,
            Math.abs(nx) > Math.abs(ny) ? clamp(nx, -0.45, 0.45) : 0,
            Math.abs(nx) > Math.abs(ny) ? 0 : clamp(ny, -0.45, 0.45),
          );
          if (nx) s.dir = Math.sign(nx);
        }
        s.x = a.x;
        s.y = a.y;
      } else {
        if (visible) s.dir = Math.sign(dx) || s.dir;
        const near = g.lifts.find(
          (l) =>
            Math.abs(s.x + s.dir - l.x) < 14 &&
            s.floor >= l.min &&
            s.floor <= l.max,
        );
        if (near && near.y > floorY(s.floor)) s.wait = 60;
        if (s.wait) s.wait--;
        else if (!visible || Math.abs(dx) > 40)
          s.x = clamp(
            s.x + s.dir * 0.5 * d.speed * (g.alarm ? 1.25 : 1),
            8,
            760,
          );
        if (s.x <= 8 || s.x >= 760) s.dir = -s.dir;
      }
    }
    const volley = g.bullets.find(
      (b) =>
        !b.enemy &&
        Math.abs(b.y - (s.y - (room ? 0 : 16))) < 8 &&
        Math.abs(b.x - s.x) < 72 &&
        Math.sign(b.vx) === Math.sign(s.x - b.x),
    );
    if (volley && s.volley !== volley.id) {
      s.volley = volley.id;
      if (g.rng.next() < 0.1) s.duck = 35;
    }
    if (s.cool > 0) s.cool--;
    const aligned = room ? Math.abs(dx) < 9 || Math.abs(dy) < 9 : true;
    const clear = room
      ? !g.rooms[g.store].fixtures.some((f) =>
          Math.abs(dx) < 9
            ? s.x > f.x &&
              s.x < f.x + f.w &&
              Math.min(s.y, p.y) < f.y &&
              Math.max(s.y, p.y) > f.y + f.h
            : s.y > f.y &&
              s.y < f.y + f.h &&
              Math.min(s.x, p.x) < f.x &&
              Math.max(s.x, p.x) > f.x + f.w,
        )
      : true;
    if (!s.bot && visible && aligned && clear && !s.cool && !s.aim) {
      s.aim = 30;
      s.low = g.rng.next() < 0.5;
    }
    if (s.aim) {
      s.aim--;
      if (!s.aim) {
        const vx = room && Math.abs(dx) < 9 ? 0 : Math.sign(dx) * 2,
          vy = room && Math.abs(dx) < 9 ? Math.sign(dy) * 2 : 0;
        g.bullets.push({
          x: s.x + vx * 5,
          y: s.y - (room ? 0 : s.low ? 7 : 16),
          vx,
          vy,
          enemy: true,
          life: 150,
          id: ++g.serial,
        });
        s.cool = d.shot;
        g.events.push("enemy");
      }
    }
    if (
      Math.abs(s.x - p.x) < 12 &&
      Math.abs(s.y - p.y) < (room ? 13 : 18) &&
      !p.hidden
    ) {
      if (g.food || p.kick) killSpy(g, s, p.slide ? 300 : 100);
      else hurt(g);
    }
  }
  g.spies = g.spies.filter((s) => s.hp > 0);
}
export function updateNPCs(g: Game, _h: Pad, _e: Pad) {
  const p = g.player,
    j = g.janitor;
  j.x += j.dir * 0.4;
  if (j.x < 408 || j.x > 510) j.dir = -j.dir;
  if (--j.timer <= 0) {
    g.wet = { x: clamp(j.x, 410, 482), life: 600 };
    j.timer = 720;
  }
  if (g.wet && --g.wet.life <= 0) g.wet = null;
  if (
    g.wet &&
    p.floor === 4 &&
    p.ground &&
    p.x > g.wet.x &&
    p.x < g.wet.x + 48
  ) {
    if (!p.slide) p.slide = p.dir;
    g.events.push("slide");
  } else p.slide = 0;
  for (const w of g.walkers) {
    w.x += w.dir * 0.65;
    if (w.x < 600 || w.x > 750) w.dir = -w.dir;
    if (p.floor === 3 && Math.abs(p.x - w.x) < 13 && p.ground)
      p.x += w.dir * 0.7;
  }
  const c = g.cop;
  if (c.chase) {
    c.chase--;
    if (c.floor === p.floor) {
      c.dir = Math.sign(p.x - c.x) || c.dir;
      c.x += c.dir * 1.3;
      if (Math.abs(c.x - p.x) < 14 && !p.hidden) {
        p.stun = 180;
        c.chase = 0;
        score(g, -500);
        banner(g, labels.detained);
      }
    }
  } else {
    c.x += c.dir * 0.5;
    if (c.x < 402 || c.x > 525) c.dir = -c.dir;
  }
}
function updateBullets(g: Game) {
  const p = g.player,
    room = g.scene === "store";
  for (const b of g.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (room) {
      const r = g.rooms[g.store];
      if (b.x < 16 || b.x > r.w - 16 || b.y < 16 || b.y > r.h - 8) b.life = 0;
      const f = r.fixtures.find(
        (f) => b.x >= f.x && b.x <= f.x + f.w && b.y >= f.y && b.y <= f.y + f.h,
      );
      if (f) {
        b.life = 0;
        if (!b.enemy && g.store === 4 && !f.toys) {
          f.toys = true;
          for (let i = 0; i < 3; i++)
            g.toys.push({
              x: f.x + 12,
              y: f.y + f.h + 9,
              dx: i === 1 ? 0 : i === 0 ? -1 : 1,
              dy: i === 1 ? 1 : 0,
              life: 600,
            });
          g.events.push("toy");
        }
      }
    } else {
      if (b.x < 0 || b.x > 768) b.life = 0;
      const lamp = g.lamps.find(
        (l) =>
          l.mode === "hang" &&
          Math.abs(l.x - b.x) < 7 &&
          b.y >= l.y - 7 &&
          b.y <= l.y + 18,
      );
      if (lamp && !b.enemy) {
        lamp.mode = "fall";
        lamp.vx = Math.sign(b.vx);
        lamp.vy = 0;
        b.life = 0;
        g.events.push("lamp");
      }
      for (let i = 0; i < 2; i++) {
        const f = [
          { x: 520, floor: 2 },
          { x: 295, floor: 4 },
        ][i];
        if (
          !b.enemy &&
          !g.fountains[i] &&
          Math.abs(b.x - f.x) < 18 &&
          Math.abs(b.y - floorY(f.floor) + 16) < 16
        ) {
          g.fountains[i] = 900;
          b.life = 0;
          const gold = g.rng.int(20) === 0;
          for (let n = 0; n < 3 + g.rng.int(3); n++)
            g.pickups.push({
              x: f.x,
              y: floorY(f.floor) - 18,
              vx: (n - 2) * 0.65,
              vy: -3 - g.rng.next(),
              floor: f.floor,
              kind: gold && n === 0 ? "1-UP" : "coin",
              life: 600,
            });
          g.events.push("coin");
        }
      }
      const walker = g.walkers.find(
        (w) => Math.abs(w.x - b.x) < 9 && Math.abs(b.y - floorY(3) + 12) < 13,
      );
      if (walker) {
        b.life = 0;
        if (!b.enemy) {
          score(g, -200);
          banner(g, ui.HEY_WATCH_THE_TRACKSUIT, 90);
        }
      }
      if (
        Math.abs(g.cop.x - b.x) < 9 &&
        Math.abs(b.y - floorY(g.cop.floor) + 14) < 14
      ) {
        b.life = 0;
        g.events.push("ping");
      }
    }
    if (b.life <= 0) continue;
    if (b.enemy) {
      const py = room ? p.y : p.y - (p.duck ? 6 : 12),
        height = room ? 6 : p.duck ? 5 : 10;
      if (!p.hidden && Math.abs(b.x - p.x) < 6 && Math.abs(b.y - py) < height) {
        hurt(g);
        b.life = 0;
      }
    } else {
      for (const s of g.spies) {
        if (s.dead) continue;
        const sy = room ? s.y : s.y - (s.duck ? 6 : 12);
        if (
          Math.abs(b.x - s.x) < 7 &&
          Math.abs(b.y - sy) < (room ? 7 : s.duck ? 5 : 11)
        ) {
          killSpy(g, s);
          b.life = 0;
          break;
        }
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}
function updatePickups(g: Game) {
  for (const c of g.pickups) {
    c.life--;
    if (g.scene === "mall") {
      c.vy += 0.15;
      c.x += c.vx;
      c.y += c.vy;
      if (c.y > floorY(c.floor) - 3) {
        c.y = floorY(c.floor) - 3;
        c.vy = -Math.abs(c.vy) * 0.6;
      }
    }
    if (Math.abs(c.x - g.player.x) < 12 && Math.abs(c.y - g.player.y) < 20) {
      if (c.kind === "coin") {
        score(g, 50);
        g.events.push("coin");
      } else grant(g, c.kind);
      c.life = 0;
    }
  }
  g.pickups = g.pickups.filter((c) => c.life > 0);
}
