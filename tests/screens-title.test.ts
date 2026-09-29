import { describe, expect, it } from 'vitest';
import { TitleState, drawTitle } from '../src/screens/title';
import { Driver, RecSurface, asSurface } from './screens-helpers';
import type { ButtonName } from '../src/core/pad';

const KON: ButtonName[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

describe('title screen', () => {
  it('emits title music on the first update only', () => {
    const t = new TitleState(0);
    const d = new Driver();
    d.run(t, 5);
    expect(d.buf.events.filter((e) => e.t === 'music' && e.name === 'title')).toHaveLength(1);
  });
  it('Konami code sets blackFriday, also with extra leading Ups', () => {
    for (const extra of [0, 1, 3]) {
      const t = new TitleState(0);
      const d = new Driver();
      for (let i = 0; i < extra; i++) d.tap(t, 'up');
      for (const b of KON) d.tap(t, b);
      expect(t.blackFriday, `extra ${extra}`).toBe(true);
      expect(d.buf.sfxCount('powerup')).toBe(1);
    }
  });
  it('wrong input does not trigger it', () => {
    const t = new TitleState(0);
    const d = new Driver();
    for (const b of [...KON.slice(0, 8), 'a', 'b'] as ButtonName[]) d.tap(t, b);
    expect(t.blackFriday).toBe(false);
  });
  it('held buttons count once (rising edges only)', () => {
    const t = new TitleState(0);
    const d = new Driver();
    d.run(t, 30, { up: true });
    expect(t.blackFriday).toBe(false);
  });
  it('Start requests start', () => {
    const t = new TitleState(0);
    const d = new Driver();
    d.run(t, 3);
    expect(t.startRequested).toBe(false);
    d.tap(t, 'start');
    expect(t.startRequested).toBe(true);
  });
  it('draws all required text within 32 columns', () => {
    const t = new TitleState(4200);
    const d = new Driver();
    for (const bf of [false, true]) {
      if (bf) for (const b of KON) d.tap(t, b);
      for (const frames of [1, 40, 200]) {
        d.run(t, frames);
        const r = new RecSurface();
        drawTitle(asSurface(r), t);
        for (const x of r.texts.filter((q) => !q.small)) {
          expect(x.left, x.str).toBeGreaterThanOrEqual(0);
          expect(x.right, x.str).toBeLessThanOrEqual(256);
        }
        expect(r.strings).toContain('HI-SCORE 004200');
        expect(r.strings).toContain('A SHOPPING MALL ESPIONAGE');
        expect(r.strings).toContain('(C) 2026 FLICKERSOFT');
        if (bf && t.bfFrame > 150) expect(r.strings).toContain('BLACK FRIDAY MODE');
      }
    }
  });
});
