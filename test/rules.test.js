import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../src/rules.js";
import { random, overlap } from "../src/math.js";
import { Input, mapping, fixedLoop, konami, KONAMI } from "../src/input.js";
import { STORES, SHAFTS, ESCALATORS, FLOOR_Y, template } from "../src/data.js";
import { SPRITES, REQUIRED, FONT, textWidth } from "../src/art.js";
import {
  ARRIVAL,
  COMPLETE,
  VISITS,
  LAST_WORDS,
  ELEVATOR_LINES,
  HEADLINES,
  PA,
  TEXT,
} from "../src/copy.js";
import { splashFrame } from "../src/splash/splash.js";
const fresh = () => {
  const s = R.createGame(7, { debug: true });
  R.newRun(s);
  R.scene(s, "mall");
  s.banner = null;
  return s;
};
const run = (s, n, buttons = [], tap = true) => {
  const held = Object.fromEntries(buttons.map((b) => [b, true]));
  for (let i = 0; i < n; i++)
    R.step(s, { held, pressed: tap && i === 0 ? held : {} });
  return s;
};
const room = (id = "forever") => {
  const s = fresh(),
    st = s.stores.find((x) => x.id === id);
  s.returnDoor = { x: st.x + 40, floor: st.floor };
  R.enterStoreNow(s, id);
  s.dialog = 0;
  s.guards = [];
  s.p.inv = 10000;
  s.pose = 0;
  return s;
};
const touch = (s, f) => {
  s.p.x = f.x + 4;
  s.p.y = f.y + f.h - 1;
  s.p.facing = "up";
};
test("PRNG: seeded replay, nonzero default seed, no browser dependencies", () => {
  const a = R.createGame(123),
    b = R.createGame(123);
  assert.deepEqual(a, b);
  for (let i = 0; i < 100; i++) assert.equal(random(a), random(b));
  assert.notEqual(random(a), random(R.createGame(456)));
  assert.ok(R.createGame(0).rng);
});
test("whole simulation replays exactly for same seed and inputs", () => {
  const a = fresh(),
    b = fresh();
  for (let i = 0; i < 1200; i++) {
    const buttons = i % 100 < 50 ? ["left", "a"] : ["right", "b"];
    run(a, 1, buttons);
    run(b, 1, buttons);
  }
  assert.deepEqual(a, b);
});
test("fixed step: 60 Hz, zero first delta, catch-up capped at 5", () => {
  let ticks = 0,
    draws = 0;
  const frame = fixedLoop(
    () => ticks++,
    () => draws++,
  );
  assert.equal(frame(0), 0);
  assert.equal(frame(1000 / 60), 1);
  assert.equal(frame(1000), 5);
  assert.equal(ticks, 6);
  assert.equal(draws, 3);
});
test("printed letters win for QWERTZ/AZERTY; unknown letters fall back to physical", () => {
  assert.equal(mapping("z", "KeyY"), "a");
  assert.equal(mapping("a", "KeyQ"), "left");
  assert.equal(mapping("q", "KeyA"), "left");
  assert.equal(mapping("w", "KeyZ"), "up");
  assert.equal(mapping(" ", "Space"), "b");
  assert.equal(mapping("Z", "KeyW"), "a");
});
test("release uses original physical key identity; two keys can hold one action", () => {
  const i = new Input();
  i.down("z", "KeyY");
  i.down("j", "KeyJ");
  i.up("KeyY");
  assert.equal(i.sample().held.a, true);
  i.up("KeyJ");
  assert.equal(i.sample().held.a, undefined);
});
test("fast press/release/press/release retains both taps over simulation steps", () => {
  const i = new Input();
  i.down("x", "KeyX");
  i.up("KeyX");
  i.down("x", "KeyX");
  i.up("KeyX");
  assert.equal(i.sample().pressed.b, true);
  assert.equal(i.sample().pressed.b, true);
  assert.equal(i.sample().pressed.b, undefined);
});
test("gamepad merging and disconnection cannot leave a held button", () => {
  const i = new Input(),
    pad = {
      buttons: Array.from({ length: 16 }, (_, n) => ({ pressed: n === 0 })),
      axes: [-1, 0],
    };
  i.down("w", "KeyW");
  i.gamepads([pad]);
  let a = i.sample();
  assert.ok(a.held.a && a.held.left && a.held.up);
  i.gamepads([]);
  a = i.sample();
  assert.ok(!a.held.a && !a.held.left && a.held.up);
});
test("Konami code accepts extra leading Ups and only completes exact suffix", () => {
  let h = [],
    result;
  for (const k of ["up", "up", ...KONAMI]) {
    result = konami(h, k);
    h = result.history;
  }
  assert.equal(result.complete, true);
  assert.equal(konami(h, "left").complete, false);
});
test("art pipeline: all required dimensions, all sprites <=3 colours and valid pixels", () => {
  for (const [n, d] of Object.entries(REQUIRED)) {
    assert.ok(SPRITES[n], n);
    assert.deepEqual([SPRITES[n].w, SPRITES[n].h], d);
  }
  for (const [n, s] of Object.entries(SPRITES)) {
    assert.equal(s.pixels.length, s.w * s.h, n);
    assert.ok(s.colors.length <= 3, n);
    assert.ok(
      s.pixels.every((c) => c >= 0 && c <= s.colors.length),
      n,
    );
  }
  for (const g of Object.values(FONT)) assert.equal(g.length, 15);
});
test("room templates: 10 distinct layouts, no overlaps, door and all fixtures reachable", () => {
  const layouts = new Set();
  for (const st of STORES.filter((s) => s.role !== "closed")) {
    const r = template(st.id);
    layouts.add(JSON.stringify(r.fixtures.map((f) => [f.x, f.y])));
    for (const f of r.fixtures) {
      assert.ok(
        f.x >= 16 &&
          f.y >= 16 &&
          f.x + f.w <= r.width - 16 &&
          f.y + f.h < r.height - 20,
      );
      for (const other of r.fixtures)
        if (f !== other) assert.ok(!overlap(f, other));
    }
    const seen = new Set(["120,144"]),
      q = [[120, 144]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
      ]) {
        const xx = x + dx,
          yy = y + dy,
          key = xx + "," + yy;
        if (!seen.has(key) && !R.roomSolid(r, xx, yy)) {
          seen.add(key);
          q.push([xx, yy]);
        }
      }
    }
    for (const f of r.fixtures) {
      assert.ok(
        [...seen].some((k) => {
          const [x, y] = k.split(",").map(Number);
          return overlap({ x: x - 3, y: y - 3, w: 22, h: 23 }, f);
        }),
        `${st.id} fixture ${f.id}`,
      );
    }
  }
  assert.equal(layouts.size, 10);
});
test("setup: six target stores with exactly one package each; power shops never trapped", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = R.createGame(seed);
    assert.equal(s.stores.filter((x) => x.role === "target").length, 6);
    for (const st of s.stores) {
      const fs = st.room.fixtures;
      if (st.role === "target")
        assert.equal(fs.filter((f) => f.content === "package").length, 1);
      if (st.role === "shop")
        assert.ok(fs.every((f) => ["power", "nothing"].includes(f.content)));
    }
  }
});
test("Black Friday: every nonpackage fixture is power; cap/rate double", () => {
  const s = fresh();
  s.blackFriday = true;
  R.setupLevel(s);
  for (const st of s.stores)
    for (const f of st.room.fixtures)
      assert.ok(["package", "power"].includes(f.content));
  assert.equal(R.difficulty(1, true).cap, 8);
  assert.equal(R.difficulty(1, true).spawn, R.difficulty(1).spawn / 2);
});
test("floor graph: all floors reachable; parking only via B", () => {
  const reached = new Set([0]);
  for (let pass = 0; pass < 6; pass++)
    for (const e of SHAFTS)
      if ([...reached].some((f) => f >= e.min && f <= e.max))
        for (let f = e.min; f <= e.max; f++) reached.add(f);
  assert.equal(reached.size, 6);
  assert.deepEqual(
    SHAFTS.filter((e) => e.max === 5).map((e) => e.id),
    ["B"],
  );
  assert.equal(ESCALATORS.length, 2);
});
test("jump peaks about 20px and returns exactly to floor", () => {
  const s = fresh();
  let min = s.p.y;
  run(s, 1, ["b", "right"]);
  for (let i = 0; i < 30; i++) {
    run(s, 1, [], false);
    min = Math.min(min, s.p.y);
  }
  assert.ok(64 - min >= 16 && 64 - min <= 23);
  assert.equal(s.p.y, 64);
  assert.equal(s.p.vy, 0);
});
test("falls: car one floor down is safe; two floors down is fatal", () => {
  for (const [floor, dead] of [
    [1, false],
    [2, true],
  ]) {
    const s = fresh(),
      e = s.elevators[0];
    e.y = FLOOR_Y[floor];
    s.p.x = e.x;
    run(s, 60, [], false);
    assert.equal(s.scene === "death", dead);
    if (!dead) assert.equal(s.p.roof, "A");
  }
});
test("manual elevator glides when released, stops level and dings exactly once", () => {
  const s = fresh(),
    e = s.elevators[0];
  s.p.x = e.x;
  s.p.ride = e.id;
  let dings = 0;
  run(s, 12, ["down"]);
  for (let i = 0; i < 90; i++) {
    run(s, 1, [], false);
    dings += s.events.filter((e) => e.type === "ding").length;
  }
  assert.equal(e.y, 112);
  assert.equal(e.target, null);
  assert.equal(dings, 1);
  e.y = 208;
  s.p.y = 208;
  s.p.floor = 3;
  for (let i = 0; i < 120; i++) {
    run(s, 1, ["down"], false);
    assert.ok(!s.events.some((e) => e.type === "ding"));
  }
});
test("elevator call picks up safely; descending uncalled car crushes", () => {
  for (const called of [true, false]) {
    const s = fresh(),
      e = s.elevators[0];
    s.p.x = e.x;
    s.p.floor = 1;
    s.p.y = 112;
    e.y = 64;
    e.target = 112;
    e.dir = 1;
    if (called) R.callElevator(s, e, 1);
    for (let i = 0; i < 48; i++) R.updateElevators(s, {});
    assert.equal(s.scene === "death", !called);
    if (called) assert.equal(s.p.ride, "A");
  }
});
test("automatic elevator stays occupied and roof crush is fatal at shaft ceiling", () => {
  const s = fresh(),
    e = s.elevators[2];
  s.p.ride = "C";
  e.wait = 1;
  for (let i = 0; i < 200; i++) R.updateElevators(s, {});
  assert.equal(e.y, 64);
  s.p.ride = null;
  s.p.roof = "C";
  R.updateElevators(s, {});
  assert.equal(s.scene, "death");
});
test("empty shaft can be called beside it after 30 idle frames", () => {
  const s = fresh(),
    e = s.elevators[0];
  e.y = 160;
  s.p.x = e.x - 23;
  run(s, 31, [], false);
  assert.equal(e.called, true);
  assert.equal(e.target, 64);
});
test("escalator carries between floors and releases control at landing", () => {
  const s = fresh(),
    e = ESCALATORS[0];
  s.p.x = e.x;
  s.p.floor = e.bottom;
  s.p.y = FLOOR_Y[e.bottom];
  run(s, 1, ["up"]);
  run(s, 48);
  assert.equal(s.p.floor, e.top);
  assert.equal(s.p.y, FLOOR_Y[e.top]);
  assert.equal(s.escalating, null);
});
test("score clamps at zero; extra life awarded once at threshold", () => {
  const s = fresh();
  R.award(s, -500);
  assert.equal(s.score, 0);
  R.award(s, 20000);
  assert.equal(s.lives, 4);
  R.award(s, -1000);
  R.award(s, 1000);
  assert.equal(s.lives, 4);
  assert.equal(s.high, 20000);
});
test("difficulty ramps and caps; first alarm is 150 seconds", () => {
  assert.equal(R.difficulty(1).alarm, 9000);
  assert.ok(R.difficulty(2).shot < R.difficulty(1).shot);
  assert.ok(R.difficulty(2).speed > R.difficulty(1).speed);
  assert.equal(R.difficulty(999).shot, 60);
  assert.ok(R.difficulty(999).alarm >= 3600);
});
test("power weapon replacement, stacking, timer expiry in store and overlay pause", () => {
  const s = room();
  R.power(s, "RAPID FIRE");
  R.power(s, "SPREAD SHOT");
  R.power(s, "ARMOR VEST");
  R.power(s, "RADAR");
  assert.equal(s.p.power.weapon, "spread");
  assert.ok(s.p.power.armor && s.p.power.radar);
  run(s, 30);
  assert.equal(s.p.power.weaponTime, 1170);
  s.overlay = "map";
  run(s, 60);
  assert.equal(s.p.power.weaponTime, 1170);
  s.overlay = null;
  run(s, 1170);
  assert.equal(s.p.power.weapon, undefined);
});
test("armour absorbs one hit; death resets slots except radar and clears freeze", () => {
  const s = fresh();
  R.power(s, "ARMOR VEST");
  R.power(s, "RADAR");
  R.hit(s);
  assert.equal(s.lives, 3);
  assert.ok(!s.p.power.armor);
  s.p.inv = 0;
  s.p.freeze = 100;
  R.hit(s);
  assert.equal(s.lives, 2);
  assert.equal(s.p.freeze, 0);
  assert.equal(s.p.power.radar, true);
  R.respawn(s);
  assert.equal(s.p.inv, 120);
});
test("one tap search completes, opens package, auto-faces at side/gap; held B never chains", () => {
  const s = room(),
    f = s.room.fixtures.find((f) => f.content === "package");
  touch(s, f);
  s.p.facing = "right";
  run(s, 1, ["b"]);
  assert.ok(s.search);
  assert.equal(s.p.facing, "up");
  run(s, 60, ["b"], false);
  assert.equal(s.packages, 1);
  assert.equal(f.opened, true);
  assert.equal(s.room.fixtures.filter((f) => f.opened).length, 1);
});
test("search: held direction does not cancel; fresh different direction and shoot cancel", () => {
  const s = room(),
    f = s.room.fixtures[4];
  touch(s, f);
  R.startSearch(s);
  run(s, 5, ["left"], false);
  assert.ok(s.search);
  run(s, 1, ["right"]);
  assert.equal(s.search, null);
  touch(s, f);
  R.startSearch(s);
  run(s, 1, ["a"]);
  assert.equal(s.search, null);
});
test("fixture opened state persists across reentry; cleared target cannot reenter", () => {
  const s = room(),
    f = s.room.fixtures[4];
  f.content = "nothing";
  R.finishSearch(s, f);
  R.enterStoreNow(s, "forever");
  assert.equal(s.room.fixtures[4].opened, true);
  s.stores.find((st) => st.id === "forever").cleared = true;
  assert.equal(R.enterStore(s, "forever"), false);
});
test("fitting room prank preserves unsearched contents, occurs deterministically", () => {
  let found = false;
  for (let seed = 1; seed < 100 && !found; seed++) {
    const s = room(),
      f = s.room.fixtures[0];
    s.rng = seed * 9999;
    const contents = f.content;
    R.finishSearch(s, f);
    if (f.pranked) {
      found = true;
      assert.equal(f.opened, false);
      assert.equal(f.content, contents);
      assert.equal(s.guards.length, 1);
      assert.equal(s.bullets[0].shoe, true);
    }
  }
  assert.ok(found);
});
test("GameStonk cave freezes input and grants only one useless inventory item", () => {
  const s = room("game");
  run(s, 179, ["up"]);
  assert.equal(s.p.y, 144);
  run(s, 1);
  s.p.x = 120;
  s.p.y = 68;
  run(s, 1);
  assert.equal(s.gameGift, true);
  assert.equal(s.score, 1);
  assert.equal(s.inventory.length, 1);
  R.enterStoreNow(s, "game");
  assert.equal(s.cave, null);
});
test("toy shelf releases three toys that stun nearby guards and trigger traps", () => {
  const s = room("kgb"),
    f = s.room.fixtures[0];
  R.releaseToys(s, f);
  assert.equal(s.toys.length, 3);
  s.guards = [
    { x: f.x, y: f.y + 18, hp: 1, kind: "bot", stun: 0, dir: 1, age: 0 },
  ];
  run(s, 1);
  assert.ok(s.guards[0].stun > 0);
});
test("listening booth changes track only while standing on it", () => {
  const s = room("sam");
  s.p.x = 178;
  s.p.y = 129;
  run(s, 1);
  assert.equal(s.sideB, true);
  s.p.x = 120;
  run(s, 1);
  assert.equal(s.sideB, false);
});
test("wet patch stays away from shafts; slides cannot turn; janitor harmless", () => {
  const s = fresh();
  s.p.floor = 4;
  s.p.y = 256;
  s.p.x = 510;
  s.p.dir = 1;
  s.janitor.timer = 1;
  run(s, 1);
  assert.ok(s.wet);
  assert.ok(!SHAFTS.some((e) => e.x >= s.wet.x && e.x <= s.wet.x + 48));
  const x = s.p.x;
  run(s, 5, ["left"]);
  assert.ok(s.p.x > x);
  assert.equal(s.lives, 3);
});
test("cop detects visible shooting, catches for points/freeze, not life", () => {
  const s = fresh();
  s.p.x = 330;
  s.cop.floor = 0;
  s.cop.x = 360;
  s.cop.dir = -1;
  run(s, 1, ["a"]);
  assert.ok(s.cop.chase > 0);
  s.score = 1000;
  s.cop.x = s.p.x + 1;
  run(s, 1);
  assert.equal(s.p.freeze, 180);
  assert.equal(s.score, 500);
  assert.equal(s.lives, 3);
});
test("kiosk and fountain cooldown; fountain produces 3-5 coins", () => {
  const s = fresh();
  s.p.floor = 1;
  s.p.y = 112;
  s.p.x = 384;
  R.interactMall(s, { up: true });
  assert.equal(s.kiosks[0].cool, 1200);
  assert.ok(s.kioskTarget);
  const f = s.fountains[0];
  R.fountain(s, f, 1);
  assert.ok(s.coins.length >= 3 && s.coins.length <= 5);
  const count = s.coins.length;
  R.fountain(s, f, 1);
  assert.equal(s.coins.length, count);
  assert.equal(f.cool, 900);
});
test("photo booth hides for 5 seconds and grants one strip per game", () => {
  const s = fresh();
  s.p.x = 410;
  s.p.floor = 2;
  s.p.y = 160;
  R.interactMall(s, { up: true });
  assert.equal(s.p.hidden, 300);
  run(s, 300);
  assert.equal(s.photo, true);
  assert.equal(s.inventory.length, 1);
  R.interactMall(s, { up: true });
  run(s, 1, ["right"]);
  assert.equal(s.inventory.length, 1);
});
test("spy first shot >=120 frames, telegraph >=30 frames", () => {
  const s = fresh();
  s.p.x = 100;
  s.p.inv = 10000;
  s.spawnClock = 10000;
  const spy = R.spawnSpy(s, 160, 0);
  run(s, 89);
  assert.equal(spy.aim, 0);
  run(s, 1);
  assert.equal(spy.aim, 1);
  run(s, 29);
  assert.equal(s.bullets.filter((b) => b.owner === "e").length, 0);
  run(s, 1);
  assert.equal(s.bullets.filter((b) => b.owner === "e").length, 1);
});
test("dodge decision occurs once per volley, about ten percent over many spies", () => {
  let dodges = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const s = fresh();
    s.rng = seed * 77777;
    s.p.x = 100;
    s.p.inv = 999;
    s.spawnClock = 999;
    const spy = R.spawnSpy(s, 145, 0);
    s.bullets = [
      { x: 100, y: 48, vx: 4, vy: 0, owner: "p", volley: 1, life: 90 },
    ];
    run(s, 1);
    if (spy.duck) dodges++;
    assert.equal(spy.lastVolley, 1);
  }
  assert.ok(dodges > 65 && dodges < 135, String(dodges));
});
test("exit blocks missing packages, clears once and advances to harder loop", () => {
  const s = fresh();
  assert.equal(R.startClear(s), false);
  s.packages = 6;
  assert.equal(R.startClear(s), true);
  const points = s.score;
  assert.equal(R.startClear(s), false);
  assert.equal(s.score, points);
  run(s, 1, ["start"]);
  assert.equal(s.scene, "paper");
  run(s, 1, ["start"]);
  assert.equal(s.scene, "post");
  run(s, 1, ["start"]);
  assert.equal(s.loop, 2);
  assert.equal(s.scene, "arrival");
});
test("continue keeps score/packages/loop, consumes one continue, refreshes lives", () => {
  const s = fresh();
  s.lives = 1;
  s.score = 1200;
  s.packages = 3;
  s.loop = 2;
  R.hit(s);
  run(s, 75);
  assert.equal(s.scene, "continue");
  run(s, 1, ["start"]);
  assert.equal(s.continues, 2);
  assert.equal(s.lives, 3);
  assert.equal(s.score, 1200);
  assert.equal(s.packages, 3);
  assert.equal(s.loop, 2);
  assert.equal(s.scene, "mall");
});
test("continue timeout and exhausted continues reach game over", () => {
  const s = fresh();
  R.scene(s, "continue");
  run(s, 600);
  assert.equal(s.scene, "gameover");
  run(s, 601);
  assert.equal(s.scene, "title");
  s.scene = "mall";
  s.continues = 0;
  s.lives = 1;
  R.hit(s);
  run(s, 75);
  assert.equal(s.scene, "gameover");
});
test("splash alternate frames, neighbours opposite, settles at 60 and ends 180", () => {
  assert.notEqual(
    splashFrame(0).letters[0].visible,
    splashFrame(0).letters[1].visible,
  );
  assert.notEqual(
    splashFrame(0).letters[0].visible,
    splashFrame(1).letters[0].visible,
  );
  assert.ok(splashFrame(60).letters.every((l) => l.visible));
  assert.equal(splashFrame(60).jingle, true);
  assert.equal(splashFrame(180).done, true);
});
test("all required joke copy obeys its specific on-screen length limits", () => {
  for (const post of [...ARRIVAL, ...COMPLETE]) {
    assert.ok(post.lines.length <= 2);
    for (const line of post.lines) assert.ok(line.length <= 21, line);
    assert.ok(post.comment.length <= 21, post.comment);
  }
  assert.equal(ARRIVAL.length, 10);
  assert.equal(COMPLETE.length, 10);
  for (const line of [
    ...Object.values(VISITS).flat(),
    ...LAST_WORDS,
    ...ELEVATOR_LINES,
    TEXT.occupied,
    TEXT.hey,
    TEXT.cop,
  ])
    assert.ok(line.length <= 28, line);
  for (const line of HEADLINES.flat()) assert.ok(line.length <= 26, line);
  for (const line of PA.flat()) assert.ok(textWidth(line) <= 236, line);
  for (const st of STORES) assert.ok(textWidth(st.name) <= 78, st.name);
});
test("standing and ducked bullets use distinct heights; player bullets travel 4px", () => {
  const s = fresh();
  run(s, 1, ["a"]);
  assert.equal(s.bullets[0].vx, 4);
  assert.equal(s.bullets[0].y, 48);
  s.p.cool = 0;
  run(s, 1, ["down", "a"]);
  assert.equal(s.bullets[1].y, 57);
});
test("mall walkers stop either side bullets, penalize player only, stay alive", () => {
  const s = fresh();
  s.p.floor = 3;
  s.p.y = 208;
  s.p.x = 300;
  s.score = 1000;
  s.bullets = [
    { x: 330, y: 192, vx: 4, vy: 0, owner: "p", volley: 1, life: 90 },
  ];
  run(s, 1);
  assert.equal(s.score, 800);
  assert.equal(s.walkers.length, 2);
  assert.equal(s.bullets.length, 0);
  s.bullets = [{ x: 343, y: 192, vx: -2, vy: 0, owner: "e", life: 90 }];
  run(s, 3);
  assert.equal(s.score, 800);
  assert.equal(s.bullets.length, 0);
});
test("shooting hanging lamp drops and shatters it, darkens area", () => {
  const s = fresh();
  s.p.floor = 1;
  s.p.y = 112;
  s.p.x = 125;
  run(s, 1, ["a"]);
  run(s, 30);
  const l = s.lamps.find((l) => l.x === 148 && l.floor === 1);
  assert.equal(l.mode, "broken");
  assert.ok(l.dark > 0);
});
test("disco rolls in shot direction and environmental kills award 300", () => {
  const s = fresh();
  s.p.floor = 3;
  s.p.y = 208;
  s.p.x = 125;
  s.p.inv = 999;
  const spy = R.spawnSpy(s, 173, 3);
  spy.stun = 999;
  run(s, 1, ["a"]);
  run(s, 35);
  const l = s.lamps.find((l) => l.floor === 3 && l.kind === "disco");
  assert.equal(l.mode, "roll");
  assert.ok(l.x > 148);
  assert.equal(s.score, 300);
});
test("jump kick keeps momentum after release and kills on contact", () => {
  const s = fresh();
  s.p.x = 100;
  R.spawnSpy(s, 120, 0);
  run(s, 1, ["right", "b"]);
  run(s, 12, [], false);
  assert.ok(s.p.x > 110);
  assert.equal(s.score, 100);
});
test("bots take three shots and hitting armour does not consume a life", () => {
  const s = room("radio");
  s.p.x = 180;
  s.p.y = 100;
  s.guards = [
    { x: 200, y: 100, hp: 3, kind: "bot", dir: 1, stun: 999, age: 0 },
  ];
  for (let i = 0; i < 3; i++) {
    s.bullets = [
      { x: 198, y: 108, vx: 4, vy: 0, owner: "p", life: 20, volley: i },
    ];
    run(s, 1);
  }
  assert.ok(s.guards[0].dead);
  assert.equal(s.score, 100);
});
test("all gameplay timers stop in pause/map and continue", () => {
  const s = fresh();
  R.power(s, "RAPID FIRE");
  for (const overlay of ["pause", "map"]) {
    s.overlay = overlay;
    const before = structuredClone({
      elapsed: s.elapsed,
      e: s.elevators,
      p: s.p,
      sp: s.spawnClock,
    });
    run(s, 120);
    assert.deepEqual(
      { elapsed: s.elapsed, e: s.elevators, p: s.p, sp: s.spawnClock },
      before,
    );
  }
  s.overlay = null;
  R.scene(s, "continue");
  const before = s.p.power.weaponTime;
  run(s, 59);
  assert.equal(s.p.power.weaponTime, before);
});
test("respawn invulnerability protects against lingering disco balls, preventing death loops", () => {
  const s = fresh();
  s.p.x = 148;
  s.p.floor = 3;
  s.p.y = 208;
  s.safe = { x: 148, floor: 3 };
  const l = s.lamps.find((l) => l.floor === 3);
  l.mode = "fall";
  l.y = 198;
  l.vy = 2;
  l.vx = -1;
  run(s, 1);
  assert.equal(s.lives, 2);
  run(s, 75);
  assert.equal(s.scene, "mall");
  run(s, 35);
  assert.equal(s.lives, 2);
  assert.equal(s.scene, "mall");
  assert.ok(l.mode === "roll" || l.mode === "broken");
});
test("queued Konami sequence retains chronological order even between same-frame repeated keys", () => {
  const s = R.createGame(7, { debug: true }),
    i = new Input();
  for (const b of ["up", ...KONAMI]) i.queue.push(b);
  for (let n = 0; n < 12; n++) R.step(s, i.sample());
  assert.equal(s.blackFriday, true);
});
test("continuing inside a store restores exact location and opened fixtures", () => {
  const s = room("radio");
  s.lives = 1;
  s.p.inv = 0;
  s.p.x = 120;
  s.p.y = 80;
  s.room.fixtures[0].opened = true;
  R.hit(s);
  run(s, 75);
  run(s, 1, ["start"]);
  assert.equal(s.scene, "store");
  assert.equal(s.storeId, "radio");
  assert.equal(s.p.x, 120);
  assert.equal(s.p.y, 80);
  assert.equal(s.room.fixtures[0].opened, true);
  assert.equal(s.lives, 3);
  assert.equal(s.p.inv, 120);
});
test("spies on a wet patch keep sliding despite trying to turn toward player", () => {
  const s = fresh();
  s.p.x = 480;
  s.p.floor = 4;
  s.p.y = 256;
  s.p.inv = 999;
  s.wet = { x: 490, w: 48, floor: 4, life: 600 };
  s.janitor.timer = 999;
  const spy = R.spawnSpy(s, 510, 4);
  spy.dir = 1;
  run(s, 10);
  assert.equal(spy.x, 520);
  assert.equal(spy.dir, 1);
});
