/**
 * Property tests for the music and sound-effect DATA. Nobody can listen in CI, so these check everything that can
 * be checked objectively: coverage of every id, ranges, durations, monophony, whole-bar loops, the 3/4 waltz,
 * that every track is different from every other, that it stays in its key, and (via the offline renderer, which
 * shares its maths with the browser synth) that every track is audible, never clips, and that the mall bed is
 * clearly quieter than the store songs.
 */
import { describe, expect, it } from 'vitest';
import { JINGLE_IDS, LOOP_MUSIC_IDS, MUSIC_IDS, SFX_IDS, STORE_SONG_IDS, type MusicId } from './ids';
import { NOTE_MAX, NOTE_MIN, keyPitchClasses } from './notes';
import { CHANNELS } from './mix';
import { fingerprintDistance, renderSfx, renderSong, sfxFingerprint, signalStats } from './offline';
import { contentSignature, intervalSignature } from './sequencer';
import { SFX, layerFrames, sfxDurationMs, sfxPoly } from './sfx';
import { compileSong } from './song';
import { SONG_DEFS, getSong } from './songs';

const SR = 11025;
const rendered = new Map<MusicId, { peak: number; rms: number }>();
function stats(id: MusicId): { peak: number; rms: number } {
  let s = rendered.get(id);
  if (!s) {
    const st = signalStats(renderSong(getSong(id), { sampleRate: SR }), SR);
    s = { peak: st.peak, rms: st.rms };
    rendered.set(id, s);
  }
  return s;
}

describe('every id has a composition', () => {
  it('SONG_DEFS covers exactly MUSIC_IDS and each def carries its own id', () => {
    expect(Object.keys(SONG_DEFS).sort()).toEqual([...MUSIC_IDS].sort());
    for (const id of MUSIC_IDS) expect(SONG_DEFS[id].id).toBe(id);
  });
  it('the expected counts: 7 loops + 10 stores + 5 jingles', () => {
    expect(STORE_SONG_IDS).toHaveLength(10);
    expect(JINGLE_IDS).toHaveLength(5);
    expect(LOOP_MUSIC_IDS).toHaveLength(17);
  });
  it('every composition compiles', () => {
    for (const id of MUSIC_IDS) expect(() => getSong(id), id).not.toThrow();
  });
  it('looping flags match the id kind (jingles play once)', () => {
    for (const id of LOOP_MUSIC_IDS) expect(getSong(id).loop, id).toBe(true);
    for (const id of JINGLE_IDS) expect(getSong(id).loop, id).toBe(false);
  });
});

describe('notes are playable', () => {
  it('all pitched notes lie in the playable range and match their frequency', () => {
    for (const id of MUSIC_IDS) {
      for (const e of getSong(id).events) {
        if (e.ch === 'noise') {
          expect(e.midi).toBe(-1);
          expect(e.freq).toBeGreaterThan(100);
          expect(e.freq).toBeLessThan(60000);
        } else {
          expect(e.midi, `${id} ${e.ch} step ${e.step}`).toBeGreaterThanOrEqual(NOTE_MIN);
          expect(e.midi, `${id} ${e.ch} step ${e.step}`).toBeLessThanOrEqual(NOTE_MAX);
          expect(e.freq).toBeCloseTo(440 * Math.pow(2, (e.midi - 69) / 12), 6);
        }
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1);
      }
    }
  });
  it('no zero or negative durations, no events outside the song', () => {
    for (const id of MUSIC_IDS) {
      const s = getSong(id);
      for (const e of s.events) {
        expect(Number.isFinite(e.start) && Number.isFinite(e.dur), id).toBe(true);
        expect(e.dur, `${id} ${e.ch} step ${e.step}`).toBeGreaterThan(0.01);
        expect(e.start).toBeGreaterThanOrEqual(0);
        expect(e.start + e.dur, `${id} ${e.ch} step ${e.step}`).toBeLessThanOrEqual(s.duration + 1e-9);
      }
    }
  });
  it('each channel is monophonic: gates never overlap', () => {
    for (const id of MUSIC_IDS) {
      const s = getSong(id);
      for (const ch of CHANNELS) {
        const ev = s.channels[ch];
        for (let i = 1; i < ev.length; i++) {
          expect(ev[i]!.start, `${id} ${ch} #${i}`).toBeGreaterThanOrEqual(ev[i - 1]!.start + ev[i - 1]!.dur - 1e-9);
        }
      }
    }
  });
  it('every note stays in the declared key (blue notes must be declared as extra)', () => {
    for (const id of MUSIC_IDS) {
      const s = getSong(id);
      const pcs = keyPitchClasses(s.key);
      let total = 0;
      let inKey = 0;
      for (const e of s.events) {
        if (e.midi < 0) continue;
        total += e.dur;
        if (pcs.has(e.midi % 12)) inKey += e.dur;
      }
      expect(inKey / total, id).toBeGreaterThanOrEqual(0.97);
    }
  });
  it('melodies sit on the chords: most beat-aligned lead notes are chord tones', () => {
    for (const id of MUSIC_IDS) {
      const s = getSong(id);
      if (s.chords.length === 0) continue;
      let good = 0;
      let total = 0;
      for (const e of s.channels.pulse1) {
        if (e.midi < 0 || e.step % s.stepsPerBeat !== 0) continue;
        const sp = s.chords.find((c) => e.step >= c.startStep && e.step < c.endStep);
        if (!sp) continue;
        total++;
        if (sp.chord.intervals.some((i) => (sp.chord.rootPc + i) % 12 === e.midi % 12)) good++;
      }
      if (total > 8) expect(good / total, id).toBeGreaterThanOrEqual(0.55);
    }
  });
});

describe('structure', () => {
  it('loops are a whole number of bars and long enough to avoid feeling like 8 bars on repeat', () => {
    for (const id of LOOP_MUSIC_IDS) {
      const s = getSong(id);
      expect(Number.isInteger(s.bars), id).toBe(true);
      expect(s.bars, id).toBeGreaterThanOrEqual(16);
      expect(s.bars, id).toBeLessThanOrEqual(32);
      expect(s.loopDuration / s.barSec, id).toBeCloseTo(Math.round(s.loopDuration / s.barSec), 9);
      expect(s.duration / s.barSec, id).toBeCloseTo(s.bars, 9);
      expect(s.loopDuration, id).toBeGreaterThan(15);
    }
  });
  it('no note crosses the loop point (seamless loops)', () => {
    for (const id of LOOP_MUSIC_IDS) {
      const s = getSong(id);
      for (const e of s.events) expect(e.start + e.dur, id).toBeLessThanOrEqual(s.duration + 1e-9);
      // something plays at the very start of the loop section, so the seam has no gap
      const first = s.events.filter((e) => Math.abs(e.start - s.loopStart) < 1e-9);
      expect(first.length, id).toBeGreaterThan(0);
    }
  });
  it('songs have real sections: many different bars, and the second half differs from the first', () => {
    for (const id of LOOP_MUSIC_IDS) {
      const s = getSong(id);
      const sigs: string[] = [];
      for (let b = 0; b < s.bars; b++) {
        const lo = b * s.stepsPerBar;
        const hi = lo + s.stepsPerBar;
        sigs.push(
          s.events
            .filter((e) => e.step >= lo && e.step < hi)
            .map((e) => `${e.ch}${e.step - lo}:${e.drum ?? e.midi}`)
            .join(','),
        );
      }
      expect(new Set(sigs).size, id).toBeGreaterThanOrEqual(Math.ceil(s.bars / 2));
      const half = s.bars / 2;
      expect(sigs.slice(0, half).join('|'), id).not.toBe(sigs.slice(half).join('|'));
    }
  });
  it('songs have melody, bass and (where it fits) percussion', () => {
    for (const id of MUSIC_IDS) {
      const s = getSong(id);
      expect(s.channels.pulse1.length, id).toBeGreaterThan(3);
      expect(s.channels.triangle.length, id).toBeGreaterThan(1);
      if (!['mall', 'itemget'].includes(id)) expect(s.channels.pulse2.length, id).toBeGreaterThan(1);
      if (id !== 'mall') expect(s.channels.noise.length, id).toBeGreaterThan(0);
    }
  });
  it('KGB Toys is a waltz in 3/4', () => {
    const s = getSong('store.kgbtoys');
    expect(s.beats).toBe(3);
    expect(s.beatUnit).toBe(4);
    expect(s.stepsPerBar).toBe(3 * s.stepsPerBeat);
    expect(s.barSec).toBeCloseTo((3 * 60) / s.bpm, 9);
    for (const id of MUSIC_IDS) if (id !== 'store.kgbtoys') expect(getSong(id).beats, id).not.toBe(3);
  });
  it('the splash jingle is about 1.5 seconds; jingles are short', () => {
    expect(getSong('splash').duration).toBeGreaterThan(1.2);
    expect(getSong('splash').duration).toBeLessThan(1.8);
    for (const id of JINGLE_IDS) {
      expect(getSong(id).duration, id).toBeLessThan(8);
      expect(getSong(id).duration, id).toBeGreaterThan(0.4);
    }
    expect(getSong('itemget').duration).toBeLessThan(1.2);
  });
  it('store songs follow the brief tempo / style hints', () => {
    // faster spy groove than the title; polka and hyper jingle are quick; dreamy pads and the mall are slow
    expect(getSong('alarm').bpm).toBeGreaterThan(getSong('title').bpm);
    expect(getSong('store.gamestonk').bpm).toBeGreaterThanOrEqual(160);
    expect(getSong('store.hotspy').bpm).toBeGreaterThanOrEqual(150);
    expect(getSong('store.sharper').bpm).toBeLessThan(100);
    expect(getSong('mall').bpm).toBeLessThan(80);
    // bleepy arpeggios really are fast arpeggios
    const arp = getSong('store.radioshock').channels.pulse2;
    const short = arp.filter((e) => e.dur < 0.05).length;
    expect(short / arp.length).toBeGreaterThan(0.7);
  });
});

describe('every track is different', () => {
  const ids = [...MUSIC_IDS];
  it('no two tracks have the same note content', () => {
    const seen = new Map<string, MusicId>();
    for (const id of ids) {
      const sig = contentSignature(getSong(id));
      expect(seen.get(sig), `${id} duplicates ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, id);
    }
  });
  it('lead melodies are not transposed copies of each other (contours differ)', () => {
    const seen = new Map<string, MusicId>();
    for (const id of ids) {
      const sig = intervalSignature(getSong(id), 'pulse1');
      expect(seen.get(sig), `${id} has the same lead contour as ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, id);
    }
  });
  it('lead melodies share very little material (4-interval n-grams)', () => {
    const grams = (id: MusicId): Set<string> => {
      const m = getSong(id).channels.pulse1.filter((e) => e.midi >= 0).map((e) => e.midi);
      const out = new Set<string>();
      for (let i = 0; i + 4 < m.length; i++) out.add([1, 2, 3, 4].map((k) => m[i + k]! - m[i + k - 1]!).join(','));
      return out;
    };
    const big = ids.filter((id) => getSong(id).channels.pulse1.length >= 40);
    for (let i = 0; i < big.length; i++) {
      for (let j = i + 1; j < big.length; j++) {
        const a = grams(big[i]!);
        const b = grams(big[j]!);
        let inter = 0;
        for (const g of a) if (b.has(g)) inter++;
        expect(inter / (a.size + b.size - inter), `${big[i]} vs ${big[j]}`).toBeLessThan(0.3);
      }
    }
  });
  it('the ten store songs are pairwise different in tempo-or-key-or-feel', () => {
    const feel = STORE_SONG_IDS.map((id) => {
      const s = getSong(id);
      return `${s.bpm}/${s.beats}/${s.key.tonic}${s.key.mode}`;
    });
    expect(new Set(feel).size).toBe(10);
  });
  it('a re-compile is identical (data is deterministic)', () => {
    for (const id of ids) {
      const a = compileSong(SONG_DEFS[id]);
      const b = compileSong(SONG_DEFS[id]);
      expect(contentSignature(a)).toBe(contentSignature(b));
      expect(a.duration).toBe(b.duration);
    }
  });
});

describe('offline render', () => {
  it('every track renders audible and does not clip', () => {
    for (const id of MUSIC_IDS) {
      const st = stats(id);
      expect(st.peak, `${id} silent`).toBeGreaterThan(0.05);
      expect(st.peak, `${id} clips`).toBeLessThan(0.95);
      expect(st.rms, `${id} too quiet`).toBeGreaterThan(0.015);
    }
  });
  it('every looping track is audible right from its first bars', () => {
    for (const id of LOOP_MUSIC_IDS) {
      const buf = renderSong(getSong(id), { sampleRate: SR, maxSeconds: 6 });
      const head = buf.subarray(0, 6 * SR);
      expect(signalStats(head, SR).rms, id).toBeGreaterThan(0.01);
    }
  });
  it('rendering is deterministic', () => {
    const a = renderSong(getSong('title'), { sampleRate: SR, maxSeconds: 5 });
    const b = renderSong(getSong('title'), { sampleRate: SR, maxSeconds: 5 });
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });
  it('two loops of a looping track are the same music twice (seamless)', () => {
    for (const id of ['store.gamestonk', 'title', 'store.kgbtoys'] as const) {
      const s = getSong(id);
      const buf = renderSong(s, { sampleRate: SR, loops: 2 });
      const n = Math.round(s.loopDuration * SR);
      // compare the loudness contour (100 ms windows) of pass 1 and pass 2, skipping the first 0.5 s where
      // pass 1 has no release tails from a previous pass
      const win = Math.round(0.1 * SR);
      const skip = Math.round(0.5 * SR);
      const start = Math.round(s.loopStart * SR) + skip;
      for (let i = start; i + win < start + n - 2 * skip; i += win) {
        let e1 = 0;
        let e2 = 0;
        for (let k = 0; k < win; k++) {
          e1 += buf[i + k]! * buf[i + k]!;
          e2 += buf[i + n + k]! * buf[i + n + k]!;
        }
        expect(Math.abs(e1 - e2) / (e1 + e2 + 1e-9), `${id} @${i}`).toBeLessThan(0.2);
      }
    }
  });
  it('the mall ambient bed is clearly quieter than every other track', () => {
    const mall = stats('mall');
    const others = MUSIC_IDS.filter((id) => id !== 'mall' && !JINGLE_IDS.includes(id as never));
    for (const id of others) expect(mall.rms, `mall vs ${id}`).toBeLessThan(stats(id).rms * 0.6);
    for (const id of STORE_SONG_IDS) expect(mall.rms, `mall vs ${id}`).toBeLessThan(stats(id).rms * 0.45);
    expect(mall.peak).toBeLessThan(0.25);
    expect(SONG_DEFS.mall.vol).toBeLessThan(0.5);
  });
  it('the mall is sparse: few notes, mostly rests', () => {
    const mall = getSong('mall');
    const store = getSong('store.forever12');
    expect(mall.events.length).toBeLessThan(store.events.length / 4);
    const bell = mall.channels.pulse1;
    expect(bell.length).toBeLessThan(mall.bars); // fewer than one bell per bar
    const bellTime = bell.reduce((a, e) => a + e.dur, 0);
    expect(bellTime / mall.duration).toBeLessThan(0.35);
  });
});

describe('sound effects', () => {
  it('every sfx id has a definition and each def has its own id', () => {
    expect(Object.keys(SFX).sort()).toEqual([...SFX_IDS].sort());
    for (const id of SFX_IDS) expect(SFX[id].id).toBe(id);
  });
  it('definitions are well-formed', () => {
    for (const id of SFX_IDS) {
      const d = SFX[id];
      expect(d.layers.length, id).toBeGreaterThan(0);
      expect(sfxPoly(d), id).toBeGreaterThanOrEqual(1);
      for (const l of d.layers) {
        expect(l.ms, id).toBeGreaterThan(5);
        expect(l.vol, id).toBeGreaterThan(0);
        expect(l.vol, id).toBeLessThanOrEqual(1);
        expect(l.f0, id).toBeGreaterThan(20);
        expect(l.f1 ?? l.f0, id).toBeGreaterThan(20);
        for (const f of l.steps ?? []) expect(f, id).toBeGreaterThan(20);
        if (l.wave !== 'noise') {
          expect(l.f0, id).toBeLessThan(12000);
          expect(l.f1 ?? l.f0, id).toBeLessThan(12000);
        } else {
          expect(l.f0, id).toBeLessThan(60000);
        }
        expect((l.at ?? 0), id).toBeGreaterThanOrEqual(0);
        const fr = layerFrames(l);
        expect(fr[fr.length - 1]![1], id).toBe(0);
        for (let i = 1; i < fr.length; i++) expect(fr[i]![0], id).toBeGreaterThanOrEqual(fr[i - 1]![0]);
      }
    }
  });
  it('are short enough (under 2 s) and not blips shorter than a frame or two', () => {
    for (const id of SFX_IDS) {
      expect(sfxDurationMs(SFX[id]), id).toBeLessThanOrEqual(2000);
      expect(sfxDurationMs(SFX[id]), id).toBeGreaterThanOrEqual(25);
    }
  });
  it('are audible and never clip on their own', () => {
    for (const id of SFX_IDS) {
      const st = signalStats(renderSfx(SFX[id]), 22050);
      expect(st.peak, `${id} silent`).toBeGreaterThan(0.05);
      expect(st.peak, `${id} clips`).toBeLessThan(0.95);
    }
  });
  it('the signature sounds have the shapes the brief describes', () => {
    // shot = short square sweep down
    const shot = SFX.shot.layers[0]!;
    expect(shot.wave).toBe('pulse');
    expect(shot.f1!).toBeLessThan(shot.f0);
    expect(shot.ms).toBeLessThan(200);
    // ding = bright two-tone pulse
    const dingPulses = SFX.ding.layers.filter((l) => l.wave === 'pulse');
    expect(dingPulses.length).toBeGreaterThanOrEqual(2);
    expect(new Set(dingPulses.map((l) => l.f0)).size).toBe(dingPulses.length);
    expect(Math.min(...dingPulses.map((l) => l.f0))).toBeGreaterThan(1000);
    // crush = noise thud
    expect(SFX.crush.layers.some((l) => l.wave === 'noise' && l.ms >= 300)).toBe(true);
    expect(SFX.thud.layers.some((l) => l.wave === 'triangle')).toBe(true);
    // fanfare = rising arpeggio
    const fan = SFX.fanfare.layers.find((l) => l.steps)!;
    for (let i = 1; i < fan.steps!.length; i++) expect(fan.steps![i]!).toBeGreaterThan(fan.steps![i - 1]!);
    // whistle = vibrato tone
    expect(SFX.whistle.layers.some((l) => l.vib && l.vib.depth > 20)).toBe(true);
    // buzzer = low square
    expect(SFX.buzzer.layers[0]!.f0).toBeLessThan(200);
    expect(SFX.buzzer.layers[0]!.wave).toBe('pulse');
    // death falls
    const death = SFX.death.layers.find((l) => l.steps)!;
    expect(death.steps![death.steps!.length - 1]!).toBeLessThan(death.steps![0]!);
  });
  it('every effect is distinct: no duplicated layer data and a minimum acoustic distance', () => {
    const sigs = new Map<string, string>();
    for (const id of SFX_IDS) {
      const key = JSON.stringify(SFX[id].layers);
      expect(sigs.get(key), `${id} duplicates ${sigs.get(key)}`).toBeUndefined();
      sigs.set(key, id);
    }
    const fps = SFX_IDS.map((id) => [id, sfxFingerprint(SFX[id])] as const);
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const d = fingerprintDistance(fps[i]![1], fps[j]![1]);
        expect(d, `${fps[i]![0]} sounds too much like ${fps[j]![0]}`).toBeGreaterThan(0.15);
      }
    }
  });
});
