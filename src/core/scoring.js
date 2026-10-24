export const POINTS = Object.freeze({
  spy: 100, crush: 300, package: 500, powerup: 50, clear: 1000,
  coin: 50, walker: -200, detained: -500, joke: 1,
});

export function addScore(state, amount) {
  const previous = state.score;
  state.score = Math.max(0, state.score + amount);
  const oldExtra = Math.floor(previous / 20000);
  const newExtra = Math.floor(state.score / 20000);
  if (newExtra > oldExtra) {
    state.lives += newExtra - oldExtra;
    return { extraLife: true };
  }
  return { extraLife: false };
}

export function difficulty(loop = 1) {
  const n = Math.max(0, loop - 1);
  return Object.freeze({
    spySpeed: Math.min(1.8, 1 + n * 0.1),
    spawnRate: Math.min(2.5, 1 + n * 0.15),
    fireRate: Math.min(2.2, 1 + n * 0.15),
    alarmFrames: Math.max(60 * 70, 60 * (150 - n * 20)),
  });
}

export function timeBonus(elapsedFrames) {
  return Math.max(0, 300 - Math.floor(elapsedFrames / 60)) * 10;
}
