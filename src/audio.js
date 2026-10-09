import { SONGS } from "./data.js";
const freq = (n) => 440 * 2 ** ((n - 69) / 12);
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.active = false;
    this.lastTrack = "";
    this.beat = -1;
  }
  async unlock() {
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.ctx.destination);
        const real = new Float32Array(32),
          imag = new Float32Array(32);
        for (let n = 1; n < 32; n++)
          imag[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
        this.pulse = this.ctx.createPeriodicWave(real, imag);
        this.channels = [];
        for (let i = 0; i < 3; i++) {
          const osc = this.ctx.createOscillator(),
            gain = this.ctx.createGain();
          if (i < 2) osc.setPeriodicWave(this.pulse);
          else osc.type = "triangle";
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(this.master);
          osc.start();
          this.channels.push({ osc, gain });
        }
        const buffer = this.ctx.createBuffer(
            1,
            this.ctx.sampleRate,
            this.ctx.sampleRate,
          ),
          data = buffer.getChannelData(0);
        let n = 12345;
        for (let i = 0; i < data.length; i++) {
          n ^= n << 13;
          n ^= n >>> 17;
          n ^= n << 5;
          data[i] = ((n >>> 0) / 4294967296) * 2 - 1;
        }
        this.noise = buffer;
      }
      await this.ctx.resume();
      this.active = true;
    } catch {
      this.active = false;
    }
  }
  tone(channel, note, length = 0.12, volume = 0.12, offset = 0) {
    if (!this.active || this.muted || !note) return;
    const { osc, gain } = this.channels[channel],
      now = this.ctx.currentTime + offset;
    osc.frequency.setValueAtTime(freq(note), now);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  }
  hiss(length = 0.06, volume = 0.09) {
    if (!this.active || this.muted) return;
    const src = this.ctx.createBufferSource(),
      g = this.ctx.createGain();
    src.buffer = this.noise;
    g.gain.setValueAtTime(volume, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + length);
    src.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(this.ctx.currentTime + length);
  }
  setMute(value) {
    this.muted = value;
    if (this.master)
      this.master.gain.setValueAtTime(value ? 0 : 0.18, this.ctx.currentTime);
  }
  update(s) {
    if (!this.active) return;
    if (this.jingleUntil > this.ctx.currentTime) return;
    const paused = !!s.overlay || s.scene === "continue";
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : paused ? 0.025 : 0.18,
        this.ctx.currentTime,
        0.05,
      );
    let name =
      s.scene === "title"
        ? "title"
        : s.scene === "store"
          ? s.sideB
            ? "sideB"
            : s.stores.find((x) => x.id === s.storeId).theme
          : s.p.ride
            ? "elevator"
            : s.alarm
              ? "alarm"
              : "mall";
    if (
      !["title", "mall", "store", "arrival", "selfie"].includes(s.scene) ||
      paused
    )
      return;
    const song = SONGS[name],
      beat = Math.floor(s.frame / song.tempo);
    if (name !== this.lastTrack) {
      this.lastTrack = name;
      this.beat = -1;
    }
    if (beat === this.beat) return;
    this.beat = beat;
    const note = song.notes[beat % song.notes.length],
      ambient = name === "mall",
      len = song.tempo / 60;
    this.tone(0, note, len * 0.8, ambient ? 0.022 : 0.12);
    if (beat % 2 === 0)
      this.tone(1, note ? note - 12 : 0, len * 1.6, ambient ? 0.01 : 0.045);
    if (beat % (song.meter || 4) === 0)
      this.tone(2, 36 + (beat % 8 < 4 ? 0 : 5), len * 2, ambient ? 0.06 : 0.16);
    if (!ambient && beat % 2) this.hiss(0.025, 0.025);
    if (s.p.ride && beat % 4 === 0) this.tone(2, 31, len * 3, 0.08);
  }
  event(type) {
    if (!this.active || this.muted) return;
    const jingles = {
      package: [72, 76, 79, 84],
      power: [76, 79, 84],
      jingle: [64, 67, 71, 76],
      clear: [72, 76, 79, 84, 83, 79, 84],
      death: [59, 55, 52, 47],
      pa: [79, 76, 72],
    };
    if (jingles[type]) {
      const notes = jingles[type];
      this.jingleUntil = this.ctx.currentTime + notes.length * 0.12;
      notes.forEach((n, i) => this.tone(0, n, 0.13, 0.14, i * 0.12));
      this.tone(2, notes[0] - 24, notes.length * 0.12, 0.12);
      if (type === "death") this.hiss(0.25, 0.1);
      return;
    }
    const map = {
      shot: [1, 90, 0.035, 0.13],
      enemyShot: [1, 73, 0.06, 0.1],
      jump: [0, 76, 0.12, 0.12],
      ding: [0, 88, 0.5, 0.15],
      call: [0, 76, 0.1, 0.06],
      search: [1, 81, 0.025, 0.055],
      text: [1, 65, 0.018, 0.028],
      power: [0, 84, 0.35, 0.12],
      package: [0, 88, 0.6, 0.16],
      jingle: [0, 79, 0.4, 0.14],
      clear: [0, 91, 0.8, 0.16],
      death: [2, 32, 0.7, 0.25],
      hurt: [1, 44, 0.12, 0.1],
      whistle: [0, 100, 0.25, 0.12],
      ping: [0, 96, 0.12, 0.07],
      coin: [0, 95, 0.08, 0.1],
      beep: [0, 76, 0.13, 0.12],
      buzzer: [2, 40, 0.22, 0.2],
      pause: [0, 71, 0.07, 0.1],
      pa: [0, 83, 0.4, 0.12],
      camera: [1, 99, 0.025, 0.08],
      door: [2, 52, 0.1, 0.1],
      toy: [0, 90, 0.08, 0.05],
      shriek: [0, 102, 0.3, 0.12],
      alarm: [1, 95, 0.35, 0.12],
    };
    if (map[type]) this.tone(...map[type]);
    if (
      [
        "crush",
        "lamp",
        "glass",
        "smoke",
        "slide",
        "zip",
        "enemyDeath",
        "land",
        "thud",
      ].includes(type)
    )
      this.hiss(type === "zip" ? 0.8 : 0.12, type === "glass" ? 0.18 : 0.08);
  }
}
