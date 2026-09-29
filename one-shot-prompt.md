# Build "MALL ACTION": an 8-bit spy caper in an 80s shopping mall

You are building a complete, polished, browser-playable retro game from scratch, in one go. Work autonomously until everything in **Definition of done** is met. Choose your own languages, libraries and tools; this brief only states requirements. Where it gives a number, treat it as the intended feel and tune it only if playtesting proves it wrong.

---

## 1. Concept

*Mall Action* is a spiritual successor to Taito's **Elevator Action** (1983), published by the fictional studio **FLICKERSOFT**. The *Elevator Action* influence must be obvious. The setting is a big 1980s shopping mall instead of an office building.

- **The mall is a side-scroller**, in the vein of *Elevator Action* and *Keystone Kapers*. It has floors, corridors, elevator shafts and escalators, with spies coming out of doors.
- **Entering a store switches to a top-down, Zelda-style room.** There you search fixtures for hidden packages while guards patrol.
- **The goal:** spies have hidden **6 packages** in 6 stores. Collect all 6, then reach the parking level and drive away in the getaway car. Then the next loop starts, harder.
- **Look and sound:** top-tier NES and arcade 8-bit (*Super Mario Bros. 3*, *The Legend of Zelda*, *Prison Break*), with chiptune music.
- **Tone:** playful. The game is full of parody names and jokes (section 9).

## 2. Hard technical requirements

- **Runs in a modern desktop browser.** No server, no installation.
- **Builds to static files** that work when hosted under a sub-path, for example `https://user.github.io/mall-action/`.
- **No external art or audio assets.** Every sprite, tile, font glyph, music track and sound effect is generated from source code.
- **Fixed 60 Hz simulation.** All timings are in frames. Rendering is decoupled from the simulation. If the browser falls behind, cap the catch-up steps.
- **Screen:**
  - The internal resolution is 256×240 (NES), scaled by the largest whole-number factor that fits the window.
  - Scaling must be nearest-neighbour, with whole-pixel positions, no blur and a black letterbox.
  - A 16 px status strip (HUD) runs along the top.
- **Colours:** a fixed NES-like master palette, with at most 3 colours plus transparent per sprite.
- **CRT post-effect:**
  - An optional arcade-monitor effect with scanlines, curvature, vignette and slight noise.
  - It is ON by default and visible enough to notice.
  - C toggles it and shows an on-screen "CRT ON" / "CRT OFF" confirmation. The choice persists across visits.
  - It must never blank or partially cover the screen.
- **Audio:**
  - Synthesised in the browser, imitating the NES channels: two pulse waves, a triangle and noise.
  - Silent until the first user input (browser autoplay rules); if audio can't start, the game must still run fine.
  - M toggles mute and shows "SOUND ON" / "SOUND OFF".
- **Input:**
  - Keyboard and gamepad, merged into a virtual NES pad (Up, Down, Left, Right, A, B, Select, Start).
  - Letter keys match the **printed letter**, so QWERTZ and AZERTY keyboards work. Other keys match by physical position.
  - Unmapped letters fall back to physical position.
  - A key release must always clear exactly the key that was pressed, so keys never get stuck.
  - Fast repeated taps must not be lost when several simulation steps run in one frame.
- **Deterministic seeded randomness** everywhere in the game logic, so a given seed always replays the same.
- **Game rules separate from rendering.** The rules (physics, elevators, AI, scoring, stores, jokes) must be pure and testable without a browser. The rendering layer only draws the state and reacts to events coming out of the rules.
- **Automated tests** for all the game rules (see section 11). The test suite and the production build must pass.
- **Continuous integration:** every push to `main` runs the tests and the build, then deploys the static build to GitHub Pages. Failing tests block the deploy.
- **Debug support:**
  - `?seed=N` fixes the random seed.
  - `?debug=1` exposes the game context and a function that steps the game N frames with given buttons held, for automated playtests. It also skips the studio splash.
  - `?gallery=1` shows every sprite, animated.
- If WebGL or the equivalent graphics support is missing, show a clear message.
- Handle window resizing and gamepads connecting or disconnecting at any time.

## 3. Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows, WASD | D-pad, left stick |
| A: shoot | Z, J | A (button 0) |
| B: jump (mall), search (store) | X, K, Space | B (button 1) |
| Select: map | Shift, Tab | Select (button 8) |
| Start: pause, confirm | Enter | Start (button 9) |
| CRT on/off | C | |
| Mute | M | |

## 4. Game flow and screens

The game runs through these screens in order:

1. **FLICKERSOFT splash.**
   - Black screen. The word FLICKERSOFT appears in large rainbow letters.
   - The letters flicker on **alternate frames**, with neighbouring letters out of phase, imitating an NES scene with too many sprites on one scanline. This lasts about a second.
   - The letters then settle solid, with an underline and a jingle. "PRESENTS" follows, then the title screen after about 3 seconds.
   - Any button skips it.
   - Build it as a self-contained, reusable module; future FLICKERSOFT games will use it.
2. **Title screen.**
   - Night-sky gradient. A big two-tone "MALL ACTION" logo with the subtitle "A SHOPPING MALL ESPIONAGE".
   - "(C) 2026 FLICKERSOFT", the high score, and a blinking "PRESS START".
   - A control hint at the bottom.
   - A row of real storefronts (with window displays) scrolling along the bottom.
   - Title music plays.
   - **Secret:** entering the Konami code (↑↑↓↓←→←→ B A) shows a flashing "BLACK FRIDAY!" and "70% OFF EVERYTHING". The game that follows is in Black Friday Mode. Detection must still work with extra leading presses of Up.
3. **The mall level.** The agent arrives by zip line (section 5.1), then play begins.
4. **Stores.** Entering a store fades into its top-down room; walking out through the door fades back to the mall at that door.
5. **Map overlay (Select).**
   - Pauses the game and shows a full-screen "MALL DIRECTORY" schematic.
   - It shows all floors, the elevator shafts with their cars' current positions, the escalators and the getaway car.
   - Stores are colour-coded: package remaining (red), cleared (grey), power-up shop (blue), closed (dark outline).
   - The player's position blinks. Inside a store, the current store blinks instead.
   - With the Radar power-up, a "!" marks each remaining package store.
   - It also shows a legend and an inventory line (joke items, photo strip).
6. **Pause overlay (Start).** Dimmed screen with a blinking "PAUSE"; the music is turned down. All timers stop while the map or pause screen is open.
7. **Level clear.**
   - Parking-garage backdrop. The wood-panelled station wagon drives off while a spy chases it waving a receipt.
   - A bonus tally: packages, time bonus, a clear bonus of 1000, and "LOOP n".
   - Then the front page of **THE DAILY MALL** with a random headline.
   - Then a random mission-complete SPYGRAM post.
   - Start skips ahead; the next loop begins.
8. **Continue.**
   - When the last life is lost and continues remain, show "CONTINUE?" with a big countdown from 9, one beep per second, red at 3 or below, and "CONTINUES LEFT: n".
   - Start gives 3 fresh lives where you fell: score, packages and loop are kept, power-ups are reset.
   - There are **3 continues per game**.
9. **Game over.**
   - A PA chime and a typewriter message, "ATTENTION SHOPPERS: / THE MALL IS NOW CLOSED", while metal shutters roll down over the storefronts and the agent.
   - Then "GAME OVER" with the score and high score (per session), and back to the title.

## 5. The mall (side-scrolling view)

### 5.1 Layout

The mall is 768 px wide (3 screens) with 6 floors: **R** (roof, arrival), **4F**, **3F**, **2F**, **1F**, **P** (parking, exit). Floors are 48 px apart. The camera follows the player on both axes and stays inside the level edges.

**Elevator shafts.** Each shaft has one car. Not every shaft reaches every floor, so the player has to plan a route.

| Shaft | Floors served | Driven by |
|---|---|---|
| A | R to 2F | the player (manual) |
| B | 4F to P (the only way to P) | the player (manual) |
| C | R to 1F | an automatic timer: it waits about 2 s, then picks a random other floor |

**Escalators:** 3F ↔ 4F, and 1F ↔ 2F.

**Elsewhere in the mall:**
- A directory kiosk on each shopping floor.
- A photo booth on 3F.
- Fountains on 3F and 1F.
- Benches and plants.
- Hanging lamps in the corridor gaps, never covering store signs. On 2F they're disco balls.
- Parking level: pillars and the getaway station wagon.

**The arrival** (*Elevator Action*-style):
1. A dark skyscraper with lit windows stands at the left edge of the sky. A cable runs from it down to an anchor post on the mall roof.
2. The agent hangs from the cable by both hands and slides down it (with a zip sound).
3. He lets go near the post, drops onto the roof, lands in a crouch (thud), then takes a **SPYGRAM selfie** (section 9) before the player gets control.

### 5.2 Storefronts

There are 13 storefronts across 4F to 1F. Each is about 80 px wide: a sign on top (store name in a tiny pixel font, coloured by role), a door in the middle, and a display window on each side. **The window displays must show what the store sells without reading the sign.** Most displays have 1 to 3 frames of idle animation.

- **Door colour shows the role:**
  - Target stores (they hold a package) have **red doors that blink**.
  - Power-up shops have **blue doors**.
  - Closed stores have a rolled-down shutter.
- When a target store's package has been taken, its door goes dark and its windows dim.

| Store (parody of) | Floor | Role | Window displays |
|---|---|---|---|
| FOREVER 12 (Forever 21) | 4F | target | mannequins in outfits / a clothing rack |
| RADIOSHOCK (RadioShack) | 4F | target | stacked TVs flickering with static / walkie-talkies |
| CROOKSTONE (Brookstone) | 4F | power-up shop | a massage chair / gadgets on pedestals |
| GAMESTONK (GameStop) | 4F | power-up shop | a console stack and cartridges / a "TO THE MOON" rocket poster and demo TV |
| KGB TOYS (KB Toys) | 3F | target | teddy bears in fur hats / a robot and a toy rocket |
| BLOCKBLUSTER VIDEO (Blockbuster) | 3F | closed | shutter, a "FOR LEASE" sign, a faded VHS poster |
| SPENDER'S GIFTS (Spencer's) | 3F | power-up shop | an animated lava lamp / a plasma ball |
| SAM BADDY (Sam Goody) | 2F | target | tapes and vinyl / a boombox with bouncing speakers |
| SHARPER IMAGINE (Sharper Image) | 2F | power-up shop | a robot vacuum / a pulsing glowing orb |
| HOT SPY ON A STICK (Hot Dog on a Stick) | 2F | target | a lemonade tub being pumped / corn dogs |
| CIRCUIT PITY (Circuit City) | 2F | closed | shutter half down with dead TVs behind it |
| FOOT LOCKPICKER (Foot Locker) | 1F | target | a wall of sneakers / basketballs and a jersey |
| BORDERLINE BOOKS (Borders) | 1F | closed | shutter with a "CLOSING SALE" banner |

The names are puns. Never use real logos, trade dress or exact brand names.

### 5.3 The agent

- **Look:** a red trench coat and dark hair. Mall sprites are 16×24; store sprites are 16×16.
- **Walking:** 1 px per frame.
- **Jumping:** B jumps about 20 px high. Jumping while moving carries forward momentum and makes it a **jump-kick** that kills spies on contact.
- **Ducking:** holding Down ducks, which dodges high shots.
- **Shooting:**
  - A shoots horizontally: at chest height when standing, low when ducking.
  - Bullets travel **4 px per frame**, faster than the spies' 2.
  - At most 2 player bullets on screen, with a short cooldown between shots.
- **Up or Down** does, depending on where the agent stands:
  - enter a store at its door (open stores only),
  - board an elevator car standing at this floor,
  - board an escalator at its bottom landing (Up) or top landing (Down),
  - use a kiosk, the photo booth or the getaway car.
- **Deaths:**
  - Enemy bullets kill, unless armour absorbs the hit.
  - Touching a spy kills, unless the agent is jump-kicking.
  - Being crushed by an elevator car kills.
  - A falling lamp or a rolling disco ball kills.
  - A fall of more than one floor kills.
- **After a death:** respawn at the last safe spot, with about 2 s of blinking invulnerability. All spies and bullets are cleared, and any temporary freeze is removed.

### 5.4 Elevators

- **The car** is a platform the agent rides inside. It has doors that are closed while moving and open while stopped.
- **Driving:** holding Up or Down moves the car at 1 px per frame. Releasing between floors makes it glide on to the next floor in the same direction and stop exactly level with it.
- **Stop sounds:** each stop gives exactly **one** "ding". Holding a direction at the end of the shaft must not repeat the ding.
- **Getting out:** Left or Right while stopped at a floor.
- **Shaft openings** (one per floor the shaft serves) depend on where the car is:
  - **Car at this floor:** walk in.
  - **Car above:** a grate you can stand on. If the car comes down onto you, you're crushed.
  - **Car below:** an open pit. You fall, landing on the car's roof if it's just one floor down (safe), or dying if it's further (fatal).
- **Riding the roof:** you can stand on a car's roof and ride it. Rising into the top of the shaft crushes you.
- **Crushing spies:** a car coming down onto a spy on a grate crushes them for points. Spies deliberately walk to shaft openings and wait there.
- **Calling a car:**
  - Press Up or Down while standing in the empty opening or right beside it.
  - Or stand still there for about half a second: it calls automatically.
  - A car coming because it was called must pick you up, not crush you.
  - The automatic car never leaves while anyone is standing inside it.
- **Flavour:**
  - A car stopping with the player inside shows a floor announcement banner, e.g. "4F - FASHION & GADGETS, SPIES".
  - Any car stopping near the player dings.
  - A low hum plays while riding.
  - While riding, the music switches to an **elevator-muzak** version of the theme.

### 5.5 Spies

- **Look:** black suit, fedora, sunglasses. Mall sprites are 16×24.
- **Spawning:**
  - They come out of the doors of open stores (target stores not yet cleared, and power-up shops) on the player's floor or one floor away, 64 to 200 px from the player.
  - Cars stopping near the player sometimes let one out.
  - At most 4 on screen. The first appears about 5 s into the level.
- **Behaviour:**
  - They walk toward the player when they can see them (same floor, within about 160 px), stopping about 40 px away.
  - They never walk into pits.
  - Otherwise they wander, and sometimes go and wait in a shaft opening.
- **Shooting:**
  - A **clear aiming pose** of about half a second comes first. They aim high or low at random.
  - The first shot comes no sooner than about 2 s after a spy appears.
  - After that, about one shot every 2.5 s on loop 1, getting faster with each loop, but never more often than once a second.
- **Ducking:** a spy may duck an incoming bullet, deciding once per volley with a **10%** chance. Most straight shots must land.
- **Death:** one hit kills. The death animation lasts about 0.4 s. A spy sometimes drops a power-up (5%, half of them food) and sometimes says last words (section 9).
- **Blind spots:** spies ignore a player who is hidden, dying, arriving or posing for the selfie.

### 5.6 Lights

- **Lamps:** shooting a hanging lamp (its cord and shade can be hit by a standing shot) drops it. It kills anything underneath, shatters, and darkens that section of the floor for about 2 s.
- **Disco balls (2F):** they drop, then **roll** in the direction of the shot, flattening spies (and the player) until they hit a wall or reach a pit.

### 5.7 Other people and things

- **Janitor (1F):** walks back and forth and periodically mops, leaving a wet patch (about 48 px) with a yellow sign for about 10 s. Anyone entering it slides at walking speed and can't stop or turn until off it. A jump-kick landing on it keeps kicking while sliding. The patch must never reach a shaft opening. He's harmless, and bullets pass through him.
- **Mall walkers (2F):** two retirees in tracksuits power-walking set stretches. They block bullets from both sides. Shooting one costs points and shows a "HEY!" bubble; they never die. Touching one just pushes you along.
- **Mall cop on a Segway:** neutral, patrolling a random floor. If you shoot in front of him (same floor, facing you, within about 128 px), he blows a whistle, shows "HEY! STOP RIGHT THERE!" and chases you for about 10 s. If he catches you, you're frozen for 3 s and lose 500 points (not a life). He can't be killed; bullets ping off his helmet.
- **Directory kiosks:** Up at a kiosk shows a small map panel highlighting the nearest remaining package store, then cools down for about 20 s.
- **Photo booth (3F):** Up hides you inside for up to 5 s, and spies walk past. The first time you come out each game, a 4-frame photo strip pops up and is added to the inventory.
- **Fountains:** shooting one sprays 3 to 5 bouncing coins worth 50 points each. One spray in twenty includes a gold coin worth an extra life. Each fountain then cools down for about 15 s.
- **Alarm:** after about 150 s on the level (less on later loops), the mall alarm goes off.
  - Music and banner: "ALARM! SECURITY ALERTED" and a tense music variant.
  - Spies get about 25% faster and appear more often.
  - The HUD shows a blinking "ALARM".

### 5.8 Exit

- **With all 6 packages:** Up at the station wagon on P ends the level. Level Clear must trigger **exactly once**.
- **With packages missing:** the car won't start. Show "PACKAGES LEFT: n" and a buzzer.

## 6. Stores (top-down view)

- **Room:** 16×11 tiles of 16 px, with the door at the bottom centre.
  - Build the room system for **any room size, with a camera**. Every room is one screen for now, but big "anchor" department stores come later.
- **The agent:** moves in 4 directions (vertical input takes priority) and turns to face where he walks. Walls, fixtures, counters and decor are solid; the door is walkable. There's a gentle corner-assist, Zelda-style, so it's easy to slip through gaps.
- **Shooting:** A shoots in the facing direction. Guards get a short grace period before shooting at someone who just walked in.
- **Searching** (this must be forgiving):
  - Any searchable fixture the agent is **touching** counts, whether in front or to either side. The agent turns to face it.
  - A **single tap of B** starts a search that runs on its own for about 0.75 s, with a progress bar.
  - Only a fresh press of a different direction, or shooting, cancels it. Holding B after a search must not immediately search the next fixture.
  - The bottom strip shows the store name and "PRESS X TO SEARCH" when a search is possible, or "SEARCHING…" with the bar.
- **What a fixture can hold** (announced in a banner every time):
  - **Package:** the agent holds it overhead, a fanfare plays, "PACKAGE n/6", and the store counts as cleared. Each target store has exactly one package.
  - **Power-up:** held overhead, with its name as a banner.
  - **Trap:** a smoke puff and "IT'S A TRAP!". The agent is stunned for 1 s.
  - **Nothing:** a puff and "NOTHING HERE".
  - Searched fixtures stay open for the rest of the level, including after leaving and coming back.
  - Power-up shops hold only power-ups or nothing.
- **Guards** (1 to 3 per store):
  - **Spies** move tile by tile, favouring the player, and shoot along straight lines when lined up with a clear path.
  - **Security bots** patrol back and forth, kill on contact, and take 3 hits.
  - Guards come back if you leave and re-enter a store whose package is still inside. A cleared target store can't be entered again.
- **Themes:** 9 visual themes with their own floor, wall, fixture and counter tiles, each fixture with a closed and an opened (rummaged) look:
  - fashion, electronics, toys, food court and sports,
  - music and gadgets (used by 2 shops, with different layouts),
  - novelty (black-light) and games.
  - Each store has its own hand-designed layout.
- **Store extras:**
  - **Forever 12 fitting rooms:** searching one has a 25% chance of revealing a spy mid-change. He shrieks ("OCCUPIED!!"), throws a shoe, then fights. The fitting room's real contents stay unsearched.
  - **KGB Toys shelves:** shooting a toy shelf releases 3 wind-up toys that march, turning at walls. They stun guards they touch, and they set off traps (smoke that stuns nearby guards).
  - **Sam Baddy listening booth:** stepping on it switches to a bonus track ("NOW PLAYING: SIDE B") until you leave.
  - **GameStonk easter egg:** the first time each game, a Zelda-cave scene.
    - An old clerk stands between two flickering demo TVs. Guards and input freeze while a typewriter box prints "IT'S DANGEROUS TO GO ALONE! TAKE THIS."
    - An item appears on a pedestal. Walking onto it plays an item-get jingle with the agent holding it overhead: "YOU GOT: <ITEM>".
    - The item is random, and useless: EXPIRED COUPON, PRE-OWNED STRATEGY GUIDE, PET ROCK, MOOD RING or 1 SHARE (DOWN 99%). It is worth +1 point and goes into the inventory.
    - The clerk then vanishes in a puff.
  - **First-visit lines:** the first time you enter each store per game, its guards hold still and say their lines in speech bubbles (section 9).

## 7. Power-ups

| Power-up | Effect | Duration |
|---|---|---|
| Rapid Fire | faster fire, up to 4 bullets | 20 s |
| Spread Shot | 3-way shot | 20 s |
| Armor Vest | absorbs one hit | until hit |
| Sneakers | faster walk, higher jump, faster search | 20 s |
| Radar | reveals package fixtures (a flashing "!") and package stores on the map | rest of level |
| 1-Up | +1 life | instant |
| **Cinnabomb** (food) | invincible and flashing; touching spies kills them | 6 s |
| **Orange Juli-Ooze** (food) | 1.5× walk speed (shares the Sneakers slot) | 12 s |
| **Soft Pretzel** (food) | armour, like the vest | until hit |

- **Slots:** only one weapon (Rapid or Spread) at a time; a new one replaces the old. Armour, speed and Radar stack with the weapon.
- **Timers:** they keep running inside stores and pause only in the map, pause and continue screens.
- **On death:** everything is lost except Radar.
- **Where they come from:** food mostly from Hot Spy on a Stick and spy drops.
- **HUD:** shows the active timed power-up with a draining bar.

## 8. Rules and scoring

- **Lives:** 3 lives, plus one extra life at 20,000 points.
- **Points:**

| Event | Points |
|---|---|
| Spy shot | 100 |
| Spy crushed by an elevator, killed by a lamp, disco ball or wet-floor slide kick | 300 each |
| Package | 500 |
| Power-up | 50 |
| Level clear | 1000 |
| Time bonus | 10 per second under 300 s |
| Coin | 50 |
| Shooting a mall walker | −200 |
| Caught by the mall cop | −500 |
| Joke item | 1 |

- **Loops:** each loop, spies get about 10% faster, appear about 15% more often and shoot about 15% more often, and the alarm comes about 20 s sooner. All of these are capped.
- **Black Friday Mode:** twice the spy cap and spawn rate, a "70% OFF" sign on every open storefront, and every non-package fixture holds a power-up.
- **HUD** (16 px strip):
  - Score (6 digits).
  - "PKG n/6", red until all 6 are found, then green.
  - Lives with a head icon.
  - The active power-up name and timer bar, plus armour and radar icons.
  - "ALARM", blinking.
  - An **elevator-style LED floor panel** showing R / 4F … P. Inside a store it scrolls the store name like a marquee.
- **Effects:** screen shake on crushes and falling lamps; fades between scenes; floating score popups.

## 9. Humour

Keep every line of copy in one easy-to-edit place, with tests that each line fits on screen. The minimum set:

**Lines have to fit:**
- speech bubbles: 28 characters or fewer,
- SPYGRAM caption lines: 21 characters, 2 lines at most,
- comments: 21 characters,
- headline lines: 26 characters.

**SPYGRAM** (a parody photo app; never the real brand):
- **The card:** a magenta header, the agent's photo, a caption, a like counter that climbs quickly, and one comment.
- **On arrival:** a phone flash on the roof, then one of 10 random posts:
  - "FEELING CUTE, / MIGHT DELETE LATER" (MOM: SO PROUD OF U)
  - "FIRST DAY ON THE JOB! / #BLESSED" (BOSS: DELETE THIS)
  - "MALL RAT? NO. / MALL AGENT." (MOM: WEAR A JACKET)
  - "ZIPLINE WAS $0. / PARKING WAS $12." (DAD: TOLD U SO)
  - "OUTFIT OF THE DAY: / TRENCHCOAT, AGAIN" (FOREVER12: 20% OFF!)
  - "NO SPIES WERE HARMED / IN THIS SELFIE. YET." (DIMITRI: :( )
  - "ROOFTOP VIBES / #UNDERCOVER" (HQ: WHY IS IT PUBLIC)
  - "DON'T TELL HQ, I'M / HERE FOR PRETZELS" (HQ: WE CAN SEE THIS)
  - "GOLDEN HOUR. / LICENSE TO CHILL." (MOM: CALL YOUR MOTHER)
  - "SECRET MISSION. / PLEASE LIKE & SHARE" (HQ: ...SERIOUSLY?)
- **On mission complete:** one of 10 random posts:
  - "MISSION COMPLETE. / ALSO BOUGHT SOCKS." (MOM: WHAT COLOR?)
  - "6 PACKAGES. / 0 RECEIPTS. #WIN" (RETURNS DESK: NO)
  - "SAVED THE WORLD. / STILL NO PARKING." (DAD: TYPICAL)
  - "SPIES: 0 / ME: 1 #MALLRAT" (BORIS: REMATCH?)
  - "GETAWAY CAR: / WOOD PANELING. ICONIC" (HQ: RETURN THE CAR)
  - "TREATED MYSELF TO A / CINNABOMB. EARNED IT." (MOM: EAT A VEGGIE)
  - "HQ SAID KEEP IT QUIET / SO HERE IS A POST" (HQ: YOU'RE FIRED)
  - "FOUND A PET ROCK. / HIS NAME IS KEVIN." (KEVIN: ...)
  - "BRB, RETURNING 6 / SUSPICIOUS PACKAGES" (MALL COP: WAIT WHAT)
  - "SEE YOU NEXT LOOP, / FOOD COURT" (HOT SPY: ♥♥♥)
- **Timing:** the arrival selfie lasts about 2.5 s, and any button skips it.

**First-visit store lines** (speech bubbles over the guards, second line about 1 s later):

| Store | Lines |
|---|---|
| KGB Toys | "DIMITRI, HE'S HERE!" / "DA! HIDE THE TEDDIES!" |
| Forever 12 | "IT'S NOT A DISGUISE." / "IT'S A LOOK, SERGEI." |
| RadioShock | "YOU'LL NEED BATTERIES." / the bot: "BEEP. NOT INCLUDED." |
| Hot Spy on a Stick | "WANT FRIES WITH THAT?" |
| Foot Lockpicker | "THESE ARE MY GETAWAY SHOES" / "BOTH LEFT FEET, COMRADE" |
| Sam Baddy | "TURN IT UP, BORIS!" |
| Crookstone | "TRY THE MASSAGE CHAIR..." |
| Sharper Imagine | the bot: "BEEP. PLEASE DON'T TOUCH." |
| Spender's Gifts | "WHOA... THE LAVA LAMP..." |

**Spy last words** (about 35% of kills, in a speech bubble): "I WAS JUST BROWSING!", "WHAT'S YOUR RETURN POLICY?!", "I HAD A COUPON!", "TELL MY CAT...", "NOT THE FACE!", "I WAS ON MY LUNCH BREAK!", "WORTH IT. 70% OFF.", "MY RECEIPT...".

**Spies stepping out of an elevator** say: "...NICE WEATHER.", "GOING DOWN? ME TOO.", "*AWKWARD COUGH*", "THIS IS MY FLOOR, ACTUALLY".

**Mall PA** (a chime and a multi-line banner about once a minute, never the same twice in a row):
- "ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN."
- "FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY."
- "WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT."
- "LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7."
- "BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND."
- "THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER."
- "A REMINDER: SECURITY IS WATCHING. MOSTLY TV."

**THE DAILY MALL headlines:**
- "LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING"
- "SPIES FOILED; FOOD COURT SALES UP 300%"
- "MAN ZIPLINES ONTO ROOF. SECURITY 'NOT SURPRISED'"
- "MALL WALKERS DEMAND APOLOGY FOR 'HEY!' INCIDENT"
- "GAMESTONK SHARE PRICE DOWN ANOTHER 99%"

**Other bits:** the level-clear spy waving a receipt, the "OCCUPIED!!" fitting room, "HEY!" from the mall walkers, "DETAINED! -500", and every PA line.

## 10. Music and sound

All original compositions; no copyrighted melodies.

**Music:**
- Title: a heroic theme.
- **The mall itself:** a *quiet, sparse ambient* bed (soft pads, slow bass, a rare bell) at a noticeably lower volume.
- Alarm: a tense, faster spy groove with a siren figure.
- Elevator: a muzak arrangement.
- **One distinct song per store** (10 open stores):

| Store | Style |
|---|---|
| Forever 12 | disco strut |
| RadioShock | bleepy arpeggios |
| KGB Toys | music-box waltz in 3/4 |
| Hot Spy on a Stick | boardwalk polka |
| Foot Lockpicker | stadium march |
| Sam Baddy | rock riff |
| Crookstone | lounge bossa nova |
| Sharper Imagine | dreamy synth pads |
| Spender's Gifts | surf groove |
| GameStonk | hyper game-menu jingle |

- Listening booth: a bonus pop track.
- Jingles: level clear, game over and item-get.

**Sound effects:** shot, enemy shot, jump, elevator ding and hum, crush, falling lamp, glass, search tick, package fanfare, power-up, hurt, death, door, text blip, whistle, helmet ping, coins, slide/zip, PA chime, smoke, shriek, buzzer, pause.

## 11. Quality, testing and verification

- **Automated tests** for:
  - the fixed-step loop, input mapping (layouts, stuck keys, tap queue), the seeded random generator and the pixel-art pipeline;
  - that every required sprite exists at the right size with at most 3 colours;
  - that the store room templates are valid, and the level-setup rules (exactly one package per target store, power-up shops never trapped, Black Friday rules);
  - that every floor can be reached;
  - physics (jump arc, landing, safe and fatal falls);
  - elevators (gliding to a floor, exactly one ding, crush rules, calling, occupancy);
  - scoring, extra life and difficulty scaling;
  - power-up slots and timers, including in stores;
  - NPC rules (wet floor, cop, walkers, kiosk);
  - the Konami code (including extra leading Ups);
  - spy fairness (first-shot delay, telegraph length, dodge rate);
  - searching (a single tap works, a fixture touched at a gap works, auto-facing, cancelling, re-entry keeps opened fixtures);
  - the easter egg, fitting room, toys and booth;
  - the exit rule (blocked with packages missing, fires exactly once);
  - continues;
  - the splash flicker timing;
  - every piece of copy fitting its length limit.
- **Browser playtests:** play the game in a real browser with automation, not only with deterministic stepping. The CRT effect must be ON, the default.
  - Go through the splash, the title and the zip-line arrival.
  - Ride an elevator and an escalator, and shoot a spy and a lamp.
  - Enter a store, search and find a package, and leave.
  - Open the map, pause, trigger level clear, a continue and game over.
  - Check that the browser console shows no errors.
  - Take screenshots and actually look at them.
- **Content checks:** the storefronts are readable, the signs fit, text never runs off screen, and bubbles stay on screen.

## 12. Deliverables

1. The complete game source, with the test suite, a production build command and a dev-server command.
2. A CI workflow: test, build, deploy to GitHub Pages on every push to `main`.
3. **README.md** for GitHub:
   - the pitch, a "Play in your browser" link, screenshots, features, controls, tips;
   - how to run, test and build, the debug URL options, and the project layout;
   - where to add jokes;
   - a disclaimer: a FLICKERSOFT fan homage, not affiliated with Taito or any parodied brand.
4. **AGENTS.md** for future coding agents: architecture, rules that must hold (game rules separate from rendering, seeded randomness, frame units), conventions, how to verify changes, and the gotchas you hit.
5. The FLICKERSOFT splash as a clearly separated, reusable module with a short README.

## 13. Definition of done

- Every feature above works in a desktop browser, start to finish:
  splash → title → zip-line arrival and selfie → collect 6 packages across mall and stores → exit on P → level clear (tally, headline, post) → loop 2 is harder.
  Continues and game over also work.
- The full test suite passes, the production build succeeds, and the deployed build runs from a sub-path.
- A real-time browser playtest with the CRT on shows no console errors, no black or partly covered screens, no stuck inputs, no softlocks (for example, an elevator stranded where the player can't call it), and no text overflow.
- The game feels fair on loop 1: a new player can reach the 4F stores and find a package without dying on the first try.
