import { SCREEN_W, SCREEN_H, GameScreen } from './engine/types';
import { Button, KeyboardInput, GamepadInput, mergeInputStates, createInputState } from './engine/input';
import { GameLoop } from './engine/loop';
import { createInitialState, GameState } from './game/state';
import { updateGame, initStores } from './game/simulation';
import { GameRenderer } from './rendering/renderer';
import { AudioManager } from './audio/audio-manager';

const params = new URLSearchParams(window.location.search);
const seedParam = params.get('seed');
const debugParam = params.get('debug') === '1';
const galleryParam = params.get('gallery') === '1';
const seed = seedParam ? parseInt(seedParam, 10) : (Date.now() & 0x7fffffff);

const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas || !canvas.getContext('2d')) {
  const errorEl = document.getElementById('error-msg');
  if (errorEl) errorEl.style.display = 'block';
  throw new Error('Canvas 2D not supported');
}

canvas.width = SCREEN_W;
canvas.height = SCREEN_H;

const renderer = new GameRenderer(canvas);
const audio = new AudioManager();

let crtPref = true;
try {
  const saved = localStorage.getItem('mall-action-crt');
  if (saved !== null) crtPref = saved === '1';
} catch {}

let mutePref = false;
try {
  const saved = localStorage.getItem('mall-action-mute');
  if (saved !== null) mutePref = saved === '1';
} catch {}

function showToast(msg: string): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

function toggleCRT(): void {
  crtPref = !crtPref;
  renderer.setCRT(crtPref);
  gameState.crtEnabled = crtPref;
  try { localStorage.setItem('mall-action-crt', crtPref ? '1' : '0'); } catch {}
  showToast(crtPref ? 'CRT ON' : 'CRT OFF');
}

function toggleMute(): void {
  mutePref = !mutePref;
  if (mutePref) audio.mute(); else audio.unmute();
  gameState.muted = mutePref;
  try { localStorage.setItem('mall-action-mute', mutePref ? '1' : '0'); } catch {}
  showToast(mutePref ? 'SOUND OFF' : 'SOUND ON');
}

const keyboard = new KeyboardInput(toggleCRT, toggleMute);
keyboard.attach(window);
const gamepad = new GamepadInput();

let gameState: GameState = createInitialState(seed, debugParam);
initStores(gameState);
gameState.crtEnabled = crtPref;
gameState.muted = mutePref;
renderer.setCRT(crtPref);

if (mutePref) audio.mute();

let audioInitialized = false;

function initAudioOnInput(): void {
  if (audioInitialized) return;
  audioInitialized = true;
  audio.init();
  if (mutePref) audio.mute();
}

function handleEvents(events: import('./game/state').GameEvent[]): void {
  for (const ev of events) {
    if (!audio.isReady()) continue;

    switch (ev.type) {
      case 'sfx_shot': audio.sfx.shot(); break;
      case 'sfx_enemy_shot': audio.sfx.enemyShot(); break;
      case 'sfx_jump': audio.sfx.jump(); break;
      case 'sfx_elevator_ding': audio.sfx.elevatorDing(); break;
      case 'sfx_crush': audio.sfx.crush(); break;
      case 'sfx_lamp_fall': audio.sfx.lampFall(); break;
      case 'sfx_search_tick': audio.sfx.searchTick(); break;
      case 'sfx_package_fanfare': audio.sfx.packageFanfare(); break;
      case 'sfx_powerup': audio.sfx.powerUp(); break;
      case 'sfx_hurt': audio.sfx.hurt(); break;
      case 'sfx_death': audio.sfx.death(); break;
      case 'sfx_door': audio.sfx.door(); break;
      case 'sfx_text_blip': audio.sfx.textBlip(); break;
      case 'sfx_whistle': audio.sfx.whistle(); break;
      case 'sfx_helmet_ping': audio.sfx.helmetPing(); break;
      case 'sfx_coins': audio.sfx.coins(); break;
      case 'sfx_slide': audio.sfx.slide(); break;
      case 'sfx_zipline': audio.sfx.zipline(); break;
      case 'sfx_pa_chime': audio.sfx.paChime(); break;
      case 'sfx_smoke': audio.sfx.smoke(); break;
      case 'sfx_shriek': audio.sfx.shriek(); break;
      case 'sfx_buzzer': audio.sfx.buzzer(); break;
      case 'sfx_pause': audio.sfx.pause(); break;
      case 'sfx_camera_flash': audio.sfx.cameraFlash(); break;
      case 'sfx_countdown': audio.sfx.countdown(); break;
      case 'play_title_music': audio.music.playTitle(); break;
      case 'play_mall_music': audio.music.playMall(); break;
      case 'play_alarm_music': audio.music.playAlarm(); break;
      case 'play_elevator_music': audio.music.playElevator(); break;
      case 'play_store_music': audio.music.playStore(ev.data as string); break;
      case 'play_bonus_track': audio.music.playBonus(); break;
      case 'play_level_clear': audio.music.playLevelClear(); break;
      case 'play_game_over': audio.music.playGameOver(); break;
      case 'play_item_get': audio.music.playItemGet(); break;
      case 'splash_jingle': audio.music.playSplashJingle(); break;
      case 'stop_music': audio.music.stop(); break;
      case 'pause_music': audio.music.pause(); break;
      case 'resume_music': audio.music.resume(); break;
      case 'music_volume':
        audio.music.setVolume(ev.data as number);
        break;
    }
  }
}

function step(): void {
  const kbInput = keyboard.poll();
  const gpInput = gamepad.poll();
  const input = mergeInputStates(kbInput, gpInput);

  if (input.pressed.some(Boolean) || input.held.some(Boolean)) {
    initAudioOnInput();
  }

  const events = updateGame(gameState, input);
  handleEvents(events);
}

function render(_alpha: number): void {
  renderer.render(gameState);
}

if (galleryParam) {
  renderer.renderGallery();
} else {
  const loop = new GameLoop(step, render);
  loop.start();

  window.addEventListener('resize', () => renderer.resize());

  if (debugParam) {
    (window as unknown as Record<string, unknown>)['mallAction'] = {
      state: gameState,
      step: (frames: number, buttons?: number[]) => {
        const input = createInputState();
        if (buttons) {
          for (const b of buttons) {
            if (b >= 0 && b < 8) {
              input.held[b] = true;
              input.pressed[b] = true;
            }
          }
        }
        for (let i = 0; i < frames; i++) {
          const events = updateGame(gameState, input);
          handleEvents(events);
          for (let j = 0; j < 8; j++) input.pressed[j] = false;
        }
        renderer.render(gameState);
      },
    };
  }
}
