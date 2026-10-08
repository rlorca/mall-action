import { describe, expect, it } from 'vitest';
import {
  EASTER_EGG,
  ELEVATOR_EXIT_LINES,
  FIRST_VISIT,
  FLOOR_BANNERS,
  HEADLINES,
  LAST_WORDS,
  LIMITS,
  PA_LINES,
  SHOUTS,
  SPYGRAM_ARRIVAL,
  SPYGRAM_COMPLETE,
  UI,
  packageBanner,
  packagesLeft,
  continuesLeft,
  youGot,
  wrapWords,
} from './copy';
import { FONT_MAIN, fontSupports } from '../engine/font';
import { CLOSED_STORES, OPEN_STORES, PACKAGES_TOTAL, POWERUP_STORES, STORES, STORE_IDS, TARGET_STORES } from './stores';
import { ESCALATORS, FEATURES, FLOOR_NAMES, LAMPS, LAMP_HALF_W, LEVEL_W, NUM_FLOORS, SHAFTS, STORE_W, floorY, reachableFloors, storesOnFloor } from './layout';
import { THEMES } from './themes';
import { LOOP_MUSIC_IDS, STORE_SONG_IDS } from '../audio/ids';
import { FONT_TINY, textWidth } from '../engine/font';

describe('copy fits on screen', () => {
  const all: string[] = [];
  it('SPYGRAM: 10+10 posts, captions <= 2 lines of <= 21 chars, comments <= 21 chars', () => {
    expect(SPYGRAM_ARRIVAL.length).toBe(10);
    expect(SPYGRAM_COMPLETE.length).toBe(10);
    for (const p of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(p.caption.length).toBeGreaterThanOrEqual(1);
      expect(p.caption.length).toBeLessThanOrEqual(LIMITS.captionLines);
      for (const l of p.caption) {
        expect(l.length, l).toBeLessThanOrEqual(LIMITS.captionLine);
        all.push(l);
      }
      expect(p.comment.length, p.comment).toBeLessThanOrEqual(LIMITS.comment);
      all.push(p.comment);
    }
  });
  it('speech bubbles <= 28 chars', () => {
    const bubbles: string[] = [
      ...LAST_WORDS,
      ...ELEVATOR_EXIT_LINES,
      SHOUTS.walker,
      SHOUTS.cop,
      SHOUTS.fitting,
      SHOUTS.detained,
      EASTER_EGG.clerk.slice(0, 28),
    ];
    for (const lines of Object.values(FIRST_VISIT)) for (const l of lines!) bubbles.push(l.text);
    expect(LAST_WORDS.length).toBe(8);
    expect(ELEVATOR_EXIT_LINES.length).toBe(4);
    for (const b of bubbles) {
      expect(b.length, b).toBeLessThanOrEqual(LIMITS.bubble);
      all.push(b);
    }
  });
  it('first-visit lines exist for the 9 stores that have them', () => {
    expect(Object.keys(FIRST_VISIT).sort()).toEqual(
      ['crookstone', 'footlock', 'forever12', 'hotspy', 'kgbtoys', 'radioshock', 'sambaddy', 'sharper', 'spenders'].sort(),
    );
  });
  it('headlines wrap into lines of <= 26 chars', () => {
    expect(HEADLINES.length).toBe(5);
    for (const h of HEADLINES) {
      const lines = wrapWords(h, LIMITS.headlineLine);
      for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(LIMITS.headlineLine);
      expect(lines.join(' ')).toBe(h);
      expect(lines.length).toBeLessThanOrEqual(4);
      all.push(h);
    }
  });
  it('PA lines wrap to <= 28 chars and there are 7', () => {
    expect(PA_LINES.length).toBe(7);
    for (const p of PA_LINES) {
      for (const l of wrapWords(p, LIMITS.paLine)) expect(l.length).toBeLessThanOrEqual(LIMITS.paLine);
      all.push(p);
    }
  });
  it('banners fit in one line', () => {
    const banners = [...FLOOR_BANNERS, ...EASTER_EGG.items.map(youGot), packageBanner(6), packagesLeft(6), continuesLeft(3), UI.alarmBanner, UI.nowPlaying, UI.trap, UI.nothing];
    for (const b of banners) {
      expect(b.length, b).toBeLessThanOrEqual(LIMITS.banner);
      all.push(b);
    }
    expect(FLOOR_BANNERS.length).toBe(NUM_FLOORS);
    expect(FLOOR_BANNERS[1]).toBe('4F - FASHION & GADGETS, SPIES');
  });
  it('every UI string is drawable with the main font', () => {
    for (const v of Object.values(UI)) all.push(v);
    for (const s of all) expect(fontSupports(FONT_MAIN, s), s).toBe(true);
  });
  it('store signs fit the tiny font on an 80 px sign', () => {
    for (const s of STORES) {
      expect(fontSupports(FONT_TINY, s.name), s.name).toBe(true);
      expect(textWidth(s.name, { font: FONT_TINY }), s.name).toBeLessThanOrEqual(STORE_W - 4);
    }
  });
});

describe('store table', () => {
  it('has 13 storefronts: 6 targets, 4 power-up shops, 3 closed', () => {
    expect(STORES.length).toBe(13);
    expect(new Set(STORE_IDS).size).toBe(13);
    expect(TARGET_STORES.length).toBe(PACKAGES_TOTAL);
    expect(POWERUP_STORES.length).toBe(4);
    expect(CLOSED_STORES.length).toBe(3);
    expect(OPEN_STORES.length).toBe(10);
  });
  it('matches the brief floors (4F:4, 3F:3, 2F:4, 1F:2)', () => {
    expect(storesOnFloor(1).length).toBe(4);
    expect(storesOnFloor(2).length).toBe(3);
    expect(storesOnFloor(3).length).toBe(4);
    expect(storesOnFloor(4).length).toBe(2);
  });
  it('9 themes, gadgets used by exactly two shops, closed stores have no theme/song', () => {
    expect(THEMES.length).toBe(9);
    const used = STORES.map((s) => s.theme).filter(Boolean);
    expect(new Set(used).size).toBe(9);
    expect(STORES.filter((s) => s.theme === 'gadgets').length).toBe(2);
    for (const s of CLOSED_STORES) {
      expect(s.theme).toBeNull();
      expect(s.song).toBeNull();
    }
  });
  it('every open store has its own distinct song id that exists', () => {
    const songs = OPEN_STORES.map((s) => s.song!);
    expect(new Set(songs).size).toBe(10);
    for (const s of songs) expect((STORE_SONG_IDS as readonly string[]).includes(s)).toBe(true);
    expect((LOOP_MUSIC_IDS as readonly string[]).includes('mall')).toBe(true);
  });
});

describe('mall layout', () => {
  it('floors are 48 px apart and named R,4F,3F,2F,1F,P', () => {
    expect(FLOOR_NAMES).toEqual(['R', '4F', '3F', '2F', '1F', 'P']);
    for (let f = 1; f < NUM_FLOORS; f++) expect(floorY(f) - floorY(f - 1)).toBe(48);
  });
  it('shaft A serves R-2F, B serves 4F-P, C serves R-1F; A,B manual, C automatic', () => {
    const [a, b, c] = SHAFTS;
    expect([a!.top, a!.bottom, a!.manual]).toEqual([0, 3, true]);
    expect([b!.top, b!.bottom, b!.manual]).toEqual([1, 5, true]);
    expect([c!.top, c!.bottom, c!.manual]).toEqual([0, 4, false]);
  });
  it('escalators connect 3F<->4F and 1F<->2F', () => {
    expect(ESCALATORS.map((e) => [e.upper, e.lower])).toEqual([[1, 2], [3, 4]]);
  });
  it('every floor can be reached from the roof (and P only via B)', () => {
    expect([...reachableFloors(0)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    // P is served only by shaft B.
    expect(SHAFTS.filter((s) => s.bottom >= 5).map((s) => s.id)).toEqual(['B']);
  });
  it('storefronts, shafts and escalator landings never overlap on a floor and stay inside the mall', () => {
    for (let f = 1; f <= 4; f++) {
      const boxes: Array<[string, number, number]> = [];
      for (const s of storesOnFloor(f)) boxes.push([s.id, s.x, s.x + STORE_W]);
      for (const sh of SHAFTS) if (f >= sh.top && f <= sh.bottom) boxes.push([`shaft${sh.id}`, sh.x, sh.x + sh.w]);
      for (const e of ESCALATORS) if (f === e.upper || f === e.lower) boxes.push([e.id, Math.min(e.xLow, e.xHigh), Math.max(e.xLow, e.xHigh)]);
      for (const [n, l, r] of boxes) {
        expect(l, n).toBeGreaterThanOrEqual(8);
        expect(r, n).toBeLessThanOrEqual(LEVEL_W - 8);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [na, la, ra] = boxes[i]!;
          const [nb, lb, rb] = boxes[j]!;
          expect(ra <= lb || rb <= la, `floor ${f}: ${na} overlaps ${nb}`).toBe(true);
        }
    }
  });
  it('lamps never hang in front of store signs, shafts or escalators', () => {
    for (const [fs, xs] of Object.entries(LAMPS)) {
      const f = Number(fs);
      for (const x of xs) {
        for (const s of storesOnFloor(f)) {
          const hit = x + LAMP_HALF_W > s.x && x - LAMP_HALF_W < s.x + STORE_W;
          expect(hit, `lamp ${x} on floor ${f} overlaps ${s.id}`).toBe(false);
        }
        for (const sh of SHAFTS) if (f >= sh.top && f <= sh.bottom) expect(x + LAMP_HALF_W <= sh.x || x - LAMP_HALF_W >= sh.x + sh.w, `lamp ${x}/${f} vs shaft ${sh.id}`).toBe(true);
        for (const e of ESCALATORS) if (f === e.upper || f === e.lower) {
          const l = Math.min(e.xLow, e.xHigh);
          const r = Math.max(e.xLow, e.xHigh);
          expect(x + LAMP_HALF_W <= l || x - LAMP_HALF_W >= r, `lamp ${x}/${f} vs ${e.id}`).toBe(true);
        }
      }
    }
  });
  it('features sit on real floors inside the mall', () => {
    for (const ft of FEATURES) {
      expect(ft.floor).toBeGreaterThanOrEqual(0);
      expect(ft.floor).toBeLessThan(NUM_FLOORS);
      expect(ft.x).toBeGreaterThanOrEqual(0);
      expect(ft.x + ft.w).toBeLessThanOrEqual(LEVEL_W);
    }
    // a directory kiosk on each shopping floor; a photo booth on 3F; fountains on 3F and 1F
    for (const f of [1, 2, 3, 4]) expect(FEATURES.some((x) => x.kind === 'kiosk' && x.floor === f)).toBe(true);
    expect(FEATURES.some((x) => x.kind === 'booth' && x.floor === 2)).toBe(true);
    expect(FEATURES.filter((x) => x.kind === 'fountain').map((x) => x.floor).sort()).toEqual([2, 4]);
    expect(FEATURES.some((x) => x.kind === 'wagon' && x.floor === 5)).toBe(true);
    expect(LEVEL_W).toBe(768);
  });
});
