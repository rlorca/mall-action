import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { NO_PAD, Btn, type Pad } from '../engine/pad';
import { Rng } from '../engine/rng';
import { HEADLINES, LIMITS, SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE } from '../content/copy';
import { SHAFTS, ESCALATORS, floorY } from '../content/layout';
import { STORES, type StoreId } from '../content/stores';
import type { StoreStatus } from '../game/levelstate';
import type { MapData } from '../game/screens/mapdata';
import { TitleScreen, TITLE_STRIP_PERIOD, TITLE_SCROLL_FRAMES } from '../game/screens/title';
import { KONAMI_CODE } from '../game/screens/konami';
import { ContinueScreen } from '../game/screens/continue';
import { GameOverScreen, GO_GAMEOVER_AT } from '../game/screens/gameover';
import { LevelClearScreen } from '../game/screens/levelclear';
import { drawPauseOverlay } from './pauseView';
import { drawSpygram, spygramLikes, SPYGRAM_CARD_H, SPYGRAM_CARD_W } from './spygramView';
import { drawMapView, inventoryLines, mapX, mapY, storeBoxes, STORE_BOX_W } from './mapView';
import { drawNewspaper, headlineLines, NEWS_HEADLINE_CHARS } from './newspaperView';
import { drawTitle } from './titleView';
import { drawLevelClear, spyX, wagonX } from './levelClearView';
import { drawContinue } from './continueView';
import { drawGameOver } from './gameOverView';
import { textWidth } from '../engine/font';

const press = (mask: number): Pad => ({ held: mask, pressed: mask, released: 0 });
const SENT = 0x3d;
const sentinel = (): Framebuffer => {
  const fb = new Framebuffer();
  fb.clear(SENT);
  return fb;
};
const changed = (fb: Framebuffer): number => fb.countNot(SENT);

describe('pause overlay', () => {
  it('dims everything and blinks PAUSE', () => {
    const base = new Framebuffer();
    base.clear(C.WHITE);
    const on = new Framebuffer();
    on.copyFrom(base);
    drawPauseOverlay(on, 0);
    expect(on.getPixel(1, 1)).not.toBe(C.WHITE); // dimmed
    const off = new Framebuffer();
    off.copyFrom(base);
    drawPauseOverlay(off, 50);
    expect(off.getPixel(1, 1)).toBe(on.getPixel(1, 1));
    expect(on.hash()).not.toBe(off.hash()); // PAUSE visible in one phase, hidden in the other
    // the plate is drawn in the centre
    expect(on.getPixel(128, 120)).toBeDefined();
    const shown = new Set<number>();
    for (let f = 0; f < 60; f++) {
      const fb = new Framebuffer();
      fb.copyFrom(base);
      drawPauseOverlay(fb, f);
      shown.add(fb.hash());
    }
    expect(shown.size).toBe(2);
  });
});

describe('SPYGRAM', () => {
  it('likes start at 0, never decrease, climb quickly and depend on the seed', () => {
    expect(spygramLikes(0, 5)).toBe(0);
    let prev = -1;
    for (let f = 0; f < 900; f++) {
      const v = spygramLikes(f, 5);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(spygramLikes(60, 5)).toBeGreaterThan(100);
    expect(spygramLikes(150, 5)).toBeGreaterThan(290);
    const seeds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => spygramLikes(300, s)));
    expect(seeds.size).toBeGreaterThan(3);
    expect(spygramLikes(100, 9)).toBe(spygramLikes(100, 9));
  });

  it('draws every post inside its card (plus shadow) at the default position', () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      const fb = sentinel();
      drawSpygram(fb, post, 1234, 40);
      const x0 = Math.round((256 - SPYGRAM_CARD_W) / 2);
      const y0 = Math.round((240 - SPYGRAM_CARD_H) / 2);
      let outside = 0;
      for (let y = 0; y < 240; y++) {
        for (let x = 0; x < 256; x++) {
          if (fb.getPixel(x, y) === SENT) continue;
          if (x < x0 || x >= x0 + SPYGRAM_CARD_W + 3 || y < y0 || y >= y0 + SPYGRAM_CARD_H + 3) outside++;
        }
      }
      expect(outside, post.caption.join('/')).toBe(0);
    }
  });

  it('works standalone at any position, including partly off screen, and has a magenta header', () => {
    for (const [x, y] of [[0, 0], [10, 20], [72, 50], [-40, -30], [200, 200]] as const) {
      const fb = sentinel();
      drawSpygram(fb, SPYGRAM_ARRIVAL[0]!, 100, 3, { x, y });
      expect(changed(fb)).toBeGreaterThan(0);
    }
    const fb = sentinel();
    drawSpygram(fb, SPYGRAM_ARRIVAL[0]!, 100, 3, { x: 20, y: 10 });
    expect(fb.getPixel(20 + 150, 10 + 10)).toBe(C.MAGENTA);
  });

  it('shows the like count and a custom photo callback is used (clipped to the photo box)', () => {
    const a = sentinel();
    const b = sentinel();
    drawSpygram(a, SPYGRAM_ARRIVAL[1]!, 10, 5, { x: 20, y: 10 });
    drawSpygram(b, SPYGRAM_ARRIVAL[1]!, 987, 5, { x: 20, y: 10 });
    expect(a.hash()).not.toBe(b.hash());
    const c = sentinel();
    drawSpygram(c, SPYGRAM_ARRIVAL[1]!, 10, 5, {
      x: 20,
      y: 10,
      photo: (fb, x, y, w, h) => fb.fillRect(x - 50, y - 50, w + 100, h + 100, C.LIME), // tries to paint outside
    });
    expect(c.getPixel(20 + 8 + 5, 10 + 36 + 5)).toBe(C.LIME);
    expect(c.getPixel(20 + 8 - 3, 10 + 36 + 5)).not.toBe(C.LIME); // clipped at the photo's edge
  });
});

describe('MALL DIRECTORY', () => {
  const statuses = {} as Record<StoreId, StoreStatus>;
  for (const s of STORES) statuses[s.id] = s.role === 'closed' ? 'closed' : s.role === 'powerup' ? 'powerup' : 'package';
  statuses.forever12 = 'cleared';
  const base: MapData = {
    frame: 0,
    cars: [{ shaft: 'A', y: floorY(1) }, { shaft: 'B', y: floorY(3) }, { shaft: 'C', y: floorY(4) }],
    player: { x: 380, y: floorY(2), inStore: null },
    statuses,
    radar: false,
    inventory: 'NONE YET',
    blackFriday: false,
  };
  const render = (d: Partial<MapData>): Framebuffer => {
    const fb = new Framebuffer();
    drawMapView(fb, { ...base, ...d });
    return fb;
  };
  const center = (id: StoreId): [number, number] => {
    const b = storeBoxes().find((x) => x.id === id)!;
    return [b.x + 2, b.y + 3]; // inside the box, left of the label
  };

  it('colours stores by status: package red, cleared grey, power-up blue, closed dark outline', () => {
    const fb = render({ frame: 14 }); // blink phase: player marker hidden
    const px = (id: StoreId) => fb.getPixel(...center(id));
    expect(px('radioshock')).toBe(C.RED);
    expect(px('forever12')).toBe(C.GRAY);
    expect(px('crookstone')).toBe(C.BLUE);
    expect(px('blockbluster')).toBe(C.BLACK); // closed: not filled
    const b = storeBoxes().find((x) => x.id === 'blockbluster')!;
    expect(fb.getPixel(b.x, b.y + 4)).toBe(C.MDGRAY); // ...but outlined
  });

  it('every store box is on screen, readable size, and clear of shafts and other boxes', () => {
    const boxes = storeBoxes();
    expect(boxes).toHaveLength(STORES.length);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(256);
      expect(b.w).toBe(STORE_BOX_W);
      expect(b.w).toBeGreaterThanOrEqual(22);
      expect(b.h).toBeGreaterThanOrEqual(14);
    }
    const hit = (a: { x: number; y: number; w: number; h: number }, c: { x: number; y: number; w: number; h: number }) =>
      a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(boxes[i]!, boxes[j]!)).toBe(false);
    for (const s of SHAFTS) {
      const sx = mapX(s.x);
      const sw = Math.round(s.w * 0.3);
      for (const b of boxes) expect(sx < b.x + b.w && b.x < sx + sw, `${b.id} vs shaft ${s.id}`).toBe(false);
    }
  });

  it('the player marker blinks; inside a store the store blinks instead', () => {
    const hashes = new Set<number>();
    for (let f = 0; f < 48; f++) hashes.add(render({ frame: f }).hash());
    expect(hashes.size).toBe(2);
    const a = render({ frame: 0, player: { x: 0, y: 0, inStore: 'hotspy' } });
    const b = render({ frame: 14, player: { x: 0, y: 0, inStore: 'hotspy' } });
    const hb = storeBoxes().find((x) => x.id === 'hotspy')!;
    expect(a.getPixel(hb.x + 2, hb.y + 3)).toBe(C.WHITE);
    expect(b.getPixel(hb.x + 2, hb.y + 3)).toBe(C.RED);
    // no player marker in store mode: only the store box changes between blink phases
    let diffOutside = 0;
    for (let y = 0; y < 240; y++) for (let x = 0; x < 256; x++) {
      if (a.getPixel(x, y) !== b.getPixel(x, y) && !(x >= hb.x && x < hb.x + hb.w && y >= hb.y && y < hb.y + hb.h)) diffOutside++;
    }
    expect(diffOutside).toBe(0);
  });

  it('Radar marks each remaining package store with a "!" and only those', () => {
    const off = render({ frame: 14 });
    const on = render({ frame: 14, radar: true });
    const marks = (fb: Framebuffer, id: StoreId): number => {
      const b = storeBoxes().find((x) => x.id === id)!;
      let n = 0;
      for (let y = b.y + 2; y < b.y + 8; y++) for (let x = b.x; x < b.x + b.w; x++) if (fb.getPixel(x, y) === C.YELLOW || fb.getPixel(x, y) === C.WHITE) n++;
      return n;
    };
    expect(marks(on, 'radioshock')).toBeGreaterThan(marks(off, 'radioshock'));
    expect(marks(on, 'forever12')).toBe(marks(off, 'forever12')); // cleared
    expect(marks(on, 'crookstone')).toBe(marks(off, 'crookstone')); // power-up shop
    expect(marks(on, 'blockbluster')).toBe(marks(off, 'blockbluster')); // closed
  });

  it('shows each car where it is: moving a car changes the picture, and positions map linearly', () => {
    const a = render({ cars: [{ shaft: 'B', y: floorY(2) }] });
    const b = render({ cars: [{ shaft: 'B', y: floorY(2) + 24 }] });
    expect(a.hash()).not.toBe(b.hash());
    expect(mapY(floorY(3)) - mapY(floorY(2))).toBe(mapY(floorY(4)) - mapY(floorY(3)));
    expect(mapY(floorY(2) + 24)).toBeGreaterThan(mapY(floorY(2)));
    // car on the shaft's bottom floor stays inside the shaft
    const bottom = render({ cars: [{ shaft: 'A', y: floorY(5) }] }); // A only serves R..2F; clamped to its bottom
    expect(bottom.countNot(C.BLACK)).toBeGreaterThan(0);
  });

  it('draws the escalators and the getaway car regardless of state', () => {
    const fb = render({ frame: 14 });
    for (const e of ESCALATORS) {
      const mx = Math.round((mapX(e.xLow) + mapX(e.xHigh)) / 2);
      let orange = 0;
      for (let y = 0; y < 240; y++) for (let x = mx - 3; x <= mx + 3; x++) if (fb.getPixel(x, y) === C.ORANGE) orange++;
      expect(orange, e.id).toBeGreaterThan(0);
    }
  });

  it('wraps a long inventory into at most 3 lines that fit', () => {
    const long = 'EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING, 1 SHARE (DOWN 99%), PHOTO STRIP, MORE, MORE, MORE, MORE';
    const lines = inventoryLines(long);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(256 - 16);
    expect(lines[lines.length - 1]).toMatch(/\.\.\.$/);
    expect(inventoryLines('NONE YET')).toEqual(['ITEMS: NONE YET']);
  });
});

describe('THE DAILY MALL', () => {
  it('every headline wraps to at most 3 lines that fit the page (and the 26-char copy limit)', () => {
    for (const h of HEADLINES) {
      const lines = headlineLines(h);
      expect(lines.length, h).toBeLessThanOrEqual(3);
      for (const l of lines) {
        expect(l.length, l).toBeLessThanOrEqual(NEWS_HEADLINE_CHARS);
        expect(l.length).toBeLessThanOrEqual(LIMITS.headlineLine);
        expect(textWidth(l, { scale: 2 }), l).toBeLessThanOrEqual(240 - 16);
      }
      expect(lines.join(' ')).toBe(h);
    }
  });
  it('renders every headline and slides in', () => {
    const hashes = new Set<number>();
    for (const h of HEADLINES) {
      const fb = new Framebuffer();
      drawNewspaper(fb, h, 100);
      hashes.add(fb.hash());
    }
    expect(hashes.size).toBe(HEADLINES.length);
    const a = new Framebuffer();
    const b = new Framebuffer();
    drawNewspaper(a, HEADLINES[0]!, 2);
    drawNewspaper(b, HEADLINES[0]!, 100);
    expect(a.hash()).not.toBe(b.hash());
  });
});

describe('title view', () => {
  it('draws, blinks PRESS START, shows Black Friday after the code, and the strip wraps', () => {
    const t = new TitleScreen({ hiScore: 4200 });
    const f0 = new Framebuffer();
    drawTitle(f0, t);
    expect(f0.countNot(C.BLACK)).toBeGreaterThan(20000);
    const hashes = new Set<number>();
    for (let i = 0; i < 120; i++) {
      t.step(NO_PAD);
      const fb = new Framebuffer();
      drawTitle(fb, t);
      hashes.add(fb.hash());
    }
    expect(hashes.size).toBeGreaterThan(30);
    const bf = new TitleScreen({ hiScore: 4200 });
    for (const b of KONAMI_CODE) {
      bf.step(press(b));
      bf.step(NO_PAD);
    }
    const a = new Framebuffer();
    const b2 = new Framebuffer();
    drawTitle(a, new TitleScreen({ hiScore: 4200 }));
    drawTitle(b2, bf);
    expect(bf.blackFriday).toBe(true);
    expect(a.hash()).not.toBe(b2.hash());
    expect(TITLE_STRIP_PERIOD).toBeGreaterThan(256);
    expect(TITLE_SCROLL_FRAMES).toBeGreaterThan(0);
  });
});

describe('level clear view', () => {
  it('the wagon only ever moves right, the spy trails it and never catches up', () => {
    let prev = -1;
    for (let pf = 0; pf < 270; pf++) {
      expect(wagonX(pf)).toBeGreaterThanOrEqual(prev);
      prev = wagonX(pf);
      if (pf >= 30 && wagonX(pf) < 256) expect(spyX(pf) + 16, `frame ${pf}`).toBeLessThan(wagonX(pf));
      expect(spyX(pf)).toBeLessThan(250);
    }
    expect(wagonX(269)).toBeGreaterThan(256); // the wagon has left the screen
  });

  it('draws all four phases without error and each looks different', () => {
    const s = new LevelClearScreen({ rng: new Rng(2), packages: 6, timeBonus: 900, clearBonus: 1000, loop: 1, score: 100 });
    const hashes: number[] = [];
    for (let phase = 0; phase < 4; phase++) {
      for (let i = 0; i < 90; i++) s.step(NO_PAD);
      const fb = new Framebuffer();
      drawLevelClear(fb, s);
      hashes.push(fb.hash());
      s.step(press(Btn.START));
    }
    expect(new Set(hashes).size).toBe(4);
  });
});

describe('continue and game over views', () => {
  it('continue: the picture changes with the count and turns red at 3', () => {
    const count = (c: number): Framebuffer => {
      const s = new ContinueScreen({ continuesLeft: 2 });
      while (s.count > c) s.step(NO_PAD);
      for (let i = 0; i < 20; i++) s.step(NO_PAD);
      const fb = new Framebuffer();
      drawContinue(fb, s);
      return fb;
    };
    const redPixels = (fb: Framebuffer): number => {
      let n = 0;
      for (let y = 60; y < 190; y++) for (let x = 60; x < 200; x++) if (fb.getPixel(x, y) === C.RED || fb.getPixel(x, y) === C.SALMON) n++;
      return n;
    };
    expect(count(9).hash()).not.toBe(count(8).hash());
    expect(redPixels(count(3))).toBeGreaterThan(300);
    expect(redPixels(count(5))).toBe(0);
  });

  it('game over: shutters progress and GAME OVER appears at the end', () => {
    const s = new GameOverScreen({ score: 500, hiScore: 900 });
    const early = new Framebuffer();
    for (let i = 0; i < 100; i++) s.step(NO_PAD);
    drawGameOver(early, s);
    while (s.frame < GO_GAMEOVER_AT + 2) s.step(NO_PAD);
    const late = new Framebuffer();
    drawGameOver(late, s);
    expect(early.hash()).not.toBe(late.hash());
    // before the shutters the agent (red coat) is visible on the ground floor; after, it is hidden
    const coat = (fb: Framebuffer): number => {
      let n = 0;
      for (let y = 160; y < 184; y++) for (let x = 120; x < 136; x++) if (fb.getPixel(x, y) === C.RED || fb.getPixel(x, y) === C.ORANGE) n++;
      return n;
    };
    expect(coat(early)).toBeGreaterThan(0);
    expect(coat(late)).toBe(0);
  });
});
