# MALL ACTION

**An 8-bit spy caper in an 80s shopping mall.** A benchmark for AI coding models, built from a single one-shot prompt.

[Play in your browser](https://rlorca.github.io/mall-action/haiku-4-5/)

## About

MALL ACTION is a spiritual successor to Taito's *Elevator Action* (1983), published by the fictional studio **FLICKERSOFT**. Ride elevators, shoot spies, search stores for hidden packages, and drive away in the wood-panelled getaway wagon.

## Features

- **Retro 8-bit gameplay:** side-scrolling mall with Zelda-style store interiors
- **60 Hz fixed-step simulation:** deterministic, seeded randomness
- **Procedural pixel art & chiptune audio:** all generated from code, no external assets
- **Gamepad & keyboard support:** merged into NES-style controls
- **GitHub Pages compatible:** builds to static files, works under any sub-path

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows or WASD | D-pad / left stick |
| Shoot | Z or J | A button |
| Jump | X, K, or Space | B button |
| Map | Shift or Tab | Select button |
| Pause | Enter | Start button |
| CRT on/off | C | — |
| Mute | M | — |

## How to Run

```bash
npm install
npm run dev          # Start dev server (http://localhost:5173)
npm test             # Run tests
npm run build        # Build for production
```

## Debug URLs

- `?seed=123` — fix the random seed for reproducible play
- `?debug=1` — expose `window.gameContext` with state inspection and frame-stepping API
- `?gallery=1` — show sprite gallery (TODO)

## Project Structure

```
src/
  main.ts         — Game loop and setup
  rules.ts        — Game simulation (pure, testable)
  types.ts        — TypeScript definitions
  render.ts       — Canvas rendering
  input.ts        — Keyboard & gamepad handler
  rng.ts          — Seeded random number generator
  data.ts         — Game data (stores, copy, constants)
  art.ts          — Procedural sprite generation
  audio.ts        — Web Audio synthesis
  main.test.ts    — Test suite
```

## Gameplay

### The Mall (side-scrolling view)

- **Floors:** Roof → 4F → 3F → 2F → 1F → Parking
- **Stores:** 13 storefronts, 6 target stores hiding packages
- **NPCs:** Spies, guards, mall walkers, security cop, janitor
- **Elevators & Escalators:** Navigate between floors
- **Power-ups:** Rapid Fire, Spread Shot, Armor, Sneakers, Radar, 1-Up, Food

### Target Stores

Each game, find **6 packages** hidden in 6 target stores:
1. FOREVER 12 (Fashion)
2. RADIOSHOCK (Electronics)
3. KGB TOYS (Toys)
4. SAM BADDY (Music)
5. HOT SPY ON A STICK (Food)
6. FOOT LOCKPICKER (Sports)

### Stores (top-down view)

Enter a store to search fixtures. One B button press to search, any direction to cancel. Guards patrol; defeat them to find the package.

### Level Complete

Collect all 6 packages and reach the parking level. Exit the car to end the level. Each loop gets harder.

## Scoring

| Event | Points |
|---|---|
| Spy shot | 100 |
| Spy crushed/fallen object | 300 |
| Package | 500 |
| Power-up | 50 |
| Level clear | 1000 |
| Time bonus | 10 per second (under 300 s) |

## Benchmark Notes

- **Model:** Claude Haiku 4.5
- **Date:** 2026-09-29
- **Harness:** Claude Code
- **Duration:** ~20 min (initial implementation)
- **Status:** Core loop and sprite/sound systems in place

## Disclaimer

MALL ACTION is a FLICKERSOFT fan homage. It is not affiliated with or endorsed by Taito or by any brand parodied in the game. All names are puns, and all art, music and code are original.

---

The shared specification lives on [`main`](../../tree/main) branch. See [`AGENTS.md`](AGENTS.md) for implementation notes.
