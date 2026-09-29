# MALL ACTION - Gemini 3.6 Flash Implementation

An 8-bit spy caper in an 80s shopping mall. Built as a spiritual successor to Taito's *Elevator Action* (1983) by fictional studio **FLICKERSOFT**.

[Play in your browser](https://rlorca.github.io/mall-action/gemini-3.6-flash/)

## Features
- **Dual Viewmodes**: Side-scrolling 6-floor 80s Shopping Mall + Top-Down Zelda-style store rooms.
- **Elevators & Escalators**: Multi-shaft elevator physics (manual & automatic), roof-riding, gliding, floor announcement dings, and crushing mechanics.
- **Store Espionage**: 13 parody storefronts with animated window displays, search fixtures, fitting room shrieks, KGB toys, listening booths, and GameStonk Zelda Easter Egg.
- **Synthesised 8-bit Audio**: Web Audio API NES 4-channel sound synthesizer (2 Pulse, 1 Triangle, 1 Noise) with full sound effects and BGM tracks.
- **Arcade CRT Post-Effect**: WebGL/Canvas CRT filter with scanlines, curvature, vignette, noise, toggled with key `C`.
- **Pure Game Logic & Seeded Randomness**: Game engine completely decoupled from rendering, fully testable under Vitest.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows, WASD | D-Pad, Left Stick |
| Shoot (A) | Z, J | Button 0 (A) |
| Jump / Search (B) | X, K, Space | Button 1 (B) |
| Map (Select) | Shift, Tab | Button 8 (Select) |
| Pause / Confirm (Start) | Enter | Button 9 (Start) |
| CRT Toggle | C | |
| Mute | M | |

## Development & Testing

```bash
# Run local dev server
npm run dev

# Run automated Vitest suite
npm test

# Production static build (outputs to dist/)
npm run build
```

## Debug Query Parameters

- `?seed=N`: Fixes pseudo-random generator seed to N.
- `?debug=1`: Exposes game engine state on `window.__DEBUG_GAME__`, enables frame stepping, and skips splash screen.
- `?gallery=1`: Opens procedural 8-bit sprite gallery viewer.

## Benchmark Notes

- **Model Name & ID**: Gemini 3.6 Flash (`gemini-3-6-flash`)
- **Date**: September 29, 2026
- **Harness**: Antigravity CLI
- **Reasoning / Effort Setting**: High
- **Duration**: ~6 minutes
- **Interventions**: None (fully autonomous build).

## Adding Jokes

All humor copy (speech bubbles, SPYGRAM posts, Daily Mall headlines, PA announcements, spy last words) is located in `src/text/copy.ts`.

## Disclaimer

A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.
