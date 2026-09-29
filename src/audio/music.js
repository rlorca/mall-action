// Original chiptunes. Format: see notes.js parseTrack — 16th-note steps, "NOTE:len", "-" rest, x/X/K noise.
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const transpose = (str, semis) => str.replace(/\b([A-G]#?)(\d)\b/g, (_, n, o) => {
  const i = NAMES.indexOf(n) + semis + Number(o) * 12;
  return `${NAMES[((i % 12) + 12) % 12]}${Math.floor(i / 12)}`;
});
const majorize = (str) => str.replace(/\b([CFG])(\d)\b/g, '$1#$2'); // A minor → A major
const bars = (...b) => b.join(' | ');
const times = (s, n) => Array(n).fill(s).join(' | ');

// ---- alarm theme: A minor spy groove (the mall itself plays the quiet ambient bed below) -------------------------------------------------
const MALL_LEAD = bars(
  'A4:3 C5:1 E5:2 A5:2 G5:2 E5:2 D5:2 C5:2',
  'B4:2 C5:2 D5:4 C5:2 B4:2 A4:4',
  'F5:3 E5:1 D5:2 C5:2 A4:4 C5:2 D5:2',
  'D5:3 C5:1 B4:2 G4:2 B4:2 D5:2 G5:4',
  'A4:3 C5:1 E5:2 A5:2 G5:2 E5:2 D5:2 C5:2',
  'E5:2 D5:2 C5:2 B4:2 A4:4 -:4',
  'G#4:2 B4:2 E5:4 D5:2 C5:2 B4:4',
  'E5:2 -:2 E5:2 -:2 G#5:4 B5:4',
);
const walk = (r, t, f, o) => `${r}:2 ${r}:2 ${t}:2 ${r}:2 ${f}:2 ${r}:2 ${o}:2 ${f}:2`;
const stab = (a, b) => `-:2 ${a}:2 -:2 ${b}:2 -:2 ${a}:2 -:2 ${b}:2`;
const AM = ['A2', 'C3', 'E3', 'A3'], F = ['F2', 'A2', 'C3', 'F3'], G = ['G2', 'B2', 'D3', 'G3'], E = ['E2', 'G#2', 'B2', 'E3'];
const MALL_BASS = bars(...[AM, AM, F, G, AM, AM, E, E].map((c) => walk(...c)));

// ---- store: tense D minor -----------------------------------------------------
const STORE = {
  bpm: 130, loop: true,
  p1: bars('D5:1 -:1 F5:1 -:1 A5:2 G#5:2 A5:4 -:4', 'D5:1 -:1 F5:1 -:1 A5:2 A#5:2 A5:4 E5:4', 'F5:2 E5:2 D5:2 C#5:2 D5:4 A4:4', 'A#4:4 A4:4 G#4:4 A4:4'),
  p2: times('A3:1 -:3 A3:1 -:3 A3:1 -:3 A3:1 -:3', 4),
  tri: bars(...Array(2).fill('D2:2 D3:2 D2:2 D3:2 D2:2 D3:2 C#2:2 C#3:2'), ...Array(2).fill('A#1:2 A#2:2 A#1:2 A#2:2 A1:2 A2:2 A1:2 A2:2')),
  noise: times('x:2 x:2 X:4 x:2 x:2 X:4', 4),
};

// ---- booth: bouncy 80s pop in C ----------------------------------------------
const oct = (r, o) => `${r}:2 ${o}:2 ${r}:2 ${o}:2 ${r}:2 ${o}:2 ${r}:2 ${o}:2`;
const BOOTH = {
  bpm: 140, loop: true,
  p1: bars('E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4', 'F5:2 A5:2 C6:4 A5:2 F5:2 C5:4', 'G5:2 B5:2 D6:4 B5:2 A5:2 G5:4'),
  p2: bars(stab('E4', 'G4'), stab('C4', 'E4'), stab('A4', 'C5'), stab('B4', 'D5')),
  tri: bars(oct('C3', 'C4'), oct('A2', 'A3'), oct('F2', 'F3'), oct('G2', 'G3')),
  noise: times('K:2 x:2 X:2 x:2 K:2 x:2 X:2 x:2', 4),
};

// ---- title: heroic theme ------------------------------------------------------
const TITLE = {
  bpm: 120, loop: true,
  p1: bars('E5:4 A5:4 C6:4 B5:2 A5:2', 'G5:4 E5:4 C5:4 D5:4', 'F5:4 A5:4 C6:4 D6:4', 'B5:8 G5:8', 'A5:4 E5:4 A5:4 C6:4', 'B5:4 G#5:4 E5:4 B4:4', 'A5:6 B5:2 C6:4 D6:4', 'E6:12 -:4'),
  p2: bars('A4:16', 'G4:16', 'A4:16', 'B4:16', 'C5:16', 'B4:16', 'A4:16', 'G#4:16'),
  tri: bars(...['A2', 'C3', 'F2', 'G2', 'A2', 'E2', 'F2', 'E2'].map((r) => `${r}:4 ${r}:4 ${r}:4 ${r}:4`)),
  noise: times('K:4 X:4 K:4 X:4', 8),
};

// ---- mall: quiet ambient bed (soft pads, slow bass, a rare bell) -----------------
const MALL_AMBIENT = {
  bpm: 80, loop: true, gain: 0.35,
  p1: bars('-:16', '-:8 E5:2 -:6', '-:16', '-:8 C5:2 -:6', '-:16', '-:8 D5:2 -:6', '-:16', '-:12 B4:4'),
  p2: bars('A3:16', 'E3:16', 'F3:16', 'C4:16', 'A3:16', 'E3:16', 'D3:16', 'E3:16'),
  tri: bars('A2:8 E2:8', 'C3:8 G2:8', 'F2:8 C3:8', 'C3:8 G2:8', 'A2:8 E2:8', 'C3:8 G2:8', 'D3:8 A2:8', 'E2:8 B2:8'),
};

// ---- one song per store --------------------------------------------------------
const four = (s) => times(s, 4);
const STORE_TRACKS = {
  // disco strut
  forever12: { bpm: 120, loop: true,
    p1: bars('E5:2 -:2 E5:2 G5:2 A5:4 G5:2 E5:2', 'D5:2 -:2 D5:2 E5:2 G5:4 E5:2 D5:2', 'C5:2 -:2 C5:2 D5:2 E5:4 D5:2 C5:2', 'D5:4 E5:4 G5:4 A5:4'),
    p2: four('-:2 A4:2 -:2 C5:2 -:2 A4:2 -:2 C5:2'),
    tri: bars(oct('A2', 'A3'), oct('G2', 'G3'), oct('F2', 'F3'), oct('G2', 'G3')),
    noise: four('K:2 x:2 X:2 x:2 K:2 x:2 X:2 x:2') },
  // bleepy arpeggio synth
  radioshock: { bpm: 140, loop: true,
    p1: bars('C5:1 E5:1 G5:1 C6:1 G5:1 E5:1 C5:1 E5:1 G5:1 C6:1 G5:1 E5:1 C5:2 -:2', 'A4:1 C5:1 E5:1 A5:1 E5:1 C5:1 A4:1 C5:1 E5:1 A5:1 E5:1 C5:1 A4:2 -:2', 'F4:1 A4:1 C5:1 F5:1 C5:1 A4:1 F4:1 A4:1 C5:1 F5:1 C5:1 A4:1 F4:2 -:2', 'G4:1 B4:1 D5:1 G5:1 D5:1 B4:1 G4:1 B4:1 D5:1 G5:1 B5:2 D6:2 -:2'),
    p2: bars('C4:8 E4:8', 'A3:8 C4:8', 'F3:8 A3:8', 'G3:8 B3:8'),
    tri: bars('C3:4 C3:4 C3:4 C3:4', 'A2:4 A2:4 A2:4 A2:4', 'F2:4 F2:4 F2:4 F2:4', 'G2:4 G2:4 G2:4 G2:4'),
    noise: four('x:1 x:1 X:2 x:1 x:1 X:2 x:1 x:1 X:2 x:1 x:1 X:2') },
  // wind-up music-box waltz (3/4, 12 steps a bar)
  kgbtoys: { bpm: 110, loop: true,
    p1: bars('E5:4 B4:2 C5:2 D5:4', 'C5:4 B4:2 A4:2 A4:4', 'A4:2 C5:2 E5:4 D5:2 C5:2', 'B4:6 C5:2 D5:4', 'E5:4 C5:4 A4:4', 'A4:12'),
    p2: bars('-:4 E4:4 E4:4', '-:4 E4:4 E4:4', '-:4 A4:4 A4:4', '-:4 G#4:4 G#4:4', '-:4 E4:4 E4:4', '-:4 C5:4 C5:4'),
    tri: bars('A2:12', 'E2:12', 'A2:12', 'E2:12', 'A2:12', 'A2:12') },
  // boardwalk polka
  hotspy: { bpm: 150, loop: true,
    p1: bars('G5:2 E5:2 C5:2 E5:2 G5:4 C6:4', 'B5:2 A5:2 G5:2 F5:2 E5:4 D5:4', 'F5:2 D5:2 B4:2 D5:2 F5:4 A5:4', 'G5:2 F5:2 E5:2 D5:2 C5:8'),
    p2: bars('-:2 E4:2 -:2 E4:2 -:2 E4:2 -:2 E4:2', '-:2 F4:2 -:2 F4:2 -:2 F4:2 -:2 F4:2', '-:2 F4:2 -:2 F4:2 -:2 F4:2 -:2 F4:2', '-:2 E4:2 -:2 E4:2 -:2 E4:2 -:2 E4:2'),
    tri: bars('C3:2 -:2 G2:2 -:2 C3:2 -:2 G2:2 -:2', 'F2:2 -:2 C3:2 -:2 F2:2 -:2 C3:2 -:2', 'G2:2 -:2 D3:2 -:2 G2:2 -:2 D3:2 -:2', 'C3:2 -:2 G2:2 -:2 C3:4 -:4'),
    noise: four('K:2 x:2 K:2 x:2 K:2 x:2 K:2 x:2') },
  // pumped-up stadium march
  footlockpicker: { bpm: 132, loop: true,
    p1: bars('D5:3 D5:1 D5:2 A5:6 -:4', 'G5:3 F#5:1 E5:2 D5:6 -:4', 'B4:3 B4:1 B4:2 G5:6 -:4', 'A5:2 A5:2 A5:2 A5:2 D6:8'),
    p2: bars('F#4:16', 'G4:16', 'G4:16', 'A4:16'),
    tri: bars('D3:4 A2:4 D3:4 A2:4', 'G2:4 D3:4 G2:4 D3:4', 'G2:4 D3:4 G2:4 D3:4', 'A2:4 E3:4 A2:4 C#3:4'),
    noise: four('K:4 X:2 X:2 K:4 X:4') },
  // crunchy rock riff
  sambaddy: { bpm: 128, loop: true,
    p1: bars('E4:2 E4:2 G4:2 E4:2 A4:2 E4:2 B4:2 A4:2', 'E4:2 E4:2 G4:2 E4:2 D5:2 C5:2 B4:2 G4:2', 'E4:2 E4:2 G4:2 E4:2 A4:2 E4:2 B4:2 A4:2', 'G4:2 G4:2 A4:2 A4:2 B4:4 -:4'),
    p2: bars('E5:8 -:4 B4:4', 'E5:8 D5:4 B4:4', 'E5:8 -:4 B4:4', 'G5:4 A5:4 B5:8'),
    tri: four('E2:2 E2:2 E2:2 E2:2 E2:2 E2:2 G2:2 A2:2'),
    noise: four('K:2 x:2 X:2 x:2 K:2 K:2 X:2 x:2') },
  // lounge bossa
  crookstone: { bpm: 100, loop: true,
    p1: bars('E5:3 D5:1 C5:4 A4:4 -:4', 'D5:3 C5:1 B4:4 G4:4 -:4', 'C5:3 B4:1 A4:4 F4:4 -:4', 'B4:4 C5:4 D5:4 E5:4'),
    p2: bars('-:3 C5:1 -:2 C5:2 -:3 C5:1 -:4', '-:3 B4:1 -:2 B4:2 -:3 B4:1 -:4', '-:3 A4:1 -:2 A4:2 -:3 A4:1 -:4', '-:3 G#4:1 -:2 G#4:2 -:3 G#4:1 -:4'),
    tri: bars('A2:3 E3:3 A2:2 E3:3 A2:3 E3:2', 'G2:3 D3:3 G2:2 D3:3 G2:3 D3:2', 'F2:3 C3:3 F2:2 C3:3 F2:3 C3:2', 'E2:3 B2:3 E2:2 B2:3 E2:3 B2:2'),
    noise: four('x:3 x:3 x:2 x:3 x:3 x:2') },
  // dreamy future-tech pads
  sharperimagine: { bpm: 108, loop: true,
    p1: bars('G5:4 D6:4 B5:8', 'A5:4 E6:4 C6:8', 'F#5:4 D6:4 A5:8', 'G5:4 B5:4 D6:8'),
    p2: bars('B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1', 'C5:1 E5:1 A5:1 E5:1 C5:1 E5:1 A5:1 E5:1 C5:1 E5:1 A5:1 E5:1 C5:1 E5:1 A5:1 E5:1', 'A4:1 D5:1 F#5:1 D5:1 A4:1 D5:1 F#5:1 D5:1 A4:1 D5:1 F#5:1 D5:1 A4:1 D5:1 F#5:1 D5:1', 'B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1 B4:1 D5:1 G5:1 D5:1'),
    tri: bars('G2:16', 'A2:16', 'D2:16', 'G2:16') },
  // groovy surf / black-light
  spenders: { bpm: 144, loop: true,
    p1: bars('D5:2 F5:2 G5:2 G#5:2 A5:4 -:4', 'C6:2 A5:2 G5:2 F5:2 D5:4 -:4', 'D5:2 F5:2 G5:2 G#5:2 A5:4 C6:4', 'D6:2 C6:2 A5:2 G5:2 A5:8'),
    p2: four('D4:1 -:1 D4:1 -:1 D4:1 -:1 F4:1 -:1 G4:1 -:1 G#4:1 -:1 A4:2 -:2'),
    tri: four('D2:2 D3:2 D2:2 D3:2 F2:2 F3:2 G2:2 G3:2'),
    noise: four('K:2 x:1 x:1 X:2 x:2 K:2 x:1 x:1 X:4') },
  // hyper 8-bit game-select jingle
  gamestonk: { bpm: 168, loop: true,
    p1: bars('C5:1 C5:1 G5:2 C5:1 C5:1 A5:2 C5:1 C5:1 G5:2 E5:2 D5:2', 'C5:1 C5:1 G5:2 C5:1 C5:1 A5:2 C6:2 B5:2 G5:4', 'F5:1 F5:1 C6:2 F5:1 F5:1 D6:2 C6:2 A5:2 F5:4', 'G5:2 A5:2 B5:2 D6:2 C6:8'),
    p2: bars('E4:4 E4:4 E4:4 G4:4', 'E4:4 E4:4 E4:4 G4:4', 'A4:4 A4:4 A4:4 C5:4', 'B4:4 B4:4 C5:8'),
    tri: bars('C3:2 C3:2 G2:2 G2:2 C3:2 C3:2 G2:2 G2:2', 'C3:2 C3:2 G2:2 G2:2 C3:2 C3:2 G2:2 G2:2', 'F2:2 F2:2 C3:2 C3:2 F2:2 F2:2 C3:2 C3:2', 'G2:2 G2:2 G2:2 G2:2 C3:8'),
    noise: four('K:2 x:2 X:2 x:2 K:2 K:2 X:2 x:2') },
};

export const TRACKS = {
  ...Object.fromEntries(Object.entries(STORE_TRACKS).map(([id, t]) => [`store_${id}`, t])),
  title: TITLE,
  mall: MALL_AMBIENT,
  mallAlarm: {
    bpm: 175, loop: true,
    p1: transpose(MALL_LEAD, 1),
    p2: times('A#5:4 E5:4 A#5:4 E5:4', 8), // siren
    tri: transpose(MALL_BASS, 1),
    noise: times('K:1 x:1 X:1 x:1 K:1 x:1 X:1 x:1 K:1 x:1 X:1 x:1 K:1 x:1 X:1 x:1', 8),
  },
  // elevator muzak: the mall tune, major key, slow, triangle lead with soft pads
  muzak: {
    bpm: 90, loop: true,
    p2: bars('C#4:16', 'C#4:16', 'A3:16', 'B3:16', 'C#4:16', 'C#4:16', 'G#3:16', 'G#3:16'),
    tri: majorize(transpose(MALL_LEAD, -12)),
  },
  store: STORE,
  booth: BOOTH,
  levelClear: {
    bpm: 150, loop: false,
    p1: 'C5:2 E5:2 G5:2 C6:6 | G5:2 C6:14',
    p2: 'E4:2 G4:2 C5:2 E5:6 | E5:2 G5:14',
    tri: 'C3:4 G3:4 C4:4 | C3:16',
    noise: 'X:4 x:4 X:4 | K:16',
  },
  gameOver: {
    bpm: 90, loop: false,
    p1: 'A4:4 G#4:4 G4:4 F#4:4 | F4:8 E4:8',
    p2: 'C4:4 B3:4 A#3:4 A3:4 | G#3:16',
    tri: 'A2:16 | E2:8 A1:8',
  },
  itemGet: {
    bpm: 140, loop: false,
    p1: 'C5:1 E5:1 G5:1 C6:1 D5:1 F#5:1 A5:1 D6:1 E5:2 G#5:2 B5:2 E6:2',
    p2: 'E4:1 G4:1 C5:1 E5:1 F#4:1 A4:1 D5:1 F#5:1 G#4:2 B4:2 E5:2 G#5:2',
    tri: 'C3:4 D3:4 E3:8',
    noise: 'x:4 x:4 X:8',
  },
};
