import { describe, expect, it } from "vitest";
import { RNG } from "../src/core/rng.js";
import { STORES, ROOM_TEMPLATES, validateRoomTemplate, roomFixtures, createStoreStates, reachableFloors, nearestPackageStore, escalatorAt } from "../src/core/level.js";
import { FLOORS } from "../src/core/constants.js";

describe("mall and room setup", () => {
  it("has the required 13 storefronts and six targets", () => {
    expect(STORES).toHaveLength(13);
    expect(STORES.filter((s) => s.role === "target")).toHaveLength(6);
    expect(STORES.filter((s) => s.role === "power")).toHaveLength(4);
    expect(STORES.filter((s) => s.role === "closed")).toHaveLength(3);
  });
  it("validates every hand-designed room and finds solid fixtures", () => {
    expect(Object.keys(ROOM_TEMPLATES)).toHaveLength(10);
    for (const [id, template] of Object.entries(ROOM_TEMPLATES)) {
      expect(validateRoomTemplate(template), id).toBe(true);
      expect(roomFixtures(id).length, id).toBeGreaterThanOrEqual(6);
      expect(new Set(roomFixtures(id).map((f) => f.id)).size).toBe(roomFixtures(id).length);
    }
    expect(validateRoomTemplate({ width: 2, height: 2, rows: [] })).toBe(false);
  });
  it("places exactly one package per target and never traps power-up shops", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const states = createStoreStates(new RNG(seed));
      for (const store of STORES.filter((s) => s.role === "target")) {
        expect(states[store.id].fixtures.filter((f) => f.content === "package")).toHaveLength(1);
      }
      for (const store of STORES.filter((s) => s.role === "power")) {
        expect(states[store.id].fixtures.some((f) => f.content === "trap" || f.content === "package")).toBe(false);
      }
    }
  });
  it("makes every non-package fixture a power-up on Black Friday", () => {
    const states = createStoreStates(new RNG(42), true);
    for (const room of Object.values(states)) for (const fixture of room.fixtures) {
      expect(fixture.content).not.toBe("trap"); expect(fixture.content).not.toBe("nothing");
    }
  });
  it("keeps opened fixtures and contents stable across calls", () => {
    const room = createStoreStates(new RNG(42)).forever;
    room.fixtures[0].opened = true;
    expect(room.fixtures[0].opened).toBe(true);
    expect(room.packageFixture).toBe(room.fixtures.find((f) => f.content === "package").id);
  });
  it("can reach every floor including parking", () => {
    expect(reachableFloors().sort()).toEqual([...FLOORS].sort());
  });
  it("boards escalators up at the bottom and down at the top", () => {
    expect(escalatorAt("3F", 448, -1)?.id).toBe("E1");
    expect(escalatorAt("4F", 448, 1)?.id).toBe("E1");
    expect(escalatorAt("3F", 448, 1)).toBeUndefined();
  });
  it("gives all ten stores distinct layouts", () => {
    const signatures = new Set(Object.values(ROOM_TEMPLATES).map((room) => room.rows.join("/")));
    expect(signatures.size).toBe(10);
  });
  it("directory finds a remaining target", () => {
    const states = createStoreStates(new RNG(42));
    expect(nearestPackageStore(states, "4F", 20).role).toBe("target");
    for (const room of Object.values(states)) room.cleared = true;
    expect(nearestPackageStore(states, "4F", 20)).toBeNull();
  });
});
