import { describe, expect, it } from "vitest";
import { MallGame } from "../src/core/game.js";
import { FLOOR_Y } from "../src/core/constants.js";
import { applyPowerup } from "../src/core/powerups.js";
import { beginSearch } from "../src/core/search.js";

function atMall(seed = 7) {
  const game = new MallGame(seed, { skipSplash: true });
  game.newGame(); game.state.screen = "mall"; game.state.screenFrame = 0;
  game.state.arrivalPhase = "selfie"; game.state.selfieStart = 0;
  return game;
}
function emptyStep(game, count = 1) { for (let i = 0; i < count; i++) game.step({}); }

describe("game flow", () => {
  it("skips splash and starts a deterministic new game", () => {
    const game = new MallGame(42); game.step({ startPressed: true });
    expect(game.state.screen).toBe("title"); game.step({ startPressed: true });
    expect(game.state.screen).toBe("arrival"); expect(game.state.lives).toBe(3); expect(game.state.packages).toBe(0);
  });
  it("runs zipline, selfie and starts play", () => {
    const game = atMall(); game.state.screen = "arrival"; game.state.screenFrame = 0;
    emptyStep(game, 105); expect(game.state.arrivalPhase).toBe("drop");
    emptyStep(game, 30); expect(game.state.arrivalPhase).toBe("selfie");
    game.step({ aPressed: true }); expect(game.state.screen).toBe("mall");
  });
  it("pauses every gameplay timer under map and pause", () => {
    const game = atMall(); const s = game.state; applyPowerup(s, "rapid"); s.elapsed = 20;
    game.step({ selectPressed: true }); const elapsed = s.elapsed, timer = s.powerups.weaponTime;
    emptyStep(game, 90); expect(s.elapsed).toBe(elapsed); expect(s.powerups.weaponTime).toBe(timer);
    game.step({ selectPressed: true }); expect(s.screen).toBe("mall");
    game.step({ startPressed: true }); expect(s.screen).toBe("pause"); game.step({ startPressed: true }); expect(s.screen).toBe("mall");
  });
  it("keeps power-up timers running in stores", () => {
    const game = atMall(); applyPowerup(game.state, "rapid"); game.enterStore("forever");
    const timer = game.state.powerups.weaponTime; emptyStep(game, 2);
    expect(game.state.powerups.weaponTime).toBe(timer - 2);
  });
  it("blocks exit until six packages and fires level clear exactly once", () => {
    const game = atMall(); const s = game.state; s.packages = 5;
    expect(game.tryExit()).toBe(false); expect(s.message).toContain("PACKAGES LEFT: 1");
    s.packages = 6; expect(game.tryExit()).toBe(true); expect(s.screen).toBe("clear");
    const score = s.score; expect(game.tryExit()).toBe(false); expect(s.score).toBe(score);
    expect(s.clear.awarded).toBe(true);
  });
  it("advances tally, newspaper, post and a harder loop", () => {
    const game = atMall(); game.state.packages = 6; game.tryExit();
    game.step({ startPressed: true }); expect(game.state.clear.phase).toBe("newspaper");
    game.step({ startPressed: true }); expect(game.state.clear.phase).toBe("post");
    game.step({ startPressed: true }); expect(game.state.loop).toBe(2); expect(game.state.screen).toBe("arrival");
  });
  it("offers three continues and preserves run progress", () => {
    const game = atMall(); const s = game.state; s.lives = 1; s.score = 900; s.packages = 4; applyPowerup(s, "radar");
    game.killPlayer("TEST"); expect(s.screen).toBe("continue"); expect(s.continueTime).toBe(540);
    game.step({ startPressed: true }); expect(s.screen).toBe("mall"); expect(s.lives).toBe(3); expect(s.continues).toBe(2);
    expect(s.score).toBe(900); expect(s.packages).toBe(4); expect(s.powerups.radar).toBe(false);
  });
  it("reaches game over after lives and continues are exhausted", () => {
    const game = atMall(); game.state.lives = 1; game.state.continues = 0; game.killPlayer();
    expect(game.state.screen).toBe("gameover"); emptyStep(game, 200); game.step({ startPressed: true }); expect(game.state.screen).toBe("title");
  });
  it("spawns the first spy about five seconds into play", () => {
    const game = atMall(); emptyStep(game, 299); expect(game.state.spies).toHaveLength(0);
    game.step({}); expect(game.state.spies.length).toBeGreaterThan(0);
  });
});

describe("stores and extras", () => {
  it("finds a package with one B tap and persists the opened fixture", () => {
    const game = atMall(); game.enterStore("forever"); const s = game.state, room = s.stores.forever;
    room.guards = []; room.lineTime = 0; const fixture = room.fixtures.find((f) => f.content === "package");
    s.player.x = fixture.x + 16; s.player.y = fixture.y;
    game.step({ bPressed: true }); expect(room.search).not.toBeNull(); emptyStep(game, 45);
    expect(fixture.opened).toBe(true); expect(s.packages).toBe(1); expect(room.cleared).toBe(true); expect(s.score).toBe(500);
    game.leaveStore(); expect(room.fixtures.find((f) => f.id === fixture.id).opened).toBe(true);
  });
  it("runs the dangerous-to-go-alone easter egg and awards one joke point", () => {
    const game = atMall(); game.enterStore("game"); const s = game.state, room = s.stores.game;
    expect(room.easter.phase).toBe("text"); emptyStep(game, 211); expect(room.easter.phase).toBe("item");
    room.guards = []; s.player.x = 122; s.player.y = 80; game.step({});
    expect(room.easter.phase).toBe("done"); expect(s.inventory).toHaveLength(1); expect(s.score).toBe(1);
  });
  it("reveals an occupied fitting room without consuming its contents", () => {
    const game = atMall(); game.enterStore("forever"); const room = game.state.stores.forever; const fixture = room.fixtures[0];
    const content = fixture.content, guards = room.guards.length; game.rng.chance = () => true; fixture.opened = true;
    game.finishSearch(room, fixture); expect(fixture.opened).toBe(false); expect(fixture.content).toBe(content); expect(room.guards.length).toBe(guards + 1);
  });
  it("keeps first-visit lines and the easter egg completed across loops", () => {
    const game = atMall(); game.enterStore("game"); const s = game.state, room = s.stores.game;
    emptyStep(game, 211); room.guards = []; s.player.x = 122; s.player.y = 80; game.step({});
    expect(s.gameEasterDone).toBe(true); game.startLevel(2);
    expect(s.stores.game.easterEggDone).toBe(true); expect(s.stores.game.firstVisit).toBe(false);
    game.enterStore("game"); expect(s.stores.game.easter).toBeNull(); expect(s.stores.game.lineTime).toBe(0);
  });
  it("releases three wind-up toys that stun guards", () => {
    const game = atMall(); game.enterStore("kgb"); const room = game.state.stores.kgb;
    game.releaseToys(room, room.fixtures[0]); expect(room.toys).toHaveLength(3);
    room.guards[0].x = room.toys[0].x; room.guards[0].y = room.toys[0].y; game.updateToys(room);
    expect(room.guards[0].stun).toBe(90);
  });
  it("plays Side B at the listening booth until leaving", () => {
    const game = atMall(); game.enterStore("sam"); const s = game.state, room = s.stores.sam;
    room.guards = []; room.lineTime = 0; s.player.x = 110; s.player.y = 120; game.step({});
    expect(room.boothPlaying).toBe(true); expect(s.message).toContain("SIDE B"); game.leaveStore(); expect(room.boothPlaying).toBe(false);
  });
});

describe("spies and mall NPC rules", () => {
  it("telegraphs for 30 frames and never fires before two seconds", () => {
    const game = atMall(); const s = game.state; s.player.x = 300; game.spawnSpy("R", 400); const spy = s.spies[0]; spy.cooldown = 0;
    emptyStep(game, 89); expect(s.enemyBullets).toHaveLength(0);
    game.step({}); expect(spy.aim).toBe(30); emptyStep(game, 29); expect(s.enemyBullets).toHaveLength(0);
    game.step({}); expect(s.enemyBullets).toHaveLength(1); expect(spy.cooldown).toBeGreaterThanOrEqual(60);
  });
  it("ducks under high shots but not low shots", () => {
    const game = atMall(); const s = game.state; s.player.ducking = true;
    s.enemyBullets = [{ id: 1, x: s.player.x, y: s.player.y + 9, w: 4, h: 2, vx: 0, vy: 0, floor: "R", enemy: true, life: 10 }];
    game.updateBullets(); expect(s.lives).toBe(3);
    s.enemyBullets = [{ id: 2, x: s.player.x, y: s.player.y + 18, w: 4, h: 2, vx: 0, vy: 0, floor: "R", enemy: true, life: 10 }];
    game.updateBullets(); expect(s.lives).toBe(2);
  });
  it("ducks roughly ten percent of incoming volleys", () => {
    const game = atMall(); const s = game.state; game.spawnSpy("R", 400); const spy = s.spies[0]; let ducks = 0;
    for (let i = 0; i < 1500; i++) {
      spy.dodgeBullet = null; spy.duck = 0;
      s.bullets = [{ id: i + 1, x: spy.x + 24, y: spy.y + 10, w: 4, h: 2, vx: 4, vy: 0, floor: "R", enemy: false, life: 10 }];
      game.updateBullets(); if (spy.duck) ducks++;
    }
    expect(ducks / 1500).toBeGreaterThan(0.065); expect(ducks / 1500).toBeLessThan(0.135);
  });
  it("wet-floor jump kicks crush for 300 points", () => {
    const game = atMall(); const s = game.state; s.player.floor = "1F"; s.player.x = 600; s.player.y = FLOOR_Y["1F"] - 24; s.player.jumpKick = true;
    s.janitor.wet = { x: 590, floor: "1F", life: 600 }; game.spawnSpy("1F", 600); game.updateNPCs();
    expect(s.spies[0].state).toBe("dying"); expect(s.score).toBe(300);
  });
  it("mall walkers block bullets and cost points", () => {
    const game = atMall(); const s = game.state; const walker = s.walkers[0];
    s.bullets = [{ id: 1, x: walker.x - 2, y: FLOOR_Y["2F"] - 12, w: 4, h: 2, vx: 4, floor: "2F", life: 10 }];
    game.updateBullets(); expect(s.score).toBe(0); expect(s.popups[0].text).toBe("-200"); expect(walker.hey).toBe(70);
  });
  it("cop detains without costing a life", () => {
    const game = atMall(); const s = game.state; s.score = 1000; s.cop.floor = s.player.floor; s.cop.x = s.player.x + 30; s.cop.dir = -1; s.player.facing = 1;
    game.shootMall(); expect(s.cop.chase).toBe(600); s.cop.x = s.player.x; game.updateNPCs();
    expect(s.score).toBe(500); expect(s.player.freeze).toBe(180); expect(s.lives).toBe(3);
  });
  it("kiosks, photo booths and fountains provide their interactions", () => {
    const game = atMall(); const s = game.state;
    s.player.floor = "4F"; s.player.x = 274; game.mallInteract(-1); expect(s.message).toContain("NEAREST PACKAGE"); expect(s.kioskCooldown).toBe(1200);
    s.player.floor = "3F"; s.player.x = 594; game.mallInteract(-1); expect(s.player.hidden).toBe(true); game.exitPhotoBooth(); expect(s.photoStrip).toBe(true);
    game.sprayFountain(s.fountains[0]); expect(s.coins.length).toBeGreaterThanOrEqual(3); expect(s.coins.length).toBeLessThanOrEqual(5); expect(s.fountains[0].cooldown).toBe(900);
  });
});
