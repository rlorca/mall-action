// The virtual NES pad shared by keyboard, gamepad, tests and the debug hook.
export type ButtonName = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';
export const BUTTON_NAMES: readonly ButtonName[] = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

export type Buttons = Record<ButtonName, boolean>;

export function emptyButtons(): Buttons {
  return { up: false, down: false, left: false, right: false, a: false, b: false, select: false, start: false };
}

/** What a simulation step sees: held state plus edges since the previous step. */
export interface PadFrame {
  held: Buttons;
  pressed: Buttons;
  released: Buttons;
}

export function emptyPad(): PadFrame {
  return { held: emptyButtons(), pressed: emptyButtons(), released: emptyButtons() };
}

/** Turns successive held-button snapshots into PadFrames with edge detection. */
export class PadTracker {
  private prev: Buttons = emptyButtons();
  next(held: Partial<Buttons>): PadFrame {
    const h = { ...emptyButtons(), ...held };
    const pressed = emptyButtons();
    const released = emptyButtons();
    for (const b of BUTTON_NAMES) {
      pressed[b] = h[b] && !this.prev[b];
      released[b] = !h[b] && this.prev[b];
    }
    this.prev = h;
    return { held: h, pressed, released };
  }
  reset(): void {
    this.prev = emptyButtons();
  }
}

export function padHeld(...names: ButtonName[]): Partial<Buttons> {
  const o: Partial<Buttons> = {};
  for (const n of names) o[n] = true;
  return o;
}
