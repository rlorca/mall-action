import { PALETTE as C, SCREEN_W, SCREEN_H, FLOORS, FLOOR_Y, LEVEL_W, clamp } from "../core/constants.js";
import { STORES, SHAFTS, ESCALATORS, ROOM_TEMPLATES, nearestPackageStore } from "../core/level.js";
import { POWERUP_INFO } from "../core/powerups.js";
import { STORE_LINES, wrapText } from "../core/copy.js";
import { drawText, drawShadowText, textWidth } from "./font.js";
import { SPRITES, drawSprite } from "./sprites.js";
import { drawFlickersoftSplash } from "../splash/flickersoft.js";

const FLOOR_COLORS = { R: C.navy, "4F": "#403058", "3F": "#204850", "2F": "#583048", "1F": "#3c4828", P: C.charcoal };
const THEMES = {
  fashion: [C.pink, C.cream, C.magenta], electronics: [C.navy, C.cyan, C.smoke],
  toys: [C.red, C.yellow, C.blue], food: [C.orange, C.cream, C.red], sports: [C.green, C.white, C.navy],
  music: [C.purple, C.magenta, C.ink], gadgets: [C.smoke, C.cyan, C.silver], novelty: [C.purple, C.lime, C.ink],
  games: [C.blue, C.red, C.yellow],
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    if (!this.ctx) throw new Error("Canvas 2D unavailable");
    this.ctx.imageSmoothingEnabled = false;
    this.camera = { x: 0, y: 0 };
  }

  render(game) {
    const { ctx } = this; const s = game.state;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    switch (s.screen) {
      case "splash": drawFlickersoftSplash(ctx, s.screenFrame); break;
      case "title": this.drawTitle(game); break;
      case "arrival": this.drawMall(game, true); if (s.arrivalPhase === "selfie") this.drawPost(s.arrivalPost, "ROOFTOP SELFIE", s.screenFrame - s.selfieStart); break;
      case "mall": this.drawMall(game); break;
      case "store": this.drawStore(game); break;
      case "map": this.drawUnderlying(game); this.drawMap(game); break;
      case "pause": this.drawUnderlying(game); this.drawPause(game); break;
      case "clear": this.drawClear(game); break;
      case "continue": this.drawUnderlying(game); this.drawContinue(game); break;
      case "gameover": this.drawGameover(game); break;
      case "gallery": this.drawGallery(game); break;
      default: break;
    }
    if (s.noticeTime > 0 && s.notice) this.banner(s.notice, 20, C.ink, C.yellow);
    if (s.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${s.fade / 14})`; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H); }
    ctx.restore();
  }

  drawUnderlying(game) {
    if (game.state.overlayReturn === "store") this.drawStore(game, true);
    else this.drawMall(game, true);
  }

  drawTitle(game) {
    const { ctx } = this; const s = game.state;
    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, "#090c27"); gradient.addColorStop(0.6, "#283060"); gradient.addColorStop(1, "#b04870");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 240);
    for (let i = 0; i < 44; i++) {
      const x = (i * 73 + 17) % 256, y = (i * 37 + 9) % 116;
      ctx.fillStyle = (i + Math.floor(s.frame / 24)) % 5 ? C.white : C.cyan; ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }
    // Moon and a layered mall skyline.
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(207, 34, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#141a38"; ctx.beginPath(); ctx.arc(201, 29, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#11162d";
    for (let x = 0; x < 256; x += 24) { const h = 20 + (x * 7 % 34); ctx.fillRect(x, 157 - h, 22, h); }
    ctx.fillStyle = C.yellow;
    for (let x = 5; x < 250; x += 12) for (let y = 128; y < 153; y += 9) if ((x + y) % 3) ctx.fillRect(x, y, 2, 3);
    drawShadowText(ctx, "MALL", 128, 36, C.yellow, 4, "center", C.darkRed);
    drawShadowText(ctx, "ACTION", 128, 70, C.white, 3, "center", C.blue);
    ctx.fillStyle = C.red; ctx.fillRect(40, 96, 176, 2);
    drawText(ctx, "A SHOPPING MALL ESPIONAGE", 128, 103, C.cream, 1, "center");
    drawText(ctx, "(C) 2026 FLICKERSOFT", 128, 118, C.silver, 1, "center");
    drawText(ctx, `HIGH SCORE ${String(game.highScore).padStart(6, "0")}`, 128, 132, C.cyan, 1, "center");
    if (Math.floor(s.frame / 30) % 2 === 0) drawShadowText(ctx, "PRESS START", 128, 148, C.white, 1, "center", C.red);
    if (game.blackFriday && Math.floor(s.frame / 4) % 2 === 0) drawText(ctx, "BLACK FRIDAY! 70% OFF EVERYTHING", 128, 164, C.yellow, 1, "center");
    this.drawTitleStores(s.frame);
    drawText(ctx, "ARROWS MOVE  Z FIRE  X JUMP", 128, 229, C.silver, 1, "center");
  }

  drawTitleStores(frame) {
    const { ctx } = this;
    ctx.fillStyle = "#191426"; ctx.fillRect(0, 176, 256, 48);
    const names = ["FOREVER 12", "KGB TOYS", "SAM BADDY", "RADIOSHOCK", "HOT SPY"];
    const offset = -Math.floor(frame / 2) % 96;
    for (let i = -1; i < 4; i++) {
      const x = offset + i * 96; const name = names[(i + 20) % names.length];
      ctx.fillStyle = C.silver; ctx.fillRect(x, 178, 88, 42);
      ctx.fillStyle = C.darkRed; ctx.fillRect(x + 2, 180, 84, 10);
      drawText(ctx, name, x + 44, 182, C.white, 1, "center");
      ctx.fillStyle = C.navy; ctx.fillRect(x + 5, 193, 30, 23); ctx.fillRect(x + 53, 193, 30, 23);
      ctx.fillStyle = C.cyan; ctx.fillRect(x + 7, 195, 26, 2); ctx.fillRect(x + 55, 195, 26, 2);
      ctx.fillStyle = C.yellow; ctx.fillRect(x + 12, 203, 7, 9); ctx.fillRect(x + 65, 200, 6, 12);
      ctx.fillStyle = C.red; ctx.fillRect(x + 38, 193, 15, 27);
      ctx.fillStyle = C.ink; ctx.fillRect(x + 48, 206, 2, 2);
    }
    ctx.fillStyle = C.ink; ctx.fillRect(0, 220, 256, 4);
  }

  updateCamera(game) {
    const p = game.state.player;
    this.camera.x = Math.round(clamp(p.x - 116, 0, LEVEL_W - SCREEN_W));
    this.camera.y = Math.round(clamp(p.y - 106, 0, 78));
  }

  drawMall(game, arrival = false) {
    const { ctx } = this; const s = game.state; this.updateCamera(game);
    ctx.fillStyle = C.black; ctx.fillRect(0, 0, 256, 240);
    ctx.save(); ctx.translate(-this.camera.x, 16 - this.camera.y);
    this.drawMallBackground(game);
    this.drawShafts(game);
    this.drawEscalators();
    this.drawLamps(game);
    this.drawStores(game);
    this.drawProps(game);
    this.drawEntities(game);
    if (arrival) this.drawArrivalRig(game);
    ctx.restore();
    this.drawHUD(game);
    if (!arrival) {
      this.drawMessage(game);
      if (s.floorBannerTime > 0) this.banner(s.floorBanner, 26, C.navy, C.cyan);
    }
  }

  drawMallBackground(game) {
    const { ctx } = this; const cam = this.camera;
    ctx.fillStyle = "#0b1230"; ctx.fillRect(cam.x, cam.y - 16, 256, 320);
    // Roof skyline and lit skyscraper windows.
    ctx.fillStyle = "#151b38";
    for (let x = 0; x < LEVEL_W; x += 52) { const h = 22 + (x * 11 % 35); ctx.fillRect(x, 52 - h, 46, h); }
    for (let x = 7; x < LEVEL_W; x += 17) for (let y = 8; y < 47; y += 12) {
      if ((x * 3 + y) % 5) { ctx.fillStyle = (x + y) % 2 ? C.yellow : C.orange; ctx.fillRect(x, y, 3, 4); }
    }
    ctx.fillStyle = C.smoke; ctx.fillRect(0, 52, LEVEL_W, 4);
    for (const floor of FLOORS.slice(1)) {
      const y = FLOOR_Y[floor];
      ctx.fillStyle = FLOOR_COLORS[floor]; ctx.fillRect(0, y - 44, LEVEL_W, 46);
      // Wallpaper stripes and floor tiles.
      ctx.fillStyle = "#ffffff0a";
      for (let x = 0; x < LEVEL_W; x += 16) ctx.fillRect(x, y - 29, 8, 27);
      ctx.fillStyle = floor === "P" ? C.smoke : C.cream; ctx.fillRect(0, y, LEVEL_W, 5);
      ctx.fillStyle = floor === "P" ? C.ink : C.grey; ctx.fillRect(0, y + 5, LEVEL_W, 3);
      for (let x = 0; x < LEVEL_W; x += 24) { ctx.fillStyle = "#00000018"; ctx.fillRect(x, y, 1, 5); }
      if (floor === "P") {
        ctx.fillStyle = C.yellow;
        for (let x = 28; x < LEVEL_W; x += 90) { ctx.fillRect(x, y - 1, 42, 2); ctx.fillRect(x, y - 24, 2, 24); }
        for (let x = 180; x < LEVEL_W; x += 240) { ctx.fillStyle = C.silver; ctx.fillRect(x, y - 42, 14, 42); ctx.fillStyle = C.grey; ctx.fillRect(x + 3, y - 42, 3, 42); }
      }
    }
    // Roof anchor post.
    ctx.fillStyle = C.silver; ctx.fillRect(348, 35, 5, 21); ctx.fillRect(342, 35, 17, 3);
  }

  drawShafts(game) {
    const { ctx } = this;
    for (const shaft of SHAFTS) {
      const top = FLOOR_Y[shaft.floors[0]] - 30, bottom = FLOOR_Y[shaft.floors.at(-1)];
      ctx.fillStyle = C.ink; ctx.fillRect(shaft.x, top, 24, bottom - top);
      ctx.fillStyle = C.grey; ctx.fillRect(shaft.x, top, 2, bottom - top); ctx.fillRect(shaft.x + 22, top, 2, bottom - top);
      drawText(ctx, shaft.id, shaft.x + 12, top + 3, C.yellow, 1, "center");
      for (const floor of shaft.floors) {
        const y = FLOOR_Y[floor];
        ctx.fillStyle = C.silver; ctx.fillRect(shaft.x - 2, y - 3, 28, 3);
      }
      const car = game.state.elevators.find((item) => item.id === shaft.id);
      if (car) {
        const y = car.y;
        ctx.fillStyle = C.blue; ctx.fillRect(car.x + 1, y - 25, 22, 25);
        ctx.fillStyle = C.silver; ctx.fillRect(car.x + 3, y - 23, 18, 21);
        if (car.moving) { ctx.fillStyle = C.smoke; ctx.fillRect(car.x + 11, y - 23, 2, 21); }
        else { ctx.fillStyle = C.ink; ctx.fillRect(car.x + 6, y - 20, 12, 18); ctx.fillStyle = C.yellow; ctx.fillRect(car.x + 5, y - 23, 14, 2); }
        ctx.fillStyle = car.direction < 0 ? C.lime : C.red; ctx.fillRect(car.x + 10, y - 29, 4, 2);
      }
    }
  }

  drawEscalators() {
    const { ctx } = this;
    for (const e of ESCALATORS) {
      const topY = FLOOR_Y[e.top], bottomY = FLOOR_Y[e.bottom];
      ctx.strokeStyle = C.silver; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(e.x - 36, topY); ctx.lineTo(e.x + 36, bottomY); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const q = i / 10; ctx.beginPath(); ctx.moveTo(e.x - 36 + q * 72 - 4, topY + q * 48); ctx.lineTo(e.x - 36 + q * 72 + 5, topY + q * 48); ctx.stroke(); }
      ctx.fillStyle = C.yellow; ctx.fillRect(e.x - 42, topY - 2, 15, 2); ctx.fillRect(e.x + 29, bottomY - 2, 15, 2);
    }
  }

  signLines(name) {
    const splits = { "BLOCKBLUSTER VIDEO": ["BLOCKBLUSTER", "VIDEO"], "HOT SPY ON A STICK": ["HOT SPY ON A", "STICK"], "FOOT LOCKPICKER": ["FOOT", "LOCKPICKER"], "SHARPER IMAGINE": ["SHARPER", "IMAGINE"], "BORDERLINE BOOKS": ["BORDERLINE", "BOOKS"], "SPENDER'S GIFTS": ["SPENDER'S", "GIFTS"] };
    return splits[name] || [name];
  }

  drawStores(game) {
    const { ctx } = this; const s = game.state;
    for (const store of STORES) {
      const y = FLOOR_Y[store.floor]; const room = s.stores[store.id];
      const cleared = room?.cleared;
      ctx.fillStyle = C.ink; ctx.fillRect(store.x - 2, y - 45, 84, 45);
      ctx.fillStyle = store.role === "closed" ? C.smoke : store.role === "power" ? C.blue : cleared ? C.charcoal : C.darkRed;
      ctx.fillRect(store.x, y - 44, 80, 15);
      const lines = this.signLines(store.name);
      lines.forEach((line, i) => drawText(ctx, line, store.x + 40, y - 43 + i * 7, cleared ? C.grey : C.white, 1, "center"));
      if (store.role === "closed") {
        ctx.fillStyle = C.navy; ctx.fillRect(store.x + 4, y - 27, 72, 27);
        ctx.fillStyle = C.grey;
        for (let yy = y - (store.id === "circuit" ? 15 : 27); yy < y; yy += 4) ctx.fillRect(store.x + 4, yy, 72, 2);
        drawText(ctx, store.id === "block" ? "FOR LEASE" : store.id === "border" ? "CLOSING SALE" : "DEAD TV", store.x + 40, y - 19, C.cream, 1, "center");
        continue;
      }
      const doorColor = store.role === "power" ? C.blue : cleared ? C.ink : (Math.floor(s.frame / 16) % 2 ? C.red : C.darkRed);
      ctx.fillStyle = doorColor; ctx.fillRect(store.x + 32, y - 26, 17, 26);
      ctx.fillStyle = C.cream; ctx.fillRect(store.x + 45, y - 13, 2, 2);
      for (const wx of [store.x + 3, store.x + 52]) {
        ctx.fillStyle = cleared ? C.charcoal : C.navy; ctx.fillRect(wx, y - 26, 25, 25);
        ctx.fillStyle = cleared ? C.smoke : C.cyan; ctx.fillRect(wx, y - 26, 25, 2); ctx.fillRect(wx, y - 2, 25, 2);
        if (!cleared) this.drawWindowDisplay(store, wx, y - 24, s.frame);
      }
      if (game.blackFriday) { ctx.fillStyle = C.yellow; ctx.fillRect(store.x + 26, y - 32, 29, 8); drawText(ctx, "70% OFF", store.x + 40, y - 31, C.red, 1, "center"); }
    }
  }

  drawWindowDisplay(store, x, y, frame) {
    const { ctx } = this; const bob = Math.floor(frame / 16 + store.x) % 2;
    switch (store.display) {
      case "fashion":
        ctx.fillStyle = C.pink; ctx.fillRect(x + 5, y + 5, 7, 10); ctx.fillRect(x + 3, y + 7, 11, 3);
        ctx.fillStyle = C.cream; ctx.fillRect(x + 7, y + 1, 4, 4); ctx.fillRect(x + 8, y + 15, 2, 5); break;
      case "tv": case "deadtv":
        for (let i = 0; i < 2; i++) { ctx.fillStyle = C.silver; ctx.fillRect(x + 2 + i * 12, y + 3 + i * 5, 12, 9); ctx.fillStyle = C.ink; ctx.fillRect(x + 4 + i * 12, y + 5 + i * 5, 8, 5); ctx.fillStyle = i === bob ? C.cyan : C.white; ctx.fillRect(x + 5 + i * 12, y + 6 + i * 5, 5, 1); } break;
      case "chair":
        ctx.fillStyle = C.purple; ctx.fillRect(x + 7, y + 2, 10, 12); ctx.fillRect(x + 4, y + 10, 15, 6); ctx.fillStyle = C.silver; ctx.fillRect(x + 6, y + 16, 3, 4); ctx.fillRect(x + 16, y + 16, 3, 4); break;
      case "console":
        ctx.fillStyle = C.silver; ctx.fillRect(x + 3, y + 12, 19, 5); ctx.fillStyle = C.ink; ctx.fillRect(x + 7, y + 14, 9, 1); ctx.fillStyle = C.red; ctx.fillRect(x + 17, y + 2 + bob, 4, 9); ctx.fillStyle = C.yellow; ctx.fillRect(x + 16, y + 1 + bob, 6, 3); break;
      case "toys":
        ctx.fillStyle = C.brown; ctx.fillRect(x + 4, y + 5, 12, 10); ctx.fillRect(x + 6, y + 2, 8, 5); ctx.fillStyle = C.cream; ctx.fillRect(x + 7, y + 6, 2, 2); ctx.fillRect(x + 12, y + 6, 2, 2); ctx.fillStyle = C.red; ctx.fillRect(x + 16, y + 2, 4, 16); break;
      case "lava":
        ctx.fillStyle = C.silver; ctx.fillRect(x + 8, y + 2, 8, 2); ctx.fillRect(x + 7, y + 18, 10, 2); ctx.fillStyle = C.magenta; ctx.fillRect(x + 9, y + 4, 6, 14); ctx.fillStyle = C.lime; ctx.fillRect(x + 10, y + 7 + bob * 5, 4, 4); break;
      case "music":
        ctx.fillStyle = C.ink; ctx.fillRect(x + 2, y + 4, 20, 12); ctx.fillStyle = C.magenta; ctx.fillRect(x + 4, y + 6, 6, 6); ctx.fillRect(x + 14, y + 6, 6, 6); ctx.fillStyle = C.yellow; ctx.fillRect(x + 9, y + 2, 6, 3); ctx.fillRect(x + 4, y + 18 + bob, 16, 2); break;
      case "orb":
        ctx.fillStyle = C.silver; ctx.fillRect(x + 5, y + 17, 15, 3); ctx.fillStyle = C.purple; ctx.beginPath(); ctx.arc(x + 12, y + 9, 7 + bob, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.cyan; ctx.fillRect(x + 10, y + 5, 3, 3); break;
      case "food":
        ctx.fillStyle = C.yellow; ctx.fillRect(x + 3, y + 7, 10, 12); ctx.fillStyle = C.white; ctx.fillRect(x + 4, y + 5, 8, 4); ctx.fillStyle = C.orange; ctx.fillRect(x + 16, y + 5, 4, 13); ctx.fillStyle = C.brown; ctx.fillRect(x + 17, y + 2, 2, 5); break;
      case "shoes":
        ctx.fillStyle = C.white; ctx.fillRect(x + 3, y + 5, 15, 5); ctx.fillRect(x + 13, y + 9, 8, 4); ctx.fillStyle = C.red; ctx.fillRect(x + 5, y + 13, 17, 4); ctx.fillRect(x + 3, y + 16, 20, 2); break;
      default:
        ctx.fillStyle = C.purple; ctx.fillRect(x + 4, y + 4, 16, 15); drawText(ctx, "VHS", x + 12, y + 8, C.white, 1, "center");
    }
  }

  drawLamps(game) {
    const { ctx } = this;
    for (const lamp of game.state.lamps) {
      if (lamp.dark > 0) { ctx.fillStyle = "#0008"; ctx.fillRect(lamp.x - 45, FLOOR_Y[lamp.floor] - 28, 100, 28); }
      if (lamp.state === "broken") { ctx.fillStyle = C.silver; ctx.fillRect(lamp.x, FLOOR_Y[lamp.floor] - 2, 3, 1); ctx.fillRect(lamp.x + 7, FLOOR_Y[lamp.floor] - 3, 4, 1); continue; }
      if (lamp.state === "hanging") { ctx.fillStyle = C.ink; ctx.fillRect(lamp.x + 5, lamp.y - 10, 2, 11); }
      if (lamp.disco) {
        ctx.fillStyle = C.silver; ctx.beginPath(); ctx.arc(lamp.x + 6, lamp.y + 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.cyan; ctx.fillRect(lamp.x + 3, lamp.y + 3, 2, 2); ctx.fillRect(lamp.x + 8, lamp.y + 7, 2, 2);
      } else drawSprite(ctx, SPRITES.lamp, lamp.x, lamp.y);
    }
  }

  drawProps(game) {
    const { ctx } = this; const s = game.state;
    for (const floor of FLOORS.slice(1, 5)) {
      const y = FLOOR_Y[floor];
      // Directory kiosk.
      ctx.fillStyle = C.blue; ctx.fillRect(270, y - 28, 20, 28); ctx.fillStyle = C.cyan; ctx.fillRect(273, y - 25, 14, 13); drawText(ctx, "MAP", 280, y - 21, C.ink, 1, "center");
      // Benches and plants.
      for (const x of [18, 730]) { ctx.fillStyle = C.wood; ctx.fillRect(x, y - 8, 24, 4); ctx.fillRect(x + 3, y - 4, 3, 4); ctx.fillRect(x + 18, y - 4, 3, 4); }
      ctx.fillStyle = C.brown; ctx.fillRect(660, y - 9, 12, 9); ctx.fillStyle = C.green; ctx.fillRect(658, y - 19, 5, 11); ctx.fillRect(668, y - 22, 5, 13);
    }
    // Photo booth.
    let y = FLOOR_Y["3F"];
    ctx.fillStyle = C.magenta; ctx.fillRect(586, y - 36, 28, 36); ctx.fillStyle = C.ink; ctx.fillRect(591, y - 28, 18, 27); ctx.fillStyle = C.pink; ctx.fillRect(592, y - 27, 4, 25); drawText(ctx, "PHOTO", 600, y - 34, C.white, 1, "center");
    for (const fountain of s.fountains) {
      y = FLOOR_Y[fountain.floor]; ctx.fillStyle = C.silver; ctx.fillRect(fountain.x - 14, y - 8, 28, 8); ctx.fillStyle = C.cyan; ctx.fillRect(fountain.x - 11, y - 7, 22, 3); ctx.fillRect(fountain.x - 1, y - 20, 2, 13); ctx.fillRect(fountain.x - 5, y - 19, 10, 2);
    }
    // Getaway wagon and parking sign.
    y = FLOOR_Y.P; drawSprite(ctx, SPRITES.wagon, 366, y - 24); drawText(ctx, "EXIT", 390, y - 39, C.yellow, 1, "center");
  }

  drawEntities(game) {
    const { ctx } = this; const s = game.state; const p = s.player;
    for (const drop of s.drops) this.drawPowerup(drop.id, drop.x, drop.y);
    for (const coin of s.coins) drawSprite(ctx, SPRITES.coin, coin.x, coin.y, { alpha: coin.gold ? (Math.floor(s.frame / 3) % 2 ? 1 : 0.5) : 1 });
    for (const walker of s.walkers) {
      const y = FLOOR_Y[walker.floor] - 24; drawSprite(ctx, SPRITES.walker, walker.x - 2, y, { flip: walker.dir < 0 });
      if (walker.hey > 0) this.speech("HEY!", walker.x, y - 13);
    }
    const j = s.janitor; let y = FLOOR_Y["1F"] - 24;
    drawSprite(ctx, SPRITES.janitor, j.x - 2, y, { flip: j.dir < 0 });
    ctx.fillStyle = C.wood; ctx.fillRect(j.x + 6, y + 12, 2, 13); ctx.fillStyle = C.cyan; ctx.fillRect(j.x + 2, y + 23, 12, 2);
    if (j.wet) { ctx.fillStyle = "#48d8e866"; ctx.fillRect(j.wet.x, FLOOR_Y["1F"] - 2, 48, 2); ctx.fillStyle = C.yellow; ctx.fillRect(j.wet.x + 20, FLOOR_Y["1F"] - 14, 8, 12); drawText(ctx, "!", j.wet.x + 24, FLOOR_Y["1F"] - 11, C.ink, 1, "center"); }
    const cop = s.cop; y = FLOOR_Y[cop.floor] - 24;
    drawSprite(ctx, SPRITES.cop, cop.x - 2, y, { flip: cop.dir < 0 }); ctx.fillStyle = C.silver; ctx.fillRect(cop.x - 5, y + 23, 24, 2); ctx.fillStyle = C.ink; ctx.fillRect(cop.x - 2, y + 25, 4, 2); ctx.fillRect(cop.x + 12, y + 25, 4, 2);
    for (const spy of s.spies) {
      if (spy.state === "dying" && Math.floor(spy.dying / 3) % 2 === 0) continue;
      drawSprite(ctx, SPRITES.spy, spy.x - 2, spy.y + (spy.duck ? 10 : 0), { frame: Math.floor(s.frame / 10) % 2, flip: spy.dir < 0, alpha: spy.state === "dying" ? spy.dying / 24 : 1 });
      if (spy.aim > 0) { ctx.fillStyle = C.red; ctx.fillRect(spy.x + (spy.dir > 0 ? 10 : -5), spy.y + 9, 8, 3); if (Math.floor(spy.aim / 4) % 2) drawText(ctx, "!", spy.x + 6, spy.y - 10, C.yellow, 1, "center"); }
      if (spy.words) this.speech(spy.words.text, spy.x + 6, spy.y - 18);
    }
    for (const bullet of [...s.bullets, ...s.enemyBullets]) { ctx.fillStyle = bullet.enemy ? C.red : C.yellow; ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), bullet.w, bullet.h); }
    if (!p.hidden && s.arrivalPhase !== "zipline" || s.screen === "arrival") this.drawPlayer(game);
    for (const popup of s.popups) if (popup.y > 20) drawShadowText(ctx, popup.text, popup.x, popup.y, popup.text.startsWith("-") ? C.red : C.yellow, 1, "center");
  }

  drawPlayer(game, store = false) {
    const { ctx } = this; const s = game.state; const p = s.player;
    if (s.invulnerability > 0 && Math.floor(s.frame / 4) % 2 === 0) return;
    const flash = s.powerups.invincible > 0 && Math.floor(s.frame / 3) % 2 === 0;
    ctx.save(); if (flash) ctx.globalAlpha = 0.45;
    if (p.ducking && !store) {
      ctx.fillStyle = C.red; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y + 14), 16, 7); ctx.fillStyle = C.cream; ctx.fillRect(Math.round(p.x + (p.facing > 0 ? 7 : 1)), Math.round(p.y + 10), 7, 5); ctx.fillStyle = C.ink; ctx.fillRect(Math.round(p.x), Math.round(p.y + 21), 15, 3);
    } else {
      const sprite = store ? SPRITES.agentStore : SPRITES.agent;
      drawSprite(ctx, sprite, p.x - 2, p.y, { frame: Math.floor(s.frame / 8) % 2, flip: store ? p.searchFacing === "left" : p.facing < 0 });
    }
    if (p.overhead) {
      const id = p.overhead; if (id === "package" || id === "joke") drawSprite(ctx, SPRITES.package, p.x, p.y - 14); else this.drawPowerup(id, p.x + 2, p.y - 12);
    }
    ctx.restore();
  }

  drawPowerup(id, x, y) {
    const { ctx } = this; const colors = { rapid: C.yellow, spread: C.orange, armor: C.blue, sneakers: C.lime, radar: C.cyan, cinnabomb: C.pink, orange: C.orange, pretzel: C.tan, "1up": C.lime, joke: C.cream };
    ctx.fillStyle = C.ink; ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 12, 12); ctx.fillStyle = colors[id] || C.white; ctx.fillRect(Math.round(x), Math.round(y), 10, 10);
    const letters = { rapid: "R", spread: "S", armor: "A", sneakers: "N", radar: "!", cinnabomb: "C", orange: "O", pretzel: "P", "1up": "1", joke: "?" };
    drawText(ctx, letters[id] || "?", x + 5, y + 2, C.ink, 1, "center");
  }

  drawArrivalRig(game) {
    const { ctx } = this; const s = game.state;
    if (s.arrivalPhase === "zipline" || s.arrivalPhase === "drop") {
      ctx.strokeStyle = C.silver; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(350, 38); ctx.stroke();
      if (s.arrivalPhase === "zipline") { ctx.fillStyle = C.silver; ctx.fillRect(s.player.x + 4, s.player.y - 5, 5, 4); ctx.fillStyle = C.cream; ctx.fillRect(s.player.x + 1, s.player.y, 2, 8); ctx.fillRect(s.player.x + 10, s.player.y, 2, 8); }
    }
  }

  drawHUD(game) {
    const { ctx } = this; const s = game.state;
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, 256, 16); ctx.fillStyle = C.smoke; ctx.fillRect(0, 15, 256, 1);
    drawText(ctx, String(Math.min(999999, s.score)).padStart(6, "0"), 2, 1, C.white);
    drawText(ctx, `PKG ${s.packages}/6`, 50, 1, s.packages === 6 ? C.lime : C.red);
    drawText(ctx, `L:${Math.max(0, s.lives)}`, 100, 1, C.cream);
    const inStore = s.screen === "store" || s.overlayReturn === "store";
    const floor = inStore ? STORES.find((store) => store.id === s.currentStore)?.name : s.player.floor;
    ctx.fillStyle = C.black; ctx.fillRect(139, 1, 52, 7);
    ctx.save(); ctx.beginPath(); ctx.rect(139, 1, 52, 7); ctx.clip();
    const label = floor || "R"; const width = textWidth(label);
    if (inStore && width > 48) {
      const travel = width + 52; const x = 191 - (Math.floor(s.frame / 2) % travel);
      drawText(ctx, label, x, 1, C.lime); drawText(ctx, label, x + travel, 1, C.lime);
    } else drawText(ctx, label, 165, 1, C.lime, 1, "center");
    ctx.restore();
    if (s.alarm && Math.floor(s.frame / 12) % 2 === 0) drawText(ctx, "ALARM", 252, 1, C.red, 1, "right");
    let power = null, time = 0, total = 1;
    if (s.powerups.weapon) { power = POWERUP_INFO[s.powerups.weapon].name; time = s.powerups.weaponTime; total = 1200; }
    else if (s.powerups.speed) { power = POWERUP_INFO[s.powerups.speed].name; time = s.powerups.speedTime; total = POWERUP_INFO[s.powerups.speed].duration; }
    else if (s.powerups.invincible) { power = "CINNABOMB"; time = s.powerups.invincible; total = 360; }
    if (power) {
      const label = power.length > 17 ? power.slice(0, 17) : power;
      drawText(ctx, label, 2, 9, C.yellow); ctx.fillStyle = C.smoke; ctx.fillRect(108, 10, 70, 3); ctx.fillStyle = C.yellow; ctx.fillRect(108, 10, Math.round(70 * time / total), 3);
    }
    if (s.powerups.armor) drawText(ctx, "A", 188, 9, C.cyan);
    if (s.powerups.radar) drawText(ctx, "RADAR", 198, 9, C.cyan);
  }

  drawMessage(game) {
    const s = game.state;
    if (s.messageTime <= 0 || !s.message) return;
    const lines = wrapText(s.message, 40).slice(0, 3); const height = lines.length * 9 + 7;
    this.box(4, 236 - height, 248, height, C.ink, C.cream);
    lines.forEach((line, i) => drawText(this.ctx, line, 128, 240 - height + i * 9, C.white, 1, "center"));
  }

  banner(text, y = 28, background = C.ink, color = C.white) {
    if (!text) return; const lines = wrapText(text, 40).slice(0, 2); const h = lines.length * 9 + 6;
    this.box(8, y, 240, h, background, C.silver); lines.forEach((line, i) => drawText(this.ctx, line, 128, y + 4 + i * 9, color, 1, "center"));
  }

  box(x, y, w, h, fill = C.ink, border = C.white) {
    const { ctx } = this; ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); ctx.fillStyle = border; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1); ctx.fillRect(Math.round(x), Math.round(y + h - 1), Math.round(w), 1); ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(h)); ctx.fillRect(Math.round(x + w - 1), Math.round(y), 1, Math.round(h));
  }

  speech(text, x, y) {
    const lines = wrapText(text, 28); const w = Math.min(174, Math.max(...lines.map((line) => textWidth(line))) + 8); const h = lines.length * 8 + 6;
    const sx = clamp(x - w / 2, this.camera.x + 2, this.camera.x + 254 - w); const sy = Math.max(this.camera.y + 18, y - h);
    this.box(sx, sy, w, h, C.white, C.ink); lines.forEach((line, i) => drawText(this.ctx, line, sx + 4, sy + 3 + i * 8, C.ink));
    this.ctx.fillStyle = C.white; this.ctx.fillRect(Math.round(clamp(x, sx + 4, sx + w - 4)), sy + h, 3, 3);
  }

  drawStore(game, underlying = false) {
    const { ctx } = this; const s = game.state; const room = s.stores[s.currentStore];
    if (!room) return;
    const template = ROOM_TEMPLATES[room.storeId]; const store = STORES.find((item) => item.id === room.storeId); const colors = THEMES[store.theme] || THEMES.gadgets;
    this._radar = s.powerups.radar;
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, 256, 240);
    const camX = Math.round(clamp(s.player.x - 122, 0, Math.max(0, template.width * 16 - 256)));
    const camY = Math.round(clamp(s.player.y - 88, 0, Math.max(0, template.height * 16 - 176)));
    ctx.save(); ctx.translate(-camX, 32 - camY);
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, template.width * 16, template.height * 16);
    for (let y = 0; y < template.height; y++) for (let x = 0; x < template.width; x++) {
      const cell = template.rows[y][x];
      if (cell === "#") {
        ctx.fillStyle = C.ink; ctx.fillRect(x * 16, y * 16, 16, 16); ctx.fillStyle = colors[1]; ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 12); ctx.fillStyle = colors[2]; ctx.fillRect(x * 16 + 1, y * 16 + 13, 14, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 ? colors[0] : C.ink; ctx.globalAlpha = (x + y) % 2 ? 1 : 0.12; ctx.fillRect(x * 16, y * 16, 16, 16); ctx.globalAlpha = 1;
      }
      if (cell === "D") { ctx.fillStyle = C.brown; ctx.fillRect(x * 16, y * 16 + 5, 16, 11); ctx.fillStyle = C.yellow; ctx.fillRect(x * 16, y * 16 + 5, 16, 2); }
    }
    for (const fixture of room.fixtures) this.drawFixture(fixture, colors, store.theme, s.frame);
    if (store.id === "sam") { ctx.fillStyle = C.purple; ctx.fillRect(96, 112, 48, 32); ctx.fillStyle = C.magenta; for (let x = 98; x < 144; x += 8) ctx.fillRect(x, 114, 4, 28); drawText(ctx, "SIDE B", 120, 124, C.white, 1, "center"); }
    if (room.easter) this.drawEaster(room, s.frame);
    for (const toy of room.toys || []) drawSprite(ctx, SPRITES.toy, toy.x, toy.y, { flip: toy.dir < 0 });
    for (const guard of room.guards) {
      if (guard.hp <= 0 && guard.dying <= 0) continue;
      const sprite = guard.type === "bot" ? SPRITES.bot : SPRITES.spyStore;
      drawSprite(ctx, sprite, guard.x - 2, guard.y, { flip: guard.facing === "left" || guard.dir < 0, alpha: guard.dying ? guard.dying / 20 : 1 });
      if (guard.aim > 0 && Math.floor(guard.aim / 4) % 2) drawText(ctx, "!", guard.x + 6, guard.y - 10, C.yellow, 1, "center");
      if (guard.stun > 0) drawText(ctx, "*", guard.x + 6, guard.y - 9, C.cyan, 1, "center");
    }
    for (const bullet of [...s.bullets, ...s.enemyBullets]) { ctx.fillStyle = bullet.enemy ? C.red : C.yellow; ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), 3, 3); }
    this.drawPlayer(game, true);
    ctx.restore();
    this.drawHUD(game);
    // Store footer and forgiving search prompt.
    ctx.fillStyle = C.ink; ctx.fillRect(0, 208, 256, 32); ctx.fillStyle = colors[1]; ctx.fillRect(0, 208, 256, 1);
    drawText(ctx, store.name, 128, 212, C.white, 1, "center");
    if (room.search) {
      drawText(ctx, "SEARCHING...", 128, 225, C.yellow, 1, "center"); ctx.fillStyle = C.smoke; ctx.fillRect(72, 234, 112, 3); ctx.fillStyle = C.yellow; ctx.fillRect(72, 234, 112 * (1 - room.search.remaining / room.search.total), 3);
    } else {
      const near = room.fixtures.some((f) => !f.opened && s.player.x + 15 > f.x && s.player.x - 3 < f.x + 16 && s.player.y + 19 > f.y && s.player.y - 3 < f.y + 16);
      drawText(ctx, near ? "PRESS X TO SEARCH" : "FIND A FIXTURE - DOWN TO EXIT", 128, 226, near ? C.yellow : C.silver, 1, "center");
    }
    if (!underlying) {
      if (room.lineTime > 0 && STORE_LINES[room.storeId]) {
        const lines = STORE_LINES[room.storeId]; const index = room.lineTime < 75 && lines.length > 1 ? 1 : 0;
        this.banner(lines[index], 36, C.white, C.ink);
      }
      if (room.easter?.phase === "text") {
        const line = "IT'S DANGEROUS TO GO ALONE! TAKE THIS.";
        this.banner(line.slice(0, Math.floor((210 - room.easter.time) / 4)), 174, C.ink, C.white);
      }
      this.drawMessage(game);
    }
  }

  drawFixture(fixture, colors, theme, frame) {
    const { ctx } = this; const x = fixture.x, y = fixture.y;
    ctx.fillStyle = fixture.opened ? C.smoke : colors[1]; ctx.fillRect(x + 1, y + 2, 14, 13); ctx.fillStyle = C.ink; ctx.fillRect(x + 2, y + 4, 12, 2); ctx.fillRect(x + 2, y + 12, 12, 2);
    ctx.fillStyle = fixture.opened ? C.ink : colors[2];
    if (fixture.opened) { ctx.fillRect(x + 2, y + 1, 12, 3); ctx.fillRect(x + 4, y + 7, 8, 4); }
    else if (theme === "electronics" || theme === "gadgets") { ctx.fillRect(x + 4, y + 6, 8, 5); ctx.fillStyle = C.cyan; ctx.fillRect(x + 5, y + 7, 6, 2); }
    else if (theme === "fashion") { ctx.fillRect(x + 5, y + 5, 6, 8); ctx.fillRect(x + 3, y + 7, 10, 3); }
    else if (theme === "toys") { ctx.fillRect(x + 4, y + 6, 8, 6); ctx.fillStyle = C.red; ctx.fillRect(x + 6, y + 4, 4, 3); }
    else if (theme === "food") { ctx.fillRect(x + 3, y + 7, 10, 5); ctx.fillStyle = C.yellow; ctx.fillRect(x + 5, y + 4, 6, 4); }
    else { ctx.fillRect(x + 4, y + 6, 8, 6); }
    if (!fixture.opened && fixture.content === "package" && this._radar && Math.floor(frame / 8) % 2) drawText(ctx, "!", x + 8, y - 8, C.yellow, 1, "center");
  }

  drawEaster(room, frame) {
    const { ctx } = this; const egg = room.easter;
    ctx.fillStyle = C.ink; ctx.fillRect(80, 48, 96, 56);
    for (const x of [84, 148]) { ctx.fillStyle = C.silver; ctx.fillRect(x, 54, 24, 22); ctx.fillStyle = Math.floor(frame / 4 + x) % 2 ? C.cyan : C.blue; ctx.fillRect(x + 3, 57, 18, 14); }
    if (egg.phase !== "done") drawSprite(ctx, SPRITES.clerk, 120, 56);
    ctx.fillStyle = C.brown; ctx.fillRect(116, 88, 24, 8); ctx.fillRect(120, 96, 16, 8);
    if (egg.phase === "item") { this.drawPowerup("joke", 123, 78); if (Math.floor(frame / 8) % 2) drawText(ctx, "!", 128, 66, C.yellow, 1, "center"); }
  }

  drawMap(game) {
    const { ctx } = this; const s = game.state;
    ctx.fillStyle = "#071424ee"; ctx.fillRect(0, 0, 256, 240);
    drawShadowText(ctx, "MALL DIRECTORY", 128, 5, C.cyan, 1, "center");
    const left = 8, top = 29, floorGap = 25, scaleX = 0.295;
    for (let i = 0; i < FLOORS.length; i++) {
      const floor = FLOORS[i], y = top + i * floorGap;
      drawText(ctx, floor, 4, y - 4, C.yellow); ctx.fillStyle = C.smoke; ctx.fillRect(left + 17, y, 221, 1);
      for (const store of STORES.filter((item) => item.floor === floor)) {
        const room = s.stores[store.id]; const color = store.role === "closed" ? C.ink : store.role === "power" ? C.blue : room?.cleared ? C.grey : C.red;
        ctx.fillStyle = color; ctx.fillRect(left + 17 + store.x * scaleX, y - 8, 23, 7);
        if (s.powerups.radar && store.role === "target" && !room?.cleared) drawText(ctx, "!", left + 28 + store.x * scaleX, y - 17, C.yellow, 1, "center");
      }
    }
    for (const shaft of SHAFTS) {
      const x = left + 17 + shaft.x * scaleX + 4; const y1 = top + FLOORS.indexOf(shaft.floors[0]) * floorGap, y2 = top + FLOORS.indexOf(shaft.floors.at(-1)) * floorGap;
      ctx.fillStyle = C.silver; ctx.fillRect(x, y1, 2, y2 - y1); const car = s.elevators.find((item) => item.id === shaft.id);
      if (car) { const ratio = (car.y - FLOOR_Y[shaft.floors[0]]) / (FLOOR_Y[shaft.floors.at(-1)] - FLOOR_Y[shaft.floors[0]]); ctx.fillStyle = C.yellow; ctx.fillRect(x - 2, y1 + ratio * (y2 - y1) - 2, 6, 4); }
    }
    ctx.strokeStyle = C.cyan; for (const e of ESCALATORS) { const x = left + 17 + e.x * scaleX; ctx.beginPath(); ctx.moveTo(x - 5, top + FLOORS.indexOf(e.top) * floorGap); ctx.lineTo(x + 5, top + FLOORS.indexOf(e.bottom) * floorGap); ctx.stroke(); }
    if (Math.floor(s.frame / 12) % 2 === 0) {
      const y = top + FLOORS.indexOf(s.player.floor) * floorGap; const x = s.screen === "map" && s.overlayReturn === "store" ? left + 28 + STORES.find((store) => store.id === s.currentStore).x * scaleX : left + 17 + s.player.x * scaleX;
      ctx.fillStyle = C.white; ctx.fillRect(x - 2, y - 13, 5, 5);
    }
    drawSprite(ctx, SPRITES.wagon, 174, 166);
    drawText(ctx, "RED: PACKAGE  GREY: CLEARED", 8, 184, C.silver);
    drawText(ctx, "BLUE: POWER-UP  DARK: CLOSED", 8, 193, C.silver);
    const inventory = [...s.inventory, s.photoStrip ? "PHOTOS" : null].filter(Boolean).join(", ") || "EMPTY POCKETS";
    drawText(ctx, `ITEMS: ${inventory}`.slice(0, 41), 8, 205, C.cream);
    drawText(ctx, "SELECT TO CLOSE", 128, 228, C.yellow, 1, "center");
  }

  drawPause(game) {
    const { ctx } = this; ctx.fillStyle = "#000a"; ctx.fillRect(0, 0, 256, 240);
    this.box(52, 86, 152, 64, C.ink, C.silver);
    if (Math.floor(game.state.frame / 24) % 2 === 0) drawShadowText(ctx, "PAUSE", 128, 101, C.white, 2, "center");
    drawText(ctx, "START TO RESUME", 128, 128, C.yellow, 1, "center");
    drawText(ctx, "C: CRT   M: SOUND", 128, 139, C.silver, 1, "center");
  }

  drawContinue(game) {
    const { ctx } = this; const s = game.state; const count = Math.max(0, Math.ceil(s.continueTime / 60));
    ctx.fillStyle = "#090913dd"; ctx.fillRect(0, 0, 256, 240);
    drawShadowText(ctx, "CONTINUE?", 128, 57, C.white, 2, "center");
    drawShadowText(ctx, String(count), 128, 88, count <= 3 ? C.red : C.yellow, 5, "center");
    drawText(ctx, `CONTINUES LEFT: ${s.continues}`, 128, 145, C.white, 1, "center");
    drawText(ctx, "START: 3 FRESH LIVES", 128, 166, C.cyan, 1, "center");
    drawText(ctx, "SCORE AND PACKAGES ARE KEPT", 128, 180, C.silver, 1, "center");
  }

  drawPost(post, heading = "SPYGRAM", frame = 0) {
    const { ctx } = this; if (!post) return;
    ctx.fillStyle = "#000b"; ctx.fillRect(0, 16, 256, 224);
    this.box(24, 36, 208, 181, C.white, C.magenta);
    ctx.fillStyle = C.magenta; ctx.fillRect(25, 37, 206, 19); drawText(ctx, "SPYGRAM", 34, 43, C.white, 1); drawText(ctx, heading, 222, 44, C.white, 1, "right");
    // A procedural pixel selfie with rooftop backdrop.
    ctx.fillStyle = C.sky; ctx.fillRect(35, 65, 82, 77); ctx.fillStyle = C.navy; ctx.fillRect(35, 113, 82, 29); ctx.fillStyle = C.yellow; ctx.fillRect(98, 74, 9, 9);
    drawSprite(ctx, SPRITES.agent, 62, 91, { frame: 1 }); ctx.fillStyle = C.white; ctx.fillRect(42, 71, 4, 4); ctx.fillRect(46, 67, 2, 12); ctx.fillRect(38, 73, 12, 2);
    drawText(ctx, "AGENT 7", 127, 67, C.ink); drawText(ctx, "AT THE MALL", 127, 77, C.grey);
    post.caption.forEach((line, i) => drawText(ctx, line, 127, 94 + i * 11, C.ink));
    drawText(ctx, `<3 ${Math.min(999, Math.floor(frame * 2.7))} LIKES`, 35, 150, C.magenta);
    const comment = wrapText(post.comment, 30); comment.forEach((line, i) => drawText(ctx, line, 35, 165 + i * 10, C.ink));
    drawText(ctx, "ANY BUTTON TO SKIP", 128, 204, C.grey, 1, "center");
  }

  drawClear(game) {
    const { ctx } = this; const s = game.state; const clear = s.clear;
    if (clear.phase === "newspaper") {
      ctx.fillStyle = C.charcoal; ctx.fillRect(0, 0, 256, 240); this.box(14, 12, 228, 215, C.cream, C.ink);
      drawText(ctx, "THE DAILY MALL", 128, 21, C.ink, 2, "center"); ctx.fillStyle = C.ink; ctx.fillRect(20, 39, 216, 2);
      drawText(ctx, "LATE EDITION", 128, 45, C.ink, 1, "center");
      clear.headline.forEach((line, i) => drawText(ctx, line, 128, 65 + i * 13, C.ink, 1, "center"));
      ctx.fillStyle = C.grey; ctx.fillRect(29, 101, 86, 74); drawSprite(ctx, SPRITES.wagon, 48, 122); drawSprite(ctx, SPRITES.agent, 70, 101);
      for (let y = 102; y < 176; y += 7) for (let x = 125; x < 226; x += 31) { ctx.fillStyle = C.grey; ctx.fillRect(x, y, 26, 2); }
      drawText(ctx, "SPIES FOILED - FULL STORY P6", 128, 190, C.ink, 1, "center"); drawText(ctx, "START TO CONTINUE", 128, 211, C.darkRed, 1, "center"); return;
    }
    if (clear.phase === "post") { ctx.fillStyle = C.navy; ctx.fillRect(0, 0, 256, 240); this.drawPost(clear.post, "MISSION COMPLETE", clear.time); return; }
    // Parking-garage tally and animated getaway.
    ctx.fillStyle = C.charcoal; ctx.fillRect(0, 0, 256, 240); ctx.fillStyle = C.smoke; ctx.fillRect(0, 179, 256, 61);
    for (const x of [20, 214]) { ctx.fillStyle = C.silver; ctx.fillRect(x, 40, 18, 140); ctx.fillStyle = C.grey; ctx.fillRect(x + 4, 40, 4, 140); }
    drawShadowText(ctx, "LEVEL CLEAR!", 128, 22, C.yellow, 2, "center");
    const carX = Math.min(290, 66 + Math.max(0, clear.time - 120) * 1.5); drawSprite(ctx, SPRITES.wagon, carX, 155);
    const spyX = Math.max(-20, carX - 44); drawSprite(ctx, SPRITES.spy, spyX, 155, { frame: Math.floor(clear.time / 5) % 2 }); ctx.fillStyle = C.white; ctx.fillRect(spyX + 12, 151, 8, 6);
    this.box(48, 52, 160, 85, C.ink, C.silver);
    drawText(ctx, `PACKAGES       ${clear.packages} X 500`, 58, 61, C.white);
    drawText(ctx, `TIME BONUS     ${clear.bonus}`, 58, 76, C.white);
    drawText(ctx, `CLEAR BONUS      1000`, 58, 91, C.white);
    drawText(ctx, `SCORE        ${String(s.score).padStart(6, "0")}`, 58, 109, C.yellow);
    drawText(ctx, `LOOP ${clear.loop} COMPLETE`, 128, 124, C.cyan, 1, "center");
    drawText(ctx, "START TO READ THE NEWS", 128, 226, C.white, 1, "center");
  }

  drawGameover(game) {
    const { ctx } = this; const s = game.state; const t = s.gameoverTime;
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, 256, 240);
    for (let x = 0; x < 256; x += 64) { ctx.fillStyle = C.darkRed; ctx.fillRect(x + 2, 90, 58, 14); ctx.fillStyle = C.ink; ctx.fillRect(x + 7, 110, 48, 100); }
    drawSprite(ctx, SPRITES.agent, 120, 172);
    const message = "ATTENTION SHOPPERS: THE MALL IS NOW CLOSED"; const visible = message.slice(0, Math.floor(t / 3));
    const lines = wrapText(visible, 28); this.box(20, 24, 216, 42, C.ink, C.silver); lines.forEach((line, i) => drawText(ctx, line, 128, 32 + i * 11, C.white, 1, "center"));
    const shutterY = Math.min(210, 80 + t * 0.7); ctx.fillStyle = C.grey;
    for (let y = 80; y < shutterY; y += 5) ctx.fillRect(0, y, 256, 3);
    if (t > 180) {
      ctx.fillStyle = "#000c"; ctx.fillRect(0, 0, 256, 240); drawShadowText(ctx, "GAME OVER", 128, 78, C.red, 3, "center");
      drawText(ctx, `SCORE ${String(s.score).padStart(6, "0")}`, 128, 122, C.white, 1, "center"); drawText(ctx, `HIGH  ${String(game.highScore).padStart(6, "0")}`, 128, 137, C.yellow, 1, "center");
      drawText(ctx, "START FOR TITLE", 128, 180, C.silver, 1, "center");
    }
  }

  drawGallery(game) {
    const { ctx } = this; ctx.fillStyle = C.navy; ctx.fillRect(0, 0, 256, 240); drawText(ctx, "FLICKERSOFT SPRITE GALLERY", 128, 5, C.white, 1, "center");
    const entries = Object.entries(SPRITES);
    entries.forEach(([name, sprite], i) => {
      const x = 10 + (i % 5) * 49, y = 24 + Math.floor(i / 5) * 63;
      this.box(x - 3, y - 3, 43, 52, C.ink, C.smoke); drawSprite(ctx, sprite, x + 12, y + 4 + (Math.floor(game.state.frame / 12 + i) % 2), { frame: Math.floor(game.state.frame / 12) }); drawText(ctx, name.slice(0, 7), x + 18, y + 38, C.cream, 1, "center");
    });
    drawText(ctx, "START TO RETURN", 128, 228, C.yellow, 1, "center");
  }
}
