import { describe, it, expect } from "vitest";
import {
  RNG,
  FixedLoop,
  Input,
  mapKey,
  codeProgress,
  konami,
} from "../src/core";
import { sprites, validateArt, glyph } from "../src/art";
import { splash } from "../src/splash";
import {
  arrivalPosts,
  completePosts,
  firstLines,
  lastWords,
  liftWords,
  headlines,
  pa,
  wrap,
  ui,
} from "../src/copy";
describe("deterministic runtime", () => {
  it("reproduces seeded streams and stays in range", () => {
    const a = new RNG(918),
      b = new RNG(918);
    for (let i = 0; i < 10000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("runs sixty steps per second independent of rendering", () => {
    let n = 0;
    const l = new FixedLoop(() => n++);
    l.advance(0);
    for (let i = 1; i <= 144; i++) l.advance((i * 1000) / 144);
    expect(n).toBe(60);
  });
  it("caps delayed frame catch-up", () => {
    let n = 0;
    const l = new FixedLoop(() => n++);
    l.advance(0);
    expect(l.advance(5000)).toBe(5);
    expect(n).toBe(5);
  });
  it("maps printed letters across layouts and falls back physically", () => {
    expect(mapKey("z", "KeyY")).toBe("a");
    expect(mapKey("w", "KeyZ")).toBe("up");
    expect(mapKey("q", "KeyA")).toBe("left");
    expect(mapKey("a", "KeyQ")).toBe("left");
    expect(mapKey(" ", "Space")).toBe("b");
  });
  it("releases the exact pressed code after a layout or modifier change", () => {
    const p = new Input();
    p.down("z", "KeyY");
    p.up("KeyY");
    expect(p.sample().held.a).toBeUndefined();
  });
  it("multiple bindings cannot release each other", () => {
    const p = new Input();
    p.down("z", "KeyZ");
    p.down("j", "KeyJ");
    p.up("KeyZ");
    expect(p.sample().held.a).toBe(true);
  });
  it("retains multiple rapid tap edges across catch-up steps", () => {
    const p = new Input();
    for (let i = 0; i < 3; i++) {
      p.down("x", "KeyX");
      p.up("KeyX");
    }
    expect(p.sample().pressed.b).toBe(true);
    expect(p.sample().pressed.b).toBe(true);
    expect(p.sample().pressed.b).toBe(true);
    expect(p.sample().pressed.b).toBeUndefined();
  });
  it("preserves different-button tap order across one render frame", () => {
    const p = new Input();
    p.down("Shift", "ShiftLeft");
    p.up("ShiftLeft");
    p.down("x", "KeyX");
    p.up("KeyX");
    expect(p.sample().pressed).toEqual({ select: true });
    expect(p.sample().pressed).toEqual({ b: true });
  });
  it("ignores OS key repeat and clears input on lost focus", () => {
    const p = new Input();
    p.down("z", "KeyZ");
    p.down("z", "KeyZ", true);
    p.sample();
    expect(p.sample().pressed.a).toBeUndefined();
    p.clear();
    expect(p.sample().held).toEqual({});
  });
  it("handles merged pads and disconnects", () => {
    const p = new Input();
    const gamepad = {
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 })),
      axes: [-1, 0],
    } as unknown as Gamepad;
    p.poll([gamepad]);
    expect(p.sample()).toMatchObject({
      held: { left: true, a: true },
      pressed: { left: true },
    });
    expect(p.sample().pressed.a).toBe(true);
    p.poll([]);
    expect(p.sample().held).toEqual({});
  });
  it("recognizes Konami despite extra leading Ups", () => {
    let h: typeof konami = [];
    for (const b of ["up", "up", "up", ...konami] as typeof konami)
      h = codeProgress(h, b);
    expect(h).toEqual(konami);
  });
});
describe("source art and identity", () => {
  it("has valid dimensions and no more than three sprite colours", () =>
    expect(validateArt()).toBe(true));
  it("contains all required people and objects", () => {
    for (const name of [
      "agent0",
      "spy0",
      "bot",
      "walker",
      "janitor",
      "cop",
      "lamp",
      "disco",
      "package",
      "tv",
      "mannequin",
      "rack",
      "teddy",
      "robot",
      "rocket",
      "lava",
      "orb",
      "shoe",
      "ball",
      "record",
      "boombox",
      "cornDog",
      "lemonade",
      "chair",
      "vacuum",
      "console",
      "plant",
      "kiosk",
      "coin",
      "toy",
      "power",
    ])
      expect(sprites[name]).toBeDefined();
    for (const n of ["agent0", "spy0"])
      expect([sprites[n].w, sprites[n].h]).toEqual([16, 24]);
    for (const n of ["agentTop0", "spyTop0", "bot"])
      expect([sprites[n].w, sprites[n].h]).toEqual([16, 16]);
  });
  it("provides fifteen-bit source font glyphs", () => {
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?")
      expect(glyph(c)).toHaveLength(15);
  });
  it("flickers adjacent letters out of phase then settles at sixty", () => {
    expect(splash(0).letters[0].visible).not.toBe(splash(0).letters[1].visible);
    expect(splash(1).letters[0].visible).not.toBe(splash(0).letters[0].visible);
    expect(splash(60).letters.every((l) => l.visible)).toBe(true);
    expect(splash(60).jingle).toBe(true);
    expect(splash(61).jingle).toBe(false);
    expect(splash(179).done).toBe(false);
    expect(splash(180).done).toBe(true);
  });
});
describe("copy budgets", () => {
  it("fits all speech bubbles", () => {
    for (const s of [
      ...Object.values(firstLines).flat(),
      ...lastWords,
      ...liftWords,
    ])
      expect(s.length, s).toBeLessThanOrEqual(28);
  });
  it("fits storefront signs and shared UI copy", () => {
    for (const s of Object.values(ui))
      expect(s.length, s).toBeLessThanOrEqual(60);
  });
  it("fits SPYGRAM cards", () => {
    for (const p of [...arrivalPosts, ...completePosts]) {
      expect(p[0].split("|").length).toBeLessThanOrEqual(2);
      for (const line of p[0].split("|"))
        expect(line.length, line).toBeLessThanOrEqual(21);
      expect(p[1].length, p[1]).toBeLessThanOrEqual(21);
    }
  });
  it("fits newspaper columns and wraps every PA announcement", () => {
    for (const h of headlines)
      for (const s of h.split("|")) expect(s.length, s).toBeLessThanOrEqual(26);
    for (const s of pa)
      for (const l of wrap(s, 55)) expect(l.length).toBeLessThanOrEqual(55);
  });
});
