import {
  PU_CINNABOMB_FRAMES,
  PU_OJ_FRAMES,
  PU_SNEAKER_FRAMES,
  PU_WEAPON_FRAMES,
} from './constants';

export type PowerUpId =
  | 'rapid'
  | 'spread'
  | 'armor'
  | 'sneakers'
  | 'radar'
  | 'oneup'
  | 'cinnabomb'
  | 'oj'
  | 'pretzel';

/**
 * Slots. Only one WEAPON at a time (a new one replaces the old). Armour, speed
 * and radar stack with the weapon and with each other.
 */
export type PowerUpSlot = 'weapon' | 'armor' | 'speed' | 'radar' | 'invuln' | 'instant';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  slot: PowerUpSlot;
  /** 0 = not time-limited (until hit / rest of level / instant). */
  frames: number;
  isFood: boolean;
}

export const POWERUPS: Record<PowerUpId, PowerUpDef> = {
  rapid: { id: 'rapid', name: 'RAPID FIRE', slot: 'weapon', frames: PU_WEAPON_FRAMES, isFood: false },
  spread: { id: 'spread', name: 'SPREAD SHOT', slot: 'weapon', frames: PU_WEAPON_FRAMES, isFood: false },
  armor: { id: 'armor', name: 'ARMOR VEST', slot: 'armor', frames: 0, isFood: false },
  sneakers: { id: 'sneakers', name: 'SNEAKERS', slot: 'speed', frames: PU_SNEAKER_FRAMES, isFood: false },
  radar: { id: 'radar', name: 'RADAR', slot: 'radar', frames: 0, isFood: false },
  oneup: { id: 'oneup', name: '1-UP', slot: 'instant', frames: 0, isFood: false },
  cinnabomb: { id: 'cinnabomb', name: 'CINNABOMB', slot: 'invuln', frames: PU_CINNABOMB_FRAMES, isFood: true },
  oj: { id: 'oj', name: 'ORANGE JULI-OOZE', slot: 'speed', frames: PU_OJ_FRAMES, isFood: true },
  pretzel: { id: 'pretzel', name: 'SOFT PRETZEL', slot: 'armor', frames: 0, isFood: true },
};

export const ALL_POWERUP_IDS = Object.keys(POWERUPS) as PowerUpId[];
export const FOOD_POWERUP_IDS = ALL_POWERUP_IDS.filter((id) => POWERUPS[id].isFood);
export const NON_FOOD_POWERUP_IDS = ALL_POWERUP_IDS.filter((id) => !POWERUPS[id].isFood);

/**
 * The player's active power-up state.
 *
 * Timers are in frames and tick inside stores too; only the map, pause and
 * continue screens freeze them. On death everything is lost EXCEPT radar.
 */
export interface PowerUpState {
  weapon: 'rapid' | 'spread' | null;
  weaponFrames: number;
  /** Speed boost: sneakers and Orange Juli-Ooze share this slot. */
  speed: 'sneakers' | 'oj' | null;
  speedFrames: number;
  /** Armour absorbs exactly one hit. Vest and pretzel share the slot. */
  armor: boolean;
  radar: boolean;
  invulnFrames: number;
}

export function newPowerUpState(): PowerUpState {
  return {
    weapon: null,
    weaponFrames: 0,
    speed: null,
    speedFrames: 0,
    armor: false,
    radar: false,
    invulnFrames: 0,
  };
}

/** Apply a pickup. Returns extra lives granted (0 or 1). */
export function applyPowerUp(st: PowerUpState, id: PowerUpId): number {
  const def = POWERUPS[id];
  switch (def.slot) {
    case 'weapon':
      st.weapon = id as 'rapid' | 'spread';
      st.weaponFrames = def.frames;
      return 0;
    case 'speed':
      st.speed = id as 'sneakers' | 'oj';
      st.speedFrames = def.frames;
      return 0;
    case 'armor':
      st.armor = true;
      return 0;
    case 'radar':
      st.radar = true;
      return 0;
    case 'invuln':
      st.invulnFrames = def.frames;
      return 0;
    case 'instant':
      return id === 'oneup' ? 1 : 0;
  }
}

/** One simulation step of the timers. */
export function tickPowerUps(st: PowerUpState): void {
  if (st.weaponFrames > 0 && --st.weaponFrames === 0) st.weapon = null;
  if (st.speedFrames > 0 && --st.speedFrames === 0) st.speed = null;
  if (st.invulnFrames > 0) st.invulnFrames--;
}

/** Death: lose everything except radar. */
export function resetPowerUpsOnDeath(st: PowerUpState): void {
  const radar = st.radar;
  Object.assign(st, newPowerUpState());
  st.radar = radar;
}

/** A continue resets power-ups completely, radar included. */
export function resetPowerUpsOnContinue(st: PowerUpState): void {
  Object.assign(st, newPowerUpState());
}

/** Absorb a hit with armour. Returns true if the hit was absorbed. */
export function absorbHit(st: PowerUpState): boolean {
  if (st.armor) {
    st.armor = false;
    return true;
  }
  return false;
}

/** The timed power-up the HUD should show, with its remaining fraction. */
export function hudTimer(st: PowerUpState): { name: string; frac: number } | null {
  if (st.invulnFrames > 0) {
    return { name: POWERUPS.cinnabomb.name, frac: st.invulnFrames / PU_CINNABOMB_FRAMES };
  }
  if (st.weapon) {
    return { name: POWERUPS[st.weapon].name, frac: st.weaponFrames / PU_WEAPON_FRAMES };
  }
  if (st.speed) {
    const total = st.speed === 'sneakers' ? PU_SNEAKER_FRAMES : PU_OJ_FRAMES;
    return { name: POWERUPS[st.speed].name, frac: st.speedFrames / total };
  }
  return null;
}
