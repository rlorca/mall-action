import { GameState, Input, Screen, Floor, Player, Spy } from './types';
import { RNG } from './rng';
import { STORES, PHYSICS, TIMINGS, SCORES } from './data';
import { audioEngine } from './audio';

const MALL_WIDTH = 768;
const FLOOR_HEIGHT = 48;
const FLOORS = [Floor.Roof, Floor.Floor4, Floor.Floor3, Floor.Floor2, Floor.Floor1, Floor.Parking];

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
    case Screen.Continue:
      return updateContinue(state, input);
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
    audioEngine.initialize();
  }

  return state;
}

function updateMall(state: GameState, input: Input): GameState {
  if (input.justPressed.has('start')) {
    state.paused = !state.paused;
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

    // Spawn spies
    spawnSpies(state);

    // Update alarm
    state.alarmFrames++;
    const alarmTriggerTime = TIMINGS.alarmTriggerTime - (state.loop * 1200);
    if (state.alarmFrames > alarmTriggerTime && !state.alarmActive) {
      state.alarmActive = true;
      audioEngine.playSfx('alarm');
    }

    // Check level clear (all packages collected, at parking level)
    if (state.player.packages >= 6 && state.player.floor === Floor.Parking && input.justPressed.has('up')) {
      state.screen = Screen.LevelClear;
      state.frame = 0;
      state.levelClearTime = state.frame - state.levelStartFrame;
      audioEngine.playSfx('ding');
    }

    // Game Over check
    if (state.player.lives <= 0) {
      if (state.continues > 0) {
        state.screen = Screen.Continue;
      } else {
        state.screen = Screen.GameOver;
      }
      state.frame = 0;
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
  const hasSpeedBoost = state.powerUps.has('sneakers') || state.powerUps.has('juliooze');
  const moveSpeed = hasSpeedBoost ? 1.5 : PHYSICS.playerWalkSpeed;

  if (moveLeft && !moveRight) {
    player.vx = -moveSpeed;
    player.facingRight = false;
  } else if (moveRight && !moveLeft) {
    player.vx = moveSpeed;
    player.facingRight = true;
  } else {
    player.vx = 0;
  }

  // Handle shooting
  if (input.justPressed.has('a')) {
    const hasRapidFire = state.powerUps.has('rapidfire');
    const hasSpreadShot = state.powerUps.has('spread');
    const maxBullets = hasRapidFire ? 4 : PHYSICS.maxPlayerBullets;

    const playerBullets = state.bullets.filter(b => b.owner === 'player').length;
    if (playerBullets < maxBullets) {
      const bulletY = player.ducking ? player.y + 8 : player.y;
      const bulletSpeed = PHYSICS.bulletSpeed;

      if (hasSpreadShot) {
        // Three-way shot
        state.bullets.push({
          id: `player-bullet-${state.frame}-0`,
          x: player.x + (player.facingRight ? 8 : -8),
          y: bulletY - 4,
          floor: player.floor,
          vx: player.facingRight ? bulletSpeed : -bulletSpeed,
          vy: -1,
          owner: 'player'
        });
        state.bullets.push({
          id: `player-bullet-${state.frame}-1`,
          x: player.x + (player.facingRight ? 8 : -8),
          y: bulletY,
          floor: player.floor,
          vx: player.facingRight ? bulletSpeed : -bulletSpeed,
          vy: 0,
          owner: 'player'
        });
        state.bullets.push({
          id: `player-bullet-${state.frame}-2`,
          x: player.x + (player.facingRight ? 8 : -8),
          y: bulletY + 4,
          floor: player.floor,
          vx: player.facingRight ? bulletSpeed : -bulletSpeed,
          vy: 1,
          owner: 'player'
        });
      } else {
        state.bullets.push({
          id: `player-bullet-${state.frame}`,
          x: player.x + (player.facingRight ? 8 : -8),
          y: bulletY,
          floor: player.floor,
          vx: player.facingRight ? bulletSpeed : -bulletSpeed,
          vy: 0,
          owner: 'player'
        });
      }

      audioEngine.playSfx('shot');
    }
  }

  // Handle jumping
  if (input.justPressed.has('b') && !player.jumping) {
    const jumpForce = state.powerUps.has('sneakers') ? 10 : PHYSICS.playerJumpForce;
    player.vy = -jumpForce;
    player.jumping = true;
    audioEngine.playSfx('jump');
  }

  // Apply gravity
  if (player.jumping) {
    player.vy = Math.min(PHYSICS.playerMaxFall, player.vy + PHYSICS.playerGravity);
    player.y += player.vy;

    // Landing check
    const floorY = getFloorY(player.floor);
    if (player.y >= floorY && player.vy > 0) {
      player.y = floorY;
      player.vy = 0;
      player.jumping = false;
    }
  }

  // Apply horizontal movement
  player.x += player.vx;

  // Clamp to level bounds
  player.x = Math.max(0, Math.min(MALL_WIDTH, player.x));

  // Update invulnerability
  if (player.invulnerableFrames > 0) {
    player.invulnerableFrames--;
  }
}

function updateSpy(state: GameState, spy: Spy) {
  if (!spy.alive) {
    spy.deathFrames++;
    if (spy.deathFrames > 24) {
      // Remove dead spy
      state.spies = state.spies.filter(s => s.id !== spy.id);
    }
    return;
  }

  // Basic spy AI: walk toward player if visible
  const distToPlayer = Math.abs(spy.x - state.player.x);
  const sameFloor = spy.floor === state.player.floor;

  if (sameFloor && distToPlayer < 160 && !state.player.ducking) {
    // Walk toward player
    spy.vx = spy.x < state.player.x ? PHYSICS.spyWalkSpeed : -PHYSICS.spyWalkSpeed;
  } else {
    spy.vx = 0;
  }

  spy.x += spy.vx;

  // Clamp to bounds
  spy.x = Math.max(0, Math.min(MALL_WIDTH, spy.x));

  // Shooting logic
  if (spy.shootFrames > 0) {
    spy.shootFrames--;
  } else if (sameFloor && distToPlayer < 160) {
    // Shoot
    const spyBulletSpeed = PHYSICS.spyBulletSpeed;
    state.bullets.push({
      id: `spy-bullet-${state.frame}`,
      x: spy.x,
      y: spy.y,
      floor: spy.floor,
      vx: spy.x < state.player.x ? spyBulletSpeed : -spyBulletSpeed,
      vy: 0,
      owner: 'spy'
    });
    spy.shootFrames = 150; // ~2.5 seconds between shots
    audioEngine.playSfx('shot');
  }
}

function updateBullets(state: GameState) {
  state.bullets = state.bullets.filter(bullet => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    // Remove bullets outside bounds
    if (bullet.x < 0 || bullet.x > MALL_WIDTH) return false;
    if (bullet.y < 0 || bullet.y > 300) return false;

    return true;
  });
}

function checkCollisions(state: GameState) {
  // Player hit by spy bullet
  state.bullets = state.bullets.filter(bullet => {
    if (bullet.owner === 'spy' &&
        bullet.floor === state.player.floor &&
        Math.abs(bullet.x - state.player.x) < 12 &&
        Math.abs(bullet.y - state.player.y) < 16 &&
        state.player.invulnerableFrames === 0) {
      // Hit!
      const hasArmor = state.powerUps.has('armor') || state.powerUps.has('pretzel');
      if (hasArmor) {
        state.powerUps.delete('armor');
        state.powerUps.delete('pretzel');
      } else {
        state.player.lives--;
      }
      state.player.invulnerableFrames = TIMINGS.invulnerabilityFrames;
      audioEngine.playSfx('hit');
      return false;
    }

    // Player bullet hit spy
    if (bullet.owner === 'player' && bullet.floor === state.player.floor) {
      state.spies.forEach(spy => {
        if (spy.alive &&
            spy.floor === bullet.floor &&
            Math.abs(bullet.x - spy.x) < 16 &&
            Math.abs(bullet.y - spy.y) < 16) {
          spy.alive = false;
          state.player.score += SCORES.spyShot;
          audioEngine.playSfx('hit');
          return;
        }
      });
    }

    return true;
  });

  // Player touch spy
  state.spies.forEach(spy => {
    if (spy.alive && spy.floor === state.player.floor &&
        Math.abs(spy.x - state.player.x) < 12 &&
        Math.abs(spy.y - state.player.y) < 20 &&
        state.player.invulnerableFrames === 0) {
      // Touching spy
      state.player.lives--;
      state.player.invulnerableFrames = TIMINGS.invulnerabilityFrames;
      audioEngine.playSfx('death');
    }
  });
}

function spawnSpies(state: GameState) {
  const spySpawnRate = state.alarmActive ? 150 : 300;
  const maxSpies = state.alarmActive ? 6 : 4;

  // Check if time to spawn
  if (state.frame % spySpawnRate === 0 && state.spies.length < maxSpies) {
    const rng = new RNG(state.seed + state.frame);
    const floorOptions = [Floor.Floor4, Floor.Floor3, Floor.Floor2, Floor.Floor1];
    const floor = rng.choose(floorOptions);
    const targetStore = STORES.find(s => s.floor === floor && s.role !== 'closed');

    if (targetStore) {
      state.spies.push({
        id: `spy-${state.frame}`,
        x: rng.bool() ? 50 : 700,
        y: getFloorY(floor),
        floor,
        vx: 0,
        vy: 0,
        facingRight: rng.bool(),
        targetX: null,
        shootFrames: TIMINGS.spyFirstShotDelay,
        alive: true,
        deathFrames: 0
      });
    }
  }
}

function updateStore(state: GameState, input: Input): GameState {
  // TODO: Implement store logic
  if (input.justPressed.has('up')) {
    state.screen = Screen.Mall;
  }
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

function updateContinue(state: GameState, input: Input): GameState {
  // Check if countdown reaches zero (about 540 frames / 9 seconds)
  if (state.frame > 540) {
    state.screen = Screen.GameOver;
    state.frame = 0;
    return state;
  }

  // Start button confirms continue
  if (input.justPressed.has('start')) {
    state.continues--;
    state.player.lives = 3;
    state.screen = Screen.Mall;
    state.frame = 0;
    state.alarmActive = false;
    state.alarmFrames = 0;
    // Keep packages, score, and loop
  }

  return state;
}

function updateGameOver(state: GameState, input: Input): GameState {
  if (input.justPressed.has('start')) {
    state.screen = Screen.Title;
    state.frame = 0;
    state.loop = 1;
    state.player.score = 0;
    state.player.lives = 3;
    state.continues = 3;
  }

  return state;
}

function getFloorY(floor: Floor): number {
  const floorIdx = FLOORS.indexOf(floor);
  return 240 - (floorIdx * FLOOR_HEIGHT);
}
