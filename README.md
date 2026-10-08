# MALL ACTION

*Mall Action* is an 8-bit spy caper in an 80s shopping mall, a spiritual successor to Taito's *Elevator
Action*, published by the fictional studio FLICKERSOFT. Spies have hidden six packages in six stores. Collect
them all, reach the parking level, and drive away. Then the next loop starts, harder.

> A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.

## Play in your browser

Build and serve locally (see below), or open the published build once it is deployed:
`https://rlorca.github.io/mall-action/haiku-5.5/`

## Screenshots

Not committed to the repo. The headless playtest (Chromium, scripted through `?debug=1`) checked the splash, the zip-line arrival, an elevator ride to 4F, walking to the FOREVER 12 door, entering the store, searching a fixture, the directory map and pause.

## Features

- Side-scrolling mall: six floors, three elevator shafts (two driven by hand, one automatic), two escalators,
  a directory kiosk, a photo booth, fountains, lamps, disco balls, a wet-floor janitor, mall walkers, and a mall cop on a Segway.
- Ten top-down store rooms, each with its own layout, searchable fixtures, guards, traps and power-ups.
  Forever 12's fitting rooms, KGB Toys' wind-up toy shelves, Sam Baddy's listening booth and the GameStonk cave easter egg.
- Alarm, loops, Black Friday Mode (Konami code on the title screen), continues, THE DAILY MALL and SPYGRAM.
- NES-style chiptune built in Web Audio: two pulses, a triangle and noise.
- CRT effect on by default. Press C to toggle; the choice is remembered.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows, WASD | D-pad, left stick |
| A: shoot | Z, J | A (button 0) |
| B: jump (mall), search (store) | X, K, Space | B (button 1) |
| Select: map | Shift, Tab | Select (button 8) |
| Start: pause, confirm | Enter | Start (button 9) |
| CRT on/off | C | |
| Mute | M | |

Letter keys match the printed letter, so AZERTY and QWERTZ keyboards work.

## Tips

- Shaft C drives itself. Stand in its opening and it comes to you.
- Stand still in a shaft opening for half a second and the car is called.
- Hold a direction in a car and it moves; let go between floors and it glides to the next one.
- Tap B next to a fixture to search it. A single tap is enough.

## Run, test and build

```sh
npm install
npm run dev        # dev server
npm test           # vitest: rules, copy limits, sprites, templates, soak
npm run build      # typecheck, then a static build into dist/
npm run preview    # serve dist/ locally
```

Debug URL options:

- `?seed=N` fixes the random seed (the same seed replays the same game).
- `?debug=1` skips the splash, pauses real-time stepping, and exposes `window.__mall`: `step(frames, held, pressed)` runs exact frames, and `state()` reports screen, mode, position and the last death cause.
- `?gallery=1` shows every sprite, animated.

## Project layout

```
src/core/      pure rules: loop clock, input, scoring, power-ups, difficulty, copy, sprites, the game state machine
src/mall/      side-scrolling mall: layout, elevators, the mall world, NPC and spy-fairness rules
src/store/     top-down store rooms: templates, rules, guards, searching
src/render/    canvas drawing (reads state only), font, CRT presenter
src/audio/     Web Audio engine, note helpers, songs and sound effects
src/splash/    reusable FLICKERSOFT splash module (see its README)
tests/         vitest suites for every rule in the brief
```

## Where to add jokes

Every line of copy lives in `src/core/copy.ts`. Add a SPYGRAM post, a headline, a PA line or a bubble there.
`tests/copy.test.ts` checks that every line fits its limit. The limits are listed at the top of that file.

## Known gaps

This is a one-shot build. The following parts of the brief are only partly done, and the browser playtest was not run:

- Browser checks are scripted and headless. They cover the flow above, not every feature. Escalators, shooting spies and lamps, level clear, continues and game over are covered by unit tests only.
- Store songs are generated from a style, key and seed per store, not hand-written melodies.
- Some store and mall extras are simplified (for example, rolling disco balls stop at walls or pits without the full pit logic).
- Curvature in the CRT effect is a row-by-row approximation, not a true barrel warp.

## Disclaimer

FLICKERSOFT is a fan homage. It is not affiliated with Taito, Forever 21, RadioShack, Brookstone, GameStop,
KB Toys, Blockbuster, Sam Goody, Sharper Image, Hot Dog on a Stick, Circuit City, Foot Locker, Borders,
Spencer's or Elevator Action. All names are parodies.

## Benchmark notes

- **Model:** Claude Haiku 5.5 (`claude-haiku-5-5`)
- **Date:** 2026-10-08
- **Harness:** Claude Code (terminal), `/model haiku` set as default
- **Reasoning / effort:** default
- **Prompt:** `one-shot-prompt.md` from `main`, given verbatim, in an empty orphan branch
- **Time:** one long session (not timed)
- **Interventions:** none on the design. The user asked to create the branch and implement the prompt.
- **Browser playtest:** the Claude-in-Chrome extension was not connected, so a headless Chromium run was used instead (scripted through `?debug=1`). It found and fixed a zip-line softlock, a car ride killed by a spy spawned on the agent's column, and a debug step that could not press buttons.
- **Not done:** no push.
