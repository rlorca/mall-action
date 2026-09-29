// Store interior system (top-down view, 16×11 tiles)

import { Floor, GameState, Screen } from './types';
import { STORES } from './data';

export interface Fixture {
  id: string;
  x: number;
  y: number;
  type: 'shelf' | 'counter' | 'rack' | 'display';
  opened: boolean;
  contents: 'package' | 'powerup' | 'trap' | 'nothing';
  searchingFrames: number;
}

export interface StoreRoom {
  storeName: string;
  floor: Floor;
  fixtures: Fixture[];
  guards: any[]; // TODO: Guard interface
  theme: string;
  playerX: number;
  playerY: number;
  playerFacingRight: boolean;
  visitedOnce: boolean;
}

export function createStoreRoom(storeName: string): StoreRoom {
  const store = STORES.find(s => s.name === storeName);
  if (!store) throw new Error(`Store not found: ${storeName}`);

  // Generate fixtures based on theme
  const fixtures = generateFixtures(store.theme);

  return {
    storeName,
    floor: store.floor,
    fixtures,
    guards: [],
    theme: store.theme,
    playerX: 8, // Start at door (center bottom)
    playerY: 10,
    playerFacingRight: true,
    visitedOnce: false,
  };
}

function generateFixtures(theme: string): Fixture[] {
  const fixtures: Fixture[] = [];
  const fixturePositions = [
    { x: 2, y: 2 }, { x: 8, y: 2 }, { x: 14, y: 2 },
    { x: 2, y: 5 }, { x: 8, y: 5 }, { x: 14, y: 5 },
    { x: 2, y: 8 }, { x: 8, y: 8 }, { x: 14, y: 8 },
  ];

  fixturePositions.forEach((pos, i) => {
    fixtures.push({
      id: `fixture-${i}`,
      x: pos.x,
      y: pos.y,
      type: i % 3 === 0 ? 'shelf' : i % 3 === 1 ? 'counter' : 'rack',
      opened: false,
      contents: 'nothing', // Will be set based on store type
      searchingFrames: 0,
    });
  });

  return fixtures;
}

export function enterStore(state: GameState, storeName: string): boolean {
  const store = STORES.find(s => s.name === storeName);
  if (!store || store.role === 'closed') {
    return false;
  }

  const storeRoom = createStoreRoom(storeName);

  // Set fixture contents based on store type
  if (store.role === 'target') {
    // Exactly one package in a random fixture
    if (!state.packages.has(storeName)) {
      const packageFixture = storeRoom.fixtures[Math.floor(Math.random() * storeRoom.fixtures.length)];
      packageFixture.contents = 'package';
      // Others are empty or traps
      storeRoom.fixtures.forEach(f => {
        if (f.id !== packageFixture.id && Math.random() < 0.2) {
          f.contents = 'trap';
        }
      });
    } else {
      // Already cleared
      storeRoom.fixtures.forEach(f => { f.contents = 'nothing'; });
    }
  } else if (store.role === 'powerup') {
    // All are power-ups or traps
    storeRoom.fixtures.forEach(f => {
      if (Math.random() < 0.7) {
        f.contents = 'powerup';
      } else {
        f.contents = 'trap';
      }
    });
  }

  // Store in game state (simplified - in real impl would be separate state)
  (state as any).currentStore = storeRoom;
  state.player.currentStore = storeName;
  state.player.inStore = true;

  return true;
}

export function exitStore(state: GameState) {
  state.player.inStore = false;
  state.player.currentStore = null;
  (state as any).currentStore = null;
}

export function searchFixture(state: GameState, fixtureId: string) {
  const storeRoom = (state as any).currentStore as StoreRoom | undefined;
  if (!storeRoom) return;

  const fixture = storeRoom.fixtures.find(f => f.id === fixtureId);
  if (!fixture || fixture.opened) return;

  fixture.opened = true;

  switch (fixture.contents) {
    case 'package':
      state.packages.add(storeRoom.storeName);
      state.player.packages++;
      state.player.score += 500;
      break;
    case 'powerup':
      state.powerUps.set('temppower', 1200);
      state.player.score += 50;
      break;
    case 'trap':
      // Player is stunned for 1 second
      state.player.invulnerableFrames = 60;
      break;
    case 'nothing':
      break;
  }
}
