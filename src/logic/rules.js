export const TARGET_COUNT = 6;
export const START_LIVES = 3;
export const EXTRA_LIFE_AT = 20000;
export const SCORES = {
  spyShot: 100, spyCrushed: 300, spyLight: 300, package: 500, powerup: 50, levelClear: 1000,
  coin: 50, slideKill: 300, discoKill: 300, walkerShot: -200, detained: -500, jokeItem: 1,
};

export function addPoints(state, pts) {
  state.score = Math.max(0, state.score + pts);
  if (!state.extraLifeGiven && state.score >= EXTRA_LIFE_AT) { state.extraLifeGiven = true; state.lives++; return { pts, extraLife: true }; }
  return { pts, extraLife: false };
}
export const addScore = (state, key) => addPoints(state, SCORES[key]);
export const packagesLeft = (state) => TARGET_COUNT - state.packages.size;
export const canExit = (state) => packagesLeft(state) === 0;

export function difficulty(loop, { blackFriday = false, alarm = false } = {}) {
  const n = loop - 1;
  let spySpeed = Math.min(0.75 * 1.1 ** n, 1.5);
  let spawnInterval = Math.max(90, Math.round(240 * 0.85 ** n));
  const fireInterval = Math.max(60, Math.round(150 / 1.15 ** n));
  const alarmAt = Math.max(60 * 60, (150 - 20 * n) * 60);
  let spyCap = 4;
  if (blackFriday) { spyCap = 8; spawnInterval = Math.round(spawnInterval / 2); }
  if (alarm) { spySpeed *= 1.25; spawnInterval = Math.round(spawnInterval * 0.7); }
  return { spySpeed, spawnInterval, fireInterval, alarmAt, spyCap };
}
export const isAlarm = (levelFrames, loop) => levelFrames >= difficulty(loop).alarmAt;
export const timeBonus = (levelFrames) => Math.max(0, 300 - Math.floor(levelFrames / 60)) * 10;
