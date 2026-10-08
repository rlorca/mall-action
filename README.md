# MALL ACTION

**An 8-bit spy caper in an 80s shopping mall.** A spiritual successor to *Elevator Action*, by the fictional studio
**FLICKERSOFT**. Zip-line onto the roof, ride the elevators, shoot spies, search the stores for hidden packages, and
drive away in the wood-panelled getaway wagon. Then do it all again, harder.

> **[Play in your browser](https://rlorca.github.io/mall-action/sonnet-5.5-fable-5.1/)** (desktop browser, keyboard or gamepad)

<!-- SCREENSHOTS -->

This branch is one entry of a benchmark: the same one-shot brief (`one-shot-prompt.md` on `main`) given to different
AI models. This implementation was built by **Claude Sonnet 5.5 with Claude Fable 5.1 as advisor**. See
[Benchmark notes](#benchmark-notes).

## The game

Spies have hidden **6 packages** in 6 of the mall's stores. Collect them all, ride shaft **B** down to the parking level and
drive away. Then the next loop starts, harder.

* **The mall is a side-scroller** with six floors (R, 4F, 3F, 2F, 1F, P), three elevator shafts (A and B are driven by you, C
  runs on a timer), two escalators, a directory kiosk on every shopping floor, a photo booth, fountains, hanging lamps and
  2F disco balls.
* **Stores are top-down Zelda-style rooms.** Search shelves and racks for packages, power-ups, traps and nothing, while guards
  and security bots patrol.
* **13 storefronts** with animated window displays that show what they sell: red blinking doors hide a package, blue doors
  are power-up shops, rolled-down shutters are closed.
* **Chiptune everything:** two pulse waves, a triangle and noise, synthesised in the browser. One song per store, a quiet
  ambient bed for the mall, elevator muzak, an alarm groove. No audio files exist.
* **No art files either:** every sprite, tile, glyph and storefront is a character grid in source code.
* **CRT mode** (on by default) with scanlines, curvature, vignette and noise. Press **C** to toggle it.
* **Secrets:** enter the Konami code on the title screen. The GameStonk clerk has something dangerous to say.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrow keys, WASD | D-pad, left stick |
| A: shoot | Z, J | A (button 0) |
| B: jump (mall), search (store) | X, K, Space | B (button 1) |
| Select: mall directory map | Shift, Tab | Select (button 8) |
| Start: pause, confirm | Enter | Start (button 9) |
| CRT on/off | C | |
| Mute | M | |

Letter keys match the **printed letter** on your keycap, so QWERTZ and AZERTY layouts work; other keys match by position.

In the mall: **Up/Down** enters a store at its door, boards an elevator car standing at your floor (or calls it if you
stand in or beside the empty opening, or just stand still for half a second), rides an escalator from its landing, uses
a kiosk or the photo booth, and starts the getaway car. **Down** also ducks. Moving jumps are **jump-kicks** that kill spies.

## Tips

* Elevators are the only way between most floors. Hold Up/Down to move a car; let go between floors and it glides to the next floor.
* A car above you is a **grate** you can stand on, but if it comes down it crushes you. If you *called* it, it will pick you up.
* A car below is a **pit**: one floor down you land on its roof, further is fatal. Jump-kick over pits.
* Duck (Down) dodges high shots; jump over low ones. Spies telegraph with a half-second aiming pose.
* The directory kiosk points to the nearest package store. The photo booth hides you from spies.
* Armour (vest or pretzel) absorbs one hit. The Cinnabomb makes you invincible for 6 seconds.
* Shooting in front of the mall cop on his Segway gets you detained. Do not shoot the mall walkers either.
* After about 2.5 minutes the **alarm** goes off: spies are faster and more frequent.
* In a store, **tap B once** next to a fixture: the search runs on its own. Walk out of the door at the bottom to leave.

## Run it

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # the rules test suite (Node only, no browser needed)
npm run typecheck
npm run build      # typecheck + production build into dist/ (relative URLs: works from any sub-path)
```

### Debug URL options

| URL | What it does |
|---|---|
| `?seed=N` | Fixes the random seed: the same seed and the same inputs replay identically |
| `?debug=1` | Skips the FLICKERSOFT splash and exposes `window.__mall` (see below) |
| `?debug=1&start=1` | Also skips the title and starts a run immediately (add `&skipintro=1` to skip the zip-line arrival) |
| `?gallery=1` | Every sprite, animated, paged with Left / Right |

`window.__mall` (with `?debug=1`): `step(frames, buttons)` runs N 60 Hz frames holding the buttons (`'RIGHT+A'` or a bit mask),
`tap(buttons)`, `state()` (scene, run, player, cars...), `shot()` (the exact framebuffer as a PNG data URL), `render()`, and
`realtime = false` to freeze the real-time loop so stepping is fully deterministic.

## Project layout

```
src/engine/     seeded RNG, fixed-step loop, input mapping + tap queue, NES palette, framebuffer, sprite pipeline, fonts
src/content/    DATA: stores, layout geometry, power-ups, ALL the jokes (copy.ts)
src/art/        sprites (character grids), storefront drawing
src/game/       THE RULES (pure, deterministic, no DOM): run, difficulty, mall world, store world, screens, scene machine
src/render/     draws the game state into the framebuffer, plus the WebGL / CRT presenter
src/audio/      pure song data + sequencer + NES-style Web Audio synth
src/flickersoft/  the reusable FLICKERSOFT studio splash (has its own README)
src/main.ts     browser bootstrap only
scripts/        PNG / contact-sheet / preview tools (npx tsx scripts/sheet.ts agent. out.png 4)
```

The rules never touch the DOM, `Math.random`, `Date` or `performance` (a test greps for them), time is counted in 60 Hz frames,
and the game advances through exactly one entry point, `game.step(pad)`. See [`AGENTS.md`](AGENTS.md) for the architecture,
the rules that must hold, and the gotchas.

### Where to add jokes

Everything the game says lives in [`src/content/copy.ts`](src/content/copy.ts): SPYGRAM posts, speech bubbles, last words,
PA announcements, headlines, floor banners, the GameStonk items and every UI label. Add a line to the right list. A test
(`src/content/content.test.ts`) fails if a line is too long for its slot (bubbles 28 characters, SPYGRAM captions 21 x 2 lines,
comments 21, headlines 26) or uses a glyph the font cannot draw.

## Disclaimer

MALL ACTION is a FLICKERSOFT fan homage. It is not affiliated with Taito or with any of the parodied brands; the store
names are puns and no logos or trade dress are used.

## Benchmark notes

(Filled in at the end of the run.)
