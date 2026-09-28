export const POWERUPS = {
  rapid: { slot: 'weapon', frames: 1200, label: 'RAPID' },
  spread: { slot: 'weapon', frames: 1200, label: 'SPREAD' },
  armor: { slot: 'armor', label: 'VEST' },
  pretzel: { slot: 'armor', label: 'PRETZEL' },
  sneakers: { slot: 'speed', frames: 1200, label: 'SNEAKERS' },
  juliooze: { slot: 'speed', frames: 720, label: 'JULI-OOZE' },
  radar: { slot: 'radar', label: 'RADAR' },
  oneup: { slot: 'instant', label: '1UP' },
  cinnabomb: { slot: 'invincible', frames: 360, label: 'CINNABOMB' },
};

export const createPowerState = () => ({ weapon: null, weaponT: 0, armor: null, speed: null, speedT: 0, radar: false, invincibleT: 0 });

export function applyPowerup(ps, id) {
  const p = POWERUPS[id];
  switch (p.slot) {
    case 'weapon': ps.weapon = id; ps.weaponT = p.frames; break;
    case 'armor': ps.armor = id; break;
    case 'speed': ps.speed = id; ps.speedT = p.frames; break;
    case 'radar': ps.radar = true; break;
    case 'invincible': ps.invincibleT = p.frames; break;
    case 'instant': return { extraLife: 1 };
  }
  return { extraLife: 0 };
}

export function tickPowerups(ps) {
  if (ps.weaponT > 0 && --ps.weaponT === 0) ps.weapon = null;
  if (ps.speedT > 0 && --ps.speedT === 0) ps.speed = null;
  if (ps.invincibleT > 0) ps.invincibleT--;
}

export function resolveHit(ps) {
  if (ps.invincibleT > 0) return 'ignored';
  if (ps.armor) { ps.armor = null; return 'absorbed'; }
  return 'dead';
}

export const walkSpeed = (ps) => (ps.speed ? 1.5 : 1);
export const jumpVelocity = (ps) => (ps.speed === 'sneakers' ? -3.6 : -3.2);
export const searchFrames = (ps) => (ps.speed === 'sneakers' ? 24 : 45);
export const fireCooldown = (ps) => (ps.weapon === 'rapid' ? 8 : 16);
export const maxBullets = (ps) => (ps.weapon === 'rapid' ? 4 : ps.weapon === 'spread' ? 6 : 2);

export function resetOnDeath(ps) {
  Object.assign(ps, { weapon: null, weaponT: 0, armor: null, speed: null, speedT: 0, invincibleT: 0 });
}

export function activeLabel(ps) {
  if (ps.invincibleT > 0) return { label: POWERUPS.cinnabomb.label, frac: ps.invincibleT / POWERUPS.cinnabomb.frames };
  if (ps.weapon) return { label: POWERUPS[ps.weapon].label, frac: ps.weaponT / POWERUPS[ps.weapon].frames };
  if (ps.speed) return { label: POWERUPS[ps.speed].label, frac: ps.speedT / POWERUPS[ps.speed].frames };
  return null;
}
