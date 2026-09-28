export function createFixedStep(stepMs = 1000 / 60, maxSteps = 5) {
  let acc = 0;
  return {
    advance(dtMs, update) {
      acc += dtMs;
      let n = 0;
      while (acc >= stepMs && n < maxSteps) { update(); acc -= stepMs; n++; }
      if (n === maxSteps) acc = 0;
      return n;
    },
  };
}
