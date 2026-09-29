// Shared mall geometry (pixels, world coordinates; +x right, +y down). Contract between rules, art and renderers.
import type { Floor } from '../data/stores';

export const LEVEL_W = 768; // 3 screens wide
export const LEVEL_H = 400;
export const FLOOR_SPACING = 48;

/** World y of the walking surface ("feet line") of each floor. Sky/skyscraper is above R. */
export const FLOOR_Y: Readonly<Record<Floor, number>> = { R: 128, '4F': 176, '3F': 224, '2F': 272, '1F': 320, P: 368 };
export const FLOOR_INDEX: Readonly<Record<Floor, number>> = { R: 0, '4F': 1, '3F': 2, '2F': 3, '1F': 4, P: 5 };

// Actor sizes
export const MALL_ACTOR_W = 16;
export const MALL_ACTOR_H = 24;
export const STORE_ACTOR = 16;

// Mall furniture sizes (art draws to these; rules use them)
export const SHAFT_W = 32;
export const CAR_W = 32;
export const CAR_H = 36; // car body height standing on its floor plane
export const CEILING_H = 44; // walkable clearance above a floor line
export const STOREFRONT_W = 80;
export const STOREFRONT_H = 44; // sign on top, door in middle, windows either side; bottom edge sits on the floor line
export const DOOR_W = 16;
export const DOOR_H = 28;

// Motion (px per frame unless noted)
export const WALK_SPEED = 1;
export const PLAYER_BULLET_SPEED = 4;
export const ENEMY_BULLET_SPEED = 2;
export const JUMP_HEIGHT = 20;
export const ELEVATOR_SPEED = 1;

// Store (top-down) rooms
export const TILE = 16;
export const ROOM_W_TILES = 16;
export const ROOM_H_TILES = 11;
