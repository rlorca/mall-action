/**
 * Every timing in this file is in FRAMES at a fixed 60 Hz simulation rate.
 * Never store a duration in milliseconds in game state.
 */

export const FPS = 60;
/** Seconds -> frames. Use at module scope to keep the intent readable. */
export const sec = (s: number): number => Math.round(s * FPS);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const SCREEN_W = 256;
export const SCREEN_H = 240;
/** Top status strip. The playfield viewport is everything below it. */
export const HUD_H = 16;
export const VIEW_H = SCREEN_H - HUD_H; // 224

// ---------------------------------------------------------------------------
// Mall geometry
// ---------------------------------------------------------------------------

/** 3 screens wide. */
export const MALL_W = 768;
export const FLOOR_SPACING = 48;

/** Floor indices, top (roof) to bottom (parking). */
export const FLOOR_R = 0;
export const FLOOR_4F = 1;
export const FLOOR_3F = 2;
export const FLOOR_2F = 3;
export const FLOOR_1F = 4;
export const FLOOR_P = 5;
export const FLOOR_COUNT = 6;

export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'] as const;
export type FloorName = (typeof FLOOR_NAMES)[number];

/** Floor announcement banners shown when a car stops with the player inside. */
export const FLOOR_ANNOUNCE: readonly string[] = [
  'R - ROOFTOP, FRESH AIR, SPIES',
  '4F - FASHION & GADGETS, SPIES',
  '3F - TOYS & NOVELTY, SPIES',
  '2F - MUSIC & FOOD COURT, SPIES',
  '1F - SPORTS & BOOKS, SPIES',
  'P - PARKING, YOUR CAR, SPIES',
];

/** The Y of the surface an actor stands on for a given floor. */
export const floorY = (floor: number): number => 32 + floor * FLOOR_SPACING;

/** The total height of the mall in pixels, including a margin below P. */
export const MALL_H = floorY(FLOOR_P) + 32;

/** Walkable headroom on a floor: an actor's feet at floorY, 24px tall sprite. */
export const MALL_SPRITE_W = 16;
export const MALL_SPRITE_H = 24;
export const STORE_SPRITE_W = 16;
export const STORE_SPRITE_H = 16;

// ---------------------------------------------------------------------------
// Agent physics (mall view)
// ---------------------------------------------------------------------------

export const WALK_SPEED = 1; // px/frame
export const SNEAKER_WALK_SPEED = 2;
export const OJ_WALK_SPEED = 1.5;

/** Jump tuned so the apex is ~20px above the floor. */
export const JUMP_VELOCITY = -3.1;
export const GRAVITY = 0.24;
export const SNEAKER_JUMP_VELOCITY = -3.7;
export const MAX_FALL_SPEED = 6;

/** A fall of more than one floor kills. */
export const FATAL_FALL_PX = FLOOR_SPACING + 8;

export const BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;
export const MAX_PLAYER_BULLETS = 2;
export const MAX_PLAYER_BULLETS_RAPID = 4;
export const SHOOT_COOLDOWN = sec(0.25);
export const SHOOT_COOLDOWN_RAPID = sec(0.1);

export const DUCK_HEIGHT = 16;
/** Bullet Y offsets relative to the actor's feet. */
export const SHOT_Y_HIGH = -16;
export const SHOT_Y_LOW = -6;

export const RESPAWN_INVULN = sec(2);
export const DEATH_FREEZE = sec(1.2);

// ---------------------------------------------------------------------------
// Elevators
// ---------------------------------------------------------------------------

export const ELEVATOR_SPEED = 1; // px/frame
export const ELEVATOR_W = 32;
export const ELEVATOR_H = 40;
export const AUTO_CAR_WAIT = sec(2);
/** Standing still in an opening calls the car after this long. */
export const AUTO_CALL_DELAY = sec(0.5);

// ---------------------------------------------------------------------------
// Spies
// ---------------------------------------------------------------------------

export const SPY_SPEED = 0.5;
export const SPY_MAX_ON_SCREEN = 4;
export const SPY_FIRST_SPAWN = sec(5);
export const SPY_SIGHT_RANGE = 160;
export const SPY_STOP_DISTANCE = 40;
export const SPY_SPAWN_MIN_DIST = 64;
export const SPY_SPAWN_MAX_DIST = 200;
/** Clear telegraph before a spy fires. */
export const SPY_AIM_FRAMES = sec(0.5);
/** A spy that just appeared cannot fire before this. */
export const SPY_FIRST_SHOT_DELAY = sec(2);
export const SPY_SHOT_INTERVAL = sec(2.5);
export const SPY_SHOT_INTERVAL_MIN = sec(1);
export const SPY_DODGE_CHANCE = 0.1;
export const SPY_DEATH_FRAMES = sec(0.4);
/** A freshly spawned spy cannot kill by contact yet: no instant ambush. */
export const SPY_EMERGE_GRACE = sec(0.5);
export const SPY_DROP_CHANCE = 0.05;
export const SPY_LAST_WORDS_CHANCE = 0.35;

// ---------------------------------------------------------------------------
// Level pacing
// ---------------------------------------------------------------------------

export const ALARM_TIME = sec(150);
/** Each loop brings the alarm 20 s sooner, floored. */
export const ALARM_TIME_PER_LOOP = sec(20);
export const ALARM_TIME_MIN = sec(60);
export const ALARM_SPY_SPEED_MULT = 1.25;

export const LOOP_SPY_SPEED_MULT = 1.1;
export const LOOP_SPY_SPEED_CAP = 2.0;
export const LOOP_SPAWN_MULT = 1.15;
export const LOOP_SPAWN_CAP = 2.5;
export const LOOP_FIRE_MULT = 1.15;
export const LOOP_FIRE_CAP = 2.5;

export const PACKAGES_TOTAL = 6;
export const START_LIVES = 3;
export const CONTINUES_PER_GAME = 3;
export const CONTINUE_LIVES = 3;
export const EXTRA_LIFE_SCORE = 20000;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCORE_SPY = 100;
export const SCORE_SPY_CRUSHED = 300;
export const SCORE_PACKAGE = 500;
export const SCORE_POWERUP = 50;
export const SCORE_LEVEL_CLEAR = 1000;
export const SCORE_COIN = 50;
export const SCORE_WALKER_PENALTY = -200;
export const SCORE_COP_PENALTY = -500;
export const SCORE_JOKE_ITEM = 1;
/** 10 per second under 300 s. */
export const TIME_BONUS_LIMIT = sec(300);
export const TIME_BONUS_PER_SEC = 10;

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export const WET_PATCH_W = 48;
export const WET_PATCH_FRAMES = sec(10);
export const MOP_INTERVAL = sec(6);
export const COP_ALERT_RANGE = 128;
export const COP_CHASE_FRAMES = sec(10);
export const COP_FREEZE_FRAMES = sec(3);
export const KIOSK_COOLDOWN = sec(20);
export const KIOSK_SHOW_FRAMES = sec(3);
export const BOOTH_HIDE_FRAMES = sec(5);
export const FOUNTAIN_COOLDOWN = sec(15);
export const GOLD_COIN_CHANCE = 1 / 20;
export const LAMP_DARK_FRAMES = sec(2);
export const PA_INTERVAL = sec(60);

// ---------------------------------------------------------------------------
// Stores (top-down)
// ---------------------------------------------------------------------------

export const TILE = 16;
export const ROOM_W = 16; // tiles
export const ROOM_H = 11; // tiles
export const SEARCH_FRAMES = sec(0.75);
export const SEARCH_FRAMES_SNEAKERS = sec(0.5);
export const STORE_WALK_SPEED = 1;
export const STORE_SNEAKER_SPEED = 1.5;
export const GUARD_GRACE_FRAMES = sec(1);
export const TRAP_STUN_FRAMES = sec(1);
export const BANNER_FRAMES = sec(1.5);
export const BOT_HITS = 3;
export const FITTING_ROOM_SPY_CHANCE = 0.25;

// ---------------------------------------------------------------------------
// Power-ups
// ---------------------------------------------------------------------------

export const PU_WEAPON_FRAMES = sec(20);
export const PU_SNEAKER_FRAMES = sec(20);
export const PU_CINNABOMB_FRAMES = sec(6);
export const PU_OJ_FRAMES = sec(12);

// ---------------------------------------------------------------------------
// Screens & transitions
// ---------------------------------------------------------------------------

export const SPLASH_FLICKER_FRAMES = sec(1);
export const SPLASH_TOTAL_FRAMES = sec(3.2);
export const SELFIE_FRAMES = sec(2.5);
export const ZIPLINE_FRAMES = sec(2.2);
export const FADE_FRAMES = 20;
export const CONTINUE_SECONDS = 9;
export const TOAST_FRAMES = sec(1.5);
