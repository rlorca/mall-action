import { chromium, type Browser, type Page } from 'playwright-core';

/**
 * Browser playtest helpers (NOT part of CI): drives the locally installed Chrome with WebGL on, collects console
 * errors and page errors, takes screenshots of the real presented canvas (CRT shader included).
 *   npm run dev   (in another terminal), then   npx tsx scripts/playtest.ts
 */
export interface Session {
  browser: Browser;
  page: Page;
  errors: string[];
  logs: string[];
}

export async function open(url: string, viewport = { width: 1280, height: 800 }): Promise<Session> {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors: string[] = [];
  const logs: string[] = [];
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') errors.push(`[console.${t}] ${m.text()}`);
    else logs.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  return { browser, page, errors, logs };
}

export async function shot(s: Session, path: string): Promise<void> {
  await s.page.screenshot({ path });
}

/** Step the game N frames holding buttons via the debug API (deterministic). */
export async function step(s: Session, frames: number, buttons: string | number = 0): Promise<unknown> {
  return s.page.evaluate(([f, b]) => (window as any).__mall.step(f, b), [frames, buttons] as const);
}

export async function tap(s: Session, buttons: string): Promise<unknown> {
  return s.page.evaluate((b) => (window as any).__mall.tap(b), buttons);
}

export async function state(s: Session): Promise<any> {
  return s.page.evaluate(() => (window as any).__mall.state());
}
