import { describe, expect, it } from "vitest";
import { addScore, difficulty, timeBonus } from "../src/core/scoring.js";
import { emptyPowerups, applyPowerup, tickPowerups, resetOnDeath, absorbHit } from "../src/core/powerups.js";
import { createStoreStates, roomFixtures } from "../src/core/level.js";
import { RNG } from "../src/core/rng.js";
import { touchingFixture, beginSearch, tickSearch, SEARCH_FRAMES } from "../src/core/search.js";

const state = () => ({ score: 0, lives: 3, powerups: emptyPowerups(), invulnerability: 0 });

describe("score and difficulty", () => {
  it("awards an extra life at 20,000 and clamps negative score", () => {
    const s = state(); expect(addScore(s, 19999).extraLife).toBe(false);
    expect(addScore(s, 1).extraLife).toBe(true); expect(s.lives).toBe(4);
    addScore(s, 20000); expect(s.lives).toBe(5);
    addScore(s, -999999); expect(s.score).toBe(0);
  });
  it("scales each loop but caps all rates", () => {
    expect(difficulty(2).spySpeed).toBeGreaterThan(difficulty(1).spySpeed);
    expect(difficulty(20).spySpeed).toBe(1.8); expect(difficulty(20).alarmFrames).toBe(4200);
    expect(timeBonus(60)).toBe(2990); expect(timeBonus(600 * 60)).toBe(0);
  });
});

describe("power-up slots, timers and armour", () => {
  it("replaces weapons but stacks speed, radar and armour", () => {
    const s = state(); applyPowerup(s, "rapid"); applyPowerup(s, "spread"); applyPowerup(s, "sneakers"); applyPowerup(s, "radar"); applyPowerup(s, "armor");
    expect(s.powerups.weapon).toBe("spread"); expect(s.powerups.speed).toBe("sneakers"); expect(s.powerups.radar).toBe(true); expect(s.powerups.armor).toBe(true);
  });
  it("expires timed slots independently and keeps radar on death", () => {
    const s = state(); applyPowerup(s, "rapid"); applyPowerup(s, "orange"); applyPowerup(s, "radar"); applyPowerup(s, "armor");
    tickPowerups(s); expect(s.powerups.weaponTime).toBe(1199); expect(s.powerups.speedTime).toBe(719);
    resetOnDeath(s); expect(s.powerups.radar).toBe(true); expect(s.powerups.armor).toBe(false); expect(s.powerups.weapon).toBeNull();
  });
  it("armour absorbs exactly one hit", () => {
    const s = state(); applyPowerup(s, "pretzel"); expect(absorbHit(s)).toBe(true); expect(absorbHit(s)).toBe(true);
    s.invulnerability = 0; expect(absorbHit(s)).toBe(false);
    applyPowerup(s, "cinnabomb"); expect(absorbHit(s)).toBe(true); expect(s.powerups.invincible).toBe(360);
  });
});

describe("forgiving fixture searching", () => {
  function setup(id = "forever") {
    const room = createStoreStates(new RNG(5))[id]; const fixture = room.fixtures[0];
    const player = { x: fixture.x + 16, y: fixture.y, w: 12, h: 16, facing: "down" };
    return { room, fixture, player };
  }
  it("accepts a fixture touched at a gap and auto-faces it", () => {
    const { room, fixture, player } = setup(); expect(touchingFixture(player, room.fixtures)?.id).toBe(fixture.id);
    expect(beginSearch(room, player)).toBe(true); expect(player.facing).toBe("left"); expect(player.searchFacing).toBe("left"); expect(room.search.total).toBe(SEARCH_FRAMES);
  });
  it("completes a single tap after 45 frames and stays opened", () => {
    const { room, fixture, player } = setup(); beginSearch(room, player);
    for (let i = 0; i < 44; i++) expect(tickSearch(room, {})).toBeNull();
    const result = tickSearch(room, {}); expect(result.completed).toBe(true); expect(fixture.opened).toBe(true);
    expect(room.search).toBeNull();
    expect(touchingFixture(player, room.fixtures)?.id).not.toBe(fixture.id);
  });
  it("cancels only on a fresh direction or fire", () => {
    const { room, player } = setup(); beginSearch(room, player);
    expect(tickSearch(room, { left: true })).toBeNull();
    expect(tickSearch(room, { leftPressed: true }).cancelled).toBe(true);
    beginSearch(room, player); expect(tickSearch(room, { aPressed: true }).cancelled).toBe(true);
  });
  it("searches faster with sneakers", () => {
    const { room, player } = setup(); beginSearch(room, player, true); expect(room.search.total).toBe(30);
  });
});
