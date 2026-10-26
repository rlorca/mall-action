# DECISIONS.md

Decisions that needed a reason, recorded for the benchmark.

## Stack

- **TypeScript + Vite + Vitest + Canvas 2D + Web Audio API.** Chosen for a
  zero-runtime-dependency static build (`base: './'`), a fast test runner, and
  a pure, testable rules layer. Canvas 2D (not WebGL) is sufficient for
  nearest-neighbour pixel art and keeps the renderer simple.

## Branch / effort

- Branch `deepseek-v4-pro-high`. The model is "DeepSeek V4 Pro"; the effort
  (reasoning) setting is recorded as `high` in the branch name and `costs.json`.

## Spec ambiguities

- **Headlines exceed the 26-char limit.** The spec's own headlines are 37–47
  chars. They are kept verbatim and wrap to two lines on the newspaper front
  page; the test allows up to 52 chars (2×26).
- **"music and gadgets (used by 2 shops)".** There are 10 open stores and 9
  themes, so exactly one theme is reused. I mapped *gadgets* to two shops
  (Crookstone + Sharper Imagine) and *music* to one (Sam Baddy), matching the
  store list in section 5.2.
- **CRT curvature** is approximated with corner darkening (vignette) plus
  scanlines and noise; a true barrel distortion was not implemented.

## Simplifications (noted honestly)

- **Elevator "grate" mechanic** is simplified: a shaft opening is `board` /
  `grate` / `pit` based on car position, and falling more than one floor is
  fatal, but standing-on-a-grate and roof-riding are only partially modelled
  (the player can land on a car roof after a one-floor fall).
- **Store extras** (Forever 12 fitting room, KGB Toys wind-up toys, Sam Baddy
  listening booth) are not fully implemented; the GameStonk easter egg is
  implemented as a first-visit item-get. Fixtures otherwise behave per spec.
- **Fountains** (coin sprays) and the **photo booth** are present in the layout
  and partially wired, but the full coin-spray and 4-frame photo-strip flows are
  not complete.
- **Mall cop / janitor / walkers** are implemented at a basic level (patrol,
  wet patch, whistle/chase) but not every interaction (e.g. walkers blocking
  bullets, wet-floor sliding) is wired.
- **Per-store music** uses a single shared "store" track rather than 10
  distinct songs; the title/mall/alarm/elevator tracks are distinct.

These are the areas I would finish first with more time; the core loop
(splash → title → zip-line → collect 6 packages → exit → level clear → loop,
with continues and game over) is complete and tested.
