# AGENTS.md - Architecture & Developer Guide (gemini-3-6-flash)

## Architecture Overview

- **Game Engine Logic (`src/game/logic.ts`)**: Pure TypeScript engine without any DOM/Canvas dependencies. Manages entity physics, elevator shafts, state transitions, store rooms, spy AI, powerups, scoring, and level loop scaling.
- **Rendering Layer (`src/game/renderer.ts`)**: Decoupled Canvas 2D graphics renderer. Draws the 256x240 pixel canvas, status HUD, mall side-scroller, store rooms, map directory overlay, and text popups.
- **Audio Synthesizer (`src/audio/synth.ts`)**: Procedural 4-channel Web Audio API NES synthesizer simulating Pulse 1, Pulse 2, Triangle, and Noise channels.
- **Input System (`src/input/input.ts`)**: Virtual pad layer merging keyboard & gamepad input with tap queue, key-release clearing (no stuck keys), and Konami code detector.
- **Procedural Pixel Graphics (`src/graphics/sprites.ts`)**: Bitmapped 8-bit NES sprite rasterizer enforcing maximum 3 colors + transparent per sprite.
- **CRT Post-Processor (`src/graphics/crt.ts`)**: Arcade CRT scanlines, vignette, and curvature filter with localStorage persistence and toggle banner.

## Mandatory Rules & Constraints

1. **Game Logic Separation**: Game rules must remain 100% pure and testable under Node / Vitest without browser context.
2. **Fixed 60Hz Timestep**: All game mechanics are calculated in frame units (60 frames = 1 second).
3. **Deterministic PRNG**: Always use `PRNG` (`src/utils/prng.ts`) for game logic randomness.
4. **Copy Length Constraints**: All text in `src/text/copy.ts` must pass `validateCopyLimits()` character length restrictions.

## Verification

To verify changes:
```bash
npm test
npm run build
```
