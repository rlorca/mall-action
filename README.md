# MALL ACTION

> *A FLICKERSOFT Production*

An 8-bit spy caper in an 80s shopping mall. A spiritual successor to Taito's *Elevator Action* (1983), reimagined as a browser-playable retro game.

## [Play in your browser](https://rlorca.github.io/mall-action/opus-4.6/)

## About

You are a secret agent who must infiltrate a multi-floor shopping mall, collect 6 hidden packages from parody stores, and escape in a wood-panelled station wagon. Navigate floors using elevators and escalators, dodge and shoot spies, and explore stores in top-down Zelda-style rooms.

### Features

- **Side-scrolling mall** with 6 floors, 3 elevator shafts, escalators, and 13 storefronts
- **Top-down store rooms** with searchable fixtures, guards, and traps
- **10 unique stores** with parody names (GAMESTONK, KGB TOYS, RADIOSHOCK...)
- **NES-quality pixel art** generated entirely from code (no external assets)
- **Chiptune soundtrack** with distinct music for each store
- **CRT arcade monitor effect** with scanlines and curvature
- **NPCs**: janitor with wet floors, mall walkers, mall cop on a Segway
- **Power-ups**: Rapid Fire, Spread Shot, Sneakers, Cinnabomb, and more
- **Easter eggs**: Konami code Black Friday mode, GameStonk Zelda-cave scene, SPYGRAM social media parody
- **Looping difficulty** with alarm system and scaling spy behavior

### Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | D-pad / Left stick |
| Shoot | Z / J | A (button 0) |
| Jump (mall) / Search (store) | X / K / Space | B (button 1) |
| Map | Shift / Tab | Select |
| Pause / Confirm | Enter | Start |
| CRT on/off | C | |
| Mute | M | |

### Tips

- Red blinking doors have packages inside. Blue doors are power-up shops.
- Use elevators to crush spies standing on the grates below.
- Shoot fountains for coins (and a rare gold coin for an extra life).
- The photo booth hides you from spies for 5 seconds.
- Visit GAMESTONK first for a special surprise.
- Try the Konami code on the title screen...

## Development

### Prerequisites

- Node.js 20+

### Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server
npm test           # Run test suite
npm run build      # Production build → dist/
```

### Debug URL Options

- `?seed=N` — Fixed random seed for deterministic runs
- `?debug=1` — Exposes `window.mallAction` with state and frame-stepping function; skips splash
- `?gallery=1` — Sprite gallery showing every sprite animated

### Project Layout

```
src/
  engine/       Core systems (input, RNG, game loop, types)
  game/         Pure game logic (state, simulation, store init)
  rendering/    Canvas renderer and CRT effect
  audio/        NES synth, SFX, music player
  sprites/      Pixel art data, palette, fonts
  data/         Store definitions, text/copy, room layouts
  flickersoft/   Reusable studio splash module
tests/          Vitest test suite
```

### Adding Jokes

All game text lives in `src/data/copy.ts`. Each text type has a character limit enforced by tests:
- Speech bubbles: 28 chars
- SPYGRAM captions: 21 chars per line, 2 lines max
- Comments: 21 chars
- Headlines: 26 chars per line

## Disclaimer

MALL ACTION is a fan homage by FLICKERSOFT. It is not affiliated with or endorsed by Taito, or any of the brands parodied in the store names. All store names are fictional parodies for humorous purposes.

## Benchmark Notes

- **Model**: Claude Opus 4.6 (`claude-opus-4-6`)
- **Date**: 2026-09-29
- **Harness**: Claude Code
- **Effort**: medium
- **Prompt**: `one-shot-prompt.md` (verbatim, no hints)
