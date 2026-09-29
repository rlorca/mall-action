import { GameContext } from "./types";
import { PAL } from "../graphics/palette";
import { drawSprite, drawPixelText, SPRITES } from "../graphics/sprites";
import { COPY } from "../text/copy";

export class GameRenderer {
  private frameCount: number = 0;

  public render(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    this.frameCount++;

    ctx.save();

    switch (gCtx.screen) {
      case "TITLE":
        this.renderTitleScreen(ctx, gCtx);
        break;
      case "MALL":
        this.renderMallScreen(ctx, gCtx);
        this.renderHUD(ctx, gCtx);
        break;
      case "STORE":
        this.renderStoreScreen(ctx, gCtx);
        this.renderHUD(ctx, gCtx);
        break;
      case "MAP":
        this.renderMapOverlay(ctx, gCtx);
        break;
      case "PAUSE":
        if (gCtx.currentStore) {
          this.renderStoreScreen(ctx, gCtx);
        } else {
          this.renderMallScreen(ctx, gCtx);
        }
        this.renderPauseOverlay(ctx);
        break;
      case "CLEAR":
        this.renderLevelClearScreen(ctx, gCtx);
        break;
      case "CONTINUE":
        this.renderContinueScreen(ctx, gCtx);
        break;
      case "GAMEOVER":
        this.renderGameOverScreen(ctx, gCtx);
        break;
    }

    // Render Floating Text popups
    gCtx.floatingTexts.forEach((ft) => {
      drawPixelText(ctx, ft.text, ft.x - gCtx.cameraX, ft.y, ft.color);
    });

    ctx.restore();
  }

  // --- 16 px HUD Strip ---
  private renderHUD(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, 256, 16);

    // Score (6 digits)
    const scoreStr = String(gCtx.score).padStart(6, "0");
    drawPixelText(ctx, `SCORE:${scoreStr}`, 2, 4, PAL.WHITE);

    // Package PKG n/6 (Red until all 6 found, then Green)
    const pkgColor = gCtx.packagesFound >= 6 ? PAL.LIGHT_GREEN : PAL.BRIGHT_RED;
    drawPixelText(ctx, `PKG:${gCtx.packagesFound}/6`, 90, 4, pkgColor);

    // Lives with Head Icon
    drawSprite(ctx, SPRITES["agent_td_down"], 155, 0);
    drawPixelText(ctx, `x${gCtx.lives}`, 173, 4, PAL.GOLD);

    // LED Floor Panel / Marquee
    let floorLabel = "R";
    if (gCtx.agent.floor === 4) floorLabel = "4F";
    if (gCtx.agent.floor === 3) floorLabel = "3F";
    if (gCtx.agent.floor === 2) floorLabel = "2F";
    if (gCtx.agent.floor === 1) floorLabel = "1F";
    if (gCtx.agent.floor === 0) floorLabel = "P";

    if (gCtx.currentStore) {
      floorLabel = gCtx.currentStore.name.substring(0, 4);
    }
    drawPixelText(ctx, `[${floorLabel}]`, 210, 4, PAL.CYAN);

    // Blinking Alarm indicator
    if (gCtx.alarmTriggered && this.frameCount % 30 < 15) {
      drawPixelText(ctx, "ALARM", 130, 4, PAL.BRIGHT_RED);
    }

    // HUD Divider Line
    ctx.fillStyle = PAL.VERY_DARK_GRAY;
    ctx.fillRect(0, 15, 256, 1);
  }

  // --- Title Screen ---
  private renderTitleScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    // Night sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, "#001133");
    grad.addColorStop(1, "#000000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 240);

    // Two-tone Logo
    drawPixelText(ctx, "MALL ACTION", 68, 40, PAL.GOLD);
    drawPixelText(ctx, "A SHOPPING MALL ESPIONAGE", 36, 56, PAL.LIGHT_PURPLE);

    drawPixelText(ctx, "(C) 2026 FLICKERSOFT", 56, 90, PAL.LIGHT_GRAY);
    drawPixelText(ctx, `HIGH SCORE: ${String(gCtx.highScore).padStart(6, "0")}`, 60, 110, PAL.WHITE);

    // Blinking Press Start
    if (this.frameCount % 40 < 20) {
      drawPixelText(ctx, "PRESS START", 84, 140, PAL.WHITE);
    }

    // Black Friday Secret Banner
    if (gCtx.isBlackFriday) {
      drawPixelText(ctx, COPY.BLACK_FRIDAY, 20, 160, PAL.BRIGHT_RED);
    }

    // Control Hints at bottom
    drawPixelText(ctx, "Z:SHOOT  X:JUMP/SEARCH  TAB:MAP", 24, 210, PAL.LIGHT_GRAY);

    // Scrolling storefront preview along bottom
    const scrollX = (this.frameCount * 0.5) % 256;
    ctx.fillStyle = PAL.VERY_DARK_GRAY;
    ctx.fillRect(0, 226, 256, 14);
    drawPixelText(ctx, "FOREVER 12  RADIOSHOCK  CROOKSTONE  GAMESTONK  KGB TOYS", Math.round(256 - scrollX), 230, PAL.YELLOW);
  }

  // --- Mall Side-Scroller View ---
  private renderMallScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    const camX = Math.round(gCtx.cameraX);

    // Background Sky & Roof
    ctx.fillStyle = "#050B14";
    ctx.fillRect(0, 16, 256, 224);

    // Draw Floors
    const floorsY = [200, 152, 104, 56, 8];
    floorsY.forEach((fy) => {
      ctx.fillStyle = PAL.VERY_DARK_GRAY;
      ctx.fillRect(0 - camX, fy + 24, 768, 4);
    });

    // Draw Elevators
    gCtx.elevators.forEach((car) => {
      const shaftX = car.shaftId === "A" ? 180 : car.shaftId === "B" ? 340 : 500;
      ctx.fillStyle = PAL.DARK_GRAY;
      ctx.fillRect(shaftX - camX, 16, 20, 200);

      // Car
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(shaftX - camX + 2, car.y, 16, 24);
    });

    // Draw Storefronts
    gCtx.stores.forEach((s) => {
      const sX = s.x - camX;
      if (sX + s.width < 0 || sX > 256) return;

      const floorYMap: Record<number, number> = { 5: 8, 4: 56, 3: 104, 2: 152, 1: 200, 0: 200 };
      const sY = floorYMap[s.floor] ?? 200;

      // Store Sign
      ctx.fillStyle = PAL.BLACK;
      ctx.fillRect(sX, sY, s.width, 12);
      drawPixelText(ctx, s.name.substring(0, 10), sX + 2, sY + 2, s.cleared ? PAL.LIGHT_GRAY : PAL.YELLOW);

      // Door (Red blinking = Target, Blue = Powerup, Grey = Closed)
      let doorColor = PAL.BLUE;
      if (s.role === "TARGET") {
        doorColor = s.cleared ? PAL.DARK_GRAY : (this.frameCount % 20 < 10 ? PAL.BRIGHT_RED : PAL.RED);
      } else if (s.role === "CLOSED") {
        doorColor = PAL.BLACK;
      }

      ctx.fillStyle = doorColor;
      ctx.fillRect(sX + 32, sY + 12, 16, 16);
    });

    // Draw Agent
    const agent = gCtx.agent;
    const spriteKey = agent.isDucking ? "agent_duck" : agent.isJumping ? "agent_jump" : "agent_stand";

    if (agent.invulnerableTimer === 0 || this.frameCount % 4 < 2) {
      drawSprite(ctx, SPRITES[spriteKey], agent.x - camX, agent.y, agent.facing === -1);
    }

    // Draw Spies
    gCtx.spies.forEach((spy) => {
      const spyKey = spy.isDying ? "spy_death" : spy.aimingTimer > 0 ? "spy_aim" : "spy_stand";
      drawSprite(ctx, SPRITES[spyKey], spy.x - camX, spy.y, spy.facing === -1);
    });

    // Draw Bullets
    gCtx.playerBullets.forEach((b) => {
      ctx.fillStyle = PAL.YELLOW;
      ctx.fillRect(b.x - camX, b.y, 4, 2);
    });

    gCtx.enemyBullets.forEach((b) => {
      ctx.fillStyle = PAL.BRIGHT_RED;
      ctx.fillRect(b.x - camX, b.y, 4, 2);
    });
  }

  // --- Store Top-Down View ---
  private renderStoreScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = "#111822";
    ctx.fillRect(0, 16, 256, 224);

    // Render Store Room Grid Border
    ctx.strokeStyle = PAL.BLUE;
    ctx.strokeRect(16, 32, 224, 144);

    // Store Title
    if (gCtx.currentStore) {
      drawPixelText(ctx, gCtx.currentStore.name, 20, 20, PAL.GOLD);
    }

    // Agent
    const agent = gCtx.agent;
    drawSprite(ctx, SPRITES["agent_td_down"], agent.x, agent.y);

    // Search Bar Prompt
    if (agent.searchTimer > 0) {
      ctx.fillStyle = PAL.BLACK;
      ctx.fillRect(50, 190, 156, 12);
      ctx.fillStyle = PAL.GOLD;
      const progress = Math.round((1 - agent.searchTimer / 45) * 156);
      ctx.fillRect(50, 190, progress, 12);
      drawPixelText(ctx, "SEARCHING...", 85, 192, PAL.WHITE);
    } else {
      drawPixelText(ctx, "PRESS X TO SEARCH FIXTURE", 45, 192, PAL.LIGHT_GRAY);
    }
  }

  // --- Map Overlay ---
  private renderMapOverlay(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, 256, 240);

    drawPixelText(ctx, "MALL DIRECTORY", 70, 10, PAL.GOLD);

    // Legend
    drawPixelText(ctx, "RED:PKG  BLUE:PWR  GREY:CLEAR", 20, 220, PAL.LIGHT_GRAY);

    // Render schematic of stores
    gCtx.stores.forEach((s) => {
      const mapX = Math.round((s.x / 768) * 200) + 20;
      const mapY = 180 - s.floor * 30;

      let color = PAL.BLUE;
      if (s.role === "TARGET") color = s.cleared ? PAL.DARK_GRAY : PAL.BRIGHT_RED;
      if (s.role === "CLOSED") color = PAL.BLACK;

      ctx.fillStyle = color;
      ctx.fillRect(mapX, mapY, 20, 12);

      if (gCtx.agent.hasRadar && s.role === "TARGET" && !s.cleared) {
        drawPixelText(ctx, "!", mapX + 8, mapY + 2, PAL.YELLOW);
      }
    });
  }

  // --- Pause Overlay ---
  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, 256, 240);

    if (this.frameCount % 40 < 20) {
      drawPixelText(ctx, "PAUSE", 106, 115, PAL.WHITE);
    }
  }

  // --- Level Clear ---
  private renderLevelClearScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, 256, 240);

    drawPixelText(ctx, "MISSION ACCOMPLISHED!", 50, 20, PAL.GOLD);

    // Station Wagon Exit Graphics
    drawSprite(ctx, SPRITES["wagon"], 110, 50);

    // Tally
    drawPixelText(ctx, `PACKAGES: 6/6`, 70, 85, PAL.WHITE);
    drawPixelText(ctx, `CLEAR BONUS: 1000`, 70, 100, PAL.WHITE);
    drawPixelText(ctx, `LOOP ${gCtx.currentLoop} COMPLETE`, 70, 115, PAL.CYAN);

    // THE DAILY MALL Headline
    const headline = COPY.DAILY_MALL_HEADLINES[(gCtx.currentLoop - 1) % COPY.DAILY_MALL_HEADLINES.length];
    ctx.fillStyle = PAL.VERY_DARK_GRAY;
    ctx.fillRect(10, 135, 236, 40);
    drawPixelText(ctx, "THE DAILY MALL", 80, 138, PAL.GOLD);
    drawPixelText(ctx, headline.substring(0, 26), 14, 152, PAL.WHITE);

    drawPixelText(ctx, "PRESS START TO CONTINUE", 45, 200, PAL.LIGHT_GRAY);
  }

  // --- Continue Screen ---
  private renderContinueScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, 256, 240);

    drawPixelText(ctx, "CONTINUE?", 90, 40, PAL.GOLD);

    const countColor = gCtx.continueCountdown <= 3 ? PAL.BRIGHT_RED : PAL.WHITE;
    drawPixelText(ctx, String(gCtx.continueCountdown), 120, 80, countColor);

    drawPixelText(ctx, `CONTINUES LEFT: ${gCtx.continuesLeft}`, 60, 140, PAL.LIGHT_GRAY);
    drawPixelText(ctx, "PRESS START TO CONTINUE", 45, 180, PAL.WHITE);
  }

  // --- Game Over Screen ---
  private renderGameOverScreen(ctx: CanvasRenderingContext2D, gCtx: GameContext): void {
    ctx.fillStyle = PAL.BLACK;
    ctx.fillRect(0, 0, 256, 240);

    drawPixelText(ctx, COPY.MALL_CLOSED, 15, 60, PAL.BRIGHT_RED);
    drawPixelText(ctx, "GAME OVER", 90, 110, PAL.WHITE);
    drawPixelText(ctx, `FINAL SCORE: ${gCtx.score}`, 70, 140, PAL.GOLD);

    drawPixelText(ctx, "PRESS START FOR TITLE", 48, 190, PAL.LIGHT_GRAY);
  }
}
