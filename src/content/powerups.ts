export const POWER_IDS = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'ooze', 'pretzel'] as const;
export type PowerId = (typeof POWER_IDS)[number];

/**
 * weapon:   one at a time (rapid | spread); a new one replaces the old.
 * speed:    sneakers | ooze share one slot.
 * armor:    vest | pretzel, absorbs one hit.
 * radar:    rest of level; the only power-up kept on death.
 * invincible: cinnabomb.
 * instant:  1-up.
 */
export type PowerSlot = 'weapon' | 'speed' | 'armor' | 'radar' | 'invincible' | 'instant';

export interface PowerDef {
  id: PowerId;
  name: string;
  slot: PowerSlot;
  /** Duration in 60 Hz frames; 0 = until hit / rest of level / instant. */
  frames: number;
  food: boolean;
}

const SEC = 60;
export const POWERUPS: Readonly<Record<PowerId, PowerDef>> = {
  rapid: { id: 'rapid', name: 'RAPID FIRE', slot: 'weapon', frames: 20 * SEC, food: false },
  spread: { id: 'spread', name: 'SPREAD SHOT', slot: 'weapon', frames: 20 * SEC, food: false },
  armor: { id: 'armor', name: 'ARMOR VEST', slot: 'armor', frames: 0, food: false },
  sneakers: { id: 'sneakers', name: 'SNEAKERS', slot: 'speed', frames: 20 * SEC, food: false },
  radar: { id: 'radar', name: 'RADAR', slot: 'radar', frames: 0, food: false },
  oneup: { id: 'oneup', name: '1-UP', slot: 'instant', frames: 0, food: false },
  cinnabomb: { id: 'cinnabomb', name: 'CINNABOMB', slot: 'invincible', frames: 6 * SEC, food: true },
  ooze: { id: 'ooze', name: 'ORANGE JULI-OOZE', slot: 'speed', frames: 12 * SEC, food: true },
  pretzel: { id: 'pretzel', name: 'SOFT PRETZEL', slot: 'armor', frames: 0, food: true },
};

export const NON_FOOD_POWERS: readonly PowerId[] = ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup'];
export const FOOD_POWERS: readonly PowerId[] = ['cinnabomb', 'ooze', 'pretzel'];
