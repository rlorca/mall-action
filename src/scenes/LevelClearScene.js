import { Container, Graphics, Sprite } from 'pixi.js';
import { makeSprite, tex } from '../gfx/textures.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { addPoints, addScore, timeBonus, TARGET_COUNT } from '../logic/rules.js';
import { pickHeadline, pickPost, MISSION_POSTS } from '../game/humor.js';
import { buildSpygram, likesAt, CARD_W } from './spygram.js';

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
    this.overlay = new Container(); c.addChild(this.overlay);
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
    if (t === 250) this.showHeadline(pickHeadline(state.rng));
    if (t === 390) this.showPost(pickPost(state.rng, MISSION_POSTS));
    if (this.card) this.card.setLikes(likesAt(t - 390));
    if (t > 400 && (ctx.pad.pressed('start') || t > 760)) ctx.nextLoop();
    else if (t > 230 && t < 390 && ctx.pad.pressed('start')) this.t = 389; // skip ahead to the post
  }

  // front page of the local paper
  showHeadline(text) {
    const o = this.overlay;
    o.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const paper = new Graphics().rect(16, 12, 224, 112).fill(C.paleYellow).rect(16, 12, 224, 112).stroke({ color: C.black, width: 1 })
      .rect(24, 34, 208, 1).fill(C.black).rect(24, 76, 96, 40).fill(C.lightGrey);
    for (let y = 80; y < 116; y += 5) paper.rect(128, y, 104, 2).fill(C.grey);
    o.addChild(paper);
    const mast = makeText('THE DAILY MALL', C.black); mast.position.set(72, 20); o.addChild(mast);
    const head = makeText(text, C.darkRed); head.position.set(24, 42); o.addChild(head);
    const pic = makeSprite('stationWagon'); pic.position.set(48, 88); o.addChild(pic);
    this.ctx.audio.sfx('paChime');
  }

  showPost(post) {
    const o = this.overlay;
    o.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.card = buildSpygram(post, { photo: 'agentTopHold' });
    this.card.container.position.set(Math.floor((256 - CARD_W) / 2), 8);
    o.addChild(this.card.container);
    this.ctx.audio.sfx('blip');
  }

  exit() {}
}
