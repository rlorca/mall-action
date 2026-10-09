import { clamp, overlap, random, pick } from "./math.js";
import {
  WIDTH,
  FLOOR_Y,
  SHAFTS,
  ESCALATORS,
  STORES,
  POWERS,
  template,
  KIOSKS,
  FOUNTAINS,
} from "./data.js";
import {
  ARRIVAL,
  COMPLETE,
  VISITS,
  LAST_WORDS,
  ELEVATOR_LINES,
  PA,
  HEADLINES,
  ITEMS,
  ANNOUNCE,
  TEXT,
  UI,
} from "./copy.js";
import { konami } from "./input.js";
export const emit = (s, type, extra = {}) => s.events.push({ type, ...extra });
export function banner(s, text, frames = 150) {
  s.banner = { text, frames };
  emit(s, "text");
}
export function award(s, points, x = s.p.x, y = s.p.y) {
  s.score = Math.max(0, s.score + points);
  s.high = Math.max(s.high, s.score);
  s.popups.push({
    x,
    y,
    text: points >= 0 ? "+" + points : String(points),
    life: 60,
  });
  if (!s.extraLife && s.score >= 20000) {
    s.extraLife = true;
    s.lives++;
    emit(s, "power");
  }
}
export function difficulty(loop, black = false, alarm = false) {
  return {
    speed: Math.min(1.8, 0.5 * (1 + 0.1 * (loop - 1))) * (alarm ? 1.25 : 1),
    spawn:
      Math.max(65, Math.floor(300 * Math.pow(0.85, loop - 1))) /
      (black ? 2 : 1) /
      (alarm ? 1.4 : 1),
    shot: Math.max(60, Math.round(150 * Math.pow(0.85, loop - 1))),
    alarm: Math.max(3600, 9000 - (loop - 1) * 1200),
    cap: black ? 8 : 4,
  };
}
export function createGame(seed = 7, { debug = false, high = 0 } = {}) {
  const s = {
    rng: Number(seed) >>> 0 || 1,
    seed: Number(seed) >>> 0 || 1,
    frame: 0,
    scene: debug ? "title" : "splash",
    sceneFrame: 0,
    overlay: null,
    events: [],
    banner: null,
    popups: [],
    bubbles: [],
    score: 0,
    high,
    lives: 3,
    continues: 3,
    loop: 1,
    extraLife: false,
    blackFriday: false,
    code: [],
    inventory: [],
    visited: [],
    gameGift: false,
    photo: false,
    p: {
      x: 100,
      y: 64,
      floor: 0,
      dir: 1,
      vx: 0,
      vy: 0,
      jump: 0,
      ride: null,
      roof: null,
      duck: false,
      inv: 0,
      freeze: 0,
      cool: 0,
      hidden: 0,
      power: {},
    },
    safe: { x: 120, floor: 0 },
    room: null,
    returnDoor: null,
    transition: null,
    shake: 0,
    lastPA: -1,
  };
  setupLevel(s);
  return s;
}
export function setupLevel(s) {
  s.elapsed = 0;
  s.alarm = false;
  s.packages = 0;
  s.exitTriggered = false;
  s.spies = [];
  s.bullets = [];
  s.coins = [];
  s.drops = [];
  s.toys = [];
  s.spawnClock = 300;
  s.paClock = 3600;
  s.lamps = [1, 2, 3, 4].flatMap((f) =>
    [148, 360, 664].map((x) => ({
      x,
      y: FLOOR_Y[f] - 26,
      floor: f,
      kind: f === 3 ? "disco" : "lamp",
      mode: "hang",
      vx: 0,
      vy: 0,
      dark: 0,
    })),
  );
  s.kiosks = structuredClone(KIOSKS);
  s.fountains = structuredClone(FOUNTAINS);
  s.wet = null;
  s.janitor = { x: 510, dir: 1, timer: 180 };
  s.walkers = [
    { x: 336, dir: 1 },
    { x: 642, dir: -1 },
  ];
  s.cop = {
    x: 400,
    floor: 1 + Math.floor(random(s) * 4),
    dir: 1,
    chase: 0,
    cool: 0,
  };
  s.elevators = SHAFTS.map((a) => ({
    ...a,
    y: FLOOR_Y[a.min],
    target: null,
    dir: 0,
    wait: 120,
    called: false,
    callFloor: null,
    stops: 0,
  }));
  s.stores = STORES.map((st) => {
    const room = template(st.id);
    const packageAt = Math.floor(random(s) * room.fixtures.length);
    return {
      ...st,
      cleared: false,
      room: {
        ...room,
        fixtures: room.fixtures.map((f, i) => ({
          ...f,
          content:
            st.role === "target" && i === packageAt
              ? "package"
              : s.blackFriday
                ? "power"
                : st.role === "shop"
                  ? random(s) < 0.85
                    ? "power"
                    : "nothing"
                  : random(s) < 0.25
                    ? "trap"
                    : random(s) < 0.28
                      ? "power"
                      : "nothing",
          power:
            st.theme === "food" ? pick(s, POWERS.slice(6)) : pick(s, POWERS),
          pranked: false,
        })),
      },
    };
  });
  s.p = {
    ...s.p,
    x: 120,
    y: 64,
    floor: 0,
    dir: 1,
    vy: 0,
    jump: 0,
    ride: null,
    roof: null,
    duck: false,
    inv: 0,
    freeze: 0,
    hidden: 0,
    cool: 0,
    slide: 0,
    power: {},
  };
  s.safe = { x: 120, floor: 0 };
  s.room = null;
  s.returnDoor = null;
  s.transition = null;
  s.banner = null;
  s.popups = [];
  s.bubbles = [];
  s.search = null;
  s.sideB = false;
  s.cave = null;
  s.dialog = 0;
  s.escalating = null;
  s.pose = 0;
  s.photoShow = 0;
  s.kioskShow = 0;
}
export function newRun(s) {
  s.score = 0;
  s.lives = 3;
  s.continues = 3;
  s.loop = 1;
  s.extraLife = false;
  s.inventory = [];
  s.visited = [];
  s.gameGift = false;
  s.photo = false;
  setupLevel(s);
  scene(s, "arrival");
  s.post = pick(s, ARRIVAL);
  emit(s, "zip");
}
export function scene(s, name) {
  s.scene = name;
  s.sceneFrame = 0;
  s.overlay = null;
}
export const hasPower = (s, k) => s.p.power[k];
export function power(s, name) {
  const p = s.p.power;
  switch (name) {
    case "RAPID FIRE":
      p.weapon = "rapid";
      p.weaponTime = 1200;
      break;
    case "SPREAD SHOT":
      p.weapon = "spread";
      p.weaponTime = 1200;
      break;
    case "ARMOR VEST":
    case "SOFT PRETZEL":
      p.armor = true;
      break;
    case "SNEAKERS":
      p.speed = "sneakers";
      p.speedTime = 1200;
      break;
    case "ORANGE JULI-OOZE":
      p.speed = "juice";
      p.speedTime = 720;
      break;
    case "RADAR":
      p.radar = true;
      break;
    case "1-UP":
      s.lives++;
      break;
    case "CINNABOMB":
      p.bomb = 360;
      break;
  }
  award(s, 50);
  banner(s, name);
  s.pose = 40;
  emit(s, "power");
}
function timers(s) {
  for (const k of ["inv", "freeze", "cool"]) if (s.p[k] > 0) s.p[k]--;
  const p = s.p.power;
  for (const k of ["weaponTime", "speedTime", "bomb"])
    if (p[k] > 0 && --p[k] === 0) {
      if (k === "weaponTime") delete p.weapon;
      if (k === "speedTime") delete p.speed;
    }
  if (s.pose > 0) s.pose--;
  if (s.banner && --s.banner.frames <= 0) s.banner = null;
  for (const a of [s.popups, s.bubbles]) for (const item of a) item.life--;
  s.popups = s.popups.filter((x) => x.life > 0);
  s.bubbles = s.bubbles.filter((x) => x.life > 0);
  if (s.shake > 0) s.shake--;
  for (const f of [...s.fountains, ...s.kiosks]) if (f.cool > 0) f.cool--;
}
export function hit(s, cause = "bullet", unavoidable = false) {
  if (s.scene !== "mall" && s.scene !== "store") return;
  if (s.p.inv > 0) return;
  if (!unavoidable && (s.p.power.bomb || s.p.hidden)) return;
  if (!unavoidable && s.p.power.armor) {
    delete s.p.power.armor;
    s.p.inv = 90;
    banner(s, UI.armorSaved);
    emit(s, "ping");
    return;
  }
  s.lives--;
  s.deathLocation = {
    scene: s.scene,
    storeId: s.storeId,
    x: s.p.x,
    y: s.p.y,
    floor: s.p.floor,
    facing: s.p.facing,
  };
  s.deathCause = cause;
  s.deathScene = s.scene;
  s.p.power = { radar: s.p.power.radar };
  s.p.freeze = 0;
  s.p.hidden = 0;
  s.spies = [];
  s.bullets = [];
  s.search = null;
  scene(s, "death");
  emit(s, "death");
}
export function respawn(s) {
  s.spies = [];
  s.bullets = [];
  s.p = {
    ...s.p,
    x: s.safe.x,
    y: FLOOR_Y[s.safe.floor],
    floor: s.safe.floor,
    vy: 0,
    jump: 0,
    ride: null,
    roof: null,
    inv: 120,
    freeze: 0,
    hidden: 0,
    slide: 0,
  };
  s.room = null;
  s.transition = null;
  scene(s, "mall");
  banner(s, UI.back, 90);
}
export function callElevator(s, e, floor) {
  if (floor < e.min || floor > e.max) return false;
  if (s.p.ride === e.id) return false;
  e.target = FLOOR_Y[floor];
  e.dir = Math.sign(e.target - e.y);
  e.called = true;
  e.callFloor = floor;
  if (!e.dir) {
    e.target = null;
    e.called = false;
    e.callFloor = null;
    e.wait = 120;
  }
  emit(s, "call");
  return true;
}
function floorAt(y) {
  return FLOOR_Y.findIndex((f) => Math.abs(f - y) < 0.01);
}
export function updateElevators(s, held = {}) {
  for (const e of s.elevators) {
    const p = s.p;
    const rider = p.ride === e.id;
    const floor = floorAt(e.y);
    let move = 0;
    if (!e.auto && rider) {
      move = held.up ? -1 : held.down ? 1 : 0;
      if (move && floor >= 0) {
        const next = clamp(floor + move, e.min, e.max);
        if (next !== floor) {
          e.target = FLOOR_Y[next];
          e.dir = move;
        }
      }
    }
    if (
      e.auto &&
      floor >= 0 &&
      !rider &&
      !(Math.abs(p.x - e.x) < 16 && p.floor === floor && s.scene === "mall") &&
      e.target === null
    ) {
      if (--e.wait <= 0) {
        const dest = pick(
          s,
          FLOOR_Y.slice(e.min, e.max + 1).filter((y) => y !== e.y),
        );
        e.target = dest;
        e.dir = Math.sign(dest - e.y);
      }
    }
    if (e.target !== null) {
      const old = e.y;
      e.y += Math.sign(e.target - e.y);
      if (Math.abs(e.target - e.y) < 1) e.y = e.target;
      // A called car is safe at its pickup; an unsolicited descending platform is not.
      if (
        s.scene === "mall" &&
        p.ride !== e.id &&
        p.roof !== e.id &&
        Math.abs(p.x - e.x) < 13 &&
        e.y > old &&
        old < p.y &&
        e.y >= p.y
      ) {
        if (e.called && e.callFloor === p.floor) {
          p.ride = e.id;
          p.y = e.y;
          p.vy = 0;
          p.jump = 0;
        } else hit(s, "elevator", true);
      }
      for (const spy of s.spies)
        if (
          !spy.dead &&
          Math.abs(spy.x - e.x) < 14 &&
          e.y > old &&
          old < spy.y &&
          e.y >= spy.y
        )
          killSpy(s, spy, 300);
      if (e.y === e.target) {
        const wasCalled = e.called,
          callFloor = e.callFloor;
        e.target = null;
        e.dir = 0;
        e.wait = 120;
        e.stops++;
        if (s.scene === "mall" && Math.abs(p.x - e.x) < 180) emit(s, "ding");
        if (rider) {
          p.floor = floorAt(e.y);
          s.safe = { x: e.x + 26, floor: p.floor };
          banner(s, ANNOUNCE[p.floor], 110);
        }
        if (
          wasCalled &&
          s.scene === "mall" &&
          p.floor === callFloor &&
          Math.abs(p.x - e.x) < 27
        ) {
          p.ride = e.id;
          p.x = e.x;
          p.y = e.y;
          p.vy = 0;
          p.roof = null;
        }
        e.called = false;
        e.callFloor = null;
        if (
          s.scene === "mall" &&
          !rider &&
          !wasCalled &&
          Math.abs(p.x - e.x) > 48 &&
          Math.abs(p.x - e.x) < 160 &&
          random(s) < 0.2 &&
          s.spies.length < difficulty(s.loop, s.blackFriday, s.alarm).cap
        ) {
          const spy = spawnSpy(s, e.x, floorAt(e.y));
          s.bubbles.push({
            x: spy.x,
            y: spy.y - 30,
            text: pick(s, ELEVATOR_LINES),
            life: 120,
          });
        }
      }
    }
    if (rider) {
      p.x = e.x;
      p.y = e.y;
      p.floor = clamp(Math.round((e.y - 64) / 48), e.min, e.max);
      p.duck = false;
    }
    if (p.roof === e.id) {
      p.y = e.y - 25;
      p.floor = clamp(Math.round((p.y - 64) / 48), e.min, e.max);
      if (e.y <= FLOOR_Y[e.min] + 24) hit(s, "roof crush", true);
    }
  }
}
export function startClear(s) {
  if (s.exitTriggered) return false;
  if (s.packages < 6) {
    banner(s, `${TEXT.missing} ${6 - s.packages}`);
    emit(s, "buzzer");
    return false;
  }
  s.exitTriggered = true;
  s.clearBonus = {
    packages: 3000,
    time: Math.max(0, 300 - Math.floor(s.elapsed / 60)) * 10,
    clear: 1000,
  };
  award(s, 1000 + s.clearBonus.time);
  s.headline = pick(s, HEADLINES);
  s.post = pick(s, COMPLETE);
  scene(s, "clear");
  emit(s, "clear");
  return true;
}
function any(pressed) {
  return Object.values(pressed).some(Boolean);
}
export function step(s, input = { held: {}, pressed: {} }) {
  const held = input.held || {},
    pressed = input.pressed || {};
  s.events = [];
  s.frame++;
  if (pressed.crt) emit(s, "crt");
  if (pressed.mute) emit(s, "mute");
  if (s.scene === "title") {
    s.sceneFrame++;
    for (const key of input.order || ["up", "down", "left", "right", "b", "a"])
      if (pressed[key]) {
        const result = konami(s.code, key);
        s.code = result.history;
        if (result.complete) {
          s.blackFriday = true;
          emit(s, "power");
        }
      }
    if (pressed.start) newRun(s);
    return s;
  }
  if (s.scene === "splash") {
    if (s.sceneFrame === 60) emit(s, "jingle");
    if (++s.sceneFrame >= 180 || any(pressed)) scene(s, "title");
    return s;
  }
  if (s.scene === "arrival") {
    s.sceneFrame++;
    const t = s.sceneFrame;
    s.p.x = 20 + Math.min(100, t);
    s.p.y = t < 100 ? 12 + t * 0.32 : Math.min(64, 44 + (t - 100) * 2);
    if (t === 110) emit(s, "thud");
    if (t >= 135) {
      scene(s, "selfie");
      emit(s, "camera");
    }
    return s;
  }
  if (s.scene === "selfie") {
    if (++s.sceneFrame >= 150 || any(pressed)) {
      scene(s, "mall");
      s.p.y = 64;
      banner(s, TEXT.guide, 180);
    }
    return s;
  }
  if (s.scene === "death") {
    if (++s.sceneFrame >= 75) {
      if (s.lives > 0) respawn(s);
      else if (s.continues > 0) scene(s, "continue");
      else {
        scene(s, "gameover");
        emit(s, "pa");
      }
    }
    return s;
  }
  if (s.scene === "continue") {
    if (s.sceneFrame % 60 === 0) emit(s, "beep");
    if (pressed.start) {
      s.continues--;
      s.lives = 3;
      s.p.power = {};
      const where = s.deathLocation;
      respawn(s);
      if (where?.scene === "store") {
        s.storeId = where.storeId;
        s.room = s.stores.find((st) => st.id === where.storeId).room;
        Object.assign(s.p, {
          x: where.x,
          y: where.y,
          floor: where.floor,
          facing: where.facing,
        });
        s.guards = [];
        s.dialog = 0;
        s.roomGrace = 120;
        s.pose = 0;
        scene(s, "store");
      }
    } else if (++s.sceneFrame >= 600) {
      scene(s, "gameover");
      emit(s, "pa");
    }
    return s;
  }
  if (s.scene === "gameover") {
    s.sceneFrame++;
    if ((s.sceneFrame > 180 && pressed.start) || s.sceneFrame > 600) {
      scene(s, "title");
      s.blackFriday = false;
      s.code = [];
    }
    return s;
  }
  if (["clear", "paper", "post"].includes(s.scene)) {
    s.sceneFrame++;
    if (pressed.start || s.sceneFrame > (s.scene === "clear" ? 300 : 360)) {
      if (s.scene === "clear") scene(s, "paper");
      else if (s.scene === "paper") scene(s, "post");
      else {
        s.loop++;
        setupLevel(s);
        scene(s, "arrival");
        s.post = pick(s, ARRIVAL);
        emit(s, "zip");
      }
    }
    return s;
  }
  if (pressed.select) {
    s.overlay = s.overlay === "map" ? null : "map";
    emit(s, "pause");
    return s;
  }
  if (pressed.start) {
    s.overlay = s.overlay === "pause" ? null : "pause";
    emit(s, "pause");
    return s;
  }
  if (s.overlay) return s;
  timers(s);
  s.elapsed++;
  s.sceneFrame++;
  s.paClock--;
  if (s.paClock <= 0) {
    let n = Math.floor(random(s) * (PA.length - 1));
    if (n >= s.lastPA) n++;
    s.lastPA = n;
    s.paClock = 3600;
    banner(s, PA[n], 240);
    emit(s, "pa");
  }
  if (!s.alarm && s.elapsed >= difficulty(s.loop).alarm) {
    s.alarm = true;
    banner(s, TEXT.alarm);
    emit(s, "alarm");
  }
  if (s.transition) {
    if (--s.transition.frames === 12) {
      if (s.transition.to === "store") enterStoreNow(s, s.transition.id);
      else leaveStoreNow(s);
    }
    if (s.transition && s.transition.frames <= 0) s.transition = null;
    return s;
  }
  if (s.scene === "store") updateRoom(s, held, pressed);
  else if (s.scene === "mall") updateMall(s, held, pressed);
  return s;
}
export function spawnSpy(s, x, floor) {
  const spy = {
    id: s.frame + ":" + s.spies.length,
    x,
    y: FLOOR_Y[floor],
    floor,
    dir: -1,
    age: 0,
    aim: 0,
    shot: 120,
    high: false,
    duck: 0,
    lastVolley: -1,
    dead: 0,
    wait: 0,
  };
  s.spies.push(spy);
  return spy;
}
export function killSpy(s, spy, points = 100) {
  if (spy.dead) return;
  spy.dead = 24;
  award(s, points, spy.x, spy.y);
  emit(s, points === 300 ? "crush" : "enemyDeath");
  if (points === 300) s.shake = 12;
  if (random(s) < 0.35)
    s.bubbles.push({
      x: spy.x,
      y: spy.y - 28,
      text: pick(s, LAST_WORDS),
      life: 100,
    });
  if (random(s) < 0.05)
    s.drops.push({
      x: spy.x,
      y: spy.y,
      floor: spy.floor,
      power:
        random(s) < 0.5
          ? pick(s, POWERS.slice(6))
          : pick(s, POWERS.slice(0, 6)),
      life: 600,
    });
}
function shoot(s, room = false) {
  const p = s.p,
    max = p.power.weapon === "rapid" ? 4 : 2;
  if (p.cool || s.bullets.filter((b) => b.owner === "p").length >= max) return;
  p.cool = p.power.weapon === "rapid" ? 7 : 18;
  s.volley = (s.volley || 0) + 1;
  let dx = room
      ? p.facing === "left"
        ? -1
        : p.facing === "right"
          ? 1
          : 0
      : p.dir,
    dy = room ? (p.facing === "up" ? -1 : p.facing === "down" ? 1 : 0) : 0;
  const x = room ? p.x + 8 : p.x + dx * 9,
    y = room ? p.y + 8 : p.y - (p.duck ? 7 : 16);
  s.bullets.push({
    x,
    y,
    vx: dx * 4,
    vy: dy * 4,
    owner: "p",
    life: 90,
    volley: s.volley,
  });
  if (p.power.weapon === "spread")
    for (const side of [-1, 1])
      s.bullets.push({
        x,
        y,
        vx: dx * 4 + dy * side,
        vy: dy * 4 + dx * side,
        owner: "p",
        life: 90,
        volley: s.volley,
      });
  s.search = null;
  emit(s, "shot");
  if (!room) {
    const c = s.cop;
    if (
      c.floor === p.floor &&
      Math.abs(c.x - p.x) < 128 &&
      Math.sign(p.x - c.x) === c.dir
    ) {
      c.chase = 600;
      banner(s, TEXT.cop);
      emit(s, "whistle");
    }
  }
}
function near(s, x, floor, r = 16) {
  return s.p.floor === floor && Math.abs(s.p.x - x) < r;
}
function updateMall(s, held, pressed) {
  const p = s.p;
  updateElevators(s, held);
  if (s.scene !== "mall") return;
  updateNPCs(s);
  updateLamps(s);
  if (s.scene !== "mall") return;
  if (p.hidden) {
    p.hidden--;
    if (
      !p.hidden ||
      pressed.up ||
      pressed.down ||
      pressed.left ||
      pressed.right ||
      pressed.b
    ) {
      p.hidden = 0;
      p.inv = 60;
      if (!s.photo) {
        s.photo = true;
        s.inventory.push(TEXT.photoStrip);
        s.photoShow = 150;
        banner(s, TEXT.photo);
      }
    }
    updateSpies(s);
    updateBullets(s, false);
    return;
  }
  if (s.photoShow > 0) s.photoShow--;
  if (s.escalating) {
    const e = s.escalating;
    e.t++;
    p.x = e.x + e.dir * e.t * 0.5;
    p.y = e.from + e.dir * e.t;
    if (e.t >= 48) {
      p.floor = e.floor;
      p.y = FLOOR_Y[p.floor];
      s.safe = { x: p.x, floor: p.floor };
      s.escalating = null;
    }
    return;
  }
  if (!p.freeze) {
    if (p.ride) {
      const e = s.elevators.find((e) => e.id === p.ride);
      if (e.target === null && (held.left || held.right)) {
        p.dir = held.left ? -1 : 1;
        p.x = e.x + p.dir * 25;
        p.ride = null;
        p.floor = floorAt(e.y);
        p.y = e.y;
        s.safe = { x: p.x, floor: p.floor };
      }
    } else {
      let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      p.duck = !!held.down && !p.jump && !p.roof;
      const speed =
        p.power.speed === "sneakers"
          ? 1.7
          : p.power.speed === "juice"
            ? 1.5
            : 1;
      if (p.jump && p.kick) dx = p.airDir || p.dir;
      if (p.slide) dx = p.slide;
      if (dx) {
        p.dir = dx;
        p.x = clamp(p.x + dx * speed, 9, WIDTH - 9);
        if (p.roof) {
          const e = s.elevators.find((e) => e.id === p.roof);
          if (Math.abs(p.x - e.x) > 20) {
            p.roof = null;
            p.fallFrom = p.y;
            p.vy = 0.1;
          }
        }
      }
      if (pressed.b && !p.jump && p.vy === 0) {
        p.vy = p.power.speed === "sneakers" ? -4.5 : -3.7;
        p.jump = 1;
        p.fallFrom = p.y;
        p.kick = dx !== 0;
        p.airDir = dx;
        p.roof = null;
        emit(s, "jump");
      }
      if ((pressed.up || pressed.down) && !p.jump) {
        if (interactMall(s, pressed)) return;
      }
      const nearby = s.elevators.find(
        (e) => p.floor >= e.min && p.floor <= e.max && Math.abs(p.x - e.x) < 26,
      );
      if (nearby && !dx && !p.jump && nearby.y !== FLOOR_Y[p.floor]) {
        p.callWait = (p.callWait || 0) + 1;
        if (p.callWait === 30) callElevator(s, nearby, p.floor);
      } else p.callWait = 0;
      physics(s);
    }
    if (held.a || pressed.a) shoot(s);
  }
  if (s.scene !== "mall") return;
  updateSpies(s);
  updateBullets(s, false);
  updatePickups(s);
  if (s.scene !== "mall") return;
  if (
    p.y === FLOOR_Y[p.floor] &&
    !p.jump &&
    !p.ride &&
    !p.roof &&
    !s.elevators.some((e) => Math.abs(p.x - e.x) < 25) &&
    !p.freeze
  )
    s.safe = { x: p.x, floor: p.floor };
}
export function interactMall(s, pressed) {
  const p = s.p;
  if (near(s, 626, 5, 34) && pressed.up) {
    startClear(s);
    return true;
  }
  if (near(s, 410, 2, 14) && pressed.up) {
    p.hidden = 300;
    banner(s, TEXT.hidden);
    emit(s, "door");
    return true;
  }
  const kiosk = s.kiosks.find((k) => near(s, k.x, k.floor, 14));
  if (kiosk && pressed.up) {
    if (!kiosk.cool) {
      kiosk.cool = 1200;
      s.kioskShow = 240;
      const target = s.stores
        .filter((x) => x.role === "target" && !x.cleared)
        .sort(
          (a, b) =>
            Math.abs(a.floor - p.floor) * 768 +
            Math.abs(a.x - p.x) -
            (Math.abs(b.floor - p.floor) * 768 + Math.abs(b.x - p.x)),
        )[0];
      s.kioskTarget = target?.id;
      banner(s, target ? `${TEXT.kiosk} ${target.name}` : UI.allPackages, 180);
    }
    return true;
  }
  const store = s.stores.find(
    (st) =>
      st.role !== "closed" && !st.cleared && near(s, st.x + 40, st.floor, 12),
  );
  if (store && (pressed.up || pressed.down)) {
    enterStore(s, store.id);
    return true;
  }
  for (const e of ESCALATORS) {
    if (
      (p.floor === e.bottom && pressed.up && Math.abs(p.x - e.x) < 17) ||
      (p.floor === e.top && pressed.down && Math.abs(p.x - (e.x - 24)) < 17)
    ) {
      const dir = p.floor === e.bottom ? -1 : 1;
      s.escalating = { x: p.x, from: p.y, dir, t: 0, floor: p.floor + dir };
      return true;
    }
  }
  const e = s.elevators.find(
    (e) => p.floor >= e.min && p.floor <= e.max && Math.abs(p.x - e.x) < 29,
  );
  if (e) {
    if (e.y === FLOOR_Y[p.floor] && e.target === null) {
      p.ride = e.id;
      p.roof = null;
      p.x = e.x;
      p.y = e.y;
      p.vy = 0;
      banner(s, TEXT.hold, 100);
    } else callElevator(s, e, p.floor);
    return true;
  }
  return false;
}
export function physics(s) {
  const p = s.p;
  if (p.ride || p.roof) return;
  const f = p.floor,
    ground = FLOOR_Y[f];
  const e = s.elevators.find(
    (e) => f >= e.min && f <= e.max && Math.abs(p.x - e.x) < 13,
  );
  const pit = e && e.y > ground + 0.01 && !e.called;
  if (p.vy === 0 && !p.jump) {
    if (!pit) return;
    p.fallFrom = p.y;
    p.vy = 0.1;
    p.jump = 1;
    p.kick = false;
  }
  const old = p.y;
  p.vy += 0.34;
  p.y += p.vy;
  if (p.vy >= 0) {
    let landing = ground;
    if (pit) landing = e.y - 25;
    else if (old > ground + 1) landing = FLOOR_Y.find((y) => y >= old) ?? 304;
    if (p.y >= landing && old <= landing + 5) {
      const fall = landing - (p.fallFrom ?? ground);
      if (fall > 48) {
        hit(s, "fall", true);
        return;
      }
      p.y = landing;
      p.vy = 0;
      p.jump = 0;
      if (pit) {
        p.roof = e.id;
      } else {
        p.floor = floorAt(landing);
        if (p.floor < 0) p.floor = f;
      }
      if (!p.slide) p.kick = false;
      emit(s, "land");
    }
    if (p.y > 330) hit(s, "fall", true);
  }
}
function updateSpies(s) {
  const p = s.p,
    d = difficulty(s.loop, s.blackFriday, s.alarm);
  if (--s.spawnClock <= 0) {
    s.spawnClock = Math.round(d.spawn);
    const doors = s.stores.filter(
      (st) =>
        st.role !== "closed" &&
        !st.cleared &&
        Math.abs(st.floor - p.floor) <= 1 &&
        Math.abs(st.x + 40 - p.x) >= 64 &&
        Math.abs(st.x + 40 - p.x) <= 200,
    );
    if (s.spies.filter((x) => !x.dead).length < d.cap && doors.length) {
      const st = pick(s, doors);
      spawnSpy(s, st.x + 40, st.floor);
    }
  }
  for (const spy of s.spies) {
    if (spy.dead) {
      spy.dead--;
      if (!spy.dead) spy.remove = true;
      continue;
    }
    spy.age++;
    if (spy.duck > 0) spy.duck--;
    if (spy.stun > 0) {
      spy.stun--;
      continue;
    }
    if (s.scene !== "mall") continue;
    const oldX = spy.x;
    if (
      s.wet &&
      spy.floor === s.wet.floor &&
      spy.x >= s.wet.x &&
      spy.x <= s.wet.x + s.wet.w
    )
      spy.slide ||= spy.dir;
    else spy.slide = 0;
    const sees =
      !p.hidden && spy.floor === p.floor && Math.abs(spy.x - p.x) < 160;
    if (sees) {
      spy.dir = Math.sign(p.x - spy.x) || spy.dir;
      if (spy.shot > 0) spy.shot--;
      if (spy.shot <= 30 && spy.age >= 90) {
        spy.aim++;
        if (spy.aim === 1) spy.high = random(s) < 0.5;
      }
      if (spy.shot <= 0 && spy.age >= 120) {
        s.bullets.push({
          x: spy.x + spy.dir * 10,
          y: spy.y - (spy.high ? 16 : 6),
          vx: spy.dir * 2,
          vy: 0,
          owner: "e",
          life: 110,
        });
        spy.shot = d.shot;
        spy.aim = 0;
        emit(s, "enemyShot");
      }
      if (Math.abs(spy.x - p.x) > 40 && !spy.aim && !spy.duck) {
        const x = spy.x + spy.dir * d.speed;
        if (!isPit(s, x, spy.floor)) spy.x = x;
      }
    } else if (!spy.aim) {
      if (spy.age % 240 === 120) {
        const shaft = pick(
          s,
          s.elevators.filter((e) => spy.floor >= e.min && spy.floor <= e.max),
        );
        if (shaft && shaft.y < FLOOR_Y[spy.floor]) spy.shaft = shaft.x;
      }
      if (spy.shaft !== undefined) {
        spy.dir = Math.sign(spy.shaft - spy.x) || spy.dir;
        if (Math.abs(spy.x - spy.shaft) < 2) {
          spy.wait = 90;
          delete spy.shaft;
        }
      }
      if (spy.wait > 0) {
        spy.wait--;
        continue;
      }
      if (spy.age % 120 === 0 && spy.shaft === undefined)
        spy.dir = random(s) < 0.5 ? -1 : 1;
      const x = spy.x + spy.dir * d.speed * 0.6;
      if (!isPit(s, x, spy.floor) && x > 8 && x < 760) spy.x = x;
      else spy.dir *= -1;
    }
    if (spy.slide) {
      spy.x = oldX + spy.slide;
      spy.dir = spy.slide;
    }
    for (const b of s.bullets)
      if (
        b.owner === "p" &&
        Math.abs(b.y - (spy.y - 16)) < 5 &&
        Math.abs(b.x - spy.x) < 56 &&
        Math.sign(spy.x - b.x) === Math.sign(b.vx) &&
        spy.lastVolley !== b.volley
      ) {
        spy.lastVolley = b.volley;
        if (random(s) < 0.1) spy.duck = 24;
      }
    if (
      spy.floor === p.floor &&
      Math.abs(spy.x - p.x) < 11 &&
      Math.abs(spy.y - p.y) < 23
    ) {
      if ((p.jump && p.kick) || (p.slide && p.kick) || p.power.bomb)
        killSpy(s, spy, p.slide ? 300 : 100);
      else hit(s, "spy");
    }
  }
  s.spies = s.spies.filter((x) => !x.remove);
}
function isPit(s, x, floor) {
  return s.elevators.some(
    (e) =>
      floor >= e.min &&
      floor <= e.max &&
      Math.abs(x - e.x) < 15 &&
      e.y > FLOOR_Y[floor],
  );
}
export function updateNPCs(s) {
  const p = s.p,
    j = s.janitor;
  j.x += j.dir * 0.4;
  if (j.x < 480 || j.x > 560) j.dir *= -1;
  if (--j.timer <= 0) {
    j.timer = 780;
    s.wet = { x: clamp(j.x - 24, 472, 512), floor: 4, w: 48, life: 600 };
    emit(s, "mop");
  }
  if (s.wet && --s.wet.life <= 0) s.wet = null;
  if (
    s.wet &&
    p.floor === 4 &&
    p.x >= s.wet.x &&
    p.x <= s.wet.x + s.wet.w &&
    p.y === FLOOR_Y[4]
  ) {
    if (!p.slide) {
      p.slide = p.dir;
      emit(s, "slide");
    }
  } else p.slide = 0;
  for (const [i, w] of s.walkers.entries()) {
    w.x += w.dir * 0.65;
    const lo = i === 0 ? 316 : 600,
      hi = i === 0 ? 408 : 673;
    if (w.x < lo || w.x > hi) w.dir *= -1;
    if (near(s, w.x, 3, 10) && !p.jump) p.x = clamp(p.x + w.dir * 0.8, 8, 760);
  }
  const c = s.cop;
  if (c.cool > 0) c.cool--;
  if (c.chase > 0) {
    c.chase--;
    if (c.floor === p.floor) c.dir = Math.sign(p.x - c.x) || c.dir;
    c.x += c.dir * 1.3;
    if (near(s, c.x, c.floor, 12) && !c.cool && !p.hidden) {
      p.freeze = 180;
      c.chase = 0;
      c.cool = 240;
      award(s, -500);
      banner(s, TEXT.detained);
      emit(s, "whistle");
    }
  } else {
    c.x += c.dir * 0.35;
    if (c.x < 320 || c.x > 424) c.dir *= -1;
  }
  if (s.kioskShow > 0) s.kioskShow--;
}
function updateLamps(s) {
  for (const l of s.lamps) {
    if (l.dark > 0) l.dark--;
    if (l.mode === "fall") {
      l.vy += 0.23;
      l.y += l.vy;
      if (l.y >= FLOOR_Y[l.floor] - 5) {
        l.y = FLOOR_Y[l.floor] - 5;
        s.shake = 10;
        emit(s, "glass");
        l.dark = 120;
        l.mode = l.kind === "disco" ? "roll" : "broken";
        if (l.mode === "broken") lampHit(s, l);
      }
    } else if (l.mode === "roll") {
      l.x += l.vx * 1.5;
      if (l.x < 4 || l.x > 764 || isPit(s, l.x, l.floor)) {
        l.mode = "broken";
        emit(s, "glass");
      }
    }
    if (l.mode === "fall" || l.mode === "roll") lampHit(s, l);
  }
}
function lampHit(s, l) {
  for (const spy of s.spies)
    if (
      !spy.dead &&
      spy.floor === l.floor &&
      Math.abs(spy.x - l.x) < 13 &&
      Math.abs(spy.y - 12 - l.y) < 20
    )
      killSpy(s, spy, 300);
  if (
    s.p.floor === l.floor &&
    Math.abs(s.p.x - l.x) < 11 &&
    Math.abs(s.p.y - 12 - l.y) < 18
  )
    hit(s, l.kind, true);
}
export function fountain(s, f, dir) {
  if (f.cool) return;
  f.cool = 900;
  const count = 3 + Math.floor(random(s) * 3),
    gold = random(s) < 0.05;
  for (let i = 0; i < count; i++)
    s.coins.push({
      x: f.x,
      y: FLOOR_Y[f.floor] - 12,
      vx: (i - (count - 1) / 2) * 0.65 + dir * 0.2,
      vy: -3 - i * 0.15,
      floor: f.floor,
      gold: gold && i === 0,
      life: 600,
    });
  emit(s, "coin");
}
function updatePickups(s) {
  const p = s.p;
  for (const c of s.coins) {
    c.x += c.vx;
    c.vy += 0.16;
    c.y += c.vy;
    const ground = FLOOR_Y[c.floor] - 4;
    if (c.y > ground) {
      c.y = ground;
      c.vy = -Math.abs(c.vy) * 0.55;
    }
    c.life--;
    if (
      p.floor === c.floor &&
      Math.abs(p.x - c.x) < 12 &&
      Math.abs(p.y - 8 - c.y) < 20
    ) {
      c.life = 0;
      award(s, 50, c.x, c.y);
      if (c.gold) s.lives++;
      emit(s, "coin");
    }
  }
  s.coins = s.coins.filter((c) => c.life > 0);
  for (const d of s.drops) {
    d.life--;
    if (near(s, d.x, d.floor, 13)) {
      power(s, d.power);
      d.life = 0;
    }
  }
  s.drops = s.drops.filter((d) => d.life > 0);
}
function playerBox(s, room) {
  const p = s.p;
  return room
    ? { x: p.x + 2, y: p.y + 3, w: 12, h: 12 }
    : { x: p.x - 6, y: p.y - (p.duck ? 11 : 23), w: 12, h: p.duck ? 11 : 23 };
}
function updateBullets(s, room) {
  const p = s.p;
  for (const b of s.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (
      b.x < 0 ||
      b.x > (room ? s.room.width : 768) ||
      b.y < 0 ||
      b.y > (room ? s.room.height : 330)
    ) {
      b.life = 0;
      continue;
    }
    const box = { x: b.x - 2, y: b.y - 1, w: 4, h: 2 };
    if (room) {
      const fixture = s.room.fixtures.find((f) => overlap(box, f));
      if (fixture) {
        if (
          b.owner === "p" &&
          fixture.kind === "toy" &&
          !fixture.toysReleased
        ) {
          fixture.toysReleased = true;
          releaseToys(s, fixture);
        }
        b.life = 0;
        continue;
      }
    } else {
      const walker = s.walkers.find(
        (w) =>
          Math.abs(b.x - w.x) < 8 && b.y > FLOOR_Y[3] - 23 && b.y < FLOOR_Y[3],
      );
      if (walker) {
        b.life = 0;
        if (b.owner === "p") {
          award(s, -200, walker.x, 208);
          s.bubbles.push({ x: walker.x, y: 180, text: TEXT.hey, life: 90 });
        }
        continue;
      }
      if (
        Math.abs(b.x - s.cop.x) < 9 &&
        b.y > FLOOR_Y[s.cop.floor] - 24 &&
        b.y < FLOOR_Y[s.cop.floor]
      ) {
        b.life = 0;
        emit(s, "ping");
        continue;
      }
      if (b.owner === "p") {
        const l = s.lamps.find(
          (l) =>
            l.mode === "hang" &&
            Math.abs(b.x - l.x) < 8 &&
            b.y >= l.y - 9 &&
            b.y <= l.y + 12,
        );
        if (l) {
          l.mode = "fall";
          l.vx = Math.sign(b.vx);
          l.vy = 0;
          b.life = 0;
          emit(s, "lamp");
          continue;
        }
        const f = s.fountains.find(
          (f) =>
            Math.abs(b.x - f.x) < 18 &&
            b.y > FLOOR_Y[f.floor] - 21 &&
            b.y < FLOOR_Y[f.floor],
        );
        if (f) {
          fountain(s, f, Math.sign(b.vx));
          b.life = 0;
          continue;
        }
      }
    }
    if (b.owner === "p") {
      const enemies = room ? s.guards : s.spies;
      for (const e of enemies) {
        if (e.dead) continue;
        const eb = room
          ? { x: e.x + 1, y: e.y + 1, w: 14, h: 14 }
          : {
              x: e.x - 6,
              y: e.y - (e.duck ? 11 : 23),
              w: 12,
              h: e.duck ? 11 : 23,
            };
        if (overlap(box, eb)) {
          b.life = 0;
          if (room) {
            e.hp--;
            if (e.hp <= 0) {
              e.dead = 24;
              award(s, 100, e.x, e.y);
              emit(s, "enemyDeath");
            } else {
              e.stun = 20;
              emit(s, "ping");
            }
          } else killSpy(s, e);
          break;
        }
      }
    } else if (overlap(box, playerBox(s, room))) {
      b.life = 0;
      hit(s, "bullet");
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0);
}
export function enterStore(s, id) {
  const st = s.stores.find((st) => st.id === id);
  if (!st || st.role === "closed" || st.cleared) return false;
  s.transition = { to: "store", id, frames: 24 };
  s.returnDoor = { x: st.x + 40, floor: st.floor };
  emit(s, "door");
  return true;
}
export function enterStoreNow(s, id) {
  const st = s.stores.find((st) => st.id === id);
  s.room = st.room;
  s.storeId = id;
  s.p.x = 120;
  s.p.y = 144;
  s.p.facing = "up";
  s.p.vy = 0;
  s.p.jump = 0;
  s.p.ride = null;
  s.p.roof = null;
  s.p.duck = false;
  s.p.inv = Math.max(s.p.inv, 120);
  s.bullets = [];
  s.spies = [];
  s.toys = [];
  s.search = null;
  s.roomGrace = 120;
  const first = !s.visited.includes(id);
  s.dialog = first && VISITS[st.theme] ? 120 : 0;
  if (first) s.visited.push(id);
  s.guards = [
    {
      x: 32,
      y: 112,
      dir: 1,
      facing: "right",
      hp: 1,
      kind: "spy",
      shot: 120,
      age: 0,
      stun: 0,
    },
    {
      x: 208,
      y: 80,
      dir: -1,
      facing: "left",
      hp: ["electronics", "gadgets"].includes(st.theme) ? 3 : 1,
      kind: ["electronics", "gadgets"].includes(st.theme) ? "bot" : "spy",
      shot: 160,
      age: 0,
      stun: 0,
    },
  ];
  if (st.theme === "games" && !s.gameGift) {
    s.cave = { frame: 0, item: pick(s, ITEMS), taken: false };
    s.guards = [];
  } else s.cave = null;
  scene(s, "store");
  banner(s, st.name, 120);
}
function leaveStoreNow(s) {
  const ret = s.returnDoor;
  s.p.x = ret.x;
  s.p.floor = ret.floor;
  s.p.y = FLOOR_Y[ret.floor];
  s.safe = { x: ret.x, floor: ret.floor };
  s.room = null;
  s.search = null;
  s.bullets = [];
  s.spies = [];
  s.sideB = false;
  s.p.inv = Math.max(90, s.p.inv);
  scene(s, "mall");
}
export function roomSolid(room, x, y) {
  const b = { x: x + 2, y: y + 3, w: 12, h: 12 };
  if (
    b.x < 16 ||
    b.x + b.w > room.width - 16 ||
    b.y < 16 ||
    b.y + b.h > room.height - 8
  )
    return true;
  return room.fixtures.some((f) => overlap(b, f));
}
export function moveRoom(s, dx, dy) {
  const p = s.p,
    r = s.room;
  const x = p.x + dx,
    y = p.y + dy;
  if (!roomSolid(r, x, y)) {
    p.x = x;
    p.y = y;
    return true;
  } // Zelda corner assistance: try a few subpixels perpendicular to travel.
  for (const off of [1, -1, 2, -2, 3, -3]) {
    const xx = x + (dy ? off : 0),
      yy = y + (dx ? off : 0);
    if (!roomSolid(r, xx, yy)) {
      p.x = xx;
      p.y = yy;
      return true;
    }
  }
  return false;
}
export function touchingFixture(s) {
  if (!s.room) return null;
  const p = s.p,
    b = { x: p.x - 3, y: p.y - 3, w: 22, h: 23 };
  return (
    s.room.fixtures
      .filter((f) => !f.opened && overlap(b, f))
      .sort(
        (a, b) =>
          Math.hypot(a.x + a.w / 2 - p.x - 8, a.y + a.h / 2 - p.y - 8) -
          Math.hypot(b.x + b.w / 2 - p.x - 8, b.y + b.h / 2 - p.y - 8),
      )[0] || null
  );
}
function faceFixture(s, f) {
  const dx = f.x + f.w / 2 - (s.p.x + 8),
    dy = f.y + f.h / 2 - (s.p.y + 8);
  s.p.facing =
    Math.abs(dx) > Math.abs(dy)
      ? dx < 0
        ? "left"
        : "right"
      : dy < 0
        ? "up"
        : "down";
}
export function startSearch(s) {
  const f = touchingFixture(s);
  if (!f) return false;
  faceFixture(s, f);
  s.search = {
    id: f.id,
    progress: 0,
    total: s.p.power.speed === "sneakers" ? 28 : 45,
    direction: s.p.facing,
  };
  emit(s, "search");
  return true;
}
export function finishSearch(s, f) {
  s.search = null;
  if (f.kind === "fitting" && !f.pranked && random(s) < 0.25) {
    f.pranked = true;
    const x = clamp(f.x + f.w + 4, 16, 224),
      y = f.y;
    s.guards.push({
      x,
      y,
      kind: "spy",
      hp: 1,
      dir: 1,
      shot: 120,
      age: 0,
      stun: 40,
    });
    s.bullets.push({ x, y, vx: 0, vy: 2, owner: "e", life: 70, shoe: true });
    banner(s, TEXT.occupied);
    emit(s, "shriek");
    return;
  }
  f.opened = true;
  s.pose = 30;
  if (f.content === "package") {
    s.packages++;
    const st = s.stores.find((st) => st.id === s.storeId);
    st.cleared = true;
    award(s, 500);
    banner(s, `${TEXT.package} ${s.packages}/6`, 150);
    s.pose = 75;
    emit(s, "package");
  } else if (f.content === "power") power(s, f.power);
  else if (f.content === "trap") {
    s.p.freeze = 60;
    banner(s, TEXT.trap);
    s.smoke = { x: f.x, y: f.y, life: 60 };
    emit(s, "smoke");
  } else {
    banner(s, TEXT.nothing);
    s.smoke = { x: f.x, y: f.y, life: 25 };
    emit(s, "smoke");
  }
}
export function releaseToys(s, f) {
  for (let i = 0; i < 3; i++)
    s.toys.push({
      x: f.x + i * 8,
      y: f.y + 18,
      dx: i === 0 ? -1 : i === 1 ? 0 : 1,
      dy: i === 1 ? 1 : 0,
      life: 480,
    });
  emit(s, "toy");
}
function updateToys(s) {
  for (const t of s.toys) {
    t.life--;
    if (roomSolid(s.room, t.x + t.dx, t.y + t.dy)) {
      const dx = t.dx;
      t.dx = -t.dy;
      t.dy = dx;
      if (roomSolid(s.room, t.x + t.dx, t.y + t.dy)) {
        t.dx *= -1;
        t.dy *= -1;
      }
    } else {
      t.x += t.dx;
      t.y += t.dy;
    }
    for (const g of s.guards)
      if (!g.dead && Math.abs(g.x - t.x) < 12 && Math.abs(g.y - t.y) < 12)
        g.stun = 120;
    for (const f of s.room.fixtures)
      if (
        !f.opened &&
        f.content === "trap" &&
        Math.abs(f.x - t.x) < 26 &&
        Math.abs(f.y - t.y) < 26
      ) {
        f.opened = true;
        emit(s, "smoke");
        s.smoke = { x: f.x, y: f.y, life: 60 };
        for (const g of s.guards)
          if (Math.hypot(g.x - f.x, g.y - f.y) < 64) g.stun = 180;
      }
  }
  s.toys = s.toys.filter((t) => t.life > 0);
}
function updateRoom(s, held, pressed) {
  const p = s.p;
  if (s.smoke && --s.smoke.life <= 0) s.smoke = null;
  if (s.cave && !s.cave.taken && s.cave.frame < 180) {
    s.cave.frame++;
    if (s.cave.frame % 3 === 0) emit(s, "text");
    return;
  }
  if (s.dialog > 0) {
    s.dialog--;
    if (s.dialog === 119 || s.dialog === 59) {
      const st = s.stores.find((x) => x.id === s.storeId),
        lines = VISITS[st.theme];
      const i = s.dialog === 119 ? 0 : 1;
      if (lines?.[i]) {
        s.bubbles = [
          {
            x: s.guards[Math.min(i, s.guards.length - 1)].x,
            y: s.guards[Math.min(i, s.guards.length - 1)].y - 12,
            text: lines[i],
            life: 60,
          },
        ];
        emit(s, "text");
      }
    }
    return;
  }
  if (s.roomGrace > 0) s.roomGrace--;
  if (s.search) {
    const fresh = ["up", "down", "left", "right"].find((k) => pressed[k]);
    if (pressed.a || (fresh && fresh !== s.search.direction)) s.search = null;
    else {
      const f = s.room.fixtures.find((f) => f.id === s.search.id);
      if (++s.search.progress >= s.search.total) finishSearch(s, f);
      else if (s.search.progress % 10 === 0) emit(s, "search");
      updateGuards(s);
      updateBullets(s, true);
      return;
    }
  }
  if (!p.freeze && !s.pose) {
    const dy = held.up ? -1 : held.down ? 1 : 0,
      dx = dy ? 0 : held.left ? -1 : held.right ? 1 : 0,
      speed =
        p.power.speed === "sneakers"
          ? 1.7
          : p.power.speed === "juice"
            ? 1.5
            : 1;
    if (dx || dy) {
      p.facing = dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
      moveRoom(s, dx * speed, dy * speed);
    }
    if (pressed.b) startSearch(s);
    if (held.a || pressed.a) shoot(s, true);
    if (p.y >= 151 && p.x >= 105 && p.x <= 137 && held.down) {
      s.transition = { to: "mall", frames: 24 };
      emit(s, "door");
      return;
    }
    if (s.cave && !s.cave.taken && Math.hypot(p.x - 120, p.y - 68) < 17) {
      s.cave.taken = true;
      s.gameGift = true;
      s.inventory.push(s.cave.item);
      award(s, 1);
      banner(s, `${TEXT.take} ${s.cave.item}`, 180);
      s.pose = 90;
      emit(s, "package");
    }
  }
  const booth = s.room.decor.find((x) => x.kind === "booth");
  const onBooth = !!booth && overlap({ x: p.x, y: p.y, w: 16, h: 16 }, booth);
  if (onBooth && !s.sideB) banner(s, TEXT.sideB);
  s.sideB = onBooth;
  updateToys(s);
  updateGuards(s);
  updateBullets(s, true);
}
function clearLine(room, a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n + 8,
      y = a.y + ((b.y - a.y) * i) / n + 8;
    if (
      room.fixtures.some(
        (f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h,
      )
    )
      return false;
  }
  return true;
}
function updateGuards(s) {
  const p = s.p;
  for (const g of s.guards) {
    if (g.dead) {
      g.dead--;
      if (!g.dead) g.remove = true;
      continue;
    }
    if (g.stun > 0) {
      g.stun--;
      continue;
    }
    g.age++;
    if (s.roomGrace > 0) continue;
    const dx = p.x - g.x,
      dy = p.y - g.y;
    const aligned = Math.abs(dx) < 7 || Math.abs(dy) < 7;
    if (g.kind === "bot") {
      const x = g.x + g.dir * 0.45;
      if (roomSolid(s.room, x, g.y)) g.dir *= -1;
      else g.x = x;
      g.facing = g.dir > 0 ? "right" : "left";
    } else {
      if (g.shot > 0) g.shot--;
      if (aligned && clearLine(s.room, g, p)) {
        g.facing =
          Math.abs(dx) > Math.abs(dy)
            ? dx < 0
              ? "left"
              : "right"
            : dy < 0
              ? "up"
              : "down";
        if (g.shot <= 30) g.aim = 30 - g.shot;
        if (g.shot <= 0) {
          const horizontal = Math.abs(dx) > Math.abs(dy);
          s.bullets.push({
            x: g.x + 8,
            y: g.y + 8,
            vx: horizontal ? Math.sign(dx) * 2 : 0,
            vy: horizontal ? 0 : Math.sign(dy) * 2,
            owner: "e",
            life: 100,
          });
          g.shot = difficulty(s.loop).shot;
          g.aim = 0;
          emit(s, "enemyShot");
        }
      }
      if (!g.aim) {
        if (g.age % 32 === 1 || !g.walk) {
          const vertical = Math.abs(dy) > Math.abs(dx);
          g.walk = vertical
            ? { x: 0, y: Math.sign(dy) }
            : { x: Math.sign(dx), y: 0 };
          if (random(s) < 0.2)
            g.walk = pick(s, [
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
            ]);
        }
        const speed = 0.35 * Math.min(2, 1 + (s.loop - 1) * 0.1),
          x = g.x + g.walk.x * speed,
          y = g.y + g.walk.y * speed;
        if (!roomSolid(s.room, x, y)) {
          g.x = x;
          g.y = y;
        } else g.walk = null;
      }
    }
    if (overlap({ x: g.x + 2, y: g.y + 2, w: 12, h: 12 }, playerBox(s, true))) {
      if (p.power.bomb) {
        g.dead = 24;
        award(s, 100, g.x, g.y);
      } else hit(s, "guard");
    }
  }
  s.guards = s.guards.filter((g) => !g.remove);
}
