import { STORES } from '../content/stores';
import { THEMES } from '../content/themes';

/**
 * REQUIRED sprites. Renderers rely on these exact names/sizes. An art module may
 * add extra sprites with other names, but must provide every entry below with
 * exactly the listed w x h, at least `frames` frames, and <= 3 colours.
 * Facing: characters are drawn FACING RIGHT; renderers flip for left.
 * Characters are bottom-aligned in their cell and horizontally centred.
 */
export interface Req {
  name: string;
  w: number;
  h: number;
  frames: number;
  owner: 'characters' | 'items' | 'mallprops' | 'storefronts' | 'storeart';
  note?: string;
}

const R: Req[] = [];
const add = (owner: Req['owner'], name: string, w: number, h: number, frames = 1, note?: string): void => {
  R.push({ owner, name, w, h, frames, note });
};

// ---------------------------------------------------------------- characters (mall, 16x24)
const C_ = 'characters' as const;
add(C_, 'agent.stand', 16, 24, 1, 'red trench coat, dark hair, facing right');
add(C_, 'agent.walk', 16, 24, 4, '4-frame walk cycle');
add(C_, 'agent.jump', 16, 24, 1);
add(C_, 'agent.kick', 16, 24, 1, 'jump-kick pose, leg extended forward');
add(C_, 'agent.duck', 16, 24, 1, 'crouched, bottom-aligned (only the bottom ~14 px are drawn)');
add(C_, 'agent.shoot', 16, 24, 1, 'standing, arm extended with pistol at chest height');
add(C_, 'agent.shootlow', 16, 24, 1, 'crouched, pistol extended low');
add(C_, 'agent.die', 16, 24, 3, 'hit, spin/fall, lying down');
add(C_, 'agent.hang', 16, 24, 1, 'hanging by both hands from a cable (hands at the top)');
add(C_, 'agent.crouch', 16, 24, 1, 'landing crouch after the zip line drop');
add(C_, 'agent.selfie', 16, 24, 2, 'holding up a phone; frame 1 = flash');
add(C_, 'agent.ride', 16, 24, 1, 'facing the viewer, standing in an elevator');
add(C_, 'agent.hold', 16, 24, 1, 'arms raised holding an item overhead (the item is drawn separately above)');
add(C_, 'spy.stand', 16, 24, 1, 'black suit, fedora, sunglasses, facing right');
add(C_, 'spy.walk', 16, 24, 4);
add(C_, 'spy.aimhigh', 16, 24, 1, 'clear aiming pose, pistol raised to head height');
add(C_, 'spy.aimlow', 16, 24, 1, 'clear aiming pose, pistol low (knee height)');
add(C_, 'spy.duck', 16, 24, 1);
add(C_, 'spy.die', 16, 24, 3);
add(C_, 'cop.segway', 24, 24, 2, 'mall cop in a helmet on a Segway, rolling');
add(C_, 'cop.whistle', 24, 24, 1, 'blowing a whistle');
add(C_, 'janitor.walk', 16, 24, 2);
add(C_, 'janitor.mop', 16, 24, 2, 'mopping');
add(C_, 'walker.walk', 16, 24, 4, 'retiree in a tracksuit, power-walking with swinging arms');
add(C_, 'sign.wet', 8, 12, 1, 'yellow wet-floor sign');
// ---------------------------------------------------------------- items / fx / hud
const I_ = 'items' as const;
for (const id of ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'ooze', 'pretzel']) {
  add(I_, `item.${id}`, 12, 12, 1, 'power-up icon');
}
add(I_, 'item.package', 12, 12, 1, 'taped brown package');
add(I_, 'item.joke', 12, 12, 1, 'generic joke item (coupon, rock...)');
add(I_, 'item.photostrip', 8, 12, 1, 'photo strip');
add(I_, 'item.coin', 8, 8, 4, 'spinning coin');
add(I_, 'item.goldcoin', 8, 8, 4, 'spinning gold coin (extra life)');
add(I_, 'bullet.player', 5, 3, 1);
add(I_, 'bullet.enemy', 5, 3, 1);
add(I_, 'fx.spark', 8, 8, 3, 'bullet impact / helmet ping');
add(I_, 'fx.puff', 16, 16, 4, 'smoke puff');
add(I_, 'fx.glass', 8, 8, 3, 'glass shard burst');
add(I_, 'hud.head', 8, 8, 1, 'agent head icon for lives');
add(I_, 'hud.armor', 8, 8, 1);
add(I_, 'hud.radar', 8, 8, 1);
// ---------------------------------------------------------------- mall props
const M_ = 'mallprops' as const;
add(M_, 'car.closed', 24, 32, 1, 'elevator car, doors closed');
add(M_, 'car.open', 24, 32, 1, 'elevator car, doors open (empty interior, back wall)');
add(M_, 'shaft.wall', 24, 16, 1, 'shaft background tile, repeated vertically');
add(M_, 'grate', 24, 4, 1, 'floor grate covering an opening (car above)');
add(M_, 'mall.slab', 16, 8, 1, 'floor slab tile (repeats horizontally); the top row is the walking surface');
add(M_, 'mall.wall', 16, 16, 2, 'corridor back wall tile (repeats); frame 1 = variant');
add(M_, 'esc.step', 8, 4, 4, 'escalator step, 4 animation phases');
add(M_, 'esc.rail', 4, 4, 1, 'escalator handrail dot');
add(M_, 'lamp.shade', 12, 10, 2, 'hanging lamp shade; frame 0 lit, frame 1 dark');
add(M_, 'lamp.broken', 12, 10, 1, 'shattered lamp');
add(M_, 'disco.ball', 12, 12, 4, 'rotating glittering disco ball');
add(M_, 'kiosk', 24, 32, 2, 'directory kiosk; frame 1 = screen on');
add(M_, 'booth', 24, 32, 2, 'photo booth; frame 0 curtain open, frame 1 curtain closed (feet visible)');
add(M_, 'fountain', 40, 24, 4, 'mall fountain, animated water');
add(M_, 'bench', 24, 12, 1);
add(M_, 'plant', 16, 24, 1);
add(M_, 'pillar', 16, 48, 1, 'parking-garage concrete pillar');
add(M_, 'wagon', 72, 28, 2, 'wood-panelled station wagon facing right; frame 1 = lights on');
add(M_, 'post', 8, 16, 1, 'zip-line anchor post on the roof');
add(M_, 'ac', 24, 16, 1, 'rooftop air-conditioning unit');
add(M_, 'pigeon', 8, 8, 2);
// ---------------------------------------------------------------- storefront pieces (28x28 windows, 20x28 doors)
const S_ = 'storefronts' as const;
for (const s of STORES) {
  add(S_, `win.${s.id}.L`, 28, 28, 2, `${s.name}: left window display, 1-3 idle frames`);
  add(S_, `win.${s.id}.R`, 28, 28, 2, `${s.name}: right window display`);
}
add(S_, 'door.target', 20, 28, 2, 'red door; frame 1 = bright (blinks)');
add(S_, 'door.powerup', 20, 28, 1, 'blue door');
add(S_, 'door.closed', 20, 28, 1, 'rolled-down shutter');
add(S_, 'door.dark', 20, 28, 1, 'darkened door (target store already cleared)');
// ---------------------------------------------------------------- store (top-down) art, 16x16 tiles
const T_ = 'storeart' as const;
for (const t of THEMES) {
  for (const k of ['floor', 'wall', 'counter', 'decor', 'shelf', 'shelf.open', 'rack', 'rack.open']) {
    add(T_, `st.${t}.${k}`, 16, 16, 1, `${t} theme tile`);
  }
}
add(T_, 'st.door', 32, 16, 1, 'doorway (2 tiles wide) at the bottom centre; walkable');
add(T_, 'st.fitting', 16, 16, 1, 'Forever 12 fitting room (curtain closed)');
add(T_, 'st.fitting.open', 16, 16, 1);
add(T_, 'st.toyshelf', 16, 16, 1, 'KGB Toys shelf of wind-up toys');
add(T_, 'st.toyshelf.open', 16, 16, 1, 'toy shelf after the toys were released');
add(T_, 'st.booth', 16, 16, 2, 'Sam Baddy listening booth; frame 1 = active');
add(T_, 'st.tv', 16, 16, 3, 'flickering demo TV (solid decor)');
add(T_, 'st.pedestal', 16, 16, 1, 'item pedestal');
add(T_, 'td.agent.down', 16, 16, 2, 'top-down agent walking toward the viewer');
add(T_, 'td.agent.up', 16, 16, 2);
add(T_, 'td.agent.side', 16, 16, 2, 'facing right; flip for left');
add(T_, 'td.agent.hold', 16, 16, 1, 'item held overhead');
add(T_, 'td.agent.stun', 16, 16, 2, 'stunned (stars)');
add(T_, 'td.spy.down', 16, 16, 2);
add(T_, 'td.spy.up', 16, 16, 2);
add(T_, 'td.spy.side', 16, 16, 2);
add(T_, 'td.spy.change', 16, 16, 1, 'shrieking spy caught mid-change in the fitting room');
add(T_, 'td.bot', 16, 16, 2, 'security bot');
add(T_, 'td.toy', 16, 16, 2, 'marching wind-up toy (facing right)');
add(T_, 'td.clerk', 16, 16, 2, 'old clerk of the GameStonk easter egg');
add(T_, 'td.shoe', 8, 8, 2, 'thrown shoe');
add(T_, 'td.bullet', 4, 4, 1);

export const REQUIRED_SPRITES: readonly Req[] = R;
