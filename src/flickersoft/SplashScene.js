import { Container, Graphics } from 'pixi.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { SPLASH, letterVisible, splashDone } from './flicker.js';

const NAME = 'FLICKERSOFT';
const COLORS = [C.red, C.orange, C.yellow, C.lime, C.cyan, C.sky, C.blue, C.purple, C.magenta, C.pink, C.red];

// FLICKERSOFT boot logo: letters flicker like an overloaded NES sprite line, then settle.
// Self-contained so other FLICKERSOFT games can reuse it: new SplashScene(onDone).
export class SplashScene {
  constructor(onDone) { this.container = new Container(); this.onDone = onDone; }

  enter() {
    this.t = 0; this.done = false;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    c.addChild(new Graphics().rect(0, 0, 256, 240).fill(C.black));
    const x0 = Math.floor((256 - NAME.length * 16) / 2);
    this.letters = [...NAME].map((ch, i) => {
      const s = makeText(ch, COLORS[i]); s.scale.set(2); s.position.set(x0 + i * 16, 96); s.visible = false;
      c.addChild(s); return s;
    });
    this.underline = new Graphics().rect(x0, 116, NAME.length * 16, 2).fill(C.white);
    this.underline.visible = false;
    this.presents = makeText('PRESENTS', C.lightGrey);
    this.presents.position.set(Math.floor((256 - this.presents.width) / 2), 132);
    this.presents.visible = false;
    c.addChild(this.underline, this.presents);
  }

  update(ctx) {
    this.t++;
    this.letters.forEach((s, i) => { s.visible = letterVisible(i, this.t); });
    if (this.t === SPLASH.settleAt) { this.underline.visible = true; ctx.audio.sfx('package'); }
    if (this.t === SPLASH.presentsAt) this.presents.visible = true;
    const skip = ['start', 'a', 'b', 'select'].some((b) => ctx.pad.pressed(b));
    if (!this.done && (splashDone(this.t) || skip)) { this.done = true; this.onDone(); }
  }

  exit() {}
}
