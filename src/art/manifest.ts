/**
 * Every sprite the game needs, with its exact size. The renderer looks sprites up by these names;
 * tests check that each exists at this size with at most 3 colours.
 * Animation frames are named <base>_0, <base>_1, ... (the renderer discovers extra frames on its own).
 */
export interface SpriteReq {
  name: string;
  w: number;
  h: number;
}

export const STORE_IDS = [
  'forever12', 'radioshock', 'crookstone', 'gamestonk',
  'kgbtoys', 'blockbluster', 'spenders',
  'sambaddy', 'sharper', 'hotspy', 'circuitpity',
  'footlock', 'borderline',
] as const;
export type StoreId = (typeof STORE_IDS)[number];

export const THEMES = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'] as const;
export type Theme = (typeof THEMES)[number];

const req: SpriteReq[] = [];
const add = (name: string, w: number, h: number) => req.push({ name, w, h });
const frames = (base: string, n: number, w: number, h: number) => {
  for (let i = 0; i < n; i++) add(`${base}_${i}`, w, h);
};

// --- Mall agent, 16x24, faces right (renderer flips for left) ---
for (const n of ['agent_stand', 'agent_jump', 'agent_kick', 'agent_duck', 'agent_shoot', 'agent_duckshoot', 'agent_hang',
  'agent_crouch', 'agent_selfie', 'agent_dead', 'agent_hold', 'agent_ride']) add(n, 16, 24);
frames('agent_walk', 3, 16, 24);
// --- Mall spy, 16x24, faces right ---
for (const n of ['spy_stand', 'spy_aim_high', 'spy_aim_low', 'spy_duck', 'spy_dead']) add(n, 16, 24);
frames('spy_walk', 2, 16, 24);
frames('spy_receipt', 2, 16, 24);
// --- Store (top-down) agent and spy, 16x16; side frames face right ---
for (const who of ['tagent', 'tspy']) for (const dir of ['down', 'up', 'side']) frames(`${who}_${dir}`, 2, 16, 16);
add('tagent_hold', 16, 16);
add('tspy_changing', 16, 16);
frames('bot', 2, 16, 16);
add('clerk', 16, 16);
frames('toy', 2, 8, 8);
add('shoe', 8, 8);
frames('puff', 3, 16, 16);
// --- Mall NPCs, 16x24, face right ---
frames('janitor_walk', 2, 16, 24);
frames('janitor_mop', 2, 16, 24);
frames('walker_a', 2, 16, 24);
frames('walker_b', 2, 16, 24);
frames('cop', 2, 16, 24);
add('cop_whistle', 16, 24);
// --- Items (16x16) ---
for (const n of ['pu_rapid', 'pu_spread', 'pu_armor', 'pu_sneakers', 'pu_radar', 'pu_1up', 'pu_cinnabomb', 'pu_ooze',
  'pu_pretzel', 'joke_coupon', 'joke_guide', 'joke_rock', 'joke_ring', 'joke_share', 'package']) add(n, 16, 16);
// --- Projectiles & small things ---
add('bullet', 4, 2);
add('ebullet', 4, 2);
add('tbullet', 4, 4);
frames('coin', 4, 8, 8);
frames('gcoin', 4, 8, 8);
add('lamp', 16, 8);
add('glass', 16, 8);
frames('disco', 2, 16, 16);
add('wetsign', 8, 12);
add('hud_head', 8, 8);
add('hud_armor', 8, 8);
add('hud_radar', 8, 8);
add('portrait_agent', 24, 24);
// --- Mall furniture ---
frames('fountain', 3, 32, 24);
add('kiosk', 16, 24);
add('booth', 24, 32);
add('bench', 24, 8);
add('plant', 16, 24);
add('wagon_body', 64, 24);
frames('wagon_wheel', 2, 8, 8);
// --- Store tiles (16x16) per theme ---
for (const t of THEMES) for (const part of ['floor', 'wall', 'fixture', 'fixture_open', 'counter', 'decor']) add(`t_${t}_${part}`, 16, 16);
for (const n of ['t_fitting', 't_fitting_open', 't_toyshelf', 't_toyshelf_open', 't_booth', 't_door', 't_pedestal']) add(n, 16, 16);
frames('t_demotv', 2, 16, 16);
// --- Storefront window displays (24x20); at least frame 0, up to 3 frames each ---
for (const s of STORE_IDS) for (const side of ['a', 'b']) add(`disp_${s}_${side}_0`, 24, 20);

export const REQUIRED_SPRITES: readonly SpriteReq[] = req;
