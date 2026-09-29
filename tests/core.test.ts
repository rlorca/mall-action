import { describe, expect, it } from 'vitest';
import { FixedLoop, MAX_CATCHUP_STEPS, STEP_MS } from '../src/core/loop';
import { Rng, parseSeed } from '../src/core/rng';
import {
  Button,
  InputSource,
  Pad,
  gamepadMask,
  resolveKey,
} from '../src/core/input';
import { KONAMI_SEQUENCE, KonamiDetector } from '../src/core/konami';

// ---------------------------------------------------------------------------
// Fixed-step loop
// ---------------------------------------------------------------------------

describe('fixed-step loop', () => {
  it('runs one step per 1/60 s', () => {
    const l = new FixedLoop();
    expect(l.advance(STEP_MS)).toBe(1);
    expect(l.advance(STEP_MS)).toBe(1);
  });

  it('accumulates sub-step time instead of dropping it', () => {
    const l = new FixedLoop();
    expect(l.advance(STEP_MS / 2)).toBe(0);
    expect(l.advance(STEP_MS / 2)).toBe(1);
  });

  it('runs several steps when the browser falls behind', () => {
    const l = new FixedLoop();
    expect(l.advance(STEP_MS * 3)).toBe(3);
  });

  it('caps catch-up so a long stall cannot spiral', () => {
    const l = new FixedLoop();
    expect(l.advance(10_000)).toBe(MAX_CATCHUP_STEPS);
    expect(l.droppedSteps).toBeGreaterThan(0);
    // And it does not stay behind afterwards.
    expect(l.advance(STEP_MS)).toBe(1);
  });

  it('ignores negative and non-finite deltas', () => {
    const l = new FixedLoop();
    expect(l.advance(-500)).toBe(0);
    expect(l.advance(NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

describe('seeded rng', () => {
  it('replays identically for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const as = Array.from({ length: 200 }, () => a.next());
    const bs = Array.from({ length: 200 }, () => b.next());
    expect(as).toEqual(bs);
  });

  it('differs between seeds', () => {
    const r1 = new Rng(1);
    const r2 = new Rng(2);
    const a = Array.from({ length: 50 }, () => r1.next());
    const b = Array.from({ length: 50 }, () => r2.next());
    expect(a).not.toEqual(b);
  });

  it('stays inside its ranges', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const n = r.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(r.int(5)).toBeLessThan(5);
      const v = r.range(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('is roughly uniform', () => {
    const r = new Rng(99);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) buckets[r.int(10)]++;
    for (const b of buckets) expect(b).toBeGreaterThan(1500);
  });

  it('snapshots and restores its state', () => {
    const r = new Rng(3);
    r.next();
    const s = r.getState();
    const a = [r.next(), r.next()];
    r.setState(s);
    expect([r.next(), r.next()]).toEqual(a);
  });

  it('hashes non-numeric seeds deterministically', () => {
    expect(parseSeed('banana', 1)).toBe(parseSeed('banana', 1));
    expect(parseSeed('banana', 1)).not.toBe(parseSeed('apple', 1));
    expect(parseSeed('77', 1)).toBe(77);
    expect(parseSeed(null, 5)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

describe('key mapping', () => {
  it('maps arrows by physical position', () => {
    expect(resolveKey('ArrowUp', 'ArrowUp').mask).toBe(Button.Up);
    expect(resolveKey('ArrowLeft', 'ArrowLeft').mask).toBe(Button.Left);
  });

  it('maps letters by their PRINTED value so QWERTZ/AZERTY work', () => {
    // A QWERTZ player pressing the key printed "Z" reports key='z'.
    expect(resolveKey('z', 'KeyY').mask).toBe(Button.A);
    // An AZERTY player pressing the key printed "A" reports key='a'.
    expect(resolveKey('a', 'KeyQ').mask).toBe(Button.Left);
    expect(resolveKey('w', 'KeyZ').mask).toBe(Button.Up);
  });

  it('falls back to physical position for an unmapped printed letter', () => {
    // QWERTZ: the physical Z position prints "y", which is unmapped.
    expect(resolveKey('y', 'KeyZ').mask).toBe(Button.A);
    // AZERTY: the physical W position prints "z" -> already mapped to A, but
    // the physical Q position prints "a" -> Left. Unmapped example:
    expect(resolveKey('é', 'KeyW').mask).toBe(Button.Up);
  });

  it('maps Space/Enter/Shift/Tab', () => {
    expect(resolveKey(' ', 'Space').mask).toBe(Button.B);
    expect(resolveKey('Enter', 'Enter').mask).toBe(Button.Start);
    expect(resolveKey('Shift', 'ShiftLeft').mask).toBe(Button.Select);
    expect(resolveKey('Tab', 'Tab').mask).toBe(Button.Select);
  });

  it('maps C and M to the system toggles, not to pad buttons', () => {
    expect(resolveKey('c', 'KeyC')).toEqual({ mask: 0, system: 'crt' });
    expect(resolveKey('m', 'KeyM')).toEqual({ mask: 0, system: 'mute' });
  });

  it('returns nothing for unrelated keys', () => {
    expect(resolveKey('F5', 'F5')).toEqual({ mask: 0, system: null });
  });
});

describe('input source', () => {
  it('holds a button while it is down', () => {
    const src = new InputSource();
    src.pressCode('KeyZ', Button.A);
    expect(src.sample() & Button.A).toBeTruthy();
    expect(src.sample() & Button.A).toBeTruthy();
    src.releaseCode('KeyZ');
    expect(src.sample() & Button.A).toBeFalsy();
  });

  it('never loses a tap that starts and ends between two steps', () => {
    const src = new InputSource();
    src.pressCode('KeyZ', Button.A);
    src.releaseCode('KeyZ');
    // The tap is invisible to liveMask but must still produce one held step.
    expect(src.sample() & Button.A).toBeTruthy();
    // ...and exactly one, so it can never latch on.
    expect(src.sample() & Button.A).toBeFalsy();
  });

  it('survives many fast taps in one frame without sticking', () => {
    const src = new InputSource();
    for (let i = 0; i < 5; i++) {
      src.pressCode('KeyZ', Button.A);
      src.releaseCode('KeyZ');
    }
    expect(src.sample() & Button.A).toBeTruthy();
    expect(src.sample() & Button.A).toBeFalsy();
  });

  it('a release clears exactly the key that was pressed', () => {
    const src = new InputSource();
    // Z and J are both the A button. Releasing one must not drop the other.
    src.pressCode('KeyZ', Button.A);
    src.pressCode('KeyJ', Button.A);
    src.sample();
    src.releaseCode('KeyZ');
    expect(src.sample() & Button.A).toBeTruthy();
    src.releaseCode('KeyJ');
    expect(src.sample() & Button.A).toBeFalsy();
  });

  it('uses the mask captured at keydown even if the layout changes', () => {
    const src = new InputSource();
    src.pressCode('KeyW', Button.Up);
    src.sample();
    // The keyup reports a different printed letter; the code still resolves.
    src.releaseCode('KeyW');
    expect(src.sample()).toBe(0);
  });

  it('ignores auto-repeat keydowns', () => {
    const src = new InputSource();
    src.pressCode('ArrowRight', Button.Right);
    src.sample();
    src.pressCode('ArrowRight', Button.Right);
    src.pressCode('ArrowRight', Button.Right);
    src.releaseCode('ArrowRight');
    expect(src.sample()).toBe(0);
  });

  it('clears everything on blur', () => {
    const src = new InputSource();
    src.pressCode('KeyZ', Button.A);
    src.clearAll();
    expect(src.sample()).toBe(0);
  });
});

describe('pad edges', () => {
  it('detects press and release exactly once', () => {
    const p = new Pad();
    p.update(Button.A);
    expect(p.pressed(Button.A)).toBe(true);
    p.update(Button.A);
    expect(p.pressed(Button.A)).toBe(false);
    expect(p.down(Button.A)).toBe(true);
    p.update(0);
    expect(p.released(Button.A)).toBe(true);
  });
});

describe('gamepad', () => {
  it('merges buttons and the left stick', () => {
    const gp = {
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 || i === 9 })),
      axes: [-1, 0],
    };
    const m = gamepadMask(gp);
    expect(m & Button.A).toBeTruthy();
    expect(m & Button.Start).toBeTruthy();
    expect(m & Button.Left).toBeTruthy();
  });

  it('ignores stick noise inside the deadzone', () => {
    const gp = { buttons: [], axes: [0.2, -0.2] };
    expect(gamepadMask(gp)).toBe(0);
  });

  it('handles a disconnected pad', () => {
    expect(gamepadMask(null)).toBe(0);
    expect(gamepadMask(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Konami
// ---------------------------------------------------------------------------

describe('konami code', () => {
  it('fires on the exact sequence', () => {
    const k = new KonamiDetector();
    const results = KONAMI_SEQUENCE.map((b) => k.push(b));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[results.length - 1]).toBe(true);
  });

  it('still fires with extra LEADING presses of Up', () => {
    for (const extra of [1, 2, 5, 20]) {
      const k = new KonamiDetector();
      for (let i = 0; i < extra; i++) expect(k.push(Button.Up)).toBe(false);
      const results = KONAMI_SEQUENCE.map((b) => k.push(b));
      expect(results[results.length - 1]).toBe(true);
    }
  });

  it('does not fire on a wrong sequence', () => {
    const k = new KonamiDetector();
    const wrong = [Button.Up, Button.Up, Button.Down, Button.Left, Button.Right];
    expect(wrong.map((b) => k.push(b)).some(Boolean)).toBe(false);
  });

  it('recovers and fires after a failed attempt', () => {
    const k = new KonamiDetector();
    k.push(Button.Down);
    k.push(Button.Left);
    expect(KONAMI_SEQUENCE.map((b) => k.push(b)).pop()).toBe(true);
  });

  it('ignores buttons outside the alphabet instead of resetting', () => {
    const k = new KonamiDetector();
    k.push(Button.Up);
    k.push(Button.Start);
    k.push(Button.Up);
    for (const b of KONAMI_SEQUENCE.slice(2)) k.push(b);
    // Up Up then the tail completes it.
    expect(k.progress).toBe(0);
  });
});
