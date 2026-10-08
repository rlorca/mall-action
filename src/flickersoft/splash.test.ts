import { describe, expect, it } from 'vitest';
import { FlickerSplash, FLICKER_END, FLICKER_START, PRESENTS_AT, STUDIO_NAME, TOTAL_FRAMES, letterVisible } from './splash';
import { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { Btn, NO_PAD, type Pad } from '../engine/pad';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

function stepTo(s: FlickerSplash, frame: number): void {
  while (s.frame < frame && !s.done) s.step(NO_PAD);
}

/** Non-black pixel count inside a letter's box. */
function inkIn(fb: Framebuffer, box: { x: number; y: number; w: number; h: number }): number {
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) if (fb.getPixel(x, y) !== C.BLACK) n++;
  return n;
}

describe('FlickerSplash timing', () => {
  it('is black before the flicker starts', () => {
    const s = new FlickerSplash();
    const fb = new Framebuffer();
    for (let f = 0; f < FLICKER_START; f++) {
      s.draw(fb);
      expect(fb.countNot(C.BLACK), `frame ${f}`).toBe(0);
      s.step(NO_PAD);
    }
  });

  it('flickers for about one second: 60 frames', () => {
    expect(FLICKER_END - FLICKER_START).toBe(60);
  });

  it('letters appear on alternate frames and neighbouring letters are out of phase', () => {
    const s = new FlickerSplash();
    const n = STUDIO_NAME.length;
    stepTo(s, FLICKER_START);
    let prev: boolean[] | null = null;
    while (s.frame < FLICKER_END) {
      const vis = Array.from({ length: n }, (_, i) => s.visible(i));
      for (let i = 0; i + 1 < n; i++) expect(vis[i], `frame ${s.frame} letters ${i}/${i + 1}`).not.toBe(vis[i + 1]);
      if (prev) for (let i = 0; i < n; i++) expect(vis[i], `frame ${s.frame} letter ${i} toggles`).not.toBe(prev[i]);
      prev = vis;
      s.step(NO_PAD);
    }
  });

  it('what the framebuffer shows matches letterVisible (hidden letters leave no ink)', () => {
    const s = new FlickerSplash();
    const fb = new Framebuffer();
    stepTo(s, FLICKER_START);
    for (let k = 0; k < 6; k++) {
      s.draw(fb);
      for (let i = 0; i < STUDIO_NAME.length; i++) {
        const ink = inkIn(fb, s.letterBox(i));
        if (letterVisible(i, s.frame)) expect(ink, `frame ${s.frame} letter ${i} should show`).toBeGreaterThan(0);
        else expect(ink, `frame ${s.frame} letter ${i} should be hidden`).toBe(0);
      }
      s.step(NO_PAD);
    }
  });

  it('settles solid after the flicker phase: every letter, every frame', () => {
    const s = new FlickerSplash();
    const fb = new Framebuffer();
    stepTo(s, FLICKER_END);
    expect(s.settled).toBe(true);
    for (let k = 0; k < 20; k++) {
      s.draw(fb);
      for (let i = 0; i < STUDIO_NAME.length; i++) {
        expect(letterVisible(i, s.frame)).toBe(true);
        expect(inkIn(fb, s.letterBox(i))).toBeGreaterThan(0);
      }
      s.step(NO_PAD);
    }
  });

  it('draws an underline once settled (and not during the flicker)', () => {
    const s = new FlickerSplash();
    const fb = new Framebuffer();
    const underlineInk = () => {
      let n = 0;
      const b = s.letterBox(0);
      for (let y = b.y + b.h + 4; y < b.y + b.h + 12; y++) for (let x = 0; x < fb.w; x++) if (fb.getPixel(x, y) !== C.BLACK) n++;
      return n;
    };
    stepTo(s, FLICKER_END - 1);
    s.draw(fb);
    expect(underlineInk()).toBe(0);
    stepTo(s, FLICKER_END + 30);
    s.draw(fb);
    expect(underlineInk()).toBeGreaterThan(100);
  });

  it('PRESENTS follows the settle, not before', () => {
    const s = new FlickerSplash();
    const fb = new Framebuffer();
    const below = (): number => {
      const b = s.letterBox(0);
      let n = 0;
      for (let y = b.y + b.h + 12; y < fb.h; y++) for (let x = 0; x < fb.w; x++) if (fb.getPixel(x, y) !== C.BLACK) n++;
      return n;
    };
    stepTo(s, PRESENTS_AT - 1);
    s.draw(fb);
    expect(below()).toBe(0);
    stepTo(s, PRESENTS_AT + 20);
    s.draw(fb);
    expect(below()).toBeGreaterThan(50);
  });

  it('fires the jingle exactly once, on the settle frame', () => {
    let calls = 0;
    const s = new FlickerSplash({ onJingle: () => calls++ });
    stepTo(s, FLICKER_END - 1);
    expect(calls).toBe(0);
    s.step(NO_PAD);
    expect(s.frame).toBe(FLICKER_END);
    expect(calls).toBe(1);
    while (!s.done) s.step(NO_PAD);
    expect(calls).toBe(1);
  });

  it('lasts about 3 seconds in total', () => {
    const s = new FlickerSplash();
    let steps = 0;
    while (!s.done && steps < 1000) {
      s.step(NO_PAD);
      steps++;
    }
    expect(steps).toBe(TOTAL_FRAMES);
    expect(steps).toBeGreaterThanOrEqual(150);
    expect(steps).toBeLessThanOrEqual(210);
  });

  it('any button skips, at any time, without the jingle if it was early', () => {
    for (const btn of [Btn.START, Btn.A, Btn.B, Btn.UP, Btn.SELECT]) {
      let calls = 0;
      const s = new FlickerSplash({ onJingle: () => calls++ });
      stepTo(s, 20);
      s.step(press(btn));
      expect(s.done).toBe(true);
      expect(s.skipped).toBe(true);
      expect(calls).toBe(0);
    }
  });

  it('a held (not newly pressed) button does not skip', () => {
    const s = new FlickerSplash();
    s.step({ held: Btn.START, pressed: 0, released: 0 });
    expect(s.done).toBe(false);
  });

  it('can be skipped on the very first step and during PRESENTS', () => {
    const a = new FlickerSplash();
    a.step(press(Btn.A));
    expect(a.done).toBe(true);
    const b = new FlickerSplash();
    stepTo(b, PRESENTS_AT + 5);
    b.step(press(Btn.START));
    expect(b.done).toBe(true);
  });

  it('stops counting once done', () => {
    const s = new FlickerSplash();
    s.step(press(Btn.START));
    const f = s.frame;
    s.step(NO_PAD);
    expect(s.frame).toBe(f);
  });

  it('is reusable for other studio text and drawing is deterministic', () => {
    const a = new FlickerSplash({ text: 'ACME' });
    const b = new FlickerSplash({ text: 'ACME' });
    const fa = new Framebuffer();
    const fb2 = new Framebuffer();
    stepTo(a, 90);
    stepTo(b, 90);
    a.draw(fa);
    b.draw(fb2);
    expect(fa.hash()).toBe(fb2.hash());
    expect(fa.countNot(C.BLACK)).toBeGreaterThan(0);
  });
});
