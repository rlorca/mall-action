// Recording fake Surface for the screens tests (node, no DOM).
import { EventBuffer } from '../src/core/events';
import { PadTracker, type Buttons, type PadFrame } from '../src/core/pad';
import type { Surface } from '../src/art/surface';

export interface TextCall {
  str: string;
  x: number;
  y: number;
  small: boolean;
  left: number;
  right: number;
}

export class RecSurface {
  texts: TextCall[] = [];
  sprites: string[] = [];
  rects = 0;
  alphaCalls: number[] = [];
  clipDepth = 0;
  constructor(
    readonly w = 256,
    readonly h = 240,
  ) {}
  clear(): void {}
  rect(): void {
    this.rects++;
  }
  px(): void {
    this.rects++;
  }
  hline(): void {
    this.rects++;
  }
  vline(): void {
    this.rects++;
  }
  frame(): void {
    this.rects++;
  }
  clip(): void {
    this.clipDepth++;
  }
  unclip(): void {
    this.clipDepth--;
  }
  setAlpha(a: number): void {
    this.alphaCalls.push(a);
  }
  sprite(n: unknown): void {
    this.sprites.push(typeof n === 'string' ? n : '?');
  }
  spriteScaled(n: unknown): void {
    this.sprite(n);
  }
  textWidth(str: string, small = false, spacing = 0): number {
    return str.length * ((small ? 4 : 8) + spacing);
  }
  text(str: string, x: number, y: number, _c: number, o: { small?: boolean; align?: 'left' | 'center' | 'right' } = {}): void {
    const w = str.length * (o.small ? 4 : 8);
    const left = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    this.texts.push({ str, x, y, small: !!o.small, left: Math.round(left), right: Math.round(left) + w });
  }
  get strings(): string[] {
    return this.texts.map((t) => t.str);
  }
}
export const asSurface = (r: RecSurface): Surface => r as unknown as Surface;

/** Steps a state class with a PadTracker like the Session does. */
export class Driver {
  tr = new PadTracker();
  buf = new EventBuffer();
  pad(held: Partial<Buttons> = {}): PadFrame {
    return this.tr.next(held);
  }
  run(st: { update(p: PadFrame, s: EventBuffer): void }, n: number, held: Partial<Buttons> = {}): void {
    for (let i = 0; i < n; i++) st.update(this.pad(held), this.buf);
  }
  tap(st: { update(p: PadFrame, s: EventBuffer): void }, b: keyof Buttons): void {
    st.update(this.pad({ [b]: true }), this.buf);
    st.update(this.pad({}), this.buf);
  }
}
