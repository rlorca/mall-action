/**
 * Every song in the game, as text in the notation of notation.ts.
 * All compositions are original. Channels: p1/p2 pulse, tri = bass, noise = drums.
 */
import type { SongDef } from './types';
import type { SongId } from './ids';

// The main MALL ACTION theme (A minor), shared by title, muzak and alarm.
// Chords per bar: Am Am Dm E C F E Am
const THEME = `
  A4*2 . A4 C5*2 E5*2 D5*2 C5 . B4*2 G4*2 |
  A4*8 E4*2 A4*2 B4*2 C5*2 |
  D5*2 . D5 F5*2 A5*2 G5*2 F5 . E5*2 D5*2 |
  E5*6 . E5 G#4*2 B4*2 E5*2 D5*2 |
  C5*2 . C5 E5*2 A5*2 G5*2 E5 . C5*2 A4*2 |
  F5*4 E5*2 D5*2 C5*2 B4*2 C5*2 D5*2 |
  E5*2 . E5 A5*2 G5*2 F5*2 E5 . D5*2 B4*2 |
  A4*12 .*4`;

export const SONGS: Record<SongId, SongDef> = {
  title: {
    bpm: 140, loop: true, gain: 0.6, duty1: 'p25', duty2: 'p12',
    tracks: {
      p1: THEME,
      p2: `{A3 C4 E4 C4}x8 {D4 F4 A4 F4}x4 {E3 G#3 B3 G#3}x4 {C4 E4 G4 E4}x4 {F3 A3 C4 A3}x4
           {E3 G#3 B3 G#3}x4 {A3 C4 E4 C4}x4`,
      tri: `{A2*2 A3*2}x8 {D3*2 D2*2}x4 {E2*2 E3*2}x4 {C3*2 C2*2}x4 {F2*2 F3*2}x4 {E2*2 E3*2}x4 {A2*2 A3*2}x4`,
      noise: `{k . h . s . h . k . k h s . h .}x8`,
    },
  },

  // Quiet, sparse ambient bed for the mall itself: soft pad, slow bass, a rare bell.
  mall: {
    bpm: 60, loop: true, gain: 0.22, duty1: 'p50', duty2: 'p12',
    vol: { p1: 0.3, p2: 0.25, tri: 0.5 },
    tracks: {
      p1: `E4*16 C4*16 D4*16 B3*16 C4*16 A3*16 D4*16 B3*16`,
      p2: `.*28 E6*4 .*60 B5*4 .*32`,
      tri: `A2*32 G2*32 F2*32 G2*32`,
    },
  },

  // Tense, faster groove on the theme's harmony, with a two-pitch siren on pulse 1.
  alarm: {
    bpm: 168, loop: true, gain: 0.6, duty1: 'p12', duty2: 'p25',
    vol: { p1: 0.35 },
    tracks: {
      p1: `{A5*4 F5*4}x8`,
      p2: `{A3 . A3 C4 . A3 E4 D4}x4 {G#3 . G#3 B3 . G#3 E4 D4}x2 {A3 . A3 C4 . A3 E4 D4}x2`,
      tri: `{A2 . A2 A2 . A2 G2 G#2}x4 {E2 . E2 E2 . E2 D2 D#2}x2 {A2 . A2 A2 . A2 G2 G#2}x2`,
      noise: `{k h s h k k s h}x8`,
    },
  },

  // Elevator muzak: the theme, slow and soft, over lounge chords and a walking bass.
  muzak: {
    bpm: 96, loop: true, gain: 0.45, duty1: 'p50', duty2: 'p25',
    vol: { p1: 0.4, p2: 0.25, noise: 0.15 },
    tracks: {
      p1: THEME,
      p2: `{C4*8 E4*8}x2 F4*8 A4*8 G#3*8 B3*8 E4*8 G4*8 A3*8 C4*8 G#3*8 B3*8 C4*8 E4*8`,
      tri: `{A2*4 C3*4 E3*4 C3*4}x2 D3*4 F3*4 A3*4 F3*4 E2*4 G#2*4 B2*4 G#2*4 C3*4 E3*4 G3*4 E3*4
            F2*4 A2*4 C3*4 A2*4 E2*4 G#2*4 B2*4 G#2*4 A2*4 C3*4 E3*4 C3*4`,
      noise: `{k . . h . . h . k . . h . . h .}x8`,
    },
  },

  // Listening-booth bonus pop track ("SIDE B").
  bonus: {
    bpm: 128, loop: true, gain: 0.55, duty1: 'p25', duty2: 'p12',
    tracks: {
      p1: `E5*2 G5*2 A5*2 G5*2 E5*2 D5*2 C5*4 | D5*2 E5*2 G5*4 E5*2 D5*2 C5*4 |
           A4*2 C5*2 D5*2 E5*2 G5*2 E5*2 D5*4 | C5*12 .*4`,
      p2: `{C4 E4 G4 E4}x4 {B3 D4 G4 D4}x4 {A3 C4 E4 C4}x4 {A3 C4 F4 C4}x4`,
      tri: `{C3*2 C4*2}x4 {G2*2 G3*2}x4 {A2*2 A3*2}x4 {F2*2 F3*2}x4`,
      noise: `{k . h . s . h k k . h . s . h .}x4`,
    },
  },

  // FOREVER 12: disco strut, four on the floor, octave bass.
  store_forever12: {
    bpm: 118, loop: true, gain: 0.55, duty1: 'p25', duty2: 'p12',
    tracks: {
      p1: `{D5*2 . D5 F5*2 A5*2 . G5 F5*2 D5*2 C5*2 | C5*2 . C5 E5*2 G5*2 . A5 G5*4 .*2}x2`,
      p2: `{{. . F4 .}x4 {. . B4 .}x4}x2`,
      tri: `{{D2 D3}x8 {G2 G3}x8}x2`,
      noise: `{k h o h}x16`,
    },
  },

  // RADIOSHOCK: bleepy arpeggios.
  store_radioshock: {
    bpm: 132, loop: true, gain: 0.5, duty1: 'p12', duty2: 'p25',
    tracks: {
      p1: `{E5 B5 G5 B5}x4 {C5 G5 E5 G5}x4 {D5 A5 F#5 A5}x4 {B4 F#5 D#5 F#5}x4`,
      p2: `E4*8 G4*8 C4*8 E4*8 D4*8 F#4*8 B3*8 D#4*8`,
      tri: `{E2*2 . E2 E3*2 . E2}x2 {C2*2 . C2 C3*2 . C2}x2 {D2*2 . D2 D3*2 . D2}x2 {B1*2 . B1 B2*2 . B1}x2`,
      noise: `{k . h h s . h h}x8`,
    },
  },

  // KGB TOYS: music-box waltz in 3/4 (steps: 2 = eighth notes, 6 steps per bar).
  store_kgbtoys: {
    bpm: 150, steps: 2, loop: true, gain: 0.5, duty1: 'p12', duty2: 'p12',
    vol: { p2: 0.25 },
    tracks: {
      p1: `C6*2 E6 G6 E6 C6 | D6*2 F6 A6 G6 F6 | E6*4 D6 C6 | B5*4 G5*2 |
           A5*2 C6 E6 C6 A5 | G5*2 B5 D6 B5 G5 | C6 E6 D6 B5 G5 B5 | C6*4 .*2`,
      p2: `.*2 E5 . E5 . | .*2 F5 . F5 . | .*2 E5 . E5 . | .*2 D5 . D5 . |
           .*2 C5 . C5 . | .*2 B4 . B4 . | .*2 E5 . D5 . | .*2 E5 . .*2`,
      tri: `C3*2 .*4 D3*2 .*4 C3*2 .*4 G2*2 .*4 A2*2 .*4 G2*2 .*4 C3*2 .*4 C3*2 .*4`,
    },
  },

  // HOT SPY ON A STICK: boardwalk polka, oom-pah.
  store_hotspy: {
    bpm: 132, loop: true, gain: 0.55, duty1: 'p25', duty2: 'p50',
    vol: { p2: 0.25 },
    tracks: {
      p1: `G4 C5 E5 G5 E5*2 C5*2 D5 E5 F5 D5 E5*2 C5*2 | B4 D5 F5 G5 F5*2 D5*2 B4 C5 D5 B4 G4*4 |
           G4 C5 E5 G5 E5*2 C5*2 D5 E5 F5 D5 E5*2 C5*2 | B4 D5 F5 D5 C5*2 E5*2 C5*4 .*4`,
      p2: `{.*2 E4 G4}x4 {.*2 B3 F4}x4 {.*2 E4 G4}x4 {.*2 B3 F4}x2 {.*2 E4 G4}x2`,
      tri: `{C3*2 .*2 G2*2 .*2}x2 {G2*2 .*2 D3*2 .*2}x2 {C3*2 .*2 G2*2 .*2}x2 G2*2 .*2 D3*2 .*2 C3*2 .*2 G2*2 .*2`,
      noise: `{k . . . h . . . k . . . h . . .}x4`,
    },
  },

  // FOOT LOCKPICKER: stadium march.
  store_footlock: {
    bpm: 116, loop: true, gain: 0.55, duty1: 'p50', duty2: 'p25',
    tracks: {
      p1: `G4*3 G4 B4*3 B4 D5*4 B4*2 G4*2 | A4*3 A4 C5*3 C5 E5*4 D5*2 C5*2 |
           B4*3 B4 D5*3 D5 G5*4 F#5*2 E5*2 | D5*2 E5*2 F#5*2 A5*2 G5*6 .*2`,
      p2: `{B3*4 D4*4}x2 {C4*4 E4*4}x2 {D4*4 G4*4}x2 {D4*4 F#4*4}x2`,
      tri: `{G2*4 D3*4}x2 {A2*4 E3*4}x2 {G2*4 D3*4}x2 {D2*4 A2*4}x2`,
      noise: `{k . s s k . s . k . s s k s s s}x4`,
    },
  },

  // SAM BADDY: rock riff.
  store_sambaddy: {
    bpm: 140, loop: true, gain: 0.55, duty1: 'p25', duty2: 'p50',
    vol: { p2: 0.3 },
    tracks: {
      p1: `{E4*2 E4 G4*2 A4*2 E4 . E4 G4*2 A4 B4 A4 G4}x3 D5*2 B4*2 A4*2 G4*2 E4*8`,
      p2: `{B3*2 B3 D4*2 E4*2 B3 . B3 D4*2 E4 F#4 E4 D4}x3 A4*2 F#4*2 E4*2 D4*2 B3*8`,
      tri: `{E2*2 E2 E2 E2*2 E2 E2 E2*2 E2 E2 G2 G2 A2 A2}x3 D2*4 C2*4 B1*4 E2*4`,
      noise: `{k . h . s . h . k k h . s . h h}x4`,
    },
  },

  // CROOKSTONE: lounge bossa nova.
  store_crookstone: {
    bpm: 112, loop: true, gain: 0.5, duty1: 'p50', duty2: 'p25',
    vol: { p1: 0.4, p2: 0.25, noise: 0.2 },
    tracks: {
      p1: `A4*4 . F4 A4*2 C5*6 .*2 | B4*4 . G4 B4*2 D5*6 .*2 | E5*3 D5 C5*3 B4 G4*6 .*2 | C#5*4 E5*4 A4*6 .*2`,
      p2: `F4 . . F4 . . F4 . . . F4 . . F4 . . | F4 . . F4 . . F4 . . . F4 . . F4 . . |
           E4 . . E4 . . E4 . . . E4 . . E4 . . | G4 . . G4 . . G4 . . . G4 . . G4 . .`,
      tri: `D3*3 A2 A2*4 D3*3 A2 A2*4 | G2*3 D3 D3*4 G2*3 D3 D3*4 | C3*3 G2 G2*4 C3*3 G2 G2*4 | A2*3 E2 E2*4 A2*3 E2 E2*4`,
      noise: `{k . h . h s h . k . h s h . h .}x4`,
    },
  },

  // SHARPER IMAGINE: dreamy synth pads.
  store_sharper: {
    bpm: 80, loop: true, gain: 0.45, duty1: 'p50', duty2: 'p25',
    vol: { p1: 0.35, p2: 0.25 },
    tracks: {
      p1: `E5*16 D5*16 C5*16 B4*16`,
      p2: `{A4*2 C5*2 E5*2 C5*2}x2 {G4*2 B4*2 D5*2 B4*2}x2 {F4*2 A4*2 C5*2 A4*2}x2 {E4*2 G#4*2 B4*2 G#4*2}x2`,
      tri: `A2*16 G2*16 F2*16 E2*16`,
    },
  },

  // SPENDER'S GIFTS: surf groove, tremolo picking.
  store_spenders: {
    bpm: 150, loop: true, gain: 0.55, duty1: 'p25', duty2: 'p12',
    vol: { p2: 0.3 },
    tracks: {
      p1: `E4 E4 E4 E4 G4 G4 A4 A4 B4 B4 B4 B4 A4 A4 G4 G4 | D5 D5 D5 D5 B4 B4 A4 A4 G4 G4 G4 G4 A4 A4 B4 B4 |
           E4 E4 E4 E4 G4 G4 A4 A4 B4 B4 B4 B4 A4 A4 G4 G4 | E5 E5 D5 D5 B4 B4 A4 A4 G4 G4 E4 E4 E4*4`,
      p2: `{. G4 . G4}x4 {. B4 . B4}x4 {. G4 . G4}x4 {. A4 . A4}x2 {. B4 . B4}x2`,
      tri: `{E2*2 E3*2 E2*2 B2*2}x2 {G2*2 G3*2 G2*2 D3*2}x2 {E2*2 E3*2 E2*2 B2*2}x2 {A2*2 A3*2}x2 {B2*2 B3*2}x2`,
      noise: `{k . s k . k s .}x8`,
    },
  },

  // GAMESTONK: hyper game-menu jingle.
  store_gamestonk: {
    bpm: 170, loop: true, gain: 0.5, duty1: 'p12', duty2: 'p25',
    tracks: {
      p1: `{C5 E5 G5 C6 G5 E5 C5 E5 F5 A5 C6 F6 C6 A5 F5 A5 | G5 B5 D6 G6 D6 B5 G5 B5 C6 G5 E5 C5 C6*4}x2`,
      p2: `{C4*2 E4*2 G4*2 E4*2 F4*2 A4*2 C5*2 A4*2 | G4*2 B4*2 D5*2 B4*2 C5*4 G4*4}x2`,
      tri: `{C3*4 C3*4 F2*4 F2*4 G2*4 G2*4 C3*4 C3*4}x2`,
      noise: `{k h s h}x16`,
    },
  },

  // --- Jingles (play once) ---
  jingle_clear: {
    bpm: 140, loop: false, gain: 0.6, duty1: 'p25', duty2: 'p12',
    tracks: {
      p1: `G4 C5 E5 G5 . E5 G5*2 | A4 C5 F5 A5 . F5 A5*2 | B4 D5 G5 B5 . G5 B5*2 | C6*8`,
      p2: `E4 E4 G4 C5 . C5 E5*2 | F4 A4 C5 F5 . F5 A5*2 | G4 B4 D5 G5 . G5 B5*2 | E5*8`,
      tri: `C3*8 F2*8 G2*8 C3*8`,
      noise: `k . . . s . . . k . . . s . . . k . s . k . s . k*8`,
    },
  },
  jingle_gameover: {
    bpm: 80, loop: false, gain: 0.55, duty1: 'p50', duty2: 'p25',
    tracks: {
      p1: `E5*2 D5*2 C5*2 B4*2 A4*2 G#4*2 A4*8`,
      p2: `C5*2 B4*2 A4*2 G4*2 F4*2 E4*2 C4*8`,
      tri: `A2*4 F2*4 E2*4 A1*8`,
    },
  },
  jingle_itemget: {
    bpm: 120, loop: false, gain: 0.6, duty1: 'p25', duty2: 'p12',
    tracks: {
      p1: `A4*2 C5*2 E5*2 A5*2 G#5*2 B5*2 E6*8`,
      p2: `E4*2 A4*2 C5*2 E5*2 E5*2 G#5*2 B5*8`,
      tri: `A2*8 E2*4 A2*8`,
    },
  },
  jingle_fanfare: {
    bpm: 150, loop: false, gain: 0.6, duty1: 'p25', duty2: 'p50',
    tracks: {
      p1: `C5 E5 G5 C6*3 . G5 C6*8`,
      p2: `E4 G4 C5 E5*3 . E5 E5*8`,
      tri: `C3 . . C3*3 . G2 C3*8`,
      noise: `k . . s . . k s*8`,
    },
  },
};
