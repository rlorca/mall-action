import { Application, Container, Graphics, TextureStyle } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { SCREEN_W, SCREEN_H } from './world/constants.js';
import { createFixedStep } from './core/loop.js';
import { createInput } from './core/input.js';
import { createSynth } from './audio/synth.js';
import { SceneManager } from './core/scenes.js';
import { makeText } from './gfx/font.js';
import { createKonami } from './logic/secrets.js';
import { createGameState } from './game/state.js';
import { TitleScene } from './scenes/TitleScene.js';
import { MallScene } from './scenes/MallScene.js';
import { StoreScene } from './scenes/StoreScene.js';
import { MapOverlay, drawMallMap } from './scenes/MapOverlay.js';
import { PauseOverlay } from './scenes/PauseOverlay.js';
import { LevelClearScene } from './scenes/LevelClearScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { ContinueOverlay } from './scenes/ContinueOverlay.js';
import { respawnPlayer } from './game/mallWorld.js';
import { loseLife, nextLoop } from './game/state.js';
import { GalleryScene } from './scenes/GalleryScene.js';
import { registerAllSprites } from './gfx/sprites/index.js';

TextureStyle.defaultOptions.scaleMode = 'nearest';

function fitScale() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H)));
}

async function boot() {
  const host = document.getElementById('app');
  const app = new Application();
  try {
    await app.init({ width: SCREEN_W, height: SCREEN_H, background: '#000000', antialias: false, roundPixels: true, resolution: 1, preference: 'webgl' });
  } catch (err) {
    host.textContent = 'WebGL is required to play Mall Action.';
    throw err;
  }
  host.appendChild(app.canvas);

  const root = new Container(); // everything at native 256×240 lives here
  app.stage.addChild(root);
  const sceneLayer = new Container(), overlayLayer = new Container();
  const fade = new Graphics().rect(0, 0, SCREEN_W, SCREEN_H).fill(0x000000);
  fade.alpha = 0;
  root.addChild(sceneLayer, overlayLayer, fade);
  // clip anything drawn outside the 256×240 screen
  const clip = new Graphics().rect(0, 0, SCREEN_W, SCREEN_H).fill(0xffffff);
  root.addChild(clip); root.mask = clip;

  const crt = new CRTFilter({ curvature: 4, lineWidth: 1.5, lineContrast: 0.35, noise: 0.08, noiseSize: 1, vignetting: 0.3, vignettingAlpha: 0.7 });
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* storage unavailable */ } };
  let crtOn = load('mallAction.crt', true);
  const applyFilters = () => { app.stage.filters = crtOn ? [crt] : []; };
  applyFilters();

  const resize = () => {
    const s = fitScale();
    app.renderer.resize(SCREEN_W * s, SCREEN_H * s);
    root.scale.set(s);
    crt.lineWidth = Math.max(1, s * 0.6);
    app.stage.filterArea = app.screen;
  };
  window.addEventListener('resize', resize);
  resize();

  const input = createInput(window);
  // on-screen confirmation for toggles
  const toast = new Container();
  root.addChild(toast);
  let toastT = 0;
  const showToast = (text) => {
    toast.removeChildren().forEach((c) => c.destroy({ children: true }));
    const t = makeText(text, '#fcfcfc');
    toast.addChild(new Graphics().rect(0, 0, t.width + 8, 12).fill(0x000000), t);
    t.position.set(4, 2);
    toast.position.set(Math.floor((SCREEN_W - t.width - 8) / 2), 104);
    toastT = 90;
  };
  input.onHotkey('c', () => { crtOn = !crtOn; applyFilters(); save('mallAction.crt', crtOn); showToast(crtOn ? 'CRT ON' : 'CRT OFF'); });
  const audio = createSynth();
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  input.onHotkey('m', () => { audio.toggleMute(); showToast(audio.muted ? 'SOUND OFF' : 'SOUND ON'); });

  const params = new URLSearchParams(location.search);
  const ctx = {
    pad: input.pad, input, audio, state: null, konami: createKonami(), highScore: 0,
    debug: params.has('debug'), seed: params.has('seed') ? Number(params.get('seed')) : null,
  };
  ctx.scenes = new SceneManager({ layer: sceneLayer, overlayLayer, setFade: (a) => { fade.alpha = a; } }, ctx);
  ctx.startGame = ({ blackFriday = false } = {}) => {
    ctx.state = createGameState({ seed: ctx.seed ?? undefined, blackFriday, highScore: ctx.highScore });
    ctx.mallScene = null;
    ctx.scenes.replace(new MallScene(), { newLevel: true });
  };
  ctx.toTitle = () => { ctx.highScore = Math.max(ctx.highScore, ctx.state?.score ?? 0); ctx.scenes.replace(new TitleScene()); };
  ctx.enterStore = (storeId) => ctx.scenes.replace(new StoreScene(), { storeId });
  ctx.exitStore = (storeId) => ctx.scenes.replace(ctx.mallScene, { fromStore: storeId });
  ctx.gameOver = () => ctx.scenes.replace(new GameOverScene());
  // last life lost: offer a continue if any are left, otherwise it's game over
  ctx.outOfLives = (onContinue) => {
    if (ctx.state.continues > 0) ctx.scenes.push(new ContinueOverlay(), { onContinue });
    else ctx.gameOver();
  };
  ctx.openPause = () => ctx.scenes.push(new PauseOverlay());
  ctx.openMap = (storeId) => ctx.scenes.push(new MapOverlay(), { storeId });
  ctx.drawMiniMap = (scene, storeId) => {
    const box = new Container();
    drawMallMap(box, ctx.state, scene.world, { x: 0, y: 0, w: 160, h: 72, highlightStoreId: storeId, labels: false });
    scene.showPanel([box], storeId ? 'GO TO THE WHITE STORE' : 'ALL PACKAGES FOUND!', 180);
  };
  ctx.levelClear = (levelFrames) => ctx.scenes.replace(new LevelClearScene(), { levelFrames });
  ctx.nextLoop = () => {
    nextLoop(ctx.state);
    ctx.mallScene = null;
    ctx.scenes.replace(new MallScene(), { newLevel: true });
  };
  ctx.onStoreDeath = (scene) => {
    if (loseLife(ctx.state) <= 0) { ctx.outOfLives(() => scene.respawn()); return; }
    scene.respawn();
  };
  ctx.onPlayerDied = (scene) => {
    const respawn = () => {
      const w = scene.world;
      respawnPlayer(w);
      ctx.audio.playMusic(w.alarm ? 'mallAlarm' : 'mall');
    };
    if (loseLife(ctx.state) <= 0) { ctx.outOfLives(respawn); return; }
    respawn();
  };
  if (ctx.debug) {
    window.__mall = ctx;
    ctx.app = app; ctx.root = root;
    // deterministic driver for automated playtests: hold `buttons` for `frames` fixed steps (first step counts as a press)
    ctx.drive = (buttons = [], frames = 1) => {
      ctx.manual = true; // scripted runs own the clock from now on
      for (let i = 0; i < frames; i++) { input.pad.step(new Set(buttons), i === 0 ? new Set(buttons) : new Set()); ctx.scenes.update(); }
      app.render();
      const top = ctx.scenes.scene;
      const p = top?.world?.player;
      return p ? { scene: top.constructor.name, mode: p.mode, floor: p.floor, x: Math.round(p.x), y: Math.round(p.y) } : null;
    };
  }

  await registerAllSprites();
  if (params.has('gallery')) ctx.scenes.replace(new GalleryScene(Number(params.get('page') ?? 0)), {}, { fade: false });
  else ctx.scenes.replace(new TitleScene(), {}, { fade: false });

  const fixed = createFixedStep();
  app.ticker.add((t) => {
    if (!ctx.manual) fixed.advance(t.deltaMS, () => { input.poll(); ctx.scenes.update(); });
    if (crtOn) { crt.time += 0.5; crt.seed = Math.random(); }
    if (toastT > 0 && --toastT === 0) toast.removeChildren();
  });
}

boot();
