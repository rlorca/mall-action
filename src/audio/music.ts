import { NESynth } from './synth';

type NoteEntry = [number, number, number, number]; // [channel, freq, duration_ms, volume]
type Pattern = NoteEntry[];

// Note frequencies
const REST = 0;
const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, A3 = 220.00, Bb3 = 233.08, B3 = 246.94;
const C4 = 261.63, D4 = 293.66, Eb4 = 311.13, E4 = 329.63, F4 = 349.23, G4 = 392.00, Ab4 = 415.30, A4 = 440.00, Bb4 = 466.16, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, Eb5 = 622.25, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.00, B5 = 987.77;
const C6 = 1046.50;

export class MusicPlayer {
  private synth: NESynth;
  private currentTrack: string = '';
  private loopTimer: number | null = null;
  private volume: number = 1.0;
  private paused: boolean = false;
  private currentPattern: Pattern = [];
  private noteIndex: number = 0;
  private stepTimer: number | null = null;

  constructor(synth: NESynth) {
    this.synth = synth;
  }

  private playPattern(pattern: Pattern, loop: boolean = true, trackVolume: number = 1.0): void {
    this.stopInternal();
    this.currentPattern = pattern;
    this.noteIndex = 0;

    const step = () => {
      if (this.paused) {
        this.stepTimer = window.setTimeout(step, 50);
        return;
      }
      if (this.noteIndex >= this.currentPattern.length) {
        if (loop) {
          this.noteIndex = 0;
        } else {
          return;
        }
      }
      const note = this.currentPattern[this.noteIndex];
      if (!note) return;
      const [ch, freq, dur, vol] = note;
      if (freq > 0) {
        this.synth.playNote(ch, freq, dur / 1000, vol * this.volume * trackVolume);
      }
      this.noteIndex++;
      const nextDur = dur > 0 ? dur : 100;
      this.stepTimer = window.setTimeout(step, nextDur);
    };

    step();
  }

  private stopInternal(): void {
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  playTitle(): void {
    this.currentTrack = 'title';
    // Heroic spy theme - bold, confident melody
    const pattern: Pattern = [
      // Melody: pulse 0
      [0, C5, 200, 0.25], [0, E5, 200, 0.25], [0, G5, 400, 0.3],
      [2, C4, 200, 0.15], // bass
      [0, G5, 200, 0.25], [0, A5, 200, 0.25], [0, G5, 400, 0.3],
      [2, G3, 200, 0.15],
      [0, E5, 200, 0.25], [0, D5, 200, 0.2], [0, C5, 200, 0.2], [0, D5, 200, 0.2],
      [0, E5, 600, 0.3],
      [2, C4, 200, 0.15],
      [0, REST, 200, 0],
      // Second phrase
      [0, C5, 200, 0.25], [0, E5, 200, 0.25], [0, G5, 400, 0.3],
      [2, F3, 200, 0.15],
      [0, A5, 200, 0.3], [0, G5, 200, 0.25], [0, E5, 200, 0.2],
      [0, D5, 200, 0.2], [0, C5, 600, 0.3],
      [2, G3, 200, 0.15],
      [0, REST, 400, 0],
      // Drums
      [3, 0, 100, 0.1], [0, REST, 100, 0],
      [3, 0, 100, 0.1], [0, REST, 100, 0],
      [3, 0, 100, 0.15], [0, REST, 300, 0],
    ];
    this.playPattern(pattern, true);
  }

  playMall(): void {
    this.currentTrack = 'mall';
    // Quiet sparse ambient - soft pads, slow bass, rare bell
    const pattern: Pattern = [
      [2, C3, 800, 0.06],
      [0, REST, 800, 0],
      [2, E3, 600, 0.05],
      [0, REST, 1200, 0],
      [0, E5, 300, 0.03], // rare bell-like
      [0, REST, 1500, 0],
      [2, G3, 800, 0.06],
      [0, REST, 1000, 0],
      [2, C3, 600, 0.05],
      [0, REST, 2000, 0],
      [0, G5, 200, 0.02],
      [0, REST, 1500, 0],
      [2, A3, 800, 0.05],
      [0, REST, 1200, 0],
      [2, F3, 600, 0.06],
      [0, REST, 2000, 0],
    ];
    this.playPattern(pattern, true, 0.4);
  }

  playAlarm(): void {
    this.currentTrack = 'alarm';
    // Tense fast groove with siren
    const pattern: Pattern = [
      [0, E4, 100, 0.25], [0, G4, 100, 0.25], [3, 0, 50, 0.15],
      [0, E4, 100, 0.2], [0, REST, 50, 0],
      [0, Bb4, 100, 0.3], [0, A4, 100, 0.25],
      [3, 0, 50, 0.15],
      [2, E3, 100, 0.2], [0, REST, 50, 0],
      [0, G4, 100, 0.25], [0, E4, 100, 0.2],
      [3, 0, 50, 0.15], [0, REST, 50, 0],
      [1, A5, 150, 0.15], [1, E5, 150, 0.15], // siren
      [0, Bb4, 100, 0.3], [0, A4, 100, 0.25],
      [3, 0, 100, 0.2], [0, REST, 50, 0],
      [2, G3, 100, 0.2],
      [1, A5, 150, 0.15], [1, E5, 150, 0.15], // siren repeat
    ];
    this.playPattern(pattern, true);
  }

  playElevator(): void {
    this.currentTrack = 'elevator';
    // Muzak - gentle, smooth, boring
    const pattern: Pattern = [
      [2, C4, 300, 0.12], [0, E4, 300, 0.1], [0, G4, 300, 0.1],
      [0, REST, 100, 0],
      [2, F3, 300, 0.12], [0, A4, 300, 0.1], [0, C5, 300, 0.1],
      [0, REST, 100, 0],
      [2, G3, 300, 0.12], [0, B4, 300, 0.1], [0, D5, 300, 0.1],
      [0, REST, 100, 0],
      [2, C4, 300, 0.12], [0, E4, 600, 0.1],
      [0, REST, 300, 0],
    ];
    this.playPattern(pattern, true, 0.6);
  }

  playStore(storeId: string): void {
    this.currentTrack = `store_${storeId}`;
    const track = STORE_TRACKS[storeId];
    if (track) {
      this.playPattern(track, true);
    }
  }

  playBonus(): void {
    this.currentTrack = 'bonus';
    // Pop bonus track
    const pattern: Pattern = [
      [0, C5, 150, 0.25], [0, D5, 150, 0.25], [0, E5, 150, 0.25], [0, G5, 300, 0.3],
      [2, C4, 150, 0.15], [2, G3, 150, 0.15],
      [0, E5, 150, 0.25], [0, D5, 150, 0.2], [0, C5, 300, 0.25],
      [3, 0, 80, 0.1], [0, REST, 70, 0],
      [0, G4, 150, 0.2], [0, A4, 150, 0.2], [0, B4, 150, 0.25], [0, C5, 300, 0.3],
      [2, F3, 150, 0.15], [2, C4, 150, 0.15],
      [0, D5, 200, 0.25], [0, C5, 200, 0.25], [0, B4, 400, 0.2],
      [3, 0, 80, 0.1], [0, REST, 220, 0],
    ];
    this.playPattern(pattern, true);
  }

  playLevelClear(): void {
    this.currentTrack = 'level_clear';
    const pattern: Pattern = [
      [0, C5, 150, 0.3], [0, E5, 150, 0.3], [0, G5, 150, 0.3],
      [0, C6, 400, 0.35],
      [0, REST, 100, 0],
      [0, A5, 150, 0.3], [0, G5, 150, 0.25], [0, E5, 150, 0.25],
      [0, C5, 150, 0.25], [0, E5, 150, 0.3], [0, G5, 150, 0.3],
      [0, C6, 600, 0.35],
      [2, C4, 300, 0.2], [2, G3, 300, 0.2], [2, C4, 600, 0.2],
    ];
    this.playPattern(pattern, false);
  }

  playGameOver(): void {
    this.currentTrack = 'game_over';
    const pattern: Pattern = [
      [0, E4, 300, 0.25], [0, Eb4, 300, 0.2],
      [0, D4, 300, 0.2], [0, REST, 100, 0],
      [2, C3, 300, 0.2],
      [0, C4, 600, 0.15],
      [0, REST, 300, 0],
      [2, G3, 400, 0.15], [2, C3, 600, 0.2],
    ];
    this.playPattern(pattern, false);
  }

  playItemGet(): void {
    this.currentTrack = 'item_get';
    const pattern: Pattern = [
      [0, G4, 100, 0.25], [0, B4, 100, 0.25],
      [0, D5, 100, 0.3], [0, G5, 300, 0.3],
    ];
    this.playPattern(pattern, false);
  }

  playSplashJingle(): void {
    this.currentTrack = 'splash';
    const pattern: Pattern = [
      [0, C5, 100, 0.2], [0, E5, 100, 0.2],
      [0, G5, 100, 0.25], [0, C6, 200, 0.3],
      [2, C4, 200, 0.15],
      [0, REST, 100, 0],
      [0, B5, 100, 0.25], [0, C6, 300, 0.3],
    ];
    this.playPattern(pattern, false);
  }

  stop(): void {
    this.stopInternal();
    this.synth.stopAll();
    this.currentTrack = '';
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getCurrentTrack(): string {
    return this.currentTrack;
  }
}

const STORE_TRACKS: Record<string, Pattern> = {
  forever12: [
    // Disco strut
    [0, E4, 150, 0.2], [3, 0, 50, 0.12], [0, G4, 150, 0.2], [3, 0, 50, 0.12],
    [0, A4, 150, 0.25], [0, G4, 150, 0.2],
    [2, C3, 150, 0.15], [3, 0, 50, 0.12],
    [0, E4, 150, 0.2], [0, C5, 300, 0.25],
    [3, 0, 50, 0.15], [2, G3, 150, 0.15],
    [0, A4, 150, 0.2], [0, G4, 150, 0.2], [0, E4, 300, 0.2],
    [3, 0, 50, 0.12], [0, REST, 100, 0],
  ],
  radioshock: [
    // Bleepy arpeggios
    [0, C5, 80, 0.2], [0, E5, 80, 0.2], [0, G5, 80, 0.2], [0, C6, 80, 0.2],
    [0, G5, 80, 0.18], [0, E5, 80, 0.18], [0, C5, 80, 0.15],
    [0, REST, 80, 0],
    [0, D5, 80, 0.2], [0, F5, 80, 0.2], [0, A5, 80, 0.2],
    [0, F5, 80, 0.18], [0, D5, 80, 0.15],
    [0, REST, 80, 0],
    [2, C4, 160, 0.12], [2, G3, 160, 0.12],
  ],
  kgb_toys: [
    // Music box waltz in 3/4
    [0, E5, 250, 0.2], [0, REST, 50, 0],
    [0, C5, 250, 0.18], [0, REST, 50, 0],
    [0, C5, 250, 0.15], [0, REST, 50, 0],
    [2, C4, 250, 0.12],
    [0, D5, 250, 0.2], [0, REST, 50, 0],
    [0, B4, 250, 0.18], [0, REST, 50, 0],
    [0, B4, 250, 0.15], [0, REST, 50, 0],
    [2, G3, 250, 0.12],
    [0, C5, 250, 0.2], [0, REST, 50, 0],
    [0, A4, 250, 0.18], [0, REST, 50, 0],
    [0, A4, 250, 0.15], [0, REST, 50, 0],
    [2, F3, 250, 0.12],
    [0, G4, 750, 0.2],
    [2, C4, 250, 0.12],
  ],
  hot_spy: [
    // Boardwalk polka
    [0, C5, 150, 0.22], [3, 0, 50, 0.1],
    [0, E5, 150, 0.22], [3, 0, 50, 0.1],
    [0, G5, 150, 0.25], [0, E5, 150, 0.2],
    [2, C4, 150, 0.15], [3, 0, 50, 0.12],
    [0, D5, 150, 0.22], [3, 0, 50, 0.1],
    [0, F5, 150, 0.22], [0, D5, 150, 0.2],
    [2, G3, 150, 0.15], [3, 0, 50, 0.12],
    [0, C5, 300, 0.25],
    [0, REST, 100, 0],
  ],
  foot_lockpicker: [
    // Stadium march
    [0, C5, 200, 0.25], [3, 0, 50, 0.15],
    [0, C5, 100, 0.2], [0, D5, 200, 0.25],
    [3, 0, 50, 0.15],
    [0, E5, 200, 0.25], [0, C5, 200, 0.22],
    [2, C4, 200, 0.18], [3, 0, 50, 0.15],
    [0, E5, 200, 0.25], [0, F5, 100, 0.22],
    [0, G5, 400, 0.3],
    [3, 0, 100, 0.18], [0, REST, 100, 0],
    [2, G3, 200, 0.18],
  ],
  sam_baddy: [
    // Rock riff
    [0, E4, 100, 0.28], [0, E4, 100, 0.22],
    [0, G4, 200, 0.28], [0, A4, 100, 0.25],
    [3, 0, 50, 0.18],
    [0, G4, 200, 0.25], [0, E4, 200, 0.22],
    [2, E3, 100, 0.2], [3, 0, 50, 0.18],
    [0, D4, 200, 0.25], [0, E4, 400, 0.28],
    [3, 0, 100, 0.2],
    [2, A3, 100, 0.18], [2, E3, 100, 0.18],
  ],
  crookstone: [
    // Lounge bossa nova
    [0, E4, 200, 0.15], [0, G4, 200, 0.15],
    [0, A4, 200, 0.18], [0, REST, 100, 0],
    [2, C3, 200, 0.12],
    [0, G4, 200, 0.15], [0, E4, 200, 0.12],
    [0, REST, 100, 0], [3, 0, 50, 0.06],
    [2, G3, 200, 0.12],
    [0, D4, 200, 0.15], [0, F4, 200, 0.15],
    [0, A4, 300, 0.18],
    [2, F3, 200, 0.12],
    [0, REST, 200, 0], [3, 0, 50, 0.06],
  ],
  sharper_imagine: [
    // Dreamy synth pads
    [2, C4, 500, 0.12], [0, E5, 500, 0.08],
    [0, REST, 300, 0],
    [2, E4, 500, 0.12], [0, G5, 500, 0.08],
    [0, REST, 300, 0],
    [2, G4, 500, 0.1], [0, C6, 400, 0.06],
    [0, REST, 400, 0],
    [2, F4, 500, 0.12], [0, A5, 600, 0.08],
    [0, REST, 400, 0],
  ],
  spenders_gifts: [
    // Surf groove
    [0, E4, 100, 0.22], [0, E4, 100, 0.18],
    [0, G4, 100, 0.22], [0, A4, 100, 0.25],
    [0, G4, 100, 0.22],
    [3, 0, 50, 0.12],
    [0, E4, 100, 0.2], [0, REST, 50, 0],
    [2, E3, 100, 0.15],
    [0, B4, 100, 0.22], [0, A4, 100, 0.2],
    [0, G4, 100, 0.22], [0, E4, 200, 0.2],
    [3, 0, 50, 0.12],
    [2, B3, 100, 0.15], [2, E3, 100, 0.15],
    [0, REST, 100, 0],
  ],
  gamestonk: [
    // Hyper game-menu jingle
    [0, C5, 80, 0.25], [0, E5, 80, 0.25], [0, G5, 80, 0.28],
    [0, C6, 80, 0.3], [0, G5, 80, 0.25], [0, E5, 80, 0.22],
    [3, 0, 40, 0.12],
    [0, D5, 80, 0.25], [0, F5, 80, 0.25], [0, A5, 80, 0.28],
    [0, D5, 80, 0.22], [0, F5, 80, 0.25],
    [3, 0, 40, 0.12],
    [2, C4, 80, 0.15], [2, G3, 80, 0.15],
    [0, REST, 80, 0],
    [0, C5, 80, 0.22], [0, B4, 80, 0.22], [0, C5, 160, 0.28],
    [3, 0, 80, 0.15],
  ],
};
