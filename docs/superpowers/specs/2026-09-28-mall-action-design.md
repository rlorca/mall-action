# Mall Action — Design Spec

Date: 2026-09-28
Status: Draft for review

## 1. Intent

A browser-playable spiritual successor to Taito's *Elevator Action* (1983), set in a
large shopping mall instead of an office building. The Elevator Action lineage must be
obvious (red target doors, elevator shafts, crushing, shooting lights, duck/jump
gunfights, "collect everything before you exit" rule). The mall is a side-scroller in
the vein of Elevator Action / Keystone Kapers; entering a store switches to a top-down,
Zelda-style room. Visual target: top-tier NES/arcade 8-bit (Super Mario Bros. 3, The
Legend of Zelda, Prison Break arcade).

**Success criteria for this build (vertical slice):**
- One complete, polished mall level playable start-to-finish in a desktop browser.
- Both views (side-scroll mall, top-down store) with smooth transitions.
- Power-ups, a Select-button map, title / game-over / level-clear screens, chiptune audio.
- Level loops with increased difficulty after clearing.
- No external image or audio assets; everything generated in code.

**Non-goals for this build:** multiple distinct levels, anchor (multi-screen) stores,
mobile touch controls, online high scores, save games.

## 2. Tech

- **Vite** dev server/build, plain **ES modules** (JavaScript, no TypeScript).
- **PixiJS v8** for rendering; **pixi-filters** `CRTFilter` for optional arcade-monitor
  post-processing (toggle with `C`, on by default).
- **Vitest** for unit tests.
- Internal resolution **256×240** (NES). Rendered into a Pixi container at native size,
  scaled by the largest integer factor that fits the window, nearest-neighbour sampling,
  integer positions (`roundPixels`). Letterboxed in black.
- Fixed-timestep loop at 60 Hz; rendering decoupled.
- WebAudio synthesizer emulating NES channels (2 pulse, 1 triangle, 1 noise).

## 3. Game Structure

### 3.1 Flow

`Title → Mall (level start: agent drops onto roof) ⇄ Store → … → Level Clear (drive
away from parking) → Mall (next loop, harder)`. `Game Over` when lives reach 0, returns
to Title. `Map` and `Pause` are overlays on Mall/Store.

### 3.2 Mall layout (level 1)

- **6 floors**, top to bottom: `R` (roof, entry), `4F`, `3F`, `2F`, `1F`, `P` (parking,
  exit). Each floor ~3 screens wide (768 px). Floor height 32 px of walkable band plus
  ceiling; total mall height scrolls vertically too (camera follows player in both axes).
- **Elevators:** 3 shafts at fixed x positions spanning various floor ranges (not all
  shafts reach all floors, forcing route planning as in the original). A car moves only
  when the player rides it (up/down input), otherwise idles at a floor; some cars are
  AI-driven and move on their own on a timer.
- **Escalators:** 2 escalator pairs connecting adjacent floors; player walks onto the
  base and is carried diagonally (press up/down at base to board).
- **Stores:** 12 storefronts across 4F–1F. 6 are **target stores** (red flashing doors),
  3 are **power-up shops** (blue doors, contain only power-up/empty fixtures and a
  guard), 3 are **closed** (shutter down, decorative).
- **Store names:** every storefront has a parody name riffing on a real (mostly
  80s/90s-mall) chain, shown on a pixel-art sign above its door and in the HUD when
  inside. Names are puns, not replicas: no real logos, trade dress or exact names.

  | Store | Riffs on | Role | Theme |
  |---|---|---|---|
  | Forever 12 | Forever 21 | target | Fashion |
  | RadioShock | RadioShack | target | Electronics |
  | KGB Toys | KB Toys | target | Toys |
  | Hot Spy on a Stick | Hot Dog on a Stick | target | Food Court |
  | Foot Lockpicker | Foot Locker | target | Sports |
  | Sam Baddy | Sam Goody | target | Music |
  | Crookstone | Brookstone | power-up shop | Gadgets |
  | Sharper Imagine | Sharper Image | power-up shop | Gadgets |
  | Spender's Gifts | Spencer's Gifts | power-up shop | Novelty |
  | Blockbluster Video | Blockbuster | closed | — |
  | Circuit Pity | Circuit City | closed | — |
  | Borderline Books | Borders | closed | — |

  Floor placement of stores is fixed in level data; roles are fixed for this build.
- **Storefronts show what they sell.** Each facade is ~80 px wide: sign on top, door in
  the middle, a display window on each side with themed merchandise sprites, so the
  shop is readable at a glance without the sign:

  | Store | Window display |
  |---|---|
  | Forever 12 | mannequins in outfits, clothing rack |
  | RadioShock | stacked TVs (flickering static/test pattern), walkie-talkies |
  | KGB Toys | teddy bears in ushankas, robot toys, toy rockets |
  | Hot Spy on a Stick | striped counter, lemonade tub being pumped, corn dogs |
  | Foot Lockpicker | sneaker wall, basketballs, jerseys |
  | Sam Baddy | cassettes & vinyl, poster, boombox (bouncing speakers) |
  | Crookstone | massage chair, gadget pedestals |
  | Sharper Imagine | robot vacuum, gadget pedestals, glowing orb |
  | Spender's Gifts | lava lamp (animated), black-light posters, plasma ball |
  | Blockbluster Video | rolled-down shutter, "FOR LEASE" sign, faded VHS poster |
  | Circuit Pity | shutter, dark dead TVs |
  | Borderline Books | shutter, "CLOSING SALE" banner, empty shelves |

  Displays use 1–3 frame idle animations (TV static, lava lamp, pump) to keep the mall
  alive. The door colour still carries the role (red = package, blue = power-up shop,
  shutter = closed); a cleared target store dims its window lights. Display sprites are
  also reused as fixtures inside the matching store for visual continuity.
- **Hanging lights:** one per ~screen per floor; shoot to drop it; falling light kills
  spies beneath it (bonus), and briefly darkens that section.
- **Decor:** glass railings, fountains, benches, plants, store signs, mall directory
  kiosks (decorative nod; Select is the real map).

### 3.3 Rules

- Collect all 6 packages, then reach `P` and step into the getaway car → Level Clear.
- Reaching `P` with packages missing: car won't start; message "PACKAGES LEFT: n" and
  the player must go back (original's rule).
- 3 lives at start; extra life at 20 000 points and from 1-Up.
- **Alarm timer:** after 150 s on a level, the mall alarm sounds: music changes,
  spies spawn faster and move 25% faster until level clear.
- **Scoring:** spy shot 100, spy crushed by elevator 300, spy killed by falling light
  300, package 500, power-up 50, level clear 1000 + time bonus.
- **Difficulty per loop:** spy speed +10%, spawn interval −15%, enemy fire rate +15%,
  alarm timer −20 s (floors capped).

## 4. Mall View (side-scroll)

### 4.1 Player (the Agent)

- Walk left/right (1 px/frame; 1.5 with Sneakers).
- **A:** shoot horizontally (bullet at chest height; while ducking, at low height).
  Max 2 player bullets on screen (4 with Rapid Fire).
- **B:** jump (arc ~20 px high). **B while moving toward an adjacent spy:** jump-kick
  (kills on contact during the jump).
- **Down (not at elevator/escalator):** duck — dodges high shots.
- **Up/Down inside an elevator car:** move car.
- **Up at a door:** enter store (only target/power-up stores open).
- Dies from: bullet hit (unless Armor), contact with spy (not during jump-kick),
  crushed by elevator car, falling light.

### 4.2 Spies

- Spawn from store doors (non-cleared) and from elevator cars, capped at 4 on screen.
- Behaviours: walk toward player, stop and shoot (high or low shot, telegraphed by
  pose), occasionally duck to dodge the player's shot, ride elevators.
- One-hit kill. Drop a power-up 5% of the time.

### 4.3 Elevators

- Car is a solid platform; shaft is empty space below/above floors where the car isn't.
- Crush detection: car moving down onto an entity in the shaft below it (or up into
  one above) kills it. Applies to player and spies.
- Standing in an empty shaft opening at a floor: player falls to the car below (or
  shaft bottom → death), matching original danger.

## 5. Store View (top-down)

- Entering a door fades to the store scene; exiting (walk onto the door tile) fades
  back to the mall at that door.
- **Room model:** a tilemap of arbitrary size with a camera that follows the player
  and clamps to room bounds. For this build all rooms are one screen (256×176 play
  area, HUD above). This is deliberate: anchor stores (§10) reuse the same system.
- **Player:** 4-way movement (1 px/frame), **A** shoots in the facing direction,
  **B** searches when adjacent to and facing a searchable fixture (hold ~0.75 s,
  progress bar; 0.4 s with Sneakers).
- **Fixtures:** racks, shelves, counters, fitting rooms, display cases, freezers
  (depending on theme). Each contains one of: **package** (exactly one in target
  stores), **power-up**, **nothing**, **trap** (smoke puff: player stunned 1 s).
  Searched fixtures show an "opened" state.
- **Guards:** 1–3 per store.
  - *Spy:* moves on a grid, shoots in straight lines when aligned with player.
  - *Security bot:* patrols a fixed route, reverses on contact with walls; contact
    kills.
  Guards respawn if the player leaves and re-enters a store with its package still
  inside.
- **Themes (8):** Fashion, Electronics, Toys, Food Court, Sports, Music (the six
  target stores), plus Gadgets and Novelty (power-up shops). Each has its own tiles,
  palette, fixture set, and layout template; the two Gadgets shops share a tileset
  with different layouts. Store names per §3.2.
- Once the package is collected the store is **cleared**: its mall door goes dark and
  no longer spawns spies.

## 6. Power-ups

| Power-up | Effect | Duration |
|---|---|---|
| Rapid Fire | 2× fire rate, more bullets on screen | 20 s |
| Spread Shot | 3-way shot | 20 s |
| Armor Vest | absorbs one hit | until hit |
| Sneakers | faster walk, higher jump, faster search | 20 s |
| Radar | reveals package fixture in stores and on map | rest of level |
| 1-Up | +1 life | instant |

Only one timed weapon (Rapid/Spread) active at a time; picking another replaces it.
Armor, Sneakers, Radar stack with weapons. Power-ups persist across mall/store
transitions; timers pause while the map is open.

## 7. Map, HUD, Screens

- **Map (Select):** pauses game; full-screen NES-style schematic of all floors,
  elevator shafts (with current car positions), escalators and stores. Store colour
  code: red = package remaining, grey = cleared, blue = power-up shop, dark = closed.
  Player position blinks. With Radar: target stores show a "!" marker. Select closes.
  From inside a store the map shows the mall with the current store highlighted.
- **HUD (top 16 px strip):** score, lives, `PKG n/6`, active power-up icon + timer bar,
  floor indicator styled as an elevator panel (`R`, `4F`…`P`; in store shows store
  name).
- **Pause (Start):** "PAUSE" overlay, music ducks.
- **Title:** logo, animated mall facade, "PRESS START", controls hint, high score
  (session only).
- **Level Clear:** car drives off, tally of bonus, "LOOP n".
- **Game Over:** "GAME OVER", score, back to Title.

## 8. Graphics & Audio

- **Palette:** fixed ~54-colour NES-like master palette; each sprite uses ≤3 colours +
  transparent.
- **Sprites / tiles** are authored in source as string grids with a palette map and
  converted to Pixi textures at boot (`gfx/`). Sizes: characters 16×16 (mall 16×24
  for the agent/spies to read like Elevator Action), tiles 8×8 / 16×16.
- **Animation:** walk cycles (2–3 frames), shoot, duck, jump, death, door open,
  elevator doors, blinking red doors, light swing/fall, smoke, pickup sparkle.
- **Effects:** screen shake on crush/light fall, brief palette flash on package
  pickup, fade transitions between views.
- **Audio:** music sequencer on NES-style channels: Mall theme, Store theme,
  Alarm variant, Title, Level Clear jingle, Game Over. SFX: shot, enemy shot, jump,
  elevator ding + hum, crush, light fall, search tick, package fanfare, power-up,
  hurt/death, door. Audio starts on first input (autoplay policy). `M` mutes.

## 9. Controls

| Action | Keyboard | Gamepad (standard mapping) |
|---|---|---|
| Move | Arrows / WASD | D-pad / left stick |
| A (shoot) | Z / J | Button 0 (A / Cross) |
| B (jump / search) | X / K | Button 1 (B / Circle) |
| Select (map) | Shift / Tab | Button 8 |
| Start (pause) | Enter | Button 9 |
| Toggle CRT | C | — |
| Mute | M | — |

## 10. Future: Anchor Stores (not in this build)

Large department stores (Sears-style) inside the mall:
- In the mall view an anchor occupies a wide facade spanning **two floors**, with an
  entrance on each floor.
- Parody names in the same spirit, e.g. **Spears** (Sears), **J.C. Pennyless**
  (JCPenney), **Spacy's** (Macy's).
- Inside: a multi-screen scrolling tilemap and/or several connected departments,
  possibly with internal escalators, multiple packages, and more guards.
- Enabled by the §5 room model (arbitrary-size tilemaps + camera) and by mall store
  data allowing a store to reference multiple doors. No rework of the core systems
  should be required.

## 11. Architecture

```
index.html
src/
  main.js              boot Pixi, root 256×240 stage, integer scaling, CRT filter, scene manager
  core/
    loop.js            fixed-step update + render callback
    input.js           keyboard + Gamepad API → virtual NES pad (held / pressed / released)
    audio.js           WebAudio NES-channel synth, SFX + music sequencer
    rng.js             seeded RNG (deterministic level setup & tests)
    scenes.js          scene stack (push/pop overlays, fade transitions)
  gfx/
    palette.js         master palette
    sprites.js         pixel-grid sprite/tile definitions
    textures.js        grid → Pixi Texture builder, cached
    font.js            8×8 pixel font + text helper
  world/
    mallLevel.js       level data: floors, shafts, escalators, storefronts, lights
    storeRooms.js      room templates per theme (tile grids, fixture/guard slots)
    levelSetup.js      assigns targets/power-ups/loot per loop using rng (pure)
  logic/               pure game logic, no Pixi imports
    physics.js         AABB, tile collision, gravity/jump
    elevator.js        car movement, floor stops, crush detection
    rules.js           exit condition, scoring, difficulty scaling, alarm timer
    loot.js            fixture contents rolls
    powerups.js        power-up state and timers
  entities/            entity state + update (logic) and a view class (Pixi sprites)
    player.js, spy.js, bot.js, bullet.js, light.js, pickup.js
  scenes/
    TitleScene.js, MallScene.js, StoreScene.js, MapOverlay.js,
    PauseOverlay.js, LevelClearScene.js, GameOverScene.js
  ui/hud.js
tests/                 Vitest specs for logic/ and world/levelSetup
```

**Boundaries:**
- `logic/` and `world/` are pure (no Pixi, no DOM) and fully unit-testable.
- Entities hold plain state; scenes own Pixi containers and sync sprites from state
  each frame.
- A single `GameState` object (score, lives, loop, packages, cleared stores, power-ups,
  alarm) is passed between scenes; mall and store scenes read/write it.

## 12. Error Handling

- WebGL unavailable → Pixi falls back / show a clear message "WebGL required".
- Gamepad connect/disconnect handled live; keyboard always works.
- Audio context suspended until first user input; failure to create audio is non-fatal
  (game runs silent).
- Window resize re-computes integer scale.

## 13. Testing

- **Unit (Vitest):** physics collisions; elevator crush + floor stops; exit rule
  (can't leave without 6 packages); scoring and difficulty scaling; loot rolls and
  exactly-one-package per target store; level setup invariants (exactly 6 targets,
  every store reachable via floors/elevators/escalators); power-up timers and stacking.
- **Browser playtest:** Chrome automation loads the dev server, checks console is free
  of errors, drives input to walk, ride an elevator, enter a store, search, open the
  map; screenshots of Title, Mall, Store, Map for visual review.
- `npm run build` must succeed.
