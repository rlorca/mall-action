import test from "node:test";
import assert from "node:assert/strict";
import "../src/copy.js";
import "../src/data.js";
import "../src/input.js";
import "../splash/studio.js";
import "../src/art.js";
import "../src/rules.js";
const D = MallData,
  Y = D.floorY;
function fresh(seed = 17, black = false) {
  const s = Game.newGame(seed, true);
  s.black = black;
  Game.start(s);
  s.screen = "mall";
  s.age = 0;
  return s;
}
function step(s, buttons = [], press = buttons[0]) {
  Game.step(s, { held: new Set(buttons), press });
}
function run(s, n, buttons = []) {
  for (let i = 0; i < n; i++)
    Game.step(s, {
      held: new Set(buttons),
      press: i === 0 ? buttons[0] : undefined,
    });
}
function pos(s, x, f) {
  Object.assign(s.p, {
    x,
    f,
    y: Y(f),
    air: false,
    ride: -1,
    roof: -1,
    safe: [x, f],
  });
}
test("simulation clock keeps fractions and caps six updates after stalls", () => {
  let clock = Controls.clock(),
    n = 0;
  for (const ms of [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 100])
    clock(ms, () => n++);
  assert.equal(n, 6);
  assert.equal(
    clock(20100, () => n++),
    6,
  );
});
test("printed letters beat position, physical fallback, exact release and buffered taps", () => {
  assert.equal(Controls.map("z", "KeyY"), "a");
  assert.equal(Controls.map("a", "KeyQ"), "left");
  assert.equal(Controls.map("q", "KeyA"), "left");
  assert.equal(Controls.map(" ", "Space"), "b");
  let p = new Controls.Pad();
  for (const id of ["KeyY", "KeyY"]) {
    p.down(id, "a");
    p.up(id);
  }
  assert.deepEqual([p.read().press, p.read().press], ["a", "a"]);
  p.down("KeyJ", "a");
  p.down("KeyY", "a");
  p.up("KeyY");
  assert.ok(p.read().held.has("a"));
  p.up("KeyJ");
  assert.equal(p.read().held.size, 0);
  p.gamepads([{ index: 0, axes: [1, 0], buttons: [] }]);
  assert.ok(p.read().held.has("right"));
  p.gamepads([]);
  assert.equal(p.read().held.size, 0);
});
test("seed replay, template bounds, unique layouts, contents and Black Friday", () => {
  let a = fresh(),
    b = fresh();
  for (let i = 0; i < 50; i++) assert.equal(Game.rand(a), Game.rand(b));
  assert.equal(
    new Set(
      D.stores
        .filter((s) => s.layout.length)
        .map((s) => JSON.stringify(s.layout)),
    ).size,
    10,
  );
  for (const black of [false, true])
    for (let seed = 0; seed < 32; seed++) {
      let s = fresh(seed, black);
      for (let st of D.stores) {
        let fs = s.rooms[st.id].fs;
        assert.equal(
          fs.filter((f) => f.kind === "package").length,
          +(st.role === "T"),
        );
        for (const f of fs) {
          assert.ok(f.x > 0 && f.x + f.w < 256 && f.y > 16 && f.y + f.h < 160);
          if (st.role === "U") assert.ok(["power", "empty"].includes(f.kind));
          if (black) assert.ok(["package", "power"].includes(f.kind));
        }
      }
    }
});
test("authored pixel sprites, animation frames and 3 ink limit", () => {
  for (const person of [
    "agent",
    "spy",
    "cop",
    "janitor",
    "walker",
    "bot",
    "clerk",
  ])
    for (const pose of [
      "walk",
      "aim",
      "duck",
      "kick",
      "zip",
      "front",
      "back",
      "hold",
      "dead",
    ]) {
      const sp = Art.sprites[person + "_" + pose];
      assert.equal(sp.w, 16);
      assert.equal(sp.h, ["front", "back", "hold"].includes(pose) ? 16 : 24);
    }
  for (const key of Art.displays.flat()) assert.ok(Art.sprites[key]);
  for (let s of Object.values(Art.sprites)) {
    assert.ok(s.colors.every((c) => Art.palette[c]));
    for (let frame of s.frames) {
      assert.equal(frame.length, s.h);
      assert.ok(
        frame.every((row) => row.length === s.w && /^[0-3]+$/.test(row)),
      );
      assert.ok(frame.some((row) => /[123]/.test(row)));
    }
  }
});
test("splash phases, skipping, title code tolerates leading ups", () => {
  assert.notEqual(Flickersoft.visible(33, 0), Flickersoft.visible(33, 1));
  assert.ok(Flickersoft.visible(60, 1));
  let s = Game.newGame(1);
  step(s, ["b"]);
  assert.equal(s.screen, "title");
  for (let k of [
    "up",
    "up",
    "up",
    "down",
    "down",
    "left",
    "right",
    "left",
    "right",
    "b",
    "a",
  ])
    step(s, [k]);
  assert.ok(s.black);
  step(s, ["start"]);
  run(s, 100);
  assert.equal(s.screen, "selfie");
  step(s, ["a"]);
  assert.equal(s.screen, "mall");
});
test("jump arc and moving kick, two-bullet cap and 4 px travel", () => {
  let s = fresh();
  pos(s, 110, 1);
  step(s, ["b", "right"]);
  assert.ok(s.p.kick);
  let min = s.p.y;
  for (let i = 0; i < 35; i++) {
    step(s);
    min = Math.min(min, s.p.y);
  }
  assert.ok(Y(1) - min >= 19 && Y(1) - min < 25);
  assert.equal(s.p.y, Y(1));
  step(s, ["a"]);
  let x = s.shots[0].x;
  step(s);
  assert.equal(s.shots[0].x - x, 4);
  run(s, 50, ["a"]);
  assert.ok(s.shots.length <= 2);
});
test("shaft graph reaches all floors and B uniquely serves parking", () => {
  let floors = new Set([0]);
  for (let i = 0; i < 6; i++)
    for (let [, a, b] of D.shafts)
      if ([...floors].some((f) => f >= a && f <= b))
        for (let f = a; f <= b; f++) floors.add(f);
  assert.equal(floors.size, 6);
  assert.equal(D.shafts.filter((c) => c[2] === 5).length, 1);
});
test("released lift glides to aligned stop, dings once, no repeat at terminal", () => {
  let s = fresh();
  pos(s, 66, 0);
  step(s, ["down"]);
  run(s, 9, ["down"]);
  let n = 0;
  for (let i = 0; i < 100; i++) {
    step(s);
    n += s.events.filter((e) => e === "ding").length;
  }
  assert.equal(s.p.y, Y(1));
  assert.equal(n, 1);
  run(s, 110, ["down"]);
  assert.equal(s.p.f, 3);
  run(s, 10, ["down"]);
  assert.ok(!s.events.includes("ding"));
  step(s, ["right"]);
  assert.equal(s.p.ride, -1);
});
test("call protects passenger, auto-call after waiting, auto car waits for occupant", () => {
  let s = fresh();
  pos(s, 66, 1);
  run(s, 90);
  assert.equal(s.p.ride, 0);
  assert.equal(s.lives, 3);
  pos(s, 600, 0);
  s.p.ride = 2;
  run(s, 180);
  assert.equal(s.cars[2].y, Y(0));
  pos(s, 66, 2);
  step(s, ["up"]);
  run(s, 49);
  assert.equal(s.p.ride, 0);
});
test("descending car crushes waiting spy and agent, roof crushes at top", () => {
  let s = fresh();
  pos(s, 66, 1);
  let c = s.cars[0];
  c.y = Y(1) - 1;
  c.goal = Y(1);
  Game.spy(s, 66, 1);
  Game.mechanism(s);
  assert.equal(s.lives, 2);
  assert.equal(s.score, 300);
  s = fresh();
  s.p.roof = 0;
  s.cars[0].y = Y(0) + 16;
  Game.mechanism(s);
  assert.equal(s.screen, "death");
});
test("pit one floor down permits roof landing, deeper pit is fatal", () => {
  for (let f of [1, 2]) {
    let s = fresh();
    pos(s, 66, 0);
    s.cars[0].y = s.cars[0].goal = Y(f);
    run(s, 28);
    assert.equal(s.lives, f === 1 ? 3 : 2);
    if (f === 1) assert.equal(s.p.roof, 0);
  }
});
test("slots stack, replacement, score milestone once, store/pause timers, death radar", () => {
  let s = fresh();
  for (let n of [0, 1, 2, 3, 4]) Game.power(s, n);
  assert.equal(s.power.weapon, "SPREAD SHOT");
  assert.equal(s.power.gun, 1200);
  assert.ok(s.power.armor && s.power.radar);
  Game.points(s, 20000);
  Game.points(s, -500);
  Game.points(s, 500);
  assert.equal(s.lives, 4);
  Game.enter(s, 0);
  step(s);
  assert.equal(s.power.speed, 1199);
  step(s, ["select"]);
  let time = s.elapsed;
  run(s, 80);
  assert.equal(s.elapsed, time);
  step(s, ["select"]);
  Game.dead(s);
  s.p.inv = 0;
  Game.dead(s);
  assert.ok(!s.power.armor);
  s.p.inv = 0;
  Game.dead(s);
  assert.equal(s.screen, "death");
  assert.ok(s.power.radar);
  assert.equal(s.power.speed, 0);
});
test("difficulty caps, 10% dodge sampler, first shot and 30 frame tell", () => {
  let s = fresh();
  let d = Game.difficulty(s);
  s.loop = 30;
  assert.equal(Game.difficulty(s).shot, 60);
  assert.ok(Game.difficulty(s).speed > d.speed);
  s = fresh();
  pos(s, 150, 1);
  let e = Game.spy(s, 190, 1);
  run(s, 119);
  assert.equal(e.aim, 0);
  assert.equal(s.shots.length, 0);
  step(s);
  assert.equal(e.aim, 30);
  run(s, 29);
  assert.equal(s.shots.length, 0);
  step(s);
  assert.ok(s.shots.some((b) => b.enemy));
  let count = 0;
  for (let i = 0; i < 1000; i++) {
    s.shots = [{ x: e.x - 24, y: Y(1) - 16, dx: 4, dy: 0, t: 2, id: 1000 + i }];
    e.duck = 0;
    e.cd = 500;
    e.aim = 0;
    step(s);
    if (e.duck) count++;
  }
  assert.ok(count > 65 && count < 135, count);
});
test("wet patch locks motion, misses shafts; walker blocks shots, cop detains", () => {
  let s = fresh();
  pos(s, 310, 4);
  s.wet = 600;
  s.patch = 310;
  step(s, ["right"]);
  let x = s.p.x;
  step(s, ["left"]);
  assert.ok(s.p.x > x);
  for (let c of s.cars) assert.ok(Math.abs(c.x - s.patch) > 30);
  pos(s, 250, 3);
  s.score = 1000;
  s.shots = [{ x: s.walk[0] - 4, y: Y(3) - 14, dx: 4, dy: 0, t: 20 }];
  step(s);
  assert.equal(s.score, 800);
  pos(s, 330, 2);
  Object.assign(s.cop, { x: 340, f: 2, dir: -1 });
  step(s, ["a"]);
  assert.ok(s.cop.chase > 0);
  run(s, 6);
  assert.equal(s.p.freeze > 0, true);
  assert.equal(s.score, 300);
  assert.equal(s.lives, 3);
});
test("kiosk, photo booth inventory, fountain spray and cooldown", () => {
  let s = fresh();
  pos(s, D.kiosk, 1);
  step(s, ["up"]);
  assert.equal(s.kioskCD, 1200);
  assert.ok(s.hint >= 0);
  pos(s, D.booth, 2);
  step(s, ["up"]);
  assert.equal(s.p.hide, 300);
  run(s, 300);
  assert.ok(s.photo);
  pos(s, 103, 2);
  s.p.dir = -1;
  run(s, 4, ["a"]);
  assert.ok(s.drops.length >= 3 && s.drops.length <= 5);
  assert.ok(s.fountainCD[2] > 890);
});
test("escalator moves between landings, overhead lamp and rolling ball", () => {
  let s = fresh();
  pos(s, 240, 1);
  step(s, ["down"]);
  run(s, 48);
  assert.deepEqual([s.p.x, s.p.f], [272, 2]);
  step(s, ["up"]);
  run(s, 48);
  assert.equal(s.p.f, 1);
  for (let f of [1, 3]) {
    pos(s, 172, f);
    s.p.dir = 1;
    run(s, 25, ["a"]);
    assert.equal(
      s.lamps.find((l) => l.f === f && l.origin === 205).mode,
      f === 3 ? "roll" : "gone",
    );
  }
});
test("single tap side search, fresh movement cancels, opened state survives re-entry", () => {
  let s = fresh();
  Game.enter(s, 2);
  let f = s.rooms[2].fs[0];
  s.r.x = f.x - 7;
  s.r.y = f.y + 7;
  step(s, ["b"]);
  assert.equal(s.r.dx, 1);
  assert.ok(s.search);
  step(s, ["up"]);
  assert.equal(s.search, null);
  step(s, ["b"]);
  run(s, 46);
  assert.ok(f.opened);
  Game.leave(s);
  Game.enter(s, 2);
  assert.ok(s.rooms[2].fs[0].opened);
  assert.equal(s.intro, 0);
});
test("six target searches, one-time clear and harder next loop", () => {
  let s = fresh();
  pos(s, D.car, 5);
  step(s, ["up"]);
  assert.equal(s.banner, "PACKAGES LEFT: 6");
  for (let st of D.stores.filter((st) => st.role === "T")) {
    Game.enter(s, st.id);
    let f = s.rooms[st.id].fs.find((f) => f.kind === "package");
    s.r.x = f.x + 10;
    s.r.y = f.y + f.h + 7;
    step(s, ["b"]);
    run(s, 46);
    if (!f.opened) {
      step(s, ["b"]);
      run(s, 46);
    }
    assert.ok(f.opened);
    Game.leave(s);
    Game.enter(s, st.id);
    assert.equal(s.screen, "mall");
  }
  assert.equal(s.pk, 6);
  pos(s, D.car, 5);
  step(s, ["up"]);
  let score = s.score;
  Game.clearLevel(s);
  assert.equal(score, s.score);
  assert.equal(s.screen, "clear");
  for (const name of ["paper", "winpost", "arrival"]) {
    step(s, ["start"]);
    assert.equal(s.screen, name);
  }
  assert.equal(s.loop, 2);
  assert.equal(s.pk, 0);
});
test("three continues keep progress, reset powers, countdown and game over", () => {
  let s = fresh();
  s.pk = 3;
  s.score = 77;
  for (let i = 3; i >= 0; i--) {
    s.lives = 1;
    s.p.inv = 0;
    Game.dead(s);
    run(s, 50);
    if (i) {
      assert.equal(s.screen, "continue");
      assert.equal(s.continues, i);
      step(s, ["start"]);
      assert.equal(s.lives, 3);
      assert.equal(s.pk, 3);
      assert.equal(s.score, 77);
    } else assert.equal(s.screen, "over");
  }
  run(s, 331);
  assert.equal(s.screen, "title");
  assert.equal(s.hi, 77);
});
test("GameStonk freezes for text, grants one joke point, recording booth switches music", () => {
  let s = fresh();
  Game.enter(s, 3);
  run(s, 100, ["up"]);
  assert.equal(s.r.y, 158);
  run(s, 24);
  s.r.x = 128;
  s.r.y = 70;
  step(s);
  assert.equal(s.score, 1);
  assert.equal(s.inventory.length, 1);
  Game.leave(s);
  Game.enter(s, 3);
  assert.ok(!s.cave);
  Game.leave(s);
  Game.enter(s, 7);
  s.r.x = 128;
  s.r.y = 92;
  step(s);
  assert.ok(s.sideB);
});
test("occupied fitting room keeps loot, toy shelves release three marching toys", () => {
  let s = fresh();
  Game.enter(s, 0);
  s.seed = 1;
  let f = s.rooms[0].fs[0];
  Game.reveal(s, f);
  assert.equal(f.opened, false);
  assert.equal(s.banner, "OCCUPIED!!");
  assert.ok(s.shots.some((b) => b.shoe));
  Game.leave(s);
  Game.enter(s, 4);
  s.intro = 0;
  f = s.rooms[4].fs[0];
  s.r.x = f.x - 15;
  s.r.y = f.y + 7;
  s.r.dx = 1;
  s.r.dy = 0;
  run(s, 3, ["a"]);
  assert.equal(s.toys.length, 3);
  assert.ok(f.toys);
});
test("copy bounds and complete sets", () => {
  assert.equal(Copy.arrival.length, 10);
  assert.equal(Copy.complete.length, 10);
  for (let post of [...Copy.arrival, ...Copy.complete]) {
    assert.equal(post.length, 3);
    for (let line of post) assert.ok(line.length <= 21, line);
  }
  for (let line of [...Copy.visits.flat(), ...Copy.lift, ...Copy.last])
    assert.ok(line.length <= 28, line);
  for (let line of Copy.headlines.flat()) assert.ok(line.length <= 26, line);
  for (let st of D.stores) assert.ok(st.name.length * 4 <= 78);
});

test("food, timed weapons and armor have independent lifetimes", () => {
  const s = fresh();
  Game.power(s, 6);
  Game.power(s, 7);
  Game.power(s, 8);
  Game.power(s, 0);
  Game.dead(s);
  assert.equal(s.lives, 3);
  assert.ok(s.power.armor);
  Game.enter(s, 2);
  s.guards = [];
  run(s, 360);
  assert.equal(s.power.food, 0);
  assert.equal(s.power.speed, 360);
  assert.equal(s.power.gun, 840);
  Game.dead(s);
  assert.equal(s.power.armor, false);
  assert.equal(s.lives, 3);
  const previous = s.lives;
  Game.power(s, 5);
  assert.equal(s.lives, previous + 1);
});

test("independent PA selections, alarm scaling and map freezes the clock", () => {
  const s = fresh();
  s.elapsed = 3599;
  step(s);
  const first = s.banner;
  assert.ok(Copy.pa.includes(first));
  s.elapsed = 7199;
  step(s);
  assert.notEqual(s.banner, first);
  s.elapsed = 8999;
  step(s, ["select"]);
  run(s, 240);
  assert.equal(s.elapsed, 8999);
  step(s, ["select"]);
  step(s);
  assert.ok(s.alarm);
  assert.equal(s.banner, Copy.ui.alarmSecurityAlerted);
  s.loop = 2;
  assert.equal(Game.difficulty(s).alarm, 7800);
});

test("three-way volleys, bots survive two hits, fresh shots cancel a search", () => {
  const s = fresh();
  Game.enter(s, 1);
  s.intro = 0;
  const bot = s.guards.find((g) => g.bot);
  Object.assign(bot, { x: 160, y: 90, stun: 180 });
  s.guards = [bot];
  Object.assign(s.r, { x: 135, y: 90, dx: 1, dy: 0 });
  for (let i = 0; i < 3; i++) {
    step(s, ["a"]);
    run(s, 16);
    assert.equal(bot.hp, 2 - i);
  }
  Game.power(s, 1);
  step(s, ["a"]);
  assert.equal(s.shots.length, 3);
  assert.equal(new Set(s.shots.map((b) => b.dy)).size, 3);
  const f = s.rooms[1].fs[0];
  s.r.x = f.x - 7;
  s.r.y = f.y + 6;
  step(s, ["b"]);
  assert.ok(s.search);
  step(s, ["a"]);
  assert.equal(s.search, null);
});

test("wind-up toys spring traps once and stun nearby guards", () => {
  const s = fresh();
  Game.enter(s, 4);
  s.intro = 0;
  const f = s.rooms[4].fs[0];
  f.kind = "trap";
  const x = f.x - 8,
    y = f.y + 5;
  s.toys = [{ x, y, dx: 1, dy: 0, t: 60 }];
  const g = s.guards[0];
  Object.assign(g, { x: x - 8, y: y + 4, stun: 0 });
  step(s);
  assert.ok(f.opened);
  assert.ok(g.stun > 100);
});

test("room collision and the exit follow room dimensions", () => {
  const s = fresh();
  s.rooms[2].w = 480;
  s.rooms[2].h = 320;
  Game.enter(s, 2);
  assert.equal(s.r.x, 240);
  assert.ok(Game.solid(s, 3, 100));
  assert.ok(Game.solid(s, 220, 316));
  assert.equal(Game.solid(s, 240, 316), false);
  run(s, 20, ["down"]);
  assert.equal(s.screen, "mall");
});

test("continue expiry, splash jingle and countdown beep cadence", () => {
  const s = Game.newGame();
  run(s, 60);
  assert.deepEqual(s.events, ["studio"]);
  run(s, 120);
  assert.equal(s.screen, "title");
  const game = fresh();
  game.lives = 1;
  Game.dead(game);
  run(game, 50);
  let beeps = 0;
  for (let i = 0; i < 600; i++) {
    step(game);
    beeps += game.events.filter((e) => e === "ding").length;
  }
  assert.equal(beeps, 9);
  assert.equal(game.screen, "over");
});
