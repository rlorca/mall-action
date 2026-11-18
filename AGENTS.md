# Working on Mall Action

This orphan branch contains the GPT-6.2-astra xhigh benchmark run. Preserve the original run in history. Put later fixes in separate commits.

## Simulation boundaries

- Advance one frame with `Game.step(state, {held, press})`. The state belongs to the caller. Rules can update it and append short identifiers to its per-frame event list. Keep DOM, audio, wall clocks and rendering out of the simulation.
- Timings are integer frames at 60 Hz. Use the seeded generator on the state for all gameplay choices. Cosmetic effects can derive phase from the render frame. Drawing a frame must never advance rules or consume randomness.
- Mall coordinates place an actor at their feet. Use `MallData.floorY(f)` for floor alignment. Interior coordinates put the collision center near the feet. Room dimensions determine collision boundaries, camera limits and exit position.
- Store definitions have stable indices shared by layouts, dialogue, displays and songs. Keep opened fixtures in the level's room state. Rebuild transient guards on entry. Game-wide inventory and first-visit flags survive a loop transition.
- Keep bindings in the virtual pad. Keydown uses printed letters with a physical fallback. Keyup uses the physical key identity recorded at keydown. Drain at most one queued press per tick.
- Keep sprites to three master-palette inks plus transparent index zero. Use the bitmap fonts for all visible game text. Put jokes and interface copy in `src/copy.js`.

## Verification

Run `npm ci`, `npm test` and `npm run build`. The mission test plays a seed from splash to loop two using only controller inputs. For UI changes, run `npm run dev`, play the production copy at `/dist/?debug=1&seed=17`, check the console, and inspect screenshots with the default CRT effect. Check real-time keyboard presses as well as deterministic stepping.

Use relative URLs for runtime resources. Classic scripts, in dependency order in the HTML, allow the built game to run directly from disk. The branch-specific Pages workflow publishes the build to its own directory.

## Gotchas from the run

- A simultaneous car crush must credit the spy before clearing actors on player death.
- Track a fall through a shaft once feet leave the floor. Walking horizontally during the fall must not snap the player back onto the ledge.
- A called car needs to carry its protected pickup floor until it arrives. Keep docking distinct from ordinary crush detection.
- Curving a whole 256-pixel row by resampling can erase strokes from small fonts. Apply the CRT bend at the screen edges.
- Use a fresh B press to begin a search. Interior pose, facing, and the search progress bar must agree even when the fixture is beside the player.
