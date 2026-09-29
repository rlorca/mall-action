// MALL ACTION audio: NES-style chiptune via Web Audio. The pure layer (notes/songs/sequencer/sfxdefs)
// is deterministic and testable; this file is the thin WebAudio driver around it.
import type { GameEvent, MusicName, SfxName } from '../core/events';
import { SFX } from './sfxdefs';
import { SONGS, isJingle } from './songs';
import { compileSong, eventsAtStep, type CompiledSong } from './sequencer';
import { Kit, playVoice, type Voice } from './voice';
import type { NoteEvent, VoiceSpec } from './types';

export interface AudioApi {
  /** Call on the first user input (keydown / pointerdown / gamepad). Safe if AudioContext is unavailable. */
  resume(): void;
  sfx(name: SfxName): void;
  /** Switch music (null = silence). Same looping track requested again is a no-op; jingles restart. */
  music(name: MusicName | null): void;
  /** Pause overlay: turn music down (true) / back up (false). */
  setMusicDuck(on: boolean): void;
  setMuted(m: boolean): void;
  toggleMute(): boolean;
  readonly muted: boolean;
  /** Elevator riding hum (looped drone) on/off. */
  hum(on: boolean): void;
  handleEvent(ev: GameEvent): void;
}

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const MAX_SFX = 12;
const DUCK_LEVEL = 0.25;

export function createNullAudio(): AudioApi {
  let muted = false;
  return {
    resume() {},
    sfx() {},
    music() {},
    setMusicDuck() {},
    setMuted(m) { muted = m; },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    hum() {},
    handleEvent() {},
  };
}

interface Playing {
  name: MusicName;
  comp: CompiledSong;
  bus: GainNode;
  step: number;
  nextTime: number;
  voices: Set<Voice>;
}

function noteSpec(e: NoteEvent): VoiceSpec {
  return {
    channel: e.channel, segs: [{ f0: e.freq, f1: e.freq1, dur: e.dur }], vol: e.vol, duty: e.duty, env: e.env, mode: e.mode,
  };
}

export function createAudio(): AudioApi {
  let ctx: AudioContext | null = null;
  let failed = false;
  let kit: Kit | null = null;
  let master: GainNode;
  let duckGain: GainNode;
  let sfxBus: GainNode;
  let muted = false;
  let ducked = false;
  let wantedMusic: MusicName | null = null;
  let pendingMusic = false;
  let wantHum = false;
  let cur: Playing | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const sfxGroups: { voices: Voice[]; end: number }[] = [];
  let humNodes: { gain: GainNode; oscs: OscillatorNode[] } | null = null;

  function init(): boolean {
    if (ctx) return true;
    if (failed) return false;
    try {
      const Ctor: typeof AudioContext | undefined =
        typeof AudioContext !== 'undefined' ? AudioContext
          : typeof window !== 'undefined' ? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
      if (!Ctor) { failed = true; return false; }
      ctx = new Ctor();
      kit = new Kit(ctx);
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master.connect(comp);
      comp.connect(ctx.destination);
      duckGain = ctx.createGain();
      duckGain.gain.value = ducked ? DUCK_LEVEL : 1;
      duckGain.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      timer = setInterval(tick, TICK_MS);
      return true;
    } catch {
      failed = true;
      ctx = null;
      return false;
    }
  }

  function stopMusic(): void {
    if (!cur || !ctx) { cur = null; return; }
    const now = ctx.currentTime;
    for (const v of cur.voices) v.cut(now);
    const bus = cur.bus;
    try {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(0, now);
    } catch { /* ignore */ }
    setTimeout(() => { try { bus.disconnect(); } catch { /* ignore */ } }, 100);
    cur = null;
  }

  function startMusic(name: MusicName): void {
    if (!ctx) return;
    stopMusic();
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(duckGain);
    cur = { name, comp: compileSong(SONGS[name]), bus, step: 0, nextTime: ctx.currentTime + 0.06, voices: new Set() };
    tick();
  }

  function tick(): void {
    if (!ctx || !cur || !kit) return;
    const now = ctx.currentTime;
    const p = cur;
    if (p.nextTime < now - 0.25) p.nextTime = now + 0.03; // tab was throttled: resync
    while (p.nextTime < now + LOOKAHEAD) {
      if (!p.comp.def.loop && p.step >= p.comp.length) break;
      for (const e of eventsAtStep(p.comp, p.step)) {
        const v = playVoice(kit, p.bus, p.nextTime, noteSpec(e));
        p.voices.add(v);
        v.onEnd = () => p.voices.delete(v);
      }
      p.step++;
      p.nextTime += p.comp.stepSec;
    }
    if (!p.comp.def.loop && p.step >= p.comp.length && p.voices.size === 0) cur = null;
  }

  function applyMute(): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(muted ? 0 : 0.6, now);
  }

  function applyHum(): void {
    if (!ctx) return;
    if (!humNodes) {
      if (!wantHum) return;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      gain.connect(lp);
      lp.connect(sfxBus);
      const oscs = [55, 110.7, 164.5].map((f, i) => {
        const o = ctx!.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        const og = ctx!.createGain();
        og.gain.value = i === 0 ? 1 : 0.25;
        o.connect(og);
        og.connect(gain);
        o.start();
        return o;
      });
      humNodes = { gain, oscs };
    }
    const now = ctx.currentTime;
    humNodes.gain.gain.cancelScheduledValues(now);
    humNodes.gain.gain.setTargetAtTime(wantHum ? 0.16 : 0, now, 0.08);
  }

  const api: AudioApi = {
    resume() {
      if (!init() || !ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (pendingMusic && wantedMusic) { pendingMusic = false; startMusic(wantedMusic); }
      applyHum();
    },
    sfx(name) {
      if (!ctx || !kit || muted) return;
      const defs = SFX[name];
      if (!defs) return;
      const now = ctx.currentTime;
      for (let i = sfxGroups.length - 1; i >= 0; i--) if (sfxGroups[i]!.end < now) sfxGroups.splice(i, 1);
      while (sfxGroups.length >= MAX_SFX) for (const v of sfxGroups.shift()!.voices) v.cut(now);
      const voices = defs.map((d) => playVoice(kit!, sfxBus, now + 0.005, d));
      sfxGroups.push({ voices, end: Math.max(...voices.map((v) => v.end)) });
    },
    music(name) {
      wantedMusic = name;
      if (!ctx) { pendingMusic = name !== null; return; }
      pendingMusic = false;
      if (name === null) { stopMusic(); return; }
      if (cur && cur.name === name && SONGS[name].loop) return;
      startMusic(name);
    },
    setMusicDuck(on) {
      ducked = on;
      if (!ctx) return;
      const now = ctx.currentTime;
      duckGain.gain.cancelScheduledValues(now);
      duckGain.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, now, 0.03);
    },
    setMuted(m) { muted = m; applyMute(); },
    toggleMute() { muted = !muted; applyMute(); return muted; },
    get muted() { return muted; },
    hum(on) { wantHum = on; applyHum(); },
    handleEvent(ev) {
      if (ev.t === 'sfx') api.sfx(ev.name);
      else if (ev.t === 'music') api.music(ev.name);
    },
  };
  return api;
}

export { isJingle };
