import {
  GameScreen, FloorId, PowerUpType, Direction, FPS,
  MALL_W, SCREEN_W, SCREEN_H, FLOOR_H, TILE,
  POWER_UP_NAMES, TIMED_POWER_UP_DURATIONS,
} from '../engine/types';
import { Button, InputState } from '../engine/input';
import {
  GameState, GameEvent, PlayerState, SpyState, ElevatorState,
  BulletState, NpcState, LampState, CoinState, BannerState,
  StoreSpyState, StoreState, SpygramState, FountainState,
  getFloorY, getFloorFromY, createInitialPlayer,
} from './state';

// --- Constants ---
const GRAVITY = 0.5;
const TERMINAL_VY = 4;
const WALK_SPEED = 1;
const SPEED_BOOST = 1.5;
const JUMP_VY = -4.5;
const JUMP_VY_SNEAKERS = -5.5;
const BULLET_SPEED = 4;
const ENEMY_BULLET_SPEED = 2;
const MAX_PLAYER_BULLETS = 2;
const MAX_PLAYER_BULLETS_RAPID = 4;
const SHOOT_COOLDOWN = 10;
const SHOOT_COOLDOWN_RAPID = 5;
const INVULN_FRAMES = 120;
const DEATH_FRAMES = 60;
const SPY_MAX = 4;
const SPY_FIRST_SHOT_DELAY = 120;
const SPY_SHOOT_INTERVAL = 150;
const SPY_AIM_FRAMES = 30;
const SPY_DEATH_FRAMES = 24;
const SPY_VISION = 160;
const SPY_STOP_DIST = 40;
const SPY_SPAWN_MIN_DIST = 64;
const SPY_SPAWN_MAX_DIST = 200;
const SEARCH_FRAMES = 45;
const ALARM_BASE = 150 * FPS;
const PA_INTERVAL = 60 * FPS;
const EXTRA_LIFE_THRESHOLD = 20000;
const CINNABOMB_KILL_RANGE = 16;

const KONAMI_SEQ = [
  Button.Up, Button.Up, Button.Down, Button.Down,
  Button.Left, Button.Right, Button.Left, Button.Right,
  Button.B, Button.A,
];

const GAMESTONK_ITEMS = [
  'EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE',
  'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)',
];

// Elevator shaft X positions
const SHAFT_X: Record<string, number> = { A: 100, B: 400, C: 650 };

// Store door X positions (approximate, spread across 768px)
const STORE_POSITIONS: Record<string, { x: number; floor: FloorId }> = {
  forever12:       { x: 160, floor: FloorId.F4 },
  radioshock:      { x: 280, floor: FloorId.F4 },
  crookstone:      { x: 480, floor: FloorId.F4 },
  gamestonk:       { x: 600, floor: FloorId.F4 },
  kgb_toys:        { x: 160, floor: FloorId.F3 },
  blockbluster:    { x: 320, floor: FloorId.F3 },
  spenders_gifts:  { x: 560, floor: FloorId.F3 },
  sam_baddy:       { x: 160, floor: FloorId.F2 },
  sharper_imagine: { x: 320, floor: FloorId.F2 },
  hot_spy:         { x: 480, floor: FloorId.F2 },
  circuit_pity:    { x: 640, floor: FloorId.F2 },
  foot_lockpicker: { x: 200, floor: FloorId.F1 },
  borderline_books:{ x: 500, floor: FloorId.F1 },
};

// Kiosk positions
const KIOSK_POSITIONS = [
  { x: 700, floor: FloorId.F4 },
  { x: 700, floor: FloorId.F3 },
  { x: 700, floor: FloorId.F2 },
  { x: 700, floor: FloorId.F1 },
];

const PHOTO_BOOTH = { x: 450, floor: FloorId.F3 };
const GETAWAY_CAR = { x: 600, floor: FloorId.Parking };

// Escalator positions
const ESCALATOR_POSITIONS = [
  { x: 300, topFloor: FloorId.F4, bottomFloor: FloorId.F3 },
  { x: 500, topFloor: FloorId.F2, bottomFloor: FloorId.F1 },
];

// --- Helper: collision ---
function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function dist(x1: number, x2: number): number {
  return Math.abs(x1 - x2);
}

function anyPressed(input: InputState): boolean {
  return input.pressed.some(Boolean);
}

function addScore(state: GameState, pts: number, events: GameEvent[]): void {
  const oldScore = state.player.score;
  state.player.score += pts;
  if (state.player.score < 0) state.player.score = 0;
  if (state.player.score > state.player.highScore) {
    state.player.highScore = state.player.score;
  }
  if (Math.floor(oldScore / EXTRA_LIFE_THRESHOLD) < Math.floor(state.player.score / EXTRA_LIFE_THRESHOLD)) {
    state.player.lives++;
    events.push({ type: 'sfx_1up' });
    events.push({ type: 'banner', data: { text: '1-UP!', type: 'normal' } });
  }
}

function addScorePopup(state: GameState, x: number, y: number, text: string, floor: FloorId): void {
  state.scorePopups.push({ x, y, text, timer: 60, floor });
}

function emitBanner(state: GameState, events: GameEvent[], text: string, type: string = 'normal'): void {
  state.banners.push({ text, timer: 120, type: type as BannerState['type'] });
  events.push({ type: 'banner', data: { text, bannerType: type } });
}

function getPlayerSpeed(p: PlayerState): number {
  if (p.speedBoost !== null) return SPEED_BOOST;
  return WALK_SPEED;
}

function isStoreOpen(storeId: string, state: GameState): boolean {
  const closed = ['blockbluster', 'circuit_pity', 'borderline_books'];
  if (closed.includes(storeId)) return false;
  const ss = state.stores.get(storeId);
  if (ss && ss.cleared) return false;
  return true;
}

function isTargetStore(storeId: string): boolean {
  const targets = ['forever12', 'radioshock', 'kgb_toys', 'hot_spy', 'foot_lockpicker', 'sam_baddy'];
  return targets.includes(storeId);
}

function isPowerUpStore(storeId: string): boolean {
  const pups = ['crookstone', 'gamestonk', 'spenders_gifts', 'sharper_imagine'];
  return pups.includes(storeId);
}

function getElevatorAtFloor(state: GameState, floor: FloorId, shaftX: number): ElevatorState | undefined {
  const floorY = getFloorY(floor);
  return state.elevators.find(e => {
    const sx = SHAFT_X[e.shaft];
    return Math.abs(sx - shaftX) < 30 && Math.abs(e.y - floorY) < 2 && e.floorsServed.includes(floor);
  });
}

function getElevatorForShaft(state: GameState, shaft: string): ElevatorState | undefined {
  return state.elevators.find(e => e.shaft === shaft);
}

function floorYForElevator(elev: ElevatorState, floor: FloorId): number {
  return getFloorY(floor);
}

function nearestFloor(y: number, served: FloorId[]): FloorId {
  let best = served[0];
  let bestDist = Infinity;
  for (const f of served) {
    const fy = getFloorY(f);
    const d = Math.abs(y - fy);
    if (d < bestDist) { bestDist = d; best = f; }
  }
  return best;
}

function nextFloorInDir(elev: ElevatorState, dir: number): FloorId | null {
  const currentFloor = nearestFloor(elev.y, elev.floorsServed);
  const idx = elev.floorsServed.indexOf(currentFloor);
  if (dir < 0 && idx > 0) return elev.floorsServed[idx - 1];
  if (dir > 0 && idx < elev.floorsServed.length - 1) return elev.floorsServed[idx + 1];
  return null;
}

// --- Difficulty scaling ---
function getDifficultyMult(loop: number): number {
  return Math.min(1 + (loop - 1) * 0.1, 2.0);
}

function getSpySpeed(loop: number, alarm: boolean): number {
  let s = 0.7 * getDifficultyMult(loop);
  if (alarm) s *= 1.25;
  return Math.min(s, 2.0);
}

function getSpySpawnInterval(state: GameState): number {
  const base = state.rng.nextInt(120, 300);
  const scaled = Math.floor(base / (1 + (state.loop - 1) * 0.15));
  const result = Math.max(scaled, 60);
  if (state.alarmActive) return Math.floor(result * 0.7);
  return result;
}

function getSpyShootInterval(loop: number): number {
  const base = SPY_SHOOT_INTERVAL;
  const scaled = Math.floor(base / (1 + (loop - 1) * 0.15));
  return Math.max(scaled, 60);
}

// --- Initialization helpers ---
export function initStores(state: GameState): void {
  const targetIds = ['forever12', 'radioshock', 'kgb_toys', 'hot_spy', 'foot_lockpicker', 'sam_baddy'];

  for (const [id, pos] of Object.entries(STORE_POSITIONS)) {
    const isTarget = targetIds.includes(id);
    const closed = ['blockbluster', 'circuit_pity', 'borderline_books'].includes(id);
    const fixtureCount = isTarget ? 5 : (closed ? 0 : 4);

    const ss: StoreState = {
      id,
      entered: false,
      cleared: false,
      fixturesSearched: new Array(fixtureCount).fill(false),
      guardsAlive: new Array(isTarget ? 2 : (closed ? 0 : 1)).fill(true),
      firstVisitPlayed: false,
      packageIndex: isTarget ? state.rng.nextInt(0, fixtureCount - 1) : -1,
    };
    state.stores.set(id, ss);
  }
}

// ========================================
// MAIN UPDATE FUNCTION
// ========================================

export function updateGame(state: GameState, input: InputState): GameEvent[] {
  const events: GameEvent[] = [];
  state.events = events;
  state.frame++;

  // Update score popups
  state.scorePopups = state.scorePopups.filter(p => {
    p.timer--;
    p.y--;
    return p.timer > 0;
  });

  // Update banners
  state.banners = state.banners.filter(b => {
    b.timer--;
    return b.timer > 0;
  });

  switch (state.screen) {
    case GameScreen.Splash:
      updateSplash(state, input, events);
      break;
    case GameScreen.Title:
      updateTitle(state, input, events);
      break;
    case GameScreen.Arrival:
      updateArrival(state, input, events);
      break;
    case GameScreen.Mall:
      updateMall(state, input, events);
      break;
    case GameScreen.Store:
      updateStore(state, input, events);
      break;
    case GameScreen.Map:
      updateMap(state, input, events);
      break;
    case GameScreen.Pause:
      updatePause(state, input, events);
      break;
    case GameScreen.LevelClear:
      updateLevelClear(state, input, events);
      break;
    case GameScreen.Continue:
      updateContinue(state, input, events);
      break;
    case GameScreen.GameOver:
      updateGameOver(state, input, events);
      break;
  }

  return events;
}

// ========================================
// SPLASH SCREEN
// ========================================

function updateSplash(state: GameState, input: InputState, events: GameEvent[]): void {
  state.screenTimer++;

  if (state.screenTimer === 60) {
    events.push({ type: 'sfx_splash_jingle' });
  }

  if (anyPressed(input) || state.screenTimer >= 180) {
    state.screen = GameScreen.Title;
    state.screenTimer = 0;
    state.splashDone = true;
    events.push({ type: 'screen_change', data: GameScreen.Title });
    events.push({ type: 'play_music', data: 'title' });
  }
}

// ========================================
// TITLE SCREEN
// ========================================

function updateTitle(state: GameState, input: InputState, events: GameEvent[]): void {
  state.screenTimer++;

  if (state.screenTimer === 1) {
    events.push({ type: 'play_music', data: 'title' });
  }

  // Konami code detection
  if (!state.konamiActive) {
    for (let btn = 0; btn < 8; btn++) {
      if (!input.pressed[btn]) continue;

      const expected = KONAMI_SEQ[state.konamiProgress];
      if (btn === expected) {
        state.konamiProgress++;
        if (state.konamiProgress >= KONAMI_SEQ.length) {
          state.konamiActive = true;
          state.blackFriday = true;
          events.push({ type: 'konami_activated' });
          emitBanner(state, events, 'BLACK FRIDAY! 70% OFF EVERYTHING', 'alarm');
        }
      } else if (btn === Button.Up && state.konamiProgress <= 2) {
        // Extra leading Ups are OK — keep progress at least 1 if we already got one Up
        if (state.konamiProgress === 0) {
          state.konamiProgress = 1;
        }
        // else keep current progress (already have ↑ or ↑↑)
      } else {
        state.konamiProgress = 0;
      }
    }
  }

  if (input.pressed[Button.Start]) {
    state.screen = GameScreen.Arrival;
    state.screenTimer = 0;
    events.push({ type: 'screen_change', data: GameScreen.Arrival });
    events.push({ type: 'stop_music' });

    // Initialize stores on game start
    initStores(state);
  }
}

// ========================================
// ARRIVAL SCREEN
// ========================================

function updateArrival(state: GameState, input: InputState, events: GameEvent[]): void {
  state.screenTimer++;
  const t = state.screenTimer;

  // Phase 1: zipline (0-90)
  if (t <= 90) {
    state.player.x = 30 + (t / 90) * 70;
    state.player.y = getFloorY(FloorId.Roof) - 60 + (t / 90) * 60;
    if (t === 1) events.push({ type: 'sfx_zipline' });
  }
  // Phase 2: drop and crouch (91-120)
  else if (t <= 120) {
    state.player.x = 100;
    state.player.y = getFloorY(FloorId.Roof);
    if (t === 91) events.push({ type: 'sfx_land' });
  }
  // Phase 3: SPYGRAM selfie (121-270)
  else if (t <= 270) {
    if (t === 121) {
      events.push({ type: 'sfx_camera_flash' });
      // Pick random spygram
      const captions = [
        { caption: ['FEELING CUTE,', 'MIGHT DELETE LATER'], comment: 'MOM: SO PROUD OF U' },
        { caption: ['FIRST DAY ON THE JOB!', '#BLESSED'], comment: 'BOSS: DELETE THIS' },
        { caption: ['MALL RAT? NO.', 'MALL AGENT.'], comment: 'MOM: WEAR A JACKET' },
        { caption: ['ZIPLINE WAS $0.', 'PARKING WAS $12.'], comment: 'DAD: TOLD U SO' },
        { caption: ['OUTFIT OF THE DAY:', 'TRENCHCOAT, AGAIN'], comment: 'FOREVER12: 20% OFF!' },
        { caption: ['NO SPIES WERE HARMED', 'IN THIS SELFIE. YET.'], comment: 'DIMITRI: :(' },
        { caption: ['ROOFTOP VIBES', '#UNDERCOVER'], comment: 'HQ: WHY IS IT PUBLIC' },
        { caption: ["DON'T TELL HQ, I'M", 'HERE FOR PRETZELS'], comment: 'HQ: WE CAN SEE THIS' },
        { caption: ['GOLDEN HOUR.', 'LICENSE TO CHILL.'], comment: 'MOM: CALL YOUR MOTHER' },
        { caption: ['SECRET MISSION.', 'PLEASE LIKE & SHARE'], comment: 'HQ: ...SERIOUSLY?' },
      ];
      const post = state.rng.pick(captions);
      state.spygram = {
        caption: post.caption,
        comment: post.comment,
        likes: 0,
        timer: 150,
      };
    }

    if (state.spygram) {
      state.spygram.likes += state.rng.nextInt(2, 8);
      state.spygram.timer--;

      if (anyPressed(input)) {
        state.spygram.timer = 0;
      }

      if (state.spygram.timer <= 0) {
        state.spygram = null;
        // Jump to end
        state.screenTimer = 270;
      }
    }
  }

  if (t >= 270) {
    state.screen = GameScreen.Mall;
    state.screenTimer = 0;
    state.player.x = 100;
    state.player.y = getFloorY(FloorId.Roof);
    state.player.floor = FloorId.Roof;
    state.player.onGround = true;
    events.push({ type: 'screen_change', data: GameScreen.Mall });
    events.push({ type: 'play_music', data: 'mall' });
  }
}

// ========================================
// MALL (MAIN GAMEPLAY)
// ========================================

function updateMall(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;

  // Check for pause/map
  if (input.pressed[Button.Start] && !p.dead) {
    state.screen = GameScreen.Pause;
    events.push({ type: 'screen_change', data: GameScreen.Pause });
    events.push({ type: 'sfx_pause' });
    return;
  }
  if (input.pressed[Button.Select] && !p.dead) {
    state.screen = GameScreen.Map;
    events.push({ type: 'screen_change', data: GameScreen.Map });
    return;
  }

  // Skip updates if holding item overhead
  if (p.holdingItem) {
    p.holdingTimer--;
    if (p.holdingTimer <= 0) {
      p.holdingItem = null;
    }
    updateCamera(state);
    return;
  }

  // Skip if dead
  if (p.dead) {
    updatePlayerDeath(state, input, events);
    updateCamera(state);
    return;
  }

  // Skip if frozen
  if (p.frozen > 0) {
    p.frozen--;
    updateCamera(state);
    updateSpies(state, input, events);
    updateBullets(state, events);
    return;
  }

  // Skip if hidden (photo booth)
  if (p.hidden) {
    // handled in interaction section
  }

  state.levelTime++;

  // --- Player Movement ---
  if (!p.hidden) {
    updatePlayerMovement(state, input, events);
  }

  // --- Player Shooting ---
  if (!p.hidden) {
    updatePlayerShooting(state, input, events);
  }

  // --- Bullets ---
  updateBullets(state, events);

  // --- Spies ---
  updateSpySpawning(state, events);
  updateSpies(state, input, events);

  // --- Elevators ---
  updateElevators(state, input, events);

  // --- Escalators ---
  updateEscalators(state, input, events);

  // --- NPCs ---
  updateNPCs(state, input, events);

  // --- Lamps ---
  updateLamps(state, events);

  // --- Coins ---
  updateCoins(state, events);

  // --- Interactions ---
  updateInteractions(state, input, events);

  // --- Power-up timers ---
  updatePowerUpTimers(state, events);

  // --- Alarm ---
  updateAlarm(state, events);

  // --- PA ---
  updatePA(state, events);

  // --- Cinnabomb ---
  if (p.cinnabomb) {
    for (let i = state.spies.length - 1; i >= 0; i--) {
      const spy = state.spies[i];
      if (spy.state === 'dying') continue;
      if (spy.floor === p.floor && dist(spy.x, p.x) < CINNABOMB_KILL_RANGE) {
        killSpy(state, spy, events);
        addScore(state, 100, events);
        addScorePopup(state, spy.x, spy.y - 8, '+100', spy.floor);
      }
    }
  }

  // --- Screen shake ---
  if (state.screenShake > 0) state.screenShake--;

  // --- Fade ---
  if (state.fadeDir !== 0) {
    state.fadeAlpha += state.fadeDir * 0.05;
    if (state.fadeAlpha >= 1) { state.fadeAlpha = 1; state.fadeDir = 0; }
    if (state.fadeAlpha <= 0) { state.fadeAlpha = 0; state.fadeDir = 0; }
  }

  // --- Invulnerability ---
  if (p.invulnerable > 0) p.invulnerable--;

  // --- Camera ---
  updateCamera(state);
}

// --- Player Movement ---
function updatePlayerMovement(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;
  const speed = getPlayerSpeed(p);

  // Horizontal movement
  if (p.sliding) {
    // Sliding on wet floor — can't change direction
    p.x += (p.direction === Direction.Right ? 1 : -1) * speed;
    // Check if off the wet patch
    const onWet = isOnWetPatch(state, p.x, p.floor);
    if (!onWet) {
      p.sliding = false;
    }
    // Clamp to level
    p.x = Math.max(0, Math.min(MALL_W - 16, p.x));
  } else {
    if (input.held[Button.Left]) {
      p.x -= speed;
      p.direction = Direction.Left;
    }
    if (input.held[Button.Right]) {
      p.x += speed;
      p.direction = Direction.Right;
    }
    p.x = Math.max(0, Math.min(MALL_W - 16, p.x));
  }

  // Ducking
  p.ducking = input.held[Button.Down] && p.onGround && !p.jumping;

  // Jumping
  if (input.pressed[Button.B] && p.onGround && !p.ducking) {
    const jv = (p.speedBoost === PowerUpType.Sneakers) ? JUMP_VY_SNEAKERS : JUMP_VY;
    p.vy = jv;
    p.jumping = true;
    p.onGround = false;
    events.push({ type: 'sfx_jump' });
  }

  // Jump-kick
  p.jumpKicking = p.jumping && (input.held[Button.Left] || input.held[Button.Right]);

  // Gravity
  if (!p.onGround) {
    p.vy += GRAVITY;
    if (p.vy > TERMINAL_VY) p.vy = TERMINAL_VY;
    p.y += p.vy;

    // Ground detection
    const floorY = getFloorY(p.floor);
    if (p.y >= floorY) {
      // Check for fall distance
      const startFloorY = getFloorY(p.floor);
      const landFloor = getFloorFromY(p.y);

      if (landFloor > p.floor + 1) {
        // Fatal fall (more than one floor)
        // Check if landing on elevator roof
        const elevBelow = state.elevators.find(e => {
          const sx = SHAFT_X[e.shaft];
          return dist(p.x + 8, sx + 12) < 20 && Math.abs(e.y - p.y) < 8;
        });
        if (elevBelow) {
          // Land on elevator roof — safe
          p.y = elevBelow.y - 24;
          p.vy = 0;
          p.jumping = false;
          p.jumpKicking = false;
          p.onGround = true;
        } else {
          killPlayer(state, events, 'fall');
          return;
        }
      } else {
        p.y = floorY;
        p.vy = 0;
        p.jumping = false;
        p.jumpKicking = false;
        p.onGround = true;

        // Check wet floor on landing
        if (isOnWetPatch(state, p.x, p.floor)) {
          p.sliding = true;
          if (p.jumpKicking) {
            // Keep kicking while sliding
            p.jumpKicking = true;
          }
        }
      }
    }
  }

  // Check floor from y position
  p.floor = getFloorFromY(p.y);

  // Jump-kick kills spies on contact
  if (p.jumpKicking || (p.sliding && p.jumpKicking)) {
    for (let i = state.spies.length - 1; i >= 0; i--) {
      const spy = state.spies[i];
      if (spy.state === 'dying') continue;
      if (spy.floor === p.floor && rectsOverlap(p.x, p.y, 16, 24, spy.x, spy.y, 16, 24)) {
        killSpy(state, spy, events);
        addScore(state, 100, events);
        addScorePopup(state, spy.x, spy.y - 8, '+100', spy.floor);
        events.push({ type: 'sfx_hit' });
      }
    }
  }

  // Touch damage from spies (if not jump-kicking, not invulnerable, not cinnabomb)
  if (!p.invulnerable && !p.jumpKicking && !p.cinnabomb) {
    for (const spy of state.spies) {
      if (spy.state === 'dying') continue;
      if (spy.floor === p.floor && rectsOverlap(p.x, p.y, 16, 24, spy.x, spy.y, 16, 24)) {
        damagePlayer(state, events);
        break;
      }
    }
  }
}

// --- Player Shooting ---
function updatePlayerShooting(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;

  if (p.shootCooldown > 0) p.shootCooldown--;

  if (input.pressed[Button.A] && p.shootCooldown === 0) {
    const maxBullets = p.weapon === PowerUpType.RapidFire ? MAX_PLAYER_BULLETS_RAPID : MAX_PLAYER_BULLETS;
    const currentBullets = state.bullets.filter(b => b.isPlayer).length;

    if (currentBullets < maxBullets) {
      const bx = p.x + (p.direction === Direction.Right ? 16 : -4);
      const by = p.y + (p.ducking ? 16 : 8);
      const bvx = (p.direction === Direction.Right ? 1 : -1) * BULLET_SPEED;

      state.bullets.push({
        x: bx, y: by, vx: bvx, vy: 0,
        isPlayer: true, floor: p.floor, high: !p.ducking,
      });

      if (p.weapon === PowerUpType.SpreadShot) {
        // Two angled bullets
        const angle = 0.26; // ~15 degrees
        state.bullets.push({
          x: bx, y: by, vx: bvx, vy: bvx * Math.tan(angle),
          isPlayer: true, floor: p.floor, high: !p.ducking,
        });
        state.bullets.push({
          x: bx, y: by, vx: bvx, vy: bvx * Math.tan(-angle),
          isPlayer: true, floor: p.floor, high: !p.ducking,
        });
      }

      p.shootCooldown = p.weapon === PowerUpType.RapidFire ? SHOOT_COOLDOWN_RAPID : SHOOT_COOLDOWN;
      events.push({ type: 'sfx_shot' });
    }
  }
}

// --- Bullets ---
function updateBullets(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  const camX = state.camera.x;

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    // Off-screen removal
    if (b.x < camX - 16 || b.x > camX + SCREEN_W + 16 || b.y < -16 || b.y > 300) {
      state.bullets.splice(i, 1);
      continue;
    }

    if (b.isPlayer) {
      // Hit spy
      let hitSomething = false;
      for (let j = state.spies.length - 1; j >= 0; j--) {
        const spy = state.spies[j];
        if (spy.state === 'dying') continue;
        if (spy.floor !== b.floor) continue;

        // Duck check: 10% chance to duck an incoming bullet
        if (spy.state !== 'ducking' && state.rng.nextBool(0.1)) {
          spy.state = 'ducking';
          spy.stateTimer = 20;
          continue;
        }

        if (rectsOverlap(b.x, b.y, 4, 2, spy.x, spy.y, 16, 24)) {
          killSpy(state, spy, events);
          addScore(state, 100, events);
          addScorePopup(state, spy.x, spy.y - 8, '+100', spy.floor);
          state.bullets.splice(i, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Hit lamp
      for (const lamp of state.lamps) {
        if (!lamp.alive || lamp.falling) continue;
        if (lamp.floor !== b.floor) continue;
        if (b.high && dist(b.x, lamp.x) < 8) {
          lamp.falling = true;
          lamp.fallY = getFloorY(lamp.floor) - 30;
          if (lamp.isDisco) {
            lamp.rollingDir = b.vx > 0 ? 1 : -1;
          }
          state.bullets.splice(i, 1);
          events.push({ type: 'sfx_lamp_fall' });
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Hit fountain
      for (const fountain of state.fountains) {
        if (fountain.cooldown > 0) continue;
        if (fountain.floor !== b.floor) continue;
        if (rectsOverlap(b.x, b.y, 4, 2, fountain.x, getFloorY(fountain.floor), 16, 16)) {
          sprayCoins(state, fountain, events);
          state.bullets.splice(i, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Hit mall walker
      for (const npc of state.npcs) {
        if (npc.type !== 'mall_walker') continue;
        if (npc.floor !== b.floor) continue;
        if (rectsOverlap(b.x, b.y, 4, 2, npc.x, npc.y, 16, 24)) {
          addScore(state, -200, events);
          addScorePopup(state, npc.x, npc.y - 8, '-200', npc.floor);
          state.bullets.splice(i, 1);
          events.push({ type: 'speech_bubble', data: { x: npc.x, y: npc.y - 12, text: 'HEY!', floor: npc.floor } });
          events.push({ type: 'sfx_hey' });
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Hit mall cop
      for (const npc of state.npcs) {
        if (npc.type !== 'mall_cop') continue;
        if (npc.floor !== b.floor) continue;
        if (rectsOverlap(b.x, b.y, 4, 2, npc.x, npc.y, 16, 24)) {
          state.bullets.splice(i, 1);
          events.push({ type: 'sfx_helmet_ping' });
          // Check if cop is facing player and within range
          const copFacingPlayer = (npc.direction === Direction.Left && p.x < npc.x) ||
                                   (npc.direction === Direction.Right && p.x > npc.x);
          if (copFacingPlayer && dist(p.x, npc.x) < 128 && !npc.chasing) {
            npc.chasing = true;
            npc.chaseTimer = 600;
            npc.state = 'chasing';
            events.push({ type: 'sfx_whistle' });
            events.push({ type: 'speech_bubble', data: { x: npc.x, y: npc.y - 12, text: 'HEY! STOP RIGHT THERE!', floor: npc.floor } });
          }
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Janitor: bullets pass through (no check needed)

    } else {
      // Enemy bullet hits player
      if (p.invulnerable || p.dead || p.hidden) continue;
      if (b.floor !== p.floor) continue;

      // Check duck dodge
      if (p.ducking && b.high) continue;

      if (rectsOverlap(b.x, b.y, 4, 2, p.x, p.y, 16, 24)) {
        state.bullets.splice(i, 1);
        damagePlayer(state, events);
      }
    }
  }
}

// --- Spy Spawning ---
function updateSpySpawning(state: GameState, events: GameEvent[]): void {
  state.spySpawnTimer--;
  if (state.spySpawnTimer > 0) return;

  const maxSpies = state.blackFriday ? SPY_MAX * 2 : SPY_MAX;
  if (state.spies.length >= maxSpies) {
    state.spySpawnTimer = 30;
    return;
  }

  const p = state.player;
  // Find open store doors on player's floor or adjacent
  const candidates: { x: number; floor: FloorId }[] = [];
  for (const [id, pos] of Object.entries(STORE_POSITIONS)) {
    if (!isStoreOpen(id, state)) continue;
    const floorDiff = Math.abs(pos.floor - p.floor);
    if (floorDiff > 1) continue;
    const playerDist = dist(pos.x, p.x);
    if (playerDist >= SPY_SPAWN_MIN_DIST && playerDist <= SPY_SPAWN_MAX_DIST) {
      candidates.push(pos);
    }
  }

  if (candidates.length > 0) {
    const spawn = state.rng.pick(candidates);
    const spy: SpyState = {
      id: state.nextSpyId++,
      x: spawn.x,
      y: getFloorY(spawn.floor),
      floor: spawn.floor,
      direction: spawn.x < p.x ? Direction.Right : Direction.Left,
      state: 'walking',
      stateTimer: 0,
      shootTimer: 0,
      firstShotDelay: SPY_FIRST_SHOT_DELAY,
      health: 1,
      speed: getSpySpeed(state.loop, state.alarmActive),
      targetX: null,
      lastWords: null,
    };
    state.spies.push(spy);
    events.push({ type: 'spy_spawned', data: { id: spy.id, floor: spy.floor } });
    events.push({ type: 'sfx_door' });
  }

  state.spySpawnTimer = getSpySpawnInterval(state);
}

// --- Spy AI ---
function updateSpies(state: GameState, _input: InputState, events: GameEvent[]): void {
  const p = state.player;

  for (let i = state.spies.length - 1; i >= 0; i--) {
    const spy = state.spies[i];

    switch (spy.state) {
      case 'dying': {
        spy.stateTimer--;
        if (spy.stateTimer <= 0) {
          state.spies.splice(i, 1);
        }
        continue;
      }

      case 'ducking': {
        spy.stateTimer--;
        if (spy.stateTimer <= 0) {
          spy.state = 'walking';
        }
        continue;
      }

      case 'aiming': {
        spy.stateTimer--;
        if (spy.stateTimer <= 0) {
          // Fire
          const bvx = (spy.direction === Direction.Right ? 1 : -1) * ENEMY_BULLET_SPEED;
          const shootHigh = state.rng.nextBool(0.5);
          state.bullets.push({
            x: spy.x + (spy.direction === Direction.Right ? 16 : -4),
            y: spy.y + (shootHigh ? 6 : 14),
            vx: bvx, vy: 0,
            isPlayer: false, floor: spy.floor, high: shootHigh,
          });
          events.push({ type: 'sfx_enemy_shot' });
          spy.state = 'walking';
          spy.shootTimer = getSpyShootInterval(state.loop);
        }
        continue;
      }

      case 'waiting': {
        // Waiting at shaft opening
        spy.stateTimer--;
        if (spy.stateTimer <= 0) {
          spy.state = 'walking';
        }
        // Can still be crushed by elevator — handled in elevator update
        continue;
      }

      case 'walking':
      case 'idle':
      default: {
        // Decrement first shot delay
        if (spy.firstShotDelay > 0) spy.firstShotDelay--;

        // Can this spy see the player?
        const canSee = spy.floor === p.floor &&
          dist(spy.x, p.x) < SPY_VISION &&
          !p.hidden && !p.dead && !p.invulnerable;

        if (canSee) {
          // Face and approach player
          spy.direction = p.x < spy.x ? Direction.Left : Direction.Right;

          if (dist(spy.x, p.x) > SPY_STOP_DIST) {
            const moveDir = spy.direction === Direction.Right ? 1 : -1;
            const nextX = spy.x + moveDir * spy.speed;

            // Check for pits (shaft openings without car)
            if (!isShaftPit(state, nextX, spy.floor)) {
              spy.x = nextX;
            }
          }

          // Try to shoot
          spy.shootTimer--;
          if (spy.shootTimer <= 0 && spy.firstShotDelay <= 0) {
            spy.state = 'aiming';
            spy.stateTimer = SPY_AIM_FRAMES;
            spy.shootTimer = getSpyShootInterval(state.loop);
          }
        } else {
          // Wander
          spy.stateTimer++;
          if (spy.stateTimer > 60) {
            // Random direction change or move to shaft
            if (state.rng.nextBool(0.1)) {
              spy.direction = spy.direction === Direction.Right ? Direction.Left : Direction.Right;
            }
            if (state.rng.nextBool(0.05)) {
              // Go wait at a shaft opening
              spy.state = 'waiting';
              spy.stateTimer = state.rng.nextInt(60, 180);
              // Move toward nearest shaft
              const nearestShaft = Object.entries(SHAFT_X)
                .map(([k, v]) => ({ shaft: k, dist: dist(v, spy.x) }))
                .sort((a, b) => a.dist - b.dist)[0];
              spy.targetX = nearestShaft.dist < 100 ? SHAFT_X[nearestShaft.shaft] : null;
              continue;
            }
            spy.stateTimer = 0;
          }

          const moveDir = spy.direction === Direction.Right ? 1 : -1;
          const nextX = spy.x + moveDir * spy.speed * 0.5;
          if (!isShaftPit(state, nextX, spy.floor) && nextX > 0 && nextX < MALL_W - 16) {
            spy.x = nextX;
          } else {
            spy.direction = spy.direction === Direction.Right ? Direction.Left : Direction.Right;
          }
        }
        break;
      }
    }

    // Clamp spy position
    spy.x = Math.max(0, Math.min(MALL_W - 16, spy.x));
  }
}

function isShaftPit(state: GameState, x: number, floor: FloorId): boolean {
  for (const elev of state.elevators) {
    const sx = SHAFT_X[elev.shaft];
    if (!elev.floorsServed.includes(floor)) continue;
    if (dist(x + 8, sx + 12) < 16) {
      // Is the car above this floor? Then it's a grate. Below? It's a pit.
      const floorY = getFloorY(floor);
      if (elev.y > floorY + 4) {
        return true; // pit
      }
    }
  }
  return false;
}

// --- Elevators ---
function updateElevators(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;

  for (const elev of state.elevators) {
    const sx = SHAFT_X[elev.shaft];

    // Auto elevator (C)
    if (elev.shaft === 'C' && !elev.playerInside) {
      if (elev.calledTo !== null) {
        // Moving to called floor
        const targetY = elev.calledTo;
        if (Math.abs(elev.y - targetY) < 1) {
          elev.y = targetY;
          elev.moving = false;
          elev.doorsOpen = true;
          elev.calledTo = null;
          if (!elev.dingPlayed) {
            events.push({ type: 'sfx_elevator_ding' });
            elev.dingPlayed = true;
          }
        } else {
          elev.y += elev.y < targetY ? 1 : -1;
          elev.moving = true;
          elev.doorsOpen = false;
          elev.dingPlayed = false;
        }
      } else {
        elev.autoTimer--;
        if (elev.autoTimer <= 0) {
          // Pick random floor
          const otherFloors = elev.floorsServed.filter(f => Math.abs(getFloorY(f) - elev.y) > 4);
          if (otherFloors.length > 0) {
            const targetFloor = state.rng.pick(otherFloors);
            elev.calledTo = getFloorY(targetFloor);
          }
          elev.autoTimer = 120;
        }
      }
    }

    // Player interaction
    if (elev.playerInside) {
      // Move with player input
      if (input.held[Button.Up]) {
        const minY = getFloorY(elev.floorsServed[0]);
        if (elev.y > minY) {
          elev.y--;
          elev.moving = true;
          elev.doorsOpen = false;
          elev.direction = -1;
          elev.dingPlayed = false;
          p.y = elev.y;
          p.floor = getFloorFromY(p.y);
        }
      } else if (input.held[Button.Down]) {
        const maxY = getFloorY(elev.floorsServed[elev.floorsServed.length - 1]);
        if (elev.y < maxY) {
          elev.y++;
          elev.moving = true;
          elev.doorsOpen = false;
          elev.direction = 1;
          elev.dingPlayed = false;
          p.y = elev.y;
          p.floor = getFloorFromY(p.y);
        }
      } else if (elev.moving) {
        // Glide to next floor — set target once when glide begins
        if (elev.targetY === null) {
          const nextF = nextFloorInDir(elev, elev.direction);
          if (nextF !== null) {
            elev.targetY = getFloorY(nextF);
          } else {
            elev.moving = false;
            elev.doorsOpen = true;
            const nearF = nearestFloor(elev.y, elev.floorsServed);
            elev.y = getFloorY(nearF);
            p.y = elev.y;
            p.floor = nearF;
          }
        }
        if (elev.targetY !== null) {
          if (Math.abs(elev.y - elev.targetY) < 1) {
            elev.y = elev.targetY;
            elev.moving = false;
            elev.doorsOpen = true;
            const arrivedFloor = nearestFloor(elev.y, elev.floorsServed);
            p.y = elev.y;
            p.floor = arrivedFloor;
            elev.targetY = null;
            if (!elev.dingPlayed) {
              events.push({ type: 'sfx_elevator_ding' });
              elev.dingPlayed = true;
              const floorName = ['R', '4F', '3F', '2F', '1F', 'P'][arrivedFloor];
              emitBanner(state, events, floorName, 'floor');
            }
          } else {
            elev.y += elev.direction;
            p.y = elev.y;
            p.floor = getFloorFromY(p.y);
          }
        }
      }

      // Exit elevator
      if (elev.doorsOpen && (input.pressed[Button.Left] || input.pressed[Button.Right])) {
        elev.playerInside = false;
        p.x = sx + (input.pressed[Button.Right] ? 28 : -16);
        events.push({ type: 'play_music', data: state.alarmActive ? 'alarm' : 'mall' });
      }

      // Play elevator music
      if (elev.playerInside && elev.moving) {
        // Emit hum continuously is handled by renderer checking state
      }
    } else {
      // Player entering elevator
      if (elev.doorsOpen && !p.dead && !p.jumping) {
        const playerNearShaft = dist(p.x + 8, sx + 12) < 20 && p.floor === nearestFloor(elev.y, elev.floorsServed) && Math.abs(elev.y - getFloorY(p.floor)) < 4;
        if (playerNearShaft && (input.pressed[Button.Up] || input.pressed[Button.Down])) {
          elev.playerInside = true;
          p.x = sx + 4;
          events.push({ type: 'play_music', data: 'elevator' });
        }
      }

      // Call elevator (player near empty shaft opening)
      if (!p.dead && !p.jumping && elev.calledTo === null && !elev.moving) {
        for (const floor of elev.floorsServed) {
          if (p.floor !== floor) continue;
          const floorY = getFloorY(floor);
          if (Math.abs(elev.y - floorY) < 4) continue; // Already here
          if (dist(p.x + 8, sx + 12) < 24) {
            if (input.pressed[Button.Up] || input.pressed[Button.Down]) {
              elev.calledTo = floorY;
              elev.dingPlayed = false;
            }
          }
        }
      }

      // Move called elevator
      if (elev.calledTo !== null && !elev.playerInside) {
        const targetY = elev.calledTo;
        if (Math.abs(elev.y - targetY) < 1) {
          elev.y = targetY;
          elev.moving = false;
          elev.doorsOpen = true;
          elev.calledTo = null;
          if (!elev.dingPlayed) {
            events.push({ type: 'sfx_elevator_ding' });
            elev.dingPlayed = true;
          }
        } else {
          const dir = elev.y < targetY ? 1 : -1;
          elev.y += dir;
          elev.moving = true;
          elev.doorsOpen = false;
          elev.dingPlayed = false;

          // Crush check for spies on grate
          for (let si = state.spies.length - 1; si >= 0; si--) {
            const spy = state.spies[si];
            if (spy.state === 'dying') continue;
            const spyOnGrate = spy.floor === getFloorFromY(elev.y) && dist(spy.x + 8, sx + 12) < 16;
            if (spyOnGrate && dir > 0) {
              killSpy(state, spy, events);
              addScore(state, 300, events);
              addScorePopup(state, spy.x, spy.y - 8, '+300', spy.floor);
              events.push({ type: 'sfx_crush' });
              state.screenShake = 8;
            }
          }

          // Crush check for player on grate (only if not called by player)
          if (!p.dead && !p.invulnerable && dir > 0) {
            const playerOnGrate = p.floor === getFloorFromY(elev.y) && dist(p.x + 8, sx + 12) < 16;
            // Don't crush the player who called it
            if (playerOnGrate && Math.abs(getFloorY(p.floor) - elev.calledTo!) > 4) {
              killPlayer(state, events, 'crush');
            }
          }
        }
      }
    }
  }
}

// --- Escalators ---
function updateEscalators(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;
  if (p.dead || p.jumping) return;

  for (const esc of ESCALATOR_POSITIONS) {
    // At bottom, pressing Up
    if (p.floor === esc.bottomFloor && dist(p.x + 8, esc.x) < 16) {
      if (input.held[Button.Up]) {
        p.y -= 1;
        if (p.y <= getFloorY(esc.topFloor)) {
          p.y = getFloorY(esc.topFloor);
          p.floor = esc.topFloor;
        }
      }
    }
    // At top, pressing Down
    if (p.floor === esc.topFloor && dist(p.x + 8, esc.x) < 16) {
      if (input.held[Button.Down]) {
        p.y += 1;
        if (p.y >= getFloorY(esc.bottomFloor)) {
          p.y = getFloorY(esc.bottomFloor);
          p.floor = esc.bottomFloor;
        }
      }
    }
  }
}

// --- NPCs ---
function updateNPCs(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;

  for (const npc of state.npcs) {
    switch (npc.type) {
      case 'janitor': {
        npc.stateTimer++;
        if (npc.state === 'walking') {
          const moveDir = npc.direction === Direction.Right ? 1 : -1;
          npc.x += moveDir * 0.5;
          // Turn around at edges
          if (npc.x < 50 || npc.x > 700) {
            npc.direction = npc.direction === Direction.Right ? Direction.Left : Direction.Right;
          }
          // Mop periodically
          if (npc.stateTimer > 600) {
            npc.state = 'mopping';
            npc.stateTimer = 0;
          }
        } else if (npc.state === 'mopping') {
          if (npc.stateTimer > 30) {
            // Create wet patch (check it's not near a shaft opening)
            let nearShaft = false;
            for (const [, sx] of Object.entries(SHAFT_X)) {
              if (dist(npc.x, sx) < 60) nearShaft = true;
            }
            if (!nearShaft && npc.wetPatches) {
              npc.wetPatches.push({ x: npc.x, timer: 600 });
            }
            npc.state = 'walking';
            npc.stateTimer = 0;
          }
        }

        // Update wet patches
        if (npc.wetPatches) {
          for (let wi = npc.wetPatches.length - 1; wi >= 0; wi--) {
            npc.wetPatches[wi].timer--;
            if (npc.wetPatches[wi].timer <= 0) {
              npc.wetPatches.splice(wi, 1);
            }
          }
        }
        break;
      }

      case 'mall_walker': {
        // Walk set stretches on 2F
        const moveDir = npc.direction === Direction.Right ? 1 : -1;
        npc.x += moveDir * 0.8;
        if (npc.x < 100 || npc.x > 650) {
          npc.direction = npc.direction === Direction.Right ? Direction.Left : Direction.Right;
        }
        // Push player on contact
        if (npc.floor === p.floor && rectsOverlap(p.x, p.y, 16, 24, npc.x, npc.y, 16, 24)) {
          p.x += moveDir * 0.5;
        }
        break;
      }

      case 'mall_cop': {
        if (npc.chasing) {
          npc.chaseTimer!--;
          if (npc.chaseTimer! <= 0) {
            npc.chasing = false;
            npc.state = 'patrolling';
            break;
          }
          // Chase player
          npc.direction = p.x < npc.x ? Direction.Left : Direction.Right;
          const moveDir = npc.direction === Direction.Right ? 1 : -1;
          npc.x += moveDir * 1.5;

          // Catch player
          if (npc.floor === p.floor && rectsOverlap(p.x, p.y, 16, 24, npc.x, npc.y, 16, 24) && !p.frozen && !p.dead) {
            p.frozen = 3 * FPS;
            addScore(state, -500, events);
            addScorePopup(state, p.x, p.y - 8, '-500', p.floor);
            events.push({ type: 'speech_bubble', data: { x: p.x, y: p.y - 12, text: 'DETAINED! -500', floor: p.floor } });
            npc.chasing = false;
            npc.state = 'patrolling';
          }
        } else {
          // Patrol
          const moveDir = npc.direction === Direction.Right ? 1 : -1;
          npc.x += moveDir * 0.6;
          if (npc.x < 50 || npc.x > 700) {
            npc.direction = npc.direction === Direction.Right ? Direction.Left : Direction.Right;
          }
        }
        break;
      }
    }
  }
}

function isOnWetPatch(state: GameState, x: number, floor: FloorId): boolean {
  if (floor !== FloorId.F1) return false;
  for (const npc of state.npcs) {
    if (npc.type !== 'janitor' || !npc.wetPatches) continue;
    for (const wp of npc.wetPatches) {
      if (Math.abs(x - wp.x) < 24) return true;
    }
  }
  return false;
}

// --- Lamps ---
function updateLamps(state: GameState, events: GameEvent[]): void {
  for (const lamp of state.lamps) {
    if (!lamp.alive) {
      if (lamp.darkTimer > 0) lamp.darkTimer--;
      continue;
    }
    if (!lamp.falling) continue;

    if (lamp.isDisco) {
      // Disco ball: drop then roll
      if (lamp.fallY < getFloorY(lamp.floor)) {
        lamp.fallY += 3;
      } else {
        // Rolling
        lamp.rollingX += lamp.rollingDir * 2;
        const rollWorldX = lamp.x + lamp.rollingX;

        // Kill spies in path
        for (let i = state.spies.length - 1; i >= 0; i--) {
          const spy = state.spies[i];
          if (spy.state === 'dying' || spy.floor !== lamp.floor) continue;
          if (rectsOverlap(rollWorldX - 4, getFloorY(lamp.floor), 8, 8, spy.x, spy.y, 16, 24)) {
            killSpy(state, spy, events);
            addScore(state, 300, events);
            addScorePopup(state, spy.x, spy.y - 8, '+300', spy.floor);
          }
        }

        // Kill player if in path
        const p = state.player;
        if (!p.dead && !p.invulnerable && p.floor === lamp.floor) {
          if (rectsOverlap(rollWorldX - 4, getFloorY(lamp.floor), 8, 8, p.x, p.y, 16, 24)) {
            killPlayer(state, events, 'disco');
          }
        }

        // Stop at wall or edge
        if (rollWorldX < 0 || rollWorldX > MALL_W || Math.abs(lamp.rollingX) > 200) {
          lamp.alive = false;
          lamp.darkTimer = 120;
          events.push({ type: 'sfx_glass' });
          state.screenShake = 6;
        }
      }
    } else {
      // Regular lamp: fall straight down
      lamp.fallY += 3;
      if (lamp.fallY >= getFloorY(lamp.floor)) {
        // Hit ground — kill anything underneath
        for (let i = state.spies.length - 1; i >= 0; i--) {
          const spy = state.spies[i];
          if (spy.state === 'dying' || spy.floor !== lamp.floor) continue;
          if (dist(spy.x + 8, lamp.x) < 12) {
            killSpy(state, spy, events);
            addScore(state, 300, events);
            addScorePopup(state, spy.x, spy.y - 8, '+300', spy.floor);
          }
        }

        const p = state.player;
        if (!p.dead && !p.invulnerable && p.floor === lamp.floor && dist(p.x + 8, lamp.x) < 12) {
          killPlayer(state, events, 'lamp');
        }

        lamp.alive = false;
        lamp.darkTimer = 120;
        events.push({ type: 'sfx_glass' });
        state.screenShake = 6;
      }
    }
  }
}

// --- Coins ---
function updateCoins(state: GameState, events: GameEvent[]): void {
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const coin = state.coins[i];
    coin.x += coin.vx;
    coin.y += coin.vy;
    coin.vy += 0.3;
    coin.timer--;

    // Bounce on ground
    const floorY = getFloorY(coin.floor);
    if (coin.y >= floorY) {
      coin.y = floorY;
      coin.vy = -coin.vy * 0.5;
      if (Math.abs(coin.vy) < 0.5) coin.vy = 0;
    }

    // Player collects
    const p = state.player;
    if (p.floor === coin.floor && rectsOverlap(p.x, p.y, 16, 24, coin.x, coin.y, 8, 8)) {
      if (coin.isGold) {
        p.lives++;
        events.push({ type: 'sfx_1up' });
        addScorePopup(state, coin.x, coin.y - 8, '1-UP!', coin.floor);
      } else {
        addScore(state, coin.value, events);
        addScorePopup(state, coin.x, coin.y - 8, '+' + coin.value, coin.floor);
      }
      events.push({ type: 'sfx_coins' });
      state.coins.splice(i, 1);
      continue;
    }

    if (coin.timer <= 0) {
      state.coins.splice(i, 1);
    }
  }
}

function sprayCoins(state: GameState, fountain: FountainState, events: GameEvent[]): void {
  const count = state.rng.nextInt(3, 5);
  const isGoldSpray = state.rng.nextBool(0.05);

  for (let c = 0; c < count; c++) {
    const isGold = isGoldSpray && c === 0;
    state.coins.push({
      x: fountain.x + 8,
      y: getFloorY(fountain.floor) - 16,
      vx: state.rng.next() * 4 - 2,
      vy: -(state.rng.next() * 3 + 2),
      floor: fountain.floor,
      value: 50,
      timer: 300,
      isGold,
    });
  }

  fountain.cooldown = 900;
  events.push({ type: 'sfx_coins' });
  events.push({ type: 'sfx_fountain' });
}

// --- Interactions ---
function updateInteractions(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;
  if (p.dead || p.jumping) return;

  // Photo booth hiding
  if (p.hidden) {
    p.holdingTimer--;
    if (p.holdingTimer <= 0) {
      p.hidden = false;
      if (!state.photoBoothUsed) {
        state.photoBoothUsed = true;
        state.photoStrip.collected = true;
        state.inventory.push('PHOTO STRIP');
        emitBanner(state, events, 'PHOTO STRIP!', 'normal');
        events.push({ type: 'photo_strip' });
      }
    }
    return;
  }

  if (!input.pressed[Button.Up]) return;

  // Store doors
  for (const [id, pos] of Object.entries(STORE_POSITIONS)) {
    if (!isStoreOpen(id, state)) continue;
    if (p.floor === pos.floor && dist(p.x + 8, pos.x + 8) < 16) {
      // Enter store
      state.currentStore = id;
      state.fadeDir = 1;
      events.push({ type: 'fade_out' });
      events.push({ type: 'sfx_door' });

      // Initialize store state if needed
      const ss = state.stores.get(id)!;
      ss.entered = true;

      // Set player store position
      p.storeX = 128;
      p.storeY = 160;
      p.storeDir = Direction.Up;

      // Spawn store guards (respawn if package still inside)
      state.storeSpies = [];
      if (!ss.cleared) {
        const guardCount = isTargetStore(id) ? 2 : 1;
        for (let g = 0; g < guardCount; g++) {
          if (!ss.guardsAlive[g]) continue;
          state.storeSpies.push({
            id: state.nextSpyId++,
            x: 32 + g * 64,
            y: 32 + g * 32,
            direction: Direction.Down,
            state: ss.firstVisitPlayed ? 'walking' : 'frozen',
            stateTimer: ss.firstVisitPlayed ? 0 : 120,
            health: id === 'radioshock' || id === 'sharper_imagine' ? 3 : 1,
            isBot: (id === 'radioshock' || id === 'sharper_imagine') && g === guardCount - 1,
            patrolDir: 1,
          });
        }
      }

      state.storeBullets = [];

      // Schedule transition to store screen
      setTimeout_pure(state, () => {
        state.screen = GameScreen.Store;
        state.fadeDir = -1;
      });

      events.push({ type: 'screen_change', data: GameScreen.Store });
      events.push({ type: 'play_music', data: 'store_' + id });
      return;
    }
  }

  // Kiosk
  for (const kiosk of KIOSK_POSITIONS) {
    if (p.floor === kiosk.floor && dist(p.x + 8, kiosk.x + 8) < 16) {
      if (state.kiosk.cooldown <= 0) {
        // Find nearest remaining package store
        let nearest: string | null = null;
        let nearestDist = Infinity;
        for (const [id] of Object.entries(STORE_POSITIONS)) {
          if (!isTargetStore(id)) continue;
          const ss = state.stores.get(id);
          if (ss && ss.cleared) continue;
          const pos = STORE_POSITIONS[id];
          const d = Math.abs(pos.x - p.x) + Math.abs(getFloorY(pos.floor) - p.y);
          if (d < nearestDist) { nearestDist = d; nearest = id; }
        }
        state.kiosk.active = true;
        state.kiosk.targetStore = nearest;
        state.kiosk.cooldown = 1200;
        events.push({ type: 'kiosk_used', data: nearest });
      }
      return;
    }
  }

  // Photo booth
  if (p.floor === PHOTO_BOOTH.floor && dist(p.x + 8, PHOTO_BOOTH.x + 8) < 16) {
    p.hidden = true;
    p.holdingTimer = 300;
    events.push({ type: 'sfx_door' });
    return;
  }

  // Getaway car
  if (p.floor === FloorId.Parking && dist(p.x + 8, GETAWAY_CAR.x + 24) < 24) {
    if (state.packagesCollected >= state.totalPackages) {
      if (!state.levelClearFired) {
        state.levelClearFired = true;
        state.screen = GameScreen.LevelClear;
        state.screenTimer = 0;
        state.levelClearPhase = 0;
        events.push({ type: 'screen_change', data: GameScreen.LevelClear });
        events.push({ type: 'play_music', data: 'level_clear' });
      }
    } else {
      const remaining = state.totalPackages - state.packagesCollected;
      emitBanner(state, events, `PACKAGES LEFT: ${remaining}`, 'normal');
      events.push({ type: 'sfx_buzzer' });
    }
    return;
  }

  // Elevator entry handled in updateElevators
}

// "setTimeout" for pure simulation — just sets state immediately since fade handles delay
function setTimeout_pure(state: GameState, fn: () => void): void {
  // In the pure simulation, transitions happen after fade completes
  // For simplicity, apply immediately — the fade is visual only
  fn();
}

// --- Power-up Timers ---
function updatePowerUpTimers(state: GameState, events: GameEvent[]): void {
  const p = state.player;

  if (p.weaponTimer > 0) {
    p.weaponTimer--;
    if (p.weaponTimer <= 0) {
      p.weapon = null;
      events.push({ type: 'powerup_expired', data: 'weapon' });
    }
  }

  if (p.speedTimer > 0) {
    p.speedTimer--;
    if (p.speedTimer <= 0) {
      p.speedBoost = null;
      events.push({ type: 'powerup_expired', data: 'speed' });
    }
  }

  if (p.cinnabombTimer > 0) {
    p.cinnabombTimer--;
    if (p.cinnabombTimer <= 0) {
      p.cinnabomb = false;
      events.push({ type: 'powerup_expired', data: 'cinnabomb' });
    }
  }

  // Fountain cooldowns
  for (const f of state.fountains) {
    if (f.cooldown > 0) f.cooldown--;
  }

  // Kiosk cooldown
  if (state.kiosk.cooldown > 0) {
    state.kiosk.cooldown--;
    if (state.kiosk.cooldown <= 0) {
      state.kiosk.active = false;
    }
  }
}

// --- Alarm ---
function updateAlarm(state: GameState, events: GameEvent[]): void {
  if (state.alarmActive) return;

  state.alarmTimer--;
  const alarmTime = ALARM_BASE - (state.loop - 1) * 20 * FPS;
  if (state.levelTime >= Math.max(alarmTime, 60 * FPS)) {
    state.alarmActive = true;
    events.push({ type: 'alarm' });
    events.push({ type: 'play_music', data: 'alarm' });
    emitBanner(state, events, 'ALARM! SECURITY ALERTED', 'alarm');
  }
}

// --- PA ---
function updatePA(state: GameState, events: GameEvent[]): void {
  state.paTimer--;
  if (state.paTimer > 0) return;

  const paLines = [
    ['ATTENTION SHOPPERS:', 'CLEANUP ON 3F. AGAIN.'],
    ['FREE SAMPLES AT HOT SPY.', 'NOT POISONED. PROBABLY.'],
    ["WILL THE OWNER OF A", "BLACK VAN MARKED 'NOT", "SPIES' PLEASE MOVE IT."],
    ['LOST CHILD AT THE 2F', "KIOSK. SAYS HIS NAME", 'IS AGENT 7.'],
    ['BLOCKBLUSTER IS STILL', 'CLOSED. BE KIND, REWIND.'],
    ['THE MALL CLOSES AT 9.', 'SPIES CLOSE AT NEVER.'],
    ['A REMINDER: SECURITY IS', 'WATCHING. MOSTLY TV.'],
  ];

  let idx: number;
  do {
    idx = state.rng.nextInt(0, paLines.length - 1);
  } while (idx === state.paLastIndex);

  state.paLastIndex = idx;
  const lines = paLines[idx];
  emitBanner(state, events, lines.join(' '), 'pa');
  events.push({ type: 'sfx_pa_chime' });

  state.paTimer = PA_INTERVAL;
}

// --- Camera ---
function updateCamera(state: GameState): void {
  const p = state.player;
  const targetX = p.x - SCREEN_W / 2 + 8;
  const targetY = p.y - SCREEN_H / 2 + 12;

  state.camera.x += (targetX - state.camera.x) * 0.1;
  state.camera.y += (targetY - state.camera.y) * 0.1;

  state.camera.x = Math.max(0, Math.min(MALL_W - SCREEN_W, state.camera.x));
  state.camera.y = Math.max(0, Math.min(getFloorY(FloorId.Parking) + FLOOR_H - SCREEN_H, state.camera.y));
}

// --- Damage / Death ---
function damagePlayer(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  if (p.invulnerable || p.dead || p.cinnabomb) return;

  if (p.hasArmor) {
    p.hasArmor = false;
    p.invulnerable = 30;
    events.push({ type: 'sfx_hurt' });
    events.push({ type: 'armor_break' });
    return;
  }

  killPlayer(state, events, 'bullet');
}

function killPlayer(state: GameState, events: GameEvent[], cause: string): void {
  const p = state.player;
  if (p.dead || p.invulnerable || p.cinnabomb) return;

  p.dead = true;
  p.deathTimer = DEATH_FRAMES;
  p.lives--;
  events.push({ type: 'player_died', data: cause });
  events.push({ type: 'sfx_death' });
}

function updatePlayerDeath(state: GameState, _input: InputState, events: GameEvent[]): void {
  const p = state.player;
  p.deathTimer--;

  if (p.deathTimer <= 0) {
    if (p.lives <= 0) {
      if (p.continues > 0) {
        state.screen = GameScreen.Continue;
        state.screenTimer = 0;
        state.continueCountdown = 9 * FPS;
        events.push({ type: 'screen_change', data: GameScreen.Continue });
      } else {
        state.screen = GameScreen.GameOver;
        state.screenTimer = 0;
        state.gameOverTimer = 0;
        events.push({ type: 'screen_change', data: GameScreen.GameOver });
      }
    } else {
      // Respawn
      respawnPlayer(state, events);
    }
  }
}

function respawnPlayer(state: GameState, events: GameEvent[]): void {
  const p = state.player;
  p.dead = false;
  p.invulnerable = INVULN_FRAMES;
  p.y = getFloorY(p.floor);
  p.vy = 0;
  p.jumping = false;
  p.jumpKicking = false;
  p.onGround = true;
  p.ducking = false;
  p.sliding = false;
  p.frozen = 0;

  // Clear temp power-ups (keep Radar)
  p.weapon = null;
  p.weaponTimer = 0;
  p.speedBoost = null;
  p.speedTimer = 0;
  p.cinnabomb = false;
  p.cinnabombTimer = 0;
  p.hasArmor = false;

  // Clear spies and bullets
  state.spies = [];
  state.bullets = [];
  state.spySpawnTimer = 5 * FPS;

  events.push({ type: 'player_respawned' });
}

function killSpy(state: GameState, spy: SpyState, events: GameEvent[]): void {
  spy.state = 'dying';
  spy.stateTimer = SPY_DEATH_FRAMES;
  events.push({ type: 'spy_killed', data: { id: spy.id } });

  // Last words (35%)
  if (state.rng.nextBool(0.35)) {
    const words = [
      'I WAS JUST BROWSING!',
      "WHAT'S YOUR RETURN POLICY?!",
      'I HAD A COUPON!',
      'TELL MY CAT...',
      'NOT THE FACE!',
      'I WAS ON MY LUNCH BREAK!',
      'WORTH IT. 70% OFF.',
      'MY RECEIPT...',
    ];
    spy.lastWords = state.rng.pick(words);
    events.push({ type: 'speech_bubble', data: { x: spy.x, y: spy.y - 12, text: spy.lastWords, floor: spy.floor } });
  }

  // Drop power-up (5%)
  if (state.rng.nextBool(0.05)) {
    const isFood = state.rng.nextBool(0.5);
    let pType: PowerUpType;
    if (isFood) {
      pType = state.rng.pick([PowerUpType.Cinnabomb, PowerUpType.OrangeJuliOoze, PowerUpType.SoftPretzel]);
    } else {
      pType = state.rng.pick([PowerUpType.RapidFire, PowerUpType.SpreadShot, PowerUpType.ArmorVest, PowerUpType.Sneakers]);
    }
    events.push({ type: 'powerup_dropped', data: { x: spy.x, y: spy.y, floor: spy.floor, type: pType } });
  }
}

// ========================================
// STORE (TOP-DOWN)
// ========================================

function updateStore(state: GameState, input: InputState, events: GameEvent[]): void {
  const p = state.player;
  const storeId = state.currentStore!;
  const ss = state.stores.get(storeId)!;

  // Check for pause/map
  if (input.pressed[Button.Start]) {
    state.screen = GameScreen.Pause;
    events.push({ type: 'screen_change', data: GameScreen.Pause });
    events.push({ type: 'sfx_pause' });
    return;
  }
  if (input.pressed[Button.Select]) {
    state.screen = GameScreen.Map;
    events.push({ type: 'screen_change', data: GameScreen.Map });
    return;
  }

  // First visit lines
  if (!ss.firstVisitPlayed) {
    ss.firstVisitPlayed = true;
    const storeLines: Record<string, string[]> = {
      kgb_toys: ["DIMITRI, HE'S HERE!", 'DA! HIDE THE TEDDIES!'],
      forever12: ["IT'S NOT A DISGUISE.", "IT'S A LOOK, SERGEI."],
      radioshock: ["YOU'LL NEED BATTERIES.", 'BEEP. NOT INCLUDED.'],
      hot_spy: ['WANT FRIES WITH THAT?'],
      foot_lockpicker: ['THESE ARE MY GETAWAY SHOES', 'BOTH LEFT FEET, COMRADE'],
      sam_baddy: ['TURN IT UP, BORIS!'],
      crookstone: ['TRY THE MASSAGE CHAIR...'],
      sharper_imagine: ["BEEP. PLEASE DON'T TOUCH."],
      spenders_gifts: ['WHOA... THE LAVA LAMP...'],
    };
    const lines = storeLines[storeId];
    if (lines) {
      for (let li = 0; li < lines.length; li++) {
        events.push({
          type: 'speech_bubble',
          data: { x: 32 + li * 64, y: 20, text: lines[li], delay: li * 60 },
        });
      }
    }
  }

  // Handle frozen timer (for guards holding still on first visit)
  for (const guard of state.storeSpies) {
    if (guard.state === 'frozen') {
      guard.stateTimer--;
      if (guard.stateTimer <= 0) {
        guard.state = 'walking';
      }
    }
  }

  // Holding item overhead
  if (p.holdingItem) {
    p.holdingTimer--;
    if (p.holdingTimer <= 0) p.holdingItem = null;
    return;
  }

  // Frozen
  if (p.frozen > 0) {
    p.frozen--;
    updateStoreGuards(state, events);
    updateStoreBullets(state, events);
    return;
  }

  // GameStonk easter egg
  if (storeId === 'gamestonk' && !state.gameStonkVisited) {
    state.gameStonkVisited = true;
    events.push({ type: 'gamestonk_easter_egg' });
    // Freeze guards and input during the scene
    const item = state.rng.pick(GAMESTONK_ITEMS);
    events.push({
      type: 'gamestonk_scene',
      data: {
        text: "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
        item,
      },
    });
    state.inventory.push(item);
    addScore(state, 1, events);
    p.holdingItem = item;
    p.holdingTimer = 120;
    events.push({ type: 'sfx_item_get' });
  }

  // Sam Baddy listening booth
  if (storeId === 'sam_baddy') {
    // Check if player on the listening booth tile (approximate position)
    if (p.storeX >= 96 && p.storeX <= 112 && p.storeY >= 64 && p.storeY <= 80) {
      events.push({ type: 'play_music', data: 'bonus' });
    }
  }

  // Player movement (top-down, vertical priority)
  const speed = getPlayerSpeed(p);
  let moved = false;

  if (input.held[Button.Up]) {
    p.storeY -= speed;
    p.storeDir = Direction.Up;
    moved = true;
  } else if (input.held[Button.Down]) {
    p.storeY += speed;
    p.storeDir = Direction.Down;
    moved = true;
  } else if (input.held[Button.Left]) {
    p.storeX -= speed;
    p.storeDir = Direction.Left;
    moved = true;
  } else if (input.held[Button.Right]) {
    p.storeX += speed;
    p.storeDir = Direction.Right;
    moved = true;
  }

  // Clamp to room bounds (16x11 tiles of 16px = 256x176)
  p.storeX = Math.max(16, Math.min(240, p.storeX));
  p.storeY = Math.max(16, Math.min(160, p.storeY));

  // Corner assist: if hitting a wall corner within 4px of a gap, slide toward the gap
  // (simplified: just clamp to room bounds above)

  // Exit through door (bottom center)
  if (p.storeY >= 160 && p.storeX >= 112 && p.storeX <= 144) {
    if (input.held[Button.Down]) {
      // Leave store
      const pos = STORE_POSITIONS[storeId];
      state.currentStore = null;
      state.screen = GameScreen.Mall;
      state.fadeDir = -1;
      p.x = pos.x;
      p.y = getFloorY(pos.floor);
      p.floor = pos.floor;
      events.push({ type: 'screen_change', data: GameScreen.Mall });
      events.push({ type: 'sfx_door' });
      events.push({ type: 'play_music', data: state.alarmActive ? 'alarm' : 'mall' });
      return;
    }
  }

  // Cancel search if direction pressed or shooting
  if (p.searching && moved) {
    p.searching = false;
    p.searchTimer = 0;
    p.searchTarget = null;
  }

  // Shooting
  if (input.pressed[Button.A]) {
    if (p.searching) {
      p.searching = false;
      p.searchTimer = 0;
      p.searchTarget = null;
    }
    if (p.shootCooldown === 0) {
      const bvx = p.storeDir === Direction.Right ? BULLET_SPEED : (p.storeDir === Direction.Left ? -BULLET_SPEED : 0);
      const bvy = p.storeDir === Direction.Down ? BULLET_SPEED : (p.storeDir === Direction.Up ? -BULLET_SPEED : 0);
      if (bvx !== 0 || bvy !== 0) {
        state.storeBullets.push({
          x: p.storeX + 8,
          y: p.storeY + 8,
          vx: bvx,
          vy: bvy,
          isPlayer: true,
          floor: p.floor,
          high: true,
        });
        p.shootCooldown = SHOOT_COOLDOWN;
        events.push({ type: 'sfx_shot' });
      }

      // KGB Toys: shooting toy shelf
      if (storeId === 'kgb_toys') {
        events.push({ type: 'kgb_toys_shoot' });
      }
    }
  }

  if (p.shootCooldown > 0) p.shootCooldown--;

  // Searching
  if (input.pressed[Button.B] && !p.searching) {
    // Find adjacent searchable fixture
    const fixtureIdx = findAdjacentFixture(state, p.storeX, p.storeY);
    if (fixtureIdx !== null && !ss.fixturesSearched[fixtureIdx]) {
      p.searching = true;
      p.searchTimer = SEARCH_FRAMES;
      p.searchTarget = fixtureIdx;
      // Turn to face fixture
      events.push({ type: 'sfx_search_tick' });
    }
  }

  if (p.searching) {
    p.searchTimer--;
    if (p.searchTimer <= 0) {
      p.searching = false;
      const fi = p.searchTarget!;

      // Forever 12 fitting room special
      if (storeId === 'forever12' && fi === 0 && state.rng.nextBool(0.25)) {
        events.push({ type: 'sfx_shriek' });
        events.push({ type: 'speech_bubble', data: { x: p.storeX, y: p.storeY - 16, text: 'OCCUPIED!!' } });
        // Spy pops out and fights — fixture stays unsearched
        state.storeSpies.push({
          id: state.nextSpyId++,
          x: p.storeX + 16,
          y: p.storeY,
          direction: Direction.Left,
          state: 'walking',
          stateTimer: 0,
          health: 1,
          isBot: false,
          patrolDir: -1,
        });
        p.searchTarget = null;
        return;
      }

      ss.fixturesSearched[fi] = true;

      // Determine contents
      if (isTargetStore(storeId) && fi === ss.packageIndex) {
        // Package!
        state.packagesCollected++;
        ss.cleared = true;
        p.holdingItem = 'PACKAGE';
        p.holdingTimer = 90;
        addScore(state, 500, events);
        emitBanner(state, events, `PACKAGE ${state.packagesCollected}/${state.totalPackages}`, 'normal');
        events.push({ type: 'package_found', data: { store: storeId, count: state.packagesCollected } });
        events.push({ type: 'sfx_package_fanfare' });
        addScorePopup(state, p.storeX, p.storeY - 16, '+500', p.floor);
      } else if (isPowerUpStore(storeId)) {
        // Power-up or nothing
        if (state.rng.nextBool(0.6) || state.blackFriday) {
          const pType = state.rng.pick([
            PowerUpType.RapidFire, PowerUpType.SpreadShot,
            PowerUpType.ArmorVest, PowerUpType.Sneakers,
            PowerUpType.Radar,
          ]);
          applyPowerUp(state, pType, events);
        } else {
          emitBanner(state, events, 'NOTHING HERE', 'normal');
          events.push({ type: 'sfx_puff' });
        }
      } else if (state.blackFriday) {
        // Black Friday: every non-package fixture holds a power-up
        const pType = state.rng.pick([
          PowerUpType.RapidFire, PowerUpType.SpreadShot,
          PowerUpType.ArmorVest, PowerUpType.Sneakers,
        ]);
        applyPowerUp(state, pType, events);
      } else {
        // Trap or nothing
        if (state.rng.nextBool(0.2) && !isPowerUpStore(storeId)) {
          emitBanner(state, events, "IT'S A TRAP!", 'normal');
          events.push({ type: 'sfx_smoke' });
          p.frozen = 60;
        } else {
          emitBanner(state, events, 'NOTHING HERE', 'normal');
          events.push({ type: 'sfx_puff' });
        }
      }

      p.searchTarget = null;
    }
  }

  // Update store guards
  updateStoreGuards(state, events);

  // Update store bullets
  updateStoreBullets(state, events);

  // Guard contact damage
  for (const guard of state.storeSpies) {
    if (guard.state === 'dying' || guard.state === 'frozen') continue;
    if (guard.isBot && rectsOverlap(p.storeX, p.storeY, 16, 16, guard.x, guard.y, 16, 16)) {
      damagePlayer(state, events);
    }
  }

  // Power-up timers still tick in stores
  updatePowerUpTimers(state, events);
}

function findAdjacentFixture(_state: GameState, px: number, py: number): number | null {
  // Simplified: fixtures are at fixed positions in the store grid
  // Check if player is adjacent to any fixture position
  const fixturePositions = [
    { x: 32, y: 32 }, { x: 80, y: 32 }, { x: 128, y: 32 },
    { x: 176, y: 32 }, { x: 32, y: 96 },
  ];

  for (let i = 0; i < fixturePositions.length; i++) {
    const fp = fixturePositions[i];
    if (Math.abs(px - fp.x) <= 20 && Math.abs(py - fp.y) <= 20) {
      return i;
    }
  }
  return null;
}

function updateStoreGuards(state: GameState, events: GameEvent[]): void {
  const p = state.player;

  for (let i = state.storeSpies.length - 1; i >= 0; i--) {
    const guard = state.storeSpies[i];
    if (guard.state === 'dying') {
      guard.stateTimer--;
      if (guard.stateTimer <= 0) {
        state.storeSpies.splice(i, 1);
        const ss = state.stores.get(state.currentStore!)!;
        if (i < ss.guardsAlive.length) ss.guardsAlive[i] = false;
      }
      continue;
    }
    if (guard.state === 'frozen') continue;

    if (guard.isBot) {
      // Security bot: patrol back and forth
      guard.x += guard.patrolDir * 0.5;
      if (guard.x < 16 || guard.x > 224) {
        guard.patrolDir *= -1;
      }
      guard.direction = guard.patrolDir > 0 ? Direction.Right : Direction.Left;
    } else {
      // Spy guard: move toward player tile by tile
      guard.stateTimer++;
      if (guard.stateTimer % 30 === 0) {
        const dx = p.storeX - guard.x;
        const dy = p.storeY - guard.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          guard.x += Math.sign(dx) * 16;
          guard.direction = dx > 0 ? Direction.Right : Direction.Left;
        } else {
          guard.y += Math.sign(dy) * 16;
          guard.direction = dy > 0 ? Direction.Down : Direction.Up;
        }
        guard.x = Math.max(16, Math.min(224, guard.x));
        guard.y = Math.max(16, Math.min(144, guard.y));
      }

      // Shoot when lined up
      if (guard.stateTimer > 60 && guard.stateTimer % 90 === 0) {
        const dx = p.storeX - guard.x;
        const dy = p.storeY - guard.y;
        if (Math.abs(dx) < 8 || Math.abs(dy) < 8) {
          let bvx = 0, bvy = 0;
          if (Math.abs(dx) < 8) {
            bvy = Math.sign(dy) * ENEMY_BULLET_SPEED;
          } else {
            bvx = Math.sign(dx) * ENEMY_BULLET_SPEED;
          }
          state.storeBullets.push({
            x: guard.x + 8, y: guard.y + 8,
            vx: bvx, vy: bvy,
            isPlayer: false, floor: p.floor, high: true,
          });
          events.push({ type: 'sfx_enemy_shot' });
        }
      }
    }
  }
}

function updateStoreBullets(state: GameState, events: GameEvent[]): void {
  const p = state.player;

  for (let i = state.storeBullets.length - 1; i >= 0; i--) {
    const b = state.storeBullets[i];
    b.x += b.vx;
    b.y += b.vy;

    // Off-screen
    if (b.x < 0 || b.x > 256 || b.y < 0 || b.y > 176) {
      state.storeBullets.splice(i, 1);
      continue;
    }

    if (b.isPlayer) {
      // Hit guard
      for (let j = state.storeSpies.length - 1; j >= 0; j--) {
        const guard = state.storeSpies[j];
        if (guard.state === 'dying' || guard.state === 'frozen') continue;
        if (rectsOverlap(b.x - 2, b.y - 1, 4, 2, guard.x, guard.y, 16, 16)) {
          guard.health--;
          if (guard.health <= 0) {
            guard.state = 'dying';
            guard.stateTimer = SPY_DEATH_FRAMES;
            addScore(state, 100, events);
            events.push({ type: 'spy_killed', data: { id: guard.id } });
          }
          state.storeBullets.splice(i, 1);
          events.push({ type: 'sfx_hit' });
          break;
        }
      }
    } else {
      // Hit player
      if (rectsOverlap(b.x - 2, b.y - 1, 4, 2, p.storeX, p.storeY, 16, 16)) {
        state.storeBullets.splice(i, 1);
        damagePlayer(state, events);
      }
    }
  }
}

// --- Power-up application ---
function applyPowerUp(state: GameState, pType: PowerUpType, events: GameEvent[]): void {
  const p = state.player;
  const name = POWER_UP_NAMES[pType];

  switch (pType) {
    case PowerUpType.RapidFire:
    case PowerUpType.SpreadShot:
      p.weapon = pType;
      p.weaponTimer = TIMED_POWER_UP_DURATIONS[pType]!;
      break;
    case PowerUpType.ArmorVest:
    case PowerUpType.SoftPretzel:
      p.hasArmor = true;
      break;
    case PowerUpType.Sneakers:
      p.speedBoost = PowerUpType.Sneakers;
      p.speedTimer = TIMED_POWER_UP_DURATIONS[pType]!;
      break;
    case PowerUpType.Radar:
      p.hasRadar = true;
      break;
    case PowerUpType.OneUp:
      p.lives++;
      events.push({ type: 'sfx_1up' });
      break;
    case PowerUpType.Cinnabomb:
      p.cinnabomb = true;
      p.cinnabombTimer = TIMED_POWER_UP_DURATIONS[pType]!;
      break;
    case PowerUpType.OrangeJuliOoze:
      p.speedBoost = PowerUpType.OrangeJuliOoze;
      p.speedTimer = TIMED_POWER_UP_DURATIONS[pType]!;
      break;
  }

  p.holdingItem = name;
  p.holdingTimer = 60;
  addScore(state, 50, events);
  emitBanner(state, events, name, 'normal');
  events.push({ type: 'powerup_collected', data: pType });
  events.push({ type: 'sfx_powerup' });
}

// ========================================
// MAP OVERLAY
// ========================================

function updateMap(state: GameState, input: InputState, events: GameEvent[]): void {
  if (input.pressed[Button.Select]) {
    state.screen = state.currentStore ? GameScreen.Store : GameScreen.Mall;
    events.push({ type: 'screen_change', data: state.screen });
  }
}

// ========================================
// PAUSE
// ========================================

function updatePause(state: GameState, input: InputState, events: GameEvent[]): void {
  if (input.pressed[Button.Start]) {
    state.screen = state.currentStore ? GameScreen.Store : GameScreen.Mall;
    events.push({ type: 'screen_change', data: state.screen });
    events.push({ type: 'sfx_pause' });
  }
}

// ========================================
// LEVEL CLEAR
// ========================================

function updateLevelClear(state: GameState, input: InputState, events: GameEvent[]): void {
  state.screenTimer++;

  if (input.pressed[Button.Start]) {
    state.levelClearPhase++;
    state.screenTimer = state.levelClearPhase * 180;
  }

  // Phase transitions
  if (state.screenTimer >= 180 && state.levelClearPhase === 0) {
    state.levelClearPhase = 1;
    // Tally
    const timeBonus = Math.max(0, (300 - Math.floor(state.levelTime / FPS)) * 10);
    addScore(state, state.packagesCollected * 500, events);
    addScore(state, timeBonus, events);
    addScore(state, 1000, events);
    events.push({
      type: 'tally',
      data: {
        packages: state.packagesCollected * 500,
        timeBonus,
        clearBonus: 1000,
        loop: state.loop,
      },
    });
  }

  if (state.screenTimer >= 360 && state.levelClearPhase === 1) {
    state.levelClearPhase = 2;
    // Daily Mall headline
    const headlines = [
      'LOCAL AGENT FINDS 6 PACKAGES,\nSTILL NO PARKING',
      'SPIES FOILED;\nFOOD COURT SALES UP 300%',
      "MAN ZIPLINES ONTO ROOF.\nSECURITY 'NOT SURPRISED'",
      "MALL WALKERS DEMAND APOLOGY\nFOR 'HEY!' INCIDENT",
      'GAMESTONK SHARE PRICE\nDOWN ANOTHER 99%',
    ];
    events.push({ type: 'headline', data: state.rng.pick(headlines) });
  }

  if (state.screenTimer >= 540 && state.levelClearPhase === 2) {
    state.levelClearPhase = 3;
    // SPYGRAM post
    const completePosts = [
      { caption: ['MISSION COMPLETE.', 'ALSO BOUGHT SOCKS.'], comment: 'MOM: WHAT COLOR?' },
      { caption: ['6 PACKAGES.', '0 RECEIPTS. #WIN'], comment: 'RETURNS DESK: NO' },
      { caption: ['SAVED THE WORLD.', 'STILL NO PARKING.'], comment: 'DAD: TYPICAL' },
      { caption: ['SPIES: 0', 'ME: 1 #MALLRAT'], comment: 'BORIS: REMATCH?' },
      { caption: ['GETAWAY CAR:', 'WOOD PANELING. ICONIC'], comment: 'HQ: RETURN THE CAR' },
      { caption: ['TREATED MYSELF TO A', 'CINNABOMB. EARNED IT.'], comment: 'MOM: EAT A VEGGIE' },
      { caption: ['HQ SAID KEEP IT QUIET', 'SO HERE IS A POST'], comment: "HQ: YOU'RE FIRED" },
      { caption: ['FOUND A PET ROCK.', 'HIS NAME IS KEVIN.'], comment: 'KEVIN: ...' },
      { caption: ['BRB, RETURNING 6', 'SUSPICIOUS PACKAGES'], comment: 'MALL COP: WAIT WHAT' },
      { caption: ['SEE YOU NEXT LOOP,', 'FOOD COURT'], comment: 'HOT SPY: ♥♥♥' },
    ];
    const post = state.rng.pick(completePosts);
    state.spygram = {
      caption: post.caption,
      comment: post.comment,
      likes: 0,
      timer: 180,
    };
  }

  if (state.spygram) {
    state.spygram.likes += state.rng.nextInt(5, 15);
    state.spygram.timer--;
  }

  if (state.screenTimer >= 720 || state.levelClearPhase > 3) {
    // Next loop
    startNextLoop(state, events);
  }
}

function startNextLoop(state: GameState, events: GameEvent[]): void {
  state.loop++;
  state.screen = GameScreen.Arrival;
  state.screenTimer = 0;
  state.spygram = null;
  state.levelClearFired = false;
  state.levelClearPhase = 0;
  state.packagesCollected = 0;
  state.alarmActive = false;
  state.alarmTimer = ALARM_BASE - (state.loop - 1) * 20 * FPS;
  state.levelTime = 0;
  state.spies = [];
  state.bullets = [];
  state.coins = [];
  state.spySpawnTimer = 5 * FPS;
  state.paTimer = PA_INTERVAL;

  // Reset stores
  initStores(state);

  // Reset lamps
  for (const lamp of state.lamps) {
    lamp.alive = true;
    lamp.falling = false;
    lamp.darkTimer = 0;
    lamp.rollingX = 0;
  }

  // Reset fountains
  for (const f of state.fountains) f.cooldown = 0;

  // Reset player position
  state.player.x = 100;
  state.player.y = getFloorY(FloorId.Roof);
  state.player.floor = FloorId.Roof;

  events.push({ type: 'screen_change', data: GameScreen.Arrival });
  events.push({ type: 'stop_music' });
}

// ========================================
// CONTINUE
// ========================================

function updateContinue(state: GameState, input: InputState, events: GameEvent[]): void {
  state.continueCountdown--;

  // Beep every second
  if (state.continueCountdown % FPS === 0) {
    events.push({ type: 'sfx_countdown' });
  }

  if (input.pressed[Button.Start] && state.player.continues > 0) {
    state.player.continues--;
    state.player.lives = 3;
    state.player.dead = false;

    // Clear power-ups except Radar
    state.player.weapon = null;
    state.player.weaponTimer = 0;
    state.player.speedBoost = null;
    state.player.speedTimer = 0;
    state.player.cinnabomb = false;
    state.player.cinnabombTimer = 0;
    state.player.hasArmor = false;

    respawnPlayer(state, events);
    state.screen = GameScreen.Mall;
    events.push({ type: 'screen_change', data: GameScreen.Mall });
    events.push({ type: 'play_music', data: state.alarmActive ? 'alarm' : 'mall' });
    return;
  }

  if (state.continueCountdown <= 0) {
    state.screen = GameScreen.GameOver;
    state.screenTimer = 0;
    state.gameOverTimer = 0;
    events.push({ type: 'screen_change', data: GameScreen.GameOver });
  }
}

// ========================================
// GAME OVER
// ========================================

function updateGameOver(state: GameState, input: InputState, events: GameEvent[]): void {
  state.screenTimer++;
  state.gameOverTimer++;

  if (state.screenTimer === 1) {
    events.push({ type: 'sfx_pa_chime' });
    events.push({ type: 'play_music', data: 'game_over' });
  }

  if (input.pressed[Button.Start] || state.screenTimer >= 300) {
    state.screen = GameScreen.Title;
    state.screenTimer = 0;

    // Reset game state
    const seed = state.seed;
    const highScore = state.player.highScore;
    const crt = state.crtEnabled;
    const muted = state.muted;
    Object.assign(state.player, createInitialPlayer());
    state.player.highScore = highScore;
    state.loop = 1;
    state.packagesCollected = 0;
    state.levelClearFired = false;
    state.alarmActive = false;
    state.blackFriday = false;
    state.konamiProgress = 0;
    state.konamiActive = false;
    state.gameStonkVisited = false;
    state.inventory = [];
    state.crtEnabled = crt;
    state.muted = muted;

    events.push({ type: 'screen_change', data: GameScreen.Title });
    events.push({ type: 'play_music', data: 'title' });
  }
}
