import { RNG } from "./rng.js";
import { BUTTONS, FLOORS, FLOOR_Y, LEVEL_W, clamp, floorIndex, rectsOverlap } from "./constants.js";
import { STORES, SHAFTS, ESCALATORS, ROOM_TEMPLATES, createStoreStates, createElevators, storeAtDoor, shaftAt, escalatorAt, nearestPackageStore } from "./level.js";
import { addScore, difficulty, POINTS, timeBonus } from "./scoring.js";
import { emptyPowerups, applyPowerup, tickPowerups, resetOnDeath, walkSpeed, absorbHit, POWERUP_INFO } from "./powerups.js";
import { startJump, integrateVertical, moveWithWalls, overlap } from "./physics.js";
import { beginSearch, tickSearch, touchingFixture } from "./search.js";
import { callElevator, updateElevator, carFloor, elevatorCrushRisk } from "./elevator.js";
import { KonamiDetector } from "./input.js";
import { ARRIVAL_POSTS, COMPLETE_POSTS, STORE_LINES, LAST_WORDS, ELEVATOR_LINES, PA_LINES, HEADLINES, JOKE_ITEMS, FLOOR_BANNERS } from "./copy.js";

const neutralInput = () => Object.fromEntries(BUTTONS.flatMap((key) => [[key, false], [`${key}Pressed`, false], [`${key}Released`, false]]));
const anyButton = (input) => BUTTONS.some((key) => input[`${key}Pressed`]);
const playerRect = (p) => ({ x: p.x, y: p.y + (p.ducking ? 14 : 0), w: p.w, h: p.ducking ? p.h - 14 : p.h });
const openStores = () => STORES.filter((store) => store.role !== "closed");

function freshPlayer() {
  return {
    x: 350, y: FLOOR_Y.R - 24, w: 12, h: 24, floor: "R", facing: 1,
    grounded: true, vy: 0, ducking: false, jumpKick: false, riding: null,
    escalator: null, hidden: false, photoTime: 0, freeze: 0, slide: 0,
    overhead: null, overheadTime: 0, searchFacing: "down",
  };
}

function makeLamps() {
  const positions = { "4F": [140, 456, 660], "3F": [160, 384, 584], "2F": [144, 312, 480], "1F": [80, 320, 600] };
  return FLOORS.slice(1, 5).flatMap((floor) => positions[floor].map((x, index) => ({
    id: `${floor}:${index}`, floor, x, y: FLOOR_Y[floor] - 20, w: 12, h: 12,
    state: "hanging", vy: 0, vx: 0, dark: 0, disco: floor === "2F",
  })));
}

/** Pure game rules. Rendering, DOM, audio and wall-clock time never enter this module. */
export class MallGame {
  constructor(seed = 0x4d414c4c, { skipSplash = false } = {}) {
    this.rng = new RNG(seed);
    this.seed = seed;
    this.highScore = 0;
    this.konami = new KonamiDetector();
    this.blackFriday = false;
    this.nextId = 1;
    this.events = [];
    this.state = {
      screen: skipSplash ? "title" : "splash", screenFrame: 0, frame: 0,
      score: 0, lives: 3, continues: 3, loop: 1, packages: 0,
      inventory: [], photoStrip: false, visitedStores: {}, gameEasterDone: false, powerups: emptyPowerups(),
      player: freshPlayer(), stores: {}, elevators: [], spies: [], bullets: [], enemyBullets: [],
      lamps: makeLamps(), drops: [], coins: [], popups: [], toys: [],
      elapsed: 0, alarm: false, spawnTimer: 300, message: null, messageTime: 0,
      floorBanner: null, floorBannerTime: 0, overlayReturn: null, fade: 0,
      safe: { x: 350, floor: "R" }, invulnerability: 0, respawnTime: 0,
      arrivalPost: null, clear: null, continueTime: 9 * 60, gameoverTime: 0,
      cop: { x: 520, floor: "2F", dir: -1, chase: 0, cooldown: 0 },
      walkers: [{ x: 120, floor: "2F", dir: 1, min: 80, max: 180 }, { x: 470, floor: "2F", dir: -1, min: 430, max: 520 }],
      janitor: { x: 650, dir: -1, mop: 0, wet: null },
      fountains: [{ floor: "3F", x: 540, cooldown: 0 }, { floor: "1F", x: 610, cooldown: 0 }],
      kioskCooldown: 0, lastPA: -1, paTimer: 2700, callTime: 0,
      galleryTime: 0,
    };
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  sound(name) { this.emit("sound", { name }); }
  message(text, frames = 150) { this.state.message = text; this.state.messageTime = frames; }
  score(amount, x = null, y = null) {
    const result = addScore(this.state, amount);
    this.highScore = Math.max(this.highScore, this.state.score);
    if (x !== null) this.state.popups.push({ x, y, text: `${amount > 0 ? "+" : ""}${amount}`, life: 60 });
    if (result.extraLife) { this.message("EXTRA LIFE!"); this.sound("1up"); }
  }

  step(rawInput = neutralInput()) {
    const input = { ...neutralInput(), ...rawInput };
    this.events = [];
    const s = this.state;
    s.frame++;
    s.screenFrame++;
    if (s.fade > 0) s.fade--;
    if (s.noticeTime > 0) s.noticeTime--;
    if (s.messageTime > 0 && s.screen !== "pause" && s.screen !== "map") s.messageTime--;
    if (s.floorBannerTime > 0) s.floorBannerTime--;
    for (const popup of s.popups) { popup.life--; popup.y -= 0.25; }
    s.popups = s.popups.filter((popup) => popup.life > 0);

    switch (s.screen) {
      case "splash": this.stepSplash(input); break;
      case "title": this.stepTitle(input); break;
      case "arrival": this.stepArrival(input); break;
      case "mall": this.stepMall(input); break;
      case "store": this.stepStore(input); break;
      case "map": case "pause": this.stepOverlay(input); break;
      case "clear": this.stepClear(input); break;
      case "continue": this.stepContinue(input); break;
      case "gameover": this.stepGameover(input); break;
      case "gallery": if (input.startPressed || input.selectPressed) { s.screen = "title"; s.screenFrame = 0; } break;
      default: break;
    }
    return this.events;
  }

  stepSplash(input) {
    if (anyButton(input) || this.state.screenFrame >= 210) {
      this.state.screen = "title";
      this.state.screenFrame = 0;
      this.sound("title");
    } else if (this.state.screenFrame === 65) this.sound("jingle");
  }

  stepTitle(input) {
    for (const button of BUTTONS) if (input[`${button}Pressed`]) {
      if (this.konami.push(button)) {
        this.blackFriday = true;
        this.message("BLACK FRIDAY! 70% OFF EVERYTHING", 240);
        this.sound("fanfare");
      }
    }
    if (input.startPressed) this.newGame();
  }

  newGame() {
    const s = this.state;
    s.score = 0; s.lives = 3; s.continues = 3; s.loop = 1;
    s.inventory = []; s.photoStrip = false; s.visitedStores = {}; s.gameEasterDone = false;
    this.startLevel(1);
  }

  startLevel(loop) {
    const s = this.state;
    s.loop = loop; s.packages = 0; s.elapsed = 0; s.alarm = false;
    s.powerups = emptyPowerups(); s.stores = createStoreStates(this.rng, this.blackFriday);
    for (const [id, room] of Object.entries(s.stores)) {
      room.firstVisit = !s.visitedStores[id];
      if (id === "game") room.easterEggDone = s.gameEasterDone;
    }
    s.elevators = createElevators(this.rng); s.spies = []; s.bullets = []; s.enemyBullets = [];
    s.drops = []; s.coins = []; s.toys = []; s.lamps = makeLamps(); s.popups = [];
    s.spawnTimer = 300; s.player = freshPlayer(); s.safe = { x: 350, floor: "R" };
    s.invulnerability = 0; s.arrivalPost = this.rng.pick(ARRIVAL_POSTS);
    s.cop = { x: 520, floor: this.rng.pick(FLOORS.slice(1, 5)), dir: -1, chase: 0, cooldown: 0 };
    s.screen = "arrival"; s.screenFrame = 0; s.arrivalPhase = "zipline";
    s.message = null; s.messageTime = 0; s.fade = 12;
    this.emit("transition", { to: "arrival" });
  }

  stepArrival(input) {
    const s = this.state;
    const t = s.screenFrame;
    if (t < 105) {
      s.arrivalPhase = "zipline";
      const q = t / 105;
      s.player.x = 34 + q * 290;
      s.player.y = 10 + q * 24;
      if (t === 1) this.sound("zip");
    } else if (t < 135) {
      s.arrivalPhase = "drop";
      const q = (t - 105) / 30;
      s.player.x = 324 + q * 26;
      s.player.y = 34 + q * q * (FLOOR_Y.R - 24 - 34);
      if (t === 134) this.sound("thud");
    } else {
      if (s.arrivalPhase !== "selfie") {
        s.arrivalPhase = "selfie"; s.selfieStart = t; s.screenFrame = t;
        s.player.x = 350; s.player.y = FLOOR_Y.R - 24;
        this.sound("flash");
      }
      if (anyButton(input) || t - s.selfieStart >= 150) {
        s.screen = "mall"; s.screenFrame = 0; s.fade = 10;
        s.player = freshPlayer(); s.player.x = 350;
        this.message("FIND 6 PACKAGES. GET TO THE CAR.", 210);
        this.sound("mall");
      }
    }
  }

  stepOverlay(input) {
    const s = this.state;
    if ((s.screen === "map" && input.selectPressed) || (s.screen === "pause" && input.startPressed) || input.startPressed && s.screen === "map") {
      s.screen = s.overlayReturn || "mall"; s.overlayReturn = null; s.screenFrame = 0;
      this.sound("pause");
    }
  }

  openOverlay(kind) {
    const s = this.state;
    s.overlayReturn = s.screen; s.screen = kind; s.screenFrame = 0;
    this.sound("pause");
  }

  stepMall(input) {
    const s = this.state;
    if (input.selectPressed) { this.openOverlay("map"); return; }
    if (input.startPressed) { this.openOverlay("pause"); return; }
    s.elapsed++;
    tickPowerups(s);
    if (s.invulnerability > 0) s.invulnerability--;
    if (s.respawnTime > 0) s.respawnTime--;
    if (s.player.overheadTime > 0 && --s.player.overheadTime === 0) s.player.overhead = null;
    if (s.kioskCooldown > 0) s.kioskCooldown--;
    if (!s.alarm && s.elapsed >= difficulty(s.loop).alarmFrames) {
      s.alarm = true; this.message("ALARM! SECURITY ALERTED", 240); this.sound("alarm");
    }
    this.updatePA();
    this.updateElevators(input);
    if (s.screen !== "mall") return;
    this.updatePlayerMall(input);
    if (s.screen !== "mall") return;
    this.updateSpies();
    if (s.screen !== "mall") return;
    this.updateBullets();
    if (s.screen !== "mall") return;
    this.updateLamps();
    if (s.screen !== "mall") return;
    this.updateNPCs();
    if (s.screen !== "mall") return;
    this.updateDrops();
    this.updateSpawning();
    for (const fountain of s.fountains) if (fountain.cooldown > 0) fountain.cooldown--;
    if (s.player.freeze > 0) s.player.freeze--;
  }

  updatePA() {
    const s = this.state;
    if (--s.paTimer > 0) return;
    let index = this.rng.int(0, PA_LINES.length - 1);
    if (index === s.lastPA) index = (index + 1) % PA_LINES.length;
    s.lastPA = index; s.paTimer = 3600;
    this.message(PA_LINES[index], 240); this.sound("pa");
  }

  updateElevators(input) {
    const s = this.state;
    for (const car of s.elevators) {
      car.occupied = s.player.riding === car.id;
      const result = updateElevator(car, car.occupied ? input : {}, this.rng);
      if (result.ding) {
        const near = Math.abs(s.player.x - car.x) < 180 && Math.abs(FLOOR_Y[s.player.floor] - car.y) < 60;
        if (near || car.occupied) { this.sound("ding"); this.emit("ding", { car: car.id }); }
        if (car.occupied) { s.floorBanner = FLOOR_BANNERS[result.arrived]; s.floorBannerTime = 150; this.sound("muzak"); }
        if (near && this.rng.chance(0.16) && s.spies.length < 4) {
          this.spawnSpy(car.lastFloor, car.x + 30, "elevator");
        }
      }
      if (elevatorCrushRisk(car, playerRect(s.player)) && !car.occupied && s.invulnerability <= 0) this.killPlayer("CRUSHED!");
      for (const spy of s.spies) {
        if (spy.state !== "dying" && elevatorCrushRisk(car, spy)) this.killSpy(spy, "crush");
      }
    }
  }

  updatePlayerMall(input) {
    const s = this.state; const p = s.player;
    if (p.freeze > 0) return;
    if (p.escalator) {
      const e = p.escalator;
      e.progress += 1 / 72;
      const fromY = FLOOR_Y[e.from], toY = FLOOR_Y[e.to];
      p.x = e.fromX + (e.toX - e.fromX) * Math.min(1, e.progress);
      p.y = fromY + (toY - fromY) * Math.min(1, e.progress) - 24;
      if (e.progress >= 1) { p.floor = e.to; p.escalator = null; p.grounded = true; this.setSafe(); }
      return;
    }
    if (p.riding) {
      const car = s.elevators.find((item) => item.id === p.riding);
      if (!car) { p.riding = null; return; }
      p.x = car.x + 6; p.y = car.y - 24; p.floor = carFloor(car) || p.floor;
      if (!car.moving && carFloor(car) && (input.leftPressed || input.rightPressed)) {
        const dir = input.leftPressed ? -1 : 1;
        p.x = clamp(car.x + (dir < 0 ? -20 : 30), 0, LEVEL_W - p.w);
        p.riding = null; car.occupied = false; p.floor = carFloor(car); p.y = FLOOR_Y[p.floor] - 24;
        this.setSafe(); this.sound("door");
      }
      return;
    }
    if (p.hidden) {
      p.photoTime++;
      if (input.upPressed || input.downPressed || p.photoTime >= 300) this.exitPhotoBooth();
      return;
    }

    p.ducking = input.down && p.grounded;
    const speed = walkSpeed(s);
    let dx = 0;
    if (!p.ducking) dx = (input.right ? speed : 0) - (input.left ? speed : 0);
    if (p.slide) dx = p.slide;
    if (dx) p.facing = Math.sign(dx);
    p.x = clamp(p.x + dx, 0, LEVEL_W - p.w);
    if (input.bPressed && p.grounded) { startJump(p, !!dx, s.powerups.speed === "sneakers"); this.sound("jump"); }
    if (input.aPressed) this.shootMall();

    const shaft = shaftAt(p.floor, p.x + p.w / 2);
    const car = shaft && s.elevators.find((item) => item.id === shaft.id);
    const overOpening = shaft && Math.abs((shaft.x + 12) - (p.x + p.w / 2)) < 12;
    if (overOpening && car && car.y > FLOOR_Y[p.floor] && p.grounded) {
      p.grounded = false; p.vy = 0; p.fallStartY = p.y + p.h;
    }
    if (!p.grounded) {
      const landingY = overOpening && car ? car.y - 24 : FLOOR_Y[p.floor];
      const result = integrateVertical(p, landingY);
      if (result.landed) {
        this.sound("thud");
        if (result.outcome === "fatal") { this.killPlayer("TOO FAR!"); return; }
        if (overOpening && car && landingY < FLOOR_Y[p.floor]) p.y = car.y - 48;
        this.setSafe();
      }
    } else p.y = FLOOR_Y[p.floor] - 24;

    if (input.upPressed || input.downPressed) this.mallInteract(input.upPressed ? -1 : 1);
    if (shaft && car && carFloor(car) !== p.floor) {
      if (Math.abs(p.x + p.w / 2 - (shaft.x + 12)) < 28 && Math.abs(dx) < 0.01) {
        if (++s.callTime >= 30) { callElevator(car, p.floor); s.callTime = 0; }
      } else s.callTime = 0;
    } else s.callTime = 0;
  }

  mallInteract(direction) {
    const s = this.state; const p = s.player; const center = p.x + p.w / 2;
    const store = storeAtDoor(p.floor, center);
    if (store) {
      if (store.role === "closed") { this.message("CLOSED. BE KIND, REWIND."); this.sound("buzzer"); return; }
      if (store.role === "target" && s.stores[store.id].cleared) { this.message("STORE CLEARED"); this.sound("buzzer"); return; }
      this.enterStore(store.id); return;
    }
    const shaft = shaftAt(p.floor, center);
    if (shaft) {
      const car = s.elevators.find((item) => item.id === shaft.id);
      if (carFloor(car) === p.floor && !car.moving) {
        p.riding = car.id; car.occupied = true; p.x = car.x + 6; this.sound("door");
      } else if (!callElevator(car, p.floor)) this.message("ELEVATOR IS HERE");
      return;
    }
    const escalator = escalatorAt(p.floor, center, direction);
    if (escalator) {
      const goingUp = direction < 0;
      p.escalator = {
        from: goingUp ? escalator.bottom : escalator.top, to: goingUp ? escalator.top : escalator.bottom,
        fromX: escalator.x + (goingUp ? 36 : -36), toX: escalator.x + (goingUp ? -36 : 36), progress: 0,
      };
      p.x = p.escalator.fromX; this.sound("escalator"); return;
    }
    if (p.floor === "P" && Math.abs(center - 390) < 40 && direction < 0) { this.tryExit(); return; }
    if (p.floor !== "R" && p.floor !== "P" && Math.abs(center - 280) < 20 && direction < 0) {
      if (s.kioskCooldown > 0) this.message("DIRECTORY RELOADING...");
      else {
        const target = nearestPackageStore(s.stores, p.floor, center);
        this.message(target ? `NEAREST PACKAGE: ${target.name} / ${target.floor}` : "ALL PACKAGES FOUND!");
        s.kioskCooldown = 1200; this.sound("kiosk");
      }
      return;
    }
    if (p.floor === "3F" && Math.abs(center - 600) < 20 && direction < 0) {
      p.hidden = true; p.photoTime = 0; this.message("HIDDEN IN PHOTO BOOTH"); this.sound("door");
    }
  }

  exitPhotoBooth() {
    const s = this.state; const p = s.player;
    p.hidden = false; p.photoTime = 0;
    if (!s.photoStrip) { s.photoStrip = true; s.inventory.push("4-FRAME PHOTO STRIP"); this.message("YOU GOT: PHOTO STRIP"); this.sound("powerup"); }
  }

  setSafe() {
    const p = this.state.player;
    if (p.grounded && !p.riding && !p.escalator) this.state.safe = { x: p.x, floor: p.floor };
  }

  shootMall() {
    const s = this.state; const p = s.player;
    const max = s.powerups.weapon === "rapid" ? 4 : 2;
    if (s.bullets.filter((b) => !b.enemy).length >= max || p.shotCooldown > 0) return;
    p.shotCooldown = s.powerups.weapon === "rapid" ? 4 : 9;
    const y = p.y + (p.ducking ? 17 : 10);
    const directions = s.powerups.weapon === "spread" ? [-1, 0, 1] : [0];
    for (const slope of directions) s.bullets.push({ id: this.nextId++, x: p.x + 6, y, w: 4, h: 2, vx: p.facing * 4, vy: slope, floor: p.floor, enemy: false, life: 150 });
    this.sound("shot");
    const cop = s.cop;
    if (cop.floor === p.floor && Math.abs(cop.x - p.x) < 128 && Math.sign(p.x - cop.x) === cop.dir && cop.cooldown <= 0) {
      cop.chase = 600; cop.cooldown = 900; this.message("HEY! STOP RIGHT THERE!"); this.sound("whistle");
    }
  }

  updateSpawning() {
    const s = this.state;
    if (--s.spawnTimer > 0 || s.elapsed < 300) return;
    const cap = this.blackFriday ? 8 : 4;
    const d = difficulty(s.loop) ;
    s.spawnTimer = Math.max(70, Math.floor(260 / d.spawnRate / (this.blackFriday ? 2 : 1) / (s.alarm ? 1.4 : 1)));
    if (s.spies.filter((spy) => spy.state !== "dying").length >= cap) return;
    const floor = s.player.floor;
    const candidates = openStores().filter((store) => Math.abs(floorIndex(store.floor) - floorIndex(floor)) <= 1 && !(store.role === "target" && s.stores[store.id].cleared));
    if (!candidates.length) return;
    const store = this.rng.pick(candidates);
    let x = store.x + 40;
    if (Math.abs(x - s.player.x) < 64) x = clamp(s.player.x + this.rng.sign() * this.rng.int(80, 160), 10, LEVEL_W - 20);
    this.spawnSpy(store.floor, x, "door");
  }

  spawnSpy(floor, x, source = "door") {
    const s = this.state;
    s.spies.push({
      id: this.nextId++, x: clamp(x, 4, LEVEL_W - 16), y: FLOOR_Y[floor] - 24, w: 12, h: 24,
      floor, dir: this.rng.sign(), state: "walk", age: 0, cooldown: this.rng.int(30, 100),
      aim: 0, aimHigh: true, dying: 0, duck: 0, dodgeBullet: null, words: null,
      source, hp: 1, wander: this.rng.int(40, 140),
    });
    if (source === "elevator" && this.rng.chance(0.6)) this.message(this.rng.pick(ELEVATOR_LINES), 100);
  }

  updateSpies() {
    const s = this.state; const p = s.player; const d = difficulty(s.loop);
    for (const spy of s.spies) {
      if (spy.state === "dying") { spy.dying--; continue; }
      spy.age++; if (spy.cooldown > 0) spy.cooldown--;
      if (spy.duck > 0) spy.duck--;
      if (spy.words && --spy.words.time <= 0) spy.words = null;
      const dx = p.x - spy.x; const sameFloor = p.floor === spy.floor;
      const visible = sameFloor && Math.abs(dx) < 160 && !p.hidden && !p.riding && s.invulnerability <= 0;
      if (spy.aim > 0) {
        if (--spy.aim === 0) {
          s.enemyBullets.push({ id: this.nextId++, x: spy.x + 6, y: spy.y + (spy.aimHigh ? 9 : 18), w: 4, h: 2, vx: spy.dir * 2, vy: 0, floor: spy.floor, enemy: true, life: 180 });
          spy.cooldown = Math.max(60, Math.floor(150 / d.fireRate)); this.sound("enemyShot");
        }
        continue;
      }
      if (visible && spy.age >= 90 && spy.cooldown <= 0 && Math.abs(dx) < 145) {
        spy.aim = 30; spy.dir = Math.sign(dx) || spy.dir; spy.aimHigh = this.rng.chance(0.5); continue;
      }
      let move = 0;
      if (visible && Math.abs(dx) > 40) move = Math.sign(dx);
      else if (!visible) {
        if (--spy.wander <= 0) { spy.dir = this.rng.sign(); spy.wander = this.rng.int(60, 180); }
        move = spy.dir;
      }
      const speed = 0.45 * d.spySpeed * (s.alarm ? 1.25 : 1);
      const nextX = spy.x + move * speed;
      const shaft = shaftAt(spy.floor, nextX + 6);
      const car = shaft && s.elevators.find((item) => item.id === shaft.id);
      if (shaft && car && car.y > FLOOR_Y[spy.floor] && Math.abs(nextX + 6 - shaft.x - 12) < 12) spy.dir *= -1;
      else { spy.x = clamp(nextX, 0, LEVEL_W - spy.w); if (move) spy.dir = move; }
      if (sameFloor && rectsOverlap(playerRect(p), spy)) {
        if (p.jumpKick || s.powerups.invincible > 0) this.killSpy(spy, p.slide ? "crush" : "spy");
        else this.killPlayer("SPY CONTACT!");
      }
    }
    s.spies = s.spies.filter((spy) => spy.state !== "dying" || spy.dying > 0);
  }

  killSpy(spy, kind = "spy") {
    if (spy.state === "dying") return;
    spy.state = "dying"; spy.dying = 24;
    this.score(kind === "crush" ? POINTS.crush : POINTS.spy, spy.x, spy.y);
    if (this.rng.chance(0.35)) spy.words = { text: this.rng.pick(LAST_WORDS), time: 80 };
    if (this.rng.chance(0.05)) {
      const food = this.rng.chance(0.5);
      this.state.drops.push({ x: spy.x, y: spy.y + 12, floor: spy.floor, id: food ? this.rng.pick(["cinnabomb", "orange", "pretzel"]) : this.rng.pick(["rapid", "spread", "armor", "sneakers"]), life: 900 });
    }
    this.sound(kind === "crush" ? "crush" : "spyDown");
  }

  updateBullets() {
    const s = this.state; const p = s.player;
    if (p.shotCooldown > 0) p.shotCooldown--;
    for (const bullet of [...s.bullets, ...s.enemyBullets]) {
      bullet.x += bullet.vx; bullet.y += bullet.vy || 0; bullet.life--;
      if (bullet.enemy) {
        if (bullet.floor === p.floor && rectsOverlap(bullet, playerRect(p))) {
          bullet.life = 0; this.killPlayer("HIT!");
        }
        continue;
      }
      for (const spy of s.spies) {
        if (bullet.life <= 0 || spy.state === "dying" || spy.floor !== bullet.floor) continue;
        if (Math.abs(bullet.x - spy.x) < 34 && spy.dodgeBullet !== bullet.id) {
          spy.dodgeBullet = bullet.id;
          if (this.rng.chance(0.1)) spy.duck = 24;
        }
        const hitbox = { x: spy.x, y: spy.y + (spy.duck ? 11 : 0), w: spy.w, h: spy.duck ? 13 : spy.h };
        if (rectsOverlap(bullet, hitbox)) { bullet.life = 0; this.killSpy(spy); }
      }
      for (const lamp of s.lamps) {
        if (lamp.state === "hanging" && lamp.floor === bullet.floor && rectsOverlap(bullet, { x: lamp.x, y: lamp.y - 10, w: 12, h: 22 })) {
          bullet.life = 0; lamp.state = lamp.disco ? "rolling" : "falling"; lamp.vx = lamp.disco ? Math.sign(bullet.vx) * 2 : 0; lamp.vy = 0;
          this.sound("lamp"); this.emit("shake", { frames: 10 });
        }
      }
      for (const fountain of s.fountains) {
        if (fountain.floor === bullet.floor && fountain.cooldown <= 0 && Math.abs(bullet.x - fountain.x) < 16) {
          bullet.life = 0; this.sprayFountain(fountain);
        }
      }
      for (const walker of s.walkers) {
        if (walker.floor === bullet.floor && Math.abs(bullet.x - walker.x) < 9) {
          bullet.life = 0; this.score(POINTS.walker, walker.x, FLOOR_Y[walker.floor] - 30); walker.hey = 70; this.sound("hey");
        }
      }
      const cop = s.cop;
      if (cop.floor === bullet.floor && Math.abs(bullet.x - cop.x) < 10) { bullet.life = 0; this.sound("ping"); }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.x >= 0 && b.x < LEVEL_W);
    s.enemyBullets = s.enemyBullets.filter((b) => b.life > 0 && b.x >= 0 && b.x < LEVEL_W);
  }

  sprayFountain(fountain) {
    const s = this.state; fountain.cooldown = 900;
    const count = this.rng.int(3, 5); const gold = this.rng.chance(1 / 20);
    for (let i = 0; i < count; i++) s.coins.push({ x: fountain.x, y: FLOOR_Y[fountain.floor] - 18, vx: (i - (count - 1) / 2) * 0.8, vy: -3 - this.rng.next(), floor: fountain.floor, gold: gold && i === 0, life: 600 });
    this.sound("coins");
  }

  updateLamps() {
    const s = this.state;
    for (const lamp of s.lamps) {
      if (lamp.dark > 0) lamp.dark--;
      if (lamp.state === "falling" || lamp.state === "rolling") {
        if (lamp.state === "falling") { lamp.vy += 0.35; lamp.y += lamp.vy; }
        else { lamp.x += lamp.vx; lamp.y = Math.min(FLOOR_Y[lamp.floor] - 10, lamp.y + 3); }
        const rect = { x: lamp.x, y: lamp.y, w: 12, h: 12 };
        for (const spy of s.spies) if (spy.floor === lamp.floor && spy.state !== "dying" && rectsOverlap(rect, spy)) this.killSpy(spy, "crush");
        if (s.player.floor === lamp.floor && rectsOverlap(rect, playerRect(s.player))) this.killPlayer(lamp.disco ? "DISCO DEMOLITION!" : "LIGHTS OUT!");
        if (lamp.y >= FLOOR_Y[lamp.floor] - 10 && lamp.state === "falling") {
          lamp.state = "broken"; lamp.dark = 120; this.sound("glass"); this.emit("shake", { frames: 12 });
        }
        if (lamp.state === "rolling" && (lamp.x < 4 || lamp.x > LEVEL_W - 16 || shaftAt(lamp.floor, lamp.x))) { lamp.state = "broken"; lamp.dark = 120; this.sound("glass"); }
      }
    }
  }

  updateNPCs() {
    const s = this.state; const p = s.player;
    for (const walker of s.walkers) {
      walker.x += walker.dir * 0.7;
      if (walker.x < walker.min || walker.x > walker.max) walker.dir *= -1;
      if (walker.hey > 0) walker.hey--;
      if (p.floor === walker.floor && Math.abs(p.x - walker.x) < 10) p.x += walker.dir * 0.7;
    }
    const janitor = s.janitor;
    janitor.x += janitor.dir * 0.35;
    if (janitor.x < 540 || janitor.x > 670) janitor.dir *= -1;
    if (++janitor.mop > 300) {
      janitor.mop = 0;
      const x = clamp(janitor.x - 24, 500, 650);
      janitor.wet = { x: Math.min(x, 560), floor: "1F", life: 600 };
    }
    if (janitor.wet && --janitor.wet.life <= 0) janitor.wet = null;
    if (janitor.wet && p.floor === "1F" && p.grounded && p.x + p.w > janitor.wet.x && p.x < janitor.wet.x + 48) p.slide = p.facing || 1;
    else if (!janitor.wet || p.floor !== "1F" || p.x + p.w < janitor.wet.x - 2 || p.x > janitor.wet.x + 50) p.slide = 0;
    if (p.slide && p.jumpKick) for (const spy of s.spies) if (spy.floor === p.floor && rectsOverlap(p, spy)) this.killSpy(spy, "crush");

    const cop = s.cop;
    if (cop.cooldown > 0) cop.cooldown--;
    if (cop.chase > 0) {
      cop.chase--;
      if (cop.floor !== p.floor && cop.chase % 120 === 0) cop.floor = p.floor;
      cop.dir = Math.sign(p.x - cop.x) || cop.dir; cop.x += cop.dir * 1.25;
      if (cop.floor === p.floor && Math.abs(cop.x - p.x) < 12 && p.freeze <= 0) {
        cop.chase = 0; p.freeze = 180; this.score(POINTS.detained, p.x, p.y); this.message("DETAINED! -500"); this.sound("whistle");
      }
    } else {
      cop.x += cop.dir * 0.45;
      if (cop.x < 20 || cop.x > LEVEL_W - 30) cop.dir *= -1;
    }
  }

  updateDrops() {
    const s = this.state; const p = s.player;
    for (const drop of s.drops) {
      drop.life--;
      if (drop.floor === p.floor && Math.abs(drop.x - p.x) < 14) { drop.life = 0; this.collectPowerup(drop.id); }
    }
    s.drops = s.drops.filter((drop) => drop.life > 0);
    for (const coin of s.coins) {
      coin.life--; coin.vy += 0.18; coin.x += coin.vx; coin.y += coin.vy;
      const floor = FLOOR_Y[coin.floor] - 5;
      if (coin.y > floor) { coin.y = floor; coin.vy *= -0.55; }
      if (coin.floor === p.floor && Math.abs(coin.x - p.x) < 14 && Math.abs(coin.y - p.y - 12) < 20) {
        coin.life = 0;
        if (coin.gold) { s.lives++; this.message("GOLD COIN: EXTRA LIFE!"); this.sound("1up"); }
        else { this.score(POINTS.coin, coin.x, coin.y); this.sound("coin"); }
      }
    }
    s.coins = s.coins.filter((coin) => coin.life > 0);
  }

  collectPowerup(id) {
    const name = applyPowerup(this.state, id);
    this.score(POINTS.powerup); this.message(`YOU GOT: ${name}`); this.state.player.overhead = id; this.state.player.overheadTime = 90;
    this.sound("powerup");
  }

  killPlayer(reason = "OUCH!") {
    const s = this.state;
    if (!["mall", "store"].includes(s.screen) || absorbHit(s)) return;
    s.deathSpot = { x: s.player.x, floor: s.player.floor };
    s.lives--; this.sound("death"); this.emit("death", { reason });
    resetOnDeath(s); s.spies = []; s.bullets = []; s.enemyBullets = []; s.player.freeze = 0; s.player.slide = 0;
    if (s.lives > 0) {
      this.respawn(); this.message(reason, 100);
    } else if (s.continues > 0) {
      s.screen = "continue"; s.screenFrame = 0; s.continueTime = 9 * 60; this.sound("continue");
    } else {
      s.screen = "gameover"; s.screenFrame = 0; s.gameoverTime = 0; this.sound("gameover");
    }
  }

  respawn() {
    const s = this.state; const safe = s.safe;
    s.screen = "mall"; s.screenFrame = 0; s.player = freshPlayer(); s.player.x = safe.x; s.player.floor = safe.floor; s.player.y = FLOOR_Y[safe.floor] - 24;
    s.invulnerability = 120; s.respawnTime = 90; s.fade = 8;
    for (const car of s.elevators) car.occupied = false;
  }

  stepContinue(input) {
    const s = this.state;
    const before = Math.ceil(s.continueTime / 60);
    s.continueTime--;
    const after = Math.ceil(s.continueTime / 60);
    if (after !== before && after >= 0) this.sound("countdown");
    if (input.startPressed) {
      s.continues--; s.lives = 3; s.powerups = emptyPowerups();
      if (s.deathSpot) s.safe = { ...s.deathSpot };
      this.respawn(); this.message("BACK ON THE CASE!"); return;
    }
    if (s.continueTime <= 0) { s.screen = "gameover"; s.screenFrame = 0; this.sound("gameover"); }
  }

  enterStore(storeId) {
    const s = this.state; const store = STORES.find((item) => item.id === storeId); const room = s.stores[storeId];
    if (!store || !room) return;
    s.screen = "store"; s.screenFrame = 0; s.currentStore = storeId; s.fade = 14;
    s.storeSafe = { x: s.player.x, floor: s.player.floor };
    s.player = { ...freshPlayer(), x: 122, y: 144, w: 12, h: 16, floor: store.floor, facing: 1, searchFacing: "up", grounded: false };
    s.bullets = []; s.enemyBullets = [];
    room.visits++;
    room.guards = this.makeStoreGuards(store, room);
    room.search = null; room.toys = [];
    room.firstVisit = !s.visitedStores[storeId];
    room.entryGrace = 90; room.lineTime = room.firstVisit ? 150 : 0;
    s.visitedStores[storeId] = true;
    if (storeId === "game" && !room.easterEggDone) room.easter = { phase: "text", time: 210, item: this.rng.pick(JOKE_ITEMS) };
    else room.easter = null;
    this.sound("door"); this.emit("transition", { to: "store", storeId });
  }

  makeStoreGuards(store, room) {
    const guards = [];
    const spots = [[48, 48], [192, 48], [128, 96], [48, 128], [192, 128]];
    for (let i = 0; i < ROOM_TEMPLATES[store.id].guards; i++) {
      const [x, y] = spots[i];
      guards.push({ id: this.nextId++, type: "spy", x, y, w: 12, h: 16, dir: i % 2 ? -1 : 1, facing: "down", hp: 1, cooldown: 100 + i * 30, aim: 0, grace: 120, stun: 0, dying: 0, age: 0 });
    }
    for (let i = 0; i < ROOM_TEMPLATES[store.id].bots; i++) {
      const [x, y] = spots[4 - i];
      guards.push({ id: this.nextId++, type: "bot", x, y, w: 14, h: 16, dir: 1, facing: "right", hp: 3, cooldown: 0, aim: 0, grace: 60, stun: 0, dying: 0, age: 0 });
    }
    return guards;
  }

  roomSolids(room) {
    const template = ROOM_TEMPLATES[room.storeId];
    const solids = room.fixtures.map((f) => ({ x: f.x, y: f.y, w: 16, h: 16 }));
    template.rows.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell === "#") solids.push({ x: x * 16, y: y * 16, w: 16, h: 16 });
    }));
    return solids;
  }

  stepStore(input) {
    const s = this.state; const room = s.stores[s.currentStore]; const p = s.player;
    const template = ROOM_TEMPLATES[room.storeId]; const roomMaxX = (template.width - 1) * 16;
    if (input.selectPressed) { this.openOverlay("map"); return; }
    if (input.startPressed) { this.openOverlay("pause"); return; }
    s.elapsed++; tickPowerups(s);
    if (s.invulnerability > 0) s.invulnerability--;
    if (p.overheadTime > 0 && --p.overheadTime === 0) p.overhead = null;
    if (room.entryGrace > 0) room.entryGrace--;
    if (room.lineTime > 0 && --room.lineTime === 0) room.firstVisit = false;
    if (room.easter) { this.updateEasterEgg(room, input); if (room.easter?.phase === "text") return; }
    if (p.freeze > 0) { p.freeze--; return; }

    const searchResult = tickSearch(room, input);
    if (room.search && room.search.remaining % 8 === 0) this.sound("search");
    if (searchResult?.completed) this.finishSearch(room, searchResult.fixture);
    if (input.bPressed && !room.search) beginSearch(room, p, s.powerups.speed === "sneakers");
    if (!room.search) {
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const dx = dy ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const speed = walkSpeed(s);
      if (dy) p.searchFacing = dy < 0 ? "up" : "down";
      else if (dx) p.searchFacing = dx < 0 ? "left" : "right";
      const oldX = p.x, oldY = p.y;
      moveWithWalls(p, dx * speed, dy * speed, this.roomSolids(room), { minX: 16, maxX: roomMaxX });
      // Gentle Zelda-style nudge around a fixture corner.
      if (oldX === p.x && dx && !dy) {
        for (const nudge of [-1, 1]) {
          p.y += nudge;
          moveWithWalls(p, dx * speed, 0, this.roomSolids(room), { minX: 16, maxX: roomMaxX });
          if (p.x !== oldX) break;
          p.y = oldY;
        }
      }
      if (input.aPressed) this.shootStore();
    }
    if (p.y >= 158 && p.x + p.w > 112 && p.x < 144 && input.down) { this.leaveStore(); return; }
    this.updateStoreGuards(room);
    if (s.screen !== "store") return;
    this.updateStoreBullets(room);
    if (s.screen !== "store") return;
    this.updateToys(room);
    if (room.storeId === "sam") {
      const onBooth = p.x > 96 && p.x < 144 && p.y > 112 && p.y < 144;
      if (onBooth && !room.boothPlaying) { room.boothPlaying = true; this.message("NOW PLAYING: SIDE B"); this.sound("sideB"); }
    }
  }

  finishSearch(room, fixture) {
    const s = this.state;
    if (room.fittingRoom && fixture.isFitting && !fixture.fittingRevealed && this.rng.chance(0.25)) {
      fixture.fittingRevealed = true; fixture.opened = false;
      room.guards.push({ id: this.nextId++, type: "spy", x: fixture.x + 2, y: fixture.y - 16, w: 12, h: 16, dir: 1, facing: "down", hp: 1, cooldown: 90, aim: 0, grace: 60, stun: 0, dying: 0, age: 0 });
      const dx = s.player.x - fixture.x, dy = s.player.y - fixture.y; const length = Math.hypot(dx, dy) || 1;
      s.enemyBullets.push({ id: this.nextId++, x: fixture.x + 6, y: fixture.y + 4, w: 5, h: 4, vx: dx / length * 2.5, vy: dy / length * 2.5, enemy: true, shoe: true, life: 90, store: true });
      this.message("OCCUPIED!!"); this.sound("shriek"); return;
    }
    const content = fixture.content;
    if (content === "package") {
      room.cleared = true; s.packages++; this.score(POINTS.package);
      pOverhead(s, "package"); this.message(`PACKAGE ${s.packages}/6`, 180); this.sound("fanfare"); this.emit("package", { count: s.packages });
    } else if (content === "trap") {
      pFreeze(s, 60); this.message("IT'S A TRAP!"); this.sound("smoke");
    } else if (content === "nothing") {
      this.message("NOTHING HERE"); this.sound("smoke");
    } else if (POWERUP_INFO[content]) this.collectPowerup(content);
  }

  shootStore() {
    const s = this.state; const p = s.player;
    const max = s.powerups.weapon === "rapid" ? 4 : 2;
    if (s.bullets.length >= max || p.shotCooldown > 0) return;
    p.shotCooldown = s.powerups.weapon === "rapid" ? 4 : 9;
    const vectors = { up: [0, -4], down: [0, 4], left: [-4, 0], right: [4, 0] };
    const [vx, vy] = vectors[p.searchFacing] || vectors.up;
    s.bullets.push({ id: this.nextId++, x: p.x + 5, y: p.y + 7, w: 3, h: 3, vx, vy, enemy: false, life: 90, store: true });
    this.sound("shot");
  }

  updateStoreGuards(room) {
    const s = this.state; const p = s.player; const template = ROOM_TEMPLATES[room.storeId];
    for (const guard of room.guards) {
      if (guard.hp <= 0 && guard.dying <= 0) continue;
      if (guard.dying > 0) { guard.dying--; continue; }
      if (guard.stun > 0) { guard.stun--; continue; }
      if (guard.grace > 0) guard.grace--;
      if (room.lineTime > 0 || room.easter?.phase === "text") continue;
      if (guard.type === "bot") {
        guard.x += guard.dir * 0.55;
        if (guard.x < 24 || guard.x > template.width * 16 - 40 || this.roomSolids(room).some((solid) => overlap(guard, solid))) { guard.dir *= -1; guard.x += guard.dir * 1.2; }
        guard.facing = guard.dir > 0 ? "right" : "left";
      } else {
        if (guard.cooldown > 0) guard.cooldown--;
        const dx = p.x - guard.x, dy = p.y - guard.y;
        if (guard.aim > 0) {
          if (--guard.aim === 0) {
            const horizontal = Math.abs(dx) > Math.abs(dy);
            const vx = horizontal ? Math.sign(dx) * 2 : 0, vy = horizontal ? 0 : Math.sign(dy) * 2;
            s.enemyBullets.push({ id: this.nextId++, x: guard.x + 5, y: guard.y + 7, w: 3, h: 3, vx, vy, enemy: true, life: 120, store: true });
            guard.cooldown = 140; this.sound("enemyShot");
          }
        } else if (guard.grace <= 0 && guard.cooldown <= 0 && (Math.abs(dx) < 8 || Math.abs(dy) < 8) && this.clearStoreLine(room, guard, p)) guard.aim = 30;
        else if (guard.age++ % 24 === 0) {
          const mx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
          const my = mx ? 0 : Math.sign(dy);
          moveWithWalls(guard, mx * 8, my * 8, this.roomSolids(room), { minX: 16, maxX: (template.width - 1) * 16 });
          guard.facing = mx ? (mx < 0 ? "left" : "right") : (my < 0 ? "up" : "down");
        }
      }
      if (rectsOverlap(playerRect(p), guard)) {
        if (s.powerups.invincible > 0 && guard.type === "spy") guard.dying = 20;
        else this.killPlayer("STORE SECURITY!");
      }
    }
    room.guards = room.guards.filter((guard) => guard.hp > 0 || guard.dying > 0);
  }

  clearStoreLine(room, a, b) {
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    for (let d = 8; d < distance; d += 8) {
      const point = { x: a.x + (b.x - a.x) * d / distance, y: a.y + (b.y - a.y) * d / distance, w: 2, h: 2 };
      if (this.roomSolids(room).some((solid) => overlap(point, solid))) return false;
    }
    return true;
  }

  updateStoreBullets(room) {
    const s = this.state; const p = s.player; const template = ROOM_TEMPLATES[room.storeId];
    if (p.shotCooldown > 0) p.shotCooldown--;
    for (const bullet of [...s.bullets, ...s.enemyBullets]) {
      bullet.x += bullet.vx; bullet.y += bullet.vy; bullet.life--;
      if (bullet.enemy) {
        if (rectsOverlap(bullet, playerRect(p))) { bullet.life = 0; this.killPlayer("HIT!"); }
      } else {
        for (const guard of room.guards) {
          if (!guard.dying && rectsOverlap(bullet, guard)) {
            bullet.life = 0; guard.hp--; this.sound("spyDown");
            if (guard.hp <= 0) { guard.dying = 20; this.score(POINTS.spy, guard.x, guard.y); }
          }
        }
        for (const fixture of room.fixtures) {
          if (rectsOverlap(bullet, fixture)) {
            bullet.life = 0;
            if (room.storeId === "kgb" && !room.toysReleased) { room.toysReleased = true; this.releaseToys(room, fixture); }
          }
        }
      }
      if (this.roomSolids(room).some((solid) => overlap(bullet, solid))) bullet.life = 0;
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < template.width * 16 && b.y > 0 && b.y < template.height * 16);
    s.enemyBullets = s.enemyBullets.filter((b) => b.life > 0 && b.x > 0 && b.x < template.width * 16 && b.y > 0 && b.y < template.height * 16);
  }

  releaseToys(room, fixture) {
    room.toys = [-1, 0, 1].map((dir) => ({ x: fixture.x + 4, y: fixture.y + 4, w: 8, h: 8, dir: dir || 1, life: 600 }));
    this.message("WIND-UP TOY PATROL!"); this.sound("toys");
  }

  updateToys(room) {
    if (!room.toys) return;
    for (const toy of room.toys) {
      if (toy.life-- <= 0) continue;
      toy.x += toy.dir;
      if (toy.x < 18 || toy.x > 226 || this.roomSolids(room).some((solid) => overlap(toy, solid))) { toy.dir *= -1; toy.x += toy.dir * 2; }
      for (const guard of room.guards) if (overlap(toy, guard)) guard.stun = 90;
      for (const fixture of room.fixtures) if (!fixture.opened && fixture.content === "trap" && overlap(toy, fixture)) {
        fixture.opened = true;
        for (const guard of room.guards) if (Math.hypot(guard.x - fixture.x, guard.y - fixture.y) < 48) guard.stun = 120;
        this.sound("smoke");
      }
    }
    room.toys = room.toys.filter((toy) => toy.life > 0);
  }

  updateEasterEgg(room, input) {
    const egg = room.easter; const s = this.state;
    if (egg.phase === "text") {
      if (--egg.time <= 0 || input.startPressed) { egg.phase = "item"; egg.time = 0; this.sound("item"); }
    } else if (egg.phase === "item") {
      if (Math.abs(s.player.x - 122) < 14 && Math.abs(s.player.y - 80) < 16) {
        egg.phase = "done"; room.easterEggDone = true; s.gameEasterDone = true; s.inventory.push(egg.item); this.score(POINTS.joke);
        pOverhead(s, "joke"); this.message(`YOU GOT: ${egg.item}`, 210); this.sound("fanfare");
      }
    }
  }

  leaveStore() {
    const s = this.state; const store = STORES.find((item) => item.id === s.currentStore);
    const back = s.storeSafe || { x: store.x + 34, floor: store.floor };
    s.screen = "mall"; s.screenFrame = 0; s.fade = 12;
    s.player = freshPlayer(); s.player.x = back.x; s.player.floor = back.floor; s.player.y = FLOOR_Y[back.floor] - 24;
    s.bullets = []; s.enemyBullets = []; s.stores[store.id].boothPlaying = false;
    this.setSafe(); this.sound("door"); this.emit("transition", { to: "mall" });
  }

  tryExit() {
    const s = this.state;
    if (s.packages < 6) { this.message(`PACKAGES LEFT: ${6 - s.packages}`); this.sound("buzzer"); return false; }
    if (s.screen !== "mall") return false;
    const bonus = timeBonus(s.elapsed);
    s.clear = {
      phase: "tally", time: 0, bonus, packages: s.packages, loop: s.loop,
      headline: this.rng.pick(HEADLINES), post: this.rng.pick(COMPLETE_POSTS), awarded: true,
    };
    this.score(POINTS.clear + bonus); s.screen = "clear"; s.screenFrame = 0;
    this.sound("clear"); this.emit("transition", { to: "clear" });
    return true;
  }

  stepClear(input) {
    const s = this.state; const clear = s.clear;
    clear.time++;
    const advance = input.startPressed || clear.time > (clear.phase === "tally" ? 360 : 300);
    if (!advance) return;
    clear.time = 0;
    if (clear.phase === "tally") { clear.phase = "newspaper"; this.sound("paper"); }
    else if (clear.phase === "newspaper") { clear.phase = "post"; this.sound("powerup"); }
    else this.startLevel(s.loop + 1);
  }

  stepGameover(input) {
    const s = this.state;
    s.gameoverTime++;
    if ((input.startPressed && s.gameoverTime > 60) || s.gameoverTime > 600) {
      s.screen = "title"; s.screenFrame = 0; this.blackFriday = false; this.sound("title");
    }
  }
}

function pOverhead(state, id) { state.player.overhead = id; state.player.overheadTime = 100; }
function pFreeze(state, frames) { state.player.freeze = frames; }

export function createDebugGame(seed, options) { return new MallGame(seed, options); }
