import { describe, it, expect, beforeEach } from "vitest";
import { InputManager } from "../src/input/input";

describe("Input Manager & Konami Detector", () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  it("resets clean virtual pad state", () => {
    const pad = input.getPadState();
    expect(pad.up).toBe(false);
    expect(pad.down).toBe(false);
    expect(pad.a).toBe(false);
    expect(pad.b).toBe(false);
  });

  it("detects Konami code sequence (Up Up Down Down Left Right Left Right B A)", () => {
    // Simulate Konami sequence triggering
    const seq = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    seq.forEach((action) => {
      (input as unknown as { processKonamiInput: (a: string) => void }).processKonamiInput(action);
    });

    expect(input.konamiTriggered).toBe(true);
  });

  it("tolerates extra leading Up presses for Konami code", () => {
    const seq = ["up", "up", "up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
    seq.forEach((action) => {
      (input as unknown as { processKonamiInput: (a: string) => void }).processKonamiInput(action);
    });

    expect(input.konamiTriggered).toBe(true);
  });
});
