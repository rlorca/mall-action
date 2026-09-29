import { Button, Input } from './types';

export class InputHandler {
  private pressed = new Set<Button>();
  private justPressed = new Set<Button>();
  private keyToButton: Map<string, Button> = new Map();
  private lastKeyStates = new Map<string, boolean>();

  constructor() {
    this.setupKeyMapping();
    this.setupEventListeners();
  }

  private setupKeyMapping() {
    // Arrow keys and WASD for movement
    const directionMap: Record<string, Button> = {
      'ArrowUp': 'up', 'w': 'up', 'W': 'up',
      'ArrowDown': 'down', 's': 'down', 'S': 'down',
      'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
      'ArrowRight': 'right', 'd': 'right', 'D': 'right',
    };

    // Action buttons
    const actionMap: Record<string, Button> = {
      'z': 'a', 'Z': 'a', 'j': 'a', 'J': 'a',
      'x': 'b', 'X': 'b', 'k': 'b', 'K': 'b', ' ': 'b',
    };

    // Special keys
    const specialMap: Record<string, Button> = {
      'Shift': 'select', 'Tab': 'select',
      'Enter': 'start',
      'c': 'select', 'C': 'select', // CRT toggle
      'm': 'select', 'M': 'select', // Mute toggle
    };

    Object.assign(this.keyToButton, directionMap, actionMap, specialMap);
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  private handleKeyDown(e: KeyboardEvent) {
    const button = this.keyToButton.get(e.key);
    if (button) {
      const wasPressed = this.pressed.has(button);
      this.pressed.add(button);
      if (!wasPressed) {
        this.justPressed.add(button);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const button = this.keyToButton.get(e.key);
    if (button) {
      this.pressed.delete(button);
      this.justPressed.delete(button);
    }
  }

  getInput(): Input {
    const input: Input = {
      pressed: new Set(this.pressed),
      justPressed: new Set(this.justPressed),
    };

    // Clear just-pressed after this frame
    this.justPressed.clear();

    return input;
  }

  isPressed(button: Button): boolean {
    return this.pressed.has(button);
  }

  reset() {
    this.pressed.clear();
    this.justPressed.clear();
  }
}
