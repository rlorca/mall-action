// Browser entry point: wires the splash, game, renderer, audio and input into one fixed-step loop.
import { FixedStepClock } from './core/fixed-step';
import { InputMapper, type StepInput } from './core/input';
import { Game, type GameOutput } from './core/game';
import { Renderer } from './render/renderer';
import { Presenter } from './render/crt';
import { Audio } from './audio/engine';
import { FlickerSplash } from './splash/flickersoft-splash';
import { attachKeyboard, pollGamepads } from './input-browser';
import { installDebug } from './debug';
import { drawGallery } from './gallery';

const CRT_KEY = 'mall-action.crt';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback; // private windows and blocked storage: use the default
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* the choice just won't persist */
  }
}

function showMessage(text: string): void {
  const el = document.getElementById('message');
  if (el) {
    el.textContent = text;
    el.classList.add('show');
  }
  const canvas = document.getElementById('screen');
  if (canvas) canvas.style.display = 'none';
}

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas || !canvas.getContext('2d')) {
    showMessage('This game needs a browser with 2D canvas support. Please try a current desktop browser.');
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('debug') === '1';
  const gallery = params.get('gallery') === '1';
  const seedParam = params.get('seed');
  const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0;

  const presenter = new Presenter(canvas);
  const renderer = new Renderer();
  const audio = new Audio();
  const mapper = new InputMapper();
  const clock = new FixedStepClock();
  const splash = new FlickerSplash();
  const game = new Game({ seed });
  let crt = readFlag(CRT_KEY, true);
  let showSplash = !debug && !gallery;
  let last = performance.now();
  const started = last;

  const fit = (): void => {
    presenter.fit(window.innerWidth, window.innerHeight);
  };
  fit();
  window.addEventListener('resize', fit);

  const unlock = (): void => audio.unlock();
  attachKeyboard(
    mapper,
    (action) => {
      if (action === 'crt') toggleCrt();
      if (action === 'mute') toggleMute();
    },
    unlock,
  );

  function toggleCrt(): void {
    crt = !crt;
    writeFlag(CRT_KEY, crt);
    renderer.toast(crt ? 'CRT ON' : 'CRT OFF');
    audio.play('blip');
  }

  function toggleMute(): void {
    audio.setMuted(!audio.isMuted);
    renderer.toast(audio.isMuted ? 'SOUND OFF' : 'SOUND ON');
  }

  /** Runs one 60 Hz step: splash or game. */
  function simulate(input: StepInput): void {
    if (showSplash) {
      splash.step(input.pressed.length > 0);
      for (const e of splash.drainEvents()) {
        if (e.type === 'jingle') audio.play('itemGet');
        if (e.type === 'pop') audio.play('pop');
        if (e.type === 'done') showSplash = false;
      }
      return;
    }
    game.step(input);
    handleOutputs(game.drainOutbox());
  }

  function handleOutputs(outs: GameOutput[]): void {
    renderer.consume(outs);
    for (const o of outs) {
      if (o.type === 'sfx') audio.play(o.name);
      else if (o.type === 'music') audio.setMusic(o.track);
    }
  }

  // Debug hooks: __mall.step(n, pads) runs n steps with pads held.
  if (debug) {
    installDebug(
      () => game,
      (input) => {
        game.step(input);
        handleOutputs(game.drainOutbox());
      },
    );
  }

  function frame(now: number): void {
    const elapsed = now - last;
    last = now;
    // In debug mode the scripted playtest steps the game itself (window.__mall.step), so real time is paused.
    const steps = debug ? 0 : clock.advance(elapsed);
    pollGamepads(mapper, unlock);
    for (let i = 0; i < steps; i++) {
      const input = mapper.takeStep();
      simulate(input);
    }
    for (const sys of mapper.takeSystemActions()) {
      if (sys === 'crt') toggleCrt();
      if (sys === 'mute') toggleMute();
    }
    // Hum on while riding a car.
    audio.setHum(!showSplash && game.world?.player.mode === 'car' && game.screen === 'mall');
    draw(now);
    requestAnimationFrame(frame);
  }

  function draw(now: number): void {
    const g = renderer.buf.getContext('2d')!;
    if (gallery) {
      drawGallery(g, renderer.assets, Math.floor((now - started) / 16));
    } else if (showSplash) {
      splash.draw(g);
    } else {
      renderer.draw(game);
    }
    presenter.present(renderer.buf, crt, now / 1000);
  }

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

boot();
