export type VirtualPadState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;      // Shoot
  b: boolean;      // Jump / Search
  select: boolean; // Map
  start: boolean;  // Pause / Confirm
};

export type KeyPressFlags = {
  crtTogglePressed: boolean;
  muteTogglePressed: boolean;
};

export class InputManager {
  private keyState: Record<string, boolean> = {};
  private tapQueue: VirtualPadState[] = [];
  private currentPad: VirtualPadState = {
    up: false, down: false, left: false, right: false,
    a: false, b: false, select: false, start: false
  };

  // Konami Code sequence tracker: Up Up Down Down Left Right Left Right B A
  private konamiSequence: string[] = [];
  private readonly targetKonami = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];
  public konamiTriggered: boolean = false;

  private crtTogglePressed: boolean = false;
  private muteTogglePressed: boolean = false;

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      // Prevent browser default scrolling for game keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) {
        e.preventDefault();
      }

      const keyKey = e.key.toUpperCase();
      const codeKey = e.code;
      const id = `${codeKey}_${keyKey}`;

      if (!this.keyState[id]) {
        this.keyState[id] = true;
        this.processActionDown(e.key, e.code);
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      const keyKey = e.key.toUpperCase();
      const codeKey = e.code;
      const id = `${codeKey}_${keyKey}`;

      this.keyState[id] = false;
      this.processActionUp(e.key, e.code);
    });
  }

  private processActionDown(key: string, code: string): void {
    const kUpper = key.toUpperCase();

    // System Toggles
    if (kUpper === "C" || code === "KeyC") {
      this.crtTogglePressed = true;
    }
    if (kUpper === "M" || code === "KeyM") {
      this.muteTogglePressed = true;
    }

    // Map keys to action names for Konami tracking & virtual pad
    let actionName: string | null = null;

    if (code === "ArrowUp" || kUpper === "W" || code === "KeyW") {
      this.currentPad.up = true;
      actionName = "up";
    }
    if (code === "ArrowDown" || kUpper === "S" || code === "KeyS") {
      this.currentPad.down = true;
      actionName = "down";
    }
    if (code === "ArrowLeft" || kUpper === "A" || code === "KeyA") {
      this.currentPad.left = true;
      actionName = "left";
    }
    if (code === "ArrowRight" || kUpper === "D" || code === "KeyD") {
      this.currentPad.right = true;
      actionName = "right";
    }
    if (kUpper === "Z" || kUpper === "J" || code === "KeyZ" || code === "KeyJ") {
      this.currentPad.a = true;
      actionName = "a";
    }
    if (kUpper === "X" || kUpper === "K" || code === "Space" || code === "KeyX" || code === "KeyK") {
      this.currentPad.b = true;
      actionName = "b";
    }
    if (code === "ShiftLeft" || code === "ShiftRight" || code === "Tab") {
      this.currentPad.select = true;
      actionName = "select";
    }
    if (code === "Enter") {
      this.currentPad.start = true;
      actionName = "start";
    }

    if (actionName) {
      // Record tap snapshot into queue for high-frequency tick catch-ups
      this.tapQueue.push({ ...this.currentPad });

      // Process Konami code
      this.processKonamiInput(actionName);
    }
  }

  private processActionUp(key: string, code: string): void {
    const kUpper = key.toUpperCase();

    if (code === "ArrowUp" || kUpper === "W" || code === "KeyW") this.currentPad.up = false;
    if (code === "ArrowDown" || kUpper === "S" || code === "KeyS") this.currentPad.down = false;
    if (code === "ArrowLeft" || kUpper === "A" || code === "KeyA") this.currentPad.left = false;
    if (code === "ArrowRight" || kUpper === "D" || code === "KeyD") this.currentPad.right = false;
    if (kUpper === "Z" || kUpper === "J" || code === "KeyZ" || code === "KeyJ") this.currentPad.a = false;
    if (kUpper === "X" || kUpper === "K" || code === "Space" || code === "KeyX" || code === "KeyK") this.currentPad.b = false;
    if (code === "ShiftLeft" || code === "ShiftRight" || code === "Tab") this.currentPad.select = false;
    if (code === "Enter") this.currentPad.start = false;
  }

  private processKonamiInput(action: string): void {
    this.konamiSequence.push(action);

    // Allow leading extra "up" presses without failing match
    while (this.konamiSequence.length > 0) {
      const match = this.checkKonamiMatch();
      if (match) {
        this.konamiTriggered = true;
        this.konamiSequence = [];
        return;
      }
      if (this.konamiSequence.length > this.targetKonami.length) {
        if (this.konamiSequence[0] === "up" && this.konamiSequence[1] === "up") {
          this.konamiSequence.shift(); // Drop extra leading Up
        } else {
          this.konamiSequence.shift();
        }
      } else {
        break;
      }
    }
  }

  private checkKonamiMatch(): boolean {
    if (this.konamiSequence.length < this.targetKonami.length) return false;
    const tail = this.konamiSequence.slice(-this.targetKonami.length);
    return tail.every((val, idx) => val === this.targetKonami[idx]);
  }

  /**
   * Reads current Gamepad inputs merged into virtual pad.
   */
  public pollGamepad(): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;
      // D-pad / buttons
      if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) this.currentPad.up = true;
      if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5) this.currentPad.down = true;
      if (gp.buttons[14]?.pressed || gp.axes[0] < -0.5) this.currentPad.left = true;
      if (gp.buttons[15]?.pressed || gp.axes[0] > 0.5) this.currentPad.right = true;
      if (gp.buttons[0]?.pressed) this.currentPad.a = true;
      if (gp.buttons[1]?.pressed) this.currentPad.b = true;
      if (gp.buttons[8]?.pressed) this.currentPad.select = true;
      if (gp.buttons[9]?.pressed) this.currentPad.start = true;
    }
  }

  /**
   * Consumes system key press toggles.
   */
  public consumeToggles(): KeyPressFlags {
    const res = {
      crtTogglePressed: this.crtTogglePressed,
      muteTogglePressed: this.muteTogglePressed,
    };
    this.crtTogglePressed = false;
    this.muteTogglePressed = false;
    return res;
  }

  /**
   * Retrieves current virtual pad state, or pops from tap queue if available.
   */
  public getPadState(): VirtualPadState {
    this.pollGamepad();
    if (this.tapQueue.length > 0) {
      return this.tapQueue.shift()!;
    }
    return { ...this.currentPad };
  }

  /**
   * Clears state for testing.
   */
  public reset(): void {
    this.keyState = {};
    this.tapQueue = [];
    this.currentPad = {
      up: false, down: false, left: false, right: false,
      a: false, b: false, select: false, start: false
    };
    this.konamiSequence = [];
    this.konamiTriggered = false;
    this.crtTogglePressed = false;
    this.muteTogglePressed = false;
  }
}
