// Every sprite in the game, generated from code. Colour indices: 1 = ink, 2 = skin/light, 3 = accent.
import { AGENT_H, AGENT_W, SPY_H, SPY_W } from './constants';
import { Bitmap, makeSprite, type SpriteDef } from './pixels';
import { NES } from './palette';

export type Frame = 'stand' | 'walkA' | 'walkB' | 'jump' | 'kick' | 'duck' | 'aim' | 'dead' | 'zip';

interface HumanoidStyle {
  name: string;
  accent: string; // coat / suit / overalls
  ink: string;
  skin: string;
  hat?: boolean; // fedora or helmet
  shades?: boolean;
  visor?: boolean;
}

function humanoid(style: HumanoidStyle, frame: Frame): SpriteDef {
  const b = new Bitmap(AGENT_W, AGENT_H);
  const INK = 1, SKIN = 2, ACC = 3;
  const bodyDy = frame === 'duck' ? 6 : 0;
  // Head
  b.rect(5, 2 + bodyDy, 6, 6, SKIN);
  if (style.hat) {
    b.rect(3, 0 + bodyDy, 10, 2, INK).rect(2, 2 + bodyDy, 12, 1, INK);
  } else {
    b.rect(4, 1 + bodyDy, 8, 3, INK); // hair
  }
  if (style.shades) b.rect(5, 4 + bodyDy, 6, 2, INK);
  else b.set(6, 5 + bodyDy, INK).set(9, 5 + bodyDy, INK);
  if (style.visor) b.rect(4, 4 + bodyDy, 8, 2, ACC);
  // Torso
  b.rect(3, 8 + bodyDy, 10, 8, ACC);
  b.rect(3, 13 + bodyDy, 10, 1, INK); // belt
  // Arms
  if (frame === 'aim') {
    b.rect(3, 9, 2, 5, ACC).rect(11, 9, 6, 2, ACC).set(15, 9, INK);
  } else if (frame === 'zip') {
    b.rect(3, 0, 2, 9, INK).rect(11, 0, 2, 9, INK).rect(3, 8, 2, 4, ACC).rect(11, 8, 2, 4, ACC);
  } else {
    b.rect(2, 9 + bodyDy, 2, 6, ACC).rect(12, 9 + bodyDy, 2, 6, ACC);
    b.set(2, 15 + bodyDy, SKIN).set(13, 15 + bodyDy, SKIN);
  }
  // Legs
  switch (frame) {
    case 'stand':
    case 'aim':
      b.rect(4, 16, 3, 8, INK).rect(9, 16, 3, 8, INK);
      break;
    case 'walkA':
      b.rect(3, 16, 3, 8, INK).rect(10, 16, 3, 7, INK).rect(10, 23, 3, 1, INK);
      break;
    case 'walkB':
      b.rect(5, 16, 3, 7, INK).rect(8, 16, 3, 8, INK);
      break;
    case 'jump':
      b.rect(2, 17, 3, 5, INK).rect(11, 17, 3, 5, INK);
      break;
    case 'kick':
      b.rect(4, 16, 3, 8, INK).rect(8, 17, 8, 3, INK);
      break;
    case 'duck':
      b.rect(3, 18, 10, 6, INK);
      break;
    case 'dead':
      b.rect(0, 18, 16, 6, ACC).rect(0, 22, 16, 2, INK).rect(1, 16, 5, 2, SKIN);
      break;
    case 'zip':
      b.rect(4, 16, 3, 6, INK).rect(9, 16, 3, 6, INK);
      break;
  }
  return makeSprite(`${style.name}_${frame}`, b, [style.ink, style.skin, style.accent].map((c) => NES[c as keyof typeof NES] ?? c));
}

const AGENT_STYLE: HumanoidStyle = { name: 'agent', accent: NES.red, ink: NES.ink, skin: NES.skin, shades: false };
const SPY_STYLE: HumanoidStyle = { name: 'spy', accent: NES.ink, ink: NES.ink, skin: NES.skin, hat: true, shades: true };
const JANITOR_STYLE: HumanoidStyle = { name: 'janitor', accent: NES.blue, ink: NES.brown, skin: NES.skin };
const WALKER_STYLE: HumanoidStyle = { name: 'walker', accent: NES.orange, ink: NES.dkgrey, skin: NES.skin, visor: true };
const COP_STYLE: HumanoidStyle = { name: 'cop', accent: NES.navy, ink: NES.black, skin: NES.skin, hat: true };

function bullet(name: string, colour: string): SpriteDef {
  const b = new Bitmap(4, 2).rect(0, 0, 4, 2, 1);
  return makeSprite(name, b, [colour]);
}

function coin(name: string, gold: boolean): SpriteDef {
  const b = new Bitmap(8, 8);
  b.rect(2, 0, 4, 8, 1).rect(1, 1, 6, 6, 1).rect(3, 1, 2, 6, 2);
  return makeSprite(name, b, [gold ? NES.gold : NES.yellow, NES.white]);
}

function package_(): SpriteDef {
  const b = new Bitmap(12, 10);
  b.rect(0, 2, 12, 8, 2).outline(0, 2, 12, 8, 1).rect(5, 2, 2, 8, 3);
  return makeSprite('package', b, [NES.ink, NES.wood, NES.white]);
}

function lamp(): SpriteDef {
  const b = new Bitmap(16, 16);
  b.rect(7, 0, 2, 6, 1).rect(3, 6, 10, 4, 2).rect(4, 10, 8, 2, 3).set(7, 12, 1).set(8, 12, 1);
  return makeSprite('lamp', b, [NES.dkgrey, NES.yellow, NES.orange]);
}

function discoBall(): SpriteDef {
  const b = new Bitmap(16, 16);
  b.rect(3, 1, 10, 14, 1).rect(1, 4, 14, 8, 1);
  for (let y = 2; y < 15; y++) for (let x = 2; x < 14; x++) if ((x + y) % 3 === 0) b.set(x, y, 2);
  b.rect(7, 0, 2, 1, 3);
  return makeSprite('disco', b, [NES.grey, NES.white, NES.silver]);
}

function kiosk(): SpriteDef {
  const b = new Bitmap(16, 24);
  b.rect(2, 0, 12, 4, 3).rect(3, 4, 10, 14, 1).rect(4, 6, 8, 8, 2).rect(6, 20, 4, 4, 1);
  return makeSprite('kiosk', b, [NES.ink, NES.cyan, NES.red]);
}

function smoke(): SpriteDef {
  const b = new Bitmap(16, 16);
  b.rect(3, 3, 10, 10, 2).rect(1, 6, 14, 4, 2).rect(6, 1, 4, 14, 2).rect(5, 5, 6, 6, 1);
  return makeSprite('smoke', b, [NES.white, NES.silver]);
}

function bot(): SpriteDef {
  const b = new Bitmap(16, 16);
  b.rect(3, 2, 10, 10, 2).rect(4, 4, 3, 2, 1).rect(9, 4, 3, 2, 1).rect(2, 12, 12, 3, 3).outline(3, 2, 10, 10, 1);
  return makeSprite('security_bot', b, [NES.silver, NES.dkgrey, NES.yellow]);
}

function windup(): SpriteDef {
  const b = new Bitmap(8, 8);
  b.rect(2, 1, 4, 4, 2).rect(1, 5, 6, 3, 3).set(3, 0, 1).set(4, 0, 1).rect(0, 7, 8, 1, 1);
  return makeSprite('windup_toy', b, [NES.ink, NES.pink, NES.yellow]);
}

function segway(): SpriteDef {
  const b = new Bitmap(16, 16);
  b.rect(4, 2, 8, 6, 3).rect(3, 9, 10, 3, 1).rect(3, 13, 3, 3, 1).rect(10, 13, 3, 3, 1).rect(6, 0, 4, 2, 2);
  return makeSprite('segway', b, [NES.dkgrey, NES.navy, NES.white]);
}

function powerIcon(name: string, pattern: readonly string[], colour: string): SpriteDef {
  const b = new Bitmap(8, 8);
  pattern.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && b.set(x, y, ch === '#' ? 1 : 2)));
  return makeSprite(name, b, [NES.ink, colour]);
}

const POWER_ICONS: Record<string, { pattern: readonly string[]; colour: string }> = {
  rapid: { colour: NES.yellow, pattern: ['....##..', '...##...', '..##....', '.#####..', '....##..', '...##...', '..##....', '........'] },
  spread: { colour: NES.cyan, pattern: ['#..#..#.', '.#.#.#..', '..###...', '########', '..###...', '.#.#.#..', '#..#..#.', '........'] },
  armor: { colour: NES.silver, pattern: ['########', '#.####.#', '########', '.######.', '..####..', '...##...', '........', '........'] },
  sneakers: { colour: NES.lime, pattern: ['........', '.##.....', '.####...', '.#####..', '########', '########', '........', '........'] },
  radar: { colour: NES.green, pattern: ['..####..', '.#....#.', '#..##..#', '#.#..#.#', '#..##..#', '.#....#.', '..####..', '........'] },
  oneup: { colour: NES.white, pattern: ['..####..', '.######.', '.#.##.#.', '.######.', '..####..', '..#..#..', '.#....#.', '........'] },
  cinnabomb: { colour: NES.red, pattern: ['....#...', '...#....', '..####..', '.######.', '.######.', '.######.', '..####..', '........'] },
  juli: { colour: NES.orange, pattern: ['........', '..####..', '.######.', '########', '########', '.######.', '..####..', '........'] },
  pretzel: { colour: NES.wood, pattern: ['........', '.##..##.', '#.#..#.#', '#.####.#', '#.#..#.#', '.##..##.', '........', '........'] },
};

/** All sprites, keyed by name. Sizes are checked in tests/sprites.test.ts. */
export function buildSprites(): Record<string, SpriteDef> {
  const out: Record<string, SpriteDef> = {};
  const add = (s: SpriteDef): void => {
    out[s.name] = s;
  };
  const frames: Frame[] = ['stand', 'walkA', 'walkB', 'jump', 'kick', 'duck', 'aim', 'dead', 'zip'];
  for (const f of frames) {
    add(humanoid(AGENT_STYLE, f));
    add(humanoid(SPY_STYLE, f));
  }
  for (const f of ['stand', 'walkA', 'walkB'] as Frame[]) {
    add(humanoid(JANITOR_STYLE, f));
    add(humanoid(WALKER_STYLE, f));
    add(humanoid(COP_STYLE, f));
  }
  add(bullet('bullet_player', NES.yellow));
  add(bullet('bullet_spy', NES.red));
  add(bullet('bullet_spy_low', NES.orange));
  add(coin('coin', false));
  add(coin('coin_gold', true));
  add(package_());
  add(lamp());
  add(discoBall());
  add(kiosk());
  add(smoke());
  add(bot());
  add(windup());
  add(segway());
  for (const [name, icon] of Object.entries(POWER_ICONS)) add(powerIcon(`pu_${name}`, icon.pattern, icon.colour));
  return out;
}

export const SPRITE_SIZES: Record<string, [number, number]> = {
  agent: [AGENT_W, AGENT_H],
  spy: [SPY_W, SPY_H],
};
