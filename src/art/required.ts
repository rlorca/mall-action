import { STORES } from '../core/copy';
import { THEMES } from '../core/stores-data';

/** Every sprite the game draws by name, with its required size. `tests/art.test.ts` checks them all. */
export interface Required {
  name: string;
  w: number;
  h: number;
  frames?: number;
}

export function requiredSprites(): Required[] {
  const out: Required[] = [];
  const person = (prefix: string, poses: string[]) => poses.forEach((p) => out.push({ name: `${prefix}.${p}`, w: 16, h: 24 }));
  const walk = ['walk0', 'walk1', 'walk2', 'walk3'];
  person('agent', ['stand', ...walk, 'jump', 'kick', 'duck', 'shoot', 'duckshoot', 'die0', 'die1', 'zip', 'crouch', 'selfie', 'hurt']);
  person('spy', ['stand', ...walk, 'duck', 'aimhigh', 'aimlow', 'die0', 'die1']);
  person('janitor', ['stand', ...walk, 'mop']);
  person('walker0', ['stand', ...walk]);
  person('walker1', ['stand', ...walk]);
  out.push({ name: 'cop', w: 24, h: 26, frames: 2 });
  // storefront windows (two per store) and doors
  for (const s of STORES) for (const side of ['l', 'r']) out.push({ name: `win.${s.id}.${side}`, w: 28, h: 32 });
  for (const d of ['door.target', 'door.shop', 'door.dark', 'shutter', 'shutter.half']) out.push({ name: d, w: 24, h: 32 });
  out.push({ name: 'sign.bf', w: 28, h: 9 });
  // mall scenery
  out.push({ name: 'car.back', w: 28, h: 40 }, { name: 'car.front', w: 28, h: 40, frames: 4 }, { name: 'car.roof', w: 28, h: 4 });
  out.push({ name: 'kiosk', w: 24, h: 30 }, { name: 'booth', w: 20, h: 30 }, { name: 'fountain', w: 32, h: 22 }, { name: 'bench', w: 24, h: 10 });
  out.push({ name: 'plant', w: 12, h: 20 }, { name: 'pillar', w: 16, h: 48 }, { name: 'lamp', w: 10, h: 32 }, { name: 'disco', w: 12, h: 32 });
  out.push({ name: 'ball', w: 12, h: 12 }, { name: 'lamp.broken', w: 12, h: 8 }, { name: 'sign.wet', w: 10, h: 14 }, { name: 'wagon', w: 56, h: 26 });
  // pick-ups and icons
  for (const k of ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'juice', 'pretzel']) out.push({ name: `pu.${k}`, w: 16, h: 16 });
  out.push({ name: 'package', w: 16, h: 16 }, { name: 'coin', w: 8, h: 8, frames: 4 }, { name: 'coin.gold', w: 8, h: 8, frames: 4 });
  out.push({ name: 'bullet.p', w: 4, h: 2 }, { name: 'bullet.e', w: 4, h: 2 }, { name: 'hud.head', w: 8, h: 8 }, { name: 'hud.armor', w: 8, h: 8 }, { name: 'hud.radar', w: 8, h: 8 });
  out.push({ name: 'smoke', w: 16, h: 16, frames: 3 }, { name: 'pad.exclaim', w: 8, h: 12 });
  // top-down
  for (const t of THEMES) for (const k of ['floor', 'wall', 'fixture', 'fixture.open', 'counter', 'decor']) out.push({ name: `td.${t}.${k}`, w: 16, h: 16 });
  for (const k of ['fitting', 'fitting.open', 'toyshelf', 'toyshelf.open', 'booth', 'tv', 'clerk', 'pedestal', 'doormat', 'exit', 'agent.hold', 'agent.dead', 'spy.dead', 'bot', 'toy'])
    out.push({ name: `td.${k}`, w: 16, h: 16 });
  for (const d of ['up', 'down', 'left', 'right']) {
    out.push({ name: `td.agent.${d}`, w: 16, h: 16, frames: 2 });
    out.push({ name: `td.spy.${d}`, w: 16, h: 16, frames: 2 });
  }
  out.push({ name: 'td.shoe', w: 8, h: 8 }, { name: 'td.bullet.p', w: 4, h: 4 }, { name: 'td.bullet.e', w: 4, h: 4 });
  return out;
}
