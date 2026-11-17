# Mall Action implementation

This is the GPT-6.2-Sol xhigh entry for the Mall Action benchmark. Keep the
implementation history independent and publish it under
`/mall-action/gpt-6.2-sol-xhigh/`.

## Architecture and invariants

- `src/engine.js` owns the scene state machine. `step(previous, pad)`
  returns a new state. Rule helpers update the working copy, emit events,
  and run in Node without DOM, Canvas, audio, or browser timing APIs.
- `src/mall.js` uses world-space foot positions and floor indices. In a
  store, `src/store.js` uses tile-space layouts and pixel-space actor
  centres. Both scenes progress only on 60 Hz steps.
- `src/random.js` advances the seed carried in game state. Keep browser
  clocks, audio, palette animation and display noise out of the rules.
- `src/main.js` integrates browser input, audio and Canvas. The three
  drawing modules read state. Audio consumes sound events and scene changes.
- `src/data.js` describes mall geometry and store layouts. Treat the tables
  as read-only. Store fixture indexes are row-major and must stay consistent
  with the generated cache contents and opened fixture arrays.
- Put dialogue and jokes in `src/copy.js`. Check pixel widths when adding
  signs or changing the type.
- Keep asset URLs relative. The static build uses native ES modules and a
  relative stylesheet. There are no package, asset, or service dependencies.

## Things worth checking

- The pad merges physical key ownership with gamepad ownership. Key-up clears
  the mapping saved at key-down. Retain distinct tap edges across catch-up
  frames and clear held input at blur.
- A car target is in pixels. Holding a direction sets a course, releasing
  picks up the next landing, and a stop emits one ding. A called car can
  collect a waiting player. Leaving a stopped car exits beyond the hole.
- Rooms keep opened fixture state outside the transient room object. Check
  both clean entry and re-entry after touching package and non-package caches.
- The power and level counters tick in the store and during fades. Map,
  pause, and continue freeze play. Draw blinking UI from the presentation
  frame without unfreezing the simulation.
- The CRT compresses complete scanlines near the corners. Test both CRT
  settings after resizing and verify the default with clean browser storage.
- Use real keyboard input when checking Web Audio unlock. Deterministic stepping
  is useful for repeating a specific encounter and for screenshots.

## Verify

Run `npm ci`, `npm test`, and `npm run build`. Serve the build at
`/dist/` locally to reproduce a Pages sub-path. Check the console and look
at captures with the default CRT effect. Exercise the roof-to-store route,
the directory and pause, Parking, continue, and game over. The workflow
publishes only after the tests and static build pass.
