export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const TILE = 16;
export const FPS = 60;

export const MALL_W = 768;
export const FLOOR_H = 48;
export const FLOOR_COUNT = 6;

export enum FloorId {
  Roof = 0,
  F4 = 1,
  F3 = 2,
  F2 = 3,
  F1 = 4,
  Parking = 5,
}

export const FLOOR_NAMES: Record<FloorId, string> = {
  [FloorId.Roof]: 'R',
  [FloorId.F4]: '4F',
  [FloorId.F3]: '3F',
  [FloorId.F2]: '2F',
  [FloorId.F1]: '1F',
  [FloorId.Parking]: 'P',
};

export const FLOOR_SUBTITLES: Record<FloorId, string> = {
  [FloorId.Roof]: 'ROOFTOP',
  [FloorId.F4]: 'FASHION & GADGETS',
  [FloorId.F3]: 'TOYS & NOVELTIES',
  [FloorId.F2]: 'MUSIC & FOOD',
  [FloorId.F1]: 'SPORTS & BOOKS',
  [FloorId.Parking]: 'PARKING',
};

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export enum Direction {
  Left = 0,
  Right = 1,
  Up = 2,
  Down = 3,
}

export enum GameScreen {
  Splash = 0,
  Title = 1,
  Arrival = 2,
  Mall = 3,
  Store = 4,
  Map = 5,
  Pause = 6,
  LevelClear = 7,
  Continue = 8,
  GameOver = 9,
}

export enum StoreRole {
  Target = 0,
  PowerUp = 1,
  Closed = 2,
}

export enum PowerUpType {
  RapidFire = 0,
  SpreadShot = 1,
  ArmorVest = 2,
  Sneakers = 3,
  Radar = 4,
  OneUp = 5,
  Cinnabomb = 6,
  OrangeJuliOoze = 7,
  SoftPretzel = 8,
}

export const POWER_UP_NAMES: Record<PowerUpType, string> = {
  [PowerUpType.RapidFire]: 'RAPID FIRE',
  [PowerUpType.SpreadShot]: 'SPREAD SHOT',
  [PowerUpType.ArmorVest]: 'ARMOR VEST',
  [PowerUpType.Sneakers]: 'SNEAKERS',
  [PowerUpType.Radar]: 'RADAR',
  [PowerUpType.OneUp]: '1-UP',
  [PowerUpType.Cinnabomb]: 'CINNABOMB',
  [PowerUpType.OrangeJuliOoze]: 'ORANGE JULI-OOZE',
  [PowerUpType.SoftPretzel]: 'SOFT PRETZEL',
};

export const TIMED_POWER_UP_DURATIONS: Partial<Record<PowerUpType, number>> = {
  [PowerUpType.RapidFire]: 20 * FPS,
  [PowerUpType.SpreadShot]: 20 * FPS,
  [PowerUpType.Sneakers]: 20 * FPS,
  [PowerUpType.Cinnabomb]: 6 * FPS,
  [PowerUpType.OrangeJuliOoze]: 12 * FPS,
};

export interface StoreInfo {
  id: string;
  name: string;
  parody: string;
  floor: FloorId;
  role: StoreRole;
  theme: string;
  windowDisplay: string;
}

export interface GameEvent {
  type: string;
  data?: unknown;
}
