import { GRAVITY, JUMP_VELOCITY, MAX_FALL, FLOOR_GAP, clamp } from "./constants.js";

export function startJump(body, moving = false, sneakers = false) {
  if (!body.grounded) return false;
  body.vy = sneakers ? JUMP_VELOCITY * 1.14 : JUMP_VELOCITY;
  body.grounded = false;
  body.jumpKick = moving;
  body.fallStartY = body.y;
  return true;
}

export function integrateVertical(body, floorY) {
  const previousBottom = body.y + body.h;
  body.vy = Math.min(MAX_FALL, (body.vy || 0) + GRAVITY);
  body.y += body.vy;
  if (body.vy >= 0 && previousBottom <= floorY && body.y + body.h >= floorY) {
    const fallDistance = body.y + body.h - (body.fallStartY ?? body.y + body.h);
    body.y = floorY - body.h;
    body.vy = 0;
    body.grounded = true;
    body.jumpKick = false;
    return { landed: true, fallDistance, outcome: fallOutcome(fallDistance) };
  }
  return { landed: false, fallDistance: 0, outcome: "falling" };
}

export function fallOutcome(distance) {
  if (distance > FLOOR_GAP + 4) return "fatal";
  if (distance > 4) return "safe";
  return "none";
}

export function moveWithWalls(body, dx, dy, solids, bounds = { minX: 0, maxX: 768 }) {
  body.x = clamp(body.x + dx, bounds.minX, bounds.maxX - body.w);
  for (const wall of solids) {
    if (!overlap(body, wall)) continue;
    if (dx > 0) body.x = wall.x - body.w;
    else if (dx < 0) body.x = wall.x + wall.w;
  }
  body.y += dy;
  for (const wall of solids) {
    if (!overlap(body, wall)) continue;
    if (dy > 0) body.y = wall.y - body.h;
    else if (dy < 0) body.y = wall.y + wall.h;
  }
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function cornerAssist(body, dx, dy, solids) {
  if (!dx || dy) return dx;
  const original = body.y;
  for (const offset of [-2, 2, -1, 1]) {
    body.y = original + offset;
    if (!solids.some((solid) => overlap({ ...body, x: body.x + dx }, solid))) return dx;
  }
  body.y = original;
  return dx;
}
