//! The whole game as a scene machine. Port of `game/game.ts`.
use crate::audio_ids::{MusicId, SfxId};
use crate::engine::pad::Pad;
use crate::engine::rng::Rng;
use crate::game::level::{Level, LevelOverlay, LevelResult};
use crate::game::run::{Run, RunOpts};
use crate::game::screens::r#continue::{ContinueResult, ContinueScreen};
use crate::game::screens::gameover::GameOverScreen;
use crate::game::screens::levelclear::{LevelClearOpts, LevelClearScreen};
use crate::game::screens::screen::Screen;
use crate::game::screens::splash::SplashScreen;
use crate::game::screens::title::TitleScreen;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SceneKind {
    Splash,
    Title,
    Level,
    Clear,
    Continue,
    Gameover,
}

impl SceneKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            SceneKind::Splash => "splash",
            SceneKind::Title => "title",
            SceneKind::Level => "level",
            SceneKind::Clear => "clear",
            SceneKind::Continue => "continue",
            SceneKind::Gameover => "gameover",
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct GameOptions {
    pub seed: u32,
    /// Skip the FLICKERSOFT splash (?debug=1).
    pub skip_splash: bool,
    /// Start straight in the mall (debug / automated playtests); skips the title.
    pub autostart: bool,
    /// Skip the zip-line arrival too (debug).
    pub skip_intro: bool,
    pub black_friday: bool,
    pub hi_score: i32,
}

/// The whole game as a scene machine. `step(pad)` is THE entry point: the rAF loop and the ?debug=1 stepper
/// both call it, once per 60 Hz frame. Everything inside is deterministic for a given seed and input sequence.
///
/// ```text
///   splash -> title -> level (mall <-> store, map, pause) -> clear -> level (next loop)
///                          \-> continue -> level | gameover -> title
/// ```
///
/// `run` and `level` are separate fields so the level can be stepped with `&mut run` (split borrows).
pub struct Game {
    pub scene: SceneKind,
    pub frame: i32,
    pub seed: u32,
    pub rng: Rng,
    /// Session high score (resets when the page reloads).
    pub hi_score: i32,

    pub run: Option<Run>,
    pub level: Option<Level>,
    pub splash: Option<SplashScreen>,
    pub title: Option<TitleScreen>,
    pub clear: Option<LevelClearScreen>,
    pub cont: Option<ContinueScreen>,
    pub over: Option<GameOverScreen>,

    games: i32,
    sfx_queue: Vec<SfxId>,
    skip_intro: bool,
}

impl Game {
    pub fn new(opts: GameOptions) -> Game {
        let mut g = Game {
            scene: SceneKind::Splash,
            frame: 0,
            seed: opts.seed,
            rng: Rng::new(opts.seed),
            hi_score: opts.hi_score,
            run: None,
            level: None,
            splash: None,
            title: None,
            clear: None,
            cont: None,
            over: None,
            games: 0,
            sfx_queue: Vec::new(),
            skip_intro: opts.skip_intro,
        };
        if opts.autostart {
            g.scene = SceneKind::Title;
            g.start_run(opts.black_friday);
        } else if opts.skip_splash {
            g.scene = SceneKind::Title;
            g.title = Some(TitleScreen::new(g.hi_score));
        } else {
            g.scene = SceneKind::Splash;
            g.splash = Some(SplashScreen::new());
        }
        g
    }

    // ------------------------------------------------------------------ the one entry point
    pub fn step(&mut self, pad: Pad) {
        self.frame += 1;
        match self.scene {
            SceneKind::Splash => self.step_splash(&pad),
            SceneKind::Title => self.step_title(&pad),
            SceneKind::Level => self.step_level(pad),
            SceneKind::Clear => self.step_clear(&pad),
            SceneKind::Continue => self.step_continue(&pad),
            SceneKind::Gameover => self.step_game_over(&pad),
        }
        if let Some(run) = &mut self.run {
            let drained = run.drain_sfx();
            self.sfx_queue.extend(drained);
        }
    }

    // ------------------------------------------------------------------ scenes
    fn step_splash(&mut self, pad: &Pad) {
        let s = self.splash.as_mut().unwrap();
        s.step(pad);
        let sfx = s.drain_sfx();
        let done = s.done();
        self.collect(sfx);
        if done {
            self.splash = None;
            self.title = Some(TitleScreen::new(self.hi_score));
            self.scene = SceneKind::Title;
        }
    }

    fn step_title(&mut self, pad: &Pad) {
        let t = self.title.as_mut().unwrap();
        t.step(pad);
        let sfx = t.drain_sfx();
        let done = t.done();
        let bf = t.black_friday();
        self.collect(sfx);
        if done {
            self.title = None;
            self.start_run(bf);
        }
    }

    fn start_run(&mut self, black_friday: bool) {
        self.games += 1;
        // JS: `seed + (games - 1) * 7919` (the Rng/Run take the number modulo 2^32).
        let seed = self.seed.wrapping_add(((self.games - 1) as u32).wrapping_mul(7919));
        let mut run = Run::new(seed, RunOpts { black_friday, hi_score: self.hi_score });
        let level = Level::new(&mut run, self.rng.fork(&format!("game{}", self.games)), self.skip_intro);
        self.run = Some(run);
        self.level = Some(level);
        self.scene = SceneKind::Level;
    }

    fn step_level(&mut self, pad: Pad) {
        let result = {
            let Game { run, level, hi_score, .. } = self;
            let lv = level.as_mut().unwrap();
            let run = run.as_mut().unwrap();
            lv.step(run, pad);
            *hi_score = (*hi_score).max(run.hi_score).max(run.score);
            lv.result
        };
        match result {
            Some(LevelResult::Clear) => {
                let run = self.run.as_ref().unwrap();
                let d = self.level.as_ref().unwrap().clear_data(run);
                let rng = self.rng.fork(&format!("clear{}-{}", self.games, run.loop_));
                self.clear = Some(LevelClearScreen::new(LevelClearOpts {
                    rng: &rng,
                    packages: d.packages,
                    time_bonus: d.time_bonus,
                    clear_bonus: d.clear_bonus,
                    loop_n: d.loop_n,
                    score: d.score,
                    score_includes_bonus: true,
                }));
                self.scene = SceneKind::Clear;
            }
            Some(LevelResult::Continue) => {
                self.cont = Some(ContinueScreen::new(self.run.as_ref().unwrap().continues_left));
                self.scene = SceneKind::Continue;
            }
            Some(LevelResult::Gameover) => self.end_game(),
            None => {}
        }
    }

    fn step_clear(&mut self, pad: &Pad) {
        let c = self.clear.as_mut().unwrap();
        c.step(pad);
        let sfx = c.drain_sfx();
        let done = c.done();
        self.collect(sfx);
        if done {
            self.clear = None;
            let run = self.run.as_mut().unwrap();
            run.loop_ += 1;
            let level = Level::new(run, self.rng.fork(&format!("game{}", self.games)), self.skip_intro);
            self.level = Some(level);
            self.scene = SceneKind::Level;
        }
    }

    fn step_continue(&mut self, pad: &Pad) {
        let c = self.cont.as_mut().unwrap();
        c.step(pad);
        let sfx = c.drain_sfx();
        let done = c.done();
        let result = c.result();
        self.collect(sfx);
        if !done {
            return;
        }
        if result == Some(ContinueResult::Continue) {
            self.cont = None;
            let run = self.run.as_mut().unwrap();
            run.use_continue();
            self.level.as_mut().unwrap().resume(run);
            self.scene = SceneKind::Level;
        } else {
            self.cont = None;
            self.end_game();
        }
    }

    fn end_game(&mut self) {
        let run = self.run.as_ref().unwrap();
        self.hi_score = self.hi_score.max(run.score);
        self.over = Some(GameOverScreen::new(run.score, self.hi_score));
        self.scene = SceneKind::Gameover;
    }

    fn step_game_over(&mut self, pad: &Pad) {
        let o = self.over.as_mut().unwrap();
        o.step(pad);
        let sfx = o.drain_sfx();
        let done = o.done();
        self.collect(sfx);
        if done {
            self.over = None;
            self.run = None;
            self.level = None;
            self.title = Some(TitleScreen::new(self.hi_score));
            self.scene = SceneKind::Title;
        }
    }

    // ------------------------------------------------------------------ outputs
    fn collect(&mut self, sfx: Vec<SfxId>) {
        self.sfx_queue.extend(sfx);
    }

    /// Sound effects requested since the last call.
    pub fn drain_sfx(&mut self) -> Vec<SfxId> {
        std::mem::take(&mut self.sfx_queue)
    }

    /// The music the current scene wants (None = silence).
    pub fn music(&self) -> Option<MusicId> {
        match self.scene {
            SceneKind::Splash => self.splash.as_ref().unwrap().music(),
            SceneKind::Title => self.title.as_ref().unwrap().music(),
            SceneKind::Level => Some(self.level.as_ref().unwrap().music(self.run.as_ref().unwrap())),
            SceneKind::Clear => self.clear.as_ref().unwrap().music(),
            SceneKind::Continue => self.cont.as_ref().unwrap().music(),
            SceneKind::Gameover => self.over.as_ref().unwrap().music(),
        }
    }

    /// Pause turns the music down.
    pub fn duck(&self) -> bool {
        self.scene == SceneKind::Level && self.level.as_ref().unwrap().overlay == Some(LevelOverlay::Pause)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::layout::{floor_y, WAGON};
    use crate::content::powerups::PowerId;
    use crate::content::stores::{DOOR_W, DOOR_X, STORES};
    use crate::engine::pad::{pad_from_held, A, B, DOWN, LEFT, NO_PAD, RIGHT, SELECT, START, UP};
    use crate::game::mall::types::{Bullet, BulletOwner};

    struct Driver {
        held: u32,
        g: Game,
    }

    impl Driver {
        fn new(g: Game) -> Driver {
            Driver { held: 0, g }
        }
        fn hold(&mut self, mask: u32, n: i32) {
            for _ in 0..n {
                let pad: Pad = pad_from_held(self.held, mask);
                self.held = mask;
                self.g.step(pad);
            }
        }
        fn tap(&mut self, mask: u32) {
            self.hold(mask, 1);
            self.hold(0, 1);
        }
        fn idle(&mut self, n: i32) {
            self.hold(0, n);
        }
        fn lv(&self) -> &Level {
            self.g.level.as_ref().unwrap()
        }
        fn run(&self) -> &Run {
            self.g.run.as_ref().unwrap()
        }
    }

    fn start_with(o: GameOptions) -> Driver {
        Driver::new(Game::new(o))
    }
    fn start() -> Driver {
        start_with(GameOptions { seed: 7, ..Default::default() })
    }
    fn debug() -> Driver {
        start_with(GameOptions { seed: 7, skip_splash: true, skip_intro: true, ..Default::default() })
    }

    /// Enter the level quickly (debug: skip splash, press Start on the title, skip the arrival).
    fn enter_level(d: &mut Driver) {
        d.tap(START);
        assert_eq!(d.g.scene, SceneKind::Level);
        // skip the zip-line arrival (any button during the selfie), after running through zip/drop/crouch
        let mut i = 0;
        while i < 600 && d.lv().mall.intro.is_some() {
            d.tap(B);
            i += 1;
        }
        assert!(d.lv().mall.intro.is_none());
    }

    // ---------------------------------------------------------------- game flow
    #[test]
    fn game_flow_splash_to_title_after_3_s_or_immediately_on_any_button() {
        let mut d = start();
        assert_eq!(d.g.scene, SceneKind::Splash);
        d.idle(100);
        assert_eq!(d.g.scene, SceneKind::Splash);
        d.idle(100);
        assert_eq!(d.g.scene, SceneKind::Title);
        let mut d2 = start();
        d2.tap(A);
        assert_eq!(d2.g.scene, SceneKind::Title);
    }

    #[test]
    fn game_flow_debug_1_skips_the_splash() {
        assert_eq!(start_with(GameOptions { seed: 7, skip_splash: true, ..Default::default() }).g.scene, SceneKind::Title);
    }

    #[test]
    fn game_flow_title_to_level_on_start_the_arrival_plays_zip_line_drop_crouch_selfie_then_gives_control() {
        let mut d = start_with(GameOptions { seed: 7, skip_splash: true, ..Default::default() });
        d.tap(START);
        assert_eq!(d.g.scene, SceneKind::Level);
        let mut phases: Vec<&'static str> = Vec::new();
        let mut i = 0;
        while i < 800 && d.lv().mall.intro.is_some() {
            let ph = d.lv().mall.intro.as_ref().unwrap().phase.as_str();
            if !phases.contains(&ph) {
                phases.push(ph);
            }
            d.idle(1);
            let skip = matches!(&d.lv().mall.intro, Some(i) if i.phase.as_str() == "selfie" && i.t > 30);
            if skip {
                d.tap(B);
            }
            i += 1;
        }
        assert_eq!(phases, vec!["zip", "drop", "crouch", "selfie"]);
        assert!(d.lv().mall.intro.is_none());
        assert_eq!(d.lv().mall.player.floor, Some(0));
    }

    #[test]
    fn game_flow_the_selfie_lasts_about_2_5_s_and_any_button_skips_it() {
        let mut d = start_with(GameOptions { seed: 7, skip_splash: true, ..Default::default() });
        d.tap(START);
        while matches!(&d.lv().mall.intro, Some(i) if i.phase.as_str() != "selfie") {
            d.idle(1);
        }
        let mut frames = 0;
        while d.lv().mall.intro.is_some() && frames < 400 {
            d.idle(1);
            frames += 1;
        }
        assert!(frames > 130, "{}", frames);
        assert!(frames < 170, "{}", frames);
    }

    #[test]
    fn game_flow_the_konami_code_on_the_title_with_extra_leading_ups_starts_black_friday_mode() {
        let mut d = start_with(GameOptions { seed: 7, skip_splash: true, ..Default::default() });
        for b in [UP, UP, UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A] {
            d.tap(b);
        }
        assert!(d.g.title.as_ref().unwrap().black_friday());
        d.tap(START);
        assert!(d.run().black_friday);
        let mut d2 = start_with(GameOptions { seed: 7, skip_splash: true, ..Default::default() });
        d2.tap(START);
        assert!(!d2.run().black_friday);
    }

    #[test]
    fn game_flow_pause_and_the_map_stop_every_timer_start_select_resume() {
        let mut d = debug();
        enter_level(&mut d);
        d.idle(30);
        let f0 = d.run().level_frames;
        d.tap(START);
        assert_eq!(d.lv().overlay, Some(LevelOverlay::Pause));
        assert!(d.g.duck());
        d.idle(120);
        assert_eq!(d.run().level_frames, f0);
        d.tap(START);
        assert_eq!(d.lv().overlay, None);
        let f1 = d.run().level_frames;
        d.tap(SELECT);
        assert_eq!(d.lv().overlay, Some(LevelOverlay::Map));
        d.idle(120);
        assert_eq!(d.run().level_frames, f1);
        d.tap(SELECT);
        assert_eq!(d.lv().overlay, None);
        d.idle(10);
        assert!(d.run().level_frames > f1);
    }

    // ---------------------------------------------------------------- stores and the exit
    #[test]
    fn stores_and_the_exit_up_at_an_open_store_door_fades_into_the_room_walking_out_fades_back_at_the_door() {
        let mut d = debug();
        enter_level(&mut d);
        let st = STORES.iter().find(|s| s.id.as_str() == "forever12").unwrap();
        {
            let p = &mut d.g.level.as_mut().unwrap().mall.player;
            p.x = st.x + DOOR_X + DOOR_W / 2.0;
            p.y = floor_y(st.floor as f64);
            p.floor = Some(st.floor);
            p.peak_y = p.y;
        }
        d.tap(UP);
        assert!(d.lv().fade.is_some());
        d.idle(40);
        assert!(d.lv().store.is_some());
        assert_eq!(d.lv().store.as_ref().unwrap().store_id.as_str(), "forever12");
        let hud = d.lv().hud(d.run());
        assert_eq!(hud.marquee, Some("FOREVER 12"));
        assert_eq!(hud.floor, None);
        // walk out through the door: down
        d.hold(DOWN, 200);
        d.idle(60);
        assert!(d.lv().store.is_none());
        assert!((d.lv().mall.player.x - (st.x + DOOR_X + DOOR_W / 2.0)).abs() < 2.0);
        assert_eq!(d.lv().mall.player.floor, Some(st.floor));
    }

    #[test]
    fn stores_and_the_exit_level_clear_triggers_exactly_once_pays_the_bonuses_then_the_next_loop_starts_harder() {
        let mut d = debug();
        enter_level(&mut d);
        for s in d.g.run.as_mut().unwrap().level.stores.iter_mut().flatten() {
            s.package_taken = true;
        }
        {
            let p = &mut d.g.level.as_mut().unwrap().mall.player;
            p.x = WAGON.x + 30.0;
            p.y = floor_y(5.0);
            p.floor = Some(5);
            p.peak_y = p.y;
        }
        d.g.run.as_mut().unwrap().level_frames = 100 * 60;
        let before = d.run().score;
        d.tap(UP);
        assert_eq!(d.g.scene, SceneKind::Clear);
        assert_eq!(d.run().score - before, 2000 + 1000); // 200 s left x 10 + clear bonus
        // press nothing more: the screen runs its own timers; pressing Up again does not retrigger
        for _ in 0..5 {
            d.tap(UP);
        }
        assert_eq!(d.g.scene, SceneKind::Clear);
        // skip through the phases
        let mut guard = 0;
        while d.g.scene == SceneKind::Clear && guard < 4000 {
            d.tap(START);
            guard += 1;
        }
        assert_eq!(d.g.scene, SceneKind::Level);
        assert_eq!(d.run().loop_, 2);
        assert!(d.lv().mall.diff.spy_speed > 0.8);
        assert_eq!(d.run().packages(), 0);
    }

    // ---------------------------------------------------------------- continues and game over
    fn kill_all(d: &mut Driver) {
        {
            let w = &mut d.g.level.as_mut().unwrap().mall;
            w.player.invuln = 0;
            let b = Bullet { x: w.player.x - 1.0, y: w.player.y - 12.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 };
            w.bullets.push(b);
        }
        d.idle(120);
    }

    #[test]
    fn continues_and_game_over_the_last_life_leads_to_continue_with_a_9_s_countdown_start_gives_3_fresh_lives_score_kept_powers_reset() {
        let mut d = debug();
        enter_level(&mut d);
        {
            let run = d.g.run.as_mut().unwrap();
            run.lives = 1;
            run.add_score(1234);
            run.give_power(PowerId::Rapid);
        }
        kill_all(&mut d);
        assert_eq!(d.g.scene, SceneKind::Continue);
        assert!(d.g.cont.as_ref().unwrap().count() >= 8);
        assert_eq!(d.g.cont.as_ref().unwrap().continues_left, 3);
        let c0 = d.g.cont.as_ref().unwrap().count();
        d.idle(60);
        assert_eq!(d.g.cont.as_ref().unwrap().count(), c0 - 1);
        d.tap(START);
        assert_eq!(d.g.scene, SceneKind::Level);
        assert_eq!(d.run().lives, 3);
        assert_eq!(d.run().continues_left, 2);
        assert!(d.run().score >= 1234);
        assert!(d.run().power.weapon.is_none());
    }

    #[test]
    fn continues_and_game_over_letting_the_countdown_run_out_ends_the_game_the_high_score_survives_to_the_title() {
        let mut d = debug();
        enter_level(&mut d);
        {
            let run = d.g.run.as_mut().unwrap();
            run.lives = 1;
            run.add_score(777);
        }
        kill_all(&mut d);
        assert_eq!(d.g.scene, SceneKind::Continue);
        d.idle(9 * 60 + 5);
        assert_eq!(d.g.scene, SceneKind::Gameover);
        let mut guard = 0;
        while d.g.scene == SceneKind::Gameover && guard < 3000 {
            d.tap(START);
            guard += 1;
        }
        assert_eq!(d.g.scene, SceneKind::Title);
        assert!(d.g.title.as_ref().unwrap().hi_score >= 777);
    }

    #[test]
    fn continues_and_game_over_with_no_continues_left_the_last_death_goes_straight_to_game_over() {
        let mut d = debug();
        enter_level(&mut d);
        {
            let run = d.g.run.as_mut().unwrap();
            run.lives = 1;
            run.continues_left = 0;
        }
        kill_all(&mut d);
        assert_eq!(d.g.scene, SceneKind::Gameover);
    }

    // ---------------------------------------------------------------- determinism
    #[test]
    fn determinism_the_same_seed_and_inputs_always_produce_the_same_game() {
        let play = || -> String {
            let mut d = start_with(GameOptions { seed: 99, skip_splash: true, skip_intro: true, ..Default::default() });
            enter_level(&mut d);
            for i in 0..1500 {
                let phase = (i / 60) % 4;
                d.hold(
                    match phase {
                        0 => RIGHT,
                        1 => RIGHT | A,
                        2 => LEFT | B,
                        _ => DOWN,
                    },
                    1,
                );
            }
            let w = &d.lv().mall;
            let spies: Vec<(i32, &str)> = w.spies.iter().map(|s| (crate::engine::num::round_i(s.x), s.mode.as_str())).collect();
            let cars: Vec<f64> = w.cars.iter().map(|c| c.y).collect();
            format!("{:?}", (w.player.x, w.player.y, d.run().score, d.run().lives, spies, cars))
        };
        assert_eq!(play(), play());
    }

    #[test]
    fn determinism_no_pad_never_starts_anything() {
        let mut g = Game::new(GameOptions { seed: 1, skip_splash: true, ..Default::default() });
        for _ in 0..600 {
            g.step(NO_PAD);
        }
        assert_eq!(g.scene, SceneKind::Title);
    }
}
