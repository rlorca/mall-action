// Konami code detection (↑↑↓↓←→←→ B A)

import { Button } from './types';

export class KonamiCodeDetector {
  private sequence: Button[] = [];
  private targetSequence: Button[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
  private detected = false;
  private callback: ((detected: boolean) => void) | null = null;

  constructor(onDetected: (detected: boolean) => void) {
    this.callback = onDetected;
  }

  addButton(button: Button) {
    // Allow extra leading 'up' presses before the sequence starts
    if (button === 'up' && this.sequence.length === 0) {
      // Extra up is allowed, just ignore and keep waiting
      return;
    }

    // Add to sequence
    this.sequence.push(button);

    // Trim to avoid memory issues - keep only last 12 presses
    if (this.sequence.length > 12) {
      this.sequence.shift();
    }

    // Check if we match the target
    const recentSequence = this.sequence.slice(-this.targetSequence.length);
    if (recentSequence.length === this.targetSequence.length) {
      const matches = recentSequence.every((btn, i) => btn === this.targetSequence[i]);
      if (matches) {
        this.detected = true;
        if (this.callback) {
          this.callback(true);
        }
      }
    }
  }

  isDetected(): boolean {
    return this.detected;
  }

  reset() {
    this.sequence = [];
    this.detected = false;
  }
}
