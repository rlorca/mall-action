// Synthesised audio (Web Audio API), imitating NES channels: two pulse waves,
// a triangle and noise. Silent until the first user input (autoplay rules).

export type SfxName =
  | "shot"
  | "enemyshot"
  | "jump"
  | "ding"
  | "hum"
  | "crush"
  | "lamp"
  | "glass"
  | "search"
  | "package"
  | "powerup"
  | "hurt"
  | "death"
  | "door"
  | "text"
  | "whistle"
  | "helmet"
  | "coins"
  | "slide"
  | "pa"
  | "smoke"
  | "shriek"
  | "buzzer"
  | "pause"
  | "jingle"
  | "oneup"
  | "itemget"
  | "levelclear"
  | "gameover"
  | "alarm"
  | "escalator"
  | "kiosk"
  | "booth"
  | "trap"
  | "nothing"
  | "spydead"
  | "armorbreak"
  | "blackfriday"
  | "start"
  | "unpause"
  | "thud";

const NOTE: Record<string, number> = {};
{
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (let oct = 2; oct <= 6; oct++) {
    for (let i = 0; i < 12; i++) {
      const midi = (oct + 1) * 12 + i;
      NOTE[names[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private currentTrack: string | null = null;
  muted = false;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;
    this.musicGain.connect(this.master);

    // Noise buffer.
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, when = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "shot":
        this.tone(880, 0.08, "square", 0.2);
        break;
      case "enemyshot":
        this.tone(220, 0.1, "square", 0.15);
        break;
      case "jump":
        this.tone(300, 0.12, "square", 0.2);
        this.tone(500, 0.12, "square", 0.2, 0.06);
        break;
      case "ding":
        this.tone(1200, 0.3, "triangle", 0.3);
        break;
      case "crush":
        this.noise(0.2, 0.3);
        break;
      case "lamp":
        this.noise(0.15, 0.3);
        this.tone(200, 0.2, "triangle", 0.2);
        break;
      case "glass":
        this.noise(0.1, 0.25);
        break;
      case "search":
        this.tone(600, 0.05, "square", 0.15);
        break;
      case "package":
        this.tone(523, 0.1, "square", 0.25);
        this.tone(659, 0.1, "square", 0.25, 0.1);
        this.tone(784, 0.2, "square", 0.25, 0.2);
        break;
      case "powerup":
        this.tone(400, 0.08, "square", 0.2);
        this.tone(600, 0.08, "square", 0.2, 0.08);
        this.tone(800, 0.12, "square", 0.2, 0.16);
        break;
      case "hurt":
        this.tone(150, 0.2, "sawtooth", 0.25);
        break;
      case "death":
        this.tone(400, 0.4, "square", 0.25);
        this.tone(200, 0.4, "square", 0.25, 0.2);
        break;
      case "door":
        this.noise(0.08, 0.2);
        break;
      case "text":
        this.tone(1000, 0.03, "square", 0.1);
        break;
      case "whistle":
        this.tone(2000, 0.3, "square", 0.2);
        break;
      case "helmet":
        this.tone(1500, 0.05, "triangle", 0.2);
        break;
      case "coins":
        this.tone(1200, 0.06, "square", 0.2);
        this.tone(1500, 0.08, "square", 0.2, 0.06);
        break;
      case "slide":
        this.noise(0.3, 0.15);
        break;
      case "pa":
        this.tone(700, 0.2, "triangle", 0.2);
        this.tone(500, 0.2, "triangle", 0.2, 0.2);
        break;
      case "smoke":
        this.noise(0.2, 0.2);
        break;
      case "shriek":
        this.tone(1200, 0.2, "sawtooth", 0.2);
        break;
      case "buzzer":
        this.tone(100, 0.3, "square", 0.25);
        break;
      case "pause":
        this.tone(500, 0.1, "square", 0.15);
        break;
      case "jingle":
        this.tone(523, 0.12, "square", 0.2);
        this.tone(659, 0.12, "square", 0.2, 0.12);
        this.tone(784, 0.2, "square", 0.2, 0.24);
        break;
      case "oneup":
        this.tone(600, 0.08, "square", 0.2);
        this.tone(800, 0.08, "square", 0.2, 0.08);
        this.tone(1000, 0.08, "square", 0.2, 0.16);
        this.tone(1200, 0.15, "square", 0.2, 0.24);
        break;
      case "itemget":
        this.tone(700, 0.1, "square", 0.2);
        this.tone(900, 0.1, "square", 0.2, 0.1);
        this.tone(1100, 0.2, "square", 0.2, 0.2);
        break;
      case "levelclear":
        this.tone(523, 0.15, "square", 0.2);
        this.tone(659, 0.15, "square", 0.2, 0.15);
        this.tone(784, 0.15, "square", 0.2, 0.3);
        this.tone(1046, 0.3, "square", 0.2, 0.45);
        break;
      case "gameover":
        this.tone(400, 0.3, "square", 0.2);
        this.tone(300, 0.3, "square", 0.2, 0.3);
        this.tone(200, 0.5, "square", 0.2, 0.6);
        break;
      case "alarm":
        this.tone(800, 0.2, "square", 0.2);
        this.tone(600, 0.2, "square", 0.2, 0.2);
        break;
      case "escalator":
        this.noise(0.2, 0.1);
        break;
      case "kiosk":
        this.tone(900, 0.1, "triangle", 0.2);
        break;
      case "booth":
        this.noise(0.1, 0.15);
        break;
      case "trap":
        this.noise(0.2, 0.3);
        this.tone(150, 0.2, "sawtooth", 0.2);
        break;
      case "nothing":
        this.tone(300, 0.1, "triangle", 0.15);
        break;
      case "spydead":
        this.tone(200, 0.15, "square", 0.2);
        break;
      case "armorbreak":
        this.noise(0.1, 0.25);
        break;
      case "blackfriday":
        this.tone(500, 0.1, "square", 0.2);
        this.tone(700, 0.1, "square", 0.2, 0.1);
        this.tone(900, 0.2, "square", 0.2, 0.2);
        break;
      case "start":
        this.tone(400, 0.1, "square", 0.2);
        break;
      case "unpause":
        this.tone(500, 0.1, "square", 0.15);
        break;
      case "thud":
        this.tone(100, 0.15, "triangle", 0.3);
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Music.
  // -------------------------------------------------------------------------

  private tracks: Record<string, string[]> = {
    title: ["C4", "E4", "G4", "C5", "G4", "E4", "C4", "G3"],
    mall: ["C3", "E3", "G3", "C4", "G3", "E3", "C3", "G3"],
    alarm: ["A3", "A3", "C4", "A3", "E4", "C4", "A3", "A3"],
    elevator: ["C4", "E4", "G4", "E4", "C4", "E4", "G4", "E4"],
    store: ["E4", "G4", "A4", "G4", "E4", "G4", "A4", "G4"],
  };

  startMusic(track: string): void {
    if (!this.ctx || this.muted) return;
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.musicStep = 0;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const melody = this.tracks[track] ?? this.tracks.mall;
    const stepMs = track === "alarm" ? 150 : 220;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const note = melody[this.musicStep % melody.length];
      const freq = NOTE[note] ?? 440;
      this.tone(freq, stepMs / 1000, "square", 0.12);
      this.tone(freq / 2, stepMs / 1000, "triangle", 0.1);
      this.musicStep++;
    }, stepMs);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentTrack = null;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
}
