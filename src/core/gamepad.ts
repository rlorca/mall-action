// Gamepad API -> virtual pad. mapGamepad is pure; GamepadPoller wraps navigator.getGamepads.
import { BUTTON_NAMES, type Buttons } from './pad';

export interface PadSnapshot {
  buttons: readonly { pressed: boolean; value?: number }[];
  axes: readonly number[];
}

export const STICK_DEADZONE = 0.5;

export function mapGamepad(s: PadSnapshot | null | undefined): Partial<Buttons> {
  const out: Partial<Buttons> = {};
  if (!s) return out;
  const p = (i: number): boolean => !!s.buttons[i]?.pressed;
  const ax = s.axes[0] ?? 0;
  const ay = s.axes[1] ?? 0;
  if (p(12) || ay < -STICK_DEADZONE) out.up = true;
  if (p(13) || ay > STICK_DEADZONE) out.down = true;
  if (p(14) || ax < -STICK_DEADZONE) out.left = true;
  if (p(15) || ax > STICK_DEADZONE) out.right = true;
  if (p(0)) out.a = true;
  if (p(1)) out.b = true;
  if (p(8)) out.select = true;
  if (p(9)) out.start = true;
  return out;
}

export function mergeButtons(...list: Partial<Buttons>[]): Partial<Buttons> {
  const out: Partial<Buttons> = {};
  for (const l of list) for (const b of BUTTON_NAMES) if (l[b]) out[b] = true;
  return out;
}

export class GamepadPoller {
  connected = 0;
  /** Per pad: buttons seen released at least once. A button that has been held since the pad appeared (a stuck or
   *  phantom HID device) is ignored until it is released, so it can never mask keyboard presses. */
  private armed = new Map<number, Set<string>>();
  onActivity?: () => void;
  private getPads: () => ArrayLike<Gamepad | null> = () =>
    typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];

  /** Override the gamepad source (tests). */
  setSource(fn: () => ArrayLike<PadSnapshot | null>): void {
    this.getPads = fn as () => ArrayLike<Gamepad | null>;
  }

  /** OR of all connected pads. Safe to call every step; never throws. */
  poll(): Partial<Buttons> {
    let out: Partial<Buttons> = {};
    try {
      const pads = this.getPads();
      let n = 0;
      for (let i = 0; i < pads.length; i++) {
        const g = pads[i];
        if (!g || (g as Gamepad).connected === false) continue;
        n++;
        const raw = mapGamepad(g);
        let armed = this.armed.get(i);
        if (!armed) this.armed.set(i, (armed = new Set()));
        const m: Partial<Buttons> = {};
        for (const b of BUTTON_NAMES) {
          if (!raw[b]) armed.add(b);
          else if (armed.has(b)) m[b] = true;
        }
        if (BUTTON_NAMES.some((b) => m[b])) this.onActivity?.();
        out = mergeButtons(out, m);
      }
      this.connected = n;
    } catch {
      /* ignore */
    }
    return out;
  }

  /** Track connect/disconnect events at any time. Returns detach fn. */
  attach(target: Window): () => void {
    const on = (): void => {
      this.connected = Array.from(this.getPads() as ArrayLike<Gamepad | null>).filter((g) => g && g.connected).length;
    };
    target.addEventListener('gamepadconnected', on);
    target.addEventListener('gamepaddisconnected', on);
    return () => {
      target.removeEventListener('gamepadconnected', on);
      target.removeEventListener('gamepaddisconnected', on);
    };
  }
}
