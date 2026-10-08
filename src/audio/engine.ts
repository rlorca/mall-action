// Web Audio, imitating the NES: two pulse waves, a triangle and noise. Silent until the first
// user input (autoplay rules). If audio can't start, every call is a harmless no-op.
import type { SfxName } from '../core/events';
import type { MusicTrack } from '../core/game';
import { hz, midi } from './notes';
import { SONG_FOR_TRACK, storeSong, type Song } from './songs';

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

type Voice = 'pulse1' | 'pulse2' | 'tri' | 'noise';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private humNode: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private track: MusicTrack = 'silent';
  private seq: { song: Song; step: number; nextT: number; timer: number } | null = null;

  /** Call from a user gesture (any key or button). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.35;
        this.musicBus.connect(this.master);
        this.noiseBuf = this.makeNoise();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.track !== 'silent' && !this.seq) this.startTrack(this.track);
    } catch {
      this.ctx = null; // the game carries on without sound
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Changes the background music. Re-selecting the same track does nothing. */
  setMusic(track: MusicTrack): void {
    if (track === this.track) return;
    this.track = track;
    this.stopTrack();
    if (track !== 'silent') this.startTrack(track);
  }

  /** The elevator hum, on while riding a car. */
  setHum(on: boolean): void {
    if (!this.ctx || !this.master) return;
    if (on && !this.humNode) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 58;
      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      this.humNode = osc;
      this.humGain = g;
    } else if (!on && this.humNode) {
      this.humNode.stop();
      this.humNode.disconnect();
      this.humGain?.disconnect();
      this.humNode = null;
      this.humGain = null;
    }
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running') return;
    const sfx = SFX[name];
    if (!sfx) return;
    const t = this.ctx.currentTime;
    for (const note of sfx(this.ctx.currentTime)) this.voice(note, t);
  }

  // ------------------------------------------------------------ sequencer

  private startTrack(track: MusicTrack): void {
    if (!this.ctx) return;
    const song = track.startsWith('store:')
      ? storeSong(track.slice('store:'.length))
      : SONG_FOR_TRACK[track]?.();
    if (!song) return;
    const seq = { song, step: 0, nextT: this.ctx.currentTime + 0.05, timer: 0 };
    this.seq = seq;
    seq.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  private stopTrack(): void {
    if (this.seq) window.clearInterval(this.seq.timer);
    this.seq = null;
  }

  /** Lookahead scheduler: plays steps a little before they are due, so timing stays steady. */
  private schedule(): void {
    const seq = this.seq;
    const ctx = this.ctx;
    if (!seq || !ctx || !this.musicBus) return;
    const stepS = (60 / seq.song.bpm) / 2; // 8th-note steps
    const longest = Math.max(...[seq.song.lead, seq.song.arp, seq.song.bass, seq.song.pad, seq.song.drum].map((t) => t?.length ?? 0));
    if (longest === 0) return;
    while (seq.nextT < ctx.currentTime + LOOKAHEAD_S) {
      const i = seq.step % longest;
      if (seq.step >= longest && seq.song.loop === false) {
        this.stopTrack();
        return;
      }
      this.playStep(seq.song, i, seq.nextT, stepS);
      seq.nextT += stepS;
      seq.step++;
    }
  }

  private playStep(song: Song, i: number, t: number, dur: number): void {
    const tracks: [Voice, string[] | undefined, number][] = [
      ['pulse1', song.lead, 0.22],
      ['pulse2', song.arp, 0.1],
      ['tri', song.bass, 0.3],
      ['tri', song.pad, 0.12],
      ['noise', song.drum, 0.14],
    ];
    for (const [voice, track, vol] of tracks) {
      if (!track || track.length === 0) continue;
      const tok = track[i % track.length];
      if (tok === '-' || tok === '.') continue;
      if (voice === 'noise') this.noiseHit(t, vol, dur * 0.8);
      else {
        const m = midi(tok);
        if (m === null) continue;
        this.note(voice, hz(m), t, dur * 0.9, vol);
      }
    }
  }

  // ------------------------------------------------------------ voices

  private voice(n: Note, t: number): void {
    if (n.kind === 'noise') this.noiseHit(t + n.at, n.vol, n.dur);
    else this.note(n.kind, n.hz, t + n.at, n.dur, n.vol, n.slide);
  }

  private note(voice: Exclude<Voice, 'noise'>, freq: number, t: number, dur: number, vol: number, slide = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    // Pulse channels are square waves (50% duty); the second pulse is quieter, like a 25% duty.
    osc.type = voice === 'tri' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, dur));
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noiseHit(t: number, vol: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.musicBus) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = this.noiseBuf;
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, dur));
    src.connect(g);
    g.connect(this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let r = 0x1234567;
    for (let i = 0; i < d.length; i++) {
      r ^= r << 13;
      r ^= r >>> 17;
      r ^= r << 5;
      d[i] = ((r >>> 0) / 4294967296) * 2 - 1;
    }
    return buf;
  }
}

type Note =
  | { kind: Exclude<Voice, 'noise'>; hz: number; at: number; dur: number; vol: number; slide?: number }
  | { kind: 'noise'; at: number; dur: number; vol: number };

const N = (kind: Exclude<Voice, 'noise'>, f: number, at: number, dur: number, vol = 0.25, slide = 0): Note => ({ kind, hz: f, at, dur, vol, slide });
const NZ = (at: number, dur: number, vol = 0.25): Note => ({ kind: 'noise', at, dur, vol });

/** Sound effects, built from the channels. Each returns its notes relative to "now". */
const SFX: Partial<Record<SfxName, (t: number) => Note[]>> = {
  shot: () => [N('pulse1', 1200, 0, 0.08, 0.25, -900)],
  enemyShot: () => [N('pulse2', 500, 0, 0.12, 0.2, -300)],
  jump: () => [N('pulse1', 300, 0, 0.12, 0.2, 600)],
  ding: () => [N('tri', 880, 0, 0.12, 0.3), N('tri', 1320, 0.1, 0.25, 0.3)],
  crush: () => [NZ(0, 0.35, 0.35), N('tri', 90, 0, 0.3, 0.3, -60)],
  lamp: () => [NZ(0, 0.25, 0.3), N('tri', 220, 0, 0.2, 0.2, -120)],
  glass: () => [NZ(0, 0.12, 0.25), N('pulse2', 2600, 0, 0.1, 0.12, 800)],
  search: () => [N('pulse2', 880, 0, 0.03, 0.12)],
  package: () => [0, 0.08, 0.16, 0.24].map((at, i) => N('pulse1', [523, 659, 784, 1046][i], at, 0.14, 0.25)).concat([N('tri', 523, 0.32, 0.5, 0.3)]),
  powerup: () => [0, 0.06, 0.12, 0.18].map((at, i) => N('pulse1', [392, 523, 659, 784][i], at, 0.1, 0.22)),
  hurt: () => [NZ(0, 0.18, 0.3), N('pulse1', 180, 0, 0.18, 0.2, -120)],
  death: () => [N('pulse1', 620, 0, 0.9, 0.25, -560), NZ(0.7, 0.2, 0.15)],
  door: () => [NZ(0, 0.07, 0.2), N('tri', 140, 0, 0.1, 0.2)],
  blip: () => [N('pulse2', 660, 0, 0.05, 0.14)],
  whistle: () => [N('pulse1', 2100, 0, 0.5, 0.15, -200)],
  ping: () => [N('tri', 1800, 0, 0.08, 0.2, 400)],
  coin: () => [N('pulse1', 988, 0, 0.08, 0.2), N('pulse1', 1319, 0.08, 0.3, 0.2)],
  zip: () => [N('pulse2', 300, 0, 0.9, 0.12, 1400)],
  thud: () => [NZ(0, 0.12, 0.3), N('tri', 70, 0, 0.14, 0.3)],
  pa: () => [N('tri', 880, 0, 0.5, 0.25), N('tri', 660, 0.5, 0.7, 0.25)],
  smoke: () => [NZ(0, 0.4, 0.12)],
  shriek: () => [N('pulse1', 900, 0, 0.5, 0.22, 900)],
  buzzer: () => [N('pulse2', 150, 0, 0.5, 0.2)],
  pause: () => [N('pulse2', 440, 0, 0.08, 0.2), N('pulse2', 330, 0.1, 0.12, 0.2)],
  selfie: () => [NZ(0, 0.06, 0.25)],
  kick: () => [NZ(0, 0.08, 0.3), N('tri', 120, 0, 0.1, 0.25)],
  extraLife: () => [0, 0.08, 0.16, 0.24, 0.32].map((at, i) => N('pulse1', [523, 659, 784, 1046, 1318][i], at, 0.12, 0.25)),
  itemGet: () => [0, 0.1, 0.2, 0.3].map((at, i) => N('pulse1', [784, 988, 1175, 1568][i], at, 0.14, 0.25)),
  alarm: () => [N('pulse1', 700, 0, 0.6, 0.2, 500), N('pulse1', 500, 0.6, 0.6, 0.2, 400)],
  mop: () => [NZ(0, 0.3, 0.1)],
  flash: () => [NZ(0, 0.05, 0.4), N('pulse2', 3200, 0, 0.05, 0.2)],
  pop: () => [N('pulse2', 1100, 0, 0.04, 0.16, -600)],
  levelClear: () => [0, 0.12, 0.24, 0.36, 0.48].map((at, i) => N('pulse1', [523, 659, 784, 1046, 1318][i], at, 0.16, 0.25)),
  gameOver: () => [N('pulse1', 392, 0, 0.5, 0.2), N('pulse1', 330, 0.5, 0.5, 0.2), N('pulse1', 262, 1, 1.0, 0.2)],
};
