# Verification — GPT-6.1 Sol

September 29, 2026. Approximately 50 minutes of elapsed implementation and validation, including sandbox approvals, user naming corrections and a daemon restart. One agent; no delegated implementation.

## Automated checks

**74 tests** pass with `npm test`; `npm run build` succeeds. The tests exercise source-art dimensions/three-colour budgets, all copy limits, deterministic RNG/runtime, ordered keyboard/gamepad edges, seeded setup, all-floor connectivity, safe/fatal shaft falls, jumping and kicks, bullets, elevator gliding/dings/calls/occupancy/crushes, escalator transit, scoring and difficulty, power slots/timers, search touch tolerance and cancellation, persistent opened fixtures, store surprises, toy shelves, listening booth, guards, NPCs, clear-once, continues, shutdown and loop two. Later regression checks cover room navigation, larger rooms, pedestal ownership and scene fades.

## Browser checks

The real-time Playwright suite passed 23 checks with **CRT on** and **zero browser console errors**:

1. Splash, title, zip-line and selfie reach playable mall.
2. Normal keyboard input rides shaft A to 4F and enters Forever 12.
3. A real single tap starts and completes a package search.
4. Map and pause stop simulation timers.
5. Store exit returns to its mall door.
6. An escalator animates to the other landing.
7. Shooting kills a spy and drops a lamp.
8. Six distinct stores yield all six packages.
9. Parking exit reaches the tally, newspaper and SPYGRAM post, then loop two.
10. Losing the final life reaches continue; accepting grants three lives.
11. With no continues, shutters close and game over returns to title.
12. CRT toggles and persists, sound toggles, and resize retains whole-number scaling.

The harness in `scripts/browser-playtest.mjs` uses real keyboard events and real elapsed time, not `mallAction.step`. It uses debug placement for isolated interactions, subsequent stores and terminal states. This is a scenario playtest, not an uninterrupted manual traversal of all six stores. Package discovery, searching, store exit and scene transitions are performed by the live simulation.

Screenshots in `public/screenshots/` were opened and visually inspected. A retained scene fade was found in screenshots and fixed, then the suite was rerun. The updated title, mall, store, map, selfie, tally, newspaper, mission post, continue and shutter screens have readable text, a visible CRT effect and no screen masking. The directory car now fits entirely within its schematic.

## Publication

The production build was also loaded from a plain static server at `/mall-action/gpt-6.1-sol/`: bundled assets loaded, CRT was enabled, title → arrival → mall worked, and no browser exceptions occurred. Production files use relative URLs. The branch workflow runs a clean install, tests and build before replacing only `gpt-6.1-sol/` on `gh-pages`. It shares the repository's publication lock and updates the landing link automatically.
