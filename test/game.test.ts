import { describe, it, expect } from "vitest";
import { Game } from "../src/rules/game";
import type { PadFrame } from "../src/input";

function empty(): PadFrame {
  return { held: new Set(), pressed: [], released: [] };
}

function press(...buttons: string[]): PadFrame {
  return { held: new Set(buttons as never[]), pressed: buttons as never[], released: [] };
}

/** Create a game and advance it into the mall "play" phase. */
function startMall(seed = 1): Game {
  const game = new Game({ seed, skipSplash: true });
  game.step(press("start")); // title -> mall (zipline)
  for (let i = 0; i < 300; i++) game.step(empty());
  return game;
}

describe("fixed-step loop", () => {
  it("is deterministic for a given seed and input", () => {
    const a = startMall(42);
    const b = startMall(42);
    const inputs = [press("right"), press("right"), press("a"), empty(), press("left")];
    for (const inp of inputs) {
      a.step(inp);
      b.step(inp);
    }
    expect(a.mall.player.x).toBe(b.mall.player.x);
    expect(a.mall.player.y).toBe(b.mall.player.y);
    expect(a.score).toBe(b.score);
    expect(a.frame).toBe(b.frame);
  });
});

describe("splash", () => {
  it("flickers then settles and moves to title", () => {
    const game = new Game({ seed: 1 });
    expect(game.screen).toBe("splash");
    for (let i = 0; i < 60; i++) game.step(empty());
    expect(game.splashPhase).toBe(1);
    for (let i = 0; i < 120; i++) game.step(empty());
    expect(game.screen).toBe("title");
  });

  it("any button skips the splash", () => {
    const game = new Game({ seed: 1 });
    game.step(press("start"));
    expect(game.screen).toBe("title");
  });
});

describe("jump physics", () => {
  it("jumps up and lands back on the floor", () => {
    const game = startMall();
    const p = game.mall.player;
    const startY = p.y;
    game.step(press("b"));
    expect(p.onGround).toBe(false);
    let minY = p.y;
    for (let i = 0; i < 60; i++) {
      game.step(empty());
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBeLessThan(startY); // went up
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(startY);
  });
});

describe("shooting", () => {
  it("fires a player bullet", () => {
    const game = startMall();
    game.step(press("a"));
    expect(game.mall.bullets.some((b) => b.from === "player")).toBe(true);
  });

  it("caps player bullets at 2", () => {
    const game = startMall();
    for (let i = 0; i < 10; i++) game.step(press("a"));
    const count = game.mall.bullets.filter((b) => b.from === "player").length;
    expect(count).toBeLessThanOrEqual(2);
  });
});

describe("scoring", () => {
  it("awards an extra life at 20000 points", () => {
    const game = startMall();
    const lives = game.lives;
    game.addScore(20000);
    expect(game.lives).toBe(lives + 1);
  });

  it("does not award the extra life twice", () => {
    const game = startMall();
    game.addScore(20000);
    game.addScore(20000);
    expect(game.lives).toBe(4); // 3 + 1
  });
});

describe("power-ups", () => {
  it("rapid fire replaces spread shot (one weapon slot)", () => {
    const game = startMall();
    game.applyPowerup("spread");
    expect(game.mall.player.weapon).toBe("spread");
    game.applyPowerup("rapid");
    expect(game.mall.player.weapon).toBe("rapid");
  });

  it("armor and radar stack with the weapon", () => {
    const game = startMall();
    game.applyPowerup("rapid");
    game.applyPowerup("armor");
    game.applyPowerup("radar");
    expect(game.mall.player.weapon).toBe("rapid");
    expect(game.mall.player.armor).toBe(true);
    expect(game.mall.player.radar).toBe(true);
  });

  it("1-up grants a life instantly", () => {
    const game = startMall();
    const lives = game.lives;
    game.applyPowerup("oneup");
    expect(game.lives).toBe(lives + 1);
  });
});

describe("Konami code", () => {
  it("activates Black Friday mode", () => {
    const game = new Game({ seed: 1, skipSplash: true });
    const seq = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    for (const b of seq) game.step(press(b));
    expect(game.blackFriday).toBe(true);
  });

  it("works with extra leading Up presses", () => {
    const game = new Game({ seed: 1, skipSplash: true });
    const seq = ["up", "up", "up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    for (const b of seq) game.step(press(b));
    expect(game.blackFriday).toBe(true);
  });
});

describe("level clear", () => {
  it("fires exactly once", () => {
    const game = startMall();
    for (const id of ["forever12", "radioshock", "kgbtoys", "sambaddy", "hotspy", "footlock"]) {
      game.packages.add(id);
    }
    game.triggerLevelClear();
    expect(game.mall.levelClearFired).toBe(true);
    expect(game.screen).toBe("levelclear");
    game.triggerLevelClear();
    expect(game.levelClear).not.toBeNull();
  });

  it("advances to the next loop", () => {
    const game = startMall();
    for (const id of ["forever12", "radioshock", "kgbtoys", "sambaddy", "hotspy", "footlock"]) {
      game.packages.add(id);
    }
    game.triggerLevelClear();
    const loop = game.loop;
    game.step(press("start"));
    expect(game.loop).toBe(loop + 1);
    expect(game.screen).toBe("mall");
  });
});

describe("continues", () => {
  it("shows the continue screen when lives run out and continues remain", () => {
    const game = startMall();
    game.lives = 1;
    game.continues = 3;
    game.playerDied();
    expect(game.screen).toBe("continue");
  });

  it("goes to game over when no continues remain", () => {
    const game = startMall();
    game.lives = 1;
    game.continues = 0;
    game.playerDied();
    expect(game.screen).toBe("gameover");
  });
});

describe("store searching", () => {
  it("a single tap of B starts a search on a touching fixture", () => {
    const game = startMall();
    game.enterStore("forever12");
    expect(game.screen).toBe("store");
    // Move the player next to a fixture, then tap B.
    // (The player starts at the door; fixtures are placed around the room.)
    const st = game.store!;
    const f = st.fixtures[0];
    st.player.x = f.x * 16;
    st.player.y = f.y * 16 + 16;
    game.step(press("b"));
    expect(st.searching).not.toBeNull();
  });

  it("searching reveals the fixture and marks it opened", () => {
    const game = startMall();
    game.enterStore("forever12");
    const st = game.store!;
    const f = st.fixtures[0];
    st.player.x = f.x * 16;
    st.player.y = f.y * 16 + 16;
    game.step(press("b"));
    for (let i = 0; i < 50; i++) game.step(empty());
    expect(f.opened).toBe(true);
    expect(st.searching).toBeNull();
  });
});
