import { BUTTONS, Button, PadFrame, PadState, emptyPad } from './pad';

/**
 * Keyboard + gamepad -> virtual NES pad.
 *
 * Letter keys bind to the PRINTED letter (event.key), so QWERTZ / AZERTY work. Other keys bind by physical
 * position (event.code). A letter that has no binding (e.g. a Cyrillic layout) falls back to its physical
 * position. A key release clears exactly the button the matching key press set (we remember code -> button),
 * so a layout / modifier change between press and release can never leave a button stuck.
 */
export const LETTER_BINDINGS: Record<string, Button> = {
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  z: 'a',
  j: 'a',
  x: 'b',
  k: 'b',
};

export const CODE_BINDINGS: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'b',
  ShiftLeft: 'select',
  ShiftRight: 'select',
  Tab: 'select',
  Enter: 'start',
  NumpadEnter: 'start',
};

/** Physical-position (QWERTY) letter for a KeyboardEvent.code like "KeyW". */
function codeLetter(code: string): string | null {
  const m = /^Key([A-Z])$/.exec(code);
  return m ? m[1].toLowerCase() : null;
}

export interface KeyLike {
  key: string;
  code: string;
}

export function resolveButton(e: KeyLike): Button | null {
  if (e.key.length === 1) {
    const k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) {
      // A latin printed letter: bind by that letter only. Never fall back to position: on AZERTY the physical
      // KeyW prints "z", which must act as "z" (shoot), not as "w".
      return LETTER_BINDINGS[k] ?? null;
    }
    if (k !== ' ' && /\p{L}/u.test(k)) {
      // Non-latin letter (Cyrillic, Greek...): the printed letter has no binding, fall back to the physical key.
      const l = codeLetter(e.code);
      return l ? (LETTER_BINDINGS[l] ?? null) : null;
    }
  }
  return CODE_BINDINGS[e.code] ?? null;
}

export class InputMapper {
  /** code -> button for keys currently held (release clears exactly this). */
  private downKeys = new Map<string, Button>();
  /** gamepad-held buttons. */
  private padHeld: PadState = emptyPad();
  /** Taps queued since the last step (so a tap shorter than a step is not lost). */
  private queued: Record<Button, number> = { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0, select: 0, start: 0 };
  private prev: PadState = emptyPad();
  /** Called on any physical button/key press (audio unlock, skip splash...). */
  onAnyPress?: () => void;

  keyDown(e: KeyLike & { repeat?: boolean }): Button | null {
    const btn = resolveButton(e);
    if (!btn) return null;
    if (e.repeat && this.downKeys.has(e.code)) return btn;
    if (!this.downKeys.has(e.code)) {
      // A second key for a button that is already held is not a new tap.
      if (!this.isDown(btn)) this.queued[btn]++;
      this.downKeys.set(e.code, btn);
      this.onAnyPress?.();
    }
    return btn;
  }

  keyUp(e: { code: string }): void {
    this.downKeys.delete(e.code);
  }

  /** Update gamepad state (called once per rendered frame with the merged pad). */
  setGamepad(state: PadState): void {
    for (const b of BUTTONS) {
      if (state[b] && !this.padHeld[b]) {
        if (!this.isDown(b)) this.queued[b]++;
        this.onAnyPress?.();
      }
    }
    this.padHeld = { ...state };
  }

  /** Drop everything (window blur, gamepad disconnect, etc). */
  releaseAll(): void {
    this.downKeys.clear();
    this.padHeld = emptyPad();
    for (const b of BUTTONS) this.queued[b] = 0;
  }

  private isDown(b: Button): boolean {
    if (this.padHeld[b]) return true;
    for (const v of this.downKeys.values()) if (v === b) return true;
    return false;
  }

  /**
   * Produce the pad for ONE simulation step. A queued tap becomes one step of "held", then a one-step gap
   * (if the key is already up) so that several taps landing in one rendered frame still yield several
   * distinct presses across the steps that frame runs.
   */
  sample(): PadFrame {
    const held = emptyPad();
    const pressed = emptyPad();
    for (const b of BUTTONS) {
      const down = this.isDown(b);
      let h = down;
      if (this.queued[b] > 0) {
        if (!this.prev[b]) {
          this.queued[b]--;
          h = true;
        } else if (!down) {
          h = false; // release gap so the next queued tap is a fresh press
        } else {
          h = true;
          this.queued[b] = 0; // still held; extra queued taps merge into the hold
        }
      }
      held[b] = h;
      pressed[b] = h && !this.prev[b];
    }
    this.prev = { ...held };
    return { held, pressed };
  }
}

/** Merge the standard-mapping gamepad(s) into one virtual pad. */
export function padFromGamepads(pads: ReadonlyArray<{ buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number> } | null>): PadState {
  const out = emptyPad();
  for (const gp of pads) {
    if (!gp) continue;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    if (btn(0)) out.a = true;
    if (btn(1)) out.b = true;
    if (btn(8)) out.select = true;
    if (btn(9)) out.start = true;
    if (btn(12)) out.up = true;
    if (btn(13)) out.down = true;
    if (btn(14)) out.left = true;
    if (btn(15)) out.right = true;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    if (ax < -0.5) out.left = true;
    if (ax > 0.5) out.right = true;
    if (ay < -0.5) out.up = true;
    if (ay > 0.5) out.down = true;
  }
  return out;
}

/**
 * The letter a key stands for: the PRINTED letter on latin layouts; for any other script (Cyrillic, Greek ...)
 * the physical key position. Same rule as the pad bindings.
 */
export function letterOf(e: KeyLike): string | null {
  if (e.key.length === 1) {
    const k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) return k;
    if (/\p{L}/u.test(k)) return codeLetter(e.code);
  }
  return null;
}

/** Keys that are handled outside the pad (screen effect and sound toggles). */
export function isCrtKey(e: KeyLike): boolean {
  return letterOf(e) === 'c';
}
export function isMuteKey(e: KeyLike): boolean {
  return letterOf(e) === 'm';
}
