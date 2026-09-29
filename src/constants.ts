// Game constants

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 240;
export const HUD_HEIGHT = 16;
export const PLAYFIELD_HEIGHT = SCREEN_HEIGHT - HUD_HEIGHT;

export const MALL_WIDTH = 768;
export const FLOOR_HEIGHT = 48;

export const FRAME_RATE = 60;
export const FRAME_TIME_MS = 1000 / FRAME_RATE;

// Physics
export const GRAVITY = 0.5;
export const MAX_FALL_SPEED = 10;
export const JUMP_FORCE = 8;
export const JUMP_FORCE_BOOSTED = 10;
export const WALK_SPEED = 1;
export const WALK_SPEED_BOOSTED = 1.5;
export const BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;
export const SPY_WALK_SPEED = 1;

// Combat
export const MAX_PLAYER_BULLETS = 2;
export const MAX_PLAYER_BULLETS_RAPID = 4;
export const INVULNERABILITY_FRAMES = 120; // 2 seconds
export const SPY_FIRST_SHOT_DELAY = 120; // 2 seconds
export const SPY_SHOT_COOLDOWN = 150; // 2.5 seconds
export const SPY_SHOT_COOLDOWN_ALARM = 90; // Faster when alarm
export const SPY_DUCK_CHANCE = 0.1;

// Spawning
export const SPY_SPAWN_DELAY = 300; // every 5 seconds
export const SPY_SPAWN_DELAY_ALARM = 150; // every 2.5 seconds when alarm
export const MAX_SPIES_ON_SCREEN = 4;
export const MAX_SPIES_ON_SCREEN_ALARM = 6;
export const SPY_SPAWN_DISTANCE_MIN = 64;
export const SPY_SPAWN_DISTANCE_MAX = 200;

// Timings
export const ALARM_TRIGGER_FRAME = 9000; // ~150 seconds
export const ALARM_TRIGGER_FRAME_LOOP_REDUCTION = 1200; // Reduce by 20s per loop
export const DEATH_ANIMATION_FRAMES = 24; // ~0.4 seconds
export const LEVEL_CLEAR_SCREEN_FRAMES = 300; // ~5 seconds
export const SPLASH_AUTO_SKIP_FRAMES = 180; // ~3 seconds
export const SPLASH_FLICKER_INTERVAL = 3; // frames per flicker
export const CONTINUE_COUNTDOWN_FRAMES = 540; // ~9 seconds

// Scoring
export const POINTS_SPY_SHOT = 100;
export const POINTS_SPY_CRUSHED = 300;
export const POINTS_SPY_LAMP = 300;
export const POINTS_SPY_DISCO = 300;
export const POINTS_PACKAGE = 500;
export const POINTS_POWER_UP = 50;
export const POINTS_LEVEL_CLEAR = 1000;
export const POINTS_TIME_BONUS = 10; // per second under 300s
export const POINTS_COIN = 50;
export const POINTS_GOLD_COIN = 100; // bonus for extra life
export const POINTS_WALKER_HIT_PENALTY = 200;
export const POINTS_COP_CAUGHT_PENALTY = 500;
export const POINTS_JOKE_ITEM = 1;

// Lives
export const STARTING_LIVES = 3;
export const EXTRA_LIFE_SCORE_THRESHOLD = 20000;
export const STARTING_CONTINUES = 3;

// Difficulty scaling per loop
export const SPY_SPEED_INCREASE_PER_LOOP = 0.1; // 10%
export const SPY_SPAWN_RATE_INCREASE_PER_LOOP = 0.15; // 15%
export const SPY_SHOOT_RATE_INCREASE_PER_LOOP = 0.15; // 15%
export const ALARM_TRIGGER_REDUCTION_PER_LOOP = 1200; // 20 seconds earlier

// Power-up durations (in frames)
export const POWER_UP_DURATION_RAPIDFIRE = 1200; // 20 seconds
export const POWER_UP_DURATION_SPREAD = 1200;
export const POWER_UP_DURATION_SNEAKERS = 1200;
export const POWER_UP_DURATION_JULIOOZE = 720; // 12 seconds
export const POWER_UP_DURATION_ARMOR = 0; // Until hit
export const POWER_UP_DURATION_PRETZEL = 0; // Until hit
export const POWER_UP_DURATION_RADAR = Infinity; // Rest of level
export const POWER_UP_DURATION_1UP = 0; // Instant

// Collision detection
export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 24;
export const PLAYER_COLLISION_RADIUS = 12;
export const SPY_COLLISION_RADIUS = 12;
export const BULLET_COLLISION_RADIUS = 2;
export const SPY_VISION_DISTANCE = 160;

// Store system
export const STORE_ROOM_WIDTH = 16; // tiles
export const STORE_ROOM_HEIGHT = 11; // tiles
export const TILE_SIZE = 16;
export const SEARCH_DURATION_FRAMES = 45; // 0.75 seconds
export const GUARD_GRACE_PERIOD_FRAMES = 60; // 1 second after player enters

// Black Friday mode
export const BLACK_FRIDAY_SPY_CAP_MULTIPLIER = 2;
export const BLACK_FRIDAY_SPAWN_RATE_MULTIPLIER = 2;
export const BLACK_FRIDAY_POWER_UP_RATE = 1.0; // Every fixture has a power-up

// Misc
export const FLICKER_INTERVAL = 10; // frames for blinking effects
export const LERP_SMOOTHING = 0.1; // For display score/lives lerp
