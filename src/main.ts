import { Framebuffer } from './engine/framebuffer';
import { FixedStepLoop } from './engine/loop';
import { Input, gamepadMask, resolveKey } from './engine/input';
import { NO_PAD, padFromHeld, parseButtons, type Pad } from './engine/pad';
import { Game } from './game/game';
import { Presenter } from './render/presenter';
import { renderGame } from './render/gameView';
import { Gallery } from './render/gallery';
import { Osd } from './render/osd';
import { AudioEngine } from './audio';
import { UI } from './content/copy';
import './art';

/**
 * Browser bootstrap ONLY: canvas + WebGL presenter, input events, audio unlock, the rAF loop and the debug API.
 * All rules live in src/game (pure); this file never decides anything about the game itself.
 */
const params = new URLSearchParams(location.search);
const debug = params.get('debug') === '1';
const galleryMode = params.get('gallery') === '1';
const seedParam = params.get('seed');
const seed = seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 1;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const fallback = document.getElementById('fallback') as HTMLElement;

function showFallback(msg: string): void {
  canvas.style.display = 'none';
  fallback.style.display = 'block';
  fallback.textContent = msg;
}

const presenter = Presenter.create(canvas);
if (!presenter) {
  showFallback(UI.noGfx);
} else {
  start(presenter);
}

function readSetting(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(`mall-action:${key}`);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}

function writeSetting(key: string, v: boolean): void {
  try {
    localStorage.setItem(`mall-action:${key}`, v ? '1' : '0');
  } catch {
    /* private window / blocked storage: the setting just does not persist */
  }
}

function start(presenter: Presenter): void {
  const fb = new Framebuffer();
  const input = new Input();
  const osd = new Osd();
  const audio = new AudioEngine();
  const gallery = galleryMode ? new Gallery() : null;
  const game = new Game({
    seed,
    skipSplash: debug,
    autostart: params.get('start') === '1',
    skipIntro: params.get('skipintro') === '1',
  });

  let crt = readSetting('crt', true);
  audio.setMuted(readSetting('mute', false));

  // ---------------------------------------------------------------- the single advance function
  /** Advance the game one 60 Hz frame (used by the rAF loop and by the debug stepper) and sync audio. */
  function advance(pad: Pad): void {
    if (gallery) gallery.step(pad);
    else game.step(pad);
    if (!gallery) {
      for (const s of game.drainSfx()) {
        audio.sfx(s);
        if (debug) sfxLog.push(s);
      }
      audio.setMusic(game.music());
      audio.setDuck(game.duck());
    }
  }
  const sfxLog: string[] = [];
  const loop = new FixedStepLoop(() => advance(input.sampleStep()));

  // ---------------------------------------------------------------- resize
  let lastW = 0;
  let lastH = 0;
  let lastDpr = 0;
  function fit(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    if (w === lastW && h === lastH && dpr === lastDpr) return;
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    presenter.resize(w, h, dpr);
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------------------------------------------------------------- input events
  let audioUnlocked = false;
  function unlockAudio(): void {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audio.unlock();
  }
  function isGameKey(e: KeyboardEvent): boolean {
    return resolveKey(e.key, e.code) !== null || e.code === 'Space' || e.code === 'Tab';
  }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    unlockAudio();
    if (isGameKey(e)) e.preventDefault();
    input.keyDown(e.key, e.code, e.repeat);
  });
  window.addEventListener('keyup', (e) => {
    if (isGameKey(e)) e.preventDefault();
    input.keyUp(e.key, e.code);
  });
  const releaseAll = (): void => input.releaseAll();
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  window.addEventListener('pointerdown', () => {
    unlockAudio();
    canvas.focus();
  });
  window.addEventListener('gamepadconnected', () => {
    osd.show('GAMEPAD ON');
  });
  window.addEventListener('gamepaddisconnected', () => {
    osd.show('GAMEPAD OFF');
    input.setGamepad(0);
  });
  canvas.focus();

  function pollGamepads(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let mask = 0;
    for (const gp of pads) {
      if (gp && gp.connected) mask |= gamepadMask(gp);
    }
    if (mask !== 0) unlockAudio();
    input.setGamepad(mask);
  }

  function handleSystem(): void {
    for (const a of input.drainSystem()) {
      if (a === 'crt') {
        crt = !crt;
        writeSetting('crt', crt);
        osd.show(crt ? UI.crtOn : UI.crtOff);
      } else {
        audio.setMuted(!audio.isMuted());
        writeSetting('mute', audio.isMuted());
        osd.show(audio.isMuted() ? UI.soundOff : UI.soundOn);
      }
    }
  }

  // ---------------------------------------------------------------- draw
  function draw(timeMs: number): void {
    if (gallery) gallery.draw(fb);
    else renderGame(fb, game);
    osd.draw(fb);
    osd.tick();
    presenter.present(fb, crt, timeMs / 1000);
  }

  // ---------------------------------------------------------------- real-time loop
  let last = performance.now();
  const dbg = { realtime: true };
  function frame(now: number): void {
    const dt = now - last;
    last = now;
    fit();
    pollGamepads();
    handleSystem();
    if (dbg.realtime) loop.advance(dt);
    draw(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- debug API (?debug=1)
  if (debug) {
    let held = 0;
    const summary = () => {
      const lv = game.level;
      const p = lv?.mall.player;
      return {
        seed,
        scene: game.scene,
        frame: game.frame,
        music: game.music(),
        run: game.run
          ? {
              score: game.run.score,
              lives: game.run.lives,
              packages: game.run.packages,
              loop: game.run.loop,
              continuesLeft: game.run.continuesLeft,
              alarm: game.run.alarmOn,
              levelFrames: game.run.levelFrames,
              power: game.run.power,
            }
          : null,
        level: lv
          ? {
              inStore: lv.store ? lv.store.storeId : null,
              overlay: lv.overlay,
              fade: lv.fade ? lv.fade.dir : null,
              intro: lv.mall.intro ? lv.mall.intro.phase : null,
              spies: lv.mall.spies.length,
              cars: lv.mall.cars.map((c) => ({ id: c.id, y: c.y, dir: c.dir })),
              banner: lv.mall.banner ? lv.mall.banner.text : null,
            }
          : null,
        player: p ? { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, floor: p.floor, mode: p.mode, face: p.face, car: p.car, roof: p.roof } : null,
        sfx: sfxLog.slice(-12),
      };
    };
    const api = {
      game,
      input,
      fb,
      audio,
      get realtime() {
        return dbg.realtime;
      },
      set realtime(v: boolean) {
        dbg.realtime = v;
      },
      /** Step the game N frames with the given buttons held (e.g. 'RIGHT+A' or a bit mask). Edges are derived. */
      step(frames = 1, buttons: string | number = 0) {
        const mask = parseButtons(buttons);
        for (let i = 0; i < frames; i++) {
          advance(padFromHeld(held, mask));
          held = mask;
        }
        draw(performance.now());
        return summary();
      },
      /** Press and release one button (1 frame down, 1 frame up). */
      tap(buttons: string | number, frames = 1) {
        (this as { step(f: number, b: string | number): unknown }).step(frames, buttons);
        return (this as { step(f: number, b: string | number): unknown }).step(1, 0);
      },
      render() {
        draw(performance.now());
      },
      state: summary,
      /** The framebuffer as a PNG data URL (exact game pixels, no CRT). */
      shot(): string {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 240;
        const ctx = c.getContext('2d')!;
        const img = ctx.createImageData(256, 240);
        fb.toRGBA(img.data);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL('image/png');
      },
      NO_PAD,
    };
    // The scripted player used by the tests, runnable in the real page (renders every frame, so every view is exercised).
    const botApi = {
      immortal: true,
      renderEvery: true,
      lib: null as null | typeof import('./game/bot'),
      rig: {
        get w() {
          return game.level!.mall;
        },
        get world() {
          return game.level!.store!;
        },
        hold(mask: number, n = 1) {
          for (let i = 0; i < n; i++) {
            if (botApi.immortal && game.run) game.run.power.invincible = 1e6;
            advance(padFromHeld(held, mask));
            held = mask;
            if (botApi.renderEvery) draw(performance.now());
          }
        },
        tap(b: number) {
          botApi.rig.hold(b, 1);
          botApi.rig.hold(0, 1);
        },
      },
    };
    void import('./game/bot').then((m) => {
      botApi.lib = m;
    });
    Object.assign(api, { bot: botApi });
    (window as unknown as { __mall: typeof api }).__mall = api;
  }
}
