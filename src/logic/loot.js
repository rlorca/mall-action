export const SHOP_TABLE = [['rapid', 3], ['spread', 3], ['armor', 2], ['sneakers', 2], ['radar', 1], ['oneup', 0.5]];
export const FOOD_TABLE = [['cinnabomb', 2], ['juliooze', 3], ['pretzel', 3]];

export function weighted(rng, table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [id, w] of table) { if (w > 0 && r < w) return id; r -= w; }
  return table.filter(([, w]) => w > 0).at(-1)[0];
}
export const rollPowerup = (rng, { food = false } = {}) => weighted(rng, food ? FOOD_TABLE : SHOP_TABLE);

export function rollFixture(rng, store, { blackFriday = false } = {}) {
  const food = store.theme === 'food';
  if (blackFriday) return { type: 'powerup', id: rollPowerup(rng, { food }) };
  const r = rng.next();
  if (store.role === 'powerup') return r < 0.6 ? { type: 'powerup', id: rollPowerup(rng) } : { type: 'empty' };
  if (r < 0.25) return { type: 'powerup', id: rollPowerup(rng, { food: food || rng.chance(0.2) }) };
  if (r < 0.45) return { type: 'trap' };
  return { type: 'empty' };
}

export function rollSpyDrop(rng) {
  if (!rng.chance(0.05)) return null;
  return rollPowerup(rng, { food: rng.chance(0.5) });
}
