// Mall renderer: actors (janitor, walkers, cop, spies, player), pickups, coins, projectiles and speech bubbles.
import { C } from '../core/palette';
import type { Surface } from '../art/surface';
import { FLOOR_Y } from '../game/geometry';
import type { MallWorld } from '../game/mall';
import type { Player, Spy } from '../game/mall/types';
import { drawBubble } from './bubble';
import { FOOT_DROP, inView, sx, sy } from './mallView-common';

const FLIP = (dir: number): boolean => dir < 0; // every mall sprite faces RIGHT

/** Draw a 16x24 (or wider) actor sprite with its feet line at world (x, feet). */
function actor(s: Surface, name: string, w: number, h: number, x: number, feet: number, o: { frame?: number; flipX?: boolean; alpha?: number; remap?: number[] } = {}): void {
  s.sprite(name, sx(x - w / 2), sy(feet - h) + FOOT_DROP, o);
}

export function drawActors(s: Surface, w: MallWorld, tick: number): void {
  const st = w.s;
  // decals first: wet patches + signs
  for (const p of st.wetPatches) {
    const fy = FLOOR_Y[p.floor];
    if (!inView(p.x0, p.x1 + 16, fy - 14, fy + 4)) continue;
    s.sprite('wet_patch', sx(p.x0), sy(fy), { frame: (tick >> 4) & 1 });
    s.sprite('wet_sign', sx(p.x1 + 1), sy(fy - 14) + FOOT_DROP);
  }
  // pickups (bobbing)
  for (const k of st.pickups) {
    if (!inView(k.x - 8, k.x + 8, k.y - 20, k.y)) continue;
    if (k.life < 180 && (k.life >> 2) % 2 === 0) continue;
    const bob = Math.round(Math.sin((tick + k.id * 7) / 9) * 2) - 2;
    s.sprite(`item_${k.kind}`, sx(k.x - 8), sy(k.y - 16 + bob) + FOOT_DROP, { frame: (tick >> 4) & 1 });
  }
  // janitor
  {
    const j = st.janitor;
    const fy = FLOOR_Y[j.floor];
    if (inView(j.x - 14, j.x + 14, fy - 24, fy)) {
      if (j.mode === 'mop') actor(s, 'janitor_mop', 24, 24, j.x, fy, { frame: (j.animFrame >> 4) % 3, flipX: FLIP(j.dir) });
      else actor(s, 'janitor_walk', 16, 24, j.x, fy, { frame: (j.animFrame >> 4) & 3, flipX: FLIP(j.dir) });
    }
  }
  // mall walkers (power walking)
  for (const k of st.walkers) {
    const fy = FLOOR_Y[k.floor];
    if (!inView(k.x - 10, k.x + 10, fy - 24, fy)) continue;
    if (k.bubble) actor(s, 'walker_hey', 16, 24, k.x, fy, { flipX: FLIP(k.dir) });
    else actor(s, k.id % 2 === 0 ? 'walker_b' : 'walker_a', 16, 24, k.x, fy, { frame: (k.animFrame >> 3) & 3, flipX: FLIP(k.dir) });
  }
  // mall cop on the Segway
  {
    const c = st.cop;
    const fy = FLOOR_Y[c.floor];
    if (inView(c.x - 14, c.x + 14, fy - 24, fy)) {
      const whistle = c.bubble !== null;
      actor(s, whistle ? 'cop_whistle' : 'cop_segway', 24, 24, c.x, fy, { frame: (c.animFrame >> 2) & 1, flipX: FLIP(c.dir) });
      // chase lights
      if (c.mode === 'chase') s.px(sx(c.x - c.dir * 2), sy(fy - 24) + FOOT_DROP, (tick >> 2) & 1 ? C.RED_L : C.SKY_L);
    }
  }
  // spies
  for (const sp of st.spies) {
    if (!inView(sp.x - 10, sp.x + 10, sp.y - 24, sp.y)) continue;
    drawSpy(s, sp);
  }
  drawPlayer(s, w, tick);
}

function spyFrame(sp: Spy): { name: string; frame: number } {
  switch (sp.anim) {
    case 'walk':
      return { name: 'spy_walk', frame: (sp.animFrame >> 3) & 3 };
    case 'aimHigh':
      return { name: 'spy_aim_high', frame: 0 };
    case 'aimLow':
      return { name: 'spy_aim_low', frame: 0 };
    case 'duck':
      return { name: 'spy_duck', frame: 0 };
    case 'die':
      return { name: 'spy_die', frame: Math.min(3, Math.floor(sp.deathFrames / 6)) };
    default:
      return { name: 'spy_stand', frame: 0 };
  }
}

function drawSpy(s: Surface, sp: Spy): void {
  const { name, frame } = spyFrame(sp);
  const flipX = FLIP(sp.facing);
  if (sp.anim === 'emerge' || sp.state === 'emerge') {
    // stepping out of the door: reveal from the feet up over the emerge time
    const t = Math.min(1, sp.animFrame / 18);
    const rows = Math.max(2, Math.round(24 * t));
    const top = sy(sp.y - rows) + FOOT_DROP;
    s.clip(sx(sp.x - 8), top, 16, rows);
    actor(s, name, 16, 24, sp.x, sp.y, { frame, flipX });
    s.unclip();
    return;
  }
  actor(s, name, 16, 24, sp.x, sp.y, { frame, flipX });
  // aim telegraph: a blinking muzzle glint during the last part of the aim pose
  if (sp.aimFrames > 0 && (sp.anim === 'aimHigh' || sp.anim === 'aimLow') && (sp.aimFrames >> 2) % 2 === 0) {
    const gy = sp.y - (sp.aimHigh ? 18 : 8);
    s.rect(sx(sp.x + sp.facing * 11), sy(gy) + FOOT_DROP, 2, 2, C.YELLOW_L);
  }
}

/* ---------------------------------------------------------------- player */

const CINNA_PAL: number[][] = [
  [C.BLACK, C.YELLOW, C.TAN],
  [C.BLACK, C.ORANGE, C.YELLOW_L],
  [C.BLACK, C.WHITE, C.PINK_L],
  [C.BLACK, C.RED, C.TAN],
];

export function playerSprite(p: Player, duckPose = false): { name: string; frame: number } {
  const aiming = p.shootCd >= 5;
  switch (p.anim) {
    case 'hang':
      return { name: 'agent_hang', frame: (p.animFrame >> 3) & 1 };
    case 'drop':
      return { name: 'agent_jump', frame: 0 };
    case 'crouch':
      return { name: 'agent_crouch', frame: 0 };
    case 'selfie':
      return { name: 'agent_selfie', frame: 0 };
    case 'walk':
      return { name: aiming ? 'agent_shoot' : 'agent_walk', frame: aiming ? 0 : (p.animFrame >> 3) & 3 };
    case 'jump':
      return { name: 'agent_jump', frame: 0 };
    case 'kick':
      return { name: 'agent_kick', frame: 0 };
    case 'duck':
      return { name: aiming ? 'agent_shoot_duck' : 'agent_duck', frame: 0 };
    case 'slide':
      return { name: 'agent_walk', frame: 1 };
    case 'dying': {
      const d = p.deathFrames;
      return { name: 'agent_die', frame: d < 10 ? 0 : d < 24 ? 1 : 2 };
    }
    case 'ride':
    case 'frozen':
    case 'stand':
    default:
      return { name: aiming ? (duckPose ? 'agent_shoot_duck' : 'agent_shoot') : 'agent_stand', frame: 0 };
  }
}

function drawPlayer(s: Surface, w: MallWorld, tick: number): void {
  const p = w.s.player;
  if (p.hidden || p.mode === 'booth' || p.mode === 'entering' || p.mode === 'gone' || p.anim === 'hidden') return;
  if (p.invuln > 0 && ((p.invuln >> 2) & 1) === 0 && p.mode !== 'dying') return; // blink
  if (w.s.phase === 'selfie') return; // the selfie overlay draws him (before the flash)
  if (!inView(p.x - 10, p.x + 10, p.y - 26, p.y + 2)) return;
  const { name, frame } = playerSprite(p);
  const flipX = FLIP(p.facing);
  let remap: number[] | undefined;
  const inv = w.progress.power.invincible;
  if (inv && inv.frames > 0) remap = CINNA_PAL[(tick >> 2) & 3];
  let alpha: number | undefined;
  // riding a closed (moving) car: only a faint silhouette shows through the doors
  if (p.mode === 'car') {
    const car = w.s.cars.find((c) => c.id === p.carId);
    if (car && !car.doorsOpen) alpha = 0.35;
  }
  actor(s, name, 16, 24, p.x, p.y, { frame, flipX, remap, alpha });
  if (p.frozen > 0) {
    // detained by the mall cop: stars spin over the head
    const f = (tick >> 3) % 3;
    s.sprite('star_pop', sx(p.x - 4 + (f === 0 ? -3 : f === 1 ? 3 : 0)), sy(p.y - 30) + FOOT_DROP, { frame: 2 });
  }
}

/* ---------------------------------------------------------------- projectiles, coins */

export function drawProjectiles(s: Surface, w: MallWorld, tick: number): void {
  const st = w.s;
  for (const c of st.coins) {
    if (!inView(c.x - 4, c.x + 4, c.y - 4, c.y + 4)) continue;
    s.sprite(c.gold ? 'coin_gold' : 'coin', sx(c.x - 4), sy(c.y - 4), { frame: ((tick >> 2) + c.id) & 3 });
  }
  for (const b of st.bullets) {
    if (!inView(b.x - 4, b.x + 4, b.y - 2, b.y + 2)) continue;
    s.sprite(b.owner === 'player' ? 'bullet_p' : 'bullet_e', sx(b.x - 2), sy(b.y - 1));
  }
}

/* ---------------------------------------------------------------- speech bubbles */

export function drawBubbles(s: Surface, w: MallWorld): void {
  const st = w.s;
  const say = (text: string, x: number, feet: number, h = 24): void => {
    drawBubble(s, text, sx(x), sy(feet - h) + FOOT_DROP);
  };
  for (const sp of st.spies) if (sp.bubble && sp.bubble.frames > 0 && inView(sp.x - 120, sp.x + 120, sp.y - 40, sp.y)) say(sp.bubble.text, sp.x, sp.y);
  for (const k of st.walkers) if (k.bubble && k.bubble.frames > 0 && inView(k.x - 120, k.x + 120, FLOOR_Y[k.floor] - 40, FLOOR_Y[k.floor])) say(k.bubble.text, k.x, FLOOR_Y[k.floor]);
  const c = st.cop;
  if (c.bubble && c.bubble.frames > 0 && inView(c.x - 120, c.x + 120, FLOOR_Y[c.floor] - 40, FLOOR_Y[c.floor])) say(c.bubble.text, c.x, FLOOR_Y[c.floor]);
}
