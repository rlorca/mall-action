// Colours for the scenes. Each colour is an NES-like hex from core/palette.
import { NES } from '../core/palette';
import type { StoreTheme } from '../mall/layout';

export interface ThemeColours {
  floor: string;
  wall: string;
  accent: string;
  light: string;
}

export const THEME: Record<StoreTheme, ThemeColours> = {
  fashion: { floor: NES.silver, wall: NES.pink, accent: NES.magenta, light: NES.white },
  electronics: { floor: NES.dkgrey, wall: NES.navy, accent: NES.cyan, light: NES.white },
  toys: { floor: NES.yellow, wall: NES.orange, accent: NES.red, light: NES.white },
  food: { floor: NES.brown, wall: NES.red, accent: NES.yellow, light: NES.white },
  sports: { floor: NES.grey, wall: NES.greenDk, accent: NES.lime, light: NES.white },
  music: { floor: NES.ink, wall: NES.purple, accent: NES.pink, light: NES.yellow },
  gadgets: { floor: NES.silver, wall: NES.teal, accent: NES.cyan, light: NES.white },
  novelty: { floor: NES.nightB, wall: NES.magenta, accent: NES.lime, light: NES.yellow },
  games: { floor: NES.navy, wall: NES.blue, accent: NES.green, light: NES.white },
};

export const SKY = [NES.nightA, NES.nightB, NES.nightC];
export const MALL_FLOOR = NES.silver;
export const MALL_WALL = NES.nightB;
