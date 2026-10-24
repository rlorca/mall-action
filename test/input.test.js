import { describe, expect, it } from "vitest";
import { VirtualPad, keyToButton, konamiMatches, KonamiDetector } from "../src/core/input.js";

const key = (key, code) => ({ key, code });

describe("virtual NES input", () => {
  it("uses printed letters on AZERTY and QWERTZ", () => {
    expect(keyToButton(key("a", "KeyQ"))).toBe("left");
    expect(keyToButton(key("z", "KeyY"))).toBe("a");
    expect(keyToButton(key("w", "KeyZ"))).toBe("up");
    expect(keyToButton(key("ArrowUp", "ArrowUp"))).toBe("up");
  });
  it("falls back to physical position for unmapped letters", () => {
    expect(keyToButton(key("q", "KeyW"))).toBe("up");
    expect(keyToButton(key("u", "KeyZ"))).toBe("a");
  });
  it("releases exactly the pressed token and never sticks a logical button", () => {
    const pad = new VirtualPad();
    pad.keyDown(key("z", "KeyZ")); pad.keyDown(key("j", "KeyJ"));
    expect(pad.sample().a).toBe(true);
    pad.keyUp(key("z", "KeyZ")); expect(pad.sample().a).toBe(true);
    pad.keyUp(key("j", "KeyJ")); expect(pad.sample().a).toBe(false);
    pad.keyUp(key("j", "KeyJ")); expect(pad.tokens.size).toBe(0);
  });
  it("retains fast repeated taps over several catch-up steps", () => {
    const pad = new VirtualPad();
    pad.keyDown(key("z", "KeyZ")); pad.keyUp(key("z", "KeyZ"));
    pad.keyDown(key("z", "KeyZ")); pad.keyUp(key("z", "KeyZ"));
    const first = pad.sample(), second = pad.sample();
    expect(first.aPressed).toBe(true); expect(second.aPressed).toBe(true);
    expect(pad.sample().aPressed).toBe(false);
  });
  it("merges gamepad edges and handles disconnection", () => {
    const pad = new VirtualPad();
    const gamepad = { connected: true, buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0] };
    gamepad.buttons[0].pressed = true; pad.pollGamepads([gamepad]);
    expect(pad.sample().aPressed).toBe(true);
    pad.pollGamepads([]); expect(pad.sample().aReleased).toBe(true);
    expect(pad.held.a).toBe(false);
  });
});

describe("Konami code", () => {
  const code = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
  it("detects the code", () => { expect(konamiMatches(code)).toBe(true); });
  it("accepts extra leading Ups", () => { expect(konamiMatches(["up", "up", "up", "up", ...code])).toBe(true); });
  it("rejects a wrong ending and resets after success", () => {
    expect(konamiMatches([...code.slice(0, -1), "b"])).toBe(false);
    const detector = new KonamiDetector();
    code.forEach((button) => detector.push(button));
    expect(detector.sequence).toHaveLength(0);
  });
});
