// Complete a seeded mission using pad inputs only. The driver may read the map
// and fixture contents, but cannot teleport, add lives, or change the clock.
import test from "node:test";
import assert from "node:assert/strict";
import "../src/copy.js";
import "../src/data.js";
import "../splash/studio.js";
import "../src/rules.js";
test("roof to loop two through six stores with ordinary controller inputs", () => {
  const s = Game.newGame(17),
    D = MallData;
  const tick = (buttons = [], press) =>
    Game.step(s, { held: new Set(buttons), press });
  const tap = (b) => tick([b], b);
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function awaitState(condition, advance, budget = 1500) {
    for (let i = 0; i < budget; i++) {
      if (condition()) return;
      advance();
    }
    assert.fail(
      JSON.stringify({
        screen: s.screen,
        p: s.p,
        r: s.r,
        store: s.store,
        pk: s.pk,
        lives: s.lives,
        overlay: s.overlay,
      }),
    );
  }
  const wait = (condition) => awaitState(condition, () => tick());
  function recover() {
    if (s.screen === "death") wait(() => s.screen !== "death");
    if (s.screen === "continue") tap("start");
    assert.ok(s.screen === "mall" || s.screen === "store");
  }
  function walk(x) {
    awaitState(
      () => Math.abs(s.p.x - x) <= 1,
      () => {
        recover();
        const key = s.p.x < x ? "right" : "left";
        tick([key, "a"]);
      },
    );
  }
  function lift(i, to) {
    let c = s.cars[i];
    walk(c.x + 13);
    tap("up");
    wait(() => s.p.ride === i);
    let key = s.p.f < to ? "down" : "up";
    awaitState(
      () => Math.abs(c.y - D.floorY(to)) < 18,
      () => tick([key]),
    );
    wait(() => c.y === c.goal);
    tap("right");
    assert.equal(s.p.f, to);
  }
  function stairs(x) {
    walk(x);
    tap("down");
    wait(() => !s.es);
  }
  function navigate(target) {
    const r = s.r;
    const start = [Math.round(r.x), Math.round(r.y)],
      queue = [start],
      parent = new Map([[start.join(), null]]);
    let goal;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      if (target(x, y)) {
        goal = [x, y];
        break;
      }
      for (const [key, [dx, dy]] of Object.entries(dirs)) {
        const nx = x + dx,
          ny = y + dy,
          id = [nx, ny].join();
        if (!parent.has(id) && !Game.solid(s, nx, ny)) {
          parent.set(id, [[x, y], key]);
          queue.push([nx, ny]);
        }
      }
    }
    assert.ok(goal, "walkable route");
    let keys = [];
    while (parent.get(goal.join())) {
      let [prev, key] = parent.get(goal.join());
      keys.push(key);
      goal = prev;
    }
    for (const key of keys.reverse()) {
      if (s.screen !== "store") break;
      tick([key, "a"]);
    }
  }
  function collect(id) {
    const st = D.stores[id];
    walk(st.x);
    tap("up");
    assert.equal(s.store, id);
    for (let attempt = 0; !s.rooms[id].cleared && attempt < 8; attempt++) {
      recover();
      let f = s.rooms[id].fs.find((f) => f.kind === "package");
      navigate(
        (x, y) =>
          x >= f.x - 8 &&
          x <= f.x + f.w + 8 &&
          y >= f.y - 8 &&
          y <= f.y + f.h + 8,
      );
      if (s.screen !== "store") continue;
      tap("b");
      wait(() => !s.search || s.screen !== "store");
    }
    assert.ok(s.rooms[id].cleared);
    wait(() => !s.hold);
    for (let i = 0; i < 4 && s.screen !== "mall"; i++) {
      recover();
      navigate((x, y) => x === 128 && y >= 173);
    }
    assert.equal(s.screen, "mall");
  }
  tap("a");
  tap("start");
  wait(() => s.screen === "selfie");
  tap("a");
  lift(0, 1);
  collect(0);
  collect(1);
  stairs(240);
  collect(4);
  lift(0, 3);
  collect(7);
  collect(9);
  stairs(240);
  collect(11);
  lift(1, 5);
  walk(D.car);
  tap("up");
  assert.equal(s.screen, "clear");
  tap("start");
  tap("start");
  tap("start");
  assert.equal(s.loop, 2);
});
