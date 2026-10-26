// Entry point: game loop, input, audio, rendering, debug support.

import { Game } from "./rules/game";
import { Renderer } from "./render/renderer";
import { AudioEngine } from "./audio";
import type { SfxName } from "./audio";
import { VirtualPad, resolveKey, applyGamepad } from "./input";
import type { Button } from "./input";
import { buildSprites } from "./sprites";
import { PALETTE } from "./palette";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const nosupport = document.getElementById("nosupport")!;

if (!canvas.getContext) {
  nosupport.style.display = "block";
  throw new Error("no canvas support");
}

const params = new URLSearchParams(window.location.search);
const seedParam = params.get("seed");
const debug = params.get("debug") === "1";
const gallery = params.get("gallery") === "1";

const seed = seedParam ? parseInt(seedParam, 10) || 0 : Math.floor(Math.random() * 0xffffffff);

const game = new Game({ seed, debug, skipSplash: debug || gallery });
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const pad = new VirtualPad();

// CRT persistence.
const savedCrt = localStorage.getItem("mall-action-crt");
renderer.crtEnabled = savedCrt === null ? true : savedCrt === "1";

let toast = "";
let toastTimer = 0;

function showToast(msg: string): void {
  toast = msg;
  toastTimer = 90;
}

// ---------------------------------------------------------------------------
// Input.
// ---------------------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "c") {
    renderer.crtEnabled = !renderer.crtEnabled;
    localStorage.setItem("mall-action-crt", renderer.crtEnabled ? "1" : "0");
    showToast(renderer.crtEnabled ? "CRT ON" : "CRT OFF");
    return;
  }
  if (k === "m") {
    audio.setMuted(!audio.muted);
    showToast(audio.muted ? "SOUND OFF" : "SOUND ON");
    return;
  }
  audio.init();
  const btn = resolveKey(e.key, e.code);
  if (btn) {
    pad.keyDown(e.code, btn);
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  pad.keyUp(e.code);
});

function pollGamepad(): void {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gps[0] ?? null;
  if (gp) audio.init();
  applyGamepad(pad, gp);
}

// ---------------------------------------------------------------------------
// Debug helpers.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    mallGame?: Game;
    stepGame?: (n: number, buttons?: Button[]) => void;
  }
}

if (debug) {
  window.mallGame = game;
  window.stepGame = (n: number, buttons: Button[] = []) => {
    for (let i = 0; i < n; i++) {
      for (const b of buttons) pad.press(b);
      const events = game.step(pad.sample());
      handleEvents(events);
      for (const b of buttons) pad.release(b);
    }
  };
}

// ---------------------------------------------------------------------------
// Events -> audio.
// ---------------------------------------------------------------------------

const SFX_MAP: Record<string, SfxName> = {
  shot: "shot",
  enemyshot: "enemyshot",
  jump: "jump",
  ding: "ding",
  crush: "crush",
  lamp: "lamp",
  glass: "glass",
  search: "search",
  package: "package",
  powerup: "powerup",
  hurt: "hurt",
  death: "death",
  door: "door",
  text: "text",
  whistle: "whistle",
  helmet: "helmet",
  coins: "coins",
  slide: "slide",
  pa: "pa",
  smoke: "smoke",
  shriek: "shriek",
  buzzer: "buzzer",
  pause: "pause",
  jingle: "jingle",
  oneup: "oneup",
  itemget: "itemget",
  levelclear: "levelclear",
  gameover: "gameover",
  alarm: "alarm",
  escalator: "escalator",
  kiosk: "kiosk",
  booth: "booth",
  trap: "trap",
  nothing: "nothing",
  spydead: "spydead",
  armorbreak: "armorbreak",
  blackfriday: "blackfriday",
  start: "start",
  unpause: "unpause",
  thud: "thud",
};

function handleEvents(events: { type: string }[]): void {
  for (const e of events) {
    const sfx = SFX_MAP[e.type];
    if (sfx) audio.sfx(sfx);
  }
  updateMusic();
}

function updateMusic(): void {
  let track = "mall";
  if (game.screen === "title") track = "title";
  else if (game.screen === "store") track = "store";
  else if (game.screen === "mall") {
    track = game.mall.alarm ? "alarm" : game.mall.player.riding ? "elevator" : "mall";
  } else if (game.screen === "levelclear" || game.screen === "gameover") {
    audio.stopMusic();
    return;
  }
  audio.startMusic(track);
}

// ---------------------------------------------------------------------------
// Gallery mode.
// ---------------------------------------------------------------------------

function drawGallery(): void {
  const sprites = buildSprites();
  const entries = Object.entries(sprites);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = 4;
  let x = 8;
  let y = 8;
  for (const [name, spr] of entries) {
    if (x + spr.w * scale > canvas.width) {
      x = 8;
      y += 40;
    }
    for (let py = 0; py < spr.h; py++) {
      for (let pxx = 0; pxx < spr.w; pxx++) {
        const c = spr.px[py * spr.w + pxx];
        if (c === 0) continue;
        ctx.fillStyle = PALETTE[c];
        ctx.fillRect(x + pxx * scale, y + py * scale, scale, scale);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.fillText(name, x, y + spr.h * scale + 8);
    x += spr.w * scale + 16;
  }
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
}

window.addEventListener("resize", resize);
resize();

const STEP_MS = 1000 / 60;
let last = performance.now();
let acc = 0;

function loop(now: number): void {
  if (gallery) {
    drawGallery();
    requestAnimationFrame(loop);
    return;
  }

  pollGamepad();

  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250; // clamp after tab switch
  acc += dt;

  let steps = 0;
  while (acc >= STEP_MS && steps < 5) {
    const events = game.step(pad.sample());
    handleEvents(events);
    acc -= STEP_MS;
    steps++;
  }
  if (steps >= 5) acc = 0;

  renderer.render(game);

  // Toast.
  if (toastTimer > 0) {
    toastTimer--;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(toast, 16, 24);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
