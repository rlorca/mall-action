import type { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { drawText, textWidth } from '../engine/font';

/** Small on-screen confirmations ("CRT ON", "SOUND OFF" ...): a box in the top-right corner for ~1.5 s. */
export class Osd {
  private text = '';
  private t = 0;

  show(text: string, frames = 100): void {
    this.text = text;
    this.t = frames;
  }

  /** Advance one rendered frame (OSD timing is presentation only, not game time). */
  tick(): void {
    if (this.t > 0) this.t--;
  }

  get active(): boolean {
    return this.t > 0;
  }

  get current(): string {
    return this.t > 0 ? this.text : '';
  }

  draw(fb: Framebuffer): void {
    if (this.t <= 0) return;
    const w = textWidth(this.text) + 10;
    const x = 256 - w - 5;
    const y = 22;
    fb.fillRect(x, y, w, 13, C.BLACK);
    fb.strokeRect(x, y, w, 13, C.WHITE);
    drawText(fb, this.text, x + 5, y + 3, C.WHITE);
  }
}
