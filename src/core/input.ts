/** Virtual NES pad: keyboard + gamepad merged, with an edge queue so taps are never lost. */
export const Btn = {
  Up: 1,
  Down: 2,
  Left: 4,
  Right: 8,
  A: 16,
  B: 32,
  Select: 64,
  Start: 128,
} as const;
export const ALL_BTNS = [1, 2, 4, 8, 16, 32, 64, 128];
export const DIRS = Btn.Up | Btn.Down | Btn.Left | Btn.Right;

export interface PadFrame {
  held: number;
  pressed: number;
}
export const NO_INPUT: PadFrame = { held: 0, pressed: 0 };

export type KeyAction = number | 'crt' | 'mute' | 0;

/** Letter keys match the PRINTED letter (event.key), so QWERTZ/AZERTY work. */
const LETTERS: Record<string, KeyAction> = {
  w: Btn.Up,
  a: Btn.Left,
  s: Btn.Down,
  d: Btn.Right,
  z: Btn.A,
  j: Btn.A,
  x: Btn.B,
  k: Btn.B,
  c: 'crt',
  m: 'mute',
};
/** Everything else matches by physical position (event.code). */
const CODES: Record<string, KeyAction> = {
  ArrowUp: Btn.Up,
  ArrowDown: Btn.Down,
  ArrowLeft: Btn.Left,
  ArrowRight: Btn.Right,
  Space: Btn.B,
  ShiftLeft: Btn.Select,
  ShiftRight: Btn.Select,
  Tab: Btn.Select,
  Enter: Btn.Start,
  NumpadEnter: Btn.Start,
  KeyW: Btn.Up,
  KeyA: Btn.Left,
  KeyS: Btn.Down,
  KeyD: Btn.Right,
  KeyZ: Btn.A,
  KeyJ: Btn.A,
  KeyX: Btn.B,
  KeyK: Btn.B,
  KeyC: 'crt',
  KeyM: 'mute',
};

export function mapKey(key: string, code: string): KeyAction {
  if (key.length === 1) {
    const l = key.toLowerCase();
    if (l >= 'a' && l <= 'z') {
      const a = LETTERS[l];
      if (a) return a;
      // unmapped letter: fall back to physical position
      return CODES[code] ?? 0;
    }
  }
  return CODES[code] ?? 0;
}

interface Edge {
  btn: number;
  down: boolean;
}

export class VirtualPad {
  /** which button each currently-down source (event.code or pad:N) pressed */
  private sources = new Map<string, number>();
  private counts = new Map<number, number>();
  private queue: Edge[] = [];
  private held = 0;

  /** Returns the action so the caller can handle 'crt'/'mute'. Auto-repeat is ignored. */
  keyDown(key: string, code: string): KeyAction {
    const id = code || 'key:' + key;
    const act = mapKey(key, code);
    if (typeof act !== 'number' || act === 0) return act;
    if (this.sources.has(id)) return act; // auto-repeat
    this.press(id, act);
    return act;
  }
  /** Releases exactly what this physical key pressed, whatever it prints now. */
  keyUp(key: string, code: string): void {
    this.release(code || 'key:' + key);
  }
  press(id: string, btn: number): void {
    if (this.sources.has(id)) return;
    this.sources.set(id, btn);
    const c = (this.counts.get(btn) ?? 0) + 1;
    this.counts.set(btn, c);
    if (c === 1) this.queue.push({ btn, down: true });
  }
  release(id: string): void {
    const btn = this.sources.get(id);
    if (btn === undefined) return;
    this.sources.delete(id);
    const c = (this.counts.get(btn) ?? 1) - 1;
    this.counts.set(btn, c);
    if (c === 0) this.queue.push({ btn, down: false });
  }
  /** Gamepad state as a button mask; diffed against the previous mask. */
  setGamepad(mask: number): void {
    for (const b of ALL_BTNS) {
      const id = 'pad:' + b;
      if (mask & b) this.press(id, b);
      else this.release(id);
    }
  }
  releaseAll(): void {
    for (const id of [...this.sources.keys()]) this.release(id);
  }
  /**
   * One call per simulation step. Applies queued edges in order, but at most one
   * transition per button per step, so down+up inside one frame still yields a press.
   */
  poll(): PadFrame {
    const prev = this.held;
    let touched = 0;
    let i = 0;
    for (; i < this.queue.length; i++) {
      const e = this.queue[i];
      if (touched & e.btn) break;
      touched |= e.btn;
      if (e.down) this.held |= e.btn;
      else this.held &= ~e.btn;
    }
    this.queue.splice(0, i);
    return { held: this.held, pressed: this.held & ~prev };
  }
  get pending(): number {
    return this.queue.length;
  }
}

/** Standard-mapping gamepad -> button mask. */
export function gamepadMask(buttons: readonly { pressed: boolean }[], axes: readonly number[]): number {
  let m = 0;
  const b = (i: number) => !!buttons[i]?.pressed;
  if (b(0)) m |= Btn.A;
  if (b(1)) m |= Btn.B;
  if (b(8)) m |= Btn.Select;
  if (b(9)) m |= Btn.Start;
  if (b(12)) m |= Btn.Up;
  if (b(13)) m |= Btn.Down;
  if (b(14)) m |= Btn.Left;
  if (b(15)) m |= Btn.Right;
  const ax = axes[0] ?? 0;
  const ay = axes[1] ?? 0;
  if (ax < -0.5) m |= Btn.Left;
  if (ax > 0.5) m |= Btn.Right;
  if (ay < -0.5) m |= Btn.Up;
  if (ay > 0.5) m |= Btn.Down;
  return m;
}
