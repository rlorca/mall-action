export const HZ = 60;
export const FRAME_MS = 1000/HZ;
export const MAX_CATCHUP = 5;
export function createClock(onStep, onDraw) {
  let previous, accumulated = 0;
  return {
    frame(now) {
      accumulated = Math.min(MAX_CATCHUP * FRAME_MS, accumulated + Math.max(0,now - (previous ?? now)));
      previous = now;
      let count = 0;
      while (accumulated + 1e-6 >= FRAME_MS) {
        onStep();
        count++;
        accumulated -= FRAME_MS;
      }
      onDraw();
      return count;
    },
    reset() { previous = undefined; accumulated = 0; }
  };
}
