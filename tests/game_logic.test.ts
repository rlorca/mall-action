import { describe, it, expect, beforeEach } from "vitest";
import { GameEngine } from "../src/game/logic";
import { VirtualPadState } from "../src/input/input";

describe("Mall Action Game Engine Rules", () => {
  let engine: GameEngine;
  const emptyPad: VirtualPadState = {
    up: false, down: false, left: false, right: false,
    a: false, b: false, select: false, start: false
  };

  beforeEach(() => {
    engine = new GameEngine(1337);
    engine.ctx.screen = "MALL";
  });

  it("initializes 13 stores with exactly 6 target stores containing 1 package each", () => {
    expect(engine.ctx.stores.length).toBe(13);
    const targetStores = engine.ctx.stores.filter((s) => s.role === "TARGET");
    expect(targetStores.length).toBe(6);
    targetStores.forEach((s) => {
      expect(s.hasPackage).toBe(true);
    });
  });

  it("blocks exit at getaway wagon if 6 packages are not collected", () => {
    engine.ctx.packagesFound = 3;
    engine.tryExitLevel();
    expect(engine.ctx.screen).toBe("MALL"); // Remains in MALL
  });

  it("triggers Level Clear when all 6 packages are collected and exit is reached", () => {
    engine.ctx.packagesFound = 6;
    engine.tryExitLevel();
    expect(engine.ctx.screen).toBe("CLEAR");
    expect(engine.ctx.score).toBeGreaterThanOrEqual(1000);
  });

  it("applies powerup slots and stackable armor / radar correctly", () => {
    engine.applyPowerUp("RAPID");
    expect(engine.ctx.agent.weapon).toBe("RAPID");

    engine.applyPowerUp("SPREAD");
    expect(engine.ctx.agent.weapon).toBe("SPREAD");

    engine.applyPowerUp("ARMOR");
    expect(engine.ctx.agent.hasArmor).toBe(true);

    engine.applyPowerUp("RADAR");
    expect(engine.ctx.agent.hasRadar).toBe(true);
  });

  it("deducts life or absorbs hit with armor upon agent death", () => {
    engine.applyPowerUp("ARMOR");
    engine.killAgent();
    expect(engine.ctx.agent.hasArmor).toBe(false);
    expect(engine.ctx.lives).toBe(3); // Life spared by armor!

    engine.killAgent();
    expect(engine.ctx.lives).toBe(2); // Life deducted
  });

  it("handles continue screen countdown and max 3 continues", () => {
    engine.ctx.lives = 1;
    engine.ctx.continuesLeft = 3;
    engine.killAgent();

    expect(engine.ctx.screen).toBe("CONTINUE");
    expect(engine.ctx.continueCountdown).toBe(9);

    // Press START on continue screen
    const pad = { ...emptyPad, start: true };
    engine.update(pad);

    expect(engine.ctx.screen).toBe("MALL");
    expect(engine.ctx.lives).toBe(3);
    expect(engine.ctx.continuesLeft).toBe(2);
  });
});
