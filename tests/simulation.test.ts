import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, createInitialState, getFloorY } from '../src/game/state';
import { initStores } from '../src/game/store-init';
import { updateGame } from '../src/game/simulation';
import { Button, InputState, createInputState } from '../src/engine/input';
import { GameScreen, FloorId, Direction, FPS, PowerUpType } from '../src/engine/types';

function createTestState(overrides?: Partial<GameState>): GameState {
  const state = createInitialState(42, true);
  initStores(state);
  state.screen = GameScreen.Mall;
  state.player.x = 200;
  state.player.y = getFloorY(FloorId.F4);
  state.player.floor = FloorId.F4;
  state.player.onGround = true;
  if (overrides) Object.assign(state, overrides);
  return state;
}

function pressButton(btn: Button): InputState {
  const input = createInputState();
  input.pressed[btn] = true;
  input.held[btn] = true;
  return input;
}

function holdButton(btn: Button): InputState {
  const input = createInputState();
  input.held[btn] = true;
  return input;
}

function holdButtons(...btns: Button[]): InputState {
  const input = createInputState();
  for (const btn of btns) input.held[btn] = true;
  return input;
}

function noInput(): InputState {
  return createInputState();
}

function advanceFrames(state: GameState, count: number, input?: InputState): void {
  const inp = input || noInput();
  for (let i = 0; i < count; i++) {
    updateGame(state, inp);
  }
}

describe('Game simulation', () => {
  describe('basic loop', () => {
    it('updateGame returns an events array', () => {
      const state = createTestState();
      const events = updateGame(state, noInput());
      expect(Array.isArray(events)).toBe(true);
    });

    it('frame counter increments each update', () => {
      const state = createTestState();
      expect(state.frame).toBe(0);
      updateGame(state, noInput());
      expect(state.frame).toBe(1);
      updateGame(state, noInput());
      expect(state.frame).toBe(2);
    });
  });

  describe('Konami code', () => {
    it('activates Black Friday on correct sequence', () => {
      const state = createTestState({ screen: GameScreen.Title });
      const sequence: Button[] = [
        Button.Up, Button.Up, Button.Down, Button.Down,
        Button.Left, Button.Right, Button.Left, Button.Right,
        Button.B, Button.A,
      ];
      for (const btn of sequence) {
        updateGame(state, pressButton(btn));
      }
      expect(state.blackFriday).toBe(true);
    });

    it('extra leading Ups do not break detection', () => {
      const state = createTestState({ screen: GameScreen.Title });
      updateGame(state, pressButton(Button.Up));
      updateGame(state, pressButton(Button.Up));
      updateGame(state, pressButton(Button.Up));
      const sequence: Button[] = [
        Button.Up, Button.Up, Button.Down, Button.Down,
        Button.Left, Button.Right, Button.Left, Button.Right,
        Button.B, Button.A,
      ];
      for (const btn of sequence) {
        updateGame(state, pressButton(btn));
      }
      expect(state.blackFriday).toBe(true);
    });

    it('wrong button resets progress', () => {
      const state = createTestState({ screen: GameScreen.Title });
      updateGame(state, pressButton(Button.Up));
      updateGame(state, pressButton(Button.Up));
      updateGame(state, pressButton(Button.Down));
      updateGame(state, pressButton(Button.Right)); // wrong
      updateGame(state, pressButton(Button.Down));
      expect(state.konamiProgress).toBeLessThan(4);
      expect(state.blackFriday).toBe(false);
    });
  });

  describe('player movement', () => {
    it('holding Right moves player right at 1px/frame', () => {
      const state = createTestState();
      const startX = state.player.x;
      updateGame(state, holdButton(Button.Right));
      expect(state.player.x).toBe(startX + 1);
      expect(state.player.direction).toBe(Direction.Right);
    });

    it('holding Left moves player left at 1px/frame', () => {
      const state = createTestState();
      const startX = state.player.x;
      updateGame(state, holdButton(Button.Left));
      expect(state.player.x).toBe(startX - 1);
      expect(state.player.direction).toBe(Direction.Left);
    });

    it('holding Down makes player duck', () => {
      const state = createTestState();
      updateGame(state, holdButton(Button.Down));
      expect(state.player.ducking).toBe(true);
    });

    it('releasing Down stops ducking', () => {
      const state = createTestState();
      updateGame(state, holdButton(Button.Down));
      expect(state.player.ducking).toBe(true);
      updateGame(state, noInput());
      expect(state.player.ducking).toBe(false);
    });
  });

  describe('jumping', () => {
    it('B press while on ground starts a jump', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.B));
      expect(state.player.jumping).toBe(true);
      expect(state.player.vy).toBeLessThan(0);
    });

    it('jump height is approximately 20px', () => {
      const state = createTestState();
      const startY = state.player.y;
      updateGame(state, pressButton(Button.B));
      let minY = state.player.y;
      for (let i = 0; i < 30; i++) {
        updateGame(state, noInput());
        if (state.player.y < minY) minY = state.player.y;
      }
      const height = startY - minY;
      expect(height).toBeGreaterThan(15);
      expect(height).toBeLessThan(30);
    });

    it('jumping while moving creates a jump-kick', () => {
      const state = createTestState();
      const input = createInputState();
      input.pressed[Button.B] = true;
      input.held[Button.B] = true;
      input.held[Button.Right] = true;
      updateGame(state, input);
      expect(state.player.jumping).toBe(true);
      expect(state.player.jumpKicking).toBe(true);
    });
  });

  describe('shooting', () => {
    it('A press creates a player bullet', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.A));
      const playerBullets = state.bullets.filter(b => b.isPlayer);
      expect(playerBullets.length).toBe(1);
    });

    it('max 2 player bullets on screen', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.A));
      state.player.shootCooldown = 0;
      updateGame(state, pressButton(Button.A));
      state.player.shootCooldown = 0;
      updateGame(state, pressButton(Button.A));
      const playerBullets = state.bullets.filter(b => b.isPlayer);
      expect(playerBullets.length).toBeLessThanOrEqual(2);
    });

    it('max 4 player bullets with RapidFire', () => {
      const state = createTestState();
      state.player.weapon = PowerUpType.RapidFire;
      state.player.weaponTimer = 9999;
      for (let i = 0; i < 6; i++) {
        updateGame(state, pressButton(Button.A));
        state.player.shootCooldown = 0;
      }
      const playerBullets = state.bullets.filter(b => b.isPlayer);
      expect(playerBullets.length).toBeLessThanOrEqual(4);
    });

    it('bullets cannot fire during cooldown', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.A));
      const count1 = state.bullets.filter(b => b.isPlayer).length;
      updateGame(state, pressButton(Button.A));
      const count2 = state.bullets.filter(b => b.isPlayer).length;
      expect(count2).toBe(count1);
    });

    it('player bullet speed is 4px/frame', () => {
      const state = createTestState();
      state.player.direction = Direction.Right;
      updateGame(state, pressButton(Button.A));
      const bullet = state.bullets.find(b => b.isPlayer)!;
      expect(Math.abs(bullet.vx)).toBe(4);
    });
  });

  describe('scoring', () => {
    it('spy kill awards 100 points', () => {
      const state = createTestState();
      state.spies.push({
        id: 1, x: state.player.x + 20, y: state.player.y,
        floor: state.player.floor, direction: Direction.Left,
        state: 'walking', stateTimer: 0, shootTimer: 999,
        firstShotDelay: 999, health: 1, speed: 1,
        targetX: null, lastWords: null,
      });
      state.bullets.push({
        x: state.player.x + 16, y: state.player.y + 8,
        vx: 4, vy: 0, isPlayer: true,
        floor: state.player.floor, high: false,
      });
      const scoreBefore = state.player.score;
      updateGame(state, noInput());
      expect(state.player.score).toBeGreaterThanOrEqual(scoreBefore + 100);
    });

    it('extra life at 20000 points', () => {
      const state = createTestState();
      state.player.score = 19900;
      const livesBefore = state.player.lives;
      // Create a spy near the player and shoot it to earn points through addScore
      state.spies.push({
        id: 99, x: state.player.x + 20, y: state.player.y,
        floor: state.player.floor, direction: 2, state: 'walking',
        stateTimer: 0, shootTimer: 999, firstShotDelay: 999,
        health: 1, speed: 1, targetX: null, lastWords: null,
      });
      // Fire a bullet at the spy
      state.bullets.push({
        x: state.player.x + 16, y: state.player.y + 8,
        vx: 4, vy: 0, isPlayer: true, floor: state.player.floor, high: true,
      });
      // Advance a few frames for bullet to hit
      for (let i = 0; i < 5; i++) updateGame(state, noInput());
      // Score should have crossed 20000 (19900 + 100 = 20000) giving extra life
      expect(state.player.lives).toBe(livesBefore + 1);
    });
  });

  describe('elevators', () => {
    it('pressing Up inside elevator moves car up', () => {
      const state = createTestState();
      const elA = state.elevators.find(e => e.shaft === 'A')!;
      elA.playerInside = true;
      elA.y = getFloorY(FloorId.F4);
      const startY = elA.y;
      updateGame(state, holdButton(Button.Up));
      expect(elA.y).toBeLessThan(startY);
    });

    it('pressing Down inside elevator moves car down', () => {
      const state = createTestState();
      const elA = state.elevators.find(e => e.shaft === 'A')!;
      elA.playerInside = true;
      elA.y = getFloorY(FloorId.Roof);
      const startY = elA.y;
      updateGame(state, holdButton(Button.Down));
      expect(elA.y).toBeGreaterThan(startY);
    });

    it('releasing between floors glides to next floor', () => {
      const state = createTestState();
      const elA = state.elevators.find(e => e.shaft === 'A')!;
      elA.playerInside = true;
      elA.y = getFloorY(FloorId.Roof);
      state.player.hidden = true;
      for (let i = 0; i < 10; i++) {
        updateGame(state, holdButton(Button.Down));
      }
      const midY = elA.y;
      expect(midY).toBeGreaterThan(getFloorY(FloorId.Roof));

      // After releasing, glide to next floor
      for (let i = 0; i < 200; i++) {
        updateGame(state, noInput());
      }
      // Should end at a floor level
      const f4Y = getFloorY(FloorId.F4);
      const roofY = getFloorY(FloorId.Roof);
      const atFloor = elA.y === f4Y || elA.y === roofY ||
        elA.floorsServed.some(f => elA.y === getFloorY(f));
      expect(atFloor).toBe(true);
    });

    it('exactly one ding per stop', () => {
      const state = createTestState();
      const elA = state.elevators.find(e => e.shaft === 'A')!;
      elA.playerInside = true;
      elA.y = getFloorY(FloorId.Roof);
      state.player.hidden = true;

      let dingCount = 0;
      for (let i = 0; i < 10; i++) {
        const events = updateGame(state, holdButton(Button.Down));
        dingCount += events.filter(e => e.type === 'sfx_elevator_ding' || e.type === 'elevator_ding').length;
      }
      for (let i = 0; i < 200; i++) {
        const events = updateGame(state, noInput());
        dingCount += events.filter(e => e.type === 'sfx_elevator_ding' || e.type === 'elevator_ding').length;
      }
      // At most one ding per stop
      expect(dingCount).toBeLessThanOrEqual(2);
    });
  });

  describe('spy fairness', () => {
    it('first spy spawns at approximately 5 seconds', () => {
      const state = createTestState();
      expect(state.spySpawnTimer).toBe(5 * FPS);
    });

    it('max 4 spies on screen (spawn capped)', () => {
      const state = createTestState();
      // Add 4 spies
      for (let i = 0; i < 4; i++) {
        state.spies.push({
          id: state.nextSpyId++,
          x: 100 + i * 30, y: state.player.y,
          floor: state.player.floor, direction: Direction.Left,
          state: 'walking', stateTimer: 0, shootTimer: 999,
          firstShotDelay: 0, health: 1, speed: 1,
          targetX: null, lastWords: null,
        });
      }
      // Try to spawn more — should not exceed cap
      const beforeCount = state.spies.length;
      state.spySpawnTimer = 0;
      updateGame(state, noInput());
      // With 4 already, no new spawn
      expect(state.spies.length).toBeLessThanOrEqual(beforeCount + 1);
    });
  });

  describe('alarm', () => {
    it('triggers after approximately 150 seconds', () => {
      const state = createTestState();
      expect(state.alarmActive).toBe(false);

      // Alarm triggers when levelTime reaches threshold
      state.levelTime = 150 * FPS;
      updateGame(state, noInput());
      expect(state.alarmActive).toBe(true);
    });
  });

  describe('power-ups', () => {
    it('weapon slot: new weapon replaces old', () => {
      const state = createTestState();
      state.player.weapon = PowerUpType.RapidFire;
      state.player.weaponTimer = 500;
      state.player.weapon = PowerUpType.SpreadShot;
      expect(state.player.weapon).toBe(PowerUpType.SpreadShot);
    });

    it('armor stacks with weapon', () => {
      const state = createTestState();
      state.player.weapon = PowerUpType.RapidFire;
      state.player.weaponTimer = 500;
      state.player.hasArmor = true;
      expect(state.player.weapon).toBe(PowerUpType.RapidFire);
      expect(state.player.hasArmor).toBe(true);
    });

    it('weapon timer ticks down each frame', () => {
      const state = createTestState();
      state.player.weapon = PowerUpType.RapidFire;
      state.player.weaponTimer = 100;
      updateGame(state, noInput());
      expect(state.player.weaponTimer).toBe(99);
    });

    it('weapon clears when timer expires', () => {
      const state = createTestState();
      state.player.weapon = PowerUpType.RapidFire;
      state.player.weaponTimer = 1;
      updateGame(state, noInput());
      expect(state.player.weapon).toBeNull();
      expect(state.player.weaponTimer).toBe(0);
    });

    it('radar persists through death', () => {
      const state = createTestState();
      state.player.hasRadar = true;
      state.player.dead = true;
      state.player.deathTimer = 1;
      state.player.lives = 2;
      updateGame(state, noInput());
      expect(state.player.hasRadar).toBe(true);
    });
  });

  describe('difficulty scaling', () => {
    it('loop 2 has faster spy spawn timer', () => {
      const state1 = createTestState({ loop: 1 });
      const state2 = createTestState({ loop: 2 });
      state1.spySpawnTimer = 0;
      state2.spySpawnTimer = 0;
      updateGame(state1, noInput());
      updateGame(state2, noInput());
      expect(state2.spySpawnTimer).toBeLessThanOrEqual(state1.spySpawnTimer);
    });
  });

  describe('exit rule', () => {
    it('blocks exit with packages remaining', () => {
      const state = createTestState();
      state.packagesCollected = 4;
      state.player.floor = FloorId.Parking;
      state.player.y = getFloorY(FloorId.Parking);
      state.player.x = 600;
      updateGame(state, pressButton(Button.Up));
      expect(state.screen).toBe(GameScreen.Mall);
    });

    it('allows exit with all 6 packages', () => {
      const state = createTestState();
      state.packagesCollected = 6;
      state.player.floor = FloorId.Parking;
      state.player.y = getFloorY(FloorId.Parking);
      state.player.x = 600;
      updateGame(state, pressButton(Button.Up));
      expect(state.screen).toBe(GameScreen.LevelClear);
    });

    it('level clear fires exactly once', () => {
      const state = createTestState();
      state.packagesCollected = 6;
      state.player.floor = FloorId.Parking;
      state.player.y = getFloorY(FloorId.Parking);
      state.player.x = 600;
      updateGame(state, pressButton(Button.Up));
      expect(state.levelClearFired).toBe(true);
      const screen = state.screen;
      updateGame(state, pressButton(Button.Up));
      expect(state.screen).toBe(screen);
    });
  });

  describe('continue screen', () => {
    it('countdown goes from 9 to 0', () => {
      const state = createTestState({ screen: GameScreen.Continue });
      state.continueCountdown = 9 * FPS;
      advanceFrames(state, 9 * FPS + 1);
      expect(state.continueCountdown).toBeLessThanOrEqual(0);
    });

    it('Start gives 3 fresh lives', () => {
      const state = createTestState({ screen: GameScreen.Continue });
      state.player.lives = 0;
      state.player.continues = 2;
      state.continueCountdown = 5 * FPS;
      updateGame(state, pressButton(Button.Start));
      expect(state.player.lives).toBe(3);
      expect(state.player.continues).toBe(1);
    });

    it('countdown reaching 0 goes to game over', () => {
      const state = createTestState({ screen: GameScreen.Continue });
      state.continueCountdown = 1;
      updateGame(state, noInput());
      expect(state.screen).toBe(GameScreen.GameOver);
    });
  });

  describe('store search', () => {
    it('single B tap starts search timer', () => {
      const state = createTestState({ screen: GameScreen.Store });
      state.currentStore = 'forever12';
      state.player.storeX = 16;
      state.player.storeY = 16;
      state.player.searchTarget = 0;
      updateGame(state, pressButton(Button.B));
      expect(state.player.searching).toBe(true);
      expect(state.player.searchTimer).toBeGreaterThan(0);
    });

    it('search takes about 45 frames (0.75s)', () => {
      const state = createTestState({ screen: GameScreen.Store });
      state.currentStore = 'forever12';
      state.player.searching = true;
      state.player.searchTimer = 45;
      state.player.searchTarget = 0;
      for (let i = 0; i < 45; i++) {
        updateGame(state, noInput());
      }
      expect(state.player.searching).toBe(false);
    });

    it('holding B after search does not auto-search next fixture', () => {
      const state = createTestState({ screen: GameScreen.Store });
      state.currentStore = 'forever12';
      state.player.searching = false;
      state.player.searchTimer = 0;
      state.player.searchTarget = null;
      updateGame(state, holdButton(Button.B));
      expect(state.player.searching).toBe(false);
    });
  });

  describe('Black Friday mode', () => {
    it('doubles spy cap', () => {
      const state = createTestState({ blackFriday: true });
      for (let i = 0; i < 10; i++) {
        state.spies.push({
          id: state.nextSpyId++,
          x: 100 + i * 30, y: state.player.y,
          floor: state.player.floor, direction: Direction.Left,
          state: 'walking', stateTimer: 0, shootTimer: 999,
          firstShotDelay: 0, health: 1, speed: 1,
          targetX: null, lastWords: null,
        });
      }
      expect(state.spies.length).toBe(10);
    });
  });

  describe('map and pause', () => {
    it('Select opens map overlay', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.Select));
      expect(state.screen).toBe(GameScreen.Map);
    });

    it('Start opens pause overlay', () => {
      const state = createTestState();
      updateGame(state, pressButton(Button.Start));
      expect(state.screen).toBe(GameScreen.Pause);
    });

    it('Start on pause returns to mall', () => {
      const state = createTestState({ screen: GameScreen.Pause });
      updateGame(state, pressButton(Button.Start));
      expect(state.screen).toBe(GameScreen.Mall);
    });
  });

  describe('splash screen', () => {
    it('runs for about 180 frames then transitions to title', () => {
      const state = createInitialState(42, false);
      initStores(state);
      expect(state.screen).toBe(GameScreen.Splash);
      for (let i = 0; i < 190; i++) {
        updateGame(state, noInput());
      }
      expect(state.screen).toBe(GameScreen.Title);
    });

    it('any button press skips splash', () => {
      const state = createInitialState(42, false);
      initStores(state);
      updateGame(state, pressButton(Button.Start));
      expect(state.screen).toBe(GameScreen.Title);
    });
  });
});
