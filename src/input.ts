// Input mapping: keyboard + gamepad merged into a virtual NES pad.
//   Up, Down, Left, Right, A, B, Select, Start.
//
// Rules (tested):
//   - Letter keys match the *printed* letter (QWERTZ/AZERTY safe).
//   - Non-letter keys match by physical position (event.code).
//   - Unmapped letters fall back to physical position.
//   - A key release clears exactly the key that was pressed (no stuck keys).
//   - Fast repeated taps are queued, never lost across simulation steps.

export type Button =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "select"
  | "start";

export const ALL_BUTTONS: Button[] = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "select",
  "start",
];

// Printed-letter -> button (lowercase).
const LETTER_MAP: Record<string, Button> = {
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  z: "a",
  j: "a",
  x: "b",
  k: "b",
};

// Physical position (event.code) -> button. Covers non-letter keys and the
// fallback for unmapped letters (QWERTY positions of WASD).
const CODE_MAP: Record<string, Button> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Space: "b",
  ShiftLeft: "select",
  ShiftRight: "select",
  Tab: "select",
  Enter: "start",
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
};

/** Resolve a keyboard event to a virtual button (or null). */
export function resolveKey(key: string, code: string): Button | null {
  const k = key.toLowerCase();
  if (k.length === 1 && k >= "a" && k <= "z") {
    const byLetter = LETTER_MAP[k];
    if (byLetter) return byLetter;
    return CODE_MAP[code] ?? null;
  }
  return CODE_MAP[code] ?? null;
}

export interface PadFrame {
  held: ReadonlySet<Button>;
  /** Edge-triggered presses this step (in order). */
  pressed: Button[];
  /** Edge-triggered releases this step (in order). */
  released: Button[];
}

/**
 * The virtual pad. Tracks which physical keys are held so that releasing one
 * of several keys bound to the same button never clears the button while
 * another is still held.
 */
export class VirtualPad {
  private held = new Set<Button>();
  private keyHeld = new Map<string, Button>();
  private pressQueue: Button[] = [];
  private releaseQueue: Button[] = [];

  /** A physical key went down. `id` is a stable per-key id (event.code). */
  keyDown(id: string, button: Button): void {
    if (this.keyHeld.has(id)) return;
    this.keyHeld.set(id, button);
    if (!this.held.has(button)) {
      this.held.add(button);
      this.pressQueue.push(button);
    }
  }

  /** A physical key went up. */
  keyUp(id: string): void {
    const button = this.keyHeld.get(id);
    if (button === undefined) return;
    this.keyHeld.delete(id);
    let stillHeld = false;
    for (const b of this.keyHeld.values()) {
      if (b === button) {
        stillHeld = true;
        break;
      }
    }
    if (!stillHeld) {
      this.held.delete(button);
      this.releaseQueue.push(button);
    }
  }

  /** Programmatic press (gamepad). */
  press(button: Button): void {
    if (!this.held.has(button)) {
      this.held.add(button);
      this.pressQueue.push(button);
    }
  }

  /** Programmatic release (gamepad). */
  release(button: Button): void {
    if (this.held.has(button)) {
      this.held.delete(button);
      this.releaseQueue.push(button);
    }
  }

  /** Take a snapshot of the current state and drain the edge queues. */
  sample(): PadFrame {
    const pressed = this.pressQueue.slice();
    const released = this.releaseQueue.slice();
    this.pressQueue = [];
    this.releaseQueue = [];
    return { held: this.held, pressed, released };
  }

  isHeld(button: Button): boolean {
    return this.held.has(button);
  }
}

// Gamepad button indices (standard mapping).
export const GAMEPAD = {
  a: 0,
  b: 1,
  select: 8,
  start: 9,
} as const;

/** Translate a gamepad snapshot into pad presses/releases. */
export function applyGamepad(
  pad: VirtualPad,
  gp: Gamepad | null,
): { axes: [number, number]; buttons: boolean[] } | null {
  if (!gp) return null;
  const axes: [number, number] = [gp.axes[0] ?? 0, gp.axes[1] ?? 0];
  const buttons = gp.buttons.map((b) => b.pressed);

  const set = (btn: Button, on: boolean) => {
    if (on) pad.press(btn);
    else pad.release(btn);
  };

  // D-pad (buttons 12-15) and left stick.
  const dpadUp = buttons[12] ?? false;
  const dpadDown = buttons[13] ?? false;
  const dpadLeft = buttons[14] ?? false;
  const dpadRight = buttons[15] ?? false;
  const stickX = axes[0];
  const stickY = axes[1];
  const dead = 0.5;

  set("up", dpadUp || stickY < -dead);
  set("down", dpadDown || stickY > dead);
  set("left", dpadLeft || stickX < -dead);
  set("right", dpadRight || stickX > dead);
  set("a", buttons[GAMEPAD.a] ?? false);
  set("b", buttons[GAMEPAD.b] ?? false);
  set("select", buttons[GAMEPAD.select] ?? false);
  set("start", buttons[GAMEPAD.start] ?? false);

  return { axes, buttons };
}
