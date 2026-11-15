//! Port of `game/mall/fairness.test.ts` ("the game feels fair on loop 1" for the MALL half).
//!
//! TODO(bot): these three tests drive the whole `Game` (`game::game::Game`) with the scripted player of `game::bot`
//! (`go_to_floor`, `walk_to`, `mall_reflexes`), neither of which exists yet (the lead ports `game/{game,bot}.rs`
//! later). They are `#[ignore]`d placeholders carrying the TS spec; port the body once those modules land.
//!
//! The TS file computes `results = Array.from({ length: 16 }, (_, i) => tour(i + 1))` once, where `tour(seed)`:
//!  * builds `new Game({ seed, skipSplash: true })`, taps START, and waits (<= 700 frames) for the arrival intro to
//!    finish, tapping B once the selfie has been up for more than 20 frames;
//!  * with a bot whose `hold(mask, n)` applies `mallReflexes(mall, mask)` to every frame, counts deaths (a frame where
//!    the player mode becomes 'dying'), and for floors 1..=5 runs `goToFloor(bot, floor)` (recording
//!    `reachedFourF = deaths === 0` after floor 1), walks to the door of the first non-closed store on that floor
//!    (`walkTo(bot, st.x + DOOR_X + DOOR_W / 2)`) and idles 60 frames; any bot error just ends the tour
//!    (`completed = false`).

#[test]
#[ignore = "TODO(bot): needs game::game::Game and game::bot"]
fn a_new_player_reaches_the_4f_stores_without_dying_on_the_first_try() {
    // expect(results.filter(r => r.reachedFourF).length / 16).toBeGreaterThanOrEqual(0.9)
}

#[test]
#[ignore = "TODO(bot): needs game::game::Game and game::bot"]
fn a_full_tour_of_all_six_floors_costs_about_one_life_or_less_on_average() {
    // expect(average deaths over the 16 tours).toBeLessThanOrEqual(1.6)
}

#[test]
#[ignore = "TODO(bot): needs game::game::Game and game::bot"]
fn most_tours_complete_the_routes_are_never_blocked() {
    // expect(results.filter(r => r.completed).length / 16).toBeGreaterThanOrEqual(0.6)
}
