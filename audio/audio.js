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
/*
 * HOST API (browser glue, for browser.js). Plain ES module, no dependencies. Transpiled from the TypeScript
 * AudioEngine with small integer adaptations so the Rust/WASM core can pass numbers.
 *
 *   import { AudioEngine } from './audio/audio.js';
 *   const audio = new AudioEngine();   // creates nothing yet: silent, safe no-op without Web Audio
 *   audio.unlock();                    // call from a user gesture (key/click); creates the AudioContext, idempotent,
 *                                      // also resumes a suspended context
 *   audio.playSfx(index);              // sound effect: index into SFX_IDS (ids.js; Rust SfxId::index()).
 *                                      // (a string id or `sfx(id)` also works)
 *   audio.setMusic(index);             // music: 0 = silence, n = MUSIC_IDS[n-1] (Rust MusicId index+1).
 *                                      // Safe to call every frame (same value = no restart). A string id or null
 *                                      // is also accepted. Requested before unlock(): starts at unlock (jingles
 *                                      // requested before unlock are skipped).
 *   audio.setDuck(bool);               // pause = music turned down to 30%, sfx unaffected
 *   audio.setMuted(bool);              // mute / unmute everything (master gain)
 *   audio.toggleMute();                // flips mute, returns the new muted state
 *   audio.isMuted();                   // boolean
 *   audio.musicPlaying();              // current MusicId string while audible, else null (jingles become null
 *                                      // once played out: poll this to see that a jingle has finished)
 *   audio.musicPlayingIndex();         // same as musicPlaying() but as 0 (nothing) / index+1
 *
 * Scheduling uses setInterval against AudioContext.currentTime (never requestAnimationFrame). Failures in Web
 * Audio switch audio off silently; the game keeps running.
 * Index arrays: ids.js exports SFX_IDS and MUSIC_IDS (fixed order; mirrored by src/audio_ids.rs).
 */
import { JINGLE_IDS, MUSIC_IDS, SFX_IDS } from './ids.js';
import { MASTER_GAIN } from './mix.js';
import { eventsBetween } from './sequencer.js';
import { SFX, sfxPoly } from './sfx.js';
import { getSong } from './songs/index.js';
import { Synth } from './synth.js';
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
export class AudioEngine {
    ctx = null;
    synth = null;
    timer = null;
    failed = false;
    /** Consecutive Web Audio exceptions; a transient one is ignored, a persistent run switches audio off. */
    errors = 0;
    selected = null;
    /** The selected track is a jingle that has played out (or was skipped before unlock). */
    selectedDone = false;
    muted = false;
    ducked = false;
    player = null;
    fading = [];
    voices = [];
    lastSfxStart = new Map();
    constructor() {
        // Nothing to do: the AudioContext is created on unlock().
    }
    /** Create / resume the AudioContext. Call from a user-input handler; safe to call on every input. */
    unlock() {
        if (this.failed)
            return;
        try {
            if (this.ctx) {
                if (this.ctx.state !== 'running')
                    this.resume();
                return;
            }
            const g = globalThis;
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
                if (isJingle(this.selected))
                    this.selectedDone = true;
                else
                    this.startPlayer(this.selected, false);
            }
        }
        catch {
            this.fail();
        }
    }
    /** Select the background track (null = silence). Same id as already selected: no restart. */
    setMusic(id) {
        if (typeof id === 'number')
            id = id >= 1 && id <= MUSIC_IDS.length ? MUSIC_IDS[id - 1] : null;
        if (id === this.selected)
            return;
        this.selected = id;
        // Without a working AudioContext a jingle can never be heard, so it counts as already played out.
        this.selectedDone = this.failed && id !== null && isJingle(id);
        if (!this.synth)
            return;
        try {
            if (id === null) {
                this.stopPlayer(FADE_OUT);
            }
            else {
                this.startPlayer(id, true);
            }
        }
        catch {
            this.fail();
        }
    }
    /** Pause = music turned down (the sfx stay at full level). */
    setDuck(on) {
        this.ducked = on;
        this.applyDuck(false);
    }
    /** Play a sound effect now. */
    sfx(id) {
        if (typeof id === 'number')
            id = SFX_IDS[id];
        if (id === undefined)
            return;
        const synth = this.synth;
        const ctx = this.ctx;
        if (!synth || !ctx || this.muted)
            return;
        try {
            const def = SFX[id];
            if (!def)
                return;
            const now = ctx.currentTime;
            this.pruneVoices(now);
            const last = this.lastSfxStart.get(id);
            if (last !== undefined && now - last < MIN_SFX_RETRIGGER && now >= last)
                return;
            // Per-effect polyphony: cut the oldest copies of the same effect.
            const same = this.voices.filter((v) => v.id === id);
            for (let i = 0; i <= same.length - sfxPoly(def); i++)
                this.dropVoice(same[i], now);
            // Global cap: cut the oldest voices overall.
            while (this.voices.length >= MAX_SFX_VOICES)
                this.dropVoice(this.voices[0], now);
            this.voices.push(synth.playSfx(def, now + 0.005));
            this.lastSfxStart.set(id, now);
            this.errors = 0;
        }
        catch {
            this.noteError();
        }
    }
    setMuted(m) {
        this.muted = m;
        this.applyMute();
        if (m && this.synth) {
            const now = this.ctx.currentTime;
            for (const v of this.voices)
                this.synth.stopVoice(v, now);
        }
    }
    /** Index form of sfx(): index into SFX_IDS. */
    playSfx(index) {
        this.sfx(index);
    }
    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }
    /** musicPlaying() as 0 (nothing) / MUSIC_IDS index + 1. */
    musicPlayingIndex() {
        const id = this.musicPlaying();
        return id === null ? 0 : MUSIC_IDS.indexOf(id) + 1;
    }
    isMuted() {
        return this.muted;
    }
    /** The selected track while it is audible (loops: always; jingles: until they have played out), else null. */
    musicPlaying() {
        if (this.selected === null || this.selectedDone)
            return null;
        return this.selected;
    }
    // -------------------------------------------------------------------------------------------
    resume() {
        const p = this.ctx?.resume();
        if (p)
            p.catch(() => undefined);
    }
    noteError() {
        if (++this.errors >= 100)
            this.fail();
    }
    fail() {
        this.failed = true;
        if (this.selected && isJingle(this.selected))
            this.selectedDone = true;
        if (this.timer !== null)
            clearInterval(this.timer);
        this.timer = null;
        try {
            void this.ctx?.close();
        }
        catch {
            /* ignore */
        }
        this.ctx = null;
        this.synth = null;
        this.player = null;
        this.fading = [];
        this.voices = [];
    }
    applyMute() {
        const s = this.synth;
        if (!s || !this.ctx)
            return;
        s.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.01);
    }
    applyDuck(immediate) {
        const s = this.synth;
        if (!s || !this.ctx)
            return;
        const target = this.ducked ? DUCK_LEVEL : 1;
        if (immediate)
            s.musicBus.gain.setValueAtTime(target, this.ctx.currentTime);
        else
            s.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
    startPlayer(id, crossfade) {
        const synth = this.synth;
        const ctx = this.ctx;
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
    stopPlayer(fade) {
        const p = this.player;
        const ctx = this.ctx;
        this.player = null;
        if (!p || !ctx)
            return;
        const now = ctx.currentTime;
        if (fade > 0) {
            p.bus.gain.cancelScheduledValues(now);
            p.bus.gain.setValueAtTime(p.bus.gain.value, now);
            p.bus.gain.linearRampToValueAtTime(0, now + fade);
            this.fading.push({ bus: p.bus, until: now + fade + 0.4 });
        }
        else {
            p.bus.gain.cancelScheduledValues(now);
            p.bus.gain.setValueAtTime(0, now);
            this.fading.push({ bus: p.bus, until: now + 0.4 });
        }
    }
    dropVoice(v, now) {
        this.synth?.stopVoice(v, now);
        this.voices = this.voices.filter((x) => x !== v);
        // Its bus is disconnected shortly afterwards by pruneVoices via the `fading` list.
        this.fading.push({ bus: v.bus, until: now + 0.1 });
    }
    pruneVoices(now) {
        if (this.voices.length === 0)
            return;
        const keep = [];
        for (const v of this.voices) {
            if (v.end > now)
                keep.push(v);
            else
                this.synth?.releaseVoice(v);
        }
        this.voices = keep;
    }
    /** Scheduler: hand every note starting before `now + LOOKAHEAD` to the synth, and tidy up. */
    tick() {
        const ctx = this.ctx;
        const synth = this.synth;
        if (!ctx || !synth)
            return;
        try {
            const now = ctx.currentTime;
            // Dispose faded-out buses and finished sfx voices.
            if (this.fading.length > 0) {
                this.fading = this.fading.filter((f) => {
                    if (f.until > now)
                        return true;
                    try {
                        f.bus.disconnect();
                    }
                    catch {
                        /* already gone */
                    }
                    return false;
                });
            }
            this.pruneVoices(now);
            const p = this.player;
            if (!p || p.finished)
                return;
            const upTo = now + LOOKAHEAD - p.startTime;
            if (upTo > p.cursor) {
                // Stale events (the tab was backgrounded and the timer throttled) are skipped, not dumped in a burst.
                const evs = eventsBetween(p.song, p.cursor, upTo);
                if (!this.muted) {
                    for (const { event, time } of evs) {
                        const when = p.startTime + time;
                        if (when < now - 0.05)
                            continue;
                        try {
                            synth.playEvent(p.bus, p.song, event, Math.max(when, now));
                            this.errors = 0;
                        }
                        catch {
                            this.noteError(); // one bad note must not silence the session
                        }
                    }
                }
                p.cursor = upTo;
            }
            if (!p.song.loop && now >= p.startTime + p.song.duration + JINGLE_TAIL) {
                p.finished = true;
                if (this.selected === p.id)
                    this.selectedDone = true;
                this.fading.push({ bus: p.bus, until: now + 0.1 });
            }
        }
        catch {
            this.fail();
        }
    }
}
const JINGLES = new Set(JINGLE_IDS);
function isJingle(id) {
    return JINGLES.has(id);
}
