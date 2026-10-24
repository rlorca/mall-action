# Implementation decisions

## Canvas 2D instead of WebGL

The game uses a 256×240 Canvas 2D backbuffer with integer CSS scaling. This is the simplest reliable way to guarantee whole-pixel, nearest-neighbour output and it works without a shader pipeline. Canvas is the brief's permitted equivalent graphics path; an explicit fallback message covers browsers where it is unavailable. The CRT treatment is a non-interactive CSS layer so it cannot eat input or blank the game.

## Vanilla ES modules

The game has no runtime framework dependency. Pure mutable-state rules are easier to step deterministically than a component framework, and Vite is used only for development and static bundling. Keeping rendering, audio, and DOM adapters outside `src/core/` makes the rules runnable in Node tests.

## One seeded RNG stream per game

A single xorshift32 stream drives all gameplay choices. This makes complete-run replay straightforward and avoids hidden per-entity seed drift. Audio noise has a separate presentation-only generator because audio scheduling is not part of the simulation.

## Data-oriented room templates

Rooms use small character-grid templates plus persistent fixture records. Templates define collision and hand-designed layout; fixture records hold contents, opened state, and special flags. The renderer and camera use template dimensions rather than assuming that future rooms remain one screen.

## Real-time browser verification in addition to rule tests

Deterministic tests are excellent for fairness and edge cases but cannot reveal a missing enemy flag, incorrect Canvas state, favicon console error, or a lamp drawn above bullet height. The CDP playtest therefore uses actual keyboard events and real animation frames for the critical path, reserving debug state setup for otherwise lengthy travel.

## Generated presentation assets

The bitmap font, sprites, storefront displays, favicon, and audio are all produced from source. Screenshots are documentation captures only and are never loaded by the game. This keeps nested static deployment self-contained and preserves the three-colour sprite constraint.
