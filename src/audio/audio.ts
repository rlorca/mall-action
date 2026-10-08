/**
 * AudioEngine: the one object the game talks to. Owns the AudioContext (created lazily on `unlock()`, i.e. after
 * the first user input), a lookahead scheduler for the current song and a small pool of sfx voices.
 *
 * Rules it keeps:
 *  - Silent until `unlock()`. The requested track is remembered, so `setMusic('title')` before the first key press
 *    starts playing the moment the context unlocks. A *jingle* requested before unlock is skipped (it would be
 *    stale by then) and counts as already finished.
 *  - If there is no AudioContext, or it throws, every method is a safe no-op and the game runs on.
 *  - Scheduling is driven by setInterval against `AudioContext.currentTime`, never requestAnimationFrame, so music
 *    does not stutter when the render loop stalls.
 *  - `setMusic(id)` with the id that is already selected does nothing (safe to call every frame). A jingle that
 *    has finished stays finished until a different id (or null) is selected.
 */
import { JINGLE_IDS, type MusicId, type SfxId } from './ids';
import { MASTER_GAIN } from './mix';
import { eventsBetween } from './sequencer';
import { SFX, sfxPoly } from './sfx';
import type { CompiledSong } from './song';
import { getSong } from './songs';
import { type SfxVoice, Synth } from './synth';

/** Scheduler tick and how far ahead of the clock notes are handed to Web Audio. */
const TICK_MS = 40;
const LOOKAHEAD = 0.25;
/** Music level while the game is paused (setDuck). */
const DUCK_LEVEL = 0.3;
/** Crossfade out of the previous track, and the quick fade-in of the new one. */
const FADE_OUT = 0.12;
const FADE_OUT_FOR_JINGLE = 0.04;
const FADE_IN = 0.03;
/** Sfx limits. */
const MAX_SFX_VOICES = 10;
/** Same sfx retriggered within this many seconds is ignored (stops per-frame spam from stacking up). */
const MIN_SFX_RETRIGGER = 0.03;
/** Tail allowed after a jingle's last note before it counts as finished. */
const JINGLE_TAIL = 0.35;

interface Player {
  readonly id: MusicId;
  readonly song: CompiledSong;
  readonly bus: GainNode;
  /** ctx time at which song time 0 plays. */
  readonly startTime: number;
  /** Song-time (seconds since start) scheduled so far. */
  cursor: number;
  finished: boolean;
}

interface AudioContextCtor {
  new (): AudioContext;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failed = false;
  /** Consecutive Web Audio exceptions; a transient one is ignored, a persistent run switches audio off. */
  private errors = 0;

  private selected: MusicId | null = null;
  /** The selected track is a jingle that has played out (or was skipped before unlock). */
  private selectedDone = false;
  private muted = false;
  private ducked = false;

  private player: Player | null = null;
  private fading: { bus: GainNode; until: number }[] = [];
  private voices: SfxVoice[] = [];
  private lastSfxStart = new Map<string, number>();

  constructor() {
    // Nothing to do: the AudioContext is created on unlock().
  }

  /** Create / resume the AudioContext. Call from a user-input handler; safe to call on every input. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (this.ctx) {
        if (this.ctx.state !== 'running') this.resume();
        return;
      }
      const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }
      const ctx = new Ctor();
      this.ctx = ctx;
      this.synth = new Synth(ctx);
      this.applyMute();
      this.applyDuck(true);
      this.resume();
      this.timer = setInterval(() => this.tick(), TICK_MS);
      // A jingle asked for before the first input is stale now; loops start from the top.
      if (this.selected) {
        if (isJingle(this.selected)) this.selectedDone = true;
        else this.startPlayer(this.selected, false);
      }
    } catch {
      this.fail();
    }
  }

  /** Select the background track (null = silence). Same id as already selected: no restart. */
  setMusic(id: MusicId | null): void {
    if (id === this.selected) return;
    this.selected = id;
    // Without a working AudioContext a jingle can never be heard, so it counts as already played out.
    this.selectedDone = this.failed && id !== null && isJingle(id);
    if (!this.synth) return;
    try {
      if (id === null) {
        this.stopPlayer(FADE_OUT);
      } else {
        this.startPlayer(id, true);
      }
    } catch {
      this.fail();
    }
  }

  /** Pause = music turned down (the sfx stay at full level). */
  setDuck(on: boolean): void {
    this.ducked = on;
    this.applyDuck(false);
  }

  /** Play a sound effect now. */
  sfx(id: SfxId): void {
    const synth = this.synth;
    const ctx = this.ctx;
    if (!synth || !ctx || this.muted) return;
    try {
      const def = SFX[id];
      if (!def) return;
      const now = ctx.currentTime;
      this.pruneVoices(now);
      const last = this.lastSfxStart.get(id);
      if (last !== undefined && now - last < MIN_SFX_RETRIGGER && now >= last) return;
      // Per-effect polyphony: cut the oldest copies of the same effect.
      const same = this.voices.filter((v) => v.id === id);
      for (let i = 0; i <= same.length - sfxPoly(def); i++) this.dropVoice(same[i]!, now);
      // Global cap: cut the oldest voices overall.
      while (this.voices.length >= MAX_SFX_VOICES) this.dropVoice(this.voices[0]!, now);
      this.voices.push(synth.playSfx(def, now + 0.005));
      this.lastSfxStart.set(id, now);
      this.errors = 0;
    } catch {
      this.noteError();
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMute();
    if (m && this.synth) {
      const now = this.ctx!.currentTime;
      for (const v of this.voices) this.synth.stopVoice(v, now);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** The selected track while it is audible (loops: always; jingles: until they have played out), else null. */
  musicPlaying(): MusicId | null {
    if (this.selected === null || this.selectedDone) return null;
    return this.selected;
  }

  // -------------------------------------------------------------------------------------------

  private resume(): void {
    const p = this.ctx?.resume();
    if (p) p.catch(() => undefined);
  }

  private noteError(): void {
    if (++this.errors >= 100) this.fail();
  }

  private fail(): void {
    this.failed = true;
    if (this.selected && isJingle(this.selected)) this.selectedDone = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.synth = null;
    this.player = null;
    this.fading = [];
    this.voices = [];
  }

  private applyMute(): void {
    const s = this.synth;
    if (!s || !this.ctx) return;
    s.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.01);
  }

  private applyDuck(immediate: boolean): void {
    const s = this.synth;
    if (!s || !this.ctx) return;
    const target = this.ducked ? DUCK_LEVEL : 1;
    if (immediate) s.musicBus.gain.setValueAtTime(target, this.ctx.currentTime);
    else s.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  private startPlayer(id: MusicId, crossfade: boolean): void {
    const synth = this.synth!;
    const ctx = this.ctx!;
    const song = getSong(id);
    this.stopPlayer(crossfade ? (song.loop ? FADE_OUT : FADE_OUT_FOR_JINGLE) : 0);
    const bus = synth.createSongBus();
    const now = ctx.currentTime;
    if (crossfade) {
      bus.gain.setValueAtTime(0, now);
      bus.gain.linearRampToValueAtTime(1, now + FADE_IN);
    }
    this.player = { id, song, bus, startTime: now + 0.06, cursor: 0, finished: false };
    this.tick();
  }

  private stopPlayer(fade: number): void {
    const p = this.player;
    const ctx = this.ctx;
    this.player = null;
    if (!p || !ctx) return;
    const now = ctx.currentTime;
    if (fade > 0) {
      p.bus.gain.cancelScheduledValues(now);
      p.bus.gain.setValueAtTime(p.bus.gain.value, now);
      p.bus.gain.linearRampToValueAtTime(0, now + fade);
      this.fading.push({ bus: p.bus, until: now + fade + 0.4 });
    } else {
      p.bus.gain.cancelScheduledValues(now);
      p.bus.gain.setValueAtTime(0, now);
      this.fading.push({ bus: p.bus, until: now + 0.4 });
    }
  }

  private dropVoice(v: SfxVoice, now: number): void {
    this.synth?.stopVoice(v, now);
    this.voices = this.voices.filter((x) => x !== v);
    // Its bus is disconnected shortly afterwards by pruneVoices via the `fading` list.
    this.fading.push({ bus: v.bus, until: now + 0.1 });
  }

  private pruneVoices(now: number): void {
    if (this.voices.length === 0) return;
    const keep: SfxVoice[] = [];
    for (const v of this.voices) {
      if (v.end > now) keep.push(v);
      else this.synth?.releaseVoice(v);
    }
    this.voices = keep;
  }

  /** Scheduler: hand every note starting before `now + LOOKAHEAD` to the synth, and tidy up. */
  private tick(): void {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth) return;
    try {
      const now = ctx.currentTime;

      // Dispose faded-out buses and finished sfx voices.
      if (this.fading.length > 0) {
        this.fading = this.fading.filter((f) => {
          if (f.until > now) return true;
          try {
            f.bus.disconnect();
          } catch {
            /* already gone */
          }
          return false;
        });
      }
      this.pruneVoices(now);

      const p = this.player;
      if (!p || p.finished) return;
      const upTo = now + LOOKAHEAD - p.startTime;
      if (upTo > p.cursor) {
        // Stale events (the tab was backgrounded and the timer throttled) are skipped, not dumped in a burst.
        const evs = eventsBetween(p.song, p.cursor, upTo);
        if (!this.muted) {
          for (const { event, time } of evs) {
            const when = p.startTime + time;
            if (when < now - 0.05) continue;
            try {
              synth.playEvent(p.bus, p.song, event, Math.max(when, now));
              this.errors = 0;
            } catch {
              this.noteError(); // one bad note must not silence the session
            }
          }
        }
        p.cursor = upTo;
      }
      if (!p.song.loop && now >= p.startTime + p.song.duration + JINGLE_TAIL) {
        p.finished = true;
        if (this.selected === p.id) this.selectedDone = true;
        this.fading.push({ bus: p.bus, until: now + 0.1 });
      }
    } catch {
      this.fail();
    }
  }
}

const JINGLES = new Set<string>(JINGLE_IDS);
function isJingle(id: MusicId): boolean {
  return JINGLES.has(id);
}
