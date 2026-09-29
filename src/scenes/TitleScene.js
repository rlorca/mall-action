import { Container, Graphics } from 'pixi.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { hasSprite, makeSprite, tex, frames } from '../gfx/textures.js';
import { STORES } from '../world/mallLevel.js';
import { buildStorefront, updateStorefront } from './mallView.js';

const center = (t, y) => { t.position.set(Math.floor((256 - t.width) / 2), y); return t; };

export class TitleScene {
  constructor() { this.container = new Container(); }

  enter(ctx) {
    this.t = 0; this.blackFriday = false;
    const c = this.container;
    c.removeChildren();
    // night sky bands
    const sky = new Graphics();
    [[0, C.navy], [60, NES_BLUE_MID], [120, C.blue]].forEach(([y, col]) => sky.rect(0, y, 256, 60).fill(col));
    sky.rect(0, 180, 256, 60).fill(C.black);
    c.addChild(sky);
    // scrolling mall facade row
    this.facade = new Container();
    this.facade.position.set(0, 176);
    this.buildFacade();
    c.addChild(this.facade);

    const shadow = center(makeText('MALL ACTION', C.red), 40); shadow.scale.set(2); shadow.x = Math.floor((256 - 11 * 16) / 2) + 2; shadow.y = 42;
    const logo = makeText('MALL ACTION', C.white); logo.scale.set(2); logo.position.set(shadow.x - 2, 40);
    c.addChild(shadow, logo);
    c.addChild(center(makeText('A SHOPPING MALL ESPIONAGE', C.paleYellow), 64));
    this.bf1 = center(makeText('BLACK FRIDAY!', C.red), 100);
    this.bf2 = center(makeText('70% OFF EVERYTHING', C.yellow), 112);
    this.press = center(makeText('PRESS START', C.white), 150);
    c.addChild(this.bf1, this.bf2, this.press);
    this.bf1.visible = this.bf2.visible = false;

    const hint = new Graphics().rect(0, 216, 256, 24).fill(C.black);
    c.addChild(hint);
    c.addChild(center(makeText('^_<> MOVE  Z SHOOT  X JUMP'), 218));
    c.addChild(center(makeText('SHIFT MAP  ENTER PAUSE  C CRT'), 228));
    this.hi = center(makeText(`HI ${String(ctx.highScore ?? 0).padStart(6, '0')}`, C.yellow), 8);
    c.addChild(this.hi);
    c.addChild(center(makeText('(C) 2026', C.lightGrey), 20));
    ctx.audio.playMusic('title');
  }

  buildFacade() {
    this.facade.removeChildren();
    const W = 80;
    const open = STORES.filter((s) => s.role !== 'closed');
    this.fronts = [];
    for (let i = 0; i < 5; i++) {
      const h = buildStorefront(open[i % open.length], { blackFriday: false });
      h.container.position.set(i * W, 0);
      this.facade.addChild(h.container);
      this.fronts.push(h);
    }
  }

  update(ctx) {
    this.t++;
    this.facade.x = -((this.t >> 1) % 80);
    for (const f of this.fronts) updateStorefront(f, NO_PROGRESS, this.t);
    this.press.visible = this.t % 48 < 32;
    for (const b of ctx.pad.pressedList()) {
      if (ctx.konami.push(b) && !this.blackFriday) { this.blackFriday = true; ctx.audio.sfx('powerup'); return; }
    }
    if (this.blackFriday) {
      const on = Math.floor(this.t / 8) % 2 === 0;
      this.bf1.visible = this.bf2.visible = true;
      this.bf1.tint = on ? 0xffffff : 0xffff00;
    }
    if (ctx.pad.pressed('start')) ctx.startGame({ blackFriday: this.blackFriday });
  }

  exit() {}
}

const NES_BLUE_MID = '#0000bc';
const NO_PROGRESS = { cleared: new Set() };
