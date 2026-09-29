/**
 * Tiny music notation, one token per step:
 *   C4 D#4 Bb3   a note (octave 0-8), lasts one step
 *   C4*3         a note lasting 3 steps
 *   -            extend the previous note by one step
 *   .            rest (one step); .*4 rests 4 steps
 *   k s h o      noise-track hits: kick, snare, closed hat, open hat
 *   |            bar line (ignored, for readability)
 *   { ... }x4    repeat a group (may nest)
 */
export interface NoteEvent {
  step: number;
  len: number;
  /** MIDI note number for tonal tracks; for noise: 'k' | 's' | 'h' | 'o'. */
  note: number | string;
}

export interface ParsedTrack {
  events: NoteEvent[];
  length: number;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(tok: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE_BASE[m[1].toUpperCase()];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + n;
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Expand {..}xN groups into a flat token list. */
function expand(src: string): string[] {
  const toks = src.replace(/\{/g, ' { ').replace(/\}x(\d+)/g, ' }x$1 ').split(/\s+/).filter((t) => t && t !== '|');
  let i = 0;
  function group(): string[] {
    const out: string[] = [];
    while (i < toks.length) {
      const t = toks[i++];
      if (t === '{') {
        const inner = group();
        const close = toks[i - 1];
        const m = /^\}x(\d+)$/.exec(close ?? '');
        if (!m) throw new Error('unclosed repeat group');
        const n = parseInt(m[1], 10);
        for (let r = 0; r < n; r++) out.push(...inner);
      } else if (/^\}x\d+$/.test(t)) {
        return out;
      } else {
        out.push(t);
      }
    }
    return out;
  }
  return group();
}

export function parseTrack(src: string, noise = false): ParsedTrack {
  const events: NoteEvent[] = [];
  let step = 0;
  let last: NoteEvent | null = null;
  for (const raw of expand(src)) {
    const [tok, mult] = raw.split('*');
    const n = mult === undefined ? 1 : parseInt(mult, 10);
    if (!(n >= 1)) throw new Error(`bad length in token '${raw}'`);
    if (tok === '-') {
      if (!last) throw new Error("'-' with no previous note");
      last.len += n;
    } else if (tok === '.') {
      last = null;
    } else if (noise) {
      if (!/^[khso]$/.test(tok)) throw new Error(`bad noise token '${raw}'`);
      last = { step, len: n, note: tok };
      events.push(last);
    } else {
      const midi = noteToMidi(tok);
      if (midi === null) throw new Error(`bad note token '${raw}'`);
      last = { step, len: n, note: midi };
      events.push(last);
    }
    step += n;
  }
  return { events, length: step };
}
