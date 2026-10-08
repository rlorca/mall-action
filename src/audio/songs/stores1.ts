/**
 * Store songs 1/2: Forever 12 (disco strut), RadioShock (bleepy arpeggios), KGB Toys (music-box waltz in 3/4),
 * Hot Spy on a Stick (boardwalk polka), Foot Lockpicker (stadium march). All original, 16 bars of A/B material.
 */
import { type SongDef, rep } from '../song';

// ---------------------------------------------------------------------------------------------
// FOREVER 12: disco strut. A dorian, four-on-the-floor, octave-bouncing bass, funky chank guitar.
// ---------------------------------------------------------------------------------------------
export const forever12: SongDef = {
  id: 'store.forever12',
  title: 'Forever 12 (disco strut)',
  bpm: 118,
  beats: 4,
  key: { tonic: 'A', mode: 'dorian' },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    funk: { duty: 0.25, decay: 120, sustain: 0.5, gate: 0.8 },
    hook: { duty: 0.5, decay: 200, sustain: 0.75, vibrato: { depth: 20, rate: 6, delay: 120 }, gate: 0.95 },
    chank: { duty: 0.125, decay: 60, sustain: 0, gate: 0.7, oct: 4 },
    strings: { duty: 0.5, attack: 80, vol: 0.7, gate: 1, oct: 4 },
  },
  chords: [
    'Am7:16 | D7:16 | Am7:16 | D7:16 | Gmaj7:16 | Cmaj7:16 | Bm7:16 | Em7:16 |',
    'Cmaj7:16 | Cmaj7:16 | Bm7:16 | Em7:16 | Am7:16 | D7:16 | Gmaj7:8 Cmaj7:8 | Bm7:8 Em7:8 |',
  ],
  pulse1: [
    `@funk
     A4:2 -:2 C5:1 D5:1 E5:2 -:2 D5:2 C5:2 A4:2 |
     F#4:2 -:2 A4:1 C5:1 D5:2 -:2 C5:2 A4:2 F#4:2 |
     A4:2 -:2 C5:1 D5:1 E5:2 -:2 G5:2 E5:2 D5:2 |
     F#5:2 D5:2 A4:2 D5:2 F#5:4 E5:2 D5:2 |
     G4:2 B4:2 D5:2 F#5:2 G5:4 F#5:2 D5:2 |
     E5:2 G5:2 C6:2 B5:2 G5:4 E5:4 |
     D5:2 F#5:2 A5:2 F#5:2 D5:4 B4:4 |
     G5:2 E5:2 B4:2 E5:2 G5:4 B4:2 D5:2 |
     @hook
     E5:6 G5:2 C6:4 B5:4 |
     E6:6 D6:2 C6:4 G5:4 |
     D6:6 B5:2 F#5:4 A5:4 |
     G5:6 B5:2 E6:4 D6:4 |
     C6:4 A5:2 C6:2 E6:4 D6:4 |
     A5:4 F#5:2 A5:2 D6:4 C6:4 |
     B5:4 G5:4 E5:4 G5:4 |
     F#5:4 D5:4 E5:4 B4:4 |`,
  ],
  pulse2: [
    '@chank',
    rep('-:2 $2:1 $3:1 -:2 $2:1 $3:1 -:2 $2:1 $3:1 -:2 $2:1 $3:1 |', 8),
    '@strings',
    rep('$2:4 $3:4 $4:4 $3:4 |', 8),
  ],
  triangle: [
    rep("$1:2 $1':2 $1:2 $1':2 $1:2 $1':2 $3:2 $1':2 |", 16),
  ],
  noise: [
    rep('k:2 h:1 o:1 s:2 h:1 h:1 k:2 h:1 o:1 s:2 h:1 h:1 |', 7),
    'k:2 h:1 o:1 s:2 h:1 h:1 k:2 s:1 s:1 t:1 t:1 T:1 T:1 |',
    rep('k:2 h:1 o:1 s:2 h:1 h:1 k:2 h:1 o:1 s:2 h:1 h:1 |', 7),
    'c:4 h:2 h:2 s:2 h:1 h:1 k:2 k:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// RADIOSHOCK: bleepy arpeggios. C minor, 32 ms chord-arp "bleeps", staccato robot melody.
// ---------------------------------------------------------------------------------------------
export const radioshock: SongDef = {
  id: 'store.radioshock',
  title: 'RadioShock (bleepy arpeggios)',
  bpm: 140,
  beats: 4,
  key: { tonic: 'C', mode: 'minor', extra: ['B'] },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.75 },
  inst: {
    bleep: { duty: 0.25, decay: 70, sustain: 0.3, gate: 0.6 },
    solo: { duty: 0.5, decay: 90, sustain: 0.5, gate: 0.7 },
    arp: { duty: 0.125, arp: 32, gate: 0.9, oct: 4 },
  },
  chords: [
    'Cm:16 | Cm:16 | Ab:16 | Ab:16 | Bb:16 | Bb:16 | Gm:16 | G:16 |',
    'Cm:16 | Fm:16 | Ab:16 | Eb:16 | Bb:16 | Gm:16 | Fm:16 | G:16 |',
  ],
  pulse1: [
    `@bleep
     C6:2 G5:2 Eb5:2 G5:2 C6:2 G5:2 Eb5:4 |
     D6:2 Bb5:2 F5:2 Bb5:2 D6:2 Bb5:2 F5:4 |
     Ab5:2 Eb5:2 C5:2 Eb5:2 Ab5:2 Eb5:2 C5:4 |
     Bb5:2 F5:2 D5:2 F5:2 Bb5:2 F5:2 D5:4 |
     Bb5:2 F5:2 D5:2 F5:2 Bb5:2 D6:2 F6:4 |
     Eb6:2 Bb5:2 G5:2 Bb5:2 Eb6:2 Bb5:2 G5:4 |
     G5:2 Bb5:2 D6:2 G6:2 F6:2 D6:2 Bb5:4 |
     G5:4 B5:4 D6:4 G6:4 |
     @solo
     Eb6:4 D6:2 C6:2 G5:4 C6:4 |
     F6:4 Eb6:2 C6:2 Ab5:4 C6:4 |
     Eb6:4 C6:2 Ab5:2 C6:4 Eb6:4 |
     G6:4 Eb6:2 Bb5:2 G5:4 Bb5:4 |
     F6:4 D6:2 Bb5:2 D6:4 F6:4 |
     D6:4 Bb5:2 G5:2 Bb5:4 D6:4 |
     C6:2 C6:2 Ab5:2 C6:2 F6:4 Ab6:4 |
     D6:2 D6:2 B5:2 D6:2 G6:4 B6:4 |`,
  ],
  pulse2: [
    '@arp',
    rep('$p:3 -:1 $p:3 -:1 $p:2 -:2 $p:2 -:2 |', 16),
  ],
  triangle: [
    rep('$1:2 $1:2 $1:2 $3:2 $1:2 $1:2 $1:2 $3:2 |', 16),
  ],
  noise: [
    rep('k:2 x:2 x:2 s:2 k:2 x:2 s:2 x:2 |', 7),
    'k:2 x:2 x:2 s:2 k:2 s:1 s:1 t:1 t:1 T:1 T:1 |',
    rep('k:2 x:2 x:2 s:2 k:2 x:2 s:2 x:2 |', 7),
    'k:2 x:2 x:2 s:2 s:1 s:1 s:1 s:1 T:1 T:1 c:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// KGB TOYS: music-box waltz in 3/4. D minor (harmonic). Tinkling box melody, oom-pah-pah, ticking mechanism.
// ---------------------------------------------------------------------------------------------
export const kgbtoys: SongDef = {
  id: 'store.kgbtoys',
  title: 'KGB Toys (music-box waltz, 3/4)',
  bpm: 156,
  beats: 3,
  beatUnit: 4,
  key: { tonic: 'D', mode: 'minor', extra: ['C#'] },
  loop: true,
  vol: 0.8,
  mix: { pulse2: 0.8, noise: 0.6 },
  inst: {
    box: { duty: 0.5, attack: 1, decay: 700, sustain: 0, release: 80, gate: 0.9, vol: 0.9 },
    pah: { duty: 0.25, vol: 0.5, decay: 90, sustain: 0.2, gate: 0.7, oct: 4, arp: 40 },
    oom: { gate: 0.85, oct: 2 },
  },
  chords: [
    'Dm:12 | Dm:12 | Gm:12 | A7:12 | Dm:12 | Bb:12 | A7:12 | Dm:12 |',
    'F:12 | C:12 | Dm:12 | Bb:12 | Gm:12 | A7:12 | Dm:12 | A7:12 |',
  ],
  pulse1: [
    `@box
     D5:4 F5:4 A5:4 |
     D6:6 C6:2 A5:4 |
     Bb5:4 G5:4 D5:4 |
     E5:4 G5:4 C#6:4 |
     D6:4 A5:4 F5:4 |
     D5:4 F5:4 Bb5:4 |
     C#6:4 E6:4 A5:4 |
     D6:8 -:4 |
     A5:2 C6:2 F6:4 C6:4 |
     G5:2 C6:2 E6:4 C6:4 |
     F5:2 A5:2 D6:4 A5:4 |
     D6:2 F6:2 Bb6:4 F6:4 |
     G5:2 Bb5:2 D6:4 Bb5:4 |
     A5:2 C#6:2 E6:4 G6:4 |
     F6:4 D6:4 A5:4 |
     E5:4 A5:4 C#6:4 |`,
  ],
  pulse2: [
    '@pah',
    rep('-:4 $c:4 $c:4 |', 16),
  ],
  triangle: [
    '@oom',
    rep('$1:4 -:8 |', 8),
    rep('$1:4 -:4 $3:4 |', 8),
  ],
  noise: [
    rep('x:1 -:11 |', 8),
    rep('x:1 -:3 x:1 -:3 x:1 -:3 |', 8),
  ],
};

// ---------------------------------------------------------------------------------------------
// HOT SPY ON A STICK: boardwalk polka. Bb major, oom-pah bass, bouncy dotted accordion lead, snare rolls.
// ---------------------------------------------------------------------------------------------
export const hotspy: SongDef = {
  id: 'store.hotspy',
  title: 'Hot Spy on a Stick (boardwalk polka)',
  bpm: 168,
  beats: 4,
  key: { tonic: 'Bb', mode: 'major', extra: ['F#'] },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    accordion: { duty: 0.5, attack: 10, decay: 150, sustain: 0.8, vibrato: { depth: 20, rate: 6.5, delay: 100 }, gate: 0.88 },
    pah: { duty: 0.25, decay: 80, sustain: 0.3, gate: 0.75, oct: 4, arp: 36 },
  },
  chords: [
    'Bb:16 | Bb:16 | F7:16 | F7:16 | Bb:16 | Eb:16 | F7:16 | Bb:16 |',
    'Gm:16 | D7:16 | Gm:16 | D7:16 | Eb:16 | F7:16 | Bb:8 F7:8 | Bb:16 |',
  ],
  pulse1: [
    `@accordion
     D5:3 D5:1 F5:3 F5:1 Bb5:4 F5:4 |
     D6:3 C6:1 Bb5:3 A5:1 Bb5:8 |
     C5:3 C5:1 Eb5:3 Eb5:1 A5:4 Eb5:4 |
     G5:3 F5:1 Eb5:3 D5:1 C5:8 |
     D5:3 D5:1 F5:3 F5:1 Bb5:4 F5:4 |
     Eb5:3 Eb5:1 G5:3 G5:1 Bb5:4 G5:4 |
     A5:3 G5:1 F5:3 Eb5:1 D5:4 C5:4 |
     Bb4:8 D5:2 F5:2 Bb5:4 |
     G5:2 Bb5:2 D6:4 Bb5:2 G5:2 D5:4 |
     F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 |
     G5:2 Bb5:2 D6:4 G6:2 F6:2 D6:4 |
     C6:2 A5:2 F#5:2 A5:2 D6:8 |
     Eb6:4 D6:2 Eb6:2 G5:4 Bb5:4 |
     A5:4 C6:4 Eb6:4 D6:2 C6:2 |
     D6:4 Bb5:4 C6:4 A5:4 |
     Bb5:8 -:4 F5:2 A5:2 |`,
  ],
  pulse2: [
    '@pah',
    rep('-:4 $c:3 -:1 -:4 $c:3 -:1 |', 16),
  ],
  triangle: [
    rep('$1:3 -:1 -:4 $3:3 -:1 -:4 |', 16),
  ],
  noise: [
    rep('k:4 s:2 s:2 k:4 s:2 s:2 |', 7),
    'k:4 s:2 s:2 s:1 s:1 s:1 s:1 t:2 T:2 |',
    rep('k:4 s:2 s:2 k:4 s:2 s:2 |', 7),
    'k:4 s:2 s:2 k:2 s:1 s:1 s:2 c:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// FOOT LOCKPICKER: stadium march. Eb major, big brass dotted-rhythm tune, marching quarters, snare stomp.
// ---------------------------------------------------------------------------------------------
export const footlock: SongDef = {
  id: 'store.footlock',
  title: 'Foot Lockpicker (stadium march)',
  bpm: 112,
  beats: 4,
  key: { tonic: 'Eb', mode: 'major' },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.85 },
  inst: {
    brass: { duty: 0.5, attack: 6, decay: 120, sustain: 0.85, gate: 0.9, vibrato: { depth: 12, rate: 5.5, delay: 200 } },
    horn: { duty: 0.25, decay: 100, sustain: 0.7, gate: 0.8, oct: 3, arp: 42 },
    tuba: { gate: 0.85, oct: 2 },
  },
  chords: [
    'Eb:16 | Eb:16 | Ab:16 | Bb:16 | Eb:16 | Cm:16 | Ab:16 | Bb:16 |',
    'Cm:16 | Ab:16 | Eb:16 | Bb:16 | Cm:16 | Ab:16 | Bb:16 | Eb:16 |',
  ],
  pulse1: [
    `@brass
     Bb4:3 Bb4:1 Eb5:4 G5:4 Bb5:4 |
     Ab5:3 G5:1 F5:4 Eb5:8 |
     Ab4:3 Ab4:1 C5:4 Eb5:4 Ab5:4 |
     G5:3 F5:1 D5:4 F5:4 Bb4:4 |
     Bb4:3 Bb4:1 Eb5:4 G5:4 Bb5:4 |
     C6:3 Bb5:1 G5:4 Eb5:4 C5:4 |
     C6:4 Ab5:4 Eb5:4 C5:4 |
     D5:2 F5:2 Bb5:4 F5:2 D5:2 Bb4:4 |
     Eb5:4 G5:4 C6:4 G5:4 |
     Eb5:4 Ab5:4 C6:4 Ab5:4 |
     G5:4 Bb5:4 Eb6:4 Bb5:4 |
     D6:4 Bb5:4 F5:4 Bb5:4 |
     C6:3 C6:1 Eb6:4 D6:4 C6:4 |
     Ab5:3 Ab5:1 C6:4 Eb6:4 Ab6:4 |
     Bb5:4 D6:4 F6:4 D6:4 |
     Eb6:8 Bb5:4 G5:4 |`,
  ],
  pulse2: [
    '@horn',
    rep('$c:3 -:1 $c:3 -:1 $c:3 -:1 $c:3 -:1 |', 16),
  ],
  triangle: [
    '@tuba',
    rep("$1:4 $3:4 $1:4 $3:4 |", 8),
    rep("$1:3 -:1 $1':3 -:1 $3:3 -:1 $1:3 -:1 |", 8),
  ],
  noise: [
    rep('K:4 s:2 s:2 K:4 s:1 s:1 s:2 |', 7),
    'K:4 s:2 s:2 K:4 s:1 s:1 t:1 t:1 |',
    rep('K:4 s:2 s:2 K:4 s:1 s:1 s:2 |', 7),
    'K:4 s:2 s:2 s:1 s:1 s:1 s:1 T:1 T:1 c:2 |',
  ],
};
