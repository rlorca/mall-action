// Elevator car state machine. Pure: the mall world feeds it input and reads its position.
import { AGENT_H, CAR_W, FLOOR_COUNT, FLOOR_GAP, SHAFTS, SHAFT_W, floorY, type ShaftDef } from '../core/constants';
import type { Rng } from '../core/rng';

export type CarEvent = { type: 'ding'; shaft: number; floor: number } | { type: 'leave'; shaft: number };

export type CarMode = 'idle' | 'manual' | 'glide';

/** Frames an automatic car waits at a floor before picking the next one (about 2 s). */
export const AUTO_WAIT_FRAMES = 120;

export class Car {
  readonly def: ShaftDef;
  /** Left edge of the car (inside the 32 px shaft column). */
  readonly x: number;
  /** Feet line in pixels. The car is AGENT_H tall, so its top is y - AGENT_H. */
  y: number;
  mode: CarMode = 'idle';
  /** Direction of the current movement: -1 up (smaller y), +1 down, 0 still. */
  dir: -1 | 0 | 1 = 0;
  target: number | null = null; // pixel y of a glide target
  occupied = false;
  calledFloor: number | null = null;
  waitT = 0;

  constructor(
    readonly shaftIndex: number,
    startFloor: number,
  ) {
    this.def = SHAFTS[shaftIndex];
    this.x = this.def.x + (SHAFT_W - CAR_W) / 2;
    this.y = floorY(startFloor);
  }

  get top(): number {
    return this.y - AGENT_H;
  }

  /** Floor index when the car is exactly level with a floor, else null. */
  get floor(): number | null {
    for (let f = 0; f < FLOOR_COUNT; f++) if (floorY(f) === this.y) return f;
    return null;
  }

  get minY(): number {
    return floorY(this.def.minFloor);
  }

  get maxY(): number {
    return floorY(this.def.maxFloor);
  }

  get moving(): boolean {
    return this.mode !== 'idle';
  }

  servesFloor(f: number): boolean {
    return f >= this.def.minFloor && f <= this.def.maxFloor;
  }

  /** Ask the car to come to a floor. Ignored while someone is inside. */
  call(floor: number): void {
    if (this.occupied || !this.servesFloor(floor)) return;
    this.calledFloor = floor;
  }

  /**
   * Advance one frame.
   * @param driveDir the Up/Down the occupant is holding (-1, +1, or 0). Ignored by automatic cars.
   */
  step(driveDir: -1 | 0 | 1, rng: Rng): CarEvent[] {
    const events: CarEvent[] = [];
    const canDrive = this.occupied && !this.def.auto;

    if (canDrive && driveDir !== 0) {
      // Manual: move while held. Reaching the end of the shaft stops the car once, with one ding.
      const atEnd = (driveDir < 0 && this.y <= this.minY) || (driveDir > 0 && this.y >= this.maxY);
      if (atEnd) return this.stop(events); // only dings if it was moving last frame
      this.mode = 'manual';
      this.dir = driveDir;
      this.y += driveDir;
      this.calledFloor = null;
      return events;
    }

    if (this.mode === 'manual') {
      // Released: stop if already level with a floor, otherwise glide on in the same direction.
      if (this.floor !== null) return this.stop(events);
      this.beginGlide(this.nextFloorY(this.dir));
    }

    if (this.mode === 'glide' && this.target !== null) {
      this.y += Math.sign(this.target - this.y);
      if (this.y === this.target) return this.stop(events);
      return events;
    }

    // Idle.
    if (this.occupied) return events; // occupied automatic cars hold still
    if (this.calledFloor !== null) {
      const f = this.calledFloor;
      if (this.floor === f) {
        this.calledFloor = null; // already here: the call is served
      } else {
        this.beginGlide(floorY(f));
      }
      return events;
    }
    if (this.def.auto) {
      this.waitT++;
      if (this.waitT >= AUTO_WAIT_FRAMES) {
        const here = this.floor ?? this.def.minFloor;
        const choices: number[] = [];
        for (let f = this.def.minFloor; f <= this.def.maxFloor; f++) if (f !== here) choices.push(f);
        this.waitT = 0;
        this.beginGlide(floorY(rng.pick(choices)));
      }
    }
    return events;
  }

  /** Stop the car. Emits one ding for the transition from moving to idle. */
  private stop(events: CarEvent[]): CarEvent[] {
    const wasMoving = this.moving;
    this.mode = 'idle';
    this.dir = 0;
    this.target = null;
    this.waitT = 0;
    const f = this.floor;
    if (f !== null) {
      if (this.calledFloor === f) this.calledFloor = null;
      if (wasMoving) events.push({ type: 'ding', shaft: this.shaftIndex, floor: f });
    }
    return events;
  }

  private beginGlide(targetY: number): void {
    this.target = targetY;
    this.dir = targetY > this.y ? 1 : -1;
    this.mode = 'glide';
  }

  /** Pixel y of the next served floor in direction `dir` from the car's (possibly mid-gap) position. */
  private nextFloorY(dir: -1 | 0 | 1): number {
    const pos = (this.y - floorY(0)) / FLOOR_GAP;
    if (dir > 0) {
      const f = Math.ceil(pos);
      if (this.servesFloor(f)) return floorY(f);
    } else if (dir < 0) {
      const f = Math.floor(pos);
      if (this.servesFloor(f)) return floorY(f);
    }
    // Nothing further that way: the nearest served floor.
    let best = this.def.minFloor;
    for (let f = this.def.minFloor; f <= this.def.maxFloor; f++) {
      if (Math.abs(floorY(f) - this.y) < Math.abs(floorY(best) - this.y)) best = f;
    }
    return floorY(best);
  }
}
