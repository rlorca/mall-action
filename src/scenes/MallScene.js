import { Container, Graphics, Sprite } from 'pixi.js';
import { MALL_W, MALL_H, FLOOR_NAMES, floorTop, feetY } from '../world/constants.js';
import { SHAFTS, STORES, FOUNTAINS, PHOTO_BOOTH, GETAWAY_CAR, FLOOR_ANNOUNCE, doorX } from '../world/mallLevel.js';
import { createMallWorld, stepMall } from '../game/mallWorld.js';
import { placeOnFloor } from '../game/mallPlayer.js';
import { doorwayState, carFloor } from '../logic/elevator.js';
import { makeSprite, tex } from '../gfx/textures.js';
import { makeText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { createHud } from '../ui/hud.js';
import { buildMallBackground, buildStorefront, updateStorefront, EntityViews, put } from './mallView.js';

const VIEW_H = 224;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function playerFrame(p, t) {
  switch (p.mode) {
    case 'intro': return ['agentZip', 0];
    case 'dying': return ['agentDie', p.dieT > 60 ? 0 : p.dieT > 30 ? 1 : 2];
    case 'air': return [p.kick ? 'agentKick' : 'agentJump', 0];
    case 'esc': return ['agentStand', 0];
    default:
      if (p.duck) return [p.shootT > 8 ? 'agentDuckShoot' : 'agentDuck', 0];
      if (p.shootT > 8) return ['agentShoot', 0];
      if (p.vx) return ['agentWalk', Math.floor(p.x / 6) % 2];
      return ['agentStand', 0];
  }
}

export class MallScene {
  constructor() { this.container = new Container(); this.world = null; }

  enter(ctx, params = {}) {
    this.ctx = ctx;
    ctx.mallScene = this;
    if (params.newLevel || !this.world) this.build(ctx);
    if (params.fromStore) {
      const s = STORES.find((x) => x.id === params.fromStore);
      const p = this.world.player;
      placeOnFloor(p, doorX(s), s.floor);
      p.facing = 1; p.invulnT = 60;
      this.world.spies = this.world.spies.filter((sp) => sp.floor !== s.floor || Math.abs(sp.x - p.x) > 48);
    }
    ctx.audio.playMusic(this.world.alarm ? 'mallAlarm' : 'mall');
  }

  build(ctx) {
    const state = ctx.state;
    this.world = createMallWorld(state);
    this.t = 0; this.shakeT = 0;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));

    this.worldLayer = new Container();
    c.addChild(this.worldLayer);
    const bg = buildMallBackground();
    bg.cacheAsTexture(true);
    this.worldLayer.addChild(bg);

    this.fronts = STORES.map((s) => buildStorefront(s, { blackFriday: state.blackFriday }));
    for (const f of this.fronts) this.worldLayer.addChild(f.container);

    this.dyn = new Container();
    this.worldLayer.addChild(this.dyn);
    this.grates = [];
    for (const sh of SHAFTS) for (let f = sh.minFloor; f <= sh.maxFloor; f++) {
      const g = put(this.dyn, 'shaftGrate', sh.x, feetY(f));
      this.grates.push({ g, shaftId: sh.id, floor: f });
    }
    this.fountains = FOUNTAINS.map((f) => put(this.dyn, 'fountain', f.x, feetY(f.floor) - 24));
    this.booth = put(this.dyn, 'photoBooth', PHOTO_BOOTH.x, floorTop(PHOTO_BOOTH.floor));
    this.wagon = put(this.dyn, 'stationWagon', GETAWAY_CAR.x, feetY(GETAWAY_CAR.floor) - 24);

    this.carViews = this.world.cars.map((car) => {
      const body = put(this.dyn, 'carBody', car.x, car.y - 40);
      const roof = put(this.dyn, 'carRoof', car.x, car.y - 40);
      const slab = new Graphics().rect(0, 0, car.w, 8).fill(C.darkGrey);
      this.dyn.addChild(slab);
      return { car, body, roof, slab };
    });

    this.lightLayer = new Container(); this.worldLayer.addChild(this.lightLayer);
    this.entityLayer = new Container(); this.worldLayer.addChild(this.entityLayer);
    this.fxLayer = new Container(); this.worldLayer.addChild(this.fxLayer);
    this.lightViews = new EntityViews(this.lightLayer);
    this.playerSprite = new Sprite(tex('agentStand'));
    this.playerSprite.anchor.set(0.5, 1);
    this.entityLayer.addChild(this.playerSprite);

    this.hud = createHud();
    c.addChild(this.hud.container);
    this.bannerBox = new Container(); this.bannerBox.visible = false;
    c.addChild(this.bannerBox);
    this.popups = [];
  }

  banner(text, frames = 120) {
    const b = this.bannerBox;
    b.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const txt = makeText(text, C.white);
    const w = txt.width + 8;
    b.addChild(new Graphics().rect(0, 0, w, 14).fill(C.black).rect(0, 0, w, 14).stroke({ color: C.yellow, width: 1 }));
    txt.position.set(4, 3); b.addChild(txt);
    b.position.set(Math.max(0, Math.floor((256 - w) / 2)), 40);
    b.visible = true; this.bannerT = frames;
  }

  handle(ev) {
    const { ctx, world } = this;
    const p = world.player;
    switch (ev.type) {
      case 'sfx': ctx.audio.sfx(ev.name); break;
      case 'music': ctx.audio.playMusic(ev.name); break;
      case 'shake': this.shakeT = Math.max(this.shakeT, ev.frames); break;
      case 'banner': this.banner(ev.text); break;
      case 'carStopped':
        if (ev.withPlayer) { ctx.audio.sfx('ding'); this.banner(FLOOR_ANNOUNCE[ev.floor]); }
        else if (Math.abs(world.cars.find((c) => c.id === ev.carId).x - p.x) < 128) ctx.audio.sfx('ding');
        break;
      case 'score': this.popup(`${ev.pts}`, ev.x, ev.y); break;
      case 'enterStore': ctx.enterStore?.(ev.storeId); break;
      case 'playerDied': ctx.onPlayerDied?.(this, ev.cause); break;
      default: break;
    }
  }

  popup(text, x, y) {
    const t = makeText(text, C.white); t.scale.set(0.5);
    t.position.set(Math.round(x - t.width / 2), Math.round(y));
    this.fxLayer.addChild(t);
    this.popups.push({ t, life: 40 });
  }

  update(ctx) {
    const { world } = this;
    this.t++;
    if (ctx.pad.pressed('start') && ctx.openPause) { ctx.openPause(); return; }
    if (ctx.pad.pressed('select') && ctx.openMap) { ctx.openMap(null); return; }
    const events = stepMall(world, ctx.pad, ctx.state, ctx.state.rng);
    for (const ev of events) this.handle(ev);
    this.render();
  }

  render() {
    const { world, ctx } = this;
    const state = ctx.state;
    const p = world.player;

    // camera
    const camX = clamp(Math.round(p.x) - 128, 0, MALL_W - 256);
    const camY = clamp(Math.round(p.y) - 150, 0, MALL_H - VIEW_H);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) { this.shakeT--; sx = (this.t % 3) - 1; sy = ((this.t >> 1) % 3) - 1; }
    this.worldLayer.position.set(-camX + sx, 16 - camY + sy);

    for (const f of this.fronts) updateStorefront(f, state, this.t);
    for (const { g, shaftId, floor } of this.grates) g.visible = doorwayState(world.cars.find((c) => c.id === shaftId), floor) === 'solid';
    this.fountains.forEach((f) => { f.texture = tex('fountain', Math.floor(this.t / 8)); });
    this.booth.texture = tex('photoBooth', p.mode === 'hidden' ? 0 : 1);
    this.wagon.visible = !world.exiting;
    for (const v of this.carViews) {
      const y = Math.round(v.car.y);
      v.body.position.set(v.car.x, y - 40); v.roof.position.set(v.car.x, y - 40); v.slab.position.set(v.car.x, y);
      v.body.texture = tex('carBody', carFloor(v.car) !== null ? 1 : 0);
    }

    this.lightViews.sync(world.lights.filter((l) => l.state !== 'gone'), (l, s) => {
      s.anchor.set(0.5, 0);
      if (l.state === 'broken') { s.texture = tex(l.kind === 'disco' ? 'discoBroken' : 'lampBroken'); s.position.set(l.x, feetY(l.floor) - 8); return; }
      s.texture = tex(l.kind === 'disco' ? 'disco' : 'lamp', l.state === 'hanging' ? Math.floor(this.t / 40) % 2 : 0);
      s.position.set(Math.round(l.x), Math.round(l.y));
    });

    // player
    const [name, frame] = playerFrame(p, this.t);
    const ps = this.playerSprite;
    ps.texture = tex(name, frame);
    ps.scale.x = p.facing;
    ps.position.set(Math.round(p.x), Math.round(p.y));
    ps.visible = p.mode !== 'hidden' && !(p.invulnT > 0 && Math.floor(p.invulnT / 4) % 2);

    // popups
    this.popups = this.popups.filter((pp) => { pp.life--; pp.t.y -= 0.4; if (pp.life <= 0) { pp.t.destroy(); return false; } return true; });
    if (this.bannerT > 0 && --this.bannerT === 0) this.bannerBox.visible = false;

    const floorLabel = FLOOR_NAMES[p.floor ?? p.lastSafe.floor];
    this.hud.update(state, { floorLabel, alarm: world.alarm, frame: this.t });
  }

  exit() {}
}
