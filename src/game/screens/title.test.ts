import { describe, expect, it } from 'vitest';
import { TitleScreen, stripOffset, TITLE_STRIP_PERIOD, TITLE_SCROLL_FRAMES } from './title';
import { KONAMI_CODE } from './konami';
import { Btn, NO_PAD, type Pad } from '../../engine/pad';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

function enter(t: TitleScreen, presses: readonly number[], gap = 3): void {
  for (const b of presses) {
    t.step(press(b));
    for (let i = 0; i < gap; i++) t.step(NO_PAD);
  }
}

describe('TitleScreen', () => {
  it('plays the title music and shows the high score it was given', () => {
    const t = new TitleScreen({ hiScore: 12345 });
    expect(t.music()).toBe('title');
    expect(t.hiScore).toBe(12345);
    expect(t.done).toBe(false);
    expect(t.blackFriday).toBe(false);
  });

  it('Start finishes the screen', () => {
    const t = new TitleScreen({ hiScore: 0 });
    for (let i = 0; i < 50; i++) t.step(NO_PAD);
    expect(t.done).toBe(false);
    t.step(press(Btn.START));
    expect(t.done).toBe(true);
    expect(t.drainSfx()).toContain('select');
  });

  it('other buttons (including B and A) do not start the game', () => {
    const t = new TitleScreen({ hiScore: 0 });
    for (const b of [Btn.A, Btn.B, Btn.UP, Btn.SELECT]) t.step(press(b));
    expect(t.done).toBe(false);
  });

  it('the Konami code switches on Black Friday mode and does not start the game', () => {
    const t = new TitleScreen({ hiScore: 0 });
    enter(t, KONAMI_CODE);
    expect(t.blackFriday).toBe(true);
    expect(t.done).toBe(false);
    expect(t.drainSfx()).toContain('fanfare');
    t.step(press(Btn.START));
    expect(t.done).toBe(true);
    expect(t.blackFriday).toBe(true);
  });

  it('works with extra leading Ups', () => {
    const t = new TitleScreen({ hiScore: 0 });
    enter(t, [Btn.UP, Btn.UP, Btn.UP, Btn.UP, ...KONAMI_CODE]);
    expect(t.blackFriday).toBe(true);
  });

  it('a wrong press in the middle prevents it', () => {
    const t = new TitleScreen({ hiScore: 0 });
    enter(t, [...KONAMI_CODE.slice(0, 4), Btn.SELECT, ...KONAMI_CODE.slice(4)]);
    expect(t.blackFriday).toBe(false);
  });

  it('counts frames since the code was entered', () => {
    const t = new TitleScreen({ hiScore: 0 });
    expect(t.blackFridayFrames).toBe(0);
    enter(t, KONAMI_CODE, 0);
    const f0 = t.blackFridayFrames;
    for (let i = 0; i < 10; i++) t.step(NO_PAD);
    expect(t.blackFridayFrames).toBe(f0 + 10);
  });

  it('the storefront row wraps seamlessly after exactly one period', () => {
    expect(stripOffset(0)).toBe(0);
    expect(stripOffset(1)).toBe(0);
    expect(stripOffset(TITLE_SCROLL_FRAMES)).toBe(1);
    expect(stripOffset(TITLE_STRIP_PERIOD * TITLE_SCROLL_FRAMES)).toBe(0);
    expect(stripOffset(TITLE_STRIP_PERIOD * TITLE_SCROLL_FRAMES - 1)).toBe(TITLE_STRIP_PERIOD - 1);
    const t = new TitleScreen({ hiScore: 0 });
    for (let i = 0; i < 100; i++) t.step(NO_PAD);
    expect(t.scroll).toBe(50);
  });
});
