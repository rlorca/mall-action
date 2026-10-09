export const POINTS = {
  spyShot: 100,
  spyCrushed: 300,
  package: 500,
  powerup: 50,
  levelClear: 1000,
  timeBonusPerSecond: 10,
  timeBonusUnder: 300,
  coin: 50,
  walkerShot: -200,
  copCaught: -500,
  jokeItem: 1,
} as const;

export const EXTRA_LIFE_AT = 20000;
export const START_LIVES = 3;
export const START_CONTINUES = 3;

/** Time bonus: 10 points per second under 300 s. */
export function timeBonus(frames: number): number {
  const sec = Math.floor(frames / 60);
  return Math.max(0, POINTS.timeBonusUnder - sec) * POINTS.timeBonusPerSecond;
}

export interface ScoreState {
  score: number;
  lives: number;
  extraLifeGiven: boolean;
}

export function newScoreState(): ScoreState {
  return { score: 0, lives: START_LIVES, extraLifeGiven: false };
}

/** Adds points (can be negative; score never goes below 0). Returns true when the 20,000 extra life was awarded. */
export function addScore(s: ScoreState, pts: number): boolean {
  s.score = Math.max(0, s.score + pts);
  if (!s.extraLifeGiven && s.score >= EXTRA_LIFE_AT) {
    s.extraLifeGiven = true;
    s.lives++;
    return true;
  }
  return false;
}
