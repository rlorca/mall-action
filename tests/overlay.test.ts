import { describe, expect, it } from 'vitest';
import { BANNER_BACKLOG_FRAMES, BANNER_MAX_CHARS, BANNER_QUEUE_MAX, Overlay, POPUP_FRAMES, drawFade, wrapBannerLines } from '../src/render/overlay';
import type { Surface } from '../src/art/surface';

interface Call { fn: string; args: unknown[] }
function fakeSurface(): { s: Surface; calls: Call[] } {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => {
    calls.push({ fn, args });
  };
  const s = {
    w: 256, h: 240,
    rect: rec('rect'), frame: rec('frame'), text: rec('text'), sprite: rec('sprite'), setAlpha: rec('setAlpha'),
    hline: rec('hline'), vline: rec('vline'), px: rec('px'),
  } as unknown as Surface;
  return { s, calls };
}
const run = (o: Overlay, n: number): void => {
  for (let i = 0; i < n; i++) o.update();
};

describe('banners', () => {
  it('shows a banner for the default 150 frames then expires', () => {
    const o = new Overlay();
    o.handle({ t: 'banner', lines: ['HELLO'] });
    expect(o.currentBanner?.lines).toEqual(['HELLO']);
    run(o, 149);
    expect(o.currentBanner).not.toBeNull();
    run(o, 1);
    expect(o.currentBanner).toBeNull();
  });
  it('event.frames overrides the duration', () => {
    const o = new Overlay();
    o.handle({ t: 'banner', lines: ['X'], frames: 30 });
    run(o, 29);
    expect(o.currentBanner).not.toBeNull();
    run(o, 1);
    expect(o.currentBanner).toBeNull();
  });
  it('queues banners and never shows two at once', () => {
    const o = new Overlay();
    o.handle({ t: 'banner', lines: ['A'], frames: 40 });
    o.handle({ t: 'banner', lines: ['B'], frames: 40 });
    expect(o.currentBanner?.lines).toEqual(['A']);
    expect(o.queuedBanners).toBe(1);
    run(o, 40);
    expect(o.currentBanner?.lines).toEqual(['B']);
    run(o, 40);
    expect(o.currentBanner).toBeNull();
  });
  it('shortens the visible banner when others are waiting', () => {
    const o = new Overlay();
    o.handle({ t: 'banner', lines: ['A'] });
    o.handle({ t: 'banner', lines: ['B'] });
    run(o, BANNER_BACKLOG_FRAMES);
    expect(o.currentBanner?.lines).toEqual(['B']);
  });
  it('caps the queue and de-duplicates identical banners', () => {
    const o = new Overlay();
    for (let i = 0; i < 10; i++) o.handle({ t: 'banner', lines: [`B${i}`] });
    expect(o.queuedBanners).toBe(BANNER_QUEUE_MAX);
    const p = new Overlay();
    p.handle({ t: 'banner', lines: ['SAME'] });
    p.handle({ t: 'banner', lines: ['SAME'] });
    expect(p.queuedBanners).toBe(0);
  });
  it('ignores other events', () => {
    const o = new Overlay();
    o.handle({ t: 'sfx', name: 'shot' });
    o.handle({ t: 'music', name: 'title' });
    expect(o.currentBanner).toBeNull();
    expect(o.popupCount).toBe(0);
  });
  it('wraps or truncates overlong lines so they fit on screen', () => {
    const long = 'WILL THE OWNER OF A BLACK VAN MARKED NOT SPIES PLEASE MOVE IT';
    const w = wrapBannerLines([long]);
    expect(w.length).toBeGreaterThan(1);
    for (const l of w) expect(l.length * 8).toBeLessThanOrEqual(256 - 16);
    const nowords = wrapBannerLines(['X'.repeat(100)]);
    for (const l of nowords) expect(l.length).toBeLessThanOrEqual(BANNER_MAX_CHARS);
    expect(wrapBannerLines(['A', 'B', 'C', 'D', 'E', 'F', 'G']).length).toBeLessThanOrEqual(5);
  });
  it('every banner kind draws fully inside 0..255 x 16..239', () => {
    for (const kind of ['info', 'alarm', 'pa', 'item', 'package', 'floor'] as const) {
      const o = new Overlay();
      o.handle({ t: 'banner', lines: ['Z'.repeat(60), 'SHORT', 'ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.'], kind });
      for (const f of [0, 5, 20]) {
        run(o, f ? 5 : 0);
        const { s, calls } = fakeSurface();
        o.draw(s, { x: 0, y: 0 });
        for (const c of calls) {
          if (c.fn === 'rect' || c.fn === 'frame') {
            const [x, y, w, h] = c.args as number[];
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(16);
            expect(x + w).toBeLessThanOrEqual(256);
            expect(y + h).toBeLessThanOrEqual(240);
          }
          if (c.fn === 'text') {
            const [str, x, y, , opts] = c.args as [string, number, number, number, { align?: string }];
            const wpx = str.length * 8;
            const left = opts?.align === 'center' ? x - wpx / 2 : x;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(left + wpx).toBeLessThanOrEqual(256);
            expect(y).toBeGreaterThanOrEqual(16);
            expect(y + 8).toBeLessThanOrEqual(240);
          }
        }
      }
    }
  });
});

describe('popups', () => {
  it('float for ~60 frames then vanish; drawing converts world to screen', () => {
    const o = new Overlay();
    o.handle({ t: 'popup', x: 100, y: 100, text: '100' });
    expect(o.popupCount).toBe(1);
    run(o, POPUP_FRAMES - 1);
    expect(o.popupCount).toBe(1);
    run(o, 1);
    expect(o.popupCount).toBe(0);
  });
  it('are clamped on screen even at the world edge', () => {
    const o = new Overlay();
    o.handle({ t: 'popup', x: 2, y: 2, text: '500' });
    o.handle({ t: 'popup', x: 9999, y: 9999, text: '500' });
    const { s, calls } = fakeSurface();
    o.draw(s, { x: 0, y: 0 });
    for (const c of calls.filter((k) => k.fn === 'text')) {
      const [str, x, y] = c.args as [string, number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + str.length * 8).toBeLessThanOrEqual(256);
      expect(y).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('toast', () => {
  it('expires after its frames and reset clears everything', () => {
    const o = new Overlay();
    o.toast('CRT ON', 10);
    expect(o.toastActive).toBe(true);
    run(o, 9);
    expect(o.toastActive).toBe(true);
    run(o, 1);
    expect(o.toastActive).toBe(false);
    o.toast('SOUND OFF');
    o.handle({ t: 'banner', lines: ['A'] });
    o.handle({ t: 'popup', x: 1, y: 1, text: '1' });
    o.handle({ t: 'shake', frames: 10, mag: 3 });
    o.reset();
    expect(o.toastActive).toBe(false);
    expect(o.currentBanner).toBeNull();
    expect(o.popupCount).toBe(0);
    expect(o.shakeOffset()).toEqual({ x: 0, y: 0 });
  });
  it('draws inside the screen with a border', () => {
    const o = new Overlay();
    o.toast('SOUND OFF');
    const { s, calls } = fakeSurface();
    o.draw(s, { x: 0, y: 0 });
    expect(calls.some((c) => c.fn === 'frame')).toBe(true);
    const t = calls.find((c) => c.fn === 'text')!;
    expect((t.args[0] as string).length * 8).toBeLessThanOrEqual(256);
  });
});

describe('shake and flash', () => {
  const trace = (): { x: number; y: number }[] => {
    const o = new Overlay();
    o.handle({ t: 'shake', frames: 30, mag: 4 });
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < 35; i++) {
      out.push(o.shakeOffset());
      o.update();
    }
    return out;
  };
  it('is deterministic, bounded, decays to zero', () => {
    const a = trace();
    expect(trace()).toEqual(a);
    a.forEach((v, i) => {
      const bound = Math.round((4 * (30 - i)) / 30);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(Math.max(0, bound));
      expect(Math.abs(v.y)).toBeLessThanOrEqual(Math.max(0, bound));
      expect(Number.isInteger(v.x) && Number.isInteger(v.y)).toBe(true);
    });
    expect(a.slice(30).every((v) => v.x === 0 && v.y === 0)).toBe(true);
    expect(a.slice(0, 10).some((v) => v.x !== 0 || v.y !== 0)).toBe(true);
  });
  it('flash decays 0..1', () => {
    const o = new Overlay();
    expect(o.flashAlpha()).toBe(0);
    o.handle({ t: 'flash', frames: 10 });
    const a0 = o.flashAlpha();
    expect(a0).toBeGreaterThan(0);
    expect(a0).toBeLessThanOrEqual(1);
    run(o, 5);
    expect(o.flashAlpha()).toBeLessThan(a0);
    run(o, 5);
    expect(o.flashAlpha()).toBe(0);
  });
});

describe('drawFade', () => {
  it('is a no-op at 0, opaque at 1 and stepped between', () => {
    const a = fakeSurface();
    drawFade(a.s, 0);
    expect(a.calls.length).toBe(0);
    const b = fakeSurface();
    drawFade(b.s, 1);
    expect(b.calls.some((c) => c.fn === 'rect')).toBe(true);
    const alphas = new Set<number>();
    for (let i = 0; i <= 100; i++) {
      const f = fakeSurface();
      drawFade(f.s, i / 100);
      const al = f.calls.find((c) => c.fn === 'setAlpha');
      if (al) alphas.add(al.args[0] as number);
    }
    expect([...alphas].sort()).toEqual([0.25, 0.5, 0.75]);
  });
});
