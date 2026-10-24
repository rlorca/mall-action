import { overlap } from "./physics.js";

export const SEARCH_FRAMES = 45;

/** Touching any side is enough; a small margin makes gaps forgiving. */
export function touchingFixture(player, fixtures) {
  const touch = { x: player.x - 3, y: player.y - 3, w: player.w + 6, h: player.h + 6 };
  return fixtures.find((fixture) => !fixture.opened && overlap(touch, fixture)) || null;
}

export function beginSearch(room, player, sneakers = false) {
  if (room.search) return false;
  const fixture = touchingFixture(player, room.fixtures);
  if (!fixture) return false;
  room.search = { fixtureId: fixture.id, remaining: sneakers ? 30 : SEARCH_FRAMES, total: sneakers ? 30 : SEARCH_FRAMES };
  const dx = fixture.x + 8 - (player.x + player.w / 2);
  const dy = fixture.y + 8 - (player.y + player.h / 2);
  player.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  player.searchFacing = player.facing;
  return true;
}

export function tickSearch(room, input) {
  const search = room.search;
  if (!search) return null;
  const movedFresh = ["up", "down", "left", "right"].some((key) => input[`${key}Pressed`]);
  if (movedFresh || input.aPressed) { room.search = null; return { cancelled: true }; }
  if (--search.remaining > 0) return null;
  room.search = null;
  const fixture = room.fixtures.find((item) => item.id === search.fixtureId);
  if (!fixture || fixture.opened) return null;
  fixture.opened = true;
  return { completed: true, fixture };
}
