import { describe, expect, it } from 'vitest';
import { MusicPlayer, TRACKS } from '../src/audio/music';
import { SFX } from '../src/audio/sfx';
import { noteFreq } from '../src/audio/synth';
import { AudioEngine } from '../src/audio/synth';
import { OPEN_STORES } from '../src/core/storeDefs';

describe('note names', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(noteFreq('A4')).toBeCloseTo(440, 6);
    expect(noteFreq('A5')).toBeCloseTo(880, 6);
    expect(noteFreq('A3')).toBeCloseTo(220, 6);
  });

  it('handles sharps and octaves', () => {
    expect(noteFreq('C4')).toBeCloseTo(261.626, 2);
    expect(noteFreq('F#4')).toBeCloseTo(369.994, 2);
    expect(noteFreq('C1')).toBeGreaterThan(30);
  });

  it('returns 0 for a rest or nonsense', () => {
    expect(noteFreq('.')).toBe(0);
    expect(noteFreq('H9')).toBe(0);
  });
});

describe('music', () => {
  it('has the screen tracks the brief lists', () => {
    for (const id of ['title', 'mallAmbient', 'alarm', 'elevator', 'bonus', 'clear', 'gameover', 'splash']) {
      expect(TRACKS[id], `missing track ${id}`).toBeDefined();
    }
  });

  it('has one distinct song per open store', () => {
    const ids = new Set<string>();
    for (const s of OPEN_STORES) {
      expect(TRACKS[s.music!], `missing track for ${s.id}`).toBeDefined();
      ids.add(s.music!);
    }
    expect(ids.size).toBe(10);
  });

  it('only writes notes the synthesiser understands', () => {
    for (const [id, track] of Object.entries(TRACKS)) {
      for (const key of ['p1', 'p2', 'tri'] as const) {
        const pat = track[key];
        if (!pat) continue;
        for (const tok of pat.trim().split(/\s+/)) {
          if (tok === '.' || tok === '-') continue;
          expect(noteFreq(tok), `${id}.${key} bad note '${tok}'`).toBeGreaterThan(0);
        }
      }
      if (track.noi) {
        for (const tok of track.noi.trim().split(/\s+/)) {
          expect('.ksh c'.includes(tok), `${id}.noi bad token '${tok}'`).toBe(true);
        }
      }
      expect(track.speed, `${id} speed`).toBeGreaterThan(0);
      expect(track.volume, `${id} volume`).toBeGreaterThan(0);
      expect(track.volume, `${id} volume`).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the mall bed noticeably quieter than the action tracks', () => {
    expect(TRACKS.mallAmbient.volume).toBeLessThan(TRACKS.title.volume * 0.6);
    expect(TRACKS.mallAmbient.volume).toBeLessThan(TRACKS.alarm.volume * 0.6);
  });

  it('loops the level tracks and plays the jingles once', () => {
    for (const id of ['title', 'mallAmbient', 'alarm', 'elevator', 'bonus']) {
      expect(TRACKS[id].loop, `${id} should loop`).toBe(true);
    }
    for (const id of ['clear', 'gameover', 'splash']) {
      expect(TRACKS[id].loop, `${id} should not loop`).toBe(false);
    }
  });

  it('is inert without an audio context, so the game still runs', () => {
    const engine = new AudioEngine();
    const player = new MusicPlayer(engine);
    player.play('title');
    expect(() => {
      for (let i = 0; i < 600; i++) player.tick();
    }).not.toThrow();
    expect(player.current).toBe('title');
  });
});

describe('sound effects', () => {
  it('defines every id the rules can emit', async () => {
    // The SfxId union is compile-time; this asserts the table is populated.
    const ids = Object.keys(SFX);
    expect(ids.length).toBeGreaterThanOrEqual(25);
    for (const id of ['shot', 'enemyShot', 'jump', 'ding', 'hum', 'crush', 'lampFall', 'glass',
      'searchTick', 'packageFanfare', 'powerup', 'hurt', 'death', 'door', 'blip', 'whistle',
      'ping', 'coin', 'zip', 'paChime', 'smoke', 'shriek', 'buzzer', 'pause']) {
      expect(ids, `missing sfx ${id}`).toContain(id);
    }
  });

  it('every effect is a function', () => {
    for (const [id, fn] of Object.entries(SFX)) {
      expect(typeof fn, `${id}`).toBe('function');
    }
  });
});
