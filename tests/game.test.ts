import { describe, it, expect } from "vitest";
import {
  createGame,
  step,
  actor,
  score,
  grant,
  hurt,
  enterStore,
  leaveStore,
  exit,
  makeSpy,
  killSpy,
  updateLifts,
  callLift,
  startSearch,
  finishSearch,
  roomMove,
  updateNPCs,
  type Game,
} from "../src/game";
import {
  stores,
  floorY,
  shaftDefs,
  escalators,
  difficulty,
  powers,
} from "../src/data";
import { konami } from "../src/core";
function live(seed = 42) {
  const g = createGame(seed, true);
  g.scene = "mall";
  g.player = actor(82, 1);
  g.sceneFrame = 300;
  g.spawn = 99999;
  return g;
}
function frames(g: Game, n: number, h = {}) {
  for (let i = 0; i < n; i++) step(g, h);
}
function room(id = 0, seed = 42) {
  const g = live(seed);
  enterStore(g, id);
  g.firstVisit = 0;
  g.egg = 0;
  g.spies = [];
  return g;
}
describe("world setup", () => {
  it("makes exactly six packages, one per target and none elsewhere", () => {
    for (let seed = 1; seed < 20; seed++) {
      const g = createGame(seed);
      let n = 0;
      stores.forEach((s) => {
        const found = g.rooms[s.id].fixtures.filter(
          (f) => f.content === "package",
        ).length;
        expect(found).toBe(s.role === "target" ? 1 : 0);
        n += found;
        if (s.role === "shop")
          expect(
            g.rooms[s.id].fixtures.every((f) =>
              ["power", "nothing"].includes(f.content),
            ),
          ).toBe(true);
      });
      expect(n).toBe(6);
    }
  });
  it("makes Black Friday non-package fixtures power-ups", () => {
    const g = createGame(7, true);
    for (const b of ["up", ...konami]) step(g, {}, { [b]: true });
    expect(g.black).toBe(true);
    step(g, {}, { start: true });
    expect(
      g.rooms
        .flatMap((r) => r.fixtures)
        .every((f) => f.content === "package" || f.content === "power"),
    ).toBe(true);
  });
  it("has valid rooms with reachable corridors and exit", () => {
    for (const s of stores.filter((s) => s.role !== "closed")) {
      const r = createGame(1).rooms[s.id];
      for (const f of r.fixtures) {
        expect(f.x).toBeGreaterThanOrEqual(16);
        expect(f.y).toBeGreaterThanOrEqual(16);
        expect(f.x + f.w).toBeLessThan(r.w - 16);
        expect(f.y + f.h).toBeLessThan(r.h - 24);
      }
      const p = actor(128);
      p.y = 154;
      roomMove(r, p, 0, -1);
      expect(p.y).toBe(153);
    }
  });
  it("connects every floor, with shaft B the only route to parking", () => {
    const edges = shaftDefs
      .flatMap((s) =>
        Array.from({ length: s.max - s.min }, (_, i) => [
          s.min + i,
          s.min + i + 1,
        ]),
      )
      .concat(escalators.map((e) => [e.top, e.bottom]));
    const seen = new Set([0]);
    for (let i = 0; i < 6; i++)
      for (const [a, b] of edges) {
        if (seen.has(a)) seen.add(b);
        if (seen.has(b)) seen.add(a);
      }
    expect(seen.size).toBe(6);
    expect(shaftDefs.filter((s) => s.max === 5).map((s) => s.id)).toEqual([
      "B",
    ]);
  });
  it("replays identical simulations", () => {
    const a = live(111),
      b = live(111);
    for (let i = 0; i < 800; i++) {
      const h = i % 90 < 30 ? { right: true } : { left: true };
      step(a, h, i % 70 === 0 ? { a: true } : {});
      step(b, h, i % 70 === 0 ? { a: true } : {});
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
describe("physics and combat", () => {
  it("walks one pixel and jumps about twenty pixels before landing", () => {
    const g = live();
    step(g, { right: true });
    expect(g.player.x).toBe(83);
    const y = g.player.y;
    step(g, { right: true }, { b: true });
    let apex = y;
    for (let i = 0; i < 40; i++) {
      step(g);
      apex = Math.min(apex, g.player.y);
    }
    expect(y - apex).toBeGreaterThan(16);
    expect(y - apex).toBeLessThan(24);
    expect(g.player.y).toBe(y);
    expect(g.player.ground).toBe(true);
  });
  it("jump-kicks spies and scores a kill", () => {
    const g = live();
    g.player.kick = true;
    g.player.ground = false;
    g.player.vy = -1;
    g.spies = [makeSpy(g, g.player.x, 1)];
    step(g);
    expect(g.score).toBe(100);
    expect(g.lives).toBe(3);
  });
  it("safe falls land on a car one floor down; deeper pits kill", () => {
    const g = live();
    g.player = actor(174, 1);
    g.lifts[0].y = floorY(2);
    step(g);
    expect(g.player.roof).toBe(0);
    expect(g.lives).toBe(3);
    g.player = actor(174, 0);
    g.lifts[0].y = floorY(3);
    step(g);
    expect(g.lives).toBe(2);
  });
  it("keeps player bullets fast, capped and on cooldown", () => {
    const g = live();
    step(g, {}, { a: true });
    expect(g.bullets[0].vx).toBe(4);
    step(g, {}, { a: true });
    expect(g.bullets.length).toBe(1);
    frames(g, 15);
    step(g, {}, { a: true });
    expect(g.bullets.filter((b) => !b.enemy).length).toBeLessThanOrEqual(2);
  });
  it("armour absorbs one hit; death clears enemies and preserves Radar", () => {
    const g = live();
    grant(g, "ARMOR VEST");
    hurt(g);
    expect(g.lives).toBe(3);
    expect(g.armor).toBe(false);
    g.player.inv = 0;
    grant(g, "RADAR");
    grant(g, "RAPID FIRE");
    g.spies = [makeSpy(g, 100, 1)];
    hurt(g);
    expect(g.lives).toBe(2);
    expect(g.radar).toBe(true);
    expect(g.weapon).toBeNull();
    expect(g.spies).toHaveLength(0);
    frames(g, 45);
    expect(g.player.inv).toBe(120);
  });
  it("awards twenty-thousand-point extra life exactly once", () => {
    const g = live();
    score(g, 20000);
    expect(g.lives).toBe(4);
    score(g, 20000);
    expect(g.lives).toBe(4);
    score(g, -90000);
    expect(g.score).toBe(0);
  });
  it("difficulty increases and stays capped", () => {
    expect(difficulty(2).speed).toBeGreaterThan(difficulty(1).speed);
    expect(difficulty(2).spawn).toBeLessThan(difficulty(1).spawn);
    expect(difficulty(99)).toMatchObject({
      speed: 1.8,
      spawn: 70,
      shot: 60,
      alarm: 2700,
    });
    expect(difficulty(1, true).cap).toBe(8);
  });
});
describe("elevators", () => {
  it("glides to an exact floor after release and dings once", () => {
    const g = live();
    g.player = actor(174, 0);
    g.player.lift = 0;
    for (let i = 0; i < 17; i++) updateLifts(g, { down: true });
    expect(g.lifts[0].y).toBe(65);
    let dings = 0;
    for (let i = 0; i < 100; i++) {
      g.events = [];
      updateLifts(g, {});
      dings += g.events.filter((e) => e === "ding").length;
    }
    expect(g.lifts[0].y).toBe(floorY(1));
    expect(dings).toBe(1);
  });
  it("does not ding repeatedly while held at the shaft end", () => {
    const g = live();
    g.player = actor(174, 3);
    g.player.lift = 0;
    g.lifts[0].y = floorY(3);
    for (let i = 0; i < 120; i++) updateLifts(g, { down: true });
    expect(g.events.filter((e) => e === "ding")).toHaveLength(0);
  });
  it("calls to pick up the waiting player without crushing", () => {
    const g = live();
    g.player = actor(174, 1);
    callLift(g, 0, 1);
    for (let i = 0; i < 48; i++) updateLifts(g, {});
    expect(g.player.lift).toBe(0);
    expect(g.lives).toBe(3);
    expect(g.lifts[0].called).toBeNull();
  });
  it("automatic car waits for its occupant", () => {
    const g = live();
    g.player = actor(374, 0);
    g.player.lift = 2;
    for (let i = 0; i < 400; i++) updateLifts(g, {});
    expect(g.lifts[2].y).toBe(floorY(0));
  });
  it("crushes a spy on a grate for three hundred points", () => {
    const g = live();
    g.player.x = 82;
    const l = g.lifts[0];
    l.y = floorY(1) - 1;
    l.target = 1;
    l.dir = 1;
    g.spies = [makeSpy(g, l.x, 1)];
    updateLifts(g, {});
    expect(g.score).toBe(300);
    expect(g.spies[0].dead).toBe(24);
  });
  it("rising into the shaft top crushes roof riders", () => {
    const g = live();
    g.player = actor(174, 0);
    g.player.roof = 0;
    updateLifts(g, {});
    expect(g.lives).toBe(2);
  });
  it("manual cars can be called beside the opening", () => {
    const g = live();
    g.player = actor(154, 1);
    step(g, { up: true }, { up: true });
    expect(g.lifts[0].called).toBe(1);
  });
});
describe("additional traversal regressions", () => {
  it("escalators animate and arrive at the correct landing", () => {
    const g = live();
    g.player = actor(700, 2);
    step(g, { up: true }, { up: true });
    expect(g.transit).not.toBeNull();
    frames(g, 24);
    expect(g.player.y).toBeGreaterThan(floorY(1));
    expect(g.player.y).toBeLessThan(floorY(2));
    frames(g, 24);
    expect(g.transit).toBeNull();
    expect(g.player.floor).toBe(1);
    expect(g.player.ground).toBe(true);
  });
  it("waiting beside an absent elevator calls it after thirty frames", () => {
    const g = live();
    g.player = actor(154, 1);
    frames(g, 30);
    expect(g.lifts[0].called).toBe(1);
  });
  it("a player who leaves a called opening is not teleported into the car", () => {
    const g = live();
    g.player = actor(100, 1);
    callLift(g, 0, 1);
    for (let i = 0; i < 48; i++) updateLifts(g, {});
    expect(g.player.lift).toBe(-1);
    expect(g.player.x).toBe(100);
  });
});
describe("power slots and pause", () => {
  it("replaces weapon and speed slots while stacking armour and Radar", () => {
    const g = live();
    grant(g, "RAPID FIRE");
    grant(g, "SPREAD SHOT");
    grant(g, "SNEAKERS");
    grant(g, "ORANGE JULI-OOZE");
    grant(g, "ARMOR VEST");
    grant(g, "RADAR");
    expect(g.weapon).toBe("SPREAD SHOT");
    expect(g.speed).toBe("ORANGE JULI-OOZE");
    expect(g.speedTime).toBe(720);
    expect(g.armor && g.radar).toBe(true);
  });
  it("ticks inside stores and pauses in map, pause and continue", () => {
    const g = room();
    grant(g, "RAPID FIRE");
    frames(g, 30);
    expect(g.weaponTime).toBe(1170);
    step(g, {}, { select: true });
    const t = g.time;
    frames(g, 100);
    expect(g.time).toBe(t);
    expect(g.weaponTime).toBe(1170);
    step(g, {}, { select: true });
    step(g, {}, { start: true });
    frames(g, 30);
    expect(g.weaponTime).toBe(1170);
    g.overlay = null;
    g.scene = "continue";
    frames(g, 60);
    expect(g.weaponTime).toBe(1170);
  });
  it("Cinnabomb kills on contact and expires", () => {
    const g = live();
    grant(g, "CINNABOMB");
    g.spies = [makeSpy(g, g.player.x, 1)];
    step(g);
    expect(g.score).toBe(150);
    expect(g.lives).toBe(3);
    frames(g, 359);
    expect(g.food).toBe(0);
  });
});
describe("searching and stores", () => {
  it("one tap searches an adjacent side fixture and faces it", () => {
    const g = room();
    const f = g.rooms[0].fixtures[0];
    f.content = "nothing";
    g.player.x = f.x + f.w + 7;
    g.player.y = f.y + 12;
    step(g, {}, { b: true });
    expect(g.search?.fixture).toBe(f.id);
    expect(g.player.face).toBe(3);
    frames(g, 45);
    expect(f.open).toBe(true);
    expect(g.search).toBeNull();
  });
  it("touching at a gap is forgiving and holding B cannot chain searches", () => {
    const g = room();
    const f = g.rooms[0].fixtures[0];
    f.content = "nothing";
    g.player.x = f.x + f.w + 9;
    g.player.y = f.y + f.h + 5;
    step(g, { b: true }, { b: true });
    expect(g.search).not.toBeNull();
    frames(g, 90, { b: true });
    expect(g.rooms[0].fixtures.filter((f) => f.open)).toHaveLength(1);
  });
  it("only a fresh differing direction or a shot cancels", () => {
    const g = room();
    const f = g.rooms[0].fixtures[0];
    g.player.x = f.x + f.w + 7;
    g.player.y = f.y + 12;
    startSearch(g);
    step(g, { right: true });
    expect(g.search).not.toBeNull();
    step(g, { right: true }, { right: true });
    expect(g.search).toBeNull();
    startSearch(g);
    step(g, {}, { a: true });
    expect(g.search).toBeNull();
  });
  it("keeps opened fixtures when leaving and returning", () => {
    const g = room();
    g.rooms[0].fixtures[0].open = true;
    leaveStore(g);
    enterStore(g, 0);
    expect(g.rooms[0].fixtures[0].open).toBe(true);
    expect(g.firstVisit).toBe(0);
  });
  it("collects a package, marks store cleared, and prevents re-entry", () => {
    const g = room();
    const f = g.rooms[0].fixtures.find((f) => f.content === "package")!;
    finishSearch(g, f);
    expect(g.packages).toBe(1);
    expect(g.score).toBe(500);
    leaveStore(g);
    enterStore(g, 0);
    expect(g.scene).toBe("mall");
    expect(g.store).toBe(-1);
  });
  it("traps stun and power-up shops are safe", () => {
    const g = room();
    const f = g.rooms[0].fixtures[0];
    f.content = "trap";
    finishSearch(g, f);
    expect(g.player.stun).toBe(60);
    expect(g.banner).toBe("IT'S A TRAP!");
    expect(
      createGame(4).rooms[2].fixtures.some((f) => f.content === "trap"),
    ).toBe(false);
  });
  it("provides camera-sized room collision with corner assistance", () => {
    const g = room();
    const r = g.rooms[0],
      p = g.player;
    p.x = 23;
    p.y = 100;
    roomMove(r, p, -1, 0);
    expect(p.x).toBe(23);
    r.w = 512;
    r.h = 352;
    p.x = 400;
    p.y = 300;
    roomMove(r, p, 1, 0);
    expect(p.x).toBe(401);
  });
  it("first store visits freeze guard movement and input", () => {
    const g = live();
    enterStore(g, 4);
    const x = g.player.x,
      sx = g.spies[0].x;
    frames(g, 60, { right: true });
    expect(g.player.x).toBe(x);
    expect(g.spies[0].x).toBe(sx);
  });
  it("GameStonk egg runs once, freezes input, and gives a useless one-point item", () => {
    const g = live();
    enterStore(g, 3);
    const x = g.player.x;
    step(g, { right: true });
    expect(g.player.x).toBe(x);
    expect(g.eggItem).not.toBeNull();
    frames(g, 180);
    g.firstVisit = 0;
    g.player.x = 128;
    g.player.y = 72;
    step(g);
    expect(g.inventory).toHaveLength(1);
    expect(g.score).toBe(1);
    leaveStore(g);
    enterStore(g, 3);
    expect(g.egg).toBe(0);
  });
  it("fitting-room surprise preserves contents", () => {
    const g = room(0);
    const f = g.rooms[0].fixtures.find((f) => f.kind === "fitting")!;
    g.rng.next = () => 0;
    finishSearch(g, f);
    expect(f.open).toBe(false);
    expect(f.surprise).toBe(true);
    expect(g.spies).toHaveLength(1);
    finishSearch(g, f);
    expect(f.open).toBe(true);
  });
  it("shooting toy shelves releases three wind-up toys", () => {
    const g = room(4);
    const f = g.rooms[4].fixtures[0];
    g.bullets = [
      { x: f.x - 2, y: f.y + 4, vx: 4, vy: 0, enemy: false, life: 20, id: 1 },
    ];
    step(g);
    expect(g.toys).toHaveLength(3);
    expect(f.toys).toBe(true);
  });
  it("listening booth switches music state", () => {
    const g = room(7);
    g.player.x = 180;
    g.player.y = 30;
    step(g);
    expect(g.listening).toBe(true);
    g.player.y = 100;
    step(g);
    expect(g.listening).toBe(false);
  });
});
describe("NPCs and fair spies", () => {
  it("wet patches stay away from shafts and lock slide direction", () => {
    const g = live();
    g.player = actor(440, 4);
    g.janitor.timer = 1;
    updateNPCs(g, {}, {});
    expect(g.wet!.x).toBeGreaterThan(400);
    g.player.x = g.wet!.x + 5;
    g.player.dir = 1;
    step(g, { left: true });
    expect(g.player.slide).toBe(1);
    expect(g.player.vx).toBe(1);
  });
  it("walkers block shots, cost points, and survive", () => {
    const g = live();
    score(g, 500);
    g.bullets = [
      {
        x: g.walkers[0].x - 4,
        y: floorY(3) - 12,
        vx: 4,
        vy: 0,
        enemy: false,
        life: 20,
        id: 1,
      },
    ];
    step(g);
    expect(g.score).toBe(300);
    expect(g.walkers).toHaveLength(2);
    expect(g.bullets).toHaveLength(0);
  });
  it("shooting in front of cop starts chase and getting caught costs points", () => {
    const g = live();
    score(g, 1000);
    g.player = actor(460, 1);
    g.cop = { x: 500, floor: 1, dir: -1, chase: 0 };
    step(g, {}, { a: true });
    expect(g.cop.chase).toBe(600);
    g.cop.x = g.player.x;
    step(g);
    expect(g.player.stun).toBe(180);
    expect(g.score).toBe(500);
    expect(g.lives).toBe(3);
  });
  it("kiosk has a twenty-second cooldown", () => {
    const g = live();
    g.player = actor(486, 1);
    step(g, { up: true }, { up: true });
    expect(g.kiosks[1]).toBe(1200);
    expect(g.banner).toContain("NEXT:");
  });
  it("photo booth hides the player and grants only one photo strip", () => {
    const g = live();
    g.player = actor(450, 2);
    step(g, { up: true }, { up: true });
    expect(g.player.hidden).toBe(300);
    expect(g.inventory).toEqual([]);
    frames(g, 300);
    expect(g.inventory).toEqual(["PHOTO STRIP"]);
    expect(g.photoPopup).toBeGreaterThan(0);
    step(g, { up: true }, { up: true });
    expect(g.inventory).toHaveLength(1);
  });
  it("spies have 120-frame grace plus 30-frame aiming telegraph", () => {
    const g = live();
    const s = makeSpy(g, 160, 1);
    g.spies = [s];
    frames(g, 119);
    expect(g.bullets.filter((b) => b.enemy)).toHaveLength(0);
    expect(s.aim).toBe(0);
    step(g);
    expect(s.aim).toBe(29);
    frames(g, 28);
    expect(g.bullets.filter((b) => b.enemy)).toHaveLength(0);
    step(g);
    expect(g.events).toContain("enemy");
  });
  it("dodge probability is near ten percent across seeded independent volleys", () => {
    let ducks = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const g = live(seed);
      const s = makeSpy(g, 140, 1);
      g.spies = [s];
      g.bullets = [
        { x: 100, y: s.y - 16, vx: 4, vy: 0, enemy: false, life: 30, id: seed },
      ];
      step(g);
      if (s.duck) ducks++;
    }
    expect(ducks).toBeGreaterThan(65);
    expect(ducks).toBeLessThan(135);
  });
  it("lamp hits drop it and environmental kills award three hundred", () => {
    const g = live();
    const l = g.lamps[0];
    g.bullets = [
      { x: l.x - 4, y: l.y + 16, vx: 4, vy: 0, enemy: false, life: 10, id: 1 },
    ];
    step(g);
    expect(l.mode).toBe("fall");
    g.spies = [makeSpy(g, l.x, l.floor)];
    frames(g, 30);
    expect(g.score).toBe(300);
  });
});
describe("end-to-end flow", () => {
  it("blocks exit with missing packages and awards clear exactly once", () => {
    const g = live();
    exit(g);
    expect(g.scene).toBe("mall");
    expect(g.banner).toBe("PACKAGES LEFT: 6");
    g.packages = 6;
    g.time = 60;
    exit(g);
    const n = g.score;
    exit(g);
    expect(g.score).toBe(n);
    expect(n).toBe(3990);
    expect(g.scene).toBe("clear");
  });
  it("continues retain score, packages and loop with three fresh lives", () => {
    const g = live();
    g.score = 777;
    g.packages = 4;
    g.loop = 3;
    g.lives = 1;
    hurt(g);
    frames(g, 45);
    expect(g.scene).toBe("continue");
    step(g, {}, { start: true });
    expect(g.lives).toBe(3);
    expect(g.continues).toBe(2);
    expect([g.score, g.packages, g.loop]).toEqual([777, 4, 3]);
  });
  it("expires continue and closes mall before title", () => {
    const g = live();
    g.scene = "continue";
    g.sceneFrame = 599;
    step(g);
    expect(g.scene).toBe("over");
    frames(g, 331);
    expect(g.scene).toBe("title");
  });
  it("has three continues, then game over", () => {
    const g = live();
    for (let i = 0; i < 3; i++) {
      g.scene = "continue";
      step(g, {}, { start: true });
    }
    expect(g.continues).toBe(0);
    g.lives = 1;
    g.player.inv = 0;
    hurt(g);
    frames(g, 45);
    expect(g.scene).toBe("over");
  });
  it("splash, title, arrival, selfie, clear newspaper post and loop two", () => {
    const g = createGame(1);
    frames(g, 180);
    expect(g.scene).toBe("title");
    step(g, {}, { start: true });
    expect(g.scene).toBe("arrival");
    frames(g, 270);
    expect(g.scene).toBe("mall");
    g.packages = 6;
    exit(g);
    for (let i = 0; i < 3; i++) step(g, {}, { start: true });
    expect(g.loop).toBe(2);
    expect(g.scene).toBe("arrival");
    expect(g.packages).toBe(0);
  });
  it("collects all six package fixtures then starts the harder second loop", () => {
    const g = live();
    for (const s of stores.filter((s) => s.role === "target")) {
      enterStore(g, s.id);
      const f = g.rooms[s.id].fixtures.find((f) => f.content === "package")!;
      finishSearch(g, f);
      leaveStore(g);
    }
    expect(g.packages).toBe(6);
    g.player = actor(690, 5);
    step(g, { up: true }, { up: true });
    expect(g.scene).toBe("clear");
    for (let i = 0; i < 3; i++) step(g, {}, { start: true });
    expect(g.loop).toBe(2);
  });
});

describe("navigation and interaction regressions", () => {
  it("guards route around fixtures and can approach every searchable fixture", async () => {
    const { roomWaypoint } = await import("../src/game");
    for (const s of stores.filter((s) => s.role !== "closed")) {
      const r = createGame(1).rooms[s.id];
      for (const f of r.fixtures)
        expect(
          roomWaypoint(r, r.w / 2, r.h - 22, f.x + f.w / 2, f.y + f.h + 8),
          s.name + " fixture " + f.id,
        ).not.toBeNull();
    }
  });
  it("a department-store-sized room enters at its own bottom-centre door", () => {
    const g = live();
    g.rooms[0].w = 512;
    g.rooms[0].h = 352;
    enterStore(g, 0);
    expect(g.player.x).toBe(256);
    expect(g.player.y).toBe(330);
  });
  it("the GameStonk joke item cannot be picked up in a different store", () => {
    const g = live();
    enterStore(g, 3);
    g.egg = 0;
    leaveStore(g);
    enterStore(g, 1);
    g.firstVisit = 0;
    g.player.x = 128;
    g.player.y = 72;
    step(g);
    expect(g.inventory).toHaveLength(0);
    expect(g.eggItem).not.toBeNull();
  });
  it("fades complete on title, continue and arrival screens", () => {
    const g = createGame(1);
    frames(g, 200);
    expect(g.scene).toBe("title");
    expect(g.fade).toBe(0);
    g.scene = "continue";
    g.fade = 12;
    frames(g, 12);
    expect(g.fade).toBe(0);
    g.scene = "arrival";
    g.fade = 12;
    frames(g, 12);
    expect(g.fade).toBe(0);
  });
});
