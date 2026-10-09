/** The virtual NES pad every input source is merged into. */
export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'] as const;
export type Button = (typeof BUTTONS)[number];
export type PadState = Record<Button, boolean>;

export function emptyPad(): PadState {
  return { up: false, down: false, left: false, right: false, a: false, b: false, select: false, start: false };
}

/** Per-simulation-step input: what is held and what was freshly pressed this step. */
export interface PadFrame {
  held: PadState;
  pressed: PadState;
}

export function emptyFrame(): PadFrame {
  return { held: emptyPad(), pressed: emptyPad() };
}

/** Build a PadFrame from held buttons (+ the previous held state for edge detection). */
export function frameFrom(held: Partial<PadState>, prev?: PadState): PadFrame {
  const h = { ...emptyPad(), ...held };
  const p = emptyPad();
  for (const b of BUTTONS) p[b] = h[b] && !(prev ? prev[b] : false);
  return { held: h, pressed: p };
}
