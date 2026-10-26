import { describe, it, expect } from "vitest";
import { resolveKey, VirtualPad } from "../src/input";
import type { Button } from "../src/input";

describe("resolveKey", () => {
  it("maps WASD letters by printed letter", () => {
    expect(resolveKey("w", "KeyW")).toBe("up");
    expect(resolveKey("s", "KeyS")).toBe("down");
    expect(resolveKey("a", "KeyA")).toBe("left");
    expect(resolveKey("d", "KeyD")).toBe("right");
  });

  it("maps action letters", () => {
    expect(resolveKey("z", "KeyZ")).toBe("a");
    expect(resolveKey("j", "KeyJ")).toBe("a");
    expect(resolveKey("x", "KeyX")).toBe("b");
    expect(resolveKey("k", "KeyK")).toBe("b");
  });

  it("maps non-letter keys by physical position", () => {
    expect(resolveKey("ArrowUp", "ArrowUp")).toBe("up");
    expect(resolveKey(" ", "Space")).toBe("b");
    expect(resolveKey("Enter", "Enter")).toBe("start");
    expect(resolveKey("Shift", "ShiftLeft")).toBe("select");
    expect(resolveKey("Tab", "Tab")).toBe("select");
  });

  it("falls back to physical position for unmapped letters", () => {
    // A letter not in the letter map (e.g. 'q') falls back to its code.
    expect(resolveKey("q", "KeyW")).toBe("up");
    expect(resolveKey("q", "KeyA")).toBe("left");
  });

  it("returns null for unmapped keys", () => {
    expect(resolveKey("p", "KeyP")).toBeNull();
    expect(resolveKey("F1", "F1")).toBeNull();
  });
});

describe("VirtualPad", () => {
  it("reports a press edge exactly once", () => {
    const pad = new VirtualPad();
    pad.keyDown("KeyZ", "a");
    const f1 = pad.sample();
    expect(f1.pressed).toEqual(["a"]);
    expect(f1.held.has("a")).toBe(true);
    const f2 = pad.sample();
    expect(f2.pressed).toEqual([]);
  });

  it("does not clear a button while another key for it is held", () => {
    const pad = new VirtualPad();
    pad.keyDown("KeyZ", "a");
    pad.keyDown("KeyJ", "a");
    pad.keyUp("KeyZ");
    const f = pad.sample();
    expect(f.held.has("a")).toBe(true);
    expect(f.released).toEqual([]);
    pad.keyUp("KeyJ");
    const f2 = pad.sample();
    expect(f2.held.has("a")).toBe(false);
    expect(f2.released).toEqual(["a"]);
  });

  it("clears exactly the key that was pressed", () => {
    const pad = new VirtualPad();
    pad.keyDown("KeyZ", "a");
    pad.keyDown("KeyX", "b");
    pad.keyUp("KeyZ");
    const f = pad.sample();
    expect(f.held.has("a")).toBe(false);
    expect(f.held.has("b")).toBe(true);
  });

  it("queues fast taps so they are not lost", () => {
    const pad = new VirtualPad();
    // Press and release within a single sample window.
    pad.keyDown("KeyZ", "a");
    pad.keyUp("KeyZ");
    pad.keyDown("KeyZ", "a");
    pad.keyUp("KeyZ");
    const f = pad.sample();
    expect(f.pressed).toEqual(["a", "a"]);
    expect(f.released).toEqual(["a", "a"]);
  });

  it("ignores repeated keyDown for the same key", () => {
    const pad = new VirtualPad();
    pad.keyDown("KeyZ", "a");
    pad.keyDown("KeyZ", "a");
    const f = pad.sample();
    expect(f.pressed).toEqual(["a"]);
  });

  it("supports programmatic press/release (gamepad)", () => {
    const pad = new VirtualPad();
    pad.press("up");
    expect(pad.sample().pressed).toEqual(["up"]);
    pad.release("up");
    expect(pad.sample().released).toEqual(["up"]);
  });
});

describe("button type", () => {
  it("has the eight NES buttons", () => {
    const buttons: Button[] = ["up", "down", "left", "right", "a", "b", "select", "start"];
    expect(buttons).toHaveLength(8);
  });
});
