/**
 * Store songs 2/2: Sam Baddy (rock riff), Crookstone (lounge bossa nova), Sharper Imagine (dreamy synth pads),
 * Spender's Gifts (surf groove), GameStonk (hyper game-menu jingle). All original, 16 bars of A/B material.
 */
import { type SongDef, rep } from '../song';

// ---------------------------------------------------------------------------------------------
// SAM BADDY: rock riff. E minor, palm-muted power-chord chug, heavy riff, then a high lead solo.
// ---------------------------------------------------------------------------------------------
export const sambaddy: SongDef = {
  id: 'store.sambaddy',
  title: 'Sam Baddy (rock riff)',
  bpm: 138,
  beats: 4,
  key: { tonic: 'E', mode: 'minor' },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    gtr: { duty: 0.25, decay: 150, sustain: 0.6, gate: 0.85 },
    solo: { duty: 0.5, decay: 200, sustain: 0.75, vibrato: { depth: 28, rate: 6, delay: 120 }, gate: 0.95 },
    chug: { duty: 0.125, arp: 28, decay: 100, sustain: 0.5, gate: 0.8, oct: 3 },
    power: { duty: 0.5, arp: 30, attack: 6, gate: 1, oct: 3, vol: 0.8 },
  },
  chords: [
    'E5:16 | E5:16 | G5:16 | A5:16 | E5:16 | E5:16 | D5:16 | D5:8 B5:8 |',
    'C5:16 | D5:16 | E5:16 | E5:16 | C5:16 | D5:16 | B5:16 | E5:16 |',
  ],
  pulse1: [
    `@gtr
     E3:2 E3:2 G3:2 E3:2 -:2 A3:2 G3:2 E3:2 |
     E3:2 E3:2 G3:2 E3:2 -:2 B3:2 A3:2 G3:2 |
     G3:2 G3:2 B3:2 G3:2 -:2 C4:2 B3:2 G3:2 |
     A3:2 A3:2 C4:2 A3:2 -:2 D4:2 C4:2 A3:2 |
     E3:2 E3:2 G3:2 E3:2 -:2 A3:2 G3:2 E3:2 |
     E3:2 G3:2 E3:2 B3:2 A3:4 G3:4 |
     D3:2 D3:2 F#3:2 D3:2 -:2 G3:2 F#3:2 D3:2 |
     D3:2 F#3:2 A3:4 B3:2 D4:2 F#4:4 |
     @solo
     G5:4 E5:4 G5:4 C6:4 |
     A5:4 F#5:4 A5:4 D6:4 |
     B5:6 G5:2 E5:4 G5:4 |
     B5:6 A5:2 G5:4 E5:4 |
     C6:2 B5:2 G5:4 E5:2 G5:2 C6:4 |
     D6:2 C6:2 A5:4 F#5:2 A5:2 D6:4 |
     B5:2 A5:2 F#5:4 B5:4 F#6:4 |
     E6:8 B5:4 G5:4 |`,
  ],
  pulse2: [
    '@chug',
    rep('$1+$2:2 $1+$2:1 -:1 $1+$2:2 -:2 $1+$2:2 $1+$2:1 -:1 $1+$2:2 -:2 |', 8),
    '@power',
    rep('$1+$2:8 $1+$2:8 |', 8),
  ],
  triangle: [
    rep('$1:2 $1:2 $1:2 $1:2 $1:2 $1:2 $2:2 $1:2 |', 16),
  ],
  noise: [
    rep('k:2 h:2 s:2 h:2 k:1 k:1 h:2 s:2 h:2 |', 7),
    'k:2 h:2 s:2 h:2 s s t t T T c:2 |',
    rep('c:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 |', 7),
    'k:2 h:2 s:2 h:2 s s s s t t c:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// CROOKSTONE: lounge bossa nova. G minor, clave-rim rhythm, dotted bass, muted-trumpet melody.
// ---------------------------------------------------------------------------------------------
export const crookstone: SongDef = {
  id: 'store.crookstone',
  title: 'Crookstone (lounge bossa nova)',
  bpm: 132,
  beats: 4,
  key: { tonic: 'G', mode: 'minor', extra: ['F#'] },
  loop: true,
  vol: 0.9,
  mix: { pulse2: 0.75, noise: 0.8 },
  inst: {
    trumpet: { duty: 0.25, attack: 8, decay: 300, sustain: 0.6, vibrato: { depth: 18, rate: 5, delay: 250 }, gate: 0.9 },
    guitar: { duty: 0.5, vol: 0.7, decay: 150, sustain: 0.25, gate: 0.75, oct: 3, arp: 38 },
    bass: { gate: 0.9, oct: 2 },
  },
  chords: [
    'Gm7:16 | Gm7:16 | Cm7:16 | Cm7:16 | Am7b5:16 | D7:16 | Gm7:16 | Gm7:16 |',
    'Bbmaj7:16 | Bbmaj7:16 | Ebmaj7:16 | Ebmaj7:16 | Am7b5:16 | D7:16 | Gm7:8 Cm7:8 | Am7b5:8 D7:8 |',
  ],
  pulse1: [
    `@trumpet
     -:2 D5:3 Bb4:1 G4:4 A4:2 Bb4:2 -:2 |
     D5:6 C5:2 Bb4:4 -:4 |
     -:2 Eb5:3 C5:1 G4:4 Bb4:2 C5:2 -:2 |
     G5:6 F5:2 Eb5:4 -:4 |
     -:2 C5:3 A4:1 Eb5:4 D5:2 C5:2 -:2 |
     A4:4 F#4:4 A4:4 D5:4 |
     Bb4:6 G4:2 D5:8 |
     G4:8 -:8 |
     -:2 F5:3 D5:1 Bb4:4 D5:2 F5:2 -:2 |
     A5:6 G5:2 F5:4 -:4 |
     -:2 G5:3 Eb5:1 Bb4:4 D5:2 Eb5:2 -:2 |
     Bb5:6 A5:2 G5:4 -:4 |
     C6:4 A5:2 Eb5:2 C5:4 Eb5:4 |
     F#5:4 A5:4 D6:4 C6:4 |
     Bb5:4 G5:4 Eb5:4 G5:4 |
     C5:4 A4:4 F#4:4 A4:4 |`,
  ],
  pulse2: [
    '@guitar',
    rep('$c:2 -:1 $c:2 -:1 $c:2 -:2 $c:2 $c:2 -:2 |', 16),
  ],
  triangle: [
    '@bass',
    rep('$1:6 $3:2 $1:6 $3:2 |', 16),
  ],
  noise: [
    rep('w:3 w:3 w:4 w:2 w:4 |', 8),
    rep('w:3 w:3 w:4 w:2 m:2 m:2 |', 8),
  ],
};

// ---------------------------------------------------------------------------------------------
// SHARPER IMAGINE: dreamy synth pads. Eb major, slow swelling lead, rolling arpeggio wash, no hard drums.
// ---------------------------------------------------------------------------------------------
export const sharper: SongDef = {
  id: 'store.sharper',
  title: 'Sharper Imagine (dreamy synth pads)',
  bpm: 84,
  beats: 4,
  key: { tonic: 'Eb', mode: 'major' },
  loop: true,
  vol: 0.85,
  mix: { pulse2: 0.75, noise: 0.5 },
  inst: {
    dream: { duty: 0.5, attack: 150, release: 300, vibrato: { depth: 25, rate: 5, delay: 300 }, gate: 1, vol: 0.9 },
    wash: { duty: 0.25, attack: 30, decay: 300, sustain: 0.5, gate: 1, vol: 0.55, oct: 3 },
    glass: { duty: 0.125, attack: 10, decay: 500, sustain: 0.1, gate: 1, vol: 0.5, oct: 4 },
    sub: { attack: 40, release: 300, gate: 1, oct: 2 },
  },
  chords: [
    'Ebmaj7:16 | Ebmaj7:16 | Cm7:16 | Cm7:16 | Abmaj7:16 | Abmaj7:16 | Fm7:16 | Bbsus4:16 |',
    'Gm7:16 | Gm7:16 | Abmaj7:16 | Abmaj7:16 | Fm7:16 | Fm7:16 | Bbsus4:16 | Bb:16 |',
  ],
  pulse1: [
    `@dream
     Bb4:8 G5:8 |
     F5:6 Eb5:2 D5:8 |
     C5:8 Eb5:8 |
     G5:12 F5:4 |
     Eb5:8 C6:8 |
     Bb5:6 Ab5:2 G5:8 |
     Ab5:8 F5:8 |
     Eb5:12 D5:4 |
     D6:8 Bb5:8 |
     G5:6 F5:2 D5:8 |
     C6:8 Eb6:8 |
     Eb6:12 D6:4 |
     C6:8 Ab5:8 |
     F5:8 Ab5:4 C6:4 |
     Bb5:8 Eb6:8 |
     D6:12 -:4 |`,
  ],
  pulse2: [
    '@wash',
    rep('$1:2 $2:2 $3:2 $4:2 $5:2 $4:2 $3:2 $2:2 |', 8),
    '@glass',
    rep('$2:4 $4:4 $3:4 $5:4 |', 8),
  ],
  triangle: [
    '@sub',
    rep('$1:16 | $1:8 $3:8 |', 8),
  ],
  noise: [
    rep('-:4 h:4? -:4 h:4? |', 16),
  ],
};

// ---------------------------------------------------------------------------------------------
// SPENDER'S GIFTS: surf groove. B minor, tremolo-picked twangy lead, tom-driven beat, reverb-wash chords.
// ---------------------------------------------------------------------------------------------
const T = (note: string, times = 4): string => rep(note, times);

export const spenders: SongDef = {
  id: 'store.spenders',
  title: "Spender's Gifts (surf groove)",
  bpm: 150,
  beats: 4,
  key: { tonic: 'B', mode: 'minor', extra: ['A#'] },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.7 },
  inst: {
    trem: { duty: 0.25, decay: 50, sustain: 0.6, gate: 0.8 },
    twang: { duty: 0.25, decay: 400, sustain: 0.6, vibrato: { depth: 30, rate: 6.5, delay: 100 }, gate: 0.95 },
    wash: { duty: 0.5, vol: 0.45, arp: 70, gate: 1, oct: 3 },
  },
  chords: [
    'Bm:16 | Bm:16 | G:16 | A:16 | Bm:16 | Bm:16 | G:16 | F#7:16 |',
    'D:16 | A:16 | Bm:16 | G:16 | D:16 | A:16 | G:8 F#7:8 | F#7:16 |',
  ],
  pulse1: [
    `@trem
     ${T('B4')} ${T('D5')} ${T('F#5')} ${T('E5', 2)} ${T('D5', 2)} |
     ${T('B4')} ${T('D5')} ${T('F#5')} ${T('A5')} |
     ${T('G4')} ${T('B4')} ${T('D5')} ${T('B4')} |
     ${T('A4')} ${T('C#5')} ${T('E5')} ${T('C#5')} |
     ${T('B4')} ${T('D5')} ${T('F#5')} ${T('E5', 2)} ${T('D5', 2)} |
     ${T('B4', 2)} ${T('D5', 2)} ${T('F#5', 2)} ${T('A5', 2)} ${T('B5', 4)} ${T('A5', 4)} |
     ${T('G4')} ${T('B4')} ${T('D5')} ${T('G5')} |
     ${T('F#5')} ${T('A#5')} ${T('C#6')} ${T('A#5')} |
     @twang
     F#5:4 A5:4 D6:4 A5:4 |
     E5:4 A5:4 C#6:4 A5:4 |
     D6:6 C#6:2 B5:4 F#5:4 |
     B5:6 A5:2 G5:4 D5:4 |
     F#5:2 A5:2 D6:4 F#6:4 D6:4 |
     E6:6 C#6:2 A5:4 E5:4 |
     D6:4 B5:4 C#6:4 A#5:4 |
     F#5:2 F#5:2 A#5:2 A#5:2 C#6:4 -:4 |`,
  ],
  pulse2: [
    '@wash',
    rep('$p:16 |', 16),
  ],
  triangle: [
    rep('$1:2 $1:2 $1:2 $1:2 $1:2 $1:2 $2:2 $3:2 |', 16),
  ],
  noise: [
    rep('k:2 T:2 s:2 T:2 k:2 T:2 s:2 t:2 |', 7),
    'k:2 T:2 s:2 T:2 t:1 t:1 T:1 T:1 s:1 s:1 c:2 |',
    rep('k:2 T:2 s:2 T:2 k:2 T:2 s:2 t:2 |', 7),
    'k:2 T:2 s:2 T:2 t:1 t:1 T:1 T:1 s:1 s:1 c:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// GAMESTONK: hyper game-menu jingle. A major, 168 bpm, bouncing 16th-note hops, arpeggio ostinato.
// ---------------------------------------------------------------------------------------------
export const gamestonk: SongDef = {
  id: 'store.gamestonk',
  title: 'GameStonk (hyper game-menu jingle)',
  bpm: 168,
  beats: 4,
  key: { tonic: 'A', mode: 'major' },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.7 },
  inst: {
    chip: { duty: 0.25, decay: 90, sustain: 0.6, gate: 0.8 },
    ring: { duty: 0.5, decay: 110, sustain: 0.65, gate: 0.82 },
    arp: { duty: 0.125, decay: 70, sustain: 0.4, gate: 0.7, oct: 4 },
  },
  chords: [
    'A:16 | A:16 | F#m:16 | F#m:16 | D:16 | E:16 | A:16 | E:16 |',
    'A:16 | E:16 | F#m:16 | D:16 | Bm:16 | E:16 | A:8 E:8 | A:16 |',
  ],
  pulse1: [
    `@chip
     A5:1 C#6:1 E6:2 C#6:1 E6:1 A6:2 E6:2 C#6:2 A5:2 -:2 |
     A5:1 B5:1 C#6:2 B5:1 C#6:1 E6:2 C#6:2 B5:2 A5:2 -:2 |
     F#5:1 A5:1 C#6:2 A5:1 C#6:1 F#6:2 C#6:2 A5:2 F#5:2 -:2 |
     F#5:1 G#5:1 A5:2 G#5:1 A5:1 C#6:2 A5:2 G#5:2 F#5:2 -:2 |
     D5:1 F#5:1 A5:2 F#5:1 A5:1 D6:2 A5:2 F#5:2 D5:2 -:2 |
     E5:1 G#5:1 B5:2 G#5:1 B5:1 E6:2 B5:2 G#5:2 E5:2 -:2 |
     A5:2 C#6:2 E6:2 A6:2 E6:2 C#6:2 A5:4 |
     B5:2 G#5:2 E5:2 G#5:2 B5:4 -:4 |
     @ring
     C#6:2 C#6:2 E6:2 C#6:2 A5:4 E6:4 |
     B5:2 B5:2 E6:2 B5:2 G#5:4 B5:4 |
     A5:2 A5:2 C#6:2 A5:2 F#5:4 A5:4 |
     A5:2 A5:2 D6:2 A5:2 F#5:4 D6:4 |
     D6:2 F#6:2 D6:2 B5:2 F#5:4 B5:4 |
     E6:2 B5:2 G#5:2 B5:2 E6:4 G#6:4 |
     A5:2 C#6:2 E6:2 A6:2 G#6:2 E6:2 B5:2 G#5:2 |
     A6:4 E6:2 C#6:2 A5:4 -:4 |`,
  ],
  pulse2: [
    '@arp',
    rep("$1 $2 $3 $1' $2' $1' $3 $2 $1 $2 $3 $1' $2' $1' $3 $2 |", 16),
  ],
  triangle: [
    rep("$1:2 $3:2 $1':2 $3:2 $1:2 $3:2 $1':2 $3:2 |", 16),
  ],
  noise: [
    rep('k:2 h:1 h:1 s:2 h:1 h:1 k:2 h:1 h:1 s:2 s:1 s:1 |', 16),
  ],
};
