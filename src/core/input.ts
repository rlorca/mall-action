/**
 * Input: keyboard + gamepad merged into one virtual NES pad.
 *
 * Three separable pieces so the rules stay testable without a browser:
 *   - Button          : the bit flags.
 *   - Pad             : pure edge detection over a held-mask. No DOM.
 *   - InputSource     : accumulates raw edges into per-step samples. No DOM.
 * The DOM listeners live in src/render/keyboard.ts and only feed InputSource.
 */

export const Button = {
  Up: 1 << 0,
  Down: 1 << 1,
  Left: 1 << 2,
  Right: 1 << 3,
  A: 1 << 4,
  B: 1 << 5,
  Select: 1 << 6,
  Start: 1 << 7,
} as const;

export type Button = (typeof Button)[keyof typeof Button];

export const ALL_BUTTONS = [
  Button.Up,
  Button.Down,
  Button.Left,
  Button.Right,
  Button.A,
  Button.B,
  Button.Select,
  Button.Start,
] as const;

export const BUTTON_NAMES: Record<number, string> = {
  [Button.Up]: 'Up',
  [Button.Down]: 'Down',
  [Button.Left]: 'Left',
  [Button.Right]: 'Right',
  [Button.A]: 'A',
  [Button.B]: 'B',
  [Button.Select]: 'Select',
  [Button.Start]: 'Start',
};

/** System toggles that are not pad buttons. */
export type SystemKey = 'crt' | 'mute';

// ---------------------------------------------------------------------------
// Pad: pure edge detection
// ---------------------------------------------------------------------------

export class Pad {
  held = 0;
  prev = 0;

  /** Advance one simulation step with a freshly sampled held-mask. */
  update(mask: number): void {
    this.prev = this.held;
    this.held = mask;
  }

  down(b: Button): boolean {
    return (this.held & b) !== 0;
  }

  /** Rising edge this step. */
  pressed(b: Button): boolean {
    return (this.held & b) !== 0 && (this.prev & b) === 0;
  }

  /** Falling edge this step. */
  released(b: Button): boolean {
    return (this.held & b) === 0 && (this.prev & b) !== 0;
  }

  anyPressed(): boolean {
    return (this.held & ~this.prev) !== 0;
  }

  reset(): void {
    this.held = 0;
    this.prev = 0;
  }
}

// ---------------------------------------------------------------------------
// InputSource: raw edges -> per-simulation-step samples
// ---------------------------------------------------------------------------

/**
 * Bridges real time (events arrive whenever) and the fixed 60 Hz simulation
 * (which may run several steps in one rendered frame, or none).
 *
 * The problem it solves: a fast tap where keydown AND keyup both land between
 * two simulation steps would be invisible to a naive `liveMask` sample. So any
 * button pressed since the last sample is OR'd into the next sample exactly
 * once. The tap is then guaranteed to produce a rising edge, and because the
 * sticky bits are cleared on sample it can never latch a button on.
 */
export class InputSource {
  /** Buttons physically down right now. */
  private liveMask = 0;
  /** Buttons that saw a press since the last sample() but may already be up. */
  private stickyPressed = 0;
  /** code -> button mask assigned at keydown, so keyup clears exactly that. */
  private codeToMask = new Map<string, number>();
  private systemQueue: SystemKey[] = [];

  press(mask: number): void {
    if (mask === 0) return;
    this.liveMask |= mask;
    this.stickyPressed |= mask;
  }

  release(mask: number): void {
    this.liveMask &= ~mask;
  }

  /**
   * Press by physical code. The mask resolved at keydown is remembered so that
   * releaseCode() clears exactly what was pressed even if the keyboard layout
   * or modifier state changed while the key was held.
   */
  pressCode(code: string, mask: number): void {
    const existing = this.codeToMask.get(code);
    if (existing !== undefined) {
      // Auto-repeat: already tracked, nothing new to do.
      this.liveMask |= existing;
      return;
    }
    this.codeToMask.set(code, mask);
    this.press(mask);
  }

  releaseCode(code: string): void {
    const mask = this.codeToMask.get(code);
    if (mask === undefined) return;
    this.codeToMask.delete(code);
    // Only clear bits no OTHER still-held code is also asserting, so releasing
    // Z while J is still down does not drop the A button.
    let stillHeld = 0;
    for (const m of this.codeToMask.values()) stillHeld |= m;
    this.release(mask & ~stillHeld);
  }

  pushSystem(key: SystemKey): void {
    this.systemQueue.push(key);
  }

  drainSystem(): SystemKey[] {
    if (this.systemQueue.length === 0) return [];
    const out = this.systemQueue;
    this.systemQueue = [];
    return out;
  }

  /** Extra held-mask merged in each sample, e.g. from a gamepad poll. */
  external = 0;

  /** Take one simulation step's worth of input. */
  sample(): number {
    const m = this.liveMask | this.stickyPressed | this.external;
    this.stickyPressed = 0;
    return m;
  }

  /** Window blur, or anything else that means "forget everything". */
  clearAll(): void {
    this.liveMask = 0;
    this.stickyPressed = 0;
    this.external = 0;
    this.codeToMask.clear();
  }

  /** Test/debug visibility. */
  get debugLive(): number {
    return this.liveMask;
  }
}

// ---------------------------------------------------------------------------
// Key mapping
// ---------------------------------------------------------------------------

/**
 * Letters are matched by their PRINTED value (event.key), so QWERTZ and AZERTY
 * players get the same physical-feeling layout as QWERTY ones.
 */
export const LETTER_MAP: Record<string, number> = {
  w: Button.Up,
  a: Button.Left,
  s: Button.Down,
  d: Button.Right,
  z: Button.A,
  j: Button.A,
  x: Button.B,
  k: Button.B,
};

export const LETTER_SYSTEM: Record<string, SystemKey> = {
  c: 'crt',
  m: 'mute',
};

/** Non-letter keys are matched by physical position (event.code). */
export const CODE_MAP: Record<string, number> = {
  ArrowUp: Button.Up,
  ArrowDown: Button.Down,
  ArrowLeft: Button.Left,
  ArrowRight: Button.Right,
  Space: Button.B,
  Enter: Button.Start,
  NumpadEnter: Button.Start,
  ShiftLeft: Button.Select,
  ShiftRight: Button.Select,
  Tab: Button.Select,
};

/** `KeyQ` -> `q`. Returns '' for non-letter codes. */
export function letterFromCode(code: string): string {
  if (code.length === 4 && code.startsWith('Key')) return code[3].toLowerCase();
  return '';
}

export interface Resolved {
  mask: number;
  system: SystemKey | null;
}

/**
 * Resolve a key event to a pad mask and/or a system toggle.
 *
 * Order: printed letter first (layout-friendly), then physical position. An
 * unmapped printed letter falls back to the letter its physical position would
 * carry on QWERTY, so the QWERTZ Z key still works as the A button.
 */
export function resolveKey(key: string, code: string): Resolved {
  const printed = key.length === 1 ? key.toLowerCase() : '';
  if (printed && LETTER_MAP[printed] !== undefined) {
    return { mask: LETTER_MAP[printed], system: null };
  }
  if (printed && LETTER_SYSTEM[printed] !== undefined) {
    return { mask: 0, system: LETTER_SYSTEM[printed] };
  }
  if (CODE_MAP[code] !== undefined) {
    return { mask: CODE_MAP[code], system: null };
  }
  // Unmapped letter: fall back to physical position.
  const positional = letterFromCode(code);
  if (positional && LETTER_MAP[positional] !== undefined) {
    return { mask: LETTER_MAP[positional], system: null };
  }
  if (positional && LETTER_SYSTEM[positional] !== undefined) {
    return { mask: 0, system: LETTER_SYSTEM[positional] };
  }
  return { mask: 0, system: null };
}

// ---------------------------------------------------------------------------
// Gamepad
// ---------------------------------------------------------------------------

export const GAMEPAD_BUTTON_MAP: Record<number, number> = {
  0: Button.A,
  1: Button.B,
  8: Button.Select,
  9: Button.Start,
  12: Button.Up,
  13: Button.Down,
  14: Button.Left,
  15: Button.Right,
};

export const STICK_DEADZONE = 0.4;

export interface GamepadLike {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

/** Pure: reduce a gamepad snapshot to a held-mask. */
export function gamepadMask(gp: GamepadLike | null | undefined): number {
  if (!gp) return 0;
  let mask = 0;
  for (const idxStr of Object.keys(GAMEPAD_BUTTON_MAP)) {
    const idx = Number(idxStr);
    if (gp.buttons[idx]?.pressed) mask |= GAMEPAD_BUTTON_MAP[idx];
  }
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  if (ax < -STICK_DEADZONE) mask |= Button.Left;
  if (ax > STICK_DEADZONE) mask |= Button.Right;
  if (ay < -STICK_DEADZONE) mask |= Button.Up;
  if (ay > STICK_DEADZONE) mask |= Button.Down;
  return mask;
}
