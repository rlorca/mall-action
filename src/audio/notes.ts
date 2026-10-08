// Note and scale helpers for the sequencer. Pure: no Web Audio here.

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI number for a name like "C4", "F#3" (C4 = 60). Returns null for rests and holds. */
export function midi(name: string): number | null {
  if (name === '.' || name === '-') return null;
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const pc = NAMES.indexOf(`${m[1]}${m[2]}`);
  return (Number(m[3]) + 1) * 12 + pc;
}

export function hz(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/** Intervals (in semitones above the root) for the scales the store songs use. */
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pent: [0, 2, 4, 7, 9],
  minPent: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const;

export type ScaleName = keyof typeof SCALES;

/** The `n`th note of a scale (wrapping into higher octaves), as a MIDI number. */
export function scaleNote(root: number, scale: ScaleName, n: number): number {
  const s = SCALES[scale];
  const octave = Math.floor(n / s.length);
  return root + s[((n % s.length) + s.length) % s.length] + 12 * octave;
}
