// Points, lives and the extra-life rule. Pure.

export const EXTRA_LIFE_EVERY = 20000;
export const MAX_LIVES = 3;
export const CONTINUES_PER_GAME = 3;

export const POINTS = {
  spyShot: 100,
  spyCrushed: 300,
  spyLampKill: 300,
  spyDiscoKill: 300,
  spyWetSlideKill: 300,
  package: 500,
  powerUp: 50,
  levelClear: 1000,
  timeBonusPerSecond: 10,
  timeBonusLimitSec: 300,
  coin: 50,
  walkerShot: -200,
  copCaught: -500,
  jokeItem: 1,
} as const;

export class Score {
  points = 0;
  private nextExtraLifeAt = EXTRA_LIFE_EVERY;

  /** Adds points. Returns how many extra lives this crossed (0 or 1 normally). */
  add(amount: number): number {
    this.points = Math.max(0, this.points + amount);
    let lives = 0;
    while (this.points >= this.nextExtraLifeAt) {
      this.nextExtraLifeAt += EXTRA_LIFE_EVERY;
      lives++;
    }
    return lives;
  }
}

/** Time bonus for finishing a level in `seconds`, per the brief (10 per second under 300 s). */
export function timeBonus(seconds: number): number {
  const left = Math.max(0, Math.floor(POINTS.timeBonusLimitSec - seconds));
  return left * POINTS.timeBonusPerSecond;
}
