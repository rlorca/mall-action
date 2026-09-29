import { GameState, Input, Screen, Floor, Player, Spy } from './types';
import { RNG } from './rng';

export function createInitialState(seed: number): GameState {
  return {
    screen: Screen.Splash,
    frame: 0,
    seed,
    loop: 1,
    player: {
      x: 100,
      y: 240,
      floor: Floor.Roof,
      vx: 0,
      vy: 0,
      facingRight: true,
      jumping: false,
      ducking: false,
      lives: 3,
      score: 0,
      packages: 0,
      invulnerableFrames: 0,
      inElevator: false,
      inStore: false,
      currentStore: null,
    },
    spies: [],
    bullets: [],
    packages: new Set(),
    clearedStores: new Set(),
    powerUps: new Map(),
    lives: 3,
    continues: 3,
    alarmActive: false,
    alarmFrames: 0,
    paused: false,
    levelStartFrame: 0,
    levelClearTime: null,
    eventLog: [],
  };
}

export function step(state: GameState, input: Input): GameState {
  // Progress frame counter
  state.frame++;

  // Handle screen transitions and input
  switch (state.screen) {
    case Screen.Splash:
      return updateSplash(state, input);
    case Screen.Title:
      return updateTitle(state, input);
    case Screen.Mall:
      return updateMall(state, input);
    case Screen.Store:
      return updateStore(state, input);
    case Screen.LevelClear:
      return updateLevelClear(state, input);
    case Screen.GameOver:
      return updateGameOver(state, input);
    default:
      return state;
  }
}

function updateSplash(state: GameState, input: Input): GameState {
  const elapsed = state.frame;

  // Skip splash on any button press
  if (input.justPressed.size > 0) {
    state.screen = Screen.Title;
    state.frame = 0;
  }

  // Auto-skip after 3 seconds (180 frames)
  if (elapsed > 180) {
    state.screen = Screen.Title;
    state.frame = 0;
  }

  return state;
}

function updateTitle(state: GameState, input: Input): GameState {
  // Start game on Start button
  if (input.justPressed.has('start')) {
    state.screen = Screen.Mall;
    state.frame = 0;
    state.levelStartFrame = 0;
    state.player.packages = 0;
    state.packages.clear();
    state.clearedStores.clear();
    state.alarmActive = false;
    state.alarmFrames = 0;
  }

  return state;
}

function updateMall(state: GameState, input: Input): GameState {
  if (state.paused && input.justPressed.has('start')) {
    state.paused = false;
    return state;
  }

  if (!state.paused) {
    // Update player
    updatePlayer(state, input);

    // Update spies
    state.spies.forEach(spy => updateSpy(state, spy));

    // Update bullets
    updateBullets(state);

    // Check collisions
    checkCollisions(state);

    // Update power-ups
    state.powerUps.forEach((time, name) => {
      if (time > 0) state.powerUps.set(name, time - 1);
      else state.powerUps.delete(name);
    });

    // Spawn spies
    spawnSpies(state);

    // Check level clear (all packages collected, at parking level)
    if (state.player.packages >= 6 && state.player.floor === Floor.Parking) {
      state.screen = Screen.LevelClear;
      state.frame = 0;
      state.levelClearTime = state.frame - state.levelStartFrame;
    }
  }

  return state;
}

function updatePlayer(state: GameState, input: Input) {
  const player = state.player;

  // Handle ducking
  player.ducking = input.pressed.has('down') && !player.jumping;

  // Handle horizontal movement
  const moveLeft = input.pressed.has('left');
  const moveRight = input.pressed.has('right');

  if (moveLeft && !moveRight) {
    player.vx = -1;
    player.facingRight = false;
  } else if (moveRight && !moveLeft) {
    player.vx = 1;
    player.facingRight = true;
  } else {
    player.vx = 0;
  }

  // Handle jumping
  if (input.justPressed.has('b') && !player.jumping) {
    player.vy = -8; // Jump velocity
    player.jumping = true;
  }

  // Apply gravity
  if (player.jumping) {
    player.vy += 0.5; // Gravity
    player.y += player.vy;

    // Landing check (simplified)
    if (player.y >= 240 && player.vy > 0) {
      player.y = 240;
      player.vy = 0;
      player.jumping = false;
    }
  }

  // Apply horizontal movement
  player.x += player.vx;

  // Clamp to level bounds
  player.x = Math.max(0, Math.min(768, player.x));

  // Update invulnerability
  if (player.invulnerableFrames > 0) {
    player.invulnerableFrames--;
  }
}

function updateSpy(state: GameState, spy: Spy) {
  if (!spy.alive) {
    spy.deathFrames++;
    return;
  }

  // Basic spy AI: walk toward player if visible
  const distToPlayer = Math.abs(spy.x - state.player.x);
  const sameFloor = spy.floor === state.player.floor;

  if (sameFloor && distToPlayer < 160) {
    // Walk toward player
    spy.vx = spy.x < state.player.x ? 1 : -1;
  } else {
    spy.vx = 0;
  }

  spy.x += spy.vx;

  // Shooting logic (simplified)
  if (spy.shootFrames > 0) {
    spy.shootFrames--;
  } else if (sameFloor && distToPlayer < 160) {
    // Shoot
    state.bullets.push({
      id: `spy-bullet-${state.frame}`,
      x: spy.x,
      y: spy.y,
      floor: spy.floor,
      vx: spy.x < state.player.x ? 2 : -2,
      vy: 0,
      owner: 'spy'
    });
    spy.shootFrames = 150; // ~2.5 seconds between shots
  }
}

function updateBullets(state: GameState) {
  state.bullets = state.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    return bullet.x >= 0 && bullet.x <= 768;
  });
}

function checkCollisions(state: GameState) {
  // Player hit by spy bullet
  state.bullets = state.bullets.filter(bullet => {
    if (bullet.owner === 'spy' &&
        bullet.floor === state.player.floor &&
        Math.abs(bullet.x - state.player.x) < 20 &&
        state.player.invulnerableFrames === 0) {
      // Hit!
      state.player.lives--;
      state.player.invulnerableFrames = 120; // 2 seconds of invulnerability
      return false; // Remove bullet
    }
    return true;
  });
}

function spawnSpies(state: GameState) {
  // Very basic spawning: one every 300 frames, up to 4 on screen
  if (state.frame % 300 === 0 && state.spies.length < 4) {
    const rng = new RNG(state.seed + state.frame);
    const floorOptions = [Floor.Floor4, Floor.Floor3, Floor.Floor2, Floor.Floor1];
    const floor = rng.choose(floorOptions);

    state.spies.push({
      id: `spy-${state.frame}`,
      x: rng.bool() ? 50 : 700,
      y: 200,
      floor,
      vx: 0,
      vy: 0,
      facingRight: rng.bool(),
      targetX: null,
      shootFrames: 120, // ~2 seconds before first shot
      alive: true,
      deathFrames: 0
    });
  }
}

function updateStore(state: GameState, input: Input): GameState {
  // TODO: Implement store logic
  return state;
}

function updateLevelClear(state: GameState, input: Input): GameState {
  // Show level clear screen, advance to next loop on Start
  if (input.justPressed.has('start')) {
    state.screen = Screen.Title;
    state.frame = 0;
    state.loop++;
    state.player.packages = 0;
    state.packages.clear();
    state.clearedStores.clear();
  }

  return state;
}

function updateGameOver(state: GameState, input: Input): GameState {
  if (input.justPressed.has('start')) {
    state.screen = Screen.Title;
    state.frame = 0;
    state.loop = 1;
  }

  return state;
}
