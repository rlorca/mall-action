/** Browser bootstrap: input, fixed-step loop, presenter, audio. The rules never touch the DOM. */
import { Fb } from './gfx/fb';
import { Presenter } from './platform/present';
import { FixedLoop } from './core/loop';
import { VirtualPad, gamepadMask, Btn, type PadFrame } from './core/input';
import { AudioEngine } from './audio/engine';
import { newGame } from './game/setup';
import { stepGame, musicFor, humOn } from './game/game';
import { drawGame } from './render/draw';
import { drawGallery } from './render/screens';

const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const gallery = params.get('gallery') === '1';
const seedParam = params.get('seed');
const seed = seedParam !== null && seedParam !== '' && !isNaN(Number(seedParam)) ? Number(seedParam) >>> 0 : (Date.now() ^ (Math.floor(performance.now() * 1000) << 8)) >>> 0;

function showMessage(text: string): void {
  const el = document.getElementById('msg')!;
  el.textContent = text;
  el.style.display = 'flex';
  (document.getElementById('screen') as HTMLElement).style.display = 'none';
}

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  let presenter: Presenter;
  try {
    presenter = new Presenter(canvas);
  } catch {
    showMessage('MALL ACTION needs WebGL to draw its screen, and this browser or device does not provide it. Please enable hardware acceleration or try another browser.');
    return;
  }
  const store = {
    get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
    set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  presenter.crt = store.get('mall-action.crt') !== 'off'; // ON by default
  const fb = new Fb();
  const pad = new VirtualPad();
  const audio = new AudioEngine();
  const loop = new FixedLoop();
  const game = newGame(seed);
  if (debug) { game.splash.done = true; game.screen = 'title'; } // debug skips the studio splash
  let toast = '';
  let toastT = 0;
  let galleryScroll = 0;
  let galleryMax = 0;
  let frame = 0;
  let paused = false; // debug: stop the real-time simulation

  const say = (t: string) => { toast = t; toastT = 90; };
  const toggleCrt = () => {
    presenter.crt = !presenter.crt;
    store.set('mall-action.crt', presenter.crt ? 'on' : 'off');
    say(presenter.crt ? 'CRT ON' : 'CRT OFF');
  };
  const toggleMute = () => {
    audio.setMuted(!audio.muted);
    say(audio.muted ? 'SOUND OFF' : 'SOUND ON');
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    audio.start();
    const act = pad.keyDown(e.key, e.code);
    if (act !== 0) e.preventDefault();
    if (e.repeat) return;
    if (act === 'crt') toggleCrt();
    else if (act === 'mute') toggleMute();
  });
  window.addEventListener('keyup', (e) => pad.keyUp(e.key, e.code));
  window.addEventListener('blur', () => pad.releaseAll());
  window.addEventListener('pointerdown', () => audio.start());
  window.addEventListener('resize', () => presenter.resize());
  document.addEventListener('visibilitychange', () => { loop.reset(); pad.releaseAll(); });
  window.addEventListener('gamepadconnected', () => say('GAMEPAD ON'));
  window.addEventListener('gamepaddisconnected', () => { pad.setGamepad(0); say('GAMEPAD OFF'); });

  function pollGamepad(): void {
    let mask = 0;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) if (gp && gp.connected) mask |= gamepadMask(gp.buttons, gp.axes);
    } catch { /* unavailable */ }
    if (mask) audio.start();
    pad.setGamepad(mask);
  }

  function sim(input: PadFrame): void {
    if (gallery) {
      if (input.held & Btn.Down) galleryScroll = Math.min(Math.max(0, galleryMax - 220), galleryScroll + 2);
      if (input.held & Btn.Up) galleryScroll = Math.max(0, galleryScroll - 2);
      frame++;
      return;
    }
    stepGame(game, input);
    for (const s of game.sfx) audio.playSfx(s);
  }

  function render(): void {
    if (gallery) galleryMax = drawGallery(fb, frame, galleryScroll);
    else drawGame(fb, game);
    if (toastT > 0) {
      fb.noClip();
      const w = toast.length * 8 + 8;
      fb.rect(128 - w / 2, 112, w, 14, 0x0f);
      fb.frame(128 - w / 2, 112, w, 14, 0x30);
      fb.textC(toast, 128, 115, 0x30);
    }
    presenter.present(fb);
    if (!gallery) {
      audio.setMusic(musicFor(game));
      audio.setHum(humOn(game));
      audio.setDucked(game.overlay === 'pause' || game.overlay === 'map');
    }
    audio.tick();
  }

  let last = performance.now();
  function tick(now: number): void {
    const dt = now - last;
    last = now;
    pollGamepad();
    if (!paused) {
      const n = loop.advance(dt);
      for (let i = 0; i < n; i++) sim(pad.poll());
      if (toastT > 0) toastT -= n;
    }
    render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if (debug) {
    // Debug hook for automated playtests: step N frames with given buttons held.
    (window as any).__mall = {
      game,
      Btn,
      pad,
      audio,
      presenter,
      setPaused(p: boolean) { paused = p; loop.reset(); },
      /** Step n frames with `held` buttons; `pressed` (optional) is applied on the first frame only. */
      step(n: number, held = 0, pressed = 0) {
        for (let i = 0; i < n; i++) { stepGame(game, { held, pressed: i === 0 ? pressed | held : 0 }); for (const s of game.sfx) audio.playSfx(s); }
        return game.frame;
      },
      state() {
        const L = game.level;
        return { screen: game.screen, frame: game.frame, score: game.score, lives: game.lives, pkgs: game.pkgs, loop: game.loop, overlay: game.overlay, mode: L?.mode, x: L?.player.x, y: L?.player.y, spies: L?.spies.length };
      },
    };
  }
}
boot();
