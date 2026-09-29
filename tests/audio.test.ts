import { describe, expect, it } from 'vitest';
import { noteFreq, parsePattern, patternLength, transposePattern } from '../src/audio/notes';
import { compileSong, eventsAtStep, songDuration } from '../src/audio/sequencer';
import { MUSIC_NAMES, SONGS, isJingle } from '../src/audio/songs';
import { SFX, sfxDuration } from '../src/audio/sfxdefs';
import { lfsrSequence } from '../src/audio/noise';
import { createNullAudio } from '../src/audio';
import type { MusicName, SfxName } from '../src/core/events';

const ALL_SFX: SfxName[] = [
  'shot', 'enemyShot', 'jump', 'land', 'thud', 'ding', 'hum', 'crush', 'lamp', 'glass',
  'tick', 'fanfare', 'powerup', 'hurt', 'death', 'door', 'blip', 'whistle', 'ping',
  'coin', 'zip', 'chime', 'smoke', 'shriek', 'buzzer', 'pause', 'beep', 'flash',
  'kick', 'select', 'step', 'elevatorMove', 'alarm', 'extraLife',
];
const ALL_MUSIC: MusicName[] = [
  'title', 'mall', 'alarm', 'elevator', 'booth',
  'store:forever12', 'store:radioshock', 'store:kgbtoys', 'store:hotspy', 'store:footlockpicker',
  'store:sambaddy', 'store:crookstone', 'store:sharperimagine', 'store:spendersgifts', 'store:gamestonk',
  'jingle:levelclear', 'jingle:gameover', 'jingle:itemget', 'jingle:splash', 'jingle:package',
  'jingle:pa', 'jingle:continue', 'jingle:selfie',
];

describe('note helpers', () => {
  it('A4 = 440, octaves and accidentals', () => {
    expect(noteFreq('A4')).toBeCloseTo(440, 6);
    expect(noteFreq('A5')).toBeCloseTo(880, 6);
    expect(noteFreq('C4')).toBeCloseTo(261.626, 2);
    expect(noteFreq('Bb3')).toBeCloseTo(noteFreq('A#3'), 9);
    expect(() => noteFreq('H4')).toThrow();
  });
  it('parses patterns and transposes', () => {
    expect(patternLength('C4:2 R:4 E4')).toBe(8);
    expect(parsePattern('C4:2 R:4')[1]).toEqual({ start: 2, len: 4, name: 'R' });
    expect(transposePattern('C4:2 R:2 A5>C6:4', 12)).toBe('C5:2 R:2 A6>C7:4');
  });
  it('LFSR is +-1 and short mode has a 93-step period', () => {
    const s = lfsrSequence('short', 400);
    expect(s.every((v) => v === 1 || v === -1)).toBe(true);
    expect(Array.from(s.slice(0, 93))).toEqual(Array.from(s.slice(93, 186)));
  });
});

describe('definitions cover the contract', () => {
  it('every SfxName has voices', () => {
    for (const n of ALL_SFX) expect(SFX[n]?.length, n).toBeGreaterThan(0);
    expect(Object.keys(SFX).sort()).toEqual([...ALL_SFX].sort());
  });
  it('every MusicName has a song', () => {
    for (const n of ALL_MUSIC) expect(SONGS[n], n).toBeDefined();
    expect([...MUSIC_NAMES].sort()).toEqual([...ALL_MUSIC].sort());
  });
  it('sfx are finite, audible and within volume range', () => {
    for (const n of ALL_SFX) {
      expect(Number.isFinite(sfxDuration(n)), n).toBe(true);
      expect(sfxDuration(n), n).toBeLessThan(2);
      for (const v of SFX[n]) {
        expect(v.vol).toBeGreaterThan(0);
        expect(v.vol).toBeLessThanOrEqual(1);
        for (const s of v.segs) {
          for (const f of [s.f0, s.f1 ?? s.f0]) {
            expect(f, n).toBeGreaterThanOrEqual(30);
            expect(f, n).toBeLessThanOrEqual(8000);
          }
          expect(s.dur).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('sequencer', () => {
  it('is deterministic', () => {
    const c = compileSong(SONGS.title);
    for (const s of [0, 1, 7, 33, 100]) expect(eventsAtStep(c, s)).toEqual(eventsAtStep(compileSong(SONGS.title), s));
  });
  it('loops wrap at exactly the song length', () => {
    for (const n of ALL_MUSIC.filter((m) => SONGS[m].loop)) {
      const c = compileSong(SONGS[n]);
      for (let s = 0; s < c.length; s++) {
        expect(eventsAtStep(c, s + c.length), `${n}@${s}`).toEqual(eventsAtStep(c, s));
        expect(eventsAtStep(c, s + 3 * c.length)).toEqual(eventsAtStep(c, s));
      }
    }
  });
  it('KGB Toys is a 3/4 waltz', () => {
    const c = compileSong(SONGS['store:kgbtoys']);
    expect(c.def.beatsPerBar).toBe(3);
    expect(c.barSteps).toBe(12);
    expect(c.length % 12).toBe(0);
    expect(c.length / 12).toBeGreaterThanOrEqual(8);
  });
  it('every song is well formed', () => {
    for (const n of ALL_MUSIC) {
      const c = compileSong(SONGS[n]);
      expect(c.channels.length, n).toBeGreaterThanOrEqual(2);
      const all = c.byStep.flat();
      expect(all.length, n).toBeGreaterThan(0);
      for (const ch of c.channels) {
        expect(all.some((e) => e.channel === ch), `${n}/${ch} non-empty`).toBe(true);
        // every track length divides the loop length so it tiles cleanly
        const len = patternLength(SONGS[n].tracks[ch]!.notes);
        expect(c.length % len === 0 || len === c.length, `${n}/${ch} len ${len} vs ${c.length}`).toBe(true);
      }
      for (const e of all) {
        for (const f of [e.freq, e.freq1 ?? e.freq]) {
          expect(f, n).toBeGreaterThanOrEqual(30);
          expect(f, n).toBeLessThanOrEqual(8000);
        }
        expect(e.vol).toBeGreaterThan(0);
        expect(e.vol).toBeLessThanOrEqual(1);
        expect(e.dur).toBeGreaterThan(0);
        expect(Number.isFinite(e.time)).toBe(true);
      }
    }
  });
  it('jingles finish, loops loop', () => {
    for (const n of ALL_MUSIC) {
      const c = compileSong(SONGS[n]);
      if (isJingle(n)) {
        expect(SONGS[n].loop, n).toBe(false);
        expect(Number.isFinite(songDuration(c))).toBe(true);
        expect(songDuration(c), n).toBeLessThan(6);
        expect(eventsAtStep(c, c.length)).toEqual([]);
        expect(eventsAtStep(c, c.length + 5)).toEqual([]);
      } else {
        expect(SONGS[n].loop, n).toBe(true);
      }
    }
  });
  it('splash sting is about 1.2 s', () => {
    expect(songDuration(compileSong(SONGS['jingle:splash']))).toBeCloseTo(1.2, 1);
  });
  it('mall ambient is quieter than the title', () => {
    const peak = (n: MusicName): number => Math.max(...compileSong(SONGS[n]).byStep.flat().map((e) => e.vol));
    expect(peak('mall')).toBeLessThan(peak('title') * 0.6);
  });
});

describe('null audio', () => {
  it('toggleMute flips and returns the new state', () => {
    const a = createNullAudio();
    expect(a.muted).toBe(false);
    expect(a.toggleMute()).toBe(true);
    expect(a.muted).toBe(true);
    expect(a.toggleMute()).toBe(false);
    a.setMuted(true);
    expect(a.muted).toBe(true);
    a.resume(); a.sfx('shot'); a.music('title'); a.hum(true); a.setMusicDuck(true);
    a.handleEvent({ t: 'sfx', name: 'jump' });
  });
});
