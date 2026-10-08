import { describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES,
  NOTE_MAX,
  NOTE_MIN,
  chordTone,
  keyPitchClasses,
  midiToHz,
  midiToName,
  noteHz,
  noteToMidi,
  parseChord,
  pitchClass,
} from './notes';
import { type SongDef, compileSong, rep } from './song';
import { eventsBetween, isFinished, playbackLength } from './sequencer';
import { adsrFrames, evalFrames, lfsrSequence, pulseCoefficients, vibratoCents } from './mix';
import { DRUMS } from './drums';

const base: SongDef = {
  id: 'title',
  title: 'test',
  bpm: 120,
  beats: 4,
  key: { tonic: 'C', mode: 'major' },
  loop: true,
  vol: 1,
};

describe('notes', () => {
  it('maps names to MIDI and Hz', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#3')).toBe(54);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(noteHz('A5')).toBeCloseTo(880, 6);
    expect(midiToName(60)).toBe('C4');
    expect(NOTE_MIN).toBeLessThan(NOTE_MAX);
  });
  it('rejects junk', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
    expect(() => pitchClass('X')).toThrow();
    expect(() => parseChord('Cwhatever')).toThrow();
  });
  it('builds chords and chord tones', () => {
    const am = parseChord('Am7');
    expect(chordTone(am, 1, 2)).toBe(noteToMidi('A2'));
    expect(chordTone(am, 2, 2)).toBe(noteToMidi('C3'));
    expect(chordTone(am, 4, 2)).toBe(noteToMidi('G3'));
    expect(chordTone(am, 5, 2)).toBe(noteToMidi('A3'));
    expect(() => chordTone(am, 0, 2)).toThrow();
    for (const q of Object.keys(CHORD_QUALITIES)) expect(CHORD_QUALITIES[q]![0]).toBe(0);
  });
  it('knows the notes of a key, with extras', () => {
    const cm = keyPitchClasses({ tonic: 'C', mode: 'minor' });
    expect([...cm].sort((a, b) => a - b)).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(keyPitchClasses({ tonic: 'A', mode: 'minor', extra: ['G#'] }).has(8)).toBe(true);
  });
});

describe('pattern DSL', () => {
  it('compiles notes, rests, ties and lengths into timed events', () => {
    const s = compileSong({ ...base, pulse1: ['C4:2 - E4:2 =:2 -:9 | G4:8 -:8 |'] });
    // 120 bpm, 4 steps per beat -> 0.125 s per step
    expect(s.stepSec).toBeCloseTo(0.125, 9);
    expect(s.stepsPerBar).toBe(16);
    expect(s.bars).toBe(2);
    const ev = s.channels.pulse1;
    expect(ev.map((e) => e.midi)).toEqual([60, 64, 67]);
    expect(ev[0]!.start).toBeCloseTo(0, 9);
    expect(ev[1]!.start).toBeCloseTo(0.375, 9);
    // E4 was tied: it lasts 4 steps (gate < 1)
    expect(ev[1]!.dur).toBeGreaterThan(0.4);
    expect(ev[1]!.dur).toBeLessThanOrEqual(0.5);
    expect(ev[2]!.start).toBeCloseTo(2, 9);
    expect(s.duration).toBeCloseTo(4, 9);
  });
  it('derives bar length from the time signature (3/4 -> 12 steps)', () => {
    const s = compileSong({ ...base, beats: 3, pulse1: ['C4:12 | D4:12 |'] });
    expect(s.stepsPerBar).toBe(12);
    expect(s.bars).toBe(2);
    expect(() => compileSong({ ...base, beats: 3, pulse1: ['C4:16 |'] })).toThrow(/bar/);
  });
  it('checks bar lines and lane lengths and unknown tokens', () => {
    expect(() => compileSong({ ...base, pulse1: ['C4:4 | C4:12 |'] })).toThrow(/bar line/);
    expect(() => compileSong({ ...base, pulse1: ['C4:16'], triangle: ['C3:8'] })).toThrow(/lane/);
    expect(() => compileSong({ ...base, pulse1: ['C4:8'] })).toThrow(/whole number/);
    expect(() => compileSong({ ...base, pulse1: ['Q4:16'] })).toThrow(/pitch/);
    expect(() => compileSong({ ...base, pulse1: ['@nope C4:16'] })).toThrow(/instrument/);
    expect(() => compileSong({ ...base, noise: ['z:16'] })).toThrow(/drum/);
    expect(() => compileSong({ ...base, pulse1: ['$1:16'] })).toThrow(/chord/);
    expect(() => compileSong({ ...base, pulse1: ['=:16'] })).toThrow(/tie/);
    expect(() => compileSong({ ...base })).toThrow(/no content/);
  });
  it('resolves chord-relative tokens from the chord lane', () => {
    const s = compileSong({
      ...base,
      chords: ['C:8 Am:8'],
      inst: { b: { oct: 2 } },
      triangle: ["@b $1:2 $2:2 $3:2 $1':2 $1:2 $2:2 $3:2 $1':2"],
    });
    expect(s.channels.triangle.map((e) => midiToName(e.midi))).toEqual(['C2', 'E2', 'G2', 'C3', 'A2', 'C3', 'E3', 'A3']);
  });
  it('expands arpeggios into quick sequential sub-notes', () => {
    const s = compileSong({ ...base, inst: { a: { arp: 50 } }, pulse1: ['@a C4+E4+G4:8 -:8 |'] });
    const ev = s.channels.pulse1;
    expect(ev.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ev.map((e) => e.midi))).toEqual(new Set([60, 64, 67]));
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.start).toBeGreaterThanOrEqual(ev[i - 1]!.start + ev[i - 1]!.dur - 1e-9);
    // the whole arp fits inside its 1 s slot
    expect(ev[ev.length - 1]!.start + ev[ev.length - 1]!.dur).toBeLessThanOrEqual(1.0001);
  });
  it('swing pushes off-beats late but keeps bar boundaries fixed', () => {
    const straight = compileSong({ ...base, pulse1: ['C4:2 D4:2 E4:2 F4:2 G4:8 |'] });
    const swung = compileSong({ ...base, swing: 0.3, swingStep: 2, pulse1: ['C4:2 D4:2 E4:2 F4:2 G4:8 |'] });
    expect(swung.duration).toBeCloseTo(straight.duration, 9);
    expect(swung.channels.pulse1[1]!.start).toBeGreaterThan(straight.channels.pulse1[1]!.start);
    expect(swung.channels.pulse1[2]!.start).toBeCloseTo(straight.channels.pulse1[2]!.start, 9);
  });
  it('noise events use the drum kit', () => {
    const s = compileSong({ ...base, noise: ['k - s - k:4 c:8 |'] });
    expect(s.channels.noise.map((e) => e.drum)).toEqual(['k', 's', 'k', 'c']);
    for (const e of s.channels.noise) {
      expect(e.freq).toBe(DRUMS[e.drum!]!.hz);
      expect(e.midi).toBe(-1);
    }
  });
  it('rep repeats a pattern', () => {
    expect(rep('C4 D4', 3)).toBe('C4 D4 C4 D4 C4 D4');
  });
});

describe('sequencer', () => {
  const s = compileSong({ ...base, pulse1: ['C4:4 D4:4 E4:4 F4:4 |', 'G4:4 A4:4 B4:4 C5:4 |'], loop: true, loopBar: 1 });
  const jingle = compileSong({ ...base, loop: false, pulse1: ['C4:4 D4:4 E4:4 F4:4 |'] });

  it('returns events in a window, deterministically', () => {
    const a = eventsBetween(s, 0, 4);
    const b = eventsBetween(s, 0, 4);
    expect(a.map((x) => x.time)).toEqual(b.map((x) => x.time));
    expect(a.map((x) => x.event.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(eventsBetween(s, 5, 5)).toEqual([]);
    expect(eventsBetween(s, 5, 4)).toEqual([]);
  });
  it('loops from the loop point (intro plays once)', () => {
    // duration 4 s, loopStart 2 s, loop length 2 s
    expect(s.duration).toBeCloseTo(4, 9);
    expect(s.loopStart).toBeCloseTo(2, 9);
    const wrap = eventsBetween(s, 3.5, 6.5);
    const midis = wrap.map((x) => x.event.midi);
    expect(midis).toEqual([72, 67, 69, 71, 72, 67]);
    expect(wrap[1]!.time).toBeCloseTo(4, 9);
    expect(wrap[5]!.time).toBeCloseTo(6, 9);
  });
  it('slicing a long run into windows yields the same events as one big window', () => {
    const whole = eventsBetween(s, 0, 21.3).map((x) => `${x.event.step}@${x.time.toFixed(6)}`);
    const parts: string[] = [];
    for (let t = 0; t < 21.3; t += 0.37) {
      parts.push(...eventsBetween(s, t, Math.min(t + 0.37, 21.3)).map((x) => `${x.event.step}@${x.time.toFixed(6)}`));
    }
    expect(parts).toEqual(whole);
  });
  it('jingles stop after one pass', () => {
    expect(eventsBetween(jingle, 0, 100)).toHaveLength(4);
    expect(eventsBetween(jingle, jingle.duration, 100)).toHaveLength(0);
    expect(isFinished(jingle, jingle.duration)).toBe(true);
    expect(isFinished(s, 1000)).toBe(false);
    expect(playbackLength(jingle, 5)).toBe(jingle.duration);
    expect(playbackLength(s, 3)).toBeCloseTo(4 + 2 * 2, 9);
  });
});

describe('mix primitives', () => {
  it('envelopes are piecewise linear, start and end at silence', () => {
    const f = adsrFrames(10, 100, 0.5, 0.3, 20);
    expect(f[0]).toEqual([0, 0]);
    expect(f[f.length - 1]![1]).toBe(0);
    for (let i = 1; i < f.length; i++) expect(f[i]![0]).toBeGreaterThan(f[i - 1]![0]);
    expect(evalFrames(f, 0.01)).toBeCloseTo(1, 6);
    expect(evalFrames(f, 0.11)).toBeCloseTo(0.5, 6);
    expect(evalFrames(f, 0.2)).toBeCloseTo(0.5, 6);
    expect(evalFrames(f, 0.5)).toBe(0);
    // note shorter than the attack: cut mid-ramp, still ends at 0
    const short = adsrFrames(100, 0, 1, 0.02, 10);
    expect(Math.max(...short.map((k) => k[1]))).toBeLessThan(0.3);
    expect(short[short.length - 1]![1]).toBe(0);
  });
  it('vibrato waits for its delay and stays within its depth', () => {
    const v = { depth: 30, rate: 6, delay: 200 };
    expect(vibratoCents(v, 0.1)).toBe(0);
    expect(vibratoCents(undefined, 1)).toBe(0);
    let max = 0;
    for (let t = 0; t < 2; t += 0.003) max = Math.max(max, Math.abs(vibratoCents(v, t)));
    expect(max).toBeLessThanOrEqual(30);
    expect(max).toBeGreaterThan(25);
  });
  it('pulse harmonics reproduce the duty cycle', () => {
    for (const duty of [0.125, 0.25, 0.5, 0.75]) {
      const { real, imag } = pulseCoefficients(duty, 200);
      let high = 0;
      const N = 2000;
      let max = -Infinity;
      let min = Infinity;
      const vals: number[] = [];
      for (let i = 0; i < N; i++) {
        const x = (i / N) * 2 * Math.PI;
        let y = 0;
        for (let k = 1; k < real.length; k++) y += real[k]! * Math.cos(k * x) + imag[k]! * Math.sin(k * x);
        vals.push(y);
        max = Math.max(max, y);
        min = Math.min(min, y);
      }
      const mid = (max + min) / 2;
      for (const y of vals) if (y > mid) high++;
      expect(high / N).toBeCloseTo(duty, 1);
    }
  });
  it('noise LFSR has the NES periods', () => {
    expect(lfsrSequence(false)).toHaveLength(32767);
    expect(lfsrSequence(true)).toHaveLength(93);
    for (const v of lfsrSequence(true)) expect(Math.abs(v)).toBe(1);
    const longSeq = lfsrSequence(false);
    const ones = longSeq.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
    expect(Math.abs(ones / longSeq.length - 0.5)).toBeLessThan(0.02);
  });
});
