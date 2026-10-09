import { GameEvent } from '../core/events';
import type { Game } from '../core/game';
import { Engine, MusicPlayer } from './engine';
import { STORE_SONG } from './songs';

/**
 * Audio facade: turns game EVENTS into sound effects and picks the music from the game STATE.
 * It is silent until the first user input (browser autoplay rules) and every call is a safe no-op if audio
 * cannot start - the game must still run fine without it.
 */
export class GameAudio {
  readonly eng = new Engine();
  private music = new MusicPlayer(this.eng);
  private jingle = new MusicPlayer(this.eng);
  private wanted: string | null = null;
  private humNode: { osc: OscillatorNode; gain: GainNode } | null = null;
  private duck = 1;

  get ok(): boolean {
    return this.eng.ok;
  }
  get muted(): boolean {
    return this.eng.muted;
  }
  set muted(m: boolean) {
    this.eng.muted = m;
  }

  unlock(): void {
    const was = this.eng.ok;
    this.eng.unlock();
    if (this.eng.ok && !was) {
      this.eng.setMuted(this.eng.muted);
      this.music.retry();
    }
  }

  toggleMute(): boolean {
    this.eng.setMuted(!this.eng.muted);
    return this.eng.muted;
  }

  // ------------------------------------------------------------------ music selection
  update(game: Game): void {
    if (!this.eng.ok) return;
    let want: string | null = null;
    let duck = 1;
    switch (game.screen) {
      case 'title':
        want = 'title';
        break;
      case 'mall':
      case 'pause':
      case 'map': {
        const under = game.screen === 'mall' ? 'mall' : game.under;
        if (under === 'store' && game.store) want = game.store.onBooth ? 'booth' : (STORE_SONG[game.store.id] ?? null);
        else if (game.mall) {
          const m = game.mall;
          const started = m.controlGiven;
          if (started) want = m.alarm ? 'alarm' : m.inElevator() && m.ridingCar ? 'elevator' : 'mall';
        }
        if (game.screen !== 'mall') duck = 0.25;
        break;
      }
      case 'store':
        want = game.store ? (game.store.onBooth ? 'booth' : (STORE_SONG[game.store.id] ?? null)) : null;
        break;
      case 'clear':
        want = game.clear?.phase === 'drive' ? 'clear' : game.clear?.phase === 'tally' ? 'clear' : 'elevator';
        break;
      default:
        want = null;
    }
    if (game.screen === 'clear' && game.clear?.phase === 'tally') want = null;
    if (want !== this.wanted) {
      this.wanted = want;
      this.music.set(want);
    }
    this.eng.musicBus.gain.setTargetAtTime(0.5 * duck, this.eng.now, 0.05);
    this.duck = duck;
    // elevator hum while riding
    const riding = game.screen === 'mall' && !!game.mall?.ridingCar;
    this.hum(riding);
  }

  private hum(on: boolean): void {
    if (!this.eng.ok || !this.eng.ctx) return;
    const ctx = this.eng.ctx;
    if (on && !this.humNode) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 58;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.1);
      osc.connect(gain);
      gain.connect(this.eng.sfxBus);
      osc.start();
      this.humNode = { osc, gain };
    } else if (!on && this.humNode) {
      const h = this.humNode;
      this.humNode = null;
      h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => {
        try {
          h.osc.stop();
        } catch {
          /* done */
        }
      }, 400);
    }
  }

  // ------------------------------------------------------------------ sound effects
  handle(events: GameEvent[]): void {
    if (!this.eng.ok) return;
    for (const e of events) this.sfx(e);
  }

  private arp(notes: number[], gap: number, dur: number, vol: number, wave: 'p25' | 'p50' | 'tri' = 'p25'): void {
    const t0 = this.eng.now;
    notes.forEach((f, i) => this.eng.tone({ t: t0 + i * gap, dur, f0: f, vol, wave }));
  }

  private playJingle(name: string): void {
    this.jingle.current = null;
    this.jingle.set(name);
  }

  private sfx(e: GameEvent): void {
    const E = this.eng;
    switch (e.kind) {
      case 'shot':
        E.tone({ dur: 0.07, f0: 1500, f1: 520, vol: 0.2, wave: 'p25' });
        break;
      case 'enemyShot':
        E.tone({ dur: 0.1, f0: 720, f1: 260, vol: 0.18, wave: 'p50' });
        break;
      case 'spyAim':
        E.tone({ dur: 0.04, f0: 1900, vol: 0.06, wave: 'p12' });
        break;
      case 'jump':
        E.tone({ dur: 0.12, f0: 230, f1: 560, vol: 0.18, wave: 'p50' });
        break;
      case 'land':
        E.noise({ dur: 0.04, vol: 0.12, type: 'lowpass', f0: 500 });
        break;
      case 'thud':
        E.tone({ dur: 0.16, f0: 130, f1: 48, vol: 0.4, wave: 'sine' });
        E.noise({ dur: 0.1, vol: 0.25, type: 'lowpass', f0: 400 });
        break;
      case 'ding':
        E.tone({ dur: 0.55, f0: 1760, vol: 0.2, wave: 'sine' });
        E.tone({ dur: 0.4, f0: 3520, vol: 0.05, wave: 'sine' });
        break;
      case 'carStart':
        E.noise({ dur: 0.06, vol: 0.1, type: 'bandpass', f0: 800 });
        break;
      case 'board':
      case 'exitCar':
        E.noise({ dur: 0.1, vol: 0.12, type: 'bandpass', f0: 900, f1: 400 });
        break;
      case 'call':
        E.tone({ dur: 0.05, f0: 1000, vol: 0.12 });
        E.tone({ t: E.now + 0.06, dur: 0.05, f0: 1300, vol: 0.12 });
        break;
      case 'crushHit':
        E.noise({ dur: 0.35, vol: 0.5, type: 'lowpass', f0: 500, f1: 80 });
        E.tone({ dur: 0.3, f0: 150, f1: 38, vol: 0.4, wave: 'p50' });
        break;
      case 'lampFall':
        E.tone({ dur: 0.35, f0: 1100, f1: 160, vol: 0.18, wave: 'p25' });
        break;
      case 'glass':
        E.noise({ dur: 0.3, vol: 0.32, type: 'highpass', f0: 5000 });
        E.tone({ dur: 0.08, f0: 3100, vol: 0.1, wave: 'p12' });
        E.tone({ t: E.now + 0.05, dur: 0.08, f0: 2500, vol: 0.1, wave: 'p12' });
        break;
      case 'searchStart':
        E.tone({ dur: 0.06, f0: 520, vol: 0.14 });
        break;
      case 'searchTick':
        E.tone({ dur: 0.03, f0: 880, vol: 0.1 });
        break;
      case 'searchCancel':
        E.tone({ dur: 0.07, f0: 300, f1: 180, vol: 0.12 });
        break;
      case 'package':
        this.playJingle('package');
        break;
      case 'itemGet':
        this.playJingle('itemget');
        break;
      case 'powerup':
        this.arp([1047, 1319, 1568, 2093], 0.045, 0.06, 0.16);
        break;
      case 'extraLife':
        this.arp([784, 988, 1175, 1568, 1976, 2349], 0.06, 0.08, 0.18);
        break;
      case 'armorBreak':
        E.noise({ dur: 0.2, vol: 0.3, type: 'bandpass', f0: 1500, f1: 300 });
        E.tone({ dur: 0.15, f0: 400, f1: 120, vol: 0.18, wave: 'tri' });
        break;
      case 'playerDied':
        E.tone({ dur: 0.7, f0: 900, f1: 70, vol: 0.28, wave: 'p50' });
        E.noise({ dur: 0.45, vol: 0.3, type: 'lowpass', f0: 1200, f1: 100 });
        break;
      case 'spyDie':
        E.tone({ dur: 0.25, f0: 520, f1: 90, vol: 0.2, wave: 'p25' });
        E.noise({ dur: 0.12, vol: 0.18, type: 'bandpass', f0: 1200 });
        break;
      case 'enterStore':
      case 'exitStore':
      case 'storeEntered':
        E.noise({ dur: 0.14, vol: 0.18, type: 'lowpass', f0: 700, f1: 200 });
        E.tone({ dur: 0.14, f0: 150, f1: 90, vol: 0.2, wave: 'tri' });
        break;
      case 'locked':
        E.tone({ dur: 0.1, f0: 150, vol: 0.2, wave: 'p25' });
        E.tone({ t: E.now + 0.12, dur: 0.1, f0: 130, vol: 0.2, wave: 'p25' });
        break;
      case 'text':
      case 'blip':
        E.tone({ dur: 0.03, f0: 1150, vol: 0.1, wave: 'p50' });
        break;
      case 'whistle':
        E.tone({ dur: 0.45, f0: 2500, vol: 0.16, wave: 'p25', vib: 90 });
        break;
      case 'detained':
        E.tone({ dur: 0.4, f0: 140, vol: 0.25, wave: 'p25' });
        break;
      case 'helmetPing':
      case 'ping':
        E.tone({ dur: 0.09, f0: 1900, f1: 1500, vol: 0.14, wave: 'tri' });
        break;
      case 'walkerHit':
        E.tone({ dur: 0.14, f0: 320, f1: 260, vol: 0.18, wave: 'p25' });
        break;
      case 'coin':
        E.tone({ dur: 0.07, f0: 1760, vol: 0.14, wave: 'p25' });
        E.tone({ t: E.now + 0.07, dur: 0.16, f0: 2349, vol: 0.14, wave: 'p25' });
        break;
      case 'fountain':
        E.noise({ dur: 0.25, vol: 0.12, type: 'highpass', f0: 3500 });
        break;
      case 'zip':
        E.noise({ dur: 2.4, vol: 0.1, type: 'bandpass', f0: 900, f1: 5000, q: 1.5 });
        E.tone({ dur: 2.4, f0: 500, f1: 1300, vol: 0.05, wave: 'p12' });
        break;
      case 'slip':
        E.noise({ dur: 0.3, vol: 0.14, type: 'bandpass', f0: 1800, f1: 700 });
        break;
      case 'flash':
        E.noise({ dur: 0.08, vol: 0.2, type: 'highpass', f0: 4000 });
        E.tone({ dur: 0.05, f0: 2200, vol: 0.08 });
        break;
      case 'pa':
        E.tone({ dur: 0.5, f0: 659, vol: 0.2, wave: 'tri' });
        E.tone({ t: E.now + 0.32, dur: 0.5, f0: 523, vol: 0.2, wave: 'tri' });
        E.tone({ t: E.now + 0.64, dur: 0.8, f0: 392, vol: 0.2, wave: 'tri' });
        break;
      case 'smoke':
        E.noise({ dur: 0.25, vol: 0.14, type: 'lowpass', f0: 1400, f1: 400 });
        break;
      case 'shriek':
        E.tone({ dur: 0.4, f0: 1400, f1: 2700, vol: 0.2, wave: 'p25', vib: 120 });
        break;
      case 'buzzer':
        E.tone({ dur: 0.18, f0: 120, vol: 0.28, wave: 'p25' });
        E.tone({ t: E.now + 0.22, dur: 0.3, f0: 105, vol: 0.28, wave: 'p25' });
        break;
      case 'pauseOn':
        E.tone({ dur: 0.07, f0: 880, vol: 0.14 });
        E.tone({ t: E.now + 0.08, dur: 0.09, f0: 660, vol: 0.14 });
        break;
      case 'pauseOff':
        E.tone({ dur: 0.07, f0: 660, vol: 0.14 });
        E.tone({ t: E.now + 0.08, dur: 0.09, f0: 880, vol: 0.14 });
        break;
      case 'mapOpen':
      case 'mapClose':
        E.tone({ dur: 0.05, f0: e.kind === 'mapOpen' ? 700 : 500, vol: 0.12 });
        break;
      case 'trap':
        E.tone({ dur: 0.3, f0: 700, f1: 120, vol: 0.2, wave: 'p25' });
        E.noise({ dur: 0.2, vol: 0.18, type: 'lowpass', f0: 900 });
        break;
      case 'nothing':
        E.tone({ dur: 0.1, f0: 260, f1: 200, vol: 0.12, wave: 'tri' });
        break;
      case 'toys':
      case 'toyStun':
      case 'trapSprung':
        this.arp([1319, 1047, 1319, 1568], 0.05, 0.05, 0.1);
        break;
      case 'kiosk':
        this.arp([880, 1175], 0.06, 0.06, 0.12);
        break;
      case 'boothIn':
      case 'boothOut':
        E.tone({ dur: 0.08, f0: e.kind === 'boothIn' ? 600 : 800, vol: 0.12 });
        break;
      case 'photoStrip':
        this.arp([1047, 1319, 1568, 2093, 1568, 2093], 0.07, 0.07, 0.14);
        break;
      case 'eggItem':
        E.tone({ dur: 0.4, f0: 1568, vol: 0.14, wave: 'tri' });
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) E.tone({ t: E.now + i * 0.4, dur: 0.4, f0: 600, f1: 1200, vol: 0.14, wave: 'p25' });
        break;
      case 'continueBeep':
        E.tone({ dur: 0.12, f0: (e.sec as number) <= 3 ? 1320 : 880, vol: 0.2, wave: 'p50' });
        break;
      case 'continueScreen':
        E.tone({ dur: 0.4, f0: 300, f1: 200, vol: 0.2, wave: 'p25' });
        break;
      case 'continueUsed':
      case 'startGame':
        this.arp([523, 659, 784, 1047, 1319], 0.06, 0.08, 0.18);
        break;
      case 'splashJingle':
        this.playJingle('splash');
        break;
      case 'levelClearStart':
        this.playJingle('clear');
        break;
      case 'gameOver':
        this.playJingle('gameover');
        E.tone({ dur: 0.5, f0: 523, vol: 0.1, wave: 'tri' });
        break;
      case 'gameOverFinal':
        E.tone({ dur: 0.3, f0: 180, f1: 90, vol: 0.2, wave: 'p25' });
        break;
      case 'blackFriday':
        this.arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.07, 0.08, 0.2);
        break;
      case 'respawn':
        this.arp([392, 523, 659], 0.06, 0.08, 0.14, 'tri');
        break;
      case 'tick':
        break;
    }
  }
}
