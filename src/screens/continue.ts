// CONTINUE? screen: big 9..0 countdown, one beep per second, Start accepts, 0 expires.
import { C, SCREEN_H, SCREEN_W } from '../core/palette';
import type { EventSink } from '../core/events';
import type { PadFrame } from '../core/pad';
import { MISC } from '../data/copy';
import type { Progress } from '../game/progress';
import type { Surface } from '../art/surface';
import { bigText, blinkOn } from './util';

export const CONTINUE_SECONDS = 9;
export const FRAMES_PER_COUNT = 60;

export class ContinueState {
  /** 9..0 */
  count = CONTINUE_SECONDS;
  accepted = false;
  expired = false;
  frame = 0;
  /** CONTINUES LEFT shown on screen (snapshot: Session decrements progress after Start). */
  readonly continuesLeft: number;
  private started = false;

  constructor(progress: Progress) {
    this.continuesLeft = progress.continuesLeft;
  }

  update(pad: PadFrame, sink: EventSink): void {
    if (!this.started) {
      this.started = true;
      sink.push({ t: 'music', name: 'jingle:continue' });
    }
    if (this.accepted || this.expired) return;
    if (pad.pressed.start) {
      this.accepted = true;
      sink.push({ t: 'sfx', name: 'select' });
      return;
    }
    // one beep at the start of every second that still has a number to show
    if (this.frame % FRAMES_PER_COUNT === 0 && this.count > 0) sink.push({ t: 'sfx', name: 'beep' });
    this.frame++;
    const c = CONTINUE_SECONDS - Math.floor(this.frame / FRAMES_PER_COUNT);
    if (c !== this.count) this.count = Math.max(0, c);
    if (this.count <= 0) {
      this.count = 0;
      this.expired = true;
      sink.push({ t: 'sfx', name: 'buzzer' });
    }
  }
}

export function drawContinue(s: Surface, st: ContinueState): void {
  const f = st.frame;
  s.clear(C.BLACK);
  // spotlight cone
  for (let y = 0; y < 200; y += 2) {
    const half = 20 + (y >> 1);
    s.setAlpha(0.14);
    s.rect(128 - half, y, half * 2, 2, C.INDIGO);
    s.setAlpha(1);
  }
  bigText(s, MISC.continueTitle, 128, 18, 2, C.WHITE, { align: 'center', shadow: C.INDIGO_D });
  // the digit; pulses in size at the start of each second
  const red = st.count <= 3;
  const punch = st.expired || st.accepted ? 0 : Math.max(0, 6 - (f % FRAMES_PER_COUNT));
  const scale = punch > 3 ? 9 : 8;
  const digit = String(st.count);
  const col = st.accepted ? C.GREEN_L : red ? C.RED : C.YELLOW_L;
  bigText(s, digit, 128 - (scale === 9 ? 2 : 0), 64 - (scale === 9 ? 4 : 0), scale, col, { align: 'center', shadow: red ? C.RED_D : C.ORANGE_D });
  s.text(MISC.continuesLeft(st.continuesLeft), 128, 140, C.WHITE, { align: 'center', shadow: C.BLACK });
  if (st.accepted) s.text('GET READY!', 128, 156, C.GREEN_L, { align: 'center' });
  else if (st.expired) s.text('TOO LATE...', 128, 156, C.RED_L, { align: 'center' });
  else if (blinkOn(f, 40)) s.text('PRESS START', 128, 156, C.WHITE, { align: 'center', shadow: C.BLACK });
  // flavour: fallen agent beside the wagon
  const gy = 232;
  s.rect(0, gy, SCREEN_W, SCREEN_H - gy, C.GRAY_DD);
  s.hline(0, gy, SCREEN_W, C.GRAY_D);
  s.spriteScaled('getaway_wagon', 132, gy - 48, 2, { alpha: 0.7 });
  s.spriteScaled('agent_die', 48, gy - 48, 2, { frame: 2 });
  // a tiny halo/star that bobs over the fallen agent
  const bob = (f >> 3) & 1;
  s.text('*', 64, gy - 60 + bob, C.YELLOW_L);
}
