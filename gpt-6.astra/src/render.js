import { PAL, text, textWidth, drawSprite, SPRITES } from "./art.js";
import { FLOOR_Y, SHAFTS, ESCALATORS, THEMES } from "./data.js";
import { TEXT, FLOORS, UI } from "./copy.js";
import { splashFrame } from "./splash/splash.js";
import { clamp, wrap } from "./math.js";
import { touchingFixture } from "./rules.js";
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext("2d", { alpha: false });
    if (!this.c)
      throw Error(
        "Canvas graphics are unavailable. Enable hardware acceleration in your browser.",
      );
    this.c.imageSmoothingEnabled = false;
    this.cam = { x: 0, y: 0 };
  }
  rect(x, y, w, h, color) {
    this.c.fillStyle = PAL[color] || color;
    this.c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
  }
  line(x, y, x2, y2, color) {
    this.c.strokeStyle = PAL[color];
    this.c.lineWidth = 1;
    this.c.beginPath();
    this.c.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
    this.c.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    this.c.stroke();
  }
  txt(t, x, y, col = "cream", scale = 1) {
    text(this.c, t, x, y, col, scale);
  }
  center(t, y, col = "cream", scale = 1) {
    this.txt(t, Math.floor((256 - textWidth(t, scale)) / 2), y, col, scale);
  }
  sprite(n, x, y, opt) {
    drawSprite(this.c, n, x, y, opt);
  }
  box(x, y, w, h, color = "navy", edge = "cyan") {
    this.rect(x - 1, y - 1, w + 2, h + 2, "black");
    this.rect(x, y, w, h, edge);
    this.rect(x + 2, y + 2, w - 4, h - 4, color);
  }
  draw(s, ui = {}) {
    this.c.save();
    this.rect(0, 0, 256, 240, "black");
    if (ui.gallery) this.gallery(s);
    else if (s.scene === "splash") this.splash(s);
    else if (s.scene === "title") this.title(s);
    else if (
      ["clear", "paper", "post", "continue", "gameover"].includes(s.scene)
    )
      this.screen(s);
    else {
      if (
        s.room &&
        (s.scene === "store" ||
          (s.deathScene === "store" && s.scene === "death"))
      )
        this.room(s);
      else this.mall(s);
      this.hud(s);
      if (s.scene === "selfie") this.post(s, false);
      if (s.scene === "death") {
        this.rect(0, 16, 256, 224, "#08081488");
        this.center(s.lives > 0 ? UI.agentDown : UI.lastReceipt, 103, "red", 2);
        this.center(s.lives > 0 ? UI.backSoon : UI.noRefunds, 123);
      }
      if (s.overlay === "map") this.map(s);
      else if (s.overlay === "pause") {
        this.rect(0, 16, 256, 224, "#080814bb");
        if (s.frame % 60 < 42) this.center(TEXT.pause, 104, "yellow", 3);
        this.center(TEXT.pausedHint, 131, "cream");
      } else if (s.scene === "mall" || s.scene === "store") {
        if (s.banner && !s.dialog && !s.cave?.frame) this.banner(s.banner.text);
        else if (s.banner && s.scene === "store" && (!s.cave || s.cave.taken))
          this.banner(s.banner.text);
        if (s.photoShow > 0) this.photoStrip(s);
        if (s.kioskShow > 0) this.kiosk(s);
      }
      if (s.transition) {
        const a =
          s.transition.frames > 12
            ? (24 - s.transition.frames) / 12
            : s.transition.frames / 12;
        this.rect(0, 16, 256, 224, `rgba(8,8,20,${a * 0.95})`);
      }
    }
    if (ui.notice) {
      this.box(79, 220, 98, 14);
      this.center(ui.notice, 225, "white");
    }
    this.c.restore();
  }
  splash(s) {
    const f = splashFrame(s.sceneFrame),
      colors = ["red", "orange", "yellow", "green", "cyan", "pink"];
    for (const [i, l] of f.letters.entries())
      if (l.visible) this.txt(l.letter, 18 + i * 20, 94, colors[l.color], 4);
    if (f.underline) {
      this.rect(18, 121, 216, 2, "cyan");
      this.rect(18, 125, 216, 1, "purple");
    }
    if (f.presents) this.center(TEXT.presents, 147, "cream", 2);
    this.center(TEXT.splashHint, 218, "slate");
  }
  sky() {
    for (let i = 0; i < 8; i++)
      this.rect(
        0,
        i * 20,
        256,
        20,
        ["black", "black", "navy", "navy", "blue", "blue", "sky", "sky"][i],
      );
    for (let i = 0; i < 46; i++) {
      let x = (i * 73 + 11) % 256,
        y = (i * i * 17) % 125;
      this.rect(x, y, 1, 1, i % 4 ? "slate" : "cream");
    }
    this.rect(205, 21, 13, 13, "cream");
    this.rect(200, 17, 13, 13, "navy");
    for (let i = 0; i < 12; i++) {
      const h = 12 + ((i * 17) % 33);
      this.rect(i * 24 - 8, 173 - h, 19, h, "navy");
      for (let yy = 178 - h; yy < 167; yy += 7)
        for (let xx = i * 24 - 5; xx < i * 24 + 8; xx += 5)
          if ((xx + yy) % 3) this.rect(xx, yy, 2, 3, "yellow");
    }
  }
  title(s) {
    this.sky();
    this.center(TEXT.studio, 15, "cyan", 1);
    this.rect(70, 25, 116, 1, "purple");
    this.center(UI.mall, 42, "navy", 6);
    this.center(UI.mall, 39, "pink", 6);
    this.center(UI.mall, 36, "cream", 6);
    this.center(UI.action, 79, "navy", 6);
    this.center(UI.action, 76, "red", 6);
    this.center(UI.action, 73, "orange", 6);
    this.center(TEXT.subtitle, 112, "cream");
    this.center(`HI ${String(s.high).padStart(6, "0")}`, 128, "cyan");
    if (s.frame % 60 < 42) this.center(TEXT.start, 143, "white", 2);
    if (s.blackFriday) {
      this.box(51, 161, 154, 23, "purple", "pink");
      this.center(TEXT.blackFriday, 165, s.frame % 12 < 6 ? "yellow" : "white");
      this.center(TEXT.discount, 174, "cream");
    }
    const scroll = Math.floor(s.frame / 3) % 400;
    for (let i = 0; i < 5; i++) {
      const st = s.stores[i];
      let x = i * 88 - scroll;
      while (x < -88) x += 440;
      this.front({ ...st, x }, 214, s, 0);
    }
    this.rect(0, 214, 256, 3, "cream");
    this.rect(0, 217, 256, 23, "black");
    this.center(TEXT.controls, 220, "gray");
    this.center(TEXT.copyright, 230, "slate");
  }
  storefrontDisplay(theme, x, y, t, side) {
    const names = {
      fashion: ["dress", "dress"],
      electronics: ["tv", "radio"],
      toys: ["bear", "rocket"],
      food: ["lemonade", "food"],
      sports: ["shoe", "ball"],
      music: ["record", "boombox"],
      lounge: ["chair", "orb"],
      gadgets: ["vacuum", "orb"],
      novelty: ["lava", "orb"],
      games: ["console", "rocket"],
      video: ["tv", "tv"],
      books: ["record", "record"],
    };
    let n = (names[theme] || names.electronics)[side];
    if (n === "boombox") {
      this.sprite(n, x - 3, y + 2);
      if (t % 20 < 10) this.rect(x, y + 8, 2, 2, "yellow");
    } else this.sprite(n, x + 1, y + 1);
    if (n === "tv") {
      this.rect(x + 3, y + 7, 10, 1, t % 10 < 5 ? "cream" : "blue");
      this.rect(x + 4, y + 10, 8, 1, t % 13 < 6 ? "cyan" : "navy");
    }
    if (n === "orb" && t % 30 < 15) this.rect(x + 7, y + 7, 4, 4, "white");
    if (n === "lava" && t % 40 < 20) this.rect(x + 7, y + 6, 3, 2, "pink");
    if (n === "lemonade")
      this.rect(x + 8, y - (t % 32 < 16 ? 0 : 2), 2, 3, "cream");
  }
  front(st, y, s, offset = 0) {
    const x = st.x - offset,
      w = 80,
      closed = st.role === "closed",
      cleared = st.cleared;
    const theme = THEMES[st.theme] || ["gray", "slate", "navy"];
    this.rect(x, y - 39, w, 39, theme[2]);
    this.rect(x, y - 39, w, 8, closed ? "slate" : theme[0]);
    this.txt(
      st.name,
      x + Math.floor((80 - textWidth(st.name)) / 2),
      y - 37,
      closed ? "gray" : "black",
    );
    this.rect(x + 1, y - 30, 78, 2, theme[1]);
    for (const side of [0, 1]) {
      const xx = x + 4 + side * 49;
      this.rect(xx, y - 27, 23, 23, "black");
      this.rect(xx + 1, y - 26, 21, 20, cleared ? "navy" : "blue");
      if (!cleared && !closed)
        this.storefrontDisplay(st.theme, xx + 2, y - 25, s.frame, side);
      this.rect(xx, y - 5, 23, 2, theme[1]);
      this.line(xx + 3, y - 25, xx + 8, y - 20, "slate");
    }
    this.rect(x + 31, y - 29, 18, 29, "black");
    this.rect(
      x + 33,
      y - 27,
      14,
      27,
      closed
        ? "slate"
        : cleared
          ? "navy"
          : st.role === "target"
            ? s.frame % 60 < 42
              ? "red"
              : "brown"
            : "blue",
    );
    this.rect(x + 34, y - 24, 12, 12, closed ? "gray" : "navy");
    this.rect(x + 44, y - 10, 1, 2, "yellow");
    this.rect(x + 30, y - 1, 20, 1, "cream");
    if (st.role === "target" && !cleared) {
      this.txt("!", x + 39, y - 22, "yellow");
      if (s.blackFriday) this.txt(UI.discount, x + 4, y - 14, "yellow");
    }
    if (closed) {
      for (let yy = y - 27; yy < y; yy += 3)
        this.rect(x + 2, yy, 76, 1, "gray");
      this.rect(x + 12, y - 19, 56, 9, "cream");
      this.txt(
        st.id === "border" ? UI.closingSale : UI.forLease,
        x + (st.id === "border" ? 16 : 22),
        y - 17,
        "red",
      );
    }
    if (s.blackFriday && st.role === "shop")
      this.txt(UI.discount, x + 5, y - 12, "yellow");
  }
  mall(s) {
    const p = s.p;
    let cx = clamp(Math.floor(p.x - 128), 0, 512),
      cy = clamp(Math.floor(p.y - 136), 0, 96);
    if (s.scene === "arrival" || s.scene === "selfie") {
      cx = 0;
      cy = 0;
    }
    this.cam = { x: cx, y: cy };
    this.c.save();
    this.c.beginPath();
    this.c.rect(0, 16, 256, 224);
    this.c.clip();
    const shake = s.shake ? (s.frame % 4 < 2 ? 1 : -1) * 2 : 0;
    this.c.translate(-cx + shake, 16 - cy);
    this.rect(0, 0, 768, 330, "navy");
    for (let i = 0; i < 64; i++)
      this.rect((i * 97) % 768, (i * 37) % 53, 1, 1, i % 3 ? "slate" : "cream");
    this.rect(0, 0, 28, 64, "black");
    for (let x = 4; x < 26; x += 6)
      for (let y = 3; y < 64; y += 10)
        if ((x + y) % 4) this.rect(x, y, 2, 4, "yellow");
    this.line(15, 8, 130, 46, "gray");
    this.rect(128, 43, 3, 21, "gray");
    this.rect(36, 49, 87, 15, "blue");
    this.txt(UI.galleria, 39, 53, "cyan");
    for (let f = 0; f < 6; f++) {
      const y = FLOOR_Y[f];
      if (f) {
        this.rect(0, y - 44, 768, 43, f % 2 ? "navy" : "blue");
        for (let x = 0; x < 768; x += 16) {
          this.rect(x, y - 10, 16, 1, "slate");
          this.rect(x + (f % 2 ? 0 : 8), y - 44, 1, 33, "#101c3866");
        }
        this.rect(0, y - 42, 768, 2, "slate");
      }
      this.rect(0, y, 768, 3, f === 0 ? "gray" : "cream");
      this.rect(0, y + 3, 768, 3, "purple");
      this.rect(0, y + 6, 768, 2, "black");
      for (let x = 0; x < 768; x += 16) this.rect(x, y + 1, 1, 2, "brown");
      if (f > 0 && f < 5) {
        this.txt(FLOORS[f], 8, y - 30, "cyan", 2);
        for (const x of [142, 730]) this.sprite("plant", x, y - 24);
        this.sprite("bench", 550, y - 16);
      }
    }
    for (const st of s.stores) this.front(st, FLOOR_Y[st.floor], s);
    for (const e of s.elevators) {
      this.rect(
        e.x - 18,
        FLOOR_Y[e.min] - 30,
        36,
        FLOOR_Y[e.max] - FLOOR_Y[e.min] + 38,
        "black",
      );
      this.rect(
        e.x - 18,
        FLOOR_Y[e.min] - 30,
        2,
        FLOOR_Y[e.max] - FLOOR_Y[e.min] + 38,
        "slate",
      );
      this.rect(
        e.x + 16,
        FLOOR_Y[e.min] - 30,
        2,
        FLOOR_Y[e.max] - FLOOR_Y[e.min] + 38,
        "slate",
      );
      for (let f = e.min; f <= e.max; f++) {
        const y = FLOOR_Y[f];
        this.rect(e.x - 15, y - 30, 30, 3, "slate");
        if (e.y < y) {
          this.rect(e.x - 16, y, 32, 2, "slate");
          for (let x = e.x - 16; x < e.x + 16; x += 4)
            this.rect(x, y, 2, 2, "cream");
        }
        this.rect(e.x + 20, y - 22, 7, 7, "black");
        this.txt(e.id, e.x + 22, y - 21, e.auto ? "pink" : "yellow");
        this.rect(e.x + 21, y - 11, 4, 2, e.called ? "yellow" : "red");
      }
      this.line(e.x - 5, FLOOR_Y[e.min] - 30, e.x - 5, e.y - 28, "slate");
      this.line(e.x + 5, FLOOR_Y[e.min] - 30, e.x + 5, e.y - 28, "slate");
      this.rect(e.x - 15, e.y - 29, 30, 29, "blue");
      this.rect(e.x - 12, e.y - 26, 24, 25, "navy");
      this.rect(e.x - 12, e.y - 26, 24, 3, "yellow");
      if (e.target !== null) {
        this.rect(e.x - 11, e.y - 23, 11, 22, "slate");
        this.rect(e.x + 1, e.y - 23, 11, 22, "slate");
        this.rect(e.x - 10, e.y - 22, 2, 18, "gray");
        this.rect(e.x + 9, e.y - 22, 2, 18, "gray");
      }
      this.rect(e.x - 17, e.y, 34, 4, "cyan");
    }
    for (const e of ESCALATORS) {
      const y = FLOOR_Y[e.top];
      for (let i = 0; i < 24; i++) {
        this.rect(e.x - 24 + i, y + i * 2, 23, 2, i % 2 ? "gray" : "navy");
      }
      this.line(e.x - 24, y - 18, e.x, y + 30, "cyan");
      this.line(e.x - 4, y - 18, e.x + 20, y + 30, "cyan");
      for (let i = 0; i < 12; i++)
        this.rect(
          e.x - 23 + i * 2,
          y + i * 4 + (s.frame % 12 < 6 ? 0 : 1),
          20,
          1,
          "cream",
        );
    }
    for (const k of s.kiosks)
      this.sprite("kiosk", k.x - 8, FLOOR_Y[k.floor] - 24);
    this.sprite("photoBooth", 398, 128);
    for (const f of s.fountains) {
      this.sprite("fountain", f.x - 20, FLOOR_Y[f.floor] - 24);
      if (s.frame % 20 < 10)
        this.rect(f.x - 9, FLOOR_Y[f.floor] - 20, 2, 3, "cyan");
    }
    for (const l of s.lamps) {
      if (l.dark) {
        this.rect(l.x - 36, FLOOR_Y[l.floor] - 40, 72, 40, "#08081499");
      }
      if (l.mode !== "broken") this.sprite(l.kind, l.x - 8, l.y - 8);
      else if (l.dark)
        for (let i = 0; i < 5; i++)
          this.rect(
            l.x - 12 + i * 6,
            FLOOR_Y[l.floor] - 2 - (i % 2),
            2,
            1,
            "cream",
          );
    }
    if (s.wet) {
      this.rect(s.wet.x, 255, s.wet.w, 1, "cyan");
      this.rect(s.wet.x + 5, 245, 9, 10, "yellow");
      this.txt("!", s.wet.x + 8, 247, "black");
    }
    this.sprite(
      "janitor" + (Math.floor(s.frame / 12) % 4),
      s.janitor.x - 8,
      232,
      { flip: s.janitor.dir < 0 },
    );
    for (const w of s.walkers)
      this.sprite("walker" + (Math.floor(s.frame / 8) % 4), w.x - 8, 184, {
        flip: w.dir < 0,
      });
    this.sprite(
      "cop" + (Math.floor(s.frame / 12) % 4),
      s.cop.x - 8,
      FLOOR_Y[s.cop.floor] - 24,
      { flip: s.cop.dir < 0 },
    );
    for (const x of [40, 286, 520, 746]) {
      this.rect(x, 268, 10, 36, "slate");
      this.rect(x, 281, 10, 3, "yellow");
      this.rect(x, 287, 10, 3, "black");
    }
    this.txt("P", 12, 279, "cyan", 3);
    this.sprite("wagon", 594, 280);
    this.txt(UI.getaway, 610, 272, "yellow");
    for (const spy of s.spies) {
      if (spy.dead) {
        this.sprite("spy0", spy.x - 8, spy.y - 24, { flip: spy.dir < 0 });
        for (let i = 0; i < 4; i++)
          this.rect(
            spy.x - 12 + i * 7,
            spy.y - 18 - (spy.dead % 7),
            2,
            2,
            "cream",
          );
      } else {
        this.sprite(
          "spy" + (Math.floor(s.frame / 10) % 4),
          spy.x - 8,
          spy.y - (spy.duck ? 15 : 24),
          { flip: spy.dir < 0 },
        );
        if (spy.aim)
          this.txt("!", spy.x - 1, spy.y - 31, spy.high ? "yellow" : "red");
      }
    }
    if (!p.hidden && (p.inv % 8 < 4 || p.inv === 0) && s.scene !== "death") {
      const art =
        s.scene === "arrival" && s.sceneFrame < 100
          ? "zip"
          : p.duck
            ? "duck"
            : p.kick && p.jump
              ? "kick"
              : "agent" + (Math.floor(s.frame / 8) % 4);
      this.sprite(art, p.x - 8, p.y - 24, {
        flip: p.dir < 0,
        palette:
          p.power.bomb && s.frame % 10 < 5
            ? ["purple", "white", "yellow"]
            : null,
      });
      if (s.pose) this.sprite("package", p.x - 6, p.y - 39);
    }
    for (const b of s.bullets)
      this.rect(b.x - 2, b.y - 1, 4, 2, b.owner === "p" ? "yellow" : "pink");
    for (const c of s.coins)
      this.sprite("coin", c.x - 4, c.y - 4, {
        palette: c.gold ? ["white", "yellow", "orange"] : null,
      });
    for (const d of s.drops) this.sprite("power", d.x - 6, d.y - 12);
    for (const b of s.bubbles) this.bubble(b.x, b.y, b.text, cx, cy);
    for (const v of s.popups)
      this.txt(v.text, v.x, v.y - 25 - (60 - v.life) / 4, "yellow");
    this.c.restore();
    if (s.scene === "mall" && !s.banner && !s.overlay) {
      if (p.ride) {
        this.box(14, 221, 228, 13, "black", "slate");
        this.center(TEXT.hold + "  " + TEXT.out, 225, "cyan");
      } else if (p.floor === 0) {
        this.box(39, 221, 178, 13, "black", "slate");
        this.center(TEXT.roof, 225, "cyan");
      }
    }
  }
  bubble(x, y, t, cx = 0, cy = 0) {
    const lines = wrap(t, 28),
      w = Math.min(120, Math.max(...lines.map((l) => textWidth(l))) + 8);
    x = clamp(Math.round(x - w / 2), cx + 3, cx + 253 - w);
    y = clamp(y - lines.length * 7, cy + 4, cy + 190);
    this.box(x, y, w, lines.length * 7 + 6, "cream", "black");
    for (let i = 0; i < lines.length; i++)
      this.txt(lines[i], x + 4, y + 3 + i * 7, "navy");
    this.rect(x + w / 2, y + lines.length * 7 + 6, 3, 2, "cream");
  }
  room(s) {
    const st = s.stores.find((x) => x.id === s.storeId),
      r = s.room,
      theme = THEMES[st.theme],
      cx = clamp(Math.floor(s.p.x - 120), 0, Math.max(0, r.width - 256)),
      cy = clamp(Math.floor(s.p.y - 90), 0, Math.max(0, r.height - 176));
    this.cam = { x: cx, y: cy };
    this.c.save();
    this.c.beginPath();
    this.c.rect(0, 40, 256, 176);
    this.c.clip();
    this.c.translate(-cx, 40 - cy);
    this.rect(0, 0, r.width, r.height, "navy");
    for (let y = 16; y < r.height; y += 16)
      for (let x = 16; x < r.width - 16; x += 16) {
        this.rect(x, y, 15, 15, (x + y) % 32 === 0 ? "navy" : "black");
        this.rect(x + 1, y + 1, 1, 1, theme[0]);
        this.rect(x, y + 15, 16, 1, "blue");
      }
    this.rect(0, 0, r.width, 16, theme[0]);
    this.rect(0, 16, 16, r.height - 16, theme[2]);
    this.rect(r.width - 16, 16, 16, r.height - 16, theme[2]);
    this.rect(16, 16, r.width - 32, 2, theme[1]);
    for (let x = 16; x < r.width - 16; x += 32) {
      this.rect(x, 3, 24, 9, "navy");
      this.txt(
        st.theme === "games" ? UI.play : st.theme === "food" ? UI.yum : UI.sale,
        x + 4,
        5,
        theme[1],
      );
    }
    this.rect(0, r.height - 8, r.width, 8, theme[0]);
    this.rect(r.door.x, r.height - 16, r.door.w, 16, "black");
    this.txt(UI.exit, r.door.x + 8, r.height - 9, "green");
    this.rect(r.door.x - 1, r.height - 18, r.door.w + 2, 2, theme[1]);
    for (const d of r.decor) {
      this.rect(d.x, d.y, d.w, d.h, "purple");
      this.txt(UI.sideB, d.x + 3, d.y + 6, "cream");
    }
    for (const f of r.fixtures) {
      this.rect(f.x + 2, f.y + 3, f.w, f.h, "black");
      this.rect(f.x, f.y, f.w, f.h, theme[0]);
      this.rect(f.x + 1, f.y + 1, f.w - 2, 3, theme[1]);
      this.rect(f.x + 1, f.y + 5, f.w - 2, f.h - 6, theme[2]);
      if (f.kind === "fitting") {
        this.rect(f.x + 2, f.y + 4, f.w - 4, f.h - 5, "pink");
        for (let x = f.x + 3; x < f.x + f.w - 2; x += 4)
          this.rect(x, f.y + 4, 1, f.h - 5, "purple");
      } else if (!f.opened) {
        const n = {
          fashion: "dress",
          electronics: "tv",
          toys: "bear",
          food: "food",
          sports: "shoe",
          music: "record",
          gadgets: "vacuum",
          lounge: "chair",
          novelty: "lava",
          games: "console",
        }[st.theme];
        this.sprite(n, f.x + 4, f.y - 4);
      }
      if (f.opened) {
        this.rect(f.x + 2, f.y + 5, f.w - 4, 7, "black");
        this.rect(f.x + 4, f.y + 7, 5, 2, theme[1]);
        this.rect(f.x + 15, f.y + 11, 4, 2, theme[0]);
        this.line(f.x, f.y, f.x - 3, f.y - 4, theme[1]);
      }
      if (
        s.p.power.radar &&
        f.content === "package" &&
        !f.opened &&
        s.frame % 40 < 28
      )
        this.txt("!", f.x + 10, f.y - 12, "yellow", 2);
    }
    if (s.cave && !s.cave.taken) {
      this.sprite("clerk", 120, 32);
      this.sprite("tv", 80, 32);
      this.sprite("tv", 160, 32);
      this.rect(117, 69, 22, 14, "cream");
      this.rect(119, 71, 18, 10, "purple");
      if (s.cave.frame >= 180) this.sprite("power", 122, 66);
    }
    for (const g of s.guards) {
      if (g.dead && g.dead % 4 < 2) continue;
      this.sprite(
        g.kind === "bot"
          ? "bot" + (Math.floor(s.frame / 12) % 4)
          : "spyTop" + (Math.floor(s.frame / 10) % 4),
        g.x,
        g.y,
        { flip: g.dir < 0 },
      );
      if (g.aim) this.txt("!", g.x + 7, g.y - 8, "yellow");
      if (g.stun) this.txt("*", g.x + 6, g.y - 6, "cyan");
    }
    if (s.p.inv === 0 || s.p.inv % 8 < 4)
      this.sprite("agentTop" + (Math.floor(s.frame / 8) % 4), s.p.x, s.p.y, {
        flip: s.p.facing === "left",
        palette:
          s.p.power.bomb && s.frame % 10 < 5
            ? ["purple", "white", "yellow"]
            : null,
      });
    if (s.p.facing === "up") this.rect(s.p.x + 6, s.p.y + 3, 6, 4, "navy");
    if (s.pose) this.sprite("package", s.p.x + 2, s.p.y - 14);
    for (const b of s.bullets)
      this.rect(b.x - 1, b.y - 1, 3, 3, b.owner === "p" ? "yellow" : "pink");
    for (const t of s.toys) this.sprite("toy", t.x, t.y);
    if (s.smoke) {
      for (let i = 0; i < 7; i++)
        this.rect(
          s.smoke.x + ((i * 7) % 24),
          s.smoke.y - ((s.frame + i * 7) % 14),
          5,
          5,
          i % 2 ? "gray" : "cream",
        );
    }
    for (const b of s.bubbles) this.bubble(b.x + 8, b.y, b.text, cx, cy);
    for (const v of s.popups)
      this.txt(v.text, v.x, v.y - (60 - v.life) / 4, "yellow");
    this.c.restore();
    this.rect(0, 16, 256, 24, "black");
    this.center(st.name, 21, theme[0], 2);
    this.center(TEXT.searchHint, 34, "gray");
    this.rect(0, 216, 256, 24, "black");
    this.center(st.name, 219, theme[0]);
    if (s.search) {
      this.center(TEXT.searching, 228, "cream");
      this.rect(68, 235, 120, 2, "slate");
      this.rect(
        68,
        235,
        (120 * s.search.progress) / s.search.total,
        2,
        "yellow",
      );
    } else if (touchingFixture(s)) this.center(TEXT.search, 229, "yellow");
    else this.center(UI.storeControls, 229, "gray");
    if (s.cave && !s.cave.taken) {
      this.box(16, 172, 224, 35, "navy", "yellow");
      const lines = wrap(TEXT.cave.slice(0, Math.floor(s.cave.frame / 3)), 32);
      lines.forEach((line, i) => this.txt(line, 24, 180 + i * 8, "cream"));
      if (s.cave.frame >= 180) this.center(TEXT.pickUp, 200, "cyan");
    }
  }
  hud(s) {
    this.rect(0, 0, 256, 16, "black");
    this.rect(0, 15, 256, 1, "purple");
    this.txt(String(s.score).padStart(6, "0"), 3, 2, "cream");
    this.txt(`PKG ${s.packages}/6`, 34, 2, s.packages === 6 ? "green" : "red");
    this.sprite("heart", 70, 0);
    this.txt(String(s.lives), 80, 2, "cream");
    const p = s.p.power;
    const active = p.bomb
      ? "CINNABOMB"
      : p.weapon
        ? p.weapon === "rapid"
          ? "RAPID"
          : "SPREAD"
        : p.speed
          ? p.speed === "sneakers"
            ? "SNEAKERS"
            : "JULI-OOZE"
          : "";
    this.txt(active, 92, 2, p.bomb ? "yellow" : "cyan");
    const n = p.bomb || p.weaponTime || p.speedTime;
    if (n) {
      this.rect(92, 10, 61, 2, "slate");
      this.rect(
        92,
        10,
        61 *
          Math.min(
            1,
            n / (p.bomb ? 360 : p.speed === "juice" && !p.weapon ? 720 : 1200),
          ),
        2,
        "cyan",
      );
    }
    if (p.armor) this.txt("A", 160, 2, "orange");
    if (p.radar) this.txt("R", 166, 2, "cyan");
    if (s.alarm && s.frame % 30 < 20) this.txt("ALARM", 176, 3, "red");
    this.rect(207, 1, 48, 13, "slate");
    this.rect(208, 2, 46, 11, "navy");
    if (s.scene === "store") {
      const st = s.stores.find((x) => x.id === s.storeId),
        t = st.name + "   " + st.name;
      const i = Math.floor(s.frame / 12) % (st.name.length + 3);
      this.txt(t.slice(i, i + 10), 211, 5, "red");
    } else this.txt(FLOORS[s.p.floor] || "R", 226, 5, "red");
    this.txt(`LOOP ${s.loop}`, 3, 10, "slate");
    if (!active) this.txt(TEXT.footer, 34, 10, "slate");
  }
  banner(copy) {
    const lines = Array.isArray(copy) ? copy : wrap(copy, 40),
      h = lines.length * 8 + 8;
    this.box(10, 18, 236, h, "navy", "yellow");
    lines.forEach((line, i) => this.center(line, 23 + i * 8, "cream"));
  }
  map(s) {
    this.rect(0, 16, 256, 224, "navy");
    this.center(TEXT.directory, 23, "cyan", 2);
    this.center(UI.galleria, 38, "slate");
    for (let f = 0; f < 6; f++) {
      const y = 58 + f * 22;
      this.txt(FLOORS[f], 5, y - 2, "cream");
      this.rect(22, y + 10, 225, 1, "slate");
      for (const st of s.stores.filter((x) => x.floor === f)) {
        const x = 22 + (st.x / 768) * 224;
        const color =
          st.role === "closed"
            ? "slate"
            : st.cleared
              ? "gray"
              : st.role === "target"
                ? "red"
                : "blue";
        this.rect(x, y - 1, 22, 10, color);
        if (st.role === "closed") this.rect(x + 1, y, 20, 8, "navy");
        this.txt(st.name.slice(0, 5), x + 1, y + 1, "black");
        if (s.p.power.radar && st.role === "target" && !st.cleared)
          this.txt("!", x + 9, y - 8, "yellow");
        if (s.scene === "store" && s.storeId === st.id && s.frame % 40 < 24)
          this.rect(x - 1, y - 2, 24, 1, "white");
      }
    }
    for (const e of s.elevators) {
      const x = 22 + (e.x / 768) * 224;
      this.rect(x - 2, 56 + e.min * 22, 4, (e.max - e.min) * 22 + 15, "black");
      this.rect(x - 3, 58 + ((e.y - 64) / 48) * 22, 6, 8, "cyan");
      this.txt(e.id, x - 1, 47, "cyan");
    }
    for (const e of ESCALATORS) {
      const x = 22 + (e.x / 768) * 224;
      this.line(x - 6, 58 + e.top * 22, x, 58 + e.bottom * 22, "yellow");
    }
    this.sprite("wagon", 186, 162, { scale: 0.5 });
    if (s.scene !== "store" && s.frame % 40 < 24) {
      const x = 22 + (s.p.x / 768) * 224,
        y = 58 + ((s.p.y - 64) / 48) * 22;
      this.rect(x - 2, y, 5, 6, "yellow");
    }
    this.txt(UI.legend1, 8, 187, "cream");
    this.txt(UI.legend2, 8, 196, "gray");
    const inv = s.inventory.length ? s.inventory.join(" / ") : UI.noSouvenirs;
    wrap(inv, 58)
      .slice(0, 2)
      .forEach((l, i) => this.txt(l, 8, 207 + i * 7, "pink"));
    this.center(TEXT.mapHint, 230, "cyan");
  }
  kiosk(s) {
    const st = s.stores.find((x) => x.id === s.kioskTarget);
    if (!st) return;
    this.box(31, 145, 194, 70);
    this.center(TEXT.kiosk, 151, "cyan");
    this.center(st.name, 161, "yellow");
    for (let f = 0; f < 6; f++) {
      this.txt(FLOORS[f], 39, 174 + f * 6, "gray");
      this.rect(53, 177 + f * 6, 160, 1, "slate");
    }
    const x = 53 + ((st.x + 40) / 768) * 160;
    this.rect(x - 2, 173 + st.floor * 6, 5, 5, "red");
    this.txt("!", x + 6, 173 + st.floor * 6, "yellow");
  }
  photoStrip(s) {
    this.box(91, 56, 74, 137, "cream", "pink");
    this.txt(UI.spygram, 96, 61, "purple");
    for (let i = 0; i < 4; i++) {
      this.rect(96, 72 + i * 28, 64, 25, "blue");
      this.sprite("agent" + i, 120 + (i % 2 ? 8 : 0), 73 + i * 28);
    }
  }
  post(s, complete) {
    this.box(30, 30, 196, 190, "cream", "pink");
    this.rect(32, 32, 192, 18, "pink");
    this.txt(UI.spygram, 39, 37, "navy", 2);
    this.txt(UI.handle, 40, 57, "purple");
    this.rect(40, 68, 176, 80, "sky");
    for (let i = 0; i < 9; i++) {
      const h = 10 + ((i * 13) % 24);
      this.rect(40 + i * 20, 147 - h, 16, h, "blue");
      for (let yy = 151 - h; yy < 145; yy += 6)
        this.rect(43 + i * 20, yy, 3, 2, "yellow");
    }
    this.rect(40, 133, 176, 15, "slate");
    this.sprite("agent0", 112, 86, { scale: 2 });
    this.rect(144, 102, 8, 12, "navy");
    this.rect(145, 103, 6, 8, "cream");
    this.txt(complete ? UI.accomplished : UI.rooftop, 47, 137, "cream");
    s.post.lines.forEach((t, i) => this.txt(t, 43, 157 + i * 12, "navy", 2));
    this.txt(`${Math.min(9999, s.sceneFrame * 47)} LIKES`, 43, 185, "purple");
    this.txt(s.post.comment, 43, 196, "blue");
    this.txt(TEXT.next, 160, 208, "purple");
  }
  screen(s) {
    if (s.scene === "post") {
      this.post(s, true);
      return;
    }
    if (s.scene === "paper") {
      this.rect(12, 15, 232, 211, "cream");
      this.rect(19, 25, 218, 1, "brown");
      this.center(TEXT.paper, 32, "navy", 3);
      this.center(TEXT.edition, 53, "brown");
      this.rect(19, 63, 218, 2, "navy");
      s.headline.forEach((t, i) => this.center(t, 75 + i * 14, "navy", 2));
      this.rect(27, 126, 202, 59, "blue");
      this.sprite("wagon", 48, 147, { scale: 1.5 });
      this.sprite("spy0", 192, 155);
      for (let x = 28; x < 230; x += 106)
        for (let y = 193; y < 214; y += 5)
          this.rect(x, y, 92 - (y % 3) * 6, 1, "brown");
      this.center(TEXT.next, 232, "cream");
      return;
    }
    if (s.scene === "continue") {
      this.center(TEXT.continue, 53, "yellow", 3);
      const n = 9 - Math.floor(s.sceneFrame / 60);
      this.center(String(Math.max(0, n)), 93, n <= 3 ? "red" : "cream", 10);
      this.center(`${TEXT.continues} ${s.continues}`, 160, "cyan");
      this.center(UI.resume, 186);
      this.center(UI.kept, 201, "slate");
      return;
    }
    if (s.scene === "gameover") {
      const clone = {
        ...s,
        scene: "mall",
        p: { ...s.p, x: 128, y: 112, floor: 1 },
      };
      this.mall(clone);
      const h = Math.min(240, s.sceneFrame / 2);
      for (let y = 16; y < h; y += 5) {
        this.rect(0, y, 256, 4, "slate");
        this.rect(0, y + 4, 256, 1, "black");
      }
      this.rect(0, 65, 256, 105, "#080814dd");
      const full = TEXT.closed.join("|").slice(0, Math.floor(s.sceneFrame / 3));
      full
        .split("|")
        .forEach((l, i) => this.center(l, 78 + i * 12, "cream", 2));
      if (s.sceneFrame > 150) {
        this.center(TEXT.gameover, 118, "red", 3);
        this.center(`SCORE ${s.score}   HI ${s.high}`, 147, "yellow");
        this.center(TEXT.next, 205, "gray");
      }
      return;
    }
    this.rect(0, 0, 256, 240, "navy");
    for (const x of [16, 112, 218]) {
      this.rect(x, 25, 12, 102, "slate");
      this.rect(x, 88, 12, 7, "yellow");
      this.rect(x, 102, 12, 5, "black");
    }
    this.rect(0, 130, 256, 3, "gray");
    this.center(TEXT.clear, 19, "yellow", 2);
    const x = 56 + Math.max(0, s.sceneFrame - 90) * 0.85;
    this.sprite("wagon", x, 106);
    this.sprite(
      "spy" + (Math.floor(s.frame / 7) % 4),
      Math.min(x - 32, 220),
      105,
      { flip: false },
    );
    this.rect(Math.min(x - 19, 233), 98, 7, 12, "cream");
    this.txt("---", Math.min(x - 19, 233), 101, "brown");
    this.center(`PACKAGES 6 X 500 = ${s.clearBonus.packages}`, 151, "cream");
    this.center(`${TEXT.time} ${s.clearBonus.time}`, 168, "cyan");
    this.center(`${TEXT.bonus} 1000`, 183, "yellow");
    this.center(`${TEXT.loop} ${s.loop} COMPLETE`, 201, "pink");
    this.center(TEXT.next, 225, "gray");
  }
  gallery(s) {
    this.center(UI.atlas, 6, "cyan");
    const names = Object.keys(SPRITES).filter((n) => !/[1-3]$/.test(n)),
      page = Math.floor(s.frame / 360) % Math.ceil(names.length / 24);
    for (let i = 0; i < 24; i++) {
      let name = names[page * 24 + i];
      if (!name) continue;
      const x = 5 + (i % 6) * 42,
        y = 25 + Math.floor(i / 6) * 49;
      this.rect(x, y, 38, 36, "navy");
      if (name.endsWith("0"))
        name = name.slice(0, -1) + (Math.floor(s.frame / 10) % 4);
      this.sprite(name, x + 4, y + 4, {
        scale: SPRITES[name].w > 32 ? 0.5 : 1,
      });
      this.txt(name.replace(/\d$/, "").slice(0, 10), x, y + 38, "cream");
    }
    this.center(
      `PAGE ${page + 1} / ${Math.ceil(names.length / 24)} - ALL SOURCE ART`,
      228,
      "gray",
    );
  }
}
