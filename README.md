# Mall Action

A browser-playable spiritual successor to Taito's *Elevator Action* (1983), set in an 80s shopping mall.
Ride the elevators, dodge the spies, shoot out the lights — and slip into the red-door stores to search
for the six packages the spies have hidden. The mall is a side-scroller; the stores are top-down, Zelda-style.

Everything — pixel art, font, chiptune music and sound — is generated in code. No asset files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # production build in dist/
```

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / ride elevator / board escalator | Arrows or WASD | D-pad / left stick |
| A — shoot | Z or J | A / Cross |
| B — jump (mall), hold to search (store) | X or K | B / Circle |
| Select — mall map | Shift or Tab | Select |
| Start — pause | Enter | Start |
| Enter a store / use kiosk / photo booth / getaway car | Up | Up |
| Toggle CRT effect | C | — |
| Mute | M | — |

## How to play

- Red doors hide a package. Collect all six, then take the elevator down to **P** and press Up at the station wagon.
- Duck under high shots, jump over low ones. Shoot the hanging lamps to drop them on spies — or ride a car down onto one.
- Blue doors are power-up shops. Food-court treats count as power-ups too.
- Kiosks point you to the nearest package. Don't shoot in front of the mall cop.
- Take too long and the alarm goes off.
- There's a famous code for the title screen. And someone at GameStonk wants to give you something.

## URL options

| Param | Effect |
|---|---|
| `?seed=123` | fixed random seed (repeatable levels) |
| `?debug=1` | exposes `window.__mall` and a frame-stepping driver `__mall.drive(buttons, frames)` |
| `?gallery=1` | sprite gallery (Start pages through) |

## Project layout

```
src/core     loop, input, rng, scene manager
src/audio    WebAudio NES-style synth, music, sfx
src/gfx      palette, pixel-grid textures, fonts, sprites (as code)
src/world    mall layout, store rooms, level setup
src/logic    pure rules: physics, elevators, scoring, power-ups, NPCs, secrets
src/game     pure world simulation for the mall and stores
src/scenes   Pixi scenes (title, mall, store, map, pause, level clear, game over)
tests        Vitest specs for everything pure
docs         design spec and implementation plan
```
