// Keyboard state -> virtual pad. DOM-free core (InputState) + a thin DOM binding.
import { BUTTON_NAMES, emptyButtons, type ButtonName, type Buttons } from './pad';
import { isHotkey, resolveBinding, shouldPreventDefault, type Binding, type Hotkey } from './keymap';
import { GamepadPoller } from './gamepad';

const MAX_TAPS = 8;

export class InputState {
  /** code -> binding resolved at keydown time (release always clears exactly this). */
  private down = new Map<string, Binding>();
  private heldCount: Record<ButtonName, number> = zero();
  private taps: Record<ButtonName, number> = zero();
  private lastReported: Buttons = emptyButtons();
  onHotkey?: (h: Hotkey) => void;

  /** Returns the resolved binding (or null if unmapped). Auto-repeat is ignored. */
  keyDown(code: string, key: string): Binding | null {
    if (this.down.has(code)) return this.down.get(code) ?? null;
    const b = resolveBinding(code, key);
    if (b === null) return null;
    this.down.set(code, b);
    if (isHotkey(b)) this.onHotkey?.(b);
    else {
      if (this.heldCount[b] === 0) this.taps[b] = Math.min(MAX_TAPS, this.taps[b] + 1);
      this.heldCount[b]++;
    }
    return b;
  }

  keyUp(code: string, _key?: string): void {
    const b = this.down.get(code);
    if (b === undefined) return;
    this.down.delete(code);
    if (!isHotkey(b)) this.heldCount[b] = Math.max(0, this.heldCount[b] - 1);
  }

  /** Release everything (window blur, tab hidden). Pending taps are kept so they still register. */
  blur(): void {
    this.down.clear();
    this.heldCount = zero();
  }

  /** Physically held right now (ignores tap latches). */
  isHeld(b: ButtonName): boolean {
    return this.heldCount[b] > 0;
  }

  /**
   * Call once per SIMULATION step. A press+release between two steps is reported held for one
   * step; several queued taps are separated by a released step so every tap makes an edge.
   */
  pollStep(): Partial<Buttons> {
    const out: Partial<Buttons> = {};
    for (const b of BUTTON_NAMES) {
      const held = this.heldCount[b] > 0;
      let v: boolean;
      if (this.taps[b] > 0) {
        if (this.lastReported[b]) v = false; // gap so the next tap is a fresh edge
        else {
          v = true;
          this.taps[b]--;
        }
      } else v = held;
      this.lastReported[b] = v;
      if (v) out[b] = true;
    }
    return out;
  }
}

function zero(): Record<ButtonName, number> {
  return { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0, select: 0, start: 0 };
}

export interface InputHooks {
  onCrtToggle?: () => void;
  onMuteToggle?: () => void;
  /** Fired on the first keyboard/pointer/gamepad activity (use it to resume audio). */
  onFirstInput?: () => void;
}

/** Keyboard + gamepad merged (OR). poll() is called once per sim step. */
export class Input {
  readonly state = new InputState();
  readonly gamepad = new GamepadPoller();
  private firstFired = false;
  /** Last polled per-source state (for the ?input=1 diagnostic overlay). */
  lastKeyboard: Partial<Buttons> = {};
  lastGamepad: Partial<Buttons> = {};
  constructor(private hooks: InputHooks = {}) {
    this.state.onHotkey = (h) => (h === 'crt' ? this.hooks.onCrtToggle?.() : this.hooks.onMuteToggle?.());
    this.gamepad.onActivity = () => this.firstInput();
  }
  setHooks(h: InputHooks): void {
    this.hooks = h;
  }
  firstInput(): void {
    if (this.firstFired) return;
    this.firstFired = true;
    this.hooks.onFirstInput?.();
  }
  poll(): Partial<Buttons> {
    const k = this.state.pollStep();
    const g = this.gamepad.poll();
    this.lastKeyboard = k;
    this.lastGamepad = g;
    const out: Partial<Buttons> = {};
    for (const b of BUTTON_NAMES) if (k[b] || g[b]) out[b] = true;
    return out;
  }
  /** Bind DOM listeners; returns an unbind function. */
  bind(target: Window = window): () => void {
    const kd = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts
      if (shouldPreventDefault(e.code, e.key)) e.preventDefault();
      this.firstInput();
      if (e.repeat) return;
      this.state.keyDown(e.code, e.key);
    };
    const ku = (e: KeyboardEvent): void => this.state.keyUp(e.code, e.key);
    const clear = (): void => this.state.blur();
    const vis = (): void => {
      if (document.hidden) this.state.blur();
    };
    const ptr = (): void => this.firstInput();
    target.addEventListener('keydown', kd);
    target.addEventListener('keyup', ku);
    target.addEventListener('blur', clear);
    target.addEventListener('pointerdown', ptr);
    document.addEventListener('visibilitychange', vis);
    const stopGp = this.gamepad.attach(target);
    return () => {
      target.removeEventListener('keydown', kd);
      target.removeEventListener('keyup', ku);
      target.removeEventListener('blur', clear);
      target.removeEventListener('pointerdown', ptr);
      document.removeEventListener('visibilitychange', vis);
      stopGp();
    };
  }
}

/** Thin binding around an InputState only (no gamepad). Returns unbind. */
export function bindKeyboard(target: Window | HTMLElement, state: InputState, onFirstInput?: () => void): () => void {
  const t = target as Window;
  const kd = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (shouldPreventDefault(ev.code, ev.key)) ev.preventDefault();
    onFirstInput?.();
    if (!ev.repeat) state.keyDown(ev.code, ev.key);
  };
  const ku = (e: Event): void => state.keyUp((e as KeyboardEvent).code);
  const clear = (): void => state.blur();
  t.addEventListener('keydown', kd);
  t.addEventListener('keyup', ku);
  t.addEventListener('blur', clear);
  return () => {
    t.removeEventListener('keydown', kd);
    t.removeEventListener('keyup', ku);
    t.removeEventListener('blur', clear);
  };
}
