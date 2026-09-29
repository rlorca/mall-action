/**
 * MALL world (side-scrolling level). PURE and deterministic: no DOM / canvas / audio, no Math.random / Date.
 * All randomness comes from a Rng seeded from `opts.seed`; all timing is in 60 Hz frames; output leaves through
 * GameEvent pushes into the EventSink handed to `step(pad, sink)`.
 *
 *   const world = createMall({ seed, progress });      // starts with the zip-line arrival
 *   world.step(padFrame, sink);                        // one frame; Session ticks tickPower/tickLevelClock itself
 *
 * Session integration (see src/game/api.ts): `pendingStore` (set when the player walks through an open store
 * door: fade, build the store, call `clearPendingStore()`), `returnFromStore(id, sink)`, `outOfLives`,
 * `resumeAfterContinue(sink)`, `levelClear` (true EXACTLY once), `mapSnapshot()`.
 *
 * ---------------------------------------------------------------------------------------------------------
 * PUBLIC STATE FOR RENDERERS: `world.s` (type MallState in ./types.ts). Plain JSON data. World px, +x right, +y down.
 * Sprite anchors: actors use (x = horizontal CENTRE, y = FEET line). Mall sprites are 16x24.
 * Static geometry is in LAYOUT (./layout.ts); FLOOR_Y[floor] is the walking surface.
 *
 *  s.frame / s.playFrames      total frames simulated / frames since the player got control
 *  s.phase                     'zip' | 'drop' | 'land' | 'selfie' | 'play' | 'clear'  (s.phaseFrames = frames in phase)
 *  s.spygramIndex              index into SPYGRAM_ARRIVAL of the arrival selfie card (show during phase 'selfie', 150 frames)
 *  s.camera {x,y}              top-left of the 256x224 view (below the 16 px HUD), already clamped to the level
 *
 *  s.player                    x (centre), y (feet), facing (-1/1), mode, anim, animFrame, floor, duck, kick, slide (-1/0/1),
 *                              invuln (>0 = blink), frozen (>0 = detained by the cop), hidden, carId, escId/escT/escUp,
 *                              deathCause/deathFrames
 *     mode: 'zip' (anim 'hang', grabbing the cable) | 'drop' | 'land' (anim 'crouch') | 'selfie' | 'walk' | 'air' |
 *           'car' (inside a car; y follows car.y) | 'roof' (on a car roof) | 'escalator' | 'entering' (hidden, door)
 *           | 'booth' (hidden) | 'dying' | 'gone' (level clear, driving off)
 *     anim names: hang, drop, crouch, selfie, stand, walk, jump, kick, duck, slide, ride, frozen, hidden, dying
 *
 *  s.cars[0..2]                A, B, C. x = left edge (car is 32 wide, 36 tall: body spans y-36..y), y = floor plane,
 *                              doorsOpen (open exactly when stopped level), moving, level (Floor|null), mode, calledFloor
 *  s.escalators                [{id:'E1'|'E2', riding}] (geometry in LAYOUT.escalators; animate steps with s.frame)
 *  s.spies[]                   x, y(feet), floor, facing, state, anim (emerge|stand|walk|aimHigh|aimLow|duck|die), animFrame,
 *                              aimFrames (telegraph 1..30), bubble {text,frames}; a 'dying' spy lasts 24 frames
 *  s.bullets[]                 x, y, vx, vy, owner 'player'|'spy' (draw as small dashes)
 *  s.lamps[]                   state 'hang'|'falling'|'shattered'|'gone', x, y = shade bottom (cord goes up to floorY-44)
 *  s.discoBalls[]              state 'hang'|'falling'|'rolling'|'gone', x, y (centre), dir, roll (spin counter)
 *  s.darkened[]                rects {x0,x1,y0,y1,frames}: darken these (lamp shattered), fades over 120 frames
 *  s.janitor                   x, floor '1F', dir, mode 'walk'|'mop', animFrame;  s.wetPatches[] {x0,x1,floor,frames} + sign
 *  s.walkers[]                 x, floor '2F', dir, animFrame, bubble ('HEY!')
 *  s.cop                       x, floor, dir, mode 'patrol'|'chase', bubble ('HEY! STOP RIGHT THERE!'), animFrame
 *  s.kiosks[] / s.kioskPanel   kiosk cooldowns; kioskPanel {frames, storeId, storeFloor, kioskFloor} = small map panel
 *  s.fountains[]               spray > 0 while spraying; s.coins[] {x,y,gold,...}
 *  s.pickups[]                 dropped power-ups {x,y,kind}
 *  s.photoStrip                {frames} (4-frame photo strip popup after first booth exit) | null
 *  s.alarm                     true after the alarm went off (blinking HUD ALARM, tense music)
 *  s.rideHum                   true while riding a moving car;  s.hudFloor = floor nearest the player (LED panel)
 *  s.announce                  last floor announcement {lines, frames} (also emitted as a banner event)
 *  s.music                     'mall' | 'alarm' | 'elevator' - what the mall last asked for
 *  s.levelClearFired / s.outOfLives
 *
 * Door state of a storefront for drawing: storeDoorState(id, progress) -> 'target' (red, blinking) | 'powerup' (blue) |
 * 'closed' (shutter) | 'cleared' (dark). Package stores never entered again once cleared.
 * ---------------------------------------------------------------------------------------------------------
 */
import type { StoreId } from '../../core/events';
import { STORE_BY_ID } from '../../data/stores';
import type { Progress } from '../progress';

export { createMall, MallWorld } from './world';
export type { MallOptions } from './world';
export { LAYOUT } from './layout';
export type { MallState } from './types';
export type { MallWorldApi } from '../api';

export type DoorState = 'target' | 'powerup' | 'closed' | 'cleared';
export function storeDoorState(id: StoreId, progress: Progress): DoorState {
  const d = STORE_BY_ID[id];
  if (d.role === 'closed') return 'closed';
  if (d.role === 'powerup') return 'powerup';
  return progress.packages.includes(id) ? 'cleared' : 'target';
}
