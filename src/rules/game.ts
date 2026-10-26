// The Game class: owns all state, advances one frame per step, and dispatches
// to the mall / store simulations. Pure logic — no DOM, audio or canvas.

import { Rng } from "../rng";
import type { PadFrame, Button } from "../input";
import {
  FLOOR_Y,
  START_LIVES,
  MAX_CONTINUES,
  EXTRA_LIFE_SCORE,
  PACKAGE_COUNT,
} from "./types";
import type {
  GameEvent,
  MallState,
  StoreState,
  Screen,
  PowerupKind,
  ActivePowerup,
} from "./types";
import { STORES, TARGET_STORES, storeById } from "./layout";
import { SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE, HEADLINES } from "../copy";
import type { SpygramPost } from "../copy";
import { stepMall, createMall } from "./mall";
import { stepStore, createStore } from "./store";

export interface GameOptions {
  seed: number;
  debug?: boolean;
  skipSplash?: boolean;
}

export interface LevelClearState {
  timer: number;
  phase: number; // 0 tally, 1 headline, 2 post
  headline: string;
  post: SpygramPost;
  packages: number;
  timeBonus: number;
  clearBonus: number;
}

export class Game {
  rng: Rng;
  screen: Screen;
  frame: number;
  score: number;
  lives: number;
  continues: number;
  loop: number;
  highScore: number;
  blackFriday: boolean;
  packages: Set<string>;
  inventory: string[];
  photoStrip: boolean;
  extraLifeGiven: boolean;

  // Splash / title.
  splashTimer: number;
  splashPhase: number;
  titleTimer: number;
  konami: Button[];
  blackFridayFlash: number;

  // Mall.
  mall: MallState;
  mallIntro: { phase: "zipline" | "selfie" | "play"; timer: number };
  arrivalPost: SpygramPost | null;

  // Store.
  store: StoreState | null;

  // Level clear / continue / game over.
  levelClear: LevelClearState | null;
  continueTimer: number;
  gameoverTimer: number;

  // Map / pause.
  mapOpen: boolean;
  paused: boolean;

  events: GameEvent[];
  debug: boolean;

  constructor(opts: GameOptions) {
    this.rng = new Rng(opts.seed);
    this.debug = opts.debug ?? false;
    this.screen = opts.skipSplash ? "title" : "splash";
    this.frame = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.continues = MAX_CONTINUES;
    this.loop = 1;
    this.highScore = 0;
    this.blackFriday = false;
    this.packages = new Set();
    this.inventory = [];
    this.photoStrip = false;
    this.extraLifeGiven = false;

    this.splashTimer = 0;
    this.splashPhase = 0;
    this.titleTimer = 0;
    this.konami = [];
    this.blackFridayFlash = 0;

    this.mall = createMall(this.rng);
    this.mallIntro = { phase: "zipline", timer: 0 };
    this.arrivalPost = null;
    this.store = null;
    this.levelClear = null;
    this.continueTimer = 0;
    this.gameoverTimer = 0;
    this.mapOpen = false;
    this.paused = false;
    this.events = [];
  }

  // -------------------------------------------------------------------------
  // Step.
  // -------------------------------------------------------------------------

  step(pad: PadFrame): GameEvent[] {
    this.events = [];
    this.frame++;

    switch (this.screen) {
      case "splash":
        this.stepSplash(pad);
        break;
      case "title":
        this.stepTitle(pad);
        break;
      case "mall":
        this.stepMallScreen(pad);
        break;
      case "store":
        this.stepStoreScreen(pad);
        break;
      case "map":
        this.stepMap(pad);
        break;
      case "pause":
        this.stepPause(pad);
        break;
      case "levelclear":
        this.stepLevelClear(pad);
        break;
      case "continue":
        this.stepContinue(pad);
        break;
      case "gameover":
        this.stepGameOver(pad);
        break;
    }

    return this.events;
  }

  emit(type: string, extra: Record<string, unknown> = {}): void {
    this.events.push({ type, ...extra });
  }

  // -------------------------------------------------------------------------
  // Splash.
  // -------------------------------------------------------------------------

  private stepSplash(pad: PadFrame): void {
    this.splashTimer++;
    if (pad.pressed.length > 0) {
      this.screen = "title";
      this.titleTimer = 0;
      return;
    }
    // phase 0: flicker (~60 frames), phase 1: settle + PRESENTS (~120 frames).
    if (this.splashPhase === 0 && this.splashTimer >= 60) {
      this.splashPhase = 1;
      this.emit("jingle");
    }
    if (this.splashPhase === 1 && this.splashTimer >= 180) {
      this.screen = "title";
      this.titleTimer = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Title.
  // -------------------------------------------------------------------------

  private stepTitle(pad: PadFrame): void {
    this.titleTimer++;
    if (this.blackFridayFlash > 0) this.blackFridayFlash--;

    // Konami code: up up down down left right left right B A.
    const seq: Button[] = [
      "up",
      "up",
      "down",
      "down",
      "left",
      "right",
      "left",
      "right",
      "b",
      "a",
    ];
    for (const b of pad.pressed) {
      this.konami.push(b);
      if (this.konami.length > seq.length + 2) this.konami.shift();
    }
    if (this.konami.length >= seq.length) {
      const tail = this.konami.slice(-seq.length);
      if (tail.every((b, i) => b === seq[i])) {
        this.blackFriday = true;
        this.blackFridayFlash = 120;
        this.konami = [];
        this.emit("blackfriday");
      }
    }

    if (pad.pressed.includes("start")) {
      this.startGame();
    }
  }

  private startGame(): void {
    this.screen = "mall";
    this.mall = createMall(this.rng);
    this.mallIntro = { phase: "zipline", timer: 0 };
    this.arrivalPost = this.rng.pick(SPYGRAM_ARRIVAL);
    this.emit("start");
  }

  // -------------------------------------------------------------------------
  // Mall.
  // -------------------------------------------------------------------------

  private stepMallScreen(pad: PadFrame): void {
    // Intro (zipline + selfie) before play.
    if (this.mallIntro.phase !== "play") {
      this.mallIntro.timer++;
      if (this.mallIntro.phase === "zipline" && this.mallIntro.timer >= 90) {
        this.mallIntro.phase = "selfie";
        this.mallIntro.timer = 0;
        this.emit("thud");
      } else if (
        this.mallIntro.phase === "selfie" &&
        this.mallIntro.timer >= 150
      ) {
        this.mallIntro.phase = "play";
        this.mallIntro.timer = 0;
      }
      if (pad.pressed.length > 0 && this.mallIntro.phase === "selfie") {
        this.mallIntro.phase = "play";
        this.mallIntro.timer = 0;
      }
      return;
    }

    // Map / pause toggles.
    if (pad.pressed.includes("select")) {
      this.mapOpen = true;
      this.screen = "map";
      this.emit("pause");
      return;
    }
    if (pad.pressed.includes("start")) {
      this.paused = true;
      this.screen = "pause";
      this.emit("pause");
      return;
    }

    stepMall(this, pad);
  }

  // -------------------------------------------------------------------------
  // Store.
  // -------------------------------------------------------------------------

  private stepStoreScreen(pad: PadFrame): void {
    if (pad.pressed.includes("select")) {
      this.mapOpen = true;
      this.screen = "map";
      this.emit("pause");
      return;
    }
    if (pad.pressed.includes("start")) {
      this.paused = true;
      this.screen = "pause";
      this.emit("pause");
      return;
    }
    if (this.store) stepStore(this, pad);
  }

  // -------------------------------------------------------------------------
  // Map / pause.
  // -------------------------------------------------------------------------

  private stepMap(pad: PadFrame): void {
    if (pad.pressed.includes("select") || pad.pressed.includes("start")) {
      this.mapOpen = false;
      this.screen = this.store ? "store" : "mall";
      this.emit("unpause");
    }
  }

  private stepPause(pad: PadFrame): void {
    if (pad.pressed.includes("start")) {
      this.paused = false;
      this.screen = this.store ? "store" : "mall";
      this.emit("unpause");
    }
  }

  // -------------------------------------------------------------------------
  // Level clear.
  // -------------------------------------------------------------------------

  private stepLevelClear(pad: PadFrame): void {
    if (!this.levelClear) return;
    this.levelClear.timer++;
    if (pad.pressed.includes("start")) {
      this.nextLoop();
      return;
    }
    if (this.levelClear.phase === 0 && this.levelClear.timer >= 120) {
      this.levelClear.phase = 1;
    } else if (this.levelClear.phase === 1 && this.levelClear.timer >= 240) {
      this.levelClear.phase = 2;
    } else if (this.levelClear.phase === 2 && this.levelClear.timer >= 360) {
      this.nextLoop();
    }
  }

  private nextLoop(): void {
    this.loop++;
    this.levelClear = null;
    this.screen = "mall";
    this.mall = createMall(this.rng);
    this.mallIntro = { phase: "zipline", timer: 0 };
  }

  // -------------------------------------------------------------------------
  // Continue / game over.
  // -------------------------------------------------------------------------

  private stepContinue(pad: PadFrame): void {
    this.continueTimer++;
    if (this.continueTimer >= 9 * 60) {
      this.gameOver();
      return;
    }
    if (pad.pressed.includes("start")) {
      this.lives = START_LIVES;
      this.continues--;
      this.screen = "mall";
      this.mall = createMall(this.rng);
      this.mallIntro = { phase: "play", timer: 0 };
      this.emit("start");
    }
  }

  private stepGameOver(pad: PadFrame): void {
    this.gameoverTimer++;
    if (this.gameoverTimer >= 180 && pad.pressed.includes("start")) {
      this.resetToTitle();
    }
  }

  private resetToTitle(): void {
    this.screen = "title";
    this.titleTimer = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.continues = MAX_CONTINUES;
    this.loop = 1;
    this.packages = new Set();
    this.inventory = [];
    this.photoStrip = false;
    this.extraLifeGiven = false;
    this.blackFriday = false;
    this.konami = [];
    this.store = null;
    this.levelClear = null;
    this.mapOpen = false;
    this.paused = false;
  }

  // -------------------------------------------------------------------------
  // Shared transitions (called from mall/store sims).
  // -------------------------------------------------------------------------

  enterStore(id: string): void {
    const def = storeById(id);
    if (def.role === "closed") return;
    if (def.role === "target" && this.packages.has(id)) return;
    this.store = createStore(this, id);
    this.screen = "store";
    this.emit("door");
  }

  exitStore(): void {
    this.store = null;
    this.screen = "mall";
    this.emit("door");
  }

  triggerLevelClear(): void {
    if (this.mall.levelClearFired) return;
    this.mall.levelClearFired = true;
    const timeBonus = Math.max(0, 300 - Math.floor(this.mall.time / 60)) * 10;
    const clearBonus = 1000;
    const pkgBonus = PACKAGE_COUNT * 500;
    this.addScore(pkgBonus + timeBonus + clearBonus);
    this.levelClear = {
      timer: 0,
      phase: 0,
      headline: this.rng.pick(HEADLINES),
      post: this.rng.pick(SPYGRAM_COMPLETE),
      packages: PACKAGE_COUNT,
      timeBonus,
      clearBonus,
    };
    this.screen = "levelclear";
    this.emit("levelclear");
  }

  playerDied(): void {
    this.lives--;
    this.emit("death");
    if (this.lives <= 0) {
      if (this.continues > 0) {
        this.screen = "continue";
        this.continueTimer = 0;
      } else {
        this.gameOver();
      }
    } else {
      // Respawn in place (mall sim handles clearing).
      this.screen = "mall";
    }
  }

  private gameOver(): void {
    this.screen = "gameover";
    this.gameoverTimer = 0;
    if (this.score > this.highScore) this.highScore = this.score;
    this.emit("gameover");
  }

  addScore(n: number): void {
    this.score += n;
    if (!this.extraLifeGiven && this.score >= EXTRA_LIFE_SCORE) {
      this.extraLifeGiven = true;
      this.lives++;
      this.emit("oneup");
    }
  }

  // -------------------------------------------------------------------------
  // Power-ups.
  // -------------------------------------------------------------------------

  applyPowerup(kind: PowerupKind): void {
    const p = this.mall.player;
    switch (kind) {
      case "rapid":
        p.weapon = "rapid";
        p.weaponTimer = 20 * 60;
        break;
      case "spread":
        p.weapon = "spread";
        p.weaponTimer = 20 * 60;
        break;
      case "armor":
      case "pretzel":
        p.armor = true;
        break;
      case "sneakers":
        p.speedTimer = 20 * 60;
        break;
      case "juliooze":
        p.speedTimer = 12 * 60;
        break;
      case "radar":
        p.radar = true;
        break;
      case "oneup":
        this.lives++;
        this.emit("oneup");
        break;
      case "cinnabomb":
        p.invincible = 6 * 60;
        break;
    }
    this.addScore(50);
    this.emit("powerup", { kind });
  }

  activePowerups(): ActivePowerup[] {
    const p = this.mall.player;
    const out: ActivePowerup[] = [];
    if (p.weapon === "rapid") out.push({ kind: "rapid", framesLeft: p.weaponTimer });
    if (p.weapon === "spread") out.push({ kind: "spread", framesLeft: p.weaponTimer });
    if (p.speedTimer > 0) {
      out.push({
        kind: p.speedTimer > 12 * 60 ? "sneakers" : "juliooze",
        framesLeft: p.speedTimer,
      });
    }
    if (p.invincible > 0) out.push({ kind: "cinnabomb", framesLeft: p.invincible });
    return out;
  }

  // -------------------------------------------------------------------------
  // Helpers for rendering.
  // -------------------------------------------------------------------------

  packagesCollected(): number {
    return this.packages.size;
  }

  targetStoresRemaining(): number {
    return TARGET_STORES.filter((s) => !this.packages.has(s.id)).length;
  }

  floorY(floor: string): number {
    return FLOOR_Y[floor as keyof typeof FLOOR_Y] ?? 0;
  }

  allStores(): typeof STORES {
    return STORES;
  }
}
