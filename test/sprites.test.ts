import { describe, it, expect } from "vitest";
import { buildSprites, distinctColors } from "../src/sprites";

describe("sprites", () => {
  const sprites = buildSprites();

  it("builds every required sprite", () => {
    const names = [
      "agentStand",
      "agentWalk1",
      "agentWalk2",
      "agentJump",
      "agentDuck",
      "spyStand",
      "spyWalk1",
      "spyWalk2",
      "agentStoreDown",
      "agentStoreUp",
      "agentStoreSide",
      "spyStore",
      "package",
      "bullet",
      "coin",
    ];
    for (const n of names) {
      expect(sprites[n as keyof typeof sprites], n).toBeDefined();
    }
  });

  it("mall sprites are 16x24", () => {
    expect(sprites.agentStand.w).toBe(16);
    expect(sprites.agentStand.h).toBe(24);
    expect(sprites.spyStand.w).toBe(16);
    expect(sprites.spyStand.h).toBe(24);
  });

  it("store sprites are 16x16", () => {
    expect(sprites.agentStoreDown.w).toBe(16);
    expect(sprites.agentStoreDown.h).toBe(16);
    expect(sprites.spyStore.w).toBe(16);
    expect(sprites.spyStore.h).toBe(16);
  });

  it("every sprite uses at most 3 colours plus transparent", () => {
    for (const [name, spr] of Object.entries(sprites)) {
      expect(distinctColors(spr), name).toBeLessThanOrEqual(3);
    }
  });

  it("every sprite has at least one non-transparent pixel", () => {
    for (const [name, spr] of Object.entries(sprites)) {
      const nonEmpty = spr.px.some((c) => c !== 0);
      expect(nonEmpty, name).toBe(true);
    }
  });
});
