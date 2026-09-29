export enum Button {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
  A = 4,
  B = 5,
  Select = 6,
  Start = 7,
}

export interface InputState {
  held: boolean[];
  pressed: boolean[];
  released: boolean[];
}

export function createInputState(): InputState {
  return {
    held: new Array(8).fill(false),
    pressed: new Array(8).fill(false),
    released: new Array(8).fill(false),
  };
}

export function mergeInputStates(a: InputState, b: InputState): InputState {
  const result = createInputState();
  for (let i = 0; i < 8; i++) {
    result.held[i] = a.held[i] || b.held[i];
    result.pressed[i] = a.pressed[i] || b.pressed[i];
    result.released[i] = a.released[i] || b.released[i];
  }
  return result;
}

const QWERTY_MAP: Record<string, Button> = {
  ArrowUp: Button.Up,
  ArrowDown: Button.Down,
  ArrowLeft: Button.Left,
  ArrowRight: Button.Right,
  KeyW: Button.Up,
  KeyA: Button.Left,
  KeyS: Button.Down,
  KeyD: Button.Right,
  KeyZ: Button.A,
  KeyJ: Button.A,
  KeyX: Button.B,
  KeyK: Button.B,
  Space: Button.B,
  ShiftLeft: Button.Select,
  ShiftRight: Button.Select,
  Tab: Button.Select,
  Enter: Button.Start,
};

const LETTER_MAP: Record<string, Button> = {
  w: Button.Up,
  a: Button.Left,
  s: Button.Down,
  d: Button.Right,
  z: Button.A,
  j: Button.A,
  x: Button.B,
  k: Button.B,
};

export class KeyboardInput {
  private currentHeld: boolean[] = new Array(8).fill(false);
  private pressQueue: boolean[] = new Array(8).fill(false);
  private releaseQueue: boolean[] = new Array(8).fill(false);
  private keyToButton: Map<string, Button> = new Map();
  private cToggle: (() => void) | null = null;
  private mToggle: (() => void) | null = null;

  constructor(onCRT?: () => void, onMute?: () => void) {
    this.cToggle = onCRT || null;
    this.mToggle = onMute || null;
  }

  attach(target: EventTarget): void {
    target.addEventListener('keydown', ((e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        this.cToggle?.();
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        this.mToggle?.();
        e.preventDefault();
        return;
      }

      const btn = this.resolveButton(e);
      if (btn !== undefined) {
        e.preventDefault();
        if (!this.currentHeld[btn]) {
          this.currentHeld[btn] = true;
          this.pressQueue[btn] = true;
        }
        this.keyToButton.set(e.code, btn);
      }
    }) as EventListener);

    target.addEventListener('keyup', ((e: KeyboardEvent) => {
      const btn = this.keyToButton.get(e.code);
      if (btn !== undefined) {
        this.keyToButton.delete(e.code);
        let stillHeld = false;
        for (const [, b] of this.keyToButton) {
          if (b === btn) { stillHeld = true; break; }
        }
        if (!stillHeld) {
          this.currentHeld[btn] = false;
          this.releaseQueue[btn] = true;
        }
      }
    }) as EventListener);

    target.addEventListener('blur', (() => {
      for (let i = 0; i < 8; i++) {
        if (this.currentHeld[i]) {
          this.releaseQueue[i] = true;
        }
        this.currentHeld[i] = false;
      }
      this.keyToButton.clear();
    }) as EventListener);
  }

  poll(): InputState {
    const state = createInputState();
    for (let i = 0; i < 8; i++) {
      state.held[i] = this.currentHeld[i];
      state.pressed[i] = this.pressQueue[i];
      state.released[i] = this.releaseQueue[i];
    }
    this.pressQueue.fill(false);
    this.releaseQueue.fill(false);
    return state;
  }

  private resolveButton(e: KeyboardEvent): Button | undefined {
    if (e.code in QWERTY_MAP) return QWERTY_MAP[e.code];
    const key = e.key.toLowerCase();
    if (key in LETTER_MAP) return LETTER_MAP[key];
    return undefined;
  }
}

export class GamepadInput {
  private prevButtons: boolean[] = new Array(8).fill(false);

  poll(): InputState {
    const state = createInputState();
    const gamepads = navigator.getGamepads?.() ?? [];

    for (const gp of gamepads) {
      if (!gp) continue;

      const map: [number, Button][] = [
        [0, Button.A],
        [1, Button.B],
        [8, Button.Select],
        [9, Button.Start],
        [12, Button.Up],
        [13, Button.Down],
        [14, Button.Left],
        [15, Button.Right],
      ];

      for (const [gi, btn] of map) {
        if (gp.buttons[gi]?.pressed) state.held[btn] = true;
      }

      const [lx, ly] = [gp.axes[0] ?? 0, gp.axes[1] ?? 0];
      const DEADZONE = 0.3;
      if (lx < -DEADZONE) state.held[Button.Left] = true;
      if (lx > DEADZONE) state.held[Button.Right] = true;
      if (ly < -DEADZONE) state.held[Button.Up] = true;
      if (ly > DEADZONE) state.held[Button.Down] = true;
    }

    for (let i = 0; i < 8; i++) {
      state.pressed[i] = state.held[i] && !this.prevButtons[i];
      state.released[i] = !state.held[i] && this.prevButtons[i];
      this.prevButtons[i] = state.held[i];
    }

    return state;
  }
}
