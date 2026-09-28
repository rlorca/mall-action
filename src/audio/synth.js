import { parseTrack } from './notes.js';
import { TRACKS } from './music.js';
import { SFX } from './sfx.js';

function pulseWave(ctx, duty) {
  const n = 64, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}
function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function createSynth() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  const noop = { unlock() {}, playMusic() {}, stopMusic() {}, sfx() {}, toggleMute() {}, duck() {}, muted: false, musicName: null };
  if (!AC) return noop;
  let ctx;
  try { ctx = new AC(); } catch { return noop; }

  const master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.connect(master);
  const sfxBus = ctx.createGain(); sfxBus.connect(master);
  const lib = { pulse12: pulseWave(ctx, 0.125), pulse25: pulseWave(ctx, 0.25), pulse50: pulseWave(ctx, 0.5), noise: noiseBuffer(ctx) };

  function tone(wave, freq, t, dur, vol, out = musicBus) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (wave === 'triangle') o.type = 'triangle'; else o.setPeriodicWave(lib[wave]);
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(kind, t, out = musicBus) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = lib.noise; f.type = kind === 'K' ? 'lowpass' : 'highpass'; f.frequency.value = kind === 'K' ? 200 : kind === 'X' ? 1500 : 7000;
    const dur = kind === 'x' ? 0.04 : 0.12;
    g.gain.setValueAtTime(kind === 'x' ? 0.15 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur);
  }

  let song = null, timer = null;
  const CH = { p1: ['pulse25', 0.12], p2: ['pulse12', 0.08], tri: ['triangle', 0.25] };

  function schedule() {
    if (!song) return;
    const stepDur = 60 / song.track.bpm / 4;
    for (const ch of song.channels) {
      while (ch.next < ctx.currentTime + 0.15) {
        if (ch.i >= ch.notes.length) {
          if (!song.track.loop) { ch.done = true; break; }
          ch.i = 0;
        }
        const n = ch.notes[ch.i++]; const dur = n.len * stepDur;
        if (ch.name === 'noise') { if (n.note) hit(n.note, ch.next); }
        else if (n.freq) tone(CH[ch.name][0], n.freq, ch.next, dur * 0.95, CH[ch.name][1]);
        ch.next += dur;
      }
    }
    if (song.channels.every((c) => c.done)) stopMusic();
  }

  function playMusic(name) {
    if (song?.name === name) return;
    stopMusic();
    const track = TRACKS[name]; if (!track) return;
    const t0 = ctx.currentTime + 0.05;
    const channels = ['p1', 'p2', 'tri', 'noise'].filter((c) => track[c]).map((c) => ({ name: c, notes: parseTrack(track[c]), i: 0, next: t0, done: false }));
    song = { name, track, channels };
    api.musicName = name;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
    timer = setInterval(schedule, 25); schedule();
  }
  function stopMusic() { clearInterval(timer); timer = null; song = null; api.musicName = null; }

  const api = {
    muted: false, musicName: null,
    unlock() { if (ctx.state === 'suspended') ctx.resume(); },
    playMusic, stopMusic,
    sfx(name) { const f = SFX[name]; if (f && ctx.state === 'running') f(ctx, sfxBus, ctx.currentTime, { ...lib, tone: (w, fr, t, d, v) => tone(w, fr, t, d, v, sfxBus), hit: (k, t) => hit(k, t, sfxBus) }); },
    toggleMute() { api.muted = !api.muted; master.gain.value = api.muted ? 0 : 0.35; },
    duck(on) { musicBus.gain.setTargetAtTime(on ? 0.25 : 1, ctx.currentTime, 0.05); },
  };
  return api;
}
