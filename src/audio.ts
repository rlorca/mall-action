import type { Game } from "./game";
const notes = [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 7, 14, 19, 14];
// Original sixteen-step motifs. Pulse leads, second pulse harmony, triangle bass, noise percussion.
const tracks: Record<
  string,
  {
    root: number;
    tempo: number;
    pattern: number[];
    volume: number;
    duty: number;
  }
> = {
  title: {
    root: 60,
    tempo: 12,
    pattern: [0, 4, 7, 12, 11, 7, 4, 7, 2, 5, 9, 14, 12, 9, 7, 4],
    volume: 0.065,
    duty: 0.25,
  },
  mall: {
    root: 48,
    tempo: 42,
    pattern: [0, -1, -1, -1, 7, -1, -1, -1, 3, -1, -1, -1, 10, -1, -1, -1],
    volume: 0.015,
    duty: 0.125,
  },
  alarm: {
    root: 53,
    tempo: 7,
    pattern: [0, 1, 7, 1, 0, 1, 10, 7, 0, 1, 7, 1, 12, 10, 7, 1],
    volume: 0.05,
    duty: 0.125,
  },
  elevator: {
    root: 60,
    tempo: 18,
    pattern: [0, 4, 7, 9, 7, 4, 2, 4, 5, 9, 12, 14, 12, 9, 7, 4],
    volume: 0.035,
    duty: 0.5,
  },
  bonus: {
    root: 64,
    tempo: 9,
    pattern: [0, 7, 4, 12, 9, 7, 4, 2, 5, 12, 9, 17, 14, 12, 9, 7],
    volume: 0.05,
    duty: 0.25,
  },
};
const roots = [60, 65, 72, 55, 67, 58, 62, 57, 64, 61];
const storeIds = [0, 1, 4, 9, 11, 7, 2, 8, 6, 3];
storeIds.forEach(
  (id, i) =>
    (tracks["store" + id] = {
      root: roots[i],
      tempo: [10, 7, 18, 8, 12, 8, 15, 28, 10, 6][i],
      pattern: notes.map((n, j) => (n + i * (j % 3)) % 20),
      volume: 0.045,
      duty: i % 2 ? 0.125 : 0.25,
    }),
);
tracks.store4.pattern = tracks.store4.pattern.slice(0, 12);
const sound: Record<string, [number, number, number, string]> = {
  text: [900, 900, 0.02, "square"],
  shot: [900, 120, 0.055, "noise"],
  enemy: [330, 80, 0.075, "square"],
  jump: [180, 540, 0.12, "square"],
  ding: [1244, 1244, 0.25, "triangle"],
  land: [90, 35, 0.1, "noise"],
  crush: [150, 30, 0.2, "noise"],
  lamp: [500, 70, 0.25, "noise"],
  glass: [1800, 100, 0.18, "noise"],
  search: [700, 740, 0.025, "square"],
  package: [523, 1046, 0.45, "square"],
  power: [440, 880, 0.22, "square"],
  hurt: [160, 90, 0.12, "noise"],
  death: [360, 30, 0.45, "square"],
  door: [90, 140, 0.12, "noise"],
  whistle: [1700, 2100, 0.2, "sine"],
  ping: [1300, 1700, 0.12, "triangle"],
  coin: [1200, 1500, 0.09, "square"],
  slide: [70, 150, 0.07, "noise"],
  zip: [1200, 200, 0.8, "noise"],
  chime: [660, 990, 0.35, "triangle"],
  smoke: [250, 50, 0.15, "noise"],
  shriek: [800, 1600, 0.2, "square"],
  buzzer: [110, 80, 0.3, "square"],
  pause: [440, 660, 0.08, "triangle"],
  beep: [880, 880, 0.08, "square"],
  camera: [1000, 50, 0.1, "noise"],
  item: [660, 1320, 0.4, "square"],
  jingle: [523, 1046, 0.7, "square"],
  clear: [440, 880, 0.7, "square"],
  gameover: [330, 82, 0.8, "triangle"],
  toy: [420, 840, 0.1, "square"],
  call: [300, 400, 0.08, "triangle"],
  alarm: [880, 440, 0.6, "square"],
};
export class Audio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  tick = 0;
  track = "";
  noise: AudioBuffer | null = null;
  waves = new Map<number, PeriodicWave>();
  async start() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(
          1,
          this.ctx.sampleRate,
          this.ctx.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        let seed = 1729;
        for (let i = 0; i < data.length; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          data[i] = (seed / 4294967296) * 2 - 1;
        }
        for (const duty of [0.125, 0.25, 0.5]) {
          const real = new Float32Array(64),
            imag = new Float32Array(64);
          for (let n = 1; n < 64; n++) {
            real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
            imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
          }
          this.waves.set(duty, this.ctx.createPeriodicWave(real, imag));
        }
      }
      await this.ctx.resume();
    } catch {
      /* Audio is optional. */
    }
  }
  tone(
    freq: number,
    end: number,
    duration: number,
    volume: number,
    type: string,
    duty = 0.25,
  ) {
    if (!this.ctx || !this.master || this.muted || this.ctx.state !== "running")
      return;
    const ctx = this.ctx,
      t = ctx.currentTime,
      g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.master);
    if (type === "noise") {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.playbackRate.setValueAtTime(Math.max(0.05, freq / 1000), t);
      n.connect(g);
      n.start(t);
      n.stop(t + duration);
      n.onended = () => {
        n.disconnect();
        g.disconnect();
      };
    } else {
      const o = ctx.createOscillator();
      if (type === "pulse") o.setPeriodicWave(this.waves.get(duty)!);
      else o.type = type as OscillatorType;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
      o.connect(g);
      o.start(t);
      o.stop(t + duration);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
  }
  update(g: Game) {
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : g.overlay ? 0.18 : 1,
        this.ctx.currentTime,
        0.03,
      );
    for (const event of g.events) {
      const s = sound[event];
      if (s) this.tone(s[0], s[1], s[2], 0.07, s[3]);
    }
    const key =
      g.scene === "title"
        ? "title"
        : g.scene === "store"
          ? g.listening
            ? "bonus"
            : "store" + g.store
          : g.scene === "mall"
            ? g.player.lift >= 0 || g.player.roof >= 0
              ? "elevator"
              : g.alarm
                ? "alarm"
                : "mall"
            : g.scene === "arrival"
              ? "mall"
              : "";
    if (key !== this.track) {
      this.track = key;
      this.tick = 0;
    }
    if (!key || g.overlay || g.scene === "continue") return;
    const tr = tracks[key];
    if (!tr) return;
    if (this.tick % tr.tempo === 0) {
      const i = Math.floor(this.tick / tr.tempo) % tr.pattern.length,
        n = tr.pattern[i],
        f = (m: number) => 440 * 2 ** ((m - 69) / 12);
      if (n >= 0) {
        this.tone(
          f(tr.root + n),
          f(tr.root + n),
          (tr.tempo / 60) * 0.9,
          tr.volume,
          "pulse",
          tr.duty,
        );
        if (i % 2 === 0)
          this.tone(
            f(tr.root + n - 12),
            f(tr.root + n - 12),
            (tr.tempo / 60) * 1.4,
            tr.volume * 0.35,
            "pulse",
            0.5,
          );
      }
      if (i % 4 === 0)
        this.tone(
          f(tr.root - 24 + (i >= 8 ? 5 : 0)),
          f(tr.root - 24 + (i >= 8 ? 5 : 0)),
          (tr.tempo / 60) * 3,
          tr.volume * 0.6,
          "triangle",
        );
      if (key !== "mall" && key !== "elevator" && i % 2 === 0)
        this.tone(
          i % 4 ? 1600 : 150,
          i % 4 ? 1500 : 40,
          0.06,
          tr.volume * 0.25,
          "noise",
        );
    }
    if (key === "elevator" && this.tick % 30 === 0)
      this.tone(58, 58, 0.45, 0.007, "triangle");
    this.tick++;
  }
}
