import { describe, expect, it } from 'vitest';
import '../art/index';
import { hasSprite } from '../art/registry';
import { REQUIRED_SPRITES } from '../art/manifest';
import { Framebuffer } from '../engine/framebuffer';
import { C } from '../engine/palette';
import { OPEN_STORES } from '../content/stores';
import { UI } from '../content/copy';
import { emptyRoom, makeWorld } from '../game/store/testutil';
import { STRIP_TOP, drawStoreView } from './storeView';

/** The store sprites are drawn by another module; skip the pixel checks while they are missing. */
const ready = (prefixes: string[]): boolean => REQUIRED_SPRITES.filter((r) => prefixes.some((p) => r.name.startsWith(p))).every((r) => hasSprite(r.name));
const haveStoreArt = ready(['st.', 'td.']);
const haveFx = ready(['fx.', 'item.', 'bullet.']);
const maybe = haveStoreArt ? describe : describe.skip;

/** A palette index no art uses (renders as black but is not C.BLACK), so untouched pixels are detectable. */
const SENTINEL = 0x0d;

function render(m: ReturnType<typeof makeWorld>, frame = 0): Framebuffer {
  const fb = new Framebuffer();
  fb.clear(SENTINEL);
  drawStoreView(fb, m.world, frame);
  return fb;
}

maybe('drawStoreView', () => {
  it('draws every store room: the room area is filled, the HUD strip above it is never touched', () => {
    for (const def of OPEN_STORES) {
      const m = makeWorld(def.id, { guards: true, seen: false });
      m.pilot.idle(30);
      const fb = render(m, 30);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 256; x++) expect(fb.getPixel(x, y), `${def.id} ${x},${y}`).toBe(SENTINEL);
      let sentinels = 0;
      for (let y = 16; y < 240; y++) for (let x = 0; x < 256; x++) if (fb.getPixel(x, y) === SENTINEL) sentinels++;
      expect(sentinels, def.id).toBe(0);
    }
  });

  it('is a pure read: drawing does not change the world', () => {
    const m = makeWorld('footlock', { guards: true });
    m.pilot.idle(20);
    const snap = JSON.stringify({ a: m.world.agent, g: m.world.guards, b: m.world.bullets, f: m.world.frame });
    render(m, 20);
    render(m, 21);
    expect(JSON.stringify({ a: m.world.agent, g: m.world.guards, b: m.world.bullets, f: m.world.frame })).toBe(snap);
  });

  it('is deterministic: the same state and frame draw the same pixels', () => {
    const a = makeWorld('hotspy', { seed: 4, guards: true });
    const b = makeWorld('hotspy', { seed: 4, guards: true });
    a.pilot.idle(40);
    b.pilot.idle(40);
    expect(render(a, 40).hash()).toBe(render(b, 40).hash());
  });

  it('the bottom strip shows the store name, the search prompt and the progress bar', () => {
    const m = makeWorld('crookstone');
    m.world.teleportAgent(7, 8);
    const idle = render(m, 5);
    const stripPixels = (fb: Framebuffer): number => {
      let n = 0;
      for (let y = STRIP_TOP + 2; y < 240; y++) for (let x = 0; x < 256; x++) if (fb.getPixel(x, y) !== C.BLACK) n++;
      return n;
    };
    const nameOnly = stripPixels(idle);
    expect(nameOnly).toBeGreaterThan(100);
    m.world.teleportAgent(3, 2);
    m.pilot.idle(2);
    expect(m.world.canSearch).toBe(true);
    const prompt = render(m, 5);
    expect(stripPixels(prompt)).toBeGreaterThan(nameOnly + 50);
    m.pilot.tap('B');
    m.pilot.idle(20);
    const limePixels = (fb: Framebuffer): number => {
      let n = 0;
      for (let y = STRIP_TOP + 2; y < 240; y++) for (let x = 0; x < 256; x++) if (fb.getPixel(x, y) === C.LIME) n++;
      return n;
    };
    const early = limePixels(render(m, 5));
    m.pilot.idle(15);
    const later = limePixels(render(m, 5));
    expect(later).toBeGreaterThan(early);
    expect(UI.searching.length * 6).toBeLessThan(256);
  });

  it('the longest store names fit the strip at their size (nothing leaks outside x = 0..255)', () => {
    for (const def of OPEN_STORES) expect(def.name.length * 6 - 1).toBeLessThanOrEqual(256 - 16);
  });

  it('rooms of any size render: small rooms are centred on black, big rooms scroll', () => {
    const small = makeWorld('crookstone', { room: emptyRoom(10, 7) });
    const fbS = render(small);
    expect(fbS.getPixel(2, 20)).toBe(C.BLACK);
    const big = makeWorld('crookstone', { room: emptyRoom(40, 24) });
    big.pilot.hold(200, 'LEFT');
    const fbB = render(big);
    let sentinels = 0;
    for (let y = 16; y < 240; y++) for (let x = 0; x < 256; x++) if (fbB.getPixel(x, y) === SENTINEL) sentinels++;
    expect(sentinels).toBe(0);
  });

  it('speech bubbles, banners and the typewriter box stay on screen', () => {
    const m = makeWorld('gamestonk', { egg: true, seen: false, guards: true });
    for (let i = 0; i < 90; i++) {
      m.pilot.step();
      const fb = render(m, i);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 256; x++) expect(fb.getPixel(x, y)).toBe(SENTINEL);
    }
    expect(m.world.typewriter).not.toBeNull();
    const k = makeWorld('kgbtoys', { seen: false, guards: true });
    k.pilot.idle(80);
    expect(k.world.bubbles.length).toBeGreaterThan(0);
    const fb = render(k, 80);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 256; x++) expect(fb.getPixel(x, y)).toBe(SENTINEL);
  });
});

(haveStoreArt && haveFx ? describe : describe.skip)('drawStoreView with effects and held items', () => {
  it('draws puffs, bullets, held items and radar marks without throwing', () => {
    const m = makeWorld('radioshock', { guards: true });
    m.run.givePower('radar');
    m.world.teleportAgent(2, 2);
    m.world.store.fixtures[0]!.content = { kind: 'package' };
    m.pilot.tap('B');
    for (let i = 0; i < 60; i++) {
      m.pilot.step();
      render(m, i);
    }
    m.pilot.step('A');
    render(m, 61);
    expect(m.world.agent.hold?.kind).toBe('package');
  });
});
