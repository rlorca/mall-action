// OVERLAY: banners (queued, never overlapping), floating score popups, screen shake / flash state, on-screen toasts
// and scene fades. All LOGIC (queueing, timing, shake) is DOM-free and deterministic; only draw()/drawFade() touch a
// Surface. Fed with GameEvents via handle(); update() once per unpaused simulation frame.
import { C } from '../core/palette';
import type { GameEvent } from '../core/events';
import type { Surface } from '../art/surface';

export const BANNER_DEFAULT_FRAMES = 150;
export const POPUP_FRAMES = 60;
export const TOAST_DEFAULT_FRAMES = 90;
/** Max banners waiting behind the visible one (older waiting ones are dropped when exceeded). */
export const BANNER_QUEUE_MAX = 4;
/** When banners are waiting, the visible one is shown for at most this many frames so the queue drains. */
export const BANNER_BACKLOG_FRAMES = 70;
export const BANNER_MAX_LINES = 5;
/** Longest line (chars) a banner box will hold: 8px glyphs, 8px padding each side, 8px screen margin each side. */
export const BANNER_MAX_CHARS = 28;
const PA_MAX_CHARS = 25; // leaves room for the speaker icon

type BannerKind = 'info' | 'alarm' | 'pa' | 'item' | 'package' | 'floor';

export interface BannerItem {
  lines: string[];
  kind: BannerKind;
  frames: number;
  t: number;
}
export interface PopupItem {
  x: number;
  y: number;
  text: string;
  color: number;
  t: number;
}

/** Word-wrap `lines` to at most `maxChars` per line (hard-cutting over-long words), at most `maxLines` lines. */
export function wrapBannerLines(lines: readonly string[], maxChars = BANNER_MAX_CHARS, maxLines = BANNER_MAX_LINES): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const words = String(raw).trim().split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;
    let cur = '';
    for (let w of words) {
      while (w.length > maxChars) {
        if (cur) {
          out.push(cur);
          cur = '';
        }
        out.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= maxChars) cur += ` ${w}`;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out.slice(0, maxLines);
}

function hash32(n: number): number {
  let h = Math.imul(n + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class Overlay {
  private active: BannerItem | null = null;
  private queue: BannerItem[] = [];
  private popups: PopupItem[] = [];
  private toastText = '';
  private toastLeft = 0;
  private toastTotal = 0;
  private shakeLeft = 0;
  private shakeTotal = 0;
  private shakeMag = 0;
  private shakeStep = 0;
  private flashLeft = 0;
  private flashTotal = 0;
  private clock = 0;

  /** Consumes banner / popup / shake / flash events; ignores everything else. */
  handle(ev: GameEvent): void {
    switch (ev.t) {
      case 'banner':
        this.pushBanner(ev.lines, ev.kind ?? 'info', ev.frames ?? BANNER_DEFAULT_FRAMES);
        break;
      case 'popup':
        this.popups.push({ x: ev.x, y: ev.y, text: String(ev.text), color: ev.color ?? C.WHITE, t: 0 });
        if (this.popups.length > 24) this.popups.shift();
        break;
      case 'shake':
        if (ev.frames > 0 && ev.mag > 0) {
          if (this.shakeLeft <= 0 || ev.mag * ev.frames >= this.shakeMag * this.shakeLeft) {
            this.shakeLeft = ev.frames;
            this.shakeTotal = ev.frames;
            this.shakeMag = ev.mag;
          }
        }
        break;
      case 'flash':
        if (ev.frames > 0) {
          this.flashLeft = Math.max(this.flashLeft, ev.frames);
          this.flashTotal = Math.max(this.flashTotal, ev.frames);
        }
        break;
      default:
        break;
    }
  }

  private pushBanner(lines: readonly string[], kind: BannerKind, frames: number): void {
    const wrapped = wrapBannerLines(lines, kind === 'pa' ? PA_MAX_CHARS : BANNER_MAX_CHARS);
    if (wrapped.length === 0) return;
    const key = wrapped.join('\n');
    const same = (b: BannerItem): boolean => b.kind === kind && b.lines.join('\n') === key;
    if (this.active && same(this.active)) {
      this.active.t = 0; // identical banner re-announced: just restart it
      return;
    }
    if (this.queue.some(same)) return;
    this.queue.push({ lines: wrapped, kind, frames: Math.max(1, Math.round(frames)), t: 0 });
    while (this.queue.length > BANNER_QUEUE_MAX) this.queue.shift();
    if (!this.active) this.active = this.queue.shift() ?? null;
  }

  /** Once per unpaused sim frame. */
  update(): void {
    this.clock++;
    if (this.active) {
      this.active.t++;
      const limit = this.queue.length > 0 ? Math.min(this.active.frames, BANNER_BACKLOG_FRAMES) : this.active.frames;
      if (this.active.t >= limit) this.active = this.queue.shift() ?? null;
    } else if (this.queue.length) {
      this.active = this.queue.shift() ?? null;
    }
    for (const p of this.popups) p.t++;
    this.popups = this.popups.filter((p) => p.t < POPUP_FRAMES);
    if (this.toastLeft > 0) this.toastLeft--;
    if (this.shakeLeft > 0) {
      this.shakeLeft--;
      this.shakeStep++;
    }
    if (this.flashLeft > 0) {
      this.flashLeft--;
      if (this.flashLeft === 0) this.flashTotal = 0;
    }
  }

  /** Deterministic decaying screen shake (whole pixels) for main to apply to the canvas draw. */
  shakeOffset(): { x: number; y: number } {
    if (this.shakeLeft <= 0 || this.shakeTotal <= 0) return { x: 0, y: 0 };
    const m = Math.round((this.shakeMag * this.shakeLeft) / this.shakeTotal);
    if (m <= 0) return { x: 0, y: 0 };
    const h = hash32(this.shakeStep);
    const span = m * 2 + 1;
    return { x: (h % span) - m, y: ((h >>> 8) % span) - m };
  }

  /** 0..1 white-flash strength. */
  flashAlpha(): number {
    if (this.flashLeft <= 0 || this.flashTotal <= 0) return 0;
    return Math.min(1, (this.flashLeft / this.flashTotal) * 0.8);
  }

  toast(text: string, frames = TOAST_DEFAULT_FRAMES): void {
    this.toastText = text.slice(0, 28);
    this.toastLeft = Math.max(1, frames);
    this.toastTotal = this.toastLeft;
  }

  reset(): void {
    this.active = null;
    this.queue = [];
    this.popups = [];
    this.shakeLeft = this.shakeTotal = this.shakeMag = this.shakeStep = 0;
    this.flashLeft = this.flashTotal = 0;
    this.toastLeft = 0;
    this.toastText = '';
  }

  // ---- inspection (tests / debugging) ----
  get currentBanner(): Readonly<BannerItem> | null {
    return this.active;
  }
  get queuedBanners(): number {
    return this.queue.length;
  }
  get popupCount(): number {
    return this.popups.length;
  }
  get toastActive(): boolean {
    return this.toastLeft > 0;
  }

  // ---- drawing ----

  draw(s: Surface, cam: { x: number; y: number }): void {
    this.drawPopups(s, cam);
    if (this.active) this.drawBanner(s, this.active);
    this.drawToast(s);
  }

  private drawPopups(s: Surface, cam: { x: number; y: number }): void {
    for (const p of this.popups) {
      const tw = p.text.length * 8;
      const rise = Math.floor(p.t * 0.4);
      let x = Math.round(p.x - cam.x - tw / 2);
      let y = Math.round(p.y - cam.y + 16 - 10 - rise);
      x = Math.max(0, Math.min(256 - tw, x));
      y = Math.max(16, Math.min(232, y));
      // fade: blink out over the last 18 frames
      if (p.t > POPUP_FRAMES - 18 && ((p.t >> 1) & 1) === 1) continue;
      s.text(p.text, x, y, p.color, { shadow: C.BLACK });
    }
  }

  private drawBanner(s: Surface, b: BannerItem): void {
    const isPa = b.kind === 'pa';
    const lines = b.lines;
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    const iconW = isPa ? 14 : 0;
    const big = b.kind === 'package' || b.kind === 'item';
    const padX = big ? 12 : 8;
    const padY = big ? 9 : 6;
    let w = longest * 8 + padX * 2 + iconW;
    w = Math.min(248, Math.max(w, big ? 120 : 64));
    const h = lines.length * 10 - 2 + padY * 2;
    const x = Math.round((256 - w) / 2);
    let y: number;
    switch (b.kind) {
      case 'floor': y = 240 - 8 - h; break;
      case 'package':
      case 'item': y = 16 + Math.round((176 - h) / 2) - 8; break;
      case 'alarm': y = 30; break;
      case 'pa': y = 24; break;
      default: y = 16 + 22; break;
    }
    y = Math.max(16, Math.min(240 - h, y));
    const t = b.t;
    const blink = (t >> 3) & 1;
    let bg: number = C.BLACK;
    let border: number = C.WHITE;
    let fg: number = C.WHITE;
    switch (b.kind) {
      case 'floor': bg = C.BLUE_D; border = C.CYAN_L; break;
      case 'package': bg = C.INDIGO_D; border = (t >> 2) & 1 ? C.YELLOW_L : C.PINK; fg = C.YELLOW_L; break;
      case 'item': bg = C.PURPLE_D; border = (t >> 2) & 1 ? C.CYAN_L : C.YELLOW_L; fg = C.WHITE; break;
      case 'alarm': bg = blink ? C.RED_D : C.RED; border = blink ? C.WHITE : C.YELLOW_L; fg = C.WHITE; break;
      case 'pa': bg = C.INDIGO_D; border = C.SKY_L; fg = C.WHITE; break;
      default: break;
    }
    s.rect(x, y, w, h, border);
    s.rect(x + 1, y + 1, w - 2, h - 2, C.BLACK);
    s.rect(x + 2, y + 2, w - 4, h - 4, bg);
    if (big) s.frame(x + 4, y + 4, w - 8, h - 8, border === C.YELLOW_L ? C.ORANGE : C.GRAY_M);
    const textX0 = x + padX + iconW;
    const textW = w - padX * 2 - iconW;
    if (isPa) {
      s.sprite('speaker_note', x + 6, y + Math.round((h - 8) / 2), { frame: (t >> 4) & 1 });
    }
    lines.forEach((ln, i) => {
      const cx = textX0 + textW / 2;
      s.text(ln, cx, y + padY + i * 10, fg, { align: 'center', shadow: b.kind === 'alarm' || big ? C.BLACK : undefined });
    });
  }

  private drawToast(s: Surface): void {
    if (this.toastLeft <= 0) return;
    const text = this.toastText;
    const w = text.length * 8 + 16;
    const h = 16;
    const x = Math.round((256 - w) / 2);
    const y = 16 + 4;
    s.rect(x, y, w, h, C.WHITE);
    s.rect(x + 1, y + 1, w - 2, h - 2, C.BLACK);
    s.frame(x + 3, y + 3, w - 6, h - 6, C.GRAY_M);
    s.text(text, 128, y + 4, C.YELLOW_L, { align: 'center' });
  }
}

/** NES-style stepped fade to black: amount 0..1 quantised to 5 levels (0, 25, 50, 75, 100 % black). */
export function drawFade(s: Surface, amount: number): void {
  const a = Math.max(0, Math.min(1, amount));
  const level = Math.round(a * 4);
  if (level <= 0) return;
  if (level >= 4) {
    s.rect(0, 0, 256, 240, C.BLACK);
    return;
  }
  s.setAlpha(level / 4);
  s.rect(0, 0, 256, 240, C.BLACK);
  s.setAlpha(1);
}
