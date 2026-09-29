import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE } from '../world/storeRooms.js';
import { FLOOR_NAMES } from '../world/constants.js';
import { createStoreWorld, stepStore, fixtureInFront } from '../game/storeWorld.js';
import { searchFrames } from '../logic/powerups.js';
import { makeSprite, tex, hasSprite } from '../gfx/textures.js';
import { makeText, setText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { createHud } from '../ui/hud.js';
import { EntityViews } from './mallView.js';
import { EGG_TEXT, JOKE_SPRITES } from '../game/storeExtras.js'; // also registers the store extras

const ROOM_Y = 16;
const STRIP_Y = 192;

const TOP_DOWN = { up: 'TopUp', down: 'TopDown', left: 'TopSide', right: 'TopSide' };
const itemSprite = (id) => (id === 'package' ? 'package' : hasSprite(`pu_${id}`) ? `pu_${id}` : id);

export class StoreScene {
  constructor() { this.container = new Container(); }

  enter(ctx, { storeId }) {
    this.ctx = ctx; this.storeId = storeId; this.t = 0;
    this.world = createStoreWorld(storeId, ctx.state, ctx.state.rng);
    this.build();
    ctx.audio.playMusic(`store_${storeId}`);
  }

  build() {
    const { world } = this;
    const { room, store } = world;
    const theme = store.theme;
    const c = this.container;
    c.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.roomLayer = new Container(); this.roomLayer.y = ROOM_Y;
    c.addChild(this.roomLayer);

    this.fixtureSprites = [];
    this.animated = [];
    room.template.forEach((line, row) => [...line].forEach((ch, col) => {
      const at = (name, frame = 0) => { const s = makeSprite(name, frame); s.position.set(col * TILE, row * TILE); this.roomLayer.addChild(s); return s; };
      if (ch === '#') { at(`wall_${theme}`); return; }
      at(ch === 'D' ? 'doorMat' : `floor_${theme}`);
      if (ch === 'c') at(`counter_${theme}`);
      if (ch === 'V') this.animated.push({ s: at('demoTv'), name: 'demoTv', ticks: 6 });
      if (ch === 'L') at('boothTile');
      if (ch === 'I') at('pedestal');
      if (ch === 'F' || ch === 'R' || ch === 'T') {
        const name = ch === 'R' ? 'fittingRoom' : ch === 'T' ? 'toyShelf' : `fixture_${theme}`;
        const idx = room.fixtures.findIndex((f) => f.col === col && f.row === row);
        this.fixtureSprites[idx] = { s: at(name), name };
      }
    }));

    this.entityLayer = new Container(); this.entityLayer.y = ROOM_Y;
    c.addChild(this.entityLayer);
    this.guardViews = new EntityViews(this.entityLayer);
    this.popViews = new EntityViews(this.entityLayer);
    this.radar = makeSprite('bang'); this.entityLayer.addChild(this.radar);
    this.player = new Sprite(); this.player.anchor.set(0.5, 0.5); this.entityLayer.addChild(this.player);
    this.held = new Sprite(); this.held.anchor.set(0.5, 1); this.entityLayer.addChild(this.held);
    this.bullets = new Graphics(); this.entityLayer.addChild(this.bullets);
    this.extras = new Container(); this.entityLayer.addChild(this.extras);

    // bottom strip: store name, prompts, dialogue
    c.addChild(new Graphics().rect(0, STRIP_Y, 256, 48).fill(C.black));
    const name = makeText(store.name, C.yellow);
    name.position.set(Math.floor((256 - name.width) / 2), STRIP_Y + 4);
    c.addChild(name);
    this.prompt = makeText(''); this.prompt.position.set(8, STRIP_Y + 18); c.addChild(this.prompt);
    this.bar = new Graphics(); c.addChild(this.bar);
    this.dialogue = makeText('', C.white); this.dialogue.position.set(8, STRIP_Y + 18); c.addChild(this.dialogue);

    this.hud = createHud(); c.addChild(this.hud.container);
    this.bannerBox = new Container(); c.addChild(this.bannerBox);
    this.promptText = null;
  }

  banner(text) {
    const b = this.bannerBox;
    b.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const t = makeText(text, C.white);
    const w = t.width + 8;
    b.addChild(new Graphics().rect(0, 0, w, 14).fill(C.black).rect(0, 0, w, 14).stroke({ color: C.yellow, width: 1 }));
    t.position.set(4, 3); b.addChild(t);
    b.position.set(Math.floor((256 - w) / 2), 40);
    b.visible = true; this.bannerT = 120;
  }

  update(ctx) {
    this.t++;
    if (ctx.pad.pressed('start') && ctx.openPause) { ctx.openPause(); return; }
    if (ctx.pad.pressed('select') && ctx.openMap) { ctx.openMap(this.storeId); return; }
    const events = stepStore(this.world, ctx.pad, ctx.state, ctx.state.rng);
    for (const ev of events) {
      switch (ev.type) {
        case 'sfx': ctx.audio.sfx(ev.name); break;
        case 'music': ctx.audio.playMusic(ev.name); break;
        case 'banner': this.banner(ev.text); break;
        case 'exitStore': ctx.exitStore(ev.storeId); return;
        case 'playerDied': ctx.onStoreDeath(this); return;
        default: break;
      }
    }
    this.render();
  }

  respawn() {
    this.world = createStoreWorld(this.storeId, this.ctx.state, this.ctx.state.rng);
    this.world.player.invulnT = 120;
    this.build();
  }

  render() {
    const { world, ctx } = this;
    const state = ctx.state;
    const p = world.player;

    world.fixtures.forEach((f, i) => { const fs = this.fixtureSprites[i]; if (fs) fs.s.texture = tex(fs.name, f.searched || (fs.name === 'toyShelf' && world.released.has(i)) ? 1 : 0); });
    for (const a of this.animated) a.s.texture = tex(a.name, Math.floor(this.t / a.ticks));

    // radar marks the package fixture
    const pkg = world.fixtures.findIndex((f) => f.type === 'package' && !f.searched);
    this.radar.visible = state.power.radar && pkg >= 0 && Math.floor(this.t / 10) % 2 === 0;
    if (pkg >= 0) { const at = world.room.fixtures[pkg]; this.radar.position.set(at.col * TILE + 4, at.row * TILE - 6); }

    this.guardViews.sync(world.guards, (g, s) => {
      s.anchor.set(0.5, 0.5);
      if (g.type === 'bot') s.texture = tex('bot', Math.floor(this.t / 10));
      else if (g.state === 'shriek') s.texture = tex('spyChanging', Math.floor(this.t / 4));
      else s.texture = tex(`spy${TOP_DOWN[g.dir]}`, Math.floor((g.x + g.y) / 6));
      s.scale.x = g.dir === 'left' ? -1 : 1;
      s.position.set(Math.round(g.x + 6), Math.round(g.y + 6));
      s.alpha = g.dead ? g.deadT / 24 : g.stunT > 0 && Math.floor(this.t / 4) % 2 ? 0.5 : 1;
    });
    this.popViews.sync(world.pops, (pp, s) => {
      s.anchor.set(0, 0); const n = pp.name;
      s.texture = tex(n, Math.floor((36 - pp.t) / 8)); s.position.set(pp.col * TILE, pp.row * TILE);
    });

    const ps = this.player;
    if (p.holdT > 0) { ps.texture = tex('agentTopHold'); this.held.visible = true; this.held.texture = tex(itemSprite(p.holdItem)); this.held.position.set(Math.round(p.x + 6), Math.round(p.y - 2)); }
    else {
      this.held.visible = false;
      ps.texture = tex(`agent${TOP_DOWN[p.facing]}`, p.dead ? 0 : Math.floor((p.x + p.y) / 6));
    }
    ps.scale.x = p.facing === 'left' ? -1 : 1;
    ps.position.set(Math.round(p.x + 6), Math.round(p.y + 6));
    ps.rotation = p.dead ? Math.PI / 2 : 0;
    ps.visible = !(p.invulnT > 0 && Math.floor(p.invulnT / 4) % 2) && !(p.stunT > 0 && Math.floor(this.t / 3) % 2);

    const bg = this.bullets.clear();
    for (const b of world.bullets) bg.rect(Math.round(b.x), Math.round(b.y), 3, 3).fill(C.white);
    for (const b of world.enemyBullets) bg.rect(Math.round(b.x), Math.round(b.y), 3, 3).fill(C.yellow);

    // prompts
    const idx = fixtureInFront(world);
    let prompt = '';
    this.bar.clear();
    if (world.search) {
      prompt = 'SEARCHING...';
      const frac = world.search.t / searchFrames(state.power);
      this.bar.rect(128, STRIP_Y + 18, 64, 8).stroke({ color: C.white, width: 1 }).rect(129, STRIP_Y + 19, Math.round(62 * frac), 6).fill(C.lime);
    } else if (idx !== null && !world.fixtures[idx].searched && !world.egg) prompt = 'HOLD X TO SEARCH';
    if (prompt !== this.promptText) { setText(this.prompt, prompt, C.white); this.promptText = prompt; }
    this.prompt.visible = !world.egg;
    this.dialogue.visible = !!world.egg;
    if (this.bannerT > 0 && --this.bannerT === 0) this.bannerBox.visible = false;

    this.hud.update(state, { floorLabel: FLOOR_NAMES[world.store.floor], marquee: world.store.name, frame: this.t });
    this.renderExtras();
  }

  renderExtras() {
    const { world } = this;
    const ex = this.extras;
    ex.removeChildren().forEach((ch) => ch.destroy());
    const room = world.room;
    if (room.oldMan && !world.oldManGone) {
      const s = makeSprite('oldMan'); s.position.set(room.oldMan.col * TILE, room.oldMan.row * TILE); ex.addChild(s);
    }
    if (world.egg?.phase === 'offer') {
      const s = makeSprite(JOKE_SPRITES[world.egg.item]); s.position.set(room.pedestal.col * TILE, room.pedestal.row * TILE - 6); ex.addChild(s);
    }
    for (const t of world.toys) { const s = makeSprite('windupToy', Math.floor(this.t / 6)); s.position.set(Math.round(t.x), Math.round(t.y)); ex.addChild(s); }
    for (const b of world.enemyBullets) if (b.shoe) { const s = makeSprite('shoe', Math.floor(this.t / 6)); s.position.set(Math.round(b.x), Math.round(b.y)); ex.addChild(s); }
    if (world.booth) { const g = new Graphics().rect(room.booth.col * TILE, room.booth.row * TILE, TILE, TILE).stroke({ color: this.t % 20 < 10 ? C.magenta : C.white, width: 1 }); ex.addChild(g); }
    // typewriter dialogue (wrapped after the first sentence)
    const shown = world.egg ? EGG_TEXT.slice(0, world.egg.i) : '';
    if (shown !== this.dialogueText) {
      this.dialogueText = shown;
      const [a, ...rest] = shown.split('! ');
      setText(this.dialogue, rest.length ? `${a}!\n${rest.join('! ')}` : a, C.white);
    }
  }

  exit() {}
}
