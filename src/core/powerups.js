export const POWERUP_INFO = Object.freeze({
  rapid: { name: "RAPID FIRE", duration: 1200, slot: "weapon" },
  spread: { name: "SPREAD SHOT", duration: 1200, slot: "weapon" },
  armor: { name: "ARMOR VEST", duration: 0, slot: "armor" },
  sneakers: { name: "SNEAKERS", duration: 1200, slot: "speed" },
  radar: { name: "RADAR", duration: 0, slot: "radar" },
  "1up": { name: "1-UP", duration: 0, slot: "instant" },
  cinnabomb: { name: "CINNABOMB", duration: 360, slot: "invincible" },
  orange: { name: "ORANGE JULI-OOZE", duration: 720, slot: "speed" },
  pretzel: { name: "SOFT PRETZEL", duration: 0, slot: "armor" },
});

export function emptyPowerups() {
  return { weapon: null, weaponTime: 0, speed: null, speedTime: 0, armor: false, radar: false, invincible: 0 };
}

export function applyPowerup(state, id) {
  const info = POWERUP_INFO[id];
  if (!info) return null;
  const p = state.powerups;
  if (id === "1up") state.lives++;
  else if (info.slot === "weapon") { p.weapon = id; p.weaponTime = info.duration; }
  else if (info.slot === "speed") { p.speed = id; p.speedTime = info.duration; }
  else if (info.slot === "armor") p.armor = true;
  else if (info.slot === "radar") p.radar = true;
  else if (info.slot === "invincible") p.invincible = info.duration;
  return info.name;
}

export function tickPowerups(state) {
  const p = state.powerups;
  for (const slot of ["weapon", "speed"]) {
    const key = `${slot}Time`;
    if (p[key] > 0 && --p[key] === 0) p[slot] = null;
  }
  if (p.invincible > 0) p.invincible--;
}

export function resetOnDeath(state) {
  const radar = state.powerups.radar;
  state.powerups = emptyPowerups();
  state.powerups.radar = radar;
}

export function walkSpeed(state) {
  if (state.powerups.speed === "sneakers") return 1.5;
  if (state.powerups.speed === "orange") return 1.5;
  return 1;
}

export function absorbHit(state) {
  if (state.powerups.invincible > 0 || state.invulnerability > 0) return true;
  if (state.powerups.armor) { state.powerups.armor = false; state.invulnerability = Math.max(state.invulnerability, 45); return true; }
  return false;
}
