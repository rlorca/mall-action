import { describe, it, expect } from "vitest";
import {
  STORES,
  TARGET_STORES,
  POWERUP_STORES,
  SHAFTS,
  ESCALATORS,
  ROOMS,
  buildRoomGrid,
  ROOM_W,
  ROOM_H,
  T_WALL,
  T_DOOR,
} from "../src/rules/layout";
import { Game } from "../src/rules/game";
import { createStore } from "../src/rules/store";
import { FLOOR_ORDER } from "../src/copy";

describe("layout", () => {
  it("has 13 storefronts", () => {
    expect(STORES).toHaveLength(13);
  });

  it("has exactly 6 target stores", () => {
    expect(TARGET_STORES).toHaveLength(6);
  });

  it("has 4 power-up shops and 3 closed stores", () => {
    expect(POWERUP_STORES).toHaveLength(4);
    expect(STORES.filter((s) => s.role === "closed")).toHaveLength(3);
  });

  it("every open store has a room template", () => {
    for (const s of STORES) {
      if (s.role === "closed") continue;
      expect(ROOMS[s.id], s.id).toBeDefined();
    }
  });

  it("room grids are 16x11 with a border wall and a door", () => {
    for (const s of STORES) {
      if (s.role === "closed") continue;
      const grid = buildRoomGrid(ROOMS[s.id]);
      expect(grid.length).toBe(ROOM_W * ROOM_H);
      // Border walls (bottom row has a door at x=7,8).
      for (let x = 0; x < ROOM_W; x++) {
        expect(grid[x]).toBe(T_WALL);
        if (x !== 7 && x !== 8) {
          expect(grid[(ROOM_H - 1) * ROOM_W + x]).toBe(T_WALL);
        }
      }
      // Door at bottom centre.
      expect(grid[(ROOM_H - 1) * ROOM_W + 7]).toBe(T_DOOR);
      expect(grid[(ROOM_H - 1) * ROOM_W + 8]).toBe(T_DOOR);
    }
  });

  it("fixtures are within room bounds", () => {
    for (const s of STORES) {
      if (s.role === "closed") continue;
      for (const f of ROOMS[s.id].fixtures) {
        expect(f.x).toBeGreaterThan(0);
        expect(f.x).toBeLessThan(ROOM_W - 1);
        expect(f.y).toBeGreaterThan(0);
        expect(f.y).toBeLessThan(ROOM_H - 1);
      }
    }
  });

  it("every floor is reachable from the roof", () => {
    // Build a graph: elevator shafts connect all their floors; escalators
    // connect their two floors.
    const adj = new Map<string, Set<string>>();
    for (const f of FLOOR_ORDER) adj.set(f, new Set());
    for (const sh of SHAFTS) {
      for (let i = 0; i < sh.floors.length; i++) {
        for (let j = 0; j < sh.floors.length; j++) {
          if (i !== j) {
            adj.get(sh.floors[i])!.add(sh.floors[j]);
            adj.get(sh.floors[j])!.add(sh.floors[i]);
          }
        }
      }
    }
    for (const e of ESCALATORS) {
      adj.get(e.lower)!.add(e.upper);
      adj.get(e.upper)!.add(e.lower);
    }
    // BFS from R.
    const seen = new Set<string>(["R"]);
    const queue = ["R"];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of adj.get(cur)!) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    for (const f of FLOOR_ORDER) {
      expect(seen.has(f), f).toBe(true);
    }
  });

  it("shaft B is the only shaft reaching the parking level", () => {
    const reachingP = SHAFTS.filter((s) => s.floors.includes("P"));
    expect(reachingP.map((s) => s.id)).toEqual(["B"]);
  });
});

describe("store level setup", () => {
  it("each target store has exactly one package", () => {
    for (const s of TARGET_STORES) {
      const game = new Game({ seed: 1 });
      const st = createStore(game, s.id);
      const packages = st.fixtures.filter((f) => f.content === "package");
      expect(packages.length, s.id).toBe(1);
    }
  });

  it("power-up shops never hold a trap or a package", () => {
    for (const s of POWERUP_STORES) {
      const game = new Game({ seed: 1 });
      const st = createStore(game, s.id);
      for (const f of st.fixtures) {
        expect(f.content, `${s.id} fixture`).not.toBe("trap");
        expect(f.content, `${s.id} fixture`).not.toBe("package");
      }
    }
  });
});
