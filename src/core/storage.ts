// Safe localStorage wrapper: never throws, works without storage.
const CRT_KEY = 'mallaction.crt';
const HI_KEY = 'mallaction.hi';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadCrt(s: Storage | null = store()): boolean {
  try {
    const v = s?.getItem(CRT_KEY);
    return v === null || v === undefined ? true : v !== '0';
  } catch {
    return true;
  }
}

export function saveCrt(on: boolean, s: Storage | null = store()): void {
  try {
    s?.setItem(CRT_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadHighScore(s: Storage | null = store()): number {
  try {
    const n = Number(s?.getItem(HI_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number, s: Storage | null = store()): void {
  try {
    s?.setItem(HI_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    /* ignore */
  }
}
