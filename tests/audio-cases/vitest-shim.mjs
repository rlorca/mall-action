// Minimal vitest-compatible surface (describe/it/expect/vi/beforeEach/afterEach) on top of node:test and
// node:assert, so the ported audio tests keep their original assertions unchanged.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

export { afterEach, beforeEach, describe, it };

function matchers(actual, msg, negate) {
  const check = (pass, text) => {
    if (negate ? pass : !pass) assert.fail((msg ? msg + ': ' : '') + (negate ? 'not ' : '') + text);
  };
  const show = (v) => { try { return typeof v === 'string' ? JSON.stringify(v) : String(v); } catch { return '?'; } };
  return {
    toBe: (e) => check(Object.is(actual, e), `expected ${show(actual)} to be ${show(e)}`),
    toEqual: (e) => {
      let ok = true;
      try { assert.deepStrictEqual(actual, e); } catch { ok = false; }
      check(ok, `expected ${show(actual)} to equal ${show(e)}`);
    },
    toBeNull: () => check(actual === null, `expected ${show(actual)} to be null`),
    toBeUndefined: () => check(actual === undefined, `expected ${show(actual)} to be undefined`),
    toBeGreaterThan: (e) => check(actual > e, `expected ${show(actual)} > ${show(e)}`),
    toBeGreaterThanOrEqual: (e) => check(actual >= e, `expected ${show(actual)} >= ${show(e)}`),
    toBeLessThan: (e) => check(actual < e, `expected ${show(actual)} < ${show(e)}`),
    toBeLessThanOrEqual: (e) => check(actual <= e, `expected ${show(actual)} <= ${show(e)}`),
    toBeCloseTo: (e, digits = 2) =>
      check(Math.abs(actual - e) < Math.pow(10, -digits) / 2, `expected ${show(actual)} close to ${show(e)} (${digits})`),
    toHaveLength: (n) => check(actual.length === n, `expected length ${actual.length} to be ${n}`),
    toMatch: (re) => check(typeof re === 'string' ? actual.includes(re) : re.test(actual), `expected ${show(actual)} to match ${show(re)}`),
    toThrow: (re) => {
      let err;
      let threw = false;
      try { actual(); } catch (e) { threw = true; err = e; }
      let ok = threw;
      if (threw && re !== undefined) ok = typeof re === 'string' ? String(err?.message).includes(re) : re.test(String(err?.message));
      check(ok, `expected function to throw${re ? ' ' + re : ''}${threw ? ` (threw: ${err?.message})` : ''}`);
    },
  };
}

export function expect(actual, msg) {
  return { ...matchers(actual, msg, false), not: matchers(actual, msg, true) };
}

export const vi = {
  useFakeTimers() { mock.timers.enable({ apis: ['setInterval', 'setTimeout'] }); },
  useRealTimers() { mock.timers.reset(); },
  advanceTimersByTime(ms) { mock.timers.tick(ms); },
};
