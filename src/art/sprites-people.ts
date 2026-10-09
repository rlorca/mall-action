import { Bitmap, Pal3, defSprite } from './pixel';
import { C } from './palette';

/**
 * People. One parametric painter draws the agent, the spies, the janitor, the mall walkers ... in every pose.
 * Slots: 1 = clothes, 2 = dark (hair / shoes / hat / belt), 3 = skin, accent = which slot is used for details.
 * Everything faces RIGHT; the renderer mirrors for LEFT.
 */
export type Pose =
  | 'stand'
  | 'walk0'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'jump'
  | 'kick'
  | 'duck'
  | 'shoot'
  | 'duckshoot'
  | 'die0'
  | 'die1'
  | 'zip'
  | 'crouch'
  | 'selfie'
  | 'aimhigh'
  | 'aimlow'
  | 'hurt'
  | 'mop'
  | 'walkbob';

export interface PersonStyle {
  coat: number; // slot for the coat / suit / tracksuit
  dark: number; // slot for hair, hat, shoes
  skin: number;
  accent: number; // shirt / tie / stripe slot
  hat?: boolean; // fedora + sunglasses
  trench?: boolean; // long coat to the knees
  hair?: 'short' | 'white' | 'cap' | 'bald';
  shades?: boolean;
  bald?: boolean;
  stripe?: boolean; // tracksuit stripe
  headband?: boolean;
}

function head(b: Bitmap, hx: number, hy: number, s: PersonStyle): void {
  // face block
  b.rect(hx + 1, hy + 2, 5, 5, s.skin);
  b.rect(hx + 2, hy + 6, 3, 1, s.skin);
  if (s.hat) {
    // fedora: crown + brim + band, sunglasses
    b.rect(hx + 1, hy - 1, 4, 3, s.dark);
    b.rect(hx - 1, hy + 1, 8, 1, s.dark);
    b.px(hx + 1, hy, s.accent === s.dark ? s.dark : s.accent);
    b.rect(hx + 2, hy + 3, 5, 1, s.dark); // shades
    b.px(hx + 1, hy + 3, s.dark);
    b.px(hx + 5, hy + 5, s.dark); // mouth
  } else if (s.hair === 'white') {
    b.rect(hx + 1, hy + 1, 5, 2, s.dark);
    b.rect(hx, hy + 2, 2, 2, s.dark);
    b.px(hx + 4, hy + 3, s.coat);
    b.px(hx + 5, hy + 5, s.coat);
  } else if (s.hair === 'cap') {
    b.rect(hx + 1, hy + 1, 5, 2, s.dark);
    b.rect(hx + 5, hy + 2, 3, 1, s.dark);
    b.px(hx + 4, hy + 3, s.dark);
  } else {
    // dark hair, swept back
    b.rect(hx + 1, hy + 1, 5, 2, s.dark);
    b.rect(hx, hy + 2, 2, 3, s.dark);
    b.px(hx + 6, hy + 2, s.dark);
    b.px(hx + 4, hy + 3, s.dark); // eye
    b.px(hx + 5, hy + 5, s.dark); // mouth
  }
  if (s.headband) b.rect(hx + 1, hy + 2, 6, 1, s.accent);
}

function legs(b: Bitmap, s: PersonStyle, pose: Pose, top: number): void {
  const d = s.dark;
  const legC = s.trench ? d : s.coat;
  const shoe = d;
  const L = (x: number, len: number) => {
    b.rect(x, top, 2, len, legC);
    b.rect(x - 1, top + len - 1, 3, 1, shoe);
    b.px(x + 2, top + len - 1, shoe);
  };
  switch (pose) {
    case 'walk0':
      L(4, 4);
      L(10, 3);
      break;
    case 'walk1':
      L(5, 4);
      L(8, 4);
      break;
    case 'walk2':
      L(6, 3);
      L(8, 4);
      b.px(6, top + 2, shoe);
      break;
    case 'walk3':
      L(5, 4);
      L(9, 3);
      break;
    case 'jump':
      b.rect(5, top, 2, 2, legC);
      b.rect(9, top, 3, 2, legC);
      b.rect(4, top + 2, 3, 1, shoe);
      b.rect(10, top + 2, 3, 1, shoe);
      break;
    case 'kick':
      b.rect(4, top, 2, 3, legC);
      b.rect(3, top + 2, 3, 1, shoe);
      b.rect(10, top - 2, 5, 2, legC);
      b.rect(14, top - 3, 2, 3, shoe);
      break;
    default:
      L(5, 4);
      L(9, 4);
  }
}

/** Draw a standing/walking/etc person into a 16x24 bitmap. */
export function person(b: Bitmap, pose: Pose, s: PersonStyle): void {
  const arm = s.coat;
  let hx = 5;
  let hy = s.hat ? 3 : 1;
  const bodyTop = hy + 7;
  const bodyBot = s.trench ? 20 : 19;
  switch (pose) {
    case 'duck':
    case 'duckshoot':
    case 'crouch': {
      hy = s.hat ? 11 : 9;
      head(b, hx, hy, s);
      b.rect(4, hy + 7, 8, 4, s.coat);
      b.rect(3, hy + 8, 10, 2, s.coat);
      b.rect(5, 21, 3, 3, s.dark);
      b.rect(9, 21, 3, 3, s.dark);
      b.rect(4, 23, 4, 1, s.dark);
      b.rect(9, 23, 4, 1, s.dark);
      if (pose === 'duckshoot') {
        b.rect(12, hy + 8, 2, 1, arm);
        b.px(14, hy + 8, s.skin);
        b.rect(15, hy + 7, 1, 2, s.dark);
      } else b.px(12, hy + 10, s.skin);
      return;
    }
    case 'die0': {
      head(b, 3, 8, s);
      b.rect(2, 15, 9, 5, s.coat);
      b.rect(10, 17, 4, 3, s.coat);
      b.rect(11, 20, 4, 2, s.dark);
      b.rect(5, 20, 3, 3, s.dark);
      b.px(12, 14, s.skin);
      return;
    }
    case 'die1': {
      // lying on the floor
      head(b, 0, 16, s);
      b.rect(6, 19, 7, 4, s.coat);
      b.rect(13, 20, 3, 3, s.dark);
      b.px(8, 18, s.skin);
      return;
    }
    case 'zip': {
      // hanging from the cable by both hands
      b.rect(6, 0, 2, 2, s.skin);
      b.rect(9, 0, 2, 2, s.skin);
      b.rect(6, 2, 1, 6, arm);
      b.rect(10, 2, 1, 6, arm);
      head(b, 5, 6, s);
      b.rect(4, 13, 8, 6, s.coat);
      b.rect(3, 17, 10, 2, s.coat);
      b.rect(5, 19, 2, 4, s.dark);
      b.rect(9, 19, 2, 4, s.dark);
      b.rect(4, 22, 3, 1, s.dark);
      b.rect(9, 22, 3, 1, s.dark);
      return;
    }
    default:
  }

  head(b, hx, hy, s);
  // torso
  b.rect(4, bodyTop, 8, bodyBot - bodyTop, s.coat);
  b.hline(3, bodyTop + 1, 10, s.coat);
  if (s.trench || s.bald) {
    b.hline(3, bodyBot - 2, 10, s.coat);
    b.hline(3, bodyBot - 1, 10, s.coat);
  }
  // belt / details
  if (s.trench) {
    b.hline(4, bodyTop + 5, 8, s.dark);
    b.px(8, bodyTop + 5, s.skin === 3 ? 3 : s.skin);
    b.vline(8, bodyTop + 6, 5, s.dark); // coat opening
    b.px(4, bodyTop, s.dark);
    b.px(11, bodyTop, s.dark); // raised collar
  } else if (s.hat) {
    // white shirt wedge + tie
    b.rect(7, bodyTop, 2, 3, s.accent);
    b.px(8, bodyTop + 1, s.dark);
    b.px(8, bodyTop + 2, s.dark);
    b.vline(8, bodyTop + 3, 3, s.dark);
  } else if (s.stripe) {
    b.vline(5, bodyTop + 1, 11, s.accent);
    b.vline(10, bodyTop + 1, 11, s.accent);
  } else {
    b.hline(4, bodyTop + 6, 8, s.dark);
  }

  // arms
  const armsDown = () => {
    b.rect(3, bodyTop + 1, 1, 6, arm);
    b.rect(12, bodyTop + 1, 1, 6, arm);
    b.px(3, bodyTop + 7, s.skin);
    b.px(12, bodyTop + 7, s.skin);
  };
  switch (pose) {
    case 'shoot':
    case 'aimhigh': {
      b.rect(3, bodyTop + 1, 1, 6, arm);
      b.rect(12, bodyTop + 2, 2, 2, arm);
      b.px(14, bodyTop + 2, s.skin);
      b.rect(14, bodyTop + 1, 2, 1, s.dark);
      b.px(15, bodyTop + 2, s.dark);
      break;
    }
    case 'aimlow': {
      b.rect(3, bodyTop + 1, 1, 6, arm);
      b.rect(12, bodyTop + 3, 2, 2, arm);
      b.px(13, bodyTop + 5, s.skin);
      b.rect(14, bodyTop + 5, 2, 1, s.dark);
      b.px(14, bodyTop + 4, s.dark);
      break;
    }
    case 'jump':
    case 'kick':
      b.rect(2, bodyTop - 1, 1, 5, arm);
      b.px(2, bodyTop - 2, s.skin);
      b.rect(13, bodyTop - 1, 1, 5, arm);
      b.px(13, bodyTop - 2, s.skin);
      break;
    case 'selfie':
      b.rect(3, bodyTop + 1, 1, 6, arm);
      b.rect(12, bodyTop - 3, 1, 5, arm);
      b.px(12, bodyTop - 4, s.skin);
      b.rect(12, bodyTop - 8, 3, 4, s.dark);
      b.px(13, bodyTop - 7, s.accent === s.dark ? s.skin : s.accent);
      break;
    case 'hurt':
      b.rect(2, bodyTop - 1, 1, 5, arm);
      b.rect(13, bodyTop - 1, 1, 5, arm);
      break;
    case 'mop':
      b.rect(3, bodyTop + 1, 1, 6, arm);
      b.rect(12, bodyTop + 1, 2, 2, arm);
      b.px(14, bodyTop + 2, s.skin);
      b.vline(14, bodyTop + 2, 12, s.dark);
      b.rect(12, 22, 4, 2, s.accent);
      break;
    case 'walk0':
    case 'walk2': {
      const o = pose === 'walk0' ? 1 : -1;
      b.rect(3 - o, bodyTop + 1, 1, 6, arm);
      b.rect(12 + o, bodyTop + 1, 1, 6, arm);
      b.px(3 - o, bodyTop + 7, s.skin);
      b.px(12 + o, bodyTop + 7, s.skin);
      break;
    }
    default:
      armsDown();
  }
  legs(b, s, pose, bodyBot);
}

// ---------------------------------------------------------------- palettes
const AGENT_PAL: Pal3 = [C.red, C.black, C.skin];
const SPY_PAL: Pal3 = [C.black, C.white, C.skin];
const AGENT: PersonStyle = { coat: 1, dark: 2, skin: 3, accent: 2, trench: true };
const SPY: PersonStyle = { coat: 1, dark: 1, skin: 3, accent: 2, hat: true };

const WALK_POSES: Pose[] = ['walk0', 'walk1', 'walk2', 'walk3'];

function defPerson(prefix: string, pal: Pal3, style: PersonStyle, poses: Pose[]): void {
  for (const pose of poses) defSprite(`${prefix}.${pose}`, 16, 24, pal, (b) => person(b, pose, style));
}

// the agent
defPerson('agent', AGENT_PAL, AGENT, ['stand', ...WALK_POSES, 'jump', 'kick', 'duck', 'shoot', 'duckshoot', 'die0', 'die1', 'zip', 'crouch', 'selfie', 'hurt']);
// the spies
defPerson('spy', SPY_PAL, SPY, ['stand', ...WALK_POSES, 'duck', 'aimhigh', 'aimlow', 'die0', 'die1']);

// ---------------------------------------------------------------- janitor / walkers / cop
const JAN_PAL: Pal3 = [C.teal, C.dbrown, C.skin];
const JAN: PersonStyle = { coat: 1, dark: 2, skin: 3, accent: 2, hair: 'cap' };
defPerson('janitor', JAN_PAL, JAN, ['stand', 'walk0', 'walk1', 'walk2', 'walk3', 'mop']);

const WALKER_PALS: Pal3[] = [
  [C.lpurple, C.white, C.skin],
  [C.lgreen, C.white, C.skin],
];
WALKER_PALS.forEach((pal, i) => {
  const st: PersonStyle = { coat: 1, dark: 2, skin: 3, accent: 2, hair: 'white', stripe: true, headband: i === 1 };
  defPerson(`walker${i}`, pal, st, ['stand', 'walk0', 'walk1', 'walk2', 'walk3']);
});

// Mall cop on a Segway (24 x 26): two wheel frames
defSprite(
  'cop',
  24,
  26,
  [C.dblue, C.white, C.skin],
  (b, f) => {
    // segway platform + wheel
    b.rect(3, 22, 18, 2, 2);
    b.oval(12, 22, 3, 3, 1);
    b.px(12 + (f ? 1 : -1), 21, 2);
    b.px(12 + (f ? -1 : 1), 23, 2);
    b.vline(12, 12, 10, 2); // stalk
    b.hline(9, 11, 7, 2); // handlebar
    // rider
    b.rect(8, 0, 8, 3, 2); // helmet
    b.rect(7, 2, 10, 1, 2);
    b.rect(10, 3, 5, 4, 3); // face
    b.px(13, 4, 1);
    b.rect(8, 7, 8, 10, 1); // uniform
    b.rect(7, 8, 1, 5, 1);
    b.rect(16, 8, 1, 4, 1);
    b.px(16, 12, 3);
    b.hline(8, 12, 8, 2);
    b.px(11, 9, 2); // badge
    b.rect(9, 17, 2, 4, 1);
    b.rect(13, 17, 2, 4, 1);
  },
  2,
);
