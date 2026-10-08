/**
 * Core looping tracks: title, mall (ambient bed), alarm, elevator (muzak), booth (bonus pop), continue
 * (countdown tension) and newspaper (light jazz). All original. See song.ts for the pattern syntax.
 *
 * Shared "mall motif": the four notes E-G-D-C (mi-sol-re-do). It is the lone bell in `mall` and the
 * hook of the `elevator` muzak arrangement.
 */
import { type SongDef, rep } from '../song';

// ---------------------------------------------------------------------------------------------
// TITLE: heroic theme in G major. 2-bar fanfare intro, then A (hero) / B (lyrical) / A' (fuller), 26 bars.
// ---------------------------------------------------------------------------------------------
const TITLE_A = `
  G4:3 G4 B4:4 D5:4 G5:4 |
  F#5:3 E5 D5:4 B4:4 G4:4 |
  C5:3 C5 E5:4 G5:4 E5:4 |
  D5:6 C5:2 B4:4 A4:4 |
  E5:3 E5 G5:4 B5:4 G5:4 |
  E5:3 D5 C5:4 G4:4 C5:4 |`;
const TITLE_STAB = '-:2 $c:2 -:2 $c:2 -:2 $c:2 -:2 $c:2 |';
const TITLE_GALLOP = "$1:2 $1:2 $1':2 $1:2 $1:2 $1:2 $1':2 $1:2 |";
const TITLE_BEAT = 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2 |';
const TITLE_FILL = 'k:2 h:2 s:2 h:2 s s t t T T c:2 |';

export const title: SongDef = {
  id: 'title',
  title: 'MALL ACTION (heroic title theme)',
  bpm: 128,
  beats: 4,
  key: { tonic: 'G', mode: 'major' },
  loop: true,
  loopBar: 2,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    fan: { duty: 0.5, decay: 300, sustain: 0.7, vibrato: { depth: 20, rate: 6, delay: 150 }, gate: 0.97 },
    lead: { duty: 0.5, decay: 220, sustain: 0.75, vibrato: { depth: 16, rate: 6, delay: 160 } },
    lyric: { duty: 0.25, decay: 260, sustain: 0.6, vibrato: { depth: 14, rate: 6, delay: 120 }, gate: 0.95 },
    stab: { duty: 0.125, decay: 90, sustain: 0.25, oct: 3, arp: 40 },
    arpy: { duty: 0.25, oct: 3, decay: 100, sustain: 0.55, gate: 0.85 },
  },
  chords: [
    'G:16 | D:16 |',
    'G:16 | G:16 | C:16 | D:16 | Em:16 | C:16 | D:16 | D:16 |',
    'Em:16 | C:16 | Am:16 | D:16 | Em:16 | C:16 | D:16 | D:16 |',
    'G:16 | G:16 | C:16 | D:16 | Em:16 | C:16 | D:16 | G:16 |',
  ],
  pulse1: [
    '@fan G4:2 B4:2 D5:2 G5:6 D5:2 G5:2 | F#5:4 A5:4 D6:8 |',
    '@lead',
    TITLE_A,
    'D5:4 F#5:4 A5:4 G5:2 F#5:2 |',
    'D5:8 -:4 A4:2 B4:2 |',
    '@lyric',
    `B4:2 E5:2 G5:2 B5:2 A5:4 G5:4 |
     G5:2 E5:2 C5:2 E5:2 G5:8 |
     A4:2 C5:2 E5:2 A5:2 G5:4 E5:4 |
     F#5:2 A5:2 D6:4 C6:4 A5:4 |
     B4:2 E5:2 G5:2 B5:2 C6:4 B5:4 |
     A5:2 G5:2 E5:2 C5:2 D5:8 |
     D5:2 F#5:2 A5:2 D6:2 C6:2 A5:2 F#5:2 D5:2 |
     A5:4 F#5:4 A5:4 D6:4 |`,
    '@lead',
    TITLE_A,
    'D5:4 F#5:4 A5:4 D6:4 |',
    'G5:8 D5:4 B4:4 |',
  ],
  pulse2: [
    '@arpy D4:2 G4:2 B4:2 D5:6 B4:2 D5:2 | A4:4 D5:4 F#5:8 |',
    '@stab',
    rep(TITLE_STAB, 8),
    '@arpy',
    rep('$1 $2 $3 $1\' $3 $2 $1 $2 $1 $2 $3 $1\' $3 $2 $1 $2 |', 8),
    '@stab',
    rep(TITLE_STAB, 6),
    '@arpy $c:16 |',
    '@stab',
    TITLE_STAB,
  ],
  triangle: [
    "$1:2 $1:2 $1':2 $1:2 $1:8 | $1:2 $1:2 $1':2 $1:2 $1:2 $1:2 $1':2 $1:2 |",
    rep(TITLE_GALLOP, 8),
    rep('$1:4 $3:4 $1:4 $3:4 |', 8),
    rep(TITLE_GALLOP, 8),
  ],
  noise: [
    's:2 s:2 s:2 s:2 t:2 t:2 T:2 T:2 | k:2 -:2 s:2 -:2 s s t t T T c:2 |',
    rep(TITLE_BEAT, 3),
    'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 |',
    rep(TITLE_BEAT, 3),
    TITLE_FILL,
    rep('k:2 o:2 s:2 o:2 k:2 o:2 s:2 o:2 |', 7),
    TITLE_FILL,
    rep(TITLE_BEAT, 3),
    'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2 |',
    rep(TITLE_BEAT, 3),
    'k:2 h:2 s:2 h:2 k:2 h:2 s:2 c:2 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// MALL: quiet, sparse ambient bed. Soft slow pads, long bass notes, a rare bell. Much lower volume.
// ---------------------------------------------------------------------------------------------
export const mall: SongDef = {
  id: 'mall',
  title: 'Mall ambience (quiet bed)',
  bpm: 66,
  beats: 4,
  key: { tonic: 'C', mode: 'major' },
  loop: true,
  vol: 0.32,
  mix: { triangle: 0.85 },
  inst: {
    bell: { duty: 0.5, attack: 2, decay: 1800, sustain: 0, release: 300, gate: 1, oct: 5, vol: 0.85 },
    pad: { duty: 0.5, attack: 700, release: 600, gate: 1, oct: 4, vol: 0.6 },
    sub: { attack: 40, release: 300, gate: 1, oct: 2 },
  },
  chords: [
    'Cmaj7:16 | Cmaj7:16 | Am7:16 | Am7:16 | Fmaj7:16 | Fmaj7:16 | G6:16 | G6:16 |',
    'Em7:16 | Em7:16 | Fmaj7:16 | Fmaj7:16 | Dm7:16 | Dm7:16 | G:16 | G:16 |',
  ],
  pulse1: [
    `@bell
     E5:8 G5:8 | D5:8 C5:8 | -:16 | -:16 |
     -:16 | -:8 A5:8 | -:16 | -:16 |
     -:16 | -:16 | B5:16 | -:16 |
     C5:8 E5:8 | G5:16 | -:16 | -:16 |`,
  ],
  pulse2: [
    `@pad
     $2:8 $3:8 | $3:8 $4:8 | $2:8 $3:8 | $3:8 $4:8 |
     $2:8 $3:8 | $3:8 $4:8 | $2:8 $3:8 | $3:8 $4:8 |
     $2:8 $3:8 | $3:8 $4:8 | $2:8 $3:8 | $3:8 $4:8 |
     $2:8 $3:8 | $3:8 $4:8 | $2:8 $3:8 | $2:16 |`,
  ],
  triangle: [
    `@sub
     $1:16 | $1:12 $3:4 | $1:16 | $1:12 $3:4 | $1:16 | $1:12 $3:4 | $1:16 | $1:12 $3:4 |
     $1:16 | $1:12 $3:4 | $1:16 | $1:12 $3:4 | $1:16 | $1:12 $3:4 | $1:16 | $1:16 |`,
  ],
};

// ---------------------------------------------------------------------------------------------
// ALARM: tense, fast spy groove in A minor. Siren figure (E5/A5 hee-haw) over a riff, then a lead.
// ---------------------------------------------------------------------------------------------
const ALARM_FILL = 'k:2 h:2 s:2 h:2 s s s s t t T T |';
const ALARM_BEAT = 'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:1 h:1 |';

export const alarm: SongDef = {
  id: 'alarm',
  title: 'Alarm (spy groove with siren)',
  bpm: 156,
  beats: 4,
  key: { tonic: 'A', mode: 'minor', extra: ['G#'] },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.85 },
  inst: {
    riff: { duty: 0.125, decay: 80, sustain: 0.5, gate: 0.8, oct: 4 },
    lead: { duty: 0.5, decay: 160, sustain: 0.7, vibrato: { depth: 20, rate: 7, delay: 100 } },
    siren: { duty: 0.5, vol: 0.7, gate: 1, attack: 4, oct: 5 },
    sirenFast: { duty: 0.25, vol: 0.7, gate: 0.95, attack: 2, oct: 5 },
    hold: { duty: 0.5, vol: 0.7, gate: 1, attack: 30, oct: 5 },
  },
  chords: [
    'Am:16 | Am:16 | F:16 | E:16 | Am:16 | Am:16 | Dm:16 | E:16 |',
    'Am:16 | F:16 | Dm:16 | E:16 | Am:16 | F:16 | E:16 | E:16 |',
  ],
  pulse1: [
    '@riff',
    rep("$1:2 $1 $2 $3:2 -:2 $1:2 $2:2 $3:2 -:2 |", 8),
    `@lead
     A5:3 G#5:1 A5:2 B5:2 C6:4 B5:2 A5:2 |
     A5:3 G5:1 F5:2 E5:2 F5:8 |
     D5:4 F5:4 A5:4 D6:4 |
     E5:3 E5:1 G#5:4 B5:4 E6:4 |
     A5:3 G#5:1 A5:2 B5:2 C6:4 E6:4 |
     F5:4 A5:4 C6:4 A5:4 |
     B5:4 G#5:4 E5:4 G#5:4 |
     E5:2 E5:2 E5:2 E5:2 E5:4 -:4 |`,
  ],
  pulse2: [
    '@siren',
    rep('E5:4 A5:4 E5:4 A5:4 |', 8),
    '@sirenFast',
    rep('E5:2 A5:2 E5:2 A5:2 E5:2 A5:2 E5:2 A5:2 |', 7),
    '@hold E5:16 |',
  ],
  triangle: [
    rep("$1:1 $1:1 $1:2 $1:1 $1:1 $1:2 $1':2 $1:2 $1:2 $3:2 |", 16),
  ],
  noise: [
    rep(ALARM_BEAT, 3),
    ALARM_FILL,
    rep(ALARM_BEAT, 3),
    ALARM_FILL,
    rep(ALARM_BEAT, 3),
    ALARM_FILL,
    rep(ALARM_BEAT, 3),
    's:2 s:2 s:2 s:2 s:1 s:1 s:1 s:1 c:4 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// ELEVATOR: muzak arrangement built from the mall motif (E-G-D-C). Swung, soft, walking bass.
// ---------------------------------------------------------------------------------------------
export const elevator: SongDef = {
  id: 'elevator',
  title: 'Elevator muzak',
  bpm: 92,
  beats: 4,
  swing: 0.22,
  swingStep: 2,
  key: { tonic: 'C', mode: 'major', extra: ['C#'] },
  loop: true,
  vol: 0.7,
  mix: { pulse2: 0.8, noise: 0.7 },
  inst: {
    vibes: { duty: 0.25, attack: 4, decay: 500, sustain: 0.55, vibrato: { depth: 14, rate: 5, delay: 200 }, gate: 0.9 },
    comp: { duty: 0.5, vol: 0.5, decay: 120, sustain: 0.3, gate: 0.8, oct: 3, arp: 38 },
  },
  chords: [
    'Cmaj7:16 | Am7:16 | Dm7:16 | G7:16 | Cmaj7:16 | Am7:16 | Dm7:16 | G7:16 |',
    'Fmaj7:16 | Fmaj7:16 | Em7:16 | A7:16 | Dm7:16 | G7:16 | Cmaj7:8 Am7:8 | Dm7:8 G7:8 |',
  ],
  pulse1: [
    `@vibes
     -:2 E5:2 G5:2 D5:4 C5:2 -:4 |
     -:2 C5:2 E5:2 A4:4 C5:2 -:4 |
     -:2 D5:2 F5:2 C5:4 A4:2 -:4 |
     -:2 B4:2 D5:2 G4:4 B4:2 -:4 |
     -:2 E5:2 G5:2 D5:4 C5:2 E5:4 |
     -:2 E5:2 A5:2 G5:4 E5:2 C5:4 |
     D5:4 F5:4 A5:4 G5:2 F5:2 |
     B4:8 -:4 D5:2 B4:2 |
     A5:4 G5:2 F5:2 E5:4 C5:4 |
     F5:2 A5:2 C6:4 A5:4 F5:4 |
     G5:4 E5:2 G5:2 B5:4 G5:4 |
     E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4 |
     D5:4 F5:2 A5:2 D6:4 C6:4 |
     B5:4 G5:4 D5:4 F5:4 |
     E5:4 G5:4 C6:4 A5:4 |
     D6:4 C6:2 B5:2 G5:8 |`,
  ],
  pulse2: [
    '@comp',
    rep('-:2 $c:2 -:2 $c:2 -:2 $c:2 -:2 $c:2 |', 8),
    rep('-:4 $c:2 -:2 -:4 $c:2 -:2 |', 8),
  ],
  triangle: [
    rep("$1:4 $2:4 $3:4 $2:4 | $1:6 -:2 $3:6 -:2 |", 8),
  ],
  noise: [
    rep('m?:2 m?:2 w?:2 m?:2 m?:2 m?:2 w?:2 m?:2 |', 16),
  ],
};

// ---------------------------------------------------------------------------------------------
// BOOTH: Sam Baddy listening-booth bonus track ("SIDE B"). Bright pop in D major.
// ---------------------------------------------------------------------------------------------
export const booth: SongDef = {
  id: 'booth',
  title: 'Listening booth (SIDE B pop)',
  bpm: 124,
  beats: 4,
  key: { tonic: 'D', mode: 'major' },
  loop: true,
  vol: 1,
  mix: { pulse2: 0.75 },
  inst: {
    pop: { duty: 0.5, decay: 200, sustain: 0.7, vibrato: { depth: 12, rate: 6, delay: 180 }, gate: 0.9 },
    shine: { duty: 0.25, decay: 180, sustain: 0.65, vibrato: { depth: 16, rate: 6, delay: 140 }, gate: 0.92 },
    pluck: { duty: 0.125, decay: 120, sustain: 0.2, gate: 0.8, oct: 4 },
    sparkle: { duty: 0.25, decay: 90, sustain: 0.5, gate: 0.85, oct: 4 },
  },
  chords: [
    'D:16 | A:16 | Bm:16 | G:16 | D:16 | A:16 | Bm:16 | G:16 |',
    'G:16 | D:16 | A:16 | Bm:16 | G:16 | D:16 | Em:8 A:8 | D:16 |',
  ],
  pulse1: [
    `@pop
     F#5:2 F#5:2 A5:2 F#5:2 E5:4 D5:4 |
     E5:2 E5:2 A5:2 E5:2 C#5:4 E5:4 |
     D5:2 D5:2 F#5:2 D5:2 B4:4 D5:4 |
     D5:2 E5:2 G5:2 B5:2 A5:4 G5:4 |
     F#5:2 F#5:2 A5:2 F#5:2 E5:4 D5:4 |
     E5:2 E5:2 A5:2 C#6:2 B5:4 A5:4 |
     D5:2 F#5:2 B5:4 A5:2 F#5:2 D5:4 |
     G5:4 F#5:4 E5:4 A4:2 B4:2 |
     @shine
     B5:4 B5:2 A5:2 G5:4 B5:4 |
     A5:4 A5:2 F#5:2 D5:4 F#5:4 |
     C#6:4 C#6:2 B5:2 A5:4 C#6:4 |
     D6:4 B5:4 F#5:4 D5:4 |
     B5:4 B5:2 A5:2 G5:4 B5:4 |
     A5:4 A5:2 F#5:2 D5:4 F#5:2 A5:2 |
     G5:4 B5:4 C#6:4 E6:4 |
     D6:8 A5:4 F#5:4 |`,
  ],
  pulse2: [
    '@pluck',
    rep('-:2 $2:2 -:2 $3:2 -:2 $2:2 -:2 $3:2 |', 8),
    "@sparkle",
    rep("$1 $3 $4 $3 $5 $3 $4 $3 $1 $3 $4 $3 $5 $3 $4 $3 |", 8),
  ],
  triangle: [
    rep('$1:3 -:1 $1:2 $1:2 $3:3 -:1 $1:2 $3:2 |', 8),
    rep("$1:2 $1':2 $1:2 $1':2 $1:2 $1':2 $1:2 $1':2 |", 8),
  ],
  noise: [
    rep('k:4 h:2 h:2 s:4 h:2 h:2 |', 8),
    rep('k:2 h:1 h:1 s:2 h:2 k:2 k:2 s:2 h:1 h:1 |', 7),
    'k:2 h:1 h:1 s:2 s:1 s:1 t:2 T:2 c:4 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// CONTINUE: ticking, heartbeat-bass countdown tension in E minor. Speeds up in the second half.
// ---------------------------------------------------------------------------------------------
export const continueSong: SongDef = {
  id: 'continue',
  title: 'Continue? (countdown tension)',
  bpm: 144,
  beats: 4,
  key: { tonic: 'E', mode: 'minor', extra: ['D#'] },
  loop: true,
  vol: 0.95,
  mix: { pulse2: 0.8 },
  inst: {
    throb: { duty: 0.25, decay: 120, sustain: 0.6, gate: 0.85 },
    urge: { duty: 0.5, decay: 90, sustain: 0.6, gate: 0.8 },
    tick: { duty: 0.125, decay: 40, sustain: 0, gate: 0.5, vol: 0.6 },
  },
  chords: [
    'Em:16 | Em:16 | C:16 | C:16 | Am:16 | Am:16 | B7:16 | B7:16 |',
    'Em:16 | Em:16 | C:16 | D:16 | Am:16 | C:16 | B7:16 | B7:16 |',
  ],
  pulse1: [
    `@throb
     B4:4 -:2 B4:2 B4:4 -:2 C5:2 |
     B4:4 -:2 B4:2 D5:4 -:2 B4:2 |
     C5:4 -:2 C5:2 C5:4 -:2 D5:2 |
     E5:4 -:2 E5:2 G5:4 -:2 E5:2 |
     A4:4 -:2 A4:2 C5:4 -:2 A4:2 |
     E5:4 -:2 E5:2 A5:4 -:2 G5:2 |
     F#5:2 F#5:2 F#5:2 F#5:2 D#5:2 D#5:2 B4:2 B4:2 |
     A5:2 G5:2 F#5:2 D#5:2 B4:8 |
     @urge
     E5:2 E5:2 E5:2 E5:2 G5:2 G5:2 B5:2 B5:2 |
     B5:4 A5:4 G5:4 F#5:4 |
     C6:2 C6:2 C6:2 C6:2 B5:2 B5:2 G5:2 G5:2 |
     A5:2 A5:2 F#5:2 F#5:2 D5:4 F#5:4 |
     E5:2 E5:2 A5:2 A5:2 C6:4 E6:4 |
     G5:2 G5:2 C6:2 C6:2 E6:4 G6:4 |
     F#5:2 D#5:2 B4:2 D#5:2 F#5:2 D#5:2 B4:2 D#5:2 |
     B5:2 B5:2 B5:2 B5:2 B5:1 B5:1 B5:1 B5:1 B5:1 B5:1 B5:1 B5:1 |`,
  ],
  pulse2: [
    '@tick',
    rep('E6:1 -:3 B5:1 -:3 E6:1 -:3 B5:1 -:3 |', 8),
    rep('E6:1 -:1 B5:1 -:1 E6:1 -:1 B5:1 -:1 E6:1 -:1 B5:1 -:1 E6:1 -:1 B5:1 -:1 |', 8),
  ],
  triangle: [
    rep('$1:3 -:1 $1:2 -:2 $1:3 -:1 $1:2 -:2 |', 8),
    rep('$1:2 $1:2 $1:2 $1:2 $1:2 $1:2 $1:2 $1:2 |', 8),
  ],
  noise: [
    rep('k:3 -:1 k:2 -:2 k:3 -:1 k:2 -:2 |', 4),
    rep('k:3 x:1 k:2 x:2 k:3 x:1 k:2 x:2 |', 3),
    's:2 s:2 s:2 s:2 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 |',
    rep('k:2 x:2 s:2 x:2 k:2 x:2 s:2 x:2 |', 7),
    's:2 s:2 s:2 s:2 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 |',
  ],
};

// ---------------------------------------------------------------------------------------------
// NEWSPAPER: light jazzy loop for THE DAILY MALL and the SPYGRAM. Swung, walking bass, brushes. F major.
// ---------------------------------------------------------------------------------------------
export const newspaper: SongDef = {
  id: 'newspaper',
  title: 'The Daily Mall (light jazz)',
  bpm: 108,
  beats: 4,
  swing: 0.3,
  swingStep: 2,
  key: { tonic: 'F', mode: 'major', extra: ['F#'] },
  loop: true,
  vol: 0.75,
  mix: { pulse2: 0.8, noise: 0.7 },
  inst: {
    sax: { duty: 0.25, attack: 6, decay: 300, sustain: 0.6, vibrato: { depth: 16, rate: 5.5, delay: 200 }, gate: 0.88 },
    comp: { duty: 0.5, vol: 0.55, decay: 140, sustain: 0.3, gate: 0.8, oct: 3, arp: 40 },
  },
  chords: [
    'Fmaj7:16 | D7:16 | Gm7:16 | C7:16 | Fmaj7:16 | D7:16 | Gm7:16 | C7:16 |',
    'Am7:16 | D7:16 | Gm7:16 | C7:16 | Fmaj7:8 D7:8 | Gm7:8 C7:8 | F6:16 | F6:16 |',
  ],
  pulse1: [
    `@sax
     -:2 A4:2 C5:2 E5:2 D5:4 C5:2 -:2 |
     -:2 F#4:2 A4:2 D5:2 C5:4 A4:2 -:2 |
     -:2 G4:2 Bb4:2 D5:2 F5:4 D5:2 -:2 |
     -:2 E4:2 G4:2 Bb4:2 C5:4 E5:2 -:2 |
     A4:2 C5:2 F5:4 E5:2 C5:2 A4:4 |
     F#4:2 A4:2 D5:4 C5:2 A4:2 F#4:4 |
     D5:2 G5:2 F5:2 D5:2 Bb4:4 D5:4 |
     C5:4 E5:2 G5:2 Bb4:4 -:4 |
     E5:2 A5:2 G5:4 E5:2 C5:2 E5:4 |
     D5:2 F#5:2 A5:4 F#5:2 D5:2 A4:4 |
     Bb4:2 D5:2 G5:4 F5:2 D5:2 Bb4:4 |
     G4:2 Bb4:2 E5:4 G5:2 E5:2 C5:4 |
     A5:2 G5:2 F5:2 E5:2 F#5:2 A5:2 D6:2 C6:2 |
     Bb5:2 A5:2 G5:2 D5:2 E5:2 G5:2 Bb5:2 C6:2 |
     A5:4 F5:4 D5:4 C5:4 |
     F5:6 -:2 A4:2 C5:2 E5:2 F5:2 |`,
  ],
  pulse2: [
    '@comp',
    rep('-:2 $c:2 -:4 -:2 $c:2 -:4 |', 8),
    rep('$c:3 -:5 $c:3 -:5 |', 8),
  ],
  triangle: [
    rep("$1:4 $2:4 $3:4 $2:4 | $1:4 $3:4 $1:4 $3:4 |", 8),
  ],
  noise: [
    rep('k?:4 x:2 x:2 s?:4 x:2 x:2 |', 16),
  ],
};
