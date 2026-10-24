import { BUTTONS } from "./constants.js";

const LETTER_BINDINGS = Object.freeze({
  w: "up", s: "down", a: "left", d: "right",
  z: "a", j: "a", x: "b", k: "b", " ": "b",
  c: "crt", m: "mute",
});
const CODE_BINDINGS = Object.freeze({
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
  KeyZ: "a", KeyJ: "a", KeyX: "b", KeyK: "b", Space: "b",
  ShiftLeft: "select", ShiftRight: "select", Tab: "select", Enter: "start",
  NumpadEnter: "start", KeyC: "crt", KeyM: "mute",
});

/** Letters use the printed key, while arrows/enter/etc. use physical codes. */
export function keyToButton(event) {
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (Object.hasOwn(LETTER_BINDINGS, key)) return LETTER_BINDINGS[key];
  if (key === "shift" || key === "tab" || key === "enter") {
    return key === "shift" || key === "tab" ? "select" : "start";
  }
  return CODE_BINDINGS[event.code] || null;
}

export const emptyButtons = () => Object.fromEntries(BUTTONS.map((button) => [button, false]));

/**
 * A small input queue. Key-up removes the exact physical token that was pressed;
 * a tap is queued independently of held state, so catch-up steps cannot eat it.
 */
export class VirtualPad {
  constructor() {
    this.held = emptyButtons();
    this.tokens = new Map();
    this.edges = [];
    this.gamepadHeld = emptyButtons();
  }

  press(button, token = button) {
    if (!button) return;
    if (this.tokens.has(token)) return;
    this.tokens.set(token, button);
    if (BUTTONS.includes(button) && !this.held[button]) this.edges.push({ button, type: "pressed" });
    this.held[button] = true;
  }

  release(token) {
    const button = this.tokens.get(token);
    if (!button) return;
    this.tokens.delete(token);
    // Another key/gamepad may still hold this logical button.
    if (![...this.tokens.values()].includes(button)) this.held[button] = false;
    if (BUTTONS.includes(button)) this.edges.push({ button, type: "released" });
  }

  keyDown(event) {
    const button = keyToButton(event);
    if (!button) return null;
    this.press(button, event.code || `key:${event.key}`);
    return button;
  }

  keyUp(event) {
    const token = event.code || `key:${event.key}`;
    const button = this.tokens.get(token) || keyToButton(event);
    this.release(token);
    return button;
  }

  pollGamepads(gamepads = []) {
    const next = emptyButtons();
    for (const pad of gamepads) {
      if (!pad || !pad.connected) continue;
      const b = pad.buttons || [];
      const axisX = pad.axes?.[0] || 0;
      const axisY = pad.axes?.[1] || 0;
      next.left ||= !!b[14]?.pressed || axisX < -0.35;
      next.right ||= !!b[15]?.pressed || axisX > 0.35;
      next.up ||= !!b[12]?.pressed || axisY < -0.35;
      next.down ||= !!b[13]?.pressed || axisY > 0.35;
      next.a ||= !!b[0]?.pressed;
      next.b ||= !!b[1]?.pressed;
      next.select ||= !!b[8]?.pressed;
      next.start ||= !!b[9]?.pressed;
    }
    for (const button of BUTTONS) {
      if (next[button] && !this.gamepadHeld[button]) this.press(button, `gamepad:${button}`);
      if (!next[button] && this.gamepadHeld[button]) this.release(`gamepad:${button}`);
    }
    this.gamepadHeld = next;
  }

  sample() {
    const result = { ...this.held };
    for (const button of BUTTONS) {
      // Consume one edge of each kind per simulation step, retaining extra taps.
      const pressed = this.edges.findIndex((edge) => edge.button === button && edge.type === "pressed");
      const released = this.edges.findIndex((edge) => edge.button === button && edge.type === "released");
      result[`${button}Pressed`] = pressed >= 0;
      result[`${button}Released`] = released >= 0;
      if (pressed >= 0) this.edges.splice(pressed, 1);
      if (released >= 0) this.edges.splice(released > pressed && pressed >= 0 ? released - 1 : released, 1);
    }
    return result;
  }

  clear() {
    this.tokens.clear();
    this.edges.length = 0;
    this.held = emptyButtons();
    this.gamepadHeld = emptyButtons();
  }
}

export function konamiMatches(sequence) {
  const code = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
  // Leading Ups are harmless; this also handles a player leaning on Up first.
  let start = 0;
  while (sequence[start] === "up" && start < sequence.length - code.length) start++;
  const tail = sequence.slice(start, start + code.length);
  return tail.length === code.length && tail.every((button, i) => button === code[i]);
}

export class KonamiDetector {
  constructor() { this.sequence = []; }
  push(button) {
    this.sequence.push(button);
    if (this.sequence.length > 32) this.sequence.shift();
    if (konamiMatches(this.sequence)) {
      this.sequence.length = 0;
      return true;
    }
    return false;
  }
}
