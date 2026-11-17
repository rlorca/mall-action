export function nextRandom(seed) {
  let value = (seed >>> 0) || 0x6d616c6c;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}
export function random(state) {
  state.rng = nextRandom(state.rng);
  return state.rng / 0x100000000;
}
export const integer = (state, count) => Math.floor(random(state) * count);
export const pick = (state, list) => list[integer(state,list.length)];
