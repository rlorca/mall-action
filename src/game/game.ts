import { GameEngine } from "./logic";
import { GameRenderer } from "./renderer";
import { InputManager } from "../input/input";
import { CRTFilter } from "../graphics/crt";
import { globalAudio } from "../audio/synth";
import { FlickersoftSplash } from "../flickersoft/flickersoft";
import { renderGallery } from "../graphics/sprites";

export class MallActionGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private renderer: GameRenderer;
  private input: InputManager;
  private crt: CRTFilter;
  private splash: FlickersoftSplash;

  private isDebug: boolean = false;
  private isGallery: boolean = false;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly stepTime: number = 1000 / 60; // Fixed 60Hz tick

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx2d = canvas.getContext("2d", { alpha: false });
    if (!ctx2d) {
      throw new Error("Canvas 2D context not supported");
    }
    this.ctx = ctx2d;

    // Parse URL query parameters
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get("seed");
    const seed = seedParam ? parseInt(seedParam, 10) : 1337;

    this.isDebug = params.get("debug") === "1";
    this.isGallery = params.get("gallery") === "1";

    this.engine = new GameEngine(seed);
    this.renderer = new GameRenderer();
    this.input = new InputManager();
    this.crt = new CRTFilter();

    this.splash = new FlickersoftSplash({
      onComplete: () => {
        this.engine.ctx.screen = "TITLE";
      }
    });

    if (this.isDebug) {
      // Expose debug context & step helper on window
      (window as unknown as Record<string, unknown>).__DEBUG_GAME__ = {
        context: this.engine.ctx,
        engine: this.engine,
        step: (frames: number = 1, padOverriding?: Partial<ReturnType<InputManager["getPadState"]>>) => {
          for (let i = 0; i < frames; i++) {
            const pad = this.input.getPadState();
            if (padOverriding) Object.assign(pad, padOverriding);
            this.engine.update(pad);
          }
          this.render();
        }
      };
      // Debug mode skips studio splash directly to title screen
      this.engine.ctx.screen = "TITLE";
    }

    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / 256, window.innerHeight / 240)));
    this.canvas.style.width = `${256 * scale}px`;
    this.canvas.style.height = `${240 * scale}px`;
  }

  public start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(currentTime: number): void {
    const dt = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += dt;

    // Cap maximum catch-up steps per frame to avoid spiral of death
    let steps = 0;
    while (this.accumulator >= this.stepTime && steps < 5) {
      this.tick();
      this.accumulator -= this.stepTime;
      steps++;
    }

    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  private tick(): void {
    this.frameCount++;
    globalAudio.init();

    // Check system key toggles
    const toggles = this.input.consumeToggles();
    if (toggles.crtTogglePressed) {
      this.crt.toggle();
    }
    if (toggles.muteTogglePressed) {
      globalAudio.toggleMute();
    }

    // Check Konami Code
    if (this.input.konamiTriggered) {
      this.input.konamiTriggered = false;
      this.engine.ctx.isBlackFriday = true;
      this.engine.addFloatingText("BLACK FRIDAY! 70% OFF!", 128, 40, "#FF8170");
    }

    const pad = this.input.getPadState();

    if (this.engine.ctx.screen === "SPLASH" && !this.isDebug) {
      this.splash.update(pad);
    } else {
      this.engine.update(pad);
    }

    this.crt.update();
    globalAudio.updateBanner();

    // BGM Updates based on screen
    if (this.engine.ctx.screen === "TITLE") {
      globalAudio.playBGM("title");
    } else if (this.engine.ctx.screen === "MALL") {
      if (this.engine.ctx.alarmTriggered) {
        globalAudio.playBGM("alarm");
      } else {
        globalAudio.playBGM("mall");
      }
    } else if (this.engine.ctx.screen === "STORE") {
      globalAudio.playBGM("store");
    }
  }

  private render(): void {
    if (this.isGallery) {
      renderGallery(this.ctx, this.frameCount);
      return;
    }

    if (this.engine.ctx.screen === "SPLASH" && !this.isDebug) {
      this.splash.render(this.ctx, 256, 240);
    } else {
      this.renderer.render(this.ctx, this.engine.ctx);
    }

    // Apply CRT post-process & banners
    this.crt.applyCanvas2D(this.ctx, 256, 240, this.frameCount);
    globalAudio.drawBanner(this.ctx, 256);
  }
}
