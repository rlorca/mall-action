import { describe, expect, it } from 'vitest';
import {
  GameOverScreen,
  GO_CHAR_FRAMES,
  GO_GAMEOVER_AT,
  GO_INPUT_GRACE,
  GO_SHUTTERS_CLOSED_AT,
  GO_SHUTTER_AT,
  GO_TIMEOUT,
  GO_TYPE1_AT,
  GO_TYPE2_AT,
} from './gameover';
import { UI } from '../../content/copy';
import { Btn, NO_PAD, type Pad } from '../../engine/pad';
import type { SfxId } from '../../audio/ids';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });

function run(s: GameOverScreen, frames: number, pad: Pad = NO_PAD): SfxId[] {
  const all: SfxId[] = [];
  for (let i = 0; i < frames; i++) {
    s.step(pad);
    all.push(...s.drainSfx());
  }
  return all;
}

describe('GameOverScreen', () => {
  it('opens with the PA chime and no text yet', () => {
    const s = new GameOverScreen({ score: 1234, hiScore: 5000 });
    expect(s.drainSfx()).toEqual(['paChime']);
    expect(s.line1).toBe('');
    expect(s.line2).toBe('');
    expect(s.showGameOver).toBe(false);
    expect(s.music()).toBeNull();
  });

  it('types the two PA lines one character at a time with blip sfx', () => {
    const s = new GameOverScreen({ score: 0, hiScore: 0 });
    s.drainSfx();
    run(s, GO_TYPE1_AT - 1);
    expect(s.line1).toBe('');
    const sfx = run(s, GO_CHAR_FRAMES * 3);
    expect(s.line1.length).toBeGreaterThanOrEqual(3);
    expect(sfx.filter((x) => x === 'blip').length).toBeGreaterThanOrEqual(3);
    run(s, GO_TYPE2_AT - s.frame + UI.closedLine2.length * GO_CHAR_FRAMES);
    expect(s.line1).toBe(UI.closedLine1);
    expect(s.line2).toBe(UI.closedLine2);
  });

  it('line 1 is complete before line 2 starts', () => {
    expect(GO_TYPE1_AT + UI.closedLine1.length * GO_CHAR_FRAMES).toBeLessThanOrEqual(GO_TYPE2_AT);
  });

  it('shutters roll down top floor first and are fully closed before GAME OVER', () => {
    const s = new GameOverScreen({ score: 0, hiScore: 0 });
    run(s, GO_SHUTTER_AT);
    expect(s.shutter(0)).toBe(0);
    run(s, 40);
    expect(s.shutter(0)).toBeGreaterThan(0);
    expect(s.shutter(0)).toBeGreaterThanOrEqual(s.shutter(1));
    expect(s.shutter(1)).toBeGreaterThanOrEqual(s.shutter(2));
    run(s, GO_SHUTTERS_CLOSED_AT - s.frame);
    for (const f of [0, 1, 2]) expect(s.shutter(f)).toBe(1);
    expect(s.showGameOver).toBe(false);
    run(s, GO_GAMEOVER_AT - s.frame);
    expect(s.showGameOver).toBe(true);
    expect(s.music()).toBe('gameover');
  });

  it('shutter progress is monotonic', () => {
    const s = new GameOverScreen({ score: 0, hiScore: 0 });
    let prev = [0, 0, 0];
    for (let i = 0; i < GO_GAMEOVER_AT + 5; i++) {
      s.step(NO_PAD);
      const cur = [0, 1, 2].map((f) => s.shutter(f));
      cur.forEach((v, f) => expect(v).toBeGreaterThanOrEqual(prev[f]!));
      prev = cur;
    }
  });

  it('Start is ignored during the grace period, then finishes the screen', () => {
    const s = new GameOverScreen({ score: 10, hiScore: 10 });
    run(s, 5, press(Btn.START));
    expect(s.done).toBe(false);
    run(s, GO_INPUT_GRACE);
    s.step(press(Btn.START));
    expect(s.done).toBe(true);
  });

  it('finishes by itself after about 10 seconds', () => {
    const s = new GameOverScreen({ score: 10, hiScore: 10 });
    let n = 0;
    while (!s.done && n < 5000) {
      s.step(NO_PAD);
      n++;
    }
    expect(n).toBe(GO_TIMEOUT);
    expect(GO_TIMEOUT).toBe(600);
  });

  it('flags a new record only when the score is positive and reaches the high score', () => {
    expect(new GameOverScreen({ score: 500, hiScore: 500 }).newRecord).toBe(true);
    expect(new GameOverScreen({ score: 400, hiScore: 500 }).newRecord).toBe(false);
    expect(new GameOverScreen({ score: 0, hiScore: 0 }).newRecord).toBe(false);
  });

  it('exposes score and high score for the view', () => {
    const s = new GameOverScreen({ score: 123, hiScore: 456 });
    expect(s.score).toBe(123);
    expect(s.hiScore).toBe(456);
  });
});
