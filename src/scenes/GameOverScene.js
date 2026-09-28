import { Container, Graphics, Sprite } from 'pixi.js';
import { makeSprite, tex } from '../gfx/textures.js';
import { makeText, setText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';

const LINES = ['ATTENTION SHOPPERS:', 'THE MALL IS NOW CLOSED'];

// PA announcement while the shutters roll down over the agent, then GAME OVER.
export class GameOverScene {
  constructor() { this.container = new Container(); }

  enter(ctx) {
    this.t = 0; this.chars = 0;
    ctx.highScore = Math.max(ctx.highScore, ctx.state.score);
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const bg = new Container();
    for (let y = 40; y < 200; y += 8) for (let x = 0; x < 256; x += 8) { const s = makeSprite('wallBack'); s.position.set(x, y); bg.addChild(s); }
    for (let x = 0; x < 256; x += 8) { const s = makeSprite('floorTop'); s.position.set(x, 200); bg.addChild(s); }
    c.addChild(bg);
    this.fronts = [0, 88, 176].map((x) => { const f = makeSprite('facade'); f.position.set(x - 4, 160); c.addChild(f); return f; });
    const agent = new Sprite(tex('agentStand')); agent.anchor.set(0.5, 1); agent.position.set(128, 200); c.addChild(agent);
    this.shutter = new Graphics(); c.addChild(this.shutter);
    c.addChild(new Graphics().rect(0, 0, 256, 40).fill(C.black));
    this.pa = [makeText('', C.yellow), makeText('', C.yellow)];
    this.pa.forEach((t, i) => { t.position.set(12, 10 + i * 12); c.addChild(t); });
    this.big = new Container(); c.addChild(this.big);
    ctx.audio.stopMusic();
    ctx.audio.sfx('paChime');
  }

  update(ctx) {
    this.t++;
    const all = LINES.join('\n');
    if (this.t > 60 && this.t % 2 === 0 && this.chars < all.length) {
      this.chars++;
      const [a, b = ''] = all.slice(0, this.chars).split('\n');
      setText(this.pa[0], a, C.yellow); setText(this.pa[1], b, C.yellow);
      ctx.audio.sfx('blip');
    }
    // shutters roll down over the storefronts (and the agent) at 1 px every 2 frames
    const h = Math.min(40, Math.max(0, (this.t - 60) >> 1));
    const g = this.shutter.clear();
    if (h > 0) {
      g.rect(0, 160, 256, h).fill(C.grey);
      for (let y = 160; y < 160 + h; y += 3) g.rect(0, y, 256, 1).fill(C.lightGrey);
      g.rect(0, 160 + h - 2, 256, 2).fill(C.darkGrey);
    }
    if (this.t === 180) {
      ctx.audio.playMusic('gameOver');
      const box = new Graphics().rect(48, 84, 160, 52).fill(C.black).rect(48, 84, 160, 52).stroke({ color: C.red, width: 1 });
      const go = makeText('GAME OVER', C.red); go.position.set(92, 92);
      const sc = makeText(`SCORE ${String(ctx.state.score).padStart(6, '0')}`); sc.position.set(72, 108);
      const hi = makeText(`HI    ${String(ctx.highScore).padStart(6, '0')}`, C.yellow); hi.position.set(72, 120);
      this.big.addChild(box, go, sc, hi);
    }
    if (this.t > 200 && (ctx.pad.pressed('start') || this.t > 480)) ctx.toTitle();
  }

  exit() {}
}
