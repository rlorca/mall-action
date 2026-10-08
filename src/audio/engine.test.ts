/**
 * AudioEngine behaviour. Node has no Web Audio, so (a) with no AudioContext every call must be a harmless no-op,
 * and (b) a small recording fake of the parts of the Web Audio API we use stands in for the browser, which lets us
 * test unlock / scheduling / crossfade / jingle / sfx-limit logic and that the synth only makes legal API calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AudioEngine } from './index';
import { SFX_IDS } from './ids';
import { SFX, sfxPoly } from './sfx';

// ---------------------------------------------------------------------------------------------
// A recording fake of the Web Audio surface used by synth.ts / audio.ts
// ---------------------------------------------------------------------------------------------
class FakeParam {
  value = 1;
  events: string[] = [];
  setValueAtTime(v: number, t: number): this {
    this.check(v, t);
    this.value = v;
    this.events.push(`set ${v}@${t}`);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.check(v, t);
    this.events.push(`lin ${v}@${t}`);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.check(v, t);
    if (!(v > 0)) throw new Error(`exponential ramp to ${v}`);
    this.events.push(`exp ${v}@${t}`);
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    this.check(v, t);
    if (!(tc > 0)) throw new Error('bad time constant');
    this.value = v;
    this.events.push(`tgt ${v}@${t}`);
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.check(0, t);
    return this;
  }
  private check(v: number, t: number): void {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error(`non-finite param value ${v} @ ${t}`);
  }
}

let created = { osc: 0, src: 0, gain: 0, started: 0, stopped: 0 };

class FakeNode {
  connected = new Set<FakeNode>();
  connect(n: FakeNode): FakeNode {
    this.connected.add(n);
    return n;
  }
  disconnect(): void {
    this.connected.clear();
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
  constructor() {
    super();
    created.gain++;
  }
}
class FakeSource extends FakeNode {
  private t0: number | null = null;
  onended: (() => void) | null = null;
  start(when = 0): void {
    if (this.t0 !== null) throw new Error('start twice');
    if (!Number.isFinite(when)) throw new Error('bad start');
    this.t0 = when;
    created.started++;
  }
  stop(when = 0): void {
    if (this.t0 === null) throw new Error('InvalidStateError: stop before start');
    if (!Number.isFinite(when)) throw new Error('bad stop');
    created.stopped++;
  }
}
class FakeOsc extends FakeSource {
  frequency = new FakeParam();
  detune = new FakeParam();
  type = 'sine';
  wave: unknown = null;
  setPeriodicWave(w: unknown): void {
    this.wave = w;
  }
  constructor() {
    super();
    created.osc++;
  }
}
class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam();
  override start(when = 0, offset = 0): void {
    if (!(offset >= 0)) throw new Error('bad offset');
    super.start(when);
  }
  constructor() {
    super();
    created.src++;
  }
}
let instances: FakeContext[] = [];
class FakeContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'suspended';
  destination = new FakeNode();
  resumed = 0;
  constructor() {
    instances.push(this);
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  createOscillator(): FakeOsc {
    return new FakeOsc();
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource();
  }
  createBuffer(ch: number, len: number, sr: number): { duration: number; getChannelData: () => Float32Array } {
    const data = new Float32Array(len);
    return { duration: len / sr, getChannelData: () => data };
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array): object {
    expect(real.length).toBe(imag.length);
    return { real, imag };
  }
  createWaveShaper(): FakeNode & { curve: Float32Array | null } {
    return Object.assign(new FakeNode(), { curve: null as Float32Array | null });
  }
  resume(): Promise<void> {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

const g = globalThis as unknown as { AudioContext?: unknown };

describe('AudioEngine without Web Audio (Node)', () => {
  it('every method is a safe no-op', () => {
    expect(g.AudioContext).toBeUndefined();
    const a = new AudioEngine();
    expect(() => {
      a.setMusic('title');
      a.sfx('shot');
      a.setDuck(true);
      a.setDuck(false);
      a.unlock();
      a.unlock();
      a.setMusic('mall');
      a.setMusic('mall');
      a.setMusic(null);
      a.sfx('ding');
      a.setMuted(true);
      a.setMuted(false);
    }).not.toThrow();
    expect(a.isMuted()).toBe(false);
    a.setMuted(true);
    expect(a.isMuted()).toBe(true);
    expect(a.musicPlaying()).toBeNull();
  });
  it('remembers the requested track, and a jingle without audio counts as already played', () => {
    const a = new AudioEngine();
    a.setMusic('title');
    expect(a.musicPlaying()).toBe('title');
    a.unlock();
    expect(a.musicPlaying()).toBe('title');
    a.setMusic('levelclear');
    expect(a.musicPlaying()).toBeNull();
    a.setMusic(null);
    expect(a.musicPlaying()).toBeNull();
  });
  it('accepts every sfx id without throwing', () => {
    const a = new AudioEngine();
    a.unlock();
    for (const id of SFX_IDS) expect(() => a.sfx(id)).not.toThrow();
  });
});

describe('AudioEngine with a (fake) AudioContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    created = { osc: 0, src: 0, gain: 0, started: 0, stopped: 0 };
    instances = [];
    g.AudioContext = FakeContext;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete g.AudioContext;
  });

  /** Advance the fake audio clock and the scheduler timer together. */
  function run(seconds: number, step = 0.04): void {
    const ctx = instances[0]!;
    for (let t = 0; t < seconds - 1e-9; t += step) {
      ctx.currentTime += step;
      vi.advanceTimersByTime(step * 1000);
    }
  }

  it('is silent and creates no context until unlock(), then plays what was requested', () => {
    const a = new AudioEngine();
    a.setMusic('title');
    a.sfx('shot');
    expect(instances).toHaveLength(0);
    expect(created.started).toBe(0);
    a.unlock();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.resumed).toBe(1);
    run(0.5);
    expect(created.started).toBeGreaterThan(5);
    expect(a.musicPlaying()).toBe('title');
  });

  it('unlock() is idempotent (one context) and re-resumes a suspended one', () => {
    const a = new AudioEngine();
    a.unlock();
    a.unlock();
    a.unlock();
    expect(instances).toHaveLength(1);
    instances[0]!.state = 'suspended';
    a.unlock();
    expect(instances[0]!.resumed).toBe(2);
  });

  it('keeps scheduling notes as the clock runs, through a loop point, with legal API calls', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusic('store.gamestonk');
    run(1);
    const afterOne = created.started;
    run(30); // a full pass is about 23 s: runs over the loop point
    expect(created.started).toBeGreaterThan(afterOne + 200);
    expect(a.musicPlaying()).toBe('store.gamestonk');
  });

  it('same id does not restart; a different id does; null silences', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusic('mall');
    run(0.3);
    const n = created.gain;
    a.setMusic('mall');
    a.setMusic('mall');
    expect(created.gain).toBe(n);
    a.setMusic('title');
    expect(created.gain).toBeGreaterThan(n);
    expect(a.musicPlaying()).toBe('title');
    a.setMusic(null);
    expect(a.musicPlaying()).toBeNull();
    const started = created.started;
    run(1);
    expect(created.started).toBe(started);
  });

  it('a jingle plays once, then falls silent and stays finished (no restart on repeated setMusic)', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusic('itemget');
    expect(a.musicPlaying()).toBe('itemget');
    run(0.4);
    const mid = created.started;
    expect(mid).toBeGreaterThan(0);
    run(2);
    expect(a.musicPlaying()).toBeNull();
    const done = created.started;
    a.setMusic('itemget'); // same id: not re-armed
    run(2);
    expect(created.started).toBe(done);
    a.setMusic('title'); // a different track works again
    run(0.5);
    expect(created.started).toBeGreaterThan(done);
    a.setMusic('itemget'); // and now the jingle can be played again
    expect(a.musicPlaying()).toBe('itemget');
  });

  it('a jingle requested before unlock is skipped, not played late', () => {
    const a = new AudioEngine();
    a.setMusic('splash');
    a.unlock();
    run(2);
    expect(created.started).toBe(0);
    expect(a.musicPlaying()).toBeNull();
    a.setMusic('title');
    run(0.5);
    expect(created.started).toBeGreaterThan(0);
  });

  it('muting stops sound (no new voices) without losing the selected track; duck/unduck is safe', () => {
    const a = new AudioEngine();
    a.unlock();
    a.setMusic('title');
    run(0.3);
    a.setMuted(true);
    expect(a.isMuted()).toBe(true);
    const started = created.started;
    a.sfx('shot');
    run(1);
    expect(created.started).toBe(started);
    expect(a.musicPlaying()).toBe('title');
    a.setMuted(false);
    run(0.5);
    expect(created.started).toBeGreaterThan(started);
    expect(() => {
      a.setDuck(true);
      run(0.2);
      a.setDuck(false);
    }).not.toThrow();
  });

  it('sfx: every id plays with legal API calls', () => {
    const a = new AudioEngine();
    a.unlock();
    for (const id of SFX_IDS) {
      run(0.05);
      expect(() => a.sfx(id), id).not.toThrow();
    }
    expect(created.started).toBeGreaterThan(SFX_IDS.length);
    run(3);
  });

  it('sfx: rapid retriggers of one effect are throttled and capped', () => {
    const a = new AudioEngine();
    a.unlock();
    const before = created.started;
    for (let i = 0; i < 200; i++) a.sfx('shot'); // all at the same instant
    expect(created.started - before).toBeLessThanOrEqual(SFX.shot.layers.length * 2);
    // spaced just over the retrigger gap on a long effect: only `poly` copies ever coexist
    for (let i = 0; i < 40; i++) {
      instances[0]!.currentTime += 0.04;
      a.sfx('crush');
      expect((a as unknown as { voices: unknown[] }).voices.length).toBeLessThanOrEqual(2 + 1);
    }
    const crushVoices = (a as unknown as { voices: { id: string }[] }).voices.filter((v) => v.id === 'crush');
    expect(crushVoices.length).toBeLessThanOrEqual(sfxPoly(SFX.crush));
  });

  it('sfx: hum (poly 1) never stacks; the global voice cap holds', () => {
    const a = new AudioEngine();
    a.unlock();
    for (let i = 0; i < 30; i++) {
      instances[0]!.currentTime += 0.05;
      a.sfx('hum');
      expect((a as unknown as { voices: unknown[] }).voices.length).toBeLessThanOrEqual(1);
    }
    for (const id of SFX_IDS) a.sfx(id);
    expect((a as unknown as { voices: unknown[] }).voices.length).toBeLessThanOrEqual(10);
  });

  it('a broken AudioContext degrades to a silent no-op instead of throwing', () => {
    g.AudioContext = class {
      constructor() {
        throw new Error('NotAllowedError');
      }
    };
    const a = new AudioEngine();
    expect(() => {
      a.setMusic('title');
      a.unlock();
      a.sfx('shot');
      a.setMusic('mall');
    }).not.toThrow();

    // context that works at first and then fails when used
    g.AudioContext = class extends FakeContext {
      override createOscillator(): FakeOsc {
        throw new Error('boom');
      }
    };
    const b = new AudioEngine();
    b.setMusic('title');
    expect(() => {
      b.unlock();
      run(0.5);
      b.sfx('shot');
    }).not.toThrow();
  });
});

describe('purity of the audio data layer', () => {
  const FORBIDDEN = [
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
    /new Date\s*\(/,
    /performance\.now\s*\(/,
    /\bdocument\./,
    /\bwindow\./,
    /requestAnimationFrame/,
    /AudioContext/,
    /setInterval|setTimeout/,
  ];
  const WEB_AUDIO_FILES = new Set(['synth.ts', 'audio.ts']);
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
    }
    return out;
  }
  it('only synth.ts and audio.ts touch Web Audio, timers, clocks or randomness', () => {
    const bad: string[] = [];
    for (const file of walk(import.meta.dirname)) {
      if (WEB_AUDIO_FILES.has(file.split('/').pop()!)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*(\*|\/\/|\/\*)/.test(line)) return; // comments may mention them
          const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
          for (const re of FORBIDDEN) if (re.test(code)) bad.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(bad).toEqual([]);
  });
  it('audio.ts schedules with setInterval against the audio clock, never requestAnimationFrame', () => {
    const src = readFileSync(join(import.meta.dirname, 'audio.ts'), 'utf8');
    expect(src).toMatch(/setInterval/);
    expect(src).not.toMatch(/requestAnimationFrame\s*\(/);
    expect(src).not.toMatch(/performance\.now|Date\.now/);
  });
});
