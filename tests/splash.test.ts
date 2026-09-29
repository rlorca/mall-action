import { describe, expect, it } from 'vitest';
import { FlickerSplash, RAINBOW } from '../src/flickersoft';
import { letterVisible } from '../src/flickersoft/timing';

function mk(opts: { skipAllowed?: boolean } = {}) {
  let jingles = 0;
  const s = new FlickerSplash({ width: 256, height: 240, onJingle: () => jingles++, ...opts });
  return { s, jingles: () => jingles };
}

function fakeCtx() {
  const fills: { style: string; x: number; y: number; w: number; h: number }[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ style: this.fillStyle as string, x, y, w, h });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

describe('timing', () => {
  it('alternates by frame and neighbours are out of phase for 60 frames', () => {
    for (let f = 0; f < 60; f++) {
      for (let i = 0; i < 11; i++) {
        expect(letterVisible(i, f)).toBe(i % 2 === f % 2);
        if (i < 10) expect(letterVisible(i, f)).not.toBe(letterVisible(i + 1, f));
      }
    }
  });
  it('all letters visible once settled', () => {
    for (let f = 60; f < 200; f++) for (let i = 0; i < 11; i++) expect(letterVisible(i, f)).toBe(true);
  });
});

describe('FlickerSplash', () => {
  it('jingle fires exactly once at settle, done at ~180 frames', () => {
    const { s, jingles } = mk();
    for (let f = 1; f <= 59; f++) s.update(false);
    expect(jingles()).toBe(0);
    s.update(false);
    expect(jingles()).toBe(1);
    for (let f = 61; f < 180; f++) {
      s.update(false);
      expect(s.done).toBe(false);
    }
    s.update(false);
    expect(s.done).toBe(true);
    s.update(false);
    expect(jingles()).toBe(1);
  });
  it('any button skips; skipAllowed=false ignores it', () => {
    const a = mk();
    a.s.update(true);
    expect(a.s.done).toBe(true);
    const b = mk({ skipAllowed: false });
    b.s.update(true);
    expect(b.s.done).toBe(false);
  });
  it('draw does not throw and draws only visible letters', () => {
    const { s } = mk();
    const f0 = fakeCtx();
    s.draw(f0.ctx); // frame 0: even letters only (6 of 11)
    const colors0 = new Set(f0.fills.filter((f) => f.style !== '#000000').map((f) => f.style));
    expect(colors0.has(RAINBOW[0])).toBe(true);
    expect(colors0.has(RAINBOW[1])).toBe(false);
    s.update(false);
    const f1 = fakeCtx();
    s.draw(f1.ctx);
    const colors1 = new Set(f1.fills.map((f) => f.style));
    expect(colors1.has(RAINBOW[1])).toBe(true);
    expect(colors1.has(RAINBOW[0])).toBe(false);
  });
  it('after settling all 11 letter colours plus underline and PRESENTS are drawn', () => {
    const { s } = mk();
    for (let i = 0; i < 130; i++) s.update(false);
    const f = fakeCtx();
    s.draw(f.ctx);
    const colors = new Set(f.fills.map((x) => x.style));
    for (const c of RAINBOW) expect(colors.has(c)).toBe(true);
    expect(colors.has('#FFFFFF')).toBe(true);
    for (const r of f.fills) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(256);
    }
  });
  it('is deterministic', () => {
    const run = () => {
      const { s } = mk();
      const out: string[] = [];
      for (let i = 0; i < 100; i++) {
        s.update(false);
        const f = fakeCtx();
        s.draw(f.ctx);
        out.push(JSON.stringify(f.fills));
      }
      return out.join('|');
    };
    expect(run()).toBe(run());
  });
});
