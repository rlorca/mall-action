/**
 * Pure sequencer: given a compiled song and a window of ABSOLUTE playback time, say which events start in it.
 *
 * Absolute time t counts seconds since the song was started. Pass 0 covers [0, duration); for looping songs every
 * later pass k >= 1 replays the section [loopStart, duration) shifted by k * loopDuration, so the loop point is
 * sample-exact and independent of how the caller slices windows. No clocks, no state: the Web Audio scheduler just
 * remembers the last `to` it asked for.
 */
import type { CompiledSong, NoteEvent } from './song';

export interface ScheduledEvent {
  readonly event: NoteEvent;
  /** Absolute start time in seconds since playback began. */
  readonly time: number;
}

/** Index of the first event with start >= t (events are sorted by start). */
function lowerBound(events: readonly NoteEvent[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.start < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Events whose absolute start time lies in [from, to), in time order. */
export function eventsBetween(song: CompiledSong, from: number, to: number): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  if (!(to > from)) return out;
  const L = song.loopDuration;

  const collect = (sFrom: number, sTo: number, offset: number): void => {
    // song-time range [sFrom, sTo) -> absolute time = s + offset
    const ev = song.events;
    for (let i = lowerBound(ev, sFrom); i < ev.length && ev[i]!.start < sTo; i++) {
      out.push({ event: ev[i]!, time: ev[i]!.start + offset });
    }
  };

  // Pass 0: absolute == song time.
  if (from < song.duration) collect(Math.max(from, 0), Math.min(to, song.duration), 0);
  if (!song.loop || to <= song.duration) return out;

  // Passes k >= 1: absolute = s + k * L for s in [loopStart, duration).
  const kFirst = Math.max(1, Math.floor((from - song.loopStart) / L));
  for (let k = kFirst; ; k++) {
    const passStart = song.loopStart + k * L; // absolute time where song-time loopStart plays in pass k
    if (passStart >= to) break;
    const offset = k * L;
    const sFrom = Math.max(from - offset, song.loopStart);
    const sTo = Math.min(to - offset, song.duration);
    if (sTo > sFrom) collect(sFrom, sTo, offset);
  }
  return out;
}

/** True once a non-looping song has played to its end (looping songs never finish). */
export function isFinished(song: CompiledSong, t: number): boolean {
  return !song.loop && t >= song.duration;
}

/** Total length of playback for `loops` passes of a looping song (or the single pass of a jingle). */
export function playbackLength(song: CompiledSong, loops: number): number {
  return song.loop ? song.duration + Math.max(0, loops - 1) * song.loopDuration : song.duration;
}

/**
 * Order-sensitive fingerprint of a song's note content (step, pitch/drum, length class, channel). Two songs with
 * the same fingerprint are the same music. Used by the "every track is different" test.
 */
export function contentSignature(song: CompiledSong, channels?: readonly NoteEvent['ch'][]): string {
  return song.events
    .filter((e) => !channels || channels.includes(e.ch))
    .map((e) => `${e.ch[0]}${e.step}:${e.drum ?? e.midi}:${Math.round(e.dur * 1000)}`)
    .join(',');
}

/** Transposition-invariant melodic contour of one channel: the sequence of semitone intervals between notes. */
export function intervalSignature(song: CompiledSong, ch: NoteEvent['ch']): string {
  const midis = song.channels[ch].filter((e) => e.midi >= 0).map((e) => e.midi);
  const out: number[] = [];
  for (let i = 1; i < midis.length; i++) out.push(midis[i]! - midis[i - 1]!);
  return out.join(',');
}
