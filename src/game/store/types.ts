// Public state types of the store (top-down) world. Renderers read these; see README.md in this folder.
import type { PowerupKind } from '../progress';
import type { ThemeId } from '../../data/stores';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIR_VEC: Readonly<Record<Dir, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Visible room area in px (the store viewport below the 16px HUD; the bottom strip is drawn outside it). */
export const VIEW_W = 256;
export const VIEW_H = 176;

export type FixtureContent =
  | { kind: 'package' }
  | { kind: 'powerup'; power: PowerupKind }
  | { kind: 'trap' }
  | { kind: 'nothing' };

export interface GuardStart {
  type: 'spy' | 'bot';
  col: number;
  row: number;
  /** Bots only: patrol axis (default 'h'). */
  axis?: 'h' | 'v';
}

export interface StoreTemplate {
  /** One string per row, one char per tile (see tilekinds.ts). Rows must all have equal length. */
  rows: readonly string[];
  guards: readonly GuardStart[];
}

export interface RoomInfo {
  w: number; // tiles
  h: number;
  pxW: number;
  pxH: number;
  theme: ThemeId;
  /** Tile chars, rows[ty][tx] (see TILE_CHARS). */
  rows: readonly string[];
  doorCol: number;
  doorRow: number;
}

export interface CameraState {
  /** Top-left of the viewport in room px. Always 0,0 for one-screen rooms. */
  x: number;
  y: number;
}

export type PlayerAnim = 'idle' | 'walk' | 'search' | 'hold' | 'stun' | 'die' | 'hidden';

export interface HeldItem {
  kind: 'package' | 'powerup' | 'item';
  /** 'package', a PowerupKind, or the joke item name. */
  name: string;
}

export interface PlayerState {
  /** Top-left of the 16x16 sprite, room px (may be fractional; round when drawing). Hitbox is 12x12 inset by 2. */
  x: number;
  y: number;
  facing: Dir;
  anim: PlayerAnim;
  /** Frames spent in the current anim (walk cycle: use animT >> 3 & 1). */
  animT: number;
  /** True on frames the sprite must be HIDDEN (respawn/armour invulnerability blink). */
  blink: boolean;
  invuln: number;
  stun: number;
  /** Item held overhead while anim === 'hold'. */
  held: HeldItem | null;
  heldT: number;
}

export type GuardAnim = 'idle' | 'walk' | 'aim' | 'throw' | 'stun' | 'dead' | 'gone';

export interface GuardState {
  index: number;
  type: 'spy' | 'bot';
  x: number;
  y: number;
  facing: Dir;
  anim: GuardAnim;
  animT: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Frames left stunned (toys / trap smoke). */
  stunT: number;
  /** Frames of white flash after being hit. */
  hurtT: number;
  // ---- internal AI state (renderers ignore) ----
  startX: number;
  startY: number;
  axis: 'h' | 'v';
  dirSign: 1 | -1;
  moveTo: { x: number; y: number } | null;
  wait: number;
  aimT: number;
  aimDir: Dir;
  aimKind: 'bullet' | 'shoe';
  cooldown: number;
}

export type BulletKind = 'player' | 'spy' | 'shoe';
export interface BulletState {
  /** Centre of the bullet, room px. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  from: BulletKind;
  ttl: number;
}

export interface FixtureState {
  index: number;
  tx: number;
  ty: number;
  kind: 'fixture' | 'fixture2' | 'fitting';
  open: boolean;
  /** Radar: flashing '!' over an unopened package fixture. */
  mark: boolean;
  /** Content is only exposed once opened (null otherwise). */
  content: FixtureContent | null;
  /** Fitting room only: a spy was revealed from it (curtain open, real contents still unsearched). */
  revealed: boolean;
  revealT: number;
  /** Fitting room only: the 25% roll is used up after the first search. */
  rolled: boolean;
}

export interface ToyState {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  animT: number;
  ttl: number;
}

export interface ToyShelfState {
  tx: number;
  ty: number;
  released: boolean;
}

export interface PuffState {
  x: number;
  y: number;
  t: number;
  ttl: number;
  kind: 'smoke' | 'poof';
}

export interface ParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  ttl: number;
  kind: 'spark' | 'star';
}

export interface BubbleState {
  /** Guard index the bubble is attached to. */
  guard: number;
  text: string;
  t: number;
  ttl: number;
}

export interface BannerState {
  lines: string[];
  t: number;
  ttl: number;
  kind: 'info' | 'alarm' | 'pa' | 'item' | 'package' | 'floor';
}

export interface SearchState {
  fixture: number;
  t: number;
  dur: number;
  /** 0..1 */
  progress: number;
}

export interface StripState {
  /** Store name, always shown. */
  title: string;
  /** '' | 'PRESS X TO SEARCH' | 'SEARCHING...' */
  text: string;
  mode: 'none' | 'ready' | 'searching';
  /** 0..1 while searching, else null. */
  bar: number | null;
}

export type EggPhase = 'talk' | 'item' | 'get' | 'done';
export interface EggState {
  phase: EggPhase;
  clerk: { x: number; y: number; visible: boolean };
  /** Tile positions of the two flickering demo TVs. */
  tvs: { tx: number; ty: number }[];
  pedestal: { tx: number; ty: number };
  /** Typewriter box: lines typed so far (last line still typing). Shown while phase === 'talk'. */
  lines: string[];
  /** Item on the pedestal (name), visible from phase 'item' until picked up. */
  item: string | null;
  itemVisible: boolean;
  t: number;
}

export interface BoothState {
  tx: number;
  ty: number;
  active: boolean;
  /** 'NOW PLAYING: SIDE B' while standing on the booth, else null (persistent overlay for renderers). */
  nowPlaying: string | null;
}
