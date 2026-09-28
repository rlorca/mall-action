import { describe, it, expect } from 'vitest';
import { noteToFreq, parseTrack } from '../src/audio/notes.js';

describe('notes', () => {
  it('converts notes to frequencies', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440); expect(noteToFreq('C5')).toBeCloseTo(523.25, 1); expect(noteToFreq('F#3')).toBeCloseTo(185.0, 1);
    expect(noteToFreq('-')).toBeNull();
  });
  it('parses lengths, rests, noise hits and bar lines', () => {
    expect(parseTrack('C4:2 - | x E4')).toEqual([
      { note: 'C4', freq: noteToFreq('C4'), len: 2 }, { note: null, freq: null, len: 1 },
      { note: 'x', freq: null, len: 1 }, { note: 'E4', freq: noteToFreq('E4'), len: 1 },
    ]);
  });
  it('rejects malformed tokens', () => expect(() => parseTrack('H4')).toThrow('bad token'));
});
