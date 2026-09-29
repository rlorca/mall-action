# Store world (top-down rooms)

Pure, deterministic, 60 Hz rules for the store interiors. No DOM/canvas/audio; output is `GameEvent`s plus plain public state
that renderers read every frame. Types live in `types.ts`; the world in `index.ts`; room designs in `templates.ts`;
fixture-content sampling in `layout.ts`; tile vocabulary in `tilekinds.ts` (shared with the tile art).

```ts
import { createStore, canEnterStore } from './store';
if (canEnterStore(progress, id)) {
  const w = createStore({ id, seed, progress });   // seed: guard behaviour; layout comes from progress.seed
  w.step(padFrame, sink);                          // every unpaused frame
}
// w.exited -> fade back to mall; w.outOfLives -> continue / game over; w.resumeAfterContinue(sink) after a continue.
```
The Session ticks `tickPower` / `tickLevelClock` itself; the store never does. `createStore` for a closed store or a
cleared target returns a world with `exited = true` and `refused = true`. The first `step()` emits music `store:<id>`.

## Coordinates
Room pixels, top-left origin, +y down, 16 px tiles. Sprites are 16x16 drawn with their top-left at `(x, y)` (round it).
Bullets/particles/puffs use their centre. The viewport is `VIEW_W x VIEW_H` = 256x176 (below the 16 px HUD); draw the
room at `-camera.x, -camera.y`. Every current room is 16x11 tiles so `camera` is `{0,0}`; bigger rooms scroll.

## Public state (read-only for renderers)
| Field | Meaning |
|---|---|
| `room` | `{w,h,pxW,pxH,theme,rows,doorCol,doorRow}`; `rows[ty][tx]` are the tile chars of `tilekinds.ts` (`theme` picks `tile_<theme>_*`). Fixtures/shelves are drawn from the lists below, not from `rows`, so open/closed looks are right. |
| `camera` | `{x,y}` viewport top-left, integer, clamped to the room. |
| `player` | `x,y,facing (up/down/left/right), anim (idle/walk/search/hold/stun/die/hidden), animT (frames in anim), blink (true = do NOT draw this frame), invuln, stun, held {kind:'package'/'powerup'/'item', name}, heldT`. `hold` = arms up with `held` drawn overhead. Cinnabomb flashing: read `progress.power.invincible`. |
| `guards[]` | `index,type (spy/bot),x,y,facing,anim (idle/walk/aim/throw/stun/dead/gone),animT,hp,maxHp,alive,stunT,hurtT`. `aim` is the telegraph pose; `throw` the shoe toss; `gone` = skip drawing; `hurtT>0` = white flash; bots show `hp` damage. (Other fields are internal AI.) |
| `bullets[]` | `x,y` (centre), `vx,vy`, `from`: `player`, `spy`, `shoe` (draw a small shoe). |
| `fixtures[]` | `index,tx,ty,kind (fixture=S / fixture2=T / fitting=F), open` (draw the `_open` tile), `mark` (radar: flashing "!" above; only unopened package fixtures), `content` (null until opened, then `{kind:'package'/'powerup'/'trap'/'nothing'}`), `revealed`+`revealT` (fitting room whose curtain is open after a spy jumped out; still unsearched). |
| `toyShelves[]` | `tx,ty,released` -> `tile_toyshelf` vs `tile_toyshelf_empty`. |
| `toys[]` | `x,y,dir,animT` marching wind-up toys (walk cycle from `animT`). |
| `puffs[]` | `x,y,t,ttl,kind (smoke/poof)` smoke clouds (centre). `particles[]` sparks (`x,y,t,ttl`). |
| `bubbles[]` | `guard` (index into `guards`), `text`, `t`, `ttl` speech bubbles above that guard (<= 28 chars, keep on screen). |
| `banner` | `{lines,t,ttl,kind}` or null (the same banners are also pushed as events). |
| `search` | `{fixture,t,dur,progress 0..1}` or null: progress bar. |
| `strip` | Bottom strip: `title` (store name), `text` ('' / 'PRESS X TO SEARCH' / 'SEARCHING...'), `mode` (none/ready/searching), `bar` (0..1 or null). |
| `egg` | GameStonk cave scene or null: `phase` (talk/item/get/done), `clerk {x,y,visible}` (draw an old man; puff when he vanishes), `tvs[]` tile positions of the two flickering demo TVs, `pedestal {tx,ty}`, `lines[]` typewriter text typed so far (draw a box while phase==='talk'), `item` / `itemVisible` (draw the item on the pedestal). |
| `booth` | `{tx,ty,active,nowPlaying}` or null; while `nowPlaying` is non-null draw "NOW PLAYING: SIDE B". |
| `dying`, `cleared`, `exited`, `outOfLives`, `refused`, `frame` | flags / frame counter. |

Events pushed: `sfx` (shot, enemyShot, tick, fanfare, powerup, smoke, shriek, blip, chime, ping, hurt, death, door),
`music` (`store:<id>`, `booth`, `jingle:package`, `jingle:itemget`; the store song is re-emitted when a jingle/booth ends),
`banner`, `shake`, `popup` (room px). Test helpers: `stateHash()`, `snapshot()`, `debugContent(i)` (do not use in renderers).

## Rules summary
Player 1.25 px/f (x1.35 sneakers, x1.5 juice), vertical priority, 12x12 hitbox, 6 px corner assist. Search: fresh press of
B on a touched, unopened searchable fixture (front or sides, 6 px tolerance, diagonals count) runs 45 frames on its own
(33/30 with sneakers/juice). Fresh direction press or A cancels. Player bullets 3 px/f (rapid 4 and max 4, spread 3-way),
spy bullets 2 px/f after a 30-frame aim telegraph; 90 frames grace after entering/respawning. Bots take 3 hits.
Fitting rooms: 25% spy reveal on the first search only. KGB shelves: shooting releases 3 toys once per shelf.

## Templates (16x11, door at (8,10), spawn (8,9))
forever12 (fashion: 4 fitting rooms along the top, racks, cash counter), radioshock (electronics: shelf wall, central counter,
patrol bot), crookstone (gadgets: massage-chair block, pedestals), gamestonk (games: clerk between two `V` TVs, pedestal `P`
in a counter niche), kgbtoys (toys: `K` shelf clusters top-left/right, bins), spendersgifts (novelty: lamp displays),
sambaddy (music: record bins, listening booth `B` top centre), sharperimagine (gadgets, different layout: symmetric
orb pedestals, patrol bot), hotspy (food: kitchen counter, tables), footlockpicker (sports: shoe wall, bench row).
