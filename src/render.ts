import { ui } from "./copy";
import { palette as P, sprites, glyph } from "./art";
import { type Game } from "./game";
import { stores, floorY, escalators, type Theme } from "./data";
import { floorNames, wrap, labels } from "./copy";
import { splash } from "./splash";
import { clamp } from "./core";
const themes: Record<Theme, number[]> = {
  fashion: [8, 9, 11],
  electronics: [16, 17, 19],
  toys: [20, 21, 27],
  food: [24, 26, 27],
  sports: [16, 17, 10],
  music: [12, 13, 27],
  gadgets: [28, 29, 31],
  novelty: [12, 13, 14],
  games: [20, 21, 19],
};
export class Renderer {
  ctx: CanvasRenderingContext2D;
  atlases = new Map<string, HTMLCanvasElement>();
  cx = 0;
  cy = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    for (const [name, s] of Object.entries(sprites)) {
      const c = document.createElement("canvas");
      c.width = s.w;
      c.height = s.h;
      const ctx = c.getContext("2d")!;
      s.pixels.forEach((r, y) =>
        [...r].forEach((v, x) => {
          if (v !== ".") {
            ctx.fillStyle = s.colors[+v - 1];
            ctx.fillRect(x, y, 1, 1);
          }
        }),
      );
      this.atlases.set(name, c);
    }
  }
  rect(x: number, y: number, w: number, h: number, c: number | string) {
    this.ctx.fillStyle = typeof c === "number" ? P[c] : c;
    this.ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
  }
  text(s: string, x: number, y: number, c = 6, scale = 1, center = false) {
    if (center) x -= (s.length * 4 * scale) / 2;
    for (const ch of s.toUpperCase()) {
      const bits = glyph(ch);
      for (let i = 0; i < 15; i++)
        if (bits[i] === "1")
          this.rect(
            x + (i % 3) * scale,
            y + Math.floor(i / 3) * scale,
            scale,
            scale,
            c,
          );
      x += 4 * scale;
    }
  }
  lines(s: string, x: number, y: number, c = 6, max = 54) {
    for (const [i, line] of s
      .split("|")
      .flatMap((l) => wrap(l, max))
      .entries())
      this.text(line, x, y + i * 8, c);
  }
  sprite(name: string, x: number, y: number, flip = false) {
    const a = this.atlases.get(name);
    if (!a) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) {
      ctx.translate(a.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(a, 0, 0);
    ctx.restore();
  }
  panel(x: number, y: number, w: number, h: number, c = 17) {
    this.rect(x - 1, y - 1, w + 2, h + 2, 6);
    this.rect(x, y, w, h, 0);
    this.rect(x + 2, y + 2, w - 4, h - 4, c);
  }
  sky() {
    for (let y = 0; y < 240; y += 8)
      this.rect(0, y, 256, 8, y < 64 ? 0 : y < 112 ? 1 : y < 176 ? 2 : 28);
    for (let i = 0; i < 36; i++) {
      const x = (i * 71 + 17) % 256,
        y = (i * 29 + 11) % 113;
      this.rect(x, y, 1, 1, i % 3 === 0 ? 27 : 4);
    }
    this.rect(211, 23, 15, 15, 6);
    this.rect(206, 21, 13, 15, 0);
    for (let i = 0; i < 12; i++) {
      const h = 20 + ((i * 17) % 34);
      this.rect(i * 24, 175 - h, 20, h, 1);
      for (let y = 175 - h + 5; y < 172; y += 8)
        this.rect(i * 24 + 7, y, 3, 2, 26);
    }
  }
  storefront(id: number, x: number, y: number, g: Game, mini = false) {
    const s = stores[id],
      r = g.rooms[id],
      t = themes[s.theme];
    this.rect(x, y, 80, 44, t[0]);
    this.rect(
      x + 1,
      y,
      78,
      10,
      r.cleared ? 2 : s.role === "target" ? 9 : s.role === "shop" ? 17 : 3,
    );
    this.text(s.name, x + 40, y + 2, r.cleared ? 4 : 6, 1, true);
    this.rect(x + 3, y + 13, 23, 25, 0);
    this.rect(x + 54, y + 13, 23, 25, 0);
    this.rect(x + 4, y + 14, 21, 2, t[1]);
    this.rect(x + 55, y + 14, 21, 2, t[1]);
    this.rect(x + 3, y + 38, 23, 2, 4);
    this.rect(x + 54, y + 38, 23, 2, 4);
    const color =
      s.role === "target" ? (r.cleared ? 2 : g.frame % 60 < 30 ? 10 : 9) : 17;
    this.rect(x + 30, y + 12, 20, 31, color);
    this.rect(x + 32, y + 14, 16, 27, 0);
    this.rect(x + 34, y + 15, 12, 17, r.cleared ? 1 : t[1]);
    this.rect(x + 44, y + 32, 2, 2, 27);
    if (s.role === "closed") {
      for (let yy = 12; yy < 43; yy += 3) this.rect(x + 1, y + yy, 78, 2, 3);
      this.rect(x + 17, y + 24, 46, 10, 0);
      this.text(
        id === 5 ? ui.FOR_LEASE : id === 12 ? ui.CLOSING_SALE : ui.NO_SIGNAL,
        x + 40,
        y + 26,
        27,
        1,
        true,
      );
      return;
    }
    const displays: Record<Theme, string[]> = {
      fashion: ["mannequin", "rack"],
      electronics: ["tv", "tv"],
      toys: ["teddy", "robot"],
      food: ["lemonade", "cornDog"],
      sports: ["shoe", "ball"],
      music: ["record", "boombox"],
      gadgets: id === 2 ? ["chair", "orb"] : ["vacuum", "orb"],
      novelty: ["lava", "orb"],
      games: ["console", "rocket"],
    };
    this.sprite(displays[s.theme][0], x + 7, y + 19);
    this.sprite(displays[s.theme][1], x + 58, y + 19);
    if (!r.cleared && g.frame % 24 < 12) {
      if (s.theme === "electronics") this.rect(x + 11, y + 25, 10, 2, 7);
      if (s.theme === "novelty" || s.theme === "gadgets")
        this.rect(x + 65, y + 23, 2, 2, 7);
      if (s.theme === "music") this.rect(x + 63, y + 24, 2, 3, 10);
    }
    if (r.cleared) {
      this.ctx.globalAlpha = 0.55;
      this.rect(x + 3, y + 13, 23, 25, 0);
      this.rect(x + 54, y + 13, 23, 25, 0);
      this.ctx.globalAlpha = 1;
    }
    if (g.black && !mini) {
      this.rect(x + 28, y + 16, 24, 8, 27);
      this.text("70% OFF", x + 40, y + 18, 9, 1, true);
    }
  }
  draw(g: Game) {
    this.rect(0, 0, 256, 240, 0);
    if (g.scene === "splash") {
      const s = splash(g.sceneFrame);
      s.letters.forEach((l, i) => {
        if (l.visible)
          this.text(
            l.char,
            19 + i * 20,
            93,
            [10, 26, 27, 22, 19, 30, 14][i % 7],
            5,
          );
      });
      if (s.underline) this.rect(18, 124, 218, 3, 6);
      if (s.presents) this.text(ui.PRESENTS, 128, 149, 6, 2, true);
    } else if (g.scene === "title") this.title(g);
    else if (g.scene === "store") this.storeRoom(g);
    else if (g.scene === "clear") this.clear(g);
    else if (g.scene === "continue") this.continue(g);
    else if (g.scene === "over") this.over(g);
    else this.mall(g);
    if (["mall", "store", "arrival"].includes(g.scene)) {
      this.hud(g);
      if (g.bannerTime && !g.overlay) this.banner(g);
      if (g.death) this.text(ui.OUCH, 128, 116, 10, 3, true);
      if (g.scene === "arrival" && g.sceneFrame >= 120) this.post(g);
      if (g.photoPopup > 0) this.photoStrip(g);
    }
    if (g.overlay === "map") this.map(g);
    if (g.overlay === "pause") {
      this.ctx.globalAlpha = 0.7;
      this.rect(0, 16, 256, 224, 0);
      this.ctx.globalAlpha = 1;
      this.panel(56, 94, 144, 48, 1);
      if (g.frame % 60 < 40) this.text(ui.PAUSE, 128, 110, 6, 3, true);
      this.text(ui.ENTER_TO_RESUME, 128, 131, 4, 1, true);
    }
    if (g.fade > 0) {
      this.ctx.globalAlpha = g.fade / 18;
      this.rect(0, 16, 256, 224, 0);
      this.ctx.globalAlpha = 1;
    }
  }
  title(g: Game) {
    this.sky();
    this.text(ui.FLICKERSOFT_PRESENTS, 128, 28, 19, 1, true);
    this.text(ui.MALL, 130, 58, 9, 6, true);
    this.text(ui.MALL, 128, 55, 27, 6, true);
    this.text(ui.ACTION, 130, 97, 17, 5, true);
    this.text(ui.ACTION, 128, 94, 19, 5, true);
    this.rect(30, 128, 196, 1, 27);
    this.text(ui.A_SHOPPING_MALL_ESPIONAGE, 128, 136, 6, 1, true);
    this.text(
      `HIGH SCORE ${String(g.high).padStart(6, "0")}`,
      128,
      151,
      27,
      1,
      true,
    );
    if (g.frame % 60 < 40) this.text(ui.PRESS_START, 128, 167, 7, 2, true);
    for (let i = 0; i < 5; i++) {
      const x = i * 88 - ((g.frame / 4) % 88);
      this.storefront(i % 4, x, 187, g, true);
    }
    this.text(ui.C_2026_FLICKERSOFT, 128, 234, 4, 1, true);
    if (g.black) {
      this.panel(30, 145, 196, 36, 9);
      this.text(ui.BLACK_FRIDAY, 128, 151, g.frame % 8 < 4 ? 27 : 7, 2, true);
      this.text("70% OFF EVERYTHING", 128, 170, 6, 1, true);
    } else this.text(ui.ARROWS_Z_SHOOT_X_JUMP_ENTER, 128, 181, 4, 1, true);
  }
  mall(g: Game) {
    const p = g.player;
    this.cx = clamp(p.x - 128, 0, 512);
    this.cy = clamp(p.y - 138, 0, 80);
    const sx = g.shake ? (g.frame % 4) - 2 : 0;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 16, 256, 224);
    this.ctx.clip();
    this.ctx.translate(-Math.floor(this.cx) + sx, 16 - Math.floor(this.cy));
    this.rect(0, 0, 768, 304, 1);
    for (let y = 0; y < 48; y += 6)
      this.rect(0, y, 768, 6, y < 18 ? 0 : y < 36 ? 1 : 2);
    for (let i = 0; i < 50; i++)
      this.rect((i * 43) % 768, (i * 13) % 36, 1, 1, 4);
    this.rect(2, 0, 24, 40, 0);
    for (let y = 5; y < 38; y += 7)
      for (let x = 6; x < 23; x += 6) this.rect(x, y, 2, 3, 27);
    this.ctx.strokeStyle = P[4];
    this.ctx.beginPath();
    this.ctx.moveTo(20, 0);
    this.ctx.lineTo(102, 42);
    this.ctx.stroke();
    this.rect(103, 32, 3, 16, 4);
    this.text(ui.ROOFTOP_AUTHORIZED_AGENTS_ONLY, 130, 21, 4);
    for (let floor = 0; floor <= 5; floor++) {
      const y = floorY(floor);
      if (floor > 0) {
        this.rect(0, y - 46, 768, 46, floor === 5 ? 2 : floor % 2 ? 28 : 16);
        for (let x = 0; x < 768; x += 16) {
          this.rect(x, y - 2, 15, 2, 3);
          this.rect(x, y - 45, 16, 1, 3);
        }
        if (floor < 5)
          for (let x = 0; x < 768; x += 32) this.rect(x, y - 3, 16, 1, 4);
      }
      this.rect(0, y, 768, 4, 4);
      this.rect(0, y + 4, 768, 2, 0);
      if (floor >= 1 && floor <= 4) {
        this.sprite("kiosk", 478, y - 19);
        this.text(ui.MAP, 475, y - 27, 19);
        for (const x of [132, 602]) this.sprite("plant", x, y - 16);
        this.rect(404, y - 8, 26, 3, 26);
        this.rect(406, y - 5, 2, 5, 4);
        this.rect(426, y - 5, 2, 5, 4);
      }
    }
    for (const s of stores) this.storefront(s.id, s.x, floorY(s.floor) - 44, g);
    for (const l of g.lifts) {
      const top = floorY(l.min) - 44,
        bottom = floorY(l.max);
      this.rect(l.x - 15, top, 30, bottom - top, 0);
      this.rect(l.x - 12, top, 2, bottom - top, 3);
      this.rect(l.x + 10, top, 2, bottom - top, 3);
      for (let f = l.min; f <= l.max; f++) {
        const y = floorY(f);
        this.text(floorNames[f], l.x - 25, y - 15, 27);
        if (l.y < y) {
          this.rect(l.x - 12, y - 1, 24, 2, 3);
          for (let x = -11; x < 12; x += 4) this.rect(l.x + x, y - 3, 1, 3, 4);
        }
      }
      this.rect(l.x - 12, l.y - 24, 24, 24, 17);
      this.rect(l.x - 10, l.y - 22, 20, 19, 0);
      if (l.dir) {
        this.rect(l.x - 9, l.y - 21, 9, 19, 3);
        this.rect(l.x + 1, l.y - 21, 9, 19, 3);
      }
      this.rect(l.x - 12, l.y - 2, 24, 3, 27);
      this.rect(l.x - 7, l.y - 27, 14, 3, l.dir ? 10 : 22);
    }
    for (const e of escalators) {
      const y = floorY(e.top);
      this.ctx.strokeStyle = P[26];
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(e.x - 12, y + 48);
      this.ctx.lineTo(e.x + 12, y);
      this.ctx.stroke();
      for (let n = 0; n < 8; n++) {
        const yy = y + n * 6 + (g.frame % 12) / 2;
        this.rect(e.x + 12 - (yy - y) / 2 - 4, yy, 12, 2, 4);
      }
    }
    this.rect(443, floorY(2) - 27, 18, 27, 13);
    this.rect(446, floorY(2) - 22, 12, 17, 0);
    this.text(ui.PHOTO, 438, floorY(2) - 34, 14);
    for (const [x, f] of [
      [520, 2],
      [295, 4],
    ]) {
      const y = floorY(f);
      this.rect(x - 16, y - 8, 32, 7, 4);
      this.rect(x - 12, y - 6, 24, 3, 18);
      this.rect(x - 2, y - 19, 4, 14, 4);
      this.rect(x - 8, y - 20, 16, 2, 19);
    }
    for (let x = 40; x < 768; x += 140) {
      this.rect(x, floorY(5) - 42, 8, 42, 3);
      this.rect(x, floorY(5) - 22, 8, 6, 27);
    }
    this.car(654, floorY(5) - 22);
    this.text(ui.GETAWAY, 660, floorY(5) - 34, 27);
    for (const l of g.lamps) {
      if (l.mode === "hang")
        this.sprite(l.disco ? "disco" : "lamp", l.x - 8, l.y - 8);
      if (l.mode === "fall" || l.mode === "roll")
        this.sprite(l.disco ? "disco" : "lamp", l.x - 8, l.y - 8);
      if (l.dark) {
        this.ctx.globalAlpha = 0.4;
        this.rect(l.x - 45, floorY(l.floor) - 44, 90, 44, 0);
        this.ctx.globalAlpha = 1;
      }
    }
    const j = g.janitor;
    this.sprite("janitor", j.x - 8, floorY(4) - 24, j.dir < 0);
    this.rect(j.x + 10, floorY(4) - 22, 1, 22, 26);
    this.rect(j.x + 7, floorY(4) - 3, 9, 2, 4);
    if (g.wet) {
      this.rect(g.wet.x, floorY(4) - 2, 48, 2, 18);
      this.rect(g.wet.x + 22, floorY(4) - 12, 7, 10, 27);
      this.text("!", g.wet.x + 24, floorY(4) - 10, 0);
    }
    for (const w of g.walkers)
      this.sprite("walker", w.x - 8, floorY(3) - 24, w.dir < 0);
    const c = g.cop;
    this.sprite("cop", c.x - 8, floorY(c.floor) - 26, c.dir < 0);
    this.rect(c.x - 10, floorY(c.floor) - 4, 20, 2, 4);
    this.rect(c.x - 8, floorY(c.floor) - 2, 4, 3, 0);
    this.rect(c.x + 4, floorY(c.floor) - 2, 4, 3, 0);
    for (const s of g.spies) this.drawSpy(g, s, false);
    if (
      !p.hidden &&
      (!p.inv || g.frame % 8 < 4) &&
      (!g.food || g.frame % 4 < 2)
    ) {
      const n = g.death
        ? "agentDead"
        : p.kick
          ? "agentKick"
          : p.duck
            ? "agentDuck"
            : `agent${p.vx ? Math.floor(g.frame / 8) % 4 : 0}`;
      this.sprite(n, p.x - 8, p.y - 24, p.dir < 0);
      if (g.scene === "arrival" && g.sceneFrame < 90) {
        this.rect(p.x - 5, p.y - 29, 2, 7, 11);
        this.rect(p.x + 3, p.y - 29, 2, 7, 11);
      }
    }
    for (const b of g.bullets)
      this.rect(b.x - 2, b.y - 1, 4, 2, b.enemy ? 27 : 7);
    for (const c of g.pickups)
      this.sprite(c.kind === "coin" ? "coin" : "power", c.x - 8, c.y - 8);
    this.drawPopups(g);
    this.ctx.restore();
  }
  drawSpy(g: Game, s: Game["spies"][number], room: boolean) {
    let name = s.bot
      ? "bot"
      : s.dead
        ? "spyDead"
        : s.aim
          ? "spyAim"
          : s.duck
            ? "spyDuck"
            : room
              ? "spyTop" + (Math.floor(g.frame / 10) % 4)
              : "spy" + (Math.floor(g.frame / 10) % 4);
    this.sprite(name, s.x - 8, s.y - (room ? 8 : 24), s.dir < 0);
    if (s.aim) {
      this.text("!", s.x - 2, s.y - (room ? 17 : 32), 10);
    }
    if (s.bubbleTime && s.bubble) {
      const x =
          clamp(
            s.x - this.cx - s.bubble.length * 2,
            3,
            253 - s.bubble.length * 4,
          ) + this.cx,
        y = s.y - (room ? 25 : 39);
      this.rect(x - 2, y - 2, s.bubble.length * 4 + 3, 9, 6);
      this.text(s.bubble, x, y, 0);
    }
  }
  storeRoom(g: Game) {
    const r = g.rooms[g.store],
      s = stores[g.store],
      t = themes[s.theme],
      p = g.player;
    this.cx = clamp(p.x - 128, 0, Math.max(0, r.w - 256));
    this.cy = clamp(p.y - 104, 0, Math.max(0, r.h - 176));
    this.ctx.save();
    this.ctx.translate(-Math.floor(this.cx), 32 - Math.floor(this.cy));
    this.rect(0, 0, r.w, r.h, t[0]);
    for (let y = 16; y < r.h - 16; y += 16)
      for (let x = 16; x < r.w - 16; x += 16) {
        this.rect(x + 1, y + 1, 14, 14, (x + y) % 32 === 0 ? t[0] : t[1]);
        this.rect(x + 2, y + 2, 1, 1, t[2]);
      }
    this.rect(0, 0, r.w, 16, t[1]);
    this.rect(0, 0, 16, r.h, t[1]);
    this.rect(r.w - 16, 0, 16, r.h, t[1]);
    this.rect(0, r.h - 16, r.w, 16, t[1]);
    this.rect(r.w / 2 - 12, r.h - 16, 24, 16, 0);
    this.text(ui.EXIT, r.w / 2, r.h - 12, 22, 1, true);
    this.text(s.name, r.w / 2, 5, 6, 1, true);
    for (const f of r.fixtures) {
      this.rect(f.x + 2, f.y + 3, f.w, f.h, 0);
      this.rect(f.x, f.y, f.w, f.h, t[2]);
      this.rect(f.x + 2, f.y + 2, f.w - 4, f.h - 4, t[1]);
      this.rect(f.x, f.y + f.h - 4, f.w, 3, 4);
      const icon: Record<Theme, string> = {
        fashion: "rack",
        electronics: "tv",
        toys: "teddy",
        food: "cornDog",
        sports: "shoe",
        music: "record",
        gadgets: s.id === 2 ? "chair" : "vacuum",
        novelty: "lava",
        games: "console",
      };
      if (f.open) {
        this.rect(f.x + 3, f.y + 4, f.w - 6, f.h - 10, 0);
        this.sprite(icon[s.theme], f.x + 6, f.y + 8);
        this.rect(f.x - 2, f.y - 3, f.w + 4, 4, t[2]);
      } else
        this.sprite(
          f.kind === "fitting" ? "mannequin" : icon[s.theme],
          f.x + 4,
          f.y + 3,
        );
      if (g.radar && f.content === "package" && !f.open && g.frame % 40 < 25)
        this.text("!", f.x + 11, f.y - 8, 27, 2);
    }
    if (s.id === 7) {
      this.rect(164, 18, 42, 18, 0);
      this.text(ui.SIDE_B, 168, 23, 27);
      this.sprite("boombox", 183, 28);
    }
    if (s.id === 3) {
      this.sprite("tv", 54, 21);
      this.sprite("tv", 186, 21);
      this.rect(119, 67, 18, 14, 27);
      if (g.egg) this.sprite("spyTop0", 120, 23);
      if (g.eggItem && !g.egg) this.sprite("power", 120, 71);
    }
    for (const toy of g.toys) this.sprite("toy", toy.x - 8, toy.y - 8);
    for (const spy of g.spies) this.drawSpy(g, spy, true);
    if (!p.inv || g.frame % 8 < 4)
      this.sprite(
        "agentTop" + (Math.floor(g.frame / 10) % 4),
        p.x - 8,
        p.y - 8,
        p.face === 3,
      );
    for (const b of g.bullets)
      this.rect(b.x - 1, b.y - 1, 3, 3, b.enemy ? 27 : 7);
    for (const c of g.pickups) this.sprite("power", c.x - 8, c.y - 8);
    if (g.bannerTime > 120 && g.banner.startsWith(ui.PACKAGE))
      this.sprite("package", p.x - 8, p.y - 26);
    this.drawPopups(g);
    this.ctx.restore();
    this.rect(0, 208, 256, 32, 0);
    this.text(s.name, 128, 213, t[2], 1, true);
    const can = r.fixtures.some(
      (f) =>
        !f.open &&
        p.x + 10 >= f.x &&
        p.x - 10 <= f.x + f.w &&
        p.y + 10 >= f.y &&
        p.y - 10 <= f.y + f.h,
    );
    this.text(
      g.search
        ? labels.searching
        : can
          ? labels.search
          : ui.ARROWS_MOVE_Z_SHOOT_X_SEARCH,
      128,
      226,
      6,
      1,
      true,
    );
    if (g.search) {
      this.rect(65, 235, 126, 3, 3);
      this.rect(65, 235, (126 * g.search.frame) / (g.speed ? 30 : 45), 3, 22);
    }
    if (g.egg) {
      this.panel(15, 158, 226, 39, 0);
      const msg = "IT'S DANGEROUS TO GO ALONE!|TAKE THIS.";
      const n = Math.floor((180 - g.egg) / 2);
      this.lines(msg.slice(0, n), 25, 169, 6);
      this.text("OLD CLERK", 128, 151, 27, 1, true);
    }
  }
  drawPopups(g: Game) {
    for (const p of g.popups)
      this.text(
        (p.n > 0 ? "+" : "") + p.n,
        clamp(p.x - this.cx, 15, 241) + this.cx,
        p.y - (60 - p.life) / 4,
        p.n > 0 ? 27 : 10,
        1,
        true,
      );
  }
  hud(g: Game) {
    this.rect(0, 0, 256, 16, 0);
    this.text(String(g.score).padStart(6, "0"), 3, 2, 6);
    this.text(`PKG ${g.packages}/6`, 32, 2, g.packages === 6 ? 22 : 10);
    this.sprite("agentTop0", 65, -5);
    this.text(String(g.lives), 80, 2, 6);
    this.rect(232, 1, 22, 13, 17);
    const floor = floorNames[g.player.floor] ?? "R";
    if (g.scene === "store") {
      const name = stores[g.store].name + "   ";
      const marquee = (name + name).slice(
        Math.floor(g.frame / 15) % name.length,
      );
      this.text(marquee.slice(0, 5), 234, 5, 27);
    } else this.text(floor, 243, 4, 27, 1, true);
    if (g.armor) this.text("A", 216, 3, 19);
    if (g.radar) this.text("R", 224, 3, 22);
    const power = g.food ? ui.CINNABOMB : (g.weapon ?? g.speed);
    if (power) {
      this.text(power, 3, 10, 27);
      const n = g.food
        ? g.food / 360
        : g.weapon
          ? g.weaponTime / 1200
          : g.speedTime / (g.speed === ui.SNEAKERS ? 1200 : 720);
      this.rect(76, 10, 60, 3, 3);
      this.rect(76, 10, 60 * n, 3, 22);
    }
    if (g.alarm && g.frame % 40 < 25) this.text(ui.ALARM, 149, 3, 10);
    this.text(`LOOP ${g.loop}`, 181, 10, 4);
  }
  banner(g: Game) {
    const lines = g.banner.split("|").flatMap((l) => wrap(l, 55));
    const y = g.scene === "store" ? 17 : 19;
    this.rect(1, y, 254, lines.length * 8 + 5, 0);
    for (const [i, line] of lines.entries())
      this.text(line, 128, y + 3 + i * 8, 27, 1, true);
  }
  car(x: number, y: number) {
    this.rect(x + 4, y + 5, 53, 15, 26);
    this.rect(x + 10, y, 33, 12, 26);
    this.rect(x + 13, y + 2, 12, 8, 18);
    this.rect(x + 28, y + 2, 12, 8, 18);
    this.rect(x, y + 12, 62, 8, 26);
    this.rect(x + 3, y + 14, 56, 4, 25);
    for (let i = 6; i < 58; i += 5) this.rect(x + i, y + 14, 2, 3, 27);
    this.rect(x + 7, y + 18, 9, 7, 0);
    this.rect(x + 44, y + 18, 9, 7, 0);
    this.rect(x + 9, y + 20, 5, 3, 4);
    this.rect(x + 46, y + 20, 5, 3, 4);
    this.rect(x + 58, y + 12, 4, 4, 27);
  }
  post(g: Game) {
    this.panel(35, 39, 186, 167, 0);
    this.rect(37, 41, 182, 17, 9);
    this.text(ui.SPYGRAM, 128, 46, 7, 2, true);
    this.rect(43, 63, 170, 76, 2);
    for (let x = 44; x < 212; x += 20) {
      this.rect(x, 113, 17, 25, 1);
      this.rect(x + 5, 119, 3, 3, 27);
    }
    this.sprite("agent0", 119, 88);
    this.rect(135, 94, 6, 9, 4);
    if (g.scene === "arrival" && g.sceneFrame < 126)
      this.rect(43, 63, 170, 76, 7);
    this.text(ui.AGENT_7, 49, 68, 6);
    this.lines(g.post[0], 48, 147, 6, 21);
    this.text(`${Math.min(9999, g.sceneFrame * 17)} LIKES`, 48, 168, 14);
    this.text(g.post[1], 48, 185, 19);
    this.text(ui.ANY_BUTTON_TO_SKIP, 128, 212, 4, 1, true);
  }
  map(g: Game) {
    this.rect(0, 16, 256, 224, 0);
    this.text(ui.MALL_DIRECTORY, 128, 23, 27, 2, true);
    const y0 = 55;
    for (let floor = 0; floor < 6; floor++) {
      const y = y0 + floor * 22;
      this.text(floorNames[floor], 4, y + 7, 6);
      this.rect(23, y + 18, 227, 1, 3);
      for (const s of stores.filter((s) => s.floor === floor)) {
        const x = 24 + (s.x / 768) * 220,
          c =
            s.role === "closed"
              ? 2
              : s.role === "shop"
                ? 17
                : g.rooms[s.id].cleared
                  ? 3
                  : 9;
        this.rect(x, y, 23, 16, c);
        if (s.role === "closed") this.rect(x + 1, y + 1, 21, 14, 0);
        this.text(s.name.slice(0, 5), x + 2, y + 3, 6);
        if (g.radar && s.role === "target" && !g.rooms[s.id].cleared)
          this.text("!", x + 10, y + 10, 27);
      }
    }
    for (const l of g.lifts) {
      const x = 24 + (l.x / 768) * 220;
      this.rect(x, y0 + l.min * 22, 2, (l.max - l.min) * 22 + 18, 4);
      this.rect(x - 3, y0 + ((l.y - 48) / 48) * 22 + 4, 8, 10, 27);
    }
    for (const e of escalators) {
      const x = 24 + (e.x / 768) * 220;
      this.text("/", x, y0 + e.top * 22 + 18, 19, 2);
    }
    this.ctx.save();
    this.ctx.translate(218, y0 + 5 * 22 + 3);
    this.ctx.scale(0.45, 0.45);
    this.car(0, 0);
    this.ctx.restore();
    if (g.frame % 40 < 25) {
      const s = g.store >= 0 && g.scene === "store" ? stores[g.store] : null;
      this.text(
        "V",
        24 + ((s ? s.x + 40 : g.player.x) / 768) * 220,
        y0 + (s ? s.floor : g.player.floor) * 22 - 7,
        22,
        2,
        true,
      );
    }
    this.text(ui.RED_PACKAGE_BLUE_POWER, 128, 192, 6, 1, true);
    this.text(ui.GRAY_CLEARED_OUTLINE_CLOSED, 128, 203, 4, 1, true);
    this.lines(
      ui.INVENTORY + (g.inventory.length ? g.inventory.join(", ") : ui.EMPTY),
      5,
      216,
      27,
      60,
    );
    this.text(ui.SHIFT_ENTER_TO_CLOSE, 128, 231, 19, 1, true);
  }
  clear(g: Game) {
    if (g.clearStage === 0) {
      this.rect(0, 16, 256, 224, 2);
      for (let x = 12; x < 256; x += 60) this.rect(x, 30, 9, 140, 3);
      this.rect(0, 170, 256, 70, 1);
      this.car(55 + g.sceneFrame * 0.6, 153);
      this.sprite("spy0", 28 + g.sceneFrame * 0.4, 154);
      this.rect(42 + g.sceneFrame * 0.4, 148, 7, 10, 6);
      this.text(ui.LEVEL_CLEAR, 128, 38, 27, 3, true);
      this.text("6 PACKAGES SECURED", 128, 75, 6, 1, true);
      this.text(ui.PACKAGES_3000, 54, 94, 6);
      this.text(`TIME BONUS     ${g.bonus}`, 54, 108, 6);
      this.text(ui.CLEAR_BONUS_1000, 54, 122, 6);
      this.text(`LOOP ${g.loop}`, 128, 199, 19, 2, true);
      this.text(ui.ENTER_TO_CONTINUE, 128, 225, 4, 1, true);
    } else if (g.clearStage === 1) {
      this.rect(14, 22, 228, 202, 6);
      this.text(ui.THE_DAILY_MALL, 128, 35, 0, 3, true);
      this.rect(23, 58, 210, 2, 0);
      this.text(ui.EXCLUSIVE_25_CENTS, 128, 67, 3, 1, true);
      this.lines(g.headline, 25, 87, 0, 26);
      this.rect(35, 119, 186, 61, 4);
      this.car(82, 145);
      this.sprite("spy0", 56, 141);
      for (let y = 191; y < 215; y += 5) this.rect(25, y, 206, 1, 3);
      this.text(ui.ENTER_NEXT_PAGE, 128, 232, 4, 1, true);
    } else this.post(g);
  }
  photoStrip(g: Game) {
    this.panel(213, 53, 34, 133, 6);
    for (let i = 0; i < 4; i++) {
      this.rect(217, 57 + i * 31, 26, 27, 2);
      this.sprite("agent" + i, 222, 59 + i * 31, i % 2 === 1);
    }
    this.text(ui.PHOTO, 230, 190, 27, 1, true);
  }
  continue(g: Game) {
    this.sky();
    this.text(ui.CONTINUE, 128, 66, 27, 3, true);
    const n = Math.max(0, 9 - Math.floor(g.sceneFrame / 60));
    this.text(String(n), 128, 108, n <= 3 ? 10 : 6, 8, true);
    this.text(`CONTINUES LEFT: ${g.continues}`, 128, 170, 19, 1, true);
    this.text(ui.ENTER_FOR_3_FRESH_LIVES, 128, 193, 6, 1, true);
    this.text(ui.SCORE_AND_PACKAGES_KEPT, 128, 208, 4, 1, true);
  }
  over(g: Game) {
    this.mall(g);
    this.ctx.globalAlpha = 0.8;
    this.rect(0, 16, 256, 224, 0);
    this.ctx.globalAlpha = 1;
    for (let y = 16; y < 16 + Math.min(224, g.sceneFrame); y += 5)
      this.rect(0, y, 256, 3, 3);
    this.panel(20, 83, 216, 76, 0);
    if (g.sceneFrame < 150) {
      const msg = labels.gameOver.slice(0, Math.floor(g.sceneFrame / 2));
      this.lines(msg, 33, 105, 6);
    } else {
      this.text(ui.GAME_OVER, 128, 96, 10, 3, true);
      this.text(
        `SCORE ${String(g.score).padStart(6, "0")}`,
        128,
        127,
        6,
        1,
        true,
      );
      this.text(
        `HIGH  ${String(g.high).padStart(6, "0")}`,
        128,
        142,
        27,
        1,
        true,
      );
    }
  }
  gallery(frame: number) {
    this.rect(0, 0, 256, 240, 0);
    this.text(ui.FLICKERSOFT_SPRITE_GALLERY, 128, 4, 27, 1, true);
    const names = Object.keys(sprites);
    const page = Math.floor(frame / 240) % Math.ceil(names.length / 48);
    for (const [i, name] of names.slice(page * 48, page * 48 + 48).entries()) {
      const x = (i % 8) * 32,
        y = 20 + Math.floor(i / 8) * 35;
      this.sprite(name, x + 8, y);
      this.text(name.slice(0, 8), x, y + 25, 4);
    }
    this.text(
      `PAGE ${page + 1} / ${Math.ceil(names.length / 48)}`,
      128,
      232,
      19,
      1,
      true,
    );
  }
}
