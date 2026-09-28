export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const MALL_W = 768;
export const SKY = 32;
export const PITCH = 48;
export const FLOORS = 6;
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'];
export const MALL_H = SKY + FLOORS * PITCH; // 320
export const floorTop = (i) => SKY + i * PITCH;      // top of floor i's space
export const feetY = (i) => floorTop(i) + 40;        // walking surface of floor i
export const WALL_L = 8;
export const WALL_R = MALL_W - 8;
