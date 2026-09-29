import type { AudioEngine, Duty } from './synth';
import { noteFreq } from './synth';

/**
 * Music. All original compositions; no copyrighted melodies.
 *
 * A track is four channel patterns written as space-separated tokens:
 *   C4 / F#3   a note
 *   -          hold the previous note
 *   .          rest
 * Noise uses k (kick), s (snare), h (hat), c (crash), . (rest).
 *
 * Channels loop independently at their own lengths, so an 8-step bass can sit
 * under a 32-step melody without writing it out four times.
 */

export interface Track {
  /** Frames per step at 60 Hz. 8 = ~112 BPM in 16ths. */
  speed: number;
  /** Overall level. The mall bed is deliberately much quieter. */
  volume: number;
  loop: boolean;
  p1?: string;
  p2?: string;
  tri?: string;
  noi?: string;
  duty1?: Duty;
  duty2?: Duty;
  /** Use soft pads instead of pulses for p1 (the ambient bed). */
  padded?: boolean;
}

const t = (s: string): string[] => s.trim().split(/\s+/);

export const TRACKS: Record<string, Track> = {
  // -------------------------------------------------------------------------
  splash: {
    speed: 7,
    volume: 0.35,
    loop: false,
    p1: 'C4 E4 G4 C5 - - . . E5 - G5 - C6 - - -',
    p2: '.  C4 E4 G4 - - . . C5 - E5 - G5 - - -',
    tri: 'C2 - - - G2 - - - C3 - - - C3 - - -',
    noi: 'c . . . . . . . s . . . c . . .',
    duty1: 0.5,
    duty2: 0.25,
  },

  // A heroic spy-caper march.
  title: {
    speed: 8,
    volume: 0.3,
    loop: true,
    p1: `A4 - . A4 C5 - B4 - A4 - . G4 A4 - - -
         E5 - . E5 D5 - C5 - B4 - . A4 B4 - - -
         C5 - . C5 E5 - D5 - C5 - . B4 A4 - - -
         E4 - G4 - A4 - B4 - C5 - E5 - A5 - - -`,
    p2: `A3 - . A3 E4 - . . A3 - . E4 . . . .
         C4 - . C4 G4 - . . C4 - . G4 . . . .
         A3 - . A3 E4 - . . A3 - . E4 . . . .
         E3 - . E3 B3 - . . E3 - . B3 . . . .`,
    tri: 'A1 - A2 - E2 - A2 - F1 - F2 - C2 - F2 - G1 - G2 - D2 - G2 - E1 - E2 - B1 - E2 -',
    noi: 'k . h . s . h . k . h . s . h h',
    duty1: 0.5,
    duty2: 0.125,
  },

  // The mall itself: quiet, sparse ambient. Soft pads, a slow bass, a rare bell.
  mallAmbient: {
    speed: 22,
    volume: 0.14,
    loop: true,
    padded: true,
    p1: `A3 - - - - - - - F3 - - - - - - -
         G3 - - - - - - - E3 - - - - - - -`,
    p2: `. . . . . . . . . . . . . . . E6
         . . . . . . . . . . . . . . . .
         . . . . . . . A6 . . . . . . . .
         . . . . . . . . . . . . . . . .`,
    tri: 'A1 - - - - - - - F1 - - - - - - - G1 - - - - - - - E1 - - - - - - -',
    duty2: 0.125,
  },

  // Alarm: a tense, faster spy groove with a siren figure.
  alarm: {
    speed: 6,
    volume: 0.28,
    loop: true,
    p1: `A4 A4 . A4 C5 . B4 . A4 A4 . A4 G4 . . .
         A4 A4 . A4 C5 . D5 . E5 - D5 - C5 - B4 -`,
    // The siren: two notes swinging back and forth.
    p2: 'E5 - - - A5 - - - E5 - - - A5 - - -',
    tri: 'A1 A1 A2 A1 A1 A1 A2 A1 F1 F1 F2 F1 G1 G1 G2 G1',
    noi: 'k h s h k h s h k h s h k s s s',
    duty1: 0.25,
    duty2: 0.125,
  },

  // Elevator: a muzak arrangement of the title theme.
  elevator: {
    speed: 14,
    volume: 0.2,
    loop: true,
    p1: `A4 - - - C5 - B4 - A4 - - - G4 - - -
         E5 - - - D5 - C5 - B4 - - - A4 - - -`,
    p2: 'C4 - E4 - A4 - E4 - F3 - A3 - C4 - A3 -',
    tri: 'A1 - - - E2 - - - F1 - - - C2 - - -',
    noi: '. . h . . . h . . . h . . . h .',
    duty1: 0.5,
    duty2: 0.125,
  },

  // The Sam Baddy listening booth: a bonus pop track.
  bonus: {
    speed: 7,
    volume: 0.3,
    loop: true,
    p1: `G4 - A4 - B4 - D5 - B4 - A4 - G4 - - -
         E4 - G4 - A4 - B4 - A4 - G4 - E4 - - -`,
    p2: 'G3 B3 D4 B3 E3 G3 B3 G3 C4 E4 G4 E4 D4 F#4 A4 F#4',
    tri: 'G1 - G2 - E1 - E2 - C2 - C3 - D2 - D3 -',
    noi: 'k h s h k h s h k h s h k h s s',
    duty1: 0.25,
    duty2: 0.5,
  },

  clear: {
    speed: 8,
    volume: 0.34,
    loop: false,
    p1: 'C5 - E5 - G5 - C6 - - - G5 - C6 - - - - - - -',
    p2: 'C4 - E4 - G4 - C5 - - - E5 - G5 - - - - - - -',
    tri: 'C2 - - - G2 - - - C3 - - - - - - - - - - -',
    noi: 'c . . . s . . . c . . . c . . . . . . .',
    duty1: 0.5,
    duty2: 0.25,
  },

  gameover: {
    speed: 13,
    volume: 0.3,
    loop: false,
    p1: 'A4 - G4 - F4 - E4 - D4 - - - A3 - - - - - - -',
    tri: 'A2 - G2 - F2 - E2 - D2 - - - A1 - - - - - - -',
    duty1: 0.5,
  },

  // ---- one distinct song per open store ----------------------------------

  // FOREVER 12: disco strut.
  store_forever12: {
    speed: 7,
    volume: 0.26,
    loop: true,
    p1: `D5 - C5 - A4 - . A4 D5 - F5 - E5 - D5 -
         C5 - A4 - G4 - . G4 A4 - C5 - D5 - - -`,
    p2: 'D4 A3 D4 F4 A4 F4 D4 A3 C4 G3 C4 E4 G4 E4 C4 G3',
    tri: 'D1 D1 - D2 A1 - D1 - C1 C1 - C2 G1 - C1 -',
    noi: 'k h s h k h s h k h s h k h s s',
    duty1: 0.5,
    duty2: 0.25,
  },

  // RADIOSHOCK: bleepy arpeggios.
  store_radioshock: {
    speed: 4,
    volume: 0.22,
    loop: true,
    p1: `C5 E5 G5 C6 G5 E5 C5 E5 A4 C5 E5 A5 E5 C5 A4 C5
         F4 A4 C5 F5 C5 A4 F4 A4 G4 B4 D5 G5 D5 B4 G4 B4`,
    p2: '. C6 . G5 . C6 . E6 . A5 . E5 . A5 . C6',
    tri: 'C2 - - - A1 - - - F1 - - - G1 - - -',
    noi: '. . h . . . h . . . h . . . h h',
    duty1: 0.125,
    duty2: 0.125,
  },

  // KGB TOYS: a music-box waltz in 3/4.
  store_kgbtoys: {
    speed: 11,
    volume: 0.24,
    loop: true,
    p1: `E5 - - G5 - - B5 - - A5 - - G5 - - E5 - -
         D5 - - F5 - - A5 - - G5 - - F5 - - D5 - -`,
    p2: '. . . E4 . . G4 . . . . . D4 . . F4 . .',
    tri: 'A1 - - E2 - - A2 - - D1 - - A1 - - D2 - -',
    duty1: 0.125,
    duty2: 0.25,
  },

  // HOT SPY ON A STICK: boardwalk polka.
  store_hotspy: {
    speed: 6,
    volume: 0.26,
    loop: true,
    p1: `G4 - B4 - D5 - B4 - G5 - D5 - B4 - G4 -
         C5 - E5 - G5 - E5 - D5 - B4 - G4 - D4 -`,
    p2: 'G3 . D4 . G3 . D4 . C4 . G4 . D4 . A4 .',
    tri: 'G1 - D2 - G1 - D2 - C2 - G2 - D2 - D1 -',
    noi: 'k . s . k . s . k . s . k . s s',
    duty1: 0.5,
    duty2: 0.5,
  },

  // FOOT LOCKPICKER: a stadium march.
  store_footlockpicker: {
    speed: 8,
    volume: 0.28,
    loop: true,
    p1: `C5 - C5 - C5 - . . E5 - D5 - C5 - - -
         G4 - G4 - G4 - . . C5 - B4 - G4 - - -`,
    p2: 'C4 - G4 - C4 - G4 - E4 - G4 - E4 - G4 -',
    tri: 'C1 C1 C2 - G1 G1 G2 - F1 F1 F2 - G1 G1 G2 -',
    noi: 'k k s . k k s . k k s . k s s s',
    duty1: 0.5,
    duty2: 0.25,
  },

  // SAM BADDY: a rock riff.
  store_sambaddy: {
    speed: 6,
    volume: 0.3,
    loop: true,
    p1: `E4 - E4 G4 E4 - A4 - E4 - E4 G4 B4 - A4 -
         D4 - D4 F4 D4 - G4 - E4 - E4 G4 E4 - D4 -`,
    p2: 'E3 . E3 . E3 . E3 . D3 . D3 . E3 . E3 .',
    tri: 'E1 E1 - E2 E1 E1 - E2 D1 D1 - D2 E1 E1 - E2',
    noi: 'k h k s h k s h k h k s h s s s',
    duty1: 0.5,
    duty2: 0.5,
  },

  // CROOKSTONE: lounge bossa nova.
  store_crookstone: {
    speed: 9,
    volume: 0.22,
    loop: true,
    p1: `. A4 - C5 . B4 - . . G4 - A4 . E4 - .
         . F4 - A4 . G4 - . . E4 - F4 . C4 - .`,
    p2: 'D4 . F4 A4 . D4 . F4 C4 . E4 G4 . C4 . E4',
    tri: 'D1 - - A1 - D2 - - C1 - - G1 - C2 - -',
    noi: '. h . h s . h . . h . h s . h .',
    duty1: 0.25,
    duty2: 0.125,
  },

  // SHARPER IMAGINE: dreamy synth pads.
  store_sharperimagine: {
    speed: 18,
    volume: 0.2,
    loop: true,
    padded: true,
    p1: 'F3 - - - A3 - - - C4 - - - A3 - - -',
    p2: 'C6 - - - . . . . E6 - - - . . . .',
    tri: 'F1 - - - - - - - C2 - - - - - - -',
    duty2: 0.125,
  },

  // SPENDER'S GIFTS: a surf groove.
  store_spendersgifts: {
    speed: 6,
    volume: 0.27,
    loop: true,
    p1: `E5 D5 C5 B4 A4 B4 C5 D5 E5 - - - B4 - - -
         A4 G4 F4 E4 D4 E4 F4 G4 A4 - - - E4 - - -`,
    p2: 'A3 - E4 - A3 - E4 - D4 - A4 - E4 - B4 -',
    tri: 'A1 - - - A1 - - - D1 - - - E1 - - -',
    noi: 'k h s h k h s h k h s h s s s s',
    duty1: 0.25,
    duty2: 0.5,
  },

  // GAMESTONK: a hyper game-menu jingle.
  store_gamestonk: {
    speed: 4,
    volume: 0.25,
    loop: true,
    p1: `C5 G5 C6 G5 E5 B5 E6 B5 F5 C6 F6 C6 G5 D6 G6 D6
         C6 - B5 - A5 - G5 - F5 - E5 - D5 - C5 -`,
    p2: 'C4 . G4 . E4 . B4 . F4 . C5 . G4 . D5 .',
    tri: 'C2 - C2 - E2 - E2 - F2 - F2 - G2 - G2 -',
    noi: 'k h h s k h h s k h h s k s s s',
    duty1: 0.125,
    duty2: 0.25,
  },
};

// ---------------------------------------------------------------------------
// Sequencer
// ---------------------------------------------------------------------------

interface Parsed {
  p1: string[];
  p2: string[];
  tri: string[];
  noi: string[];
}

const parsedCache = new Map<string, Parsed>();

function parse(id: string, track: Track): Parsed {
  let p = parsedCache.get(id);
  if (!p) {
    p = {
      p1: track.p1 ? t(track.p1) : [],
      p2: track.p2 ? t(track.p2) : [],
      tri: track.tri ? t(track.tri) : [],
      noi: track.noi ? t(track.noi) : [],
    };
    parsedCache.set(id, p);
  }
  return p;
}

/**
 * Drives one track at a time. Stepped once per simulation frame, so the music
 * stays locked to the 60 Hz clock and stops dead when the game is paused.
 */
export class MusicPlayer {
  private engine: AudioEngine;
  private trackId = 'none';
  private track: Track | null = null;
  private parsed: Parsed | null = null;
  private step = 0;
  private frame = 0;
  private ducked = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  get current(): string {
    return this.trackId;
  }

  play(id: string): void {
    if (id === this.trackId) return;
    this.trackId = id;
    this.track = TRACKS[id] ?? null;
    this.parsed = this.track ? parse(id, this.track) : null;
    this.step = 0;
    this.frame = 0;
  }

  stop(): void {
    this.play('none');
  }

  /** Turn the music down (pause overlay) without stopping it. */
  setDucked(d: boolean): void {
    if (d === this.ducked) return;
    this.ducked = d;
    this.engine.setMusicVolume(d ? 0.25 : 1);
  }

  /** One simulation step. */
  tick(): void {
    const track = this.track;
    const parsed = this.parsed;
    if (!track || !parsed || !this.engine.ready) return;

    if (this.frame++ % track.speed !== 0) return;
    const s = this.step++;

    const longest = Math.max(parsed.p1.length, parsed.p2.length, parsed.tri.length, parsed.noi.length);
    if (!track.loop && longest > 0 && s >= longest) {
      this.stop();
      return;
    }

    const dur = (track.speed / 60) * 0.95;
    const v = track.volume;

    this.voice(parsed.p1, s, (f) => {
      if (track.padded) this.engine.pad(f, dur * 4, v * 0.9);
      else this.engine.pulse(f, dur, v, track.duty1 ?? 0.5, true);
    });
    this.voice(parsed.p2, s, (f) => this.engine.pulse(f, dur, v * 0.7, track.duty2 ?? 0.25, true));
    this.voice(parsed.tri, s, (f) => this.engine.triangle(f, dur * 1.1, v * 0.9, true));

    if (parsed.noi.length) {
      const tok = parsed.noi[s % parsed.noi.length];
      if (tok === 'k') this.engine.noise(0.09, v * 0.9, 300, true, 90);
      else if (tok === 's') this.engine.noise(0.1, v * 0.6, 4000, true, 1200);
      else if (tok === 'h') this.engine.noise(0.03, v * 0.28, 9000, true);
      else if (tok === 'c') this.engine.noise(0.35, v * 0.5, 9000, true, 3000);
    }
  }

  private voice(pattern: string[], s: number, play: (freq: number) => void): void {
    if (pattern.length === 0) return;
    const tok = pattern[s % pattern.length];
    if (tok === '.' || tok === '-') return;
    const f = noteFreq(tok);
    if (f > 0) play(f);
  }
}
