// Keyboard + gamepad merged into one virtual NES pad.
// Pure: the browser glue (key events, Gamepad API polling) lives in src/input-browser.ts.

export type Pad = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';
export type SystemAction = 'crt' | 'mute';
export type InputAction = { kind: 'pad'; pad: Pad } | { kind: 'system'; action: SystemAction };

export const PADS: readonly Pad[] = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

/** Printed-letter bindings. Matched on the key's character, so QWERTZ / AZERTY work. */
const LETTER_BINDINGS: Readonly<Record<string, InputAction>> = {
  w: { kind: 'pad', pad: 'up' },
  s: { kind: 'pad', pad: 'down' },
  a: { kind: 'pad', pad: 'left' },
  d: { kind: 'pad', pad: 'right' },
  z: { kind: 'pad', pad: 'a' },
  j: { kind: 'pad', pad: 'a' },
  x: { kind: 'pad', pad: 'b' },
  k: { kind: 'pad', pad: 'b' },
  c: { kind: 'system', action: 'crt' },
  m: { kind: 'system', action: 'mute' },
};

/** Physical-position bindings, used for non-letter keys and as the fallback for unmapped letters. */
const CODE_BINDINGS: Readonly<Record<string, InputAction>> = {
  ArrowUp: { kind: 'pad', pad: 'up' },
  ArrowDown: { kind: 'pad', pad: 'down' },
  ArrowLeft: { kind: 'pad', pad: 'left' },
  ArrowRight: { kind: 'pad', pad: 'right' },
  KeyW: { kind: 'pad', pad: 'up' },
  KeyS: { kind: 'pad', pad: 'down' },
  KeyA: { kind: 'pad', pad: 'left' },
  KeyD: { kind: 'pad', pad: 'right' },
  KeyZ: { kind: 'pad', pad: 'a' },
  KeyJ: { kind: 'pad', pad: 'a' },
  KeyX: { kind: 'pad', pad: 'b' },
  KeyK: { kind: 'pad', pad: 'b' },
  Space: { kind: 'pad', pad: 'b' },
  ShiftLeft: { kind: 'pad', pad: 'select' },
  ShiftRight: { kind: 'pad', pad: 'select' },
  Tab: { kind: 'pad', pad: 'select' },
  Enter: { kind: 'pad', pad: 'start' },
  NumpadEnter: { kind: 'pad', pad: 'start' },
  KeyC: { kind: 'system', action: 'crt' },
  KeyM: { kind: 'system', action: 'mute' },
};

/** Resolve a key press to an action. Letters use the printed character; everything else the physical code. */
export function resolveKey(code: string, key: string): InputAction | null {
  if (key.length === 1 && /[a-z]/i.test(key)) {
    const byLetter = LETTER_BINDINGS[key.toLowerCase()];
    if (byLetter) return byLetter;
  }
  return CODE_BINDINGS[code] ?? null;
}

/** Keys that the page should not scroll or act on by default. */
export function isGameKey(code: string): boolean {
  return code in CODE_BINDINGS || code.startsWith('Arrow') || code === 'Space';
}

export interface StepInput {
  /** Pads held down right now (level-triggered). */
  held: ReadonlySet<Pad>;
  /** Pads pressed since the previous simulation step (edge-triggered). Never lost to a fast tap. */
  pressed: readonly Pad[];
}

const MAX_QUEUED_PRESSES = 32;

export class InputMapper {
  /** keyboard physical code -> pad it pressed. Release clears exactly that pad. */
  private keyboardHeld = new Map<string, Pad>();
  private sourceCount = new Map<Pad, number>();
  private gamepadHeld = new Set<Pad>();
  private queue: Pad[] = [];
  private systemQueue: SystemAction[] = [];

  /** Returns a system action to handle immediately (CRT / mute), or null. */
  keyDown(code: string, key: string, repeat = false): SystemAction | null {
    const action = resolveKey(code, key);
    if (!action) return null;
    if (action.kind === 'system') {
      if (!repeat) this.systemQueue.push(action.action);
      return null;
    }
    if (this.keyboardHeld.has(code)) return null; // already down (auto-repeat)
    this.keyboardHeld.set(code, action.pad);
    this.bump(action.pad, 1);
    if (!repeat) this.pushPress(action.pad);
    return null;
  }

  keyUp(code: string): void {
    const pad = this.keyboardHeld.get(code);
    if (pad === undefined) return;
    this.keyboardHeld.delete(code);
    this.bump(pad, -1);
  }

  setGamepadPad(pad: Pad, down: boolean): void {
    if (down === this.gamepadHeld.has(pad)) return;
    if (down) {
      this.gamepadHeld.add(pad);
      this.bump(pad, 1);
      this.pushPress(pad);
    } else {
      this.gamepadHeld.delete(pad);
      this.bump(pad, -1);
    }
  }

  /** Drop all held state (window blur, tab hidden) so nothing sticks. */
  releaseAll(): void {
    this.keyboardHeld.clear();
    this.gamepadHeld.clear();
    this.sourceCount.clear();
  }

  isHeld(pad: Pad): boolean {
    return (this.sourceCount.get(pad) ?? 0) > 0;
  }

  /** Snapshot for one simulation step. Drains the press queue so each tap is seen by exactly one step. */
  takeStep(): StepInput {
    const held = new Set<Pad>();
    for (const pad of PADS) if (this.isHeld(pad)) held.add(pad);
    const pressed = this.queue;
    this.queue = [];
    return { held, pressed };
  }

  /** System toggles (CRT / mute) pressed since last call. */
  takeSystemActions(): SystemAction[] {
    const out = this.systemQueue;
    this.systemQueue = [];
    return out;
  }

  private bump(pad: Pad, delta: number): void {
    const next = Math.max(0, (this.sourceCount.get(pad) ?? 0) + delta);
    this.sourceCount.set(pad, next);
  }

  private pushPress(pad: Pad): void {
    if (this.queue.length < MAX_QUEUED_PRESSES) this.queue.push(pad);
  }
}
