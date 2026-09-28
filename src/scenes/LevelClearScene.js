import { Container, Graphics, Sprite } from 'pixi.js';
import { makeSprite, tex } from '../gfx/textures.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { addPoints, addScore, timeBonus, TARGET_COUNT } from '../logic/rules.js';

const ROAD_Y = 150;

// Getaway: the station wagon drives off with a spy chasing it, then the bonus tally.
export class LevelClearScene {
  constructor() { this.container = new Container(); }

  enter(ctx, { levelFrames = 0 } = {}) {
    this.ctx = ctx; this.t = 0; this.levelFrames = levelFrames; this.lines = 0;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const bg = new Container();
    for (let y = 0; y < ROAD_Y; y += 8) for (let x = 0; x < 256; x += 8) { const s = makeSprite('parkingWall'); s.position.set(x, y); bg.addChild(s); }
    for (let x = 0; x < 256; x += 8) { const s = makeSprite('parkingFloor'); s.position.set(x, ROAD_Y); bg.addChild(s); }
    for (let x = 24; x < 256; x += 96) for (let y = 0; y < ROAD_Y; y += 8) { const s = makeSprite('pillar'); s.position.set(x, y); bg.addChild(s); }
    bg.addChild(new Graphics().rect(0, ROAD_Y + 8, 256, 82).fill(C.black));
    c.addChild(bg);
    this.wagon = makeSprite('stationWagon'); this.wagon.position.set(96, ROAD_Y - 24); c.addChild(this.wagon);
    this.spy = new Sprite(tex('spyWalk')); this.spy.anchor.set(0.5, 1); this.spy.position.set(40, ROAD_Y); c.addChild(this.spy);
    this.receipt = new Graphics().rect(0, 0, 4, 6).fill(C.white); c.addChild(this.receipt);
    this.tally = new Container(); c.addChild(this.tally);
    ctx.audio.playMusic('levelClear');
  }

  line(text, color = C.white) {
    const t = makeText(text, color); t.position.set(Math.floor((256 - t.width) / 2), ROAD_Y + 14 + this.lines * 12);
    this.tally.addChild(t); this.lines++;
    this.ctx.audio.sfx('coin');
  }

  update(ctx) {
    this.t++;
    const t = this.t;
    if (t <= 120) {
      this.wagon.x = 96 + Math.pow(t / 120, 2) * 200;
      this.wagon.texture = tex('stationWagon', Math.floor(t / 4));
      this.spy.x = 40 + t * 1.1;
      this.spy.texture = tex('spyWalk', Math.floor(t / 6));
      this.receipt.position.set(this.spy.x + 4, ROAD_Y - 24 - (Math.floor(t / 8) % 2) * 3);
    }
    const state = ctx.state;
    if (t === 130) this.line(`PACKAGES ${state.packages.size}/${TARGET_COUNT}`);
    if (t === 160) { const b = timeBonus(this.levelFrames); addPoints(state, b); this.line(`TIME BONUS ${b}`); }
    if (t === 190) { addScore(state, 'levelClear'); this.line('CLEAR BONUS 1000'); }
    if (t === 220) this.line(`LOOP ${state.loop + 1}`, C.yellow);
    if (t > 230 && (ctx.pad.pressed('start') || t > 470)) ctx.nextLoop();
  }

  exit() {}
}
