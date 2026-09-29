import { seedFromString } from './rng';
import { BUTTON_NAMES, type ButtonName, type Buttons } from './pad';

export interface QueryOptions {
  seed: number | null;
  debug: boolean;
  gallery: boolean;
  /** ?input=1 shows a live view of the virtual pad (keyboard vs gamepad) for diagnosing input problems. */
  input: boolean;
}

const truthy = (v: string | null): boolean => v !== null && v !== '0' && v.toLowerCase() !== 'false';

export function parseQuery(search: string): QueryOptions {
  const q = new URLSearchParams(search);
  const rawSeed = q.get('seed');
  return {
    seed: rawSeed === null || rawSeed === '' ? null : seedFromString(rawSeed, 0),
    debug: truthy(q.get('debug')),
    gallery: truthy(q.get('gallery')),
    input: truthy(q.get('input')),
  };
}

export interface MallDebug<C> {
  ctx: C;
  /** Advance N simulation frames with the given buttons held (names or a Partial<Buttons>). */
  step(frames: number, buttons?: readonly ButtonName[] | Partial<Buttons>): void;
}

export function toButtons(b?: readonly ButtonName[] | Partial<Buttons>): Partial<Buttons> {
  if (!b) return {};
  if (Array.isArray(b)) {
    const o: Partial<Buttons> = {};
    for (const n of b as readonly ButtonName[]) if (BUTTON_NAMES.includes(n)) o[n] = true;
    return o;
  }
  return { ...(b as Partial<Buttons>) };
}

export function makeDebugApi<C>(ctx: C, stepFn: (held: Partial<Buttons>) => void): MallDebug<C> {
  return {
    ctx,
    step(frames, buttons) {
      const held = toButtons(buttons);
      for (let i = 0; i < frames; i++) stepFn({ ...held });
    },
  };
}

/** Exposes window.__mall = { ctx, step(frames, buttons?) }. stepFn runs ONE sim step with held buttons. */
export function installDebugHooks<C>(ctx: C, stepFn: (held: Partial<Buttons>) => void, target: object = window): MallDebug<C> {
  const api = makeDebugApi(ctx, stepFn);
  (target as { __mall?: MallDebug<C> }).__mall = api;
  return api;
}
