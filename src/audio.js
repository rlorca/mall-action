// Browser-only NES-inspired synthesiser: two pulse channels, triangle and noise.
export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.mode = "";
    this.nextNote = 0;
    this.noteIndex = 0;
    this.noiseSeed = 0x1234567;
  }

  async unlock() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return false;
      try {
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.22;
        this.master.connect(this.context.destination);
      } catch { this.context = null; return false; }
    }
    try { if (this.context.state === "suspended") await this.context.resume(); } catch { return false; }
    return this.context.state === "running";
  }

  setMuted(value) {
    this.muted = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : 0.22, this.context.currentTime, 0.015);
  }

  toggle() { this.setMuted(!this.muted); return !this.muted; }

  pulse(frequency, time, duration, volume = 0.1, duty = "square") {
    if (!this.context || this.muted) return;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = duty; osc.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + duration + 0.02);
  }

  triangle(frequency, time, duration, volume = 0.08) { this.pulse(frequency, time, duration, volume, "triangle"); }

  noise(time, duration = 0.08, volume = 0.08) {
    if (!this.context || this.muted) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) { this.noiseSeed ^= this.noiseSeed << 13; this.noiseSeed ^= this.noiseSeed >>> 17; this.noiseSeed ^= this.noiseSeed << 5; data[i] = ((this.noiseSeed >>> 0) / 0x80000000 - 1) * (1 - i / length); }
    const source = this.context.createBufferSource(); const gain = this.context.createGain();
    source.buffer = buffer; gain.gain.value = volume; source.connect(gain); gain.connect(this.master); source.start(time);
  }

  play(name) {
    if (!this.context || this.context.state !== "running" || this.muted) return;
    const t = this.context.currentTime + 0.005;
    const note = (hz, offset, duration, volume, wave = "square") => wave === "triangle" ? this.triangle(hz, t + offset, duration, volume) : this.pulse(hz, t + offset, duration, volume, wave);
    switch (name) {
      case "shot": note(880, 0, 0.055, 0.12, "sawtooth"); note(220, 0.02, 0.05, 0.05); break;
      case "enemyShot": note(330, 0, 0.09, 0.09, "sawtooth"); break;
      case "jump": note(220, 0, 0.08, 0.08); note(440, 0.05, 0.09, 0.07); break;
      case "ding": note(1047, 0, 0.25, 0.12); note(1568, 0.04, 0.3, 0.08); break;
      case "thud": case "death": this.noise(t, 0.2, 0.14); note(90, 0, 0.22, 0.12, "triangle"); break;
      case "crush": case "lamp": this.noise(t, 0.15, 0.15); note(75, 0, 0.18, 0.12, "triangle"); break;
      case "glass": this.noise(t, 0.22, 0.12); note(1900, 0, 0.08, 0.06); break;
      case "spyDown": note(250, 0, 0.08, 0.08); note(120, 0.07, 0.16, 0.08); break;
      case "door": note(180, 0, 0.08, 0.05); note(240, 0.08, 0.08, 0.04); break;
      case "coin": case "coins": note(988, 0, 0.07, 0.1); note(1319, 0.07, 0.15, 0.1); break;
      case "powerup": case "item": [523, 659, 784, 1047].forEach((hz, i) => note(hz, i * 0.07, 0.14, 0.08)); break;
      case "fanfare": case "clear": [392, 523, 659, 784, 1047].forEach((hz, i) => { note(hz, i * 0.1, 0.2, 0.1); note(hz / 2, i * 0.1, 0.22, 0.06, "triangle"); }); break;
      case "jingle": [262, 330, 392, 523].forEach((hz, i) => note(hz, i * 0.11, 0.2, 0.1)); break;
      case "buzzer": note(110, 0, 0.25, 0.11, "sawtooth"); break;
      case "whistle": note(1800, 0, 0.12, 0.08); note(2300, 0.11, 0.18, 0.08); break;
      case "ping": note(2100, 0, 0.08, 0.08); break;
      case "zip": case "escalator": this.noise(t, 0.35, 0.04); note(180, 0, 0.35, 0.04, "triangle"); break;
      case "flash": this.noise(t, 0.06, 0.08); note(1400, 0, 0.1, 0.05); break;
      case "smoke": this.noise(t, 0.25, 0.09); break;
      case "shriek": note(1200, 0, 0.1, 0.08); note(1700, 0.09, 0.18, 0.08); break;
      case "countdown": note(440, 0, 0.09, 0.09); break;
      case "continue": case "gameover": [330, 262, 196, 131].forEach((hz, i) => note(hz, i * 0.16, 0.24, 0.08, "triangle")); break;
      case "pa": note(659, 0, 0.16, 0.08); note(523, 0.17, 0.2, 0.08); break;
      case "pause": note(520, 0, 0.07, 0.06); break;
      case "kiosk": case "toys": note(760, 0, 0.07, 0.06); note(980, 0.08, 0.08, 0.05); break;
      case "search": note(620, 0, 0.035, 0.025); break;
      case "1up": [660, 880, 1100, 1320].forEach((hz, i) => note(hz, i * 0.08, 0.15, 0.08)); break;
      case "alarm": note(220, 0, 0.25, 0.08); note(330, 0.24, 0.25, 0.08); break;
      default: break;
    }
  }

  handle(events) { for (const event of events) if (event.type === "sound") this.play(event.name); }

  modeFor(game) {
    const s = game.state;
    if (s.screen === "pause" || s.screen === "map") return "paused";
    if (s.screen === "title" || s.screen === "splash") return "title";
    if (s.screen === "store") return s.stores[s.currentStore]?.boothPlaying ? "sideB" : `store:${s.currentStore}`;
    if (s.player.riding) return "elevator";
    if (s.alarm) return "alarm";
    return "mall";
  }

  update(game) {
    if (!this.context || this.context.state !== "running" || this.muted) return;
    const mode = this.modeFor(game);
    if (mode !== this.mode) { this.mode = mode; this.noteIndex = 0; this.nextNote = this.context.currentTime + 0.04; }
    if (this.context.currentTime < this.nextNote) return;
    const storeKey = mode.startsWith("store:") ? mode.slice(6) : "";
    const storeOffsets = { forever: 0, radio: 2, kgb: 4, hotspy: 5, foot: 7, sam: -2, crook: 9, sharper: 12, spender: -5, game: 14 };
    const offset = storeOffsets[storeKey] || 0;
    const patterns = {
      title: [0, 4, 7, 12, 7, 4, 9, 7], mall: [0, null, null, 7, null, null, 4, null],
      alarm: [0, 3, 6, 3, 0, 6, 3, 6], elevator: [0, 4, 7, 4, 2, 5, 9, 5],
      sideB: [0, 7, 12, 16, 12, 7, 9, 14], paused: [null],
    };
    const pattern = patterns[mode] || [0, 4, 7, 11, 7, 4, 2 + (offset % 3), 7];
    const index = this.noteIndex++ % pattern.length; const semitone = pattern[index];
    const fast = mode === "alarm" || storeKey === "game"; const sparse = mode === "mall";
    const beat = fast ? 0.12 : mode === "elevator" ? 0.22 : sparse ? 0.42 : 0.19;
    const base = 220 * Math.pow(2, offset / 12);
    const t = this.context.currentTime + 0.02;
    if (semitone !== null) {
      const hz = base * Math.pow(2, semitone / 12);
      this.pulse(hz, t, beat * 0.75, mode === "mall" ? 0.025 : 0.04, index % 2 ? "square" : "square");
      if (index % 2 === 0) this.triangle(hz / 4, t, beat * 1.5, mode === "mall" ? 0.035 : 0.055);
      if (!sparse && mode !== "paused" && index % 2 === 0) this.noise(t, 0.025, 0.018);
    }
    this.nextNote = t + beat;
  }
}
