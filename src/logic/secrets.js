export const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

export function createKonami() {
  let i = 0;
  return {
    push(btn) {
      if (btn === KONAMI[i]) {
        i++;
        if (i === KONAMI.length) { i = 0; return true; }
      } else if (btn === 'up') {
        i = i === 2 ? 2 : 1; // "up up up" keeps the "up up" prefix
      } else {
        i = 0;
      }
      return false;
    },
  };
}

export const JOKE_ITEMS = ['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)'];
export const pickJokeItem = (rng) => rng.pick(JOKE_ITEMS);
