import { Container, Graphics } from 'pixi.js';
import { makeText, setText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { useContinue } from '../game/state.js';

const SECOND = 60;

// Arcade "CONTINUE?" countdown shown when the last life is lost and continues remain.
export class ContinueOverlay {
  constructor() { this.container = new Container(); }

  enter(ctx, { onContinue }) {
    this.onContinue = onContinue; this.t = 0; this.count = 9;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    c.addChild(new Graphics().rect(0, 0, 256, 240).fill({ color: 0x000000, alpha: 0.75 }));
    const title = makeText('CONTINUE?', C.yellow); title.scale.set(2); title.position.set(56, 64);
    this.number = makeText('9', C.white); this.number.scale.set(4); this.number.position.set(112, 100);
    const left = makeText(`CONTINUES LEFT: ${ctx.state.continues}`, C.lightGrey); left.position.set(Math.floor((256 - left.width) / 2), 150);
    this.press = makeText('PRESS START', C.white); this.press.position.set(84, 176);
    c.addChild(title, this.number, left, this.press);
    ctx.audio.stopMusic();
    ctx.audio.sfx('blip');
  }

  update(ctx) {
    this.t++;
    this.press.visible = this.t % 40 < 26;
    if (ctx.pad.pressed('start') && useContinue(ctx.state)) {
      ctx.audio.sfx('powerup');
      ctx.scenes.pop();
      this.onContinue();
      return;
    }
    if (this.t % SECOND === 0) {
      this.count--;
      if (this.count < 0) { ctx.scenes.pop(); ctx.gameOver(); return; }
      setText(this.number, String(this.count), this.count <= 3 ? C.red : C.white);
      ctx.audio.sfx('blip');
    }
  }

  exit() {}
}
