/**
 * Input: keyboard and gamepad merged into one virtual NES pad.
 * Pure logic (no DOM) so it can be tested; the browser layer feeds it events.
 */
export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';
export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];
export type SystemAction = 'crt' | 'mute';
export type KeyTarget = Button | SystemAction;

/** Letter keys match the PRINTED letter (event.key), so QWERTZ/AZERTY work. */
const LETTERS: Record<string, KeyTarget> = {
  w: 'up', a: 'left', s: 'down', d: 'right',
  z: 'a', j: 'a',
  x: 'b', k: 'b',
  c: 'crt', m: 'mute',
};

/** Everything else matches by PHYSICAL position (event.code). Unmapped letters also fall back here. */
const CODES: Record<string, KeyTarget> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', Space: 'b',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select',
  Enter: 'start', NumpadEnter: 'start',
  KeyC: 'crt', KeyM: 'mute',
};

/** Map a key event (key = printed character, code = physical key) to a pad button or system action. */
export function mapKey(key: string, code: string): KeyTarget | null {
  if (key && key.length === 1) {
    const lower = key.toLowerCase();
    if (lower >= 'a' && lower <= 'z') {
      const t = LETTERS[lower];
      if (t) return t;
      // An unmapped printed letter: fall back to physical position.
      return CODES[code] ?? null;
    }
  }
  return CODES[code] ?? null;
}

export interface PadFrame {
  /** Buttons held during this step (a tap shorter than one step still counts as held once). */
  held: Set<Button>;
  /** Buttons newly pressed at this step. */
  pressed: Set<Button>;
}

/**
 * Virtual pad. Several sources (keys, gamepads) may hold the same button; it stays down until all release.
 * Presses are queued so a quick tap is never lost, even when several steps run in one rendered frame:
 * each step consumes at most one queued press per button.
 */
export class VirtualPad {
  private holders = new Map<Button, Set<string>>();
  private queue = new Map<Button, number>();
  /** Which button each physical source (e.g. a key code) pressed, so a release clears exactly that one. */
  private sourceMap = new Map<string, KeyTarget>();

  constructor() {
    for (const b of BUTTONS) {
      this.holders.set(b, new Set());
      this.queue.set(b, 0);
    }
  }

  press(b: Button, source: string): void {
    const h = this.holders.get(b)!;
    if (h.has(source)) return; // auto-repeat
    const wasDown = h.size > 0;
    h.add(source);
    if (!wasDown) this.queue.set(b, Math.min(4, this.queue.get(b)! + 1));
  }

  release(b: Button, source: string): void {
    this.holders.get(b)!.delete(source);
  }

  isDown(b: Button): boolean {
    return this.holders.get(b)!.size > 0;
  }

  /** Keyboard helper: returns the system action if the key is one (on press only), else null. */
  keyDown(key: string, code: string): SystemAction | null {
    const src = 'key:' + code;
    if (this.sourceMap.has(src)) {
      // Already down (auto-repeat): ignore.
      return null;
    }
    const t = mapKey(key, code);
    if (!t) return null;
    this.sourceMap.set(src, t);
    if (t === 'crt' || t === 'mute') return t;
    this.press(t, src);
    return null;
  }

  keyUp(_key: string, code: string): void {
    const src = 'key:' + code;
    const t = this.sourceMap.get(src);
    this.sourceMap.delete(src);
    if (t && t !== 'crt' && t !== 'mute') this.release(t, src);
  }

  /** Release everything (window blur, visibility change). */
  releaseAll(): void {
    for (const b of BUTTONS) this.holders.get(b)!.clear();
    this.sourceMap.clear();
  }

  /** Set a gamepad-driven button state from polling. */
  setPadButton(b: Button, padIndex: number, down: boolean): void {
    const src = 'pad:' + padIndex;
    if (down) this.press(b, src);
    else this.release(b, src);
  }

  /** Remove every button held by one gamepad (disconnect). */
  dropPad(padIndex: number): void {
    const src = 'pad:' + padIndex;
    for (const b of BUTTONS) this.holders.get(b)!.delete(src);
  }

  /** Take one simulation step's input. */
  sample(): PadFrame {
    const held = new Set<Button>();
    const pressed = new Set<Button>();
    for (const b of BUTTONS) {
      const q = this.queue.get(b)!;
      if (q > 0) {
        pressed.add(b);
        held.add(b);
        this.queue.set(b, q - 1);
      }
      if (this.isDown(b)) held.add(b);
    }
    return { held, pressed };
  }
}

/** Gamepad (standard mapping) -> buttons. Axes use a dead zone. */
export function readGamepad(buttons: readonly { pressed: boolean }[], axes: readonly number[]): Set<Button> {
  const out = new Set<Button>();
  const p = (i: number) => !!buttons[i]?.pressed;
  if (p(0)) out.add('a');
  if (p(1)) out.add('b');
  if (p(8)) out.add('select');
  if (p(9)) out.add('start');
  if (p(12) || (axes[1] ?? 0) < -0.5) out.add('up');
  if (p(13) || (axes[1] ?? 0) > 0.5) out.add('down');
  if (p(14) || (axes[0] ?? 0) < -0.5) out.add('left');
  if (p(15) || (axes[0] ?? 0) > 0.5) out.add('right');
  return out;
}

/** An input frame with nothing held (used by scripted steps and tests). */
export function frameOf(held: Button[] = [], pressed: Button[] = []): PadFrame {
  return { held: new Set([...held, ...pressed]), pressed: new Set(pressed) };
}
