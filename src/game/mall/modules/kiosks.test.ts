import { describe, expect, it } from 'vitest';
import { Btn } from '../../../engine/pad';
import { FEATURES } from '../../../content/layout';
import { place } from '../testutil';
import { KIOSK_COOLDOWN, PANEL_FRAMES, nearestPackageStore } from './kiosks';
import { calmJanitor, makeXRig, parkCop, parkWalkers, type XRig } from './testrig';

const kioskFeature = (floor: number) => FEATURES.find((f) => f.kind === 'kiosk' && f.floor === floor)!;

function rig(floor = 2): XRig {
  const r = makeXRig({ floor, x: 100 });
  calmJanitor(r);
  parkCop(r, floor === 1 ? 4 : 1, 60);
  parkWalkers(r, 300, 500);
  const k = kioskFeature(floor);
  place(r, floor, k.x + 12);
  return r;
}

describe('directory kiosks', () => {
  it('there is one on each shopping floor', () => {
    const r = makeXRig();
    expect(r.x.kiosks.kiosks.map((k) => k.floor).sort()).toEqual([1, 2, 3, 4]);
  });

  it('Up at a kiosk shows a map panel for about 4 s highlighting the nearest remaining package store', () => {
    const r = rig(2); // 3F, x = 650: its own floor has KGB Toys
    r.tap(Btn.UP);
    const panel = r.x.kiosks.panel!;
    expect(panel).not.toBeNull();
    expect(panel.target).toBe('kgbtoys');
    expect(panel.total).toBe(PANEL_FRAMES);
    expect(PANEL_FRAMES).toBe(240);
    expect(r.x.kiosks.screenOn(r.x.kiosks.kiosks.findIndex((k) => k.floor === 2))).toBe(true);
    r.hold(0, PANEL_FRAMES - 5);
    expect(r.x.kiosks.panel).not.toBeNull();
    r.hold(0, 10);
    expect(r.x.kiosks.panel).toBeNull();
  });

  it('"nearest" is by floors away first, then by distance along the floor; cleared stores are skipped', () => {
    const r = rig(2);
    const w = r.w;
    const cx = kioskFeature(2).x + 12;
    expect(nearestPackageStore(w, 2, cx)).toBe('kgbtoys');
    w.run.level.stores.kgbtoys!.packageTaken = true;
    // one floor up (4F: forever12, radioshock) or down (2F: sambaddy, hotspy): hot spy's door is the closest in x
    expect(nearestPackageStore(w, 2, cx)).toBe('hotspy');
    w.run.level.stores.hotspy!.packageTaken = true;
    expect(nearestPackageStore(w, 2, cx)).toBe('radioshock');
    w.run.level.stores.radioshock!.packageTaken = true;
    expect(['forever12', 'sambaddy']).toContain(nearestPackageStore(w, 2, cx));
    w.run.level.stores.forever12!.packageTaken = true;
    w.run.level.stores.sambaddy!.packageTaken = true;
    expect(nearestPackageStore(w, 2, cx)).toBe('footlock'); // two floors away
    w.run.level.stores.footlock!.packageTaken = true;
    expect(nearestPackageStore(w, 2, cx)).toBeNull();
    // the real panel shows "nothing left" too
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel!.target).toBeNull();
  });

  it('from the 1F kiosk the nearest package is Foot Lockpicker on the same floor', () => {
    const r = rig(4);
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel!.target).toBe('footlock');
  });

  it('after the panel, the kiosk needs ~20 s: a second use does nothing but a buzzer', () => {
    expect(KIOSK_COOLDOWN).toBe(1200);
    const r = rig(2);
    r.tap(Btn.UP);
    const k = r.x.kiosks.kiosks.find((q) => q.floor === 2)!;
    r.hold(0, PANEL_FRAMES + 10);
    expect(r.x.kiosks.panel).toBeNull();
    r.sfx.length = 0;
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).toBeNull();
    expect(r.sfx).toContain('buzzer');
    // just before the cooldown ends: still a buzzer
    r.hold(0, k.readyAt - r.w.frame - 2);
    r.sfx.length = 0;
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).toBeNull();
    expect(r.sfx).toContain('buzzer');
    // ready again
    r.hold(0, 4);
    r.sfx.length = 0;
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).not.toBeNull();
    expect(r.sfx).not.toContain('buzzer');
    expect(k.readyAt - r.w.frame).toBeGreaterThan(PANEL_FRAMES + KIOSK_COOLDOWN - 5);
  });

  it('each kiosk has its own cooldown; Down and standing away from it do nothing', () => {
    const r = rig(2);
    r.tap(Btn.DOWN);
    expect(r.x.kiosks.panel).toBeNull();
    place(r, 2, 600 - 40);
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).toBeNull();
    place(r, 2, kioskFeature(2).x + 12);
    r.tap(Btn.UP);
    expect(r.x.kiosks.panel).not.toBeNull();
    // another floor's kiosk is untouched
    const other = r.x.kiosks.kiosks.find((q) => q.floor === 1)!;
    expect(other.readyAt).toBe(0);
  });
});
