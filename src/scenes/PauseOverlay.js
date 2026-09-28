import { Container, Graphics } from 'pixi.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';

export class PauseOverlay {
  constructor() { this.container = new Container(); }
  enter(ctx) {
    this.t = 0;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    c.addChild(new Graphics().rect(0, 0, 256, 240).fill({ color: 0x000000, alpha: 0.5 }));
    this.label = makeText('PAUSE', C.white); this.label.position.set(108, 112); c.addChild(this.label);
    ctx.audio.sfx('pause'); ctx.audio.duck(true);
  }
  update(ctx) {
    this.t++;
    this.label.visible = this.t % 40 < 26;
    if (ctx.pad.pressed('start')) ctx.scenes.pop();
  }
  exit(ctx) { ctx.audio.duck(false); }
}
