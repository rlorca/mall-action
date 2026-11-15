//! One level (one loop of the game). Port of `game/level.ts`.
//!
//! Ownership note: in TS the Level holds a reference to the Run. Here the `Game` owns the `Run` and the `Level` side
//! by side, and every `Level` method that needs the run takes it as a parameter (`step(&mut self, run: &mut Run, pad)`,
//! `hud(&self, run: &Run)`, ...), exactly like `StoreWorld::step` / `MallWorld::step`.
use crate::audio_ids::MusicId;
use crate::content::stores::{store_def, StoreId, STORES};
use crate::engine::pad::{Pad, SELECT, START};
use crate::engine::rng::Rng;
use crate::game::hud::{HudData, HudTimed};
use crate::game::levelstate::store_status;
use crate::game::mall::modules::install_extras;
use crate::game::mall::world::{IntroPhase, MallOptions, MallWorld, Outcome};
use crate::game::run::{LifeOutcome, Run, CLEAR_BONUS, POINTS};
use crate::game::screens::mapdata::{MapCar, MapData, MapPlayer};
use crate::game::store::{generate_level, StoreWorld};
use crate::audio_ids::SfxId;

/// Frames of the fade to / from black when entering or leaving a store.
pub const FADE_FRAMES: i32 = 16;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LevelOverlay {
    Map,
    Pause,
}

impl LevelOverlay {
    pub const fn as_str(self) -> &'static str {
        match self {
            LevelOverlay::Map => "map",
            LevelOverlay::Pause => "pause",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LevelResult {
    Clear,
    Continue,
    Gameover,
}

impl LevelResult {
    pub const fn as_str(self) -> &'static str {
        match self {
            LevelResult::Clear => "clear",
            LevelResult::Continue => "continue",
            LevelResult::Gameover => "gameover",
        }
    }
}

/// `'out'` = going dark, `'in'` = coming back.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FadeDir {
    Out,
    In,
}

impl FadeDir {
    pub const fn as_str(self) -> &'static str {
        match self {
            FadeDir::Out => "out",
            FadeDir::In => "in",
        }
    }
}

/// What runs once when the screen is fully black (the TS `swap` closure).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FadeSwap {
    /// Create the store world (its rng label uses the level frame count at swap time).
    EnterStore(StoreId),
    /// Back to the mall at the store's door.
    LeaveStore(StoreId),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Fade {
    pub dir: FadeDir,
    pub t: i32,
    /// Runs once when the screen is fully black (swap scenes here).
    pub swap: Option<FadeSwap>,
}

/// Data for the level-clear tally (the bonuses were already added to the score).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct ClearData {
    pub packages: i32,
    pub time_bonus: i32,
    pub clear_bonus: i32,
    pub loop_n: i32,
    pub score: i32,
}

/// One level (one loop of the game): the mall, the store the agent is currently in, the map and
/// pause overlays, the fades between scenes, and what ends the level (clear / continue / game over).
/// Pure rules: `step(run, pad)` advances one 60 Hz frame.
pub struct Level {
    pub mall: MallWorld,
    pub store: Option<StoreWorld>,
    pub overlay: Option<LevelOverlay>,
    pub fade: Option<Fade>,
    pub result: Option<LevelResult>,
    /// Level frame counter (blink/scroll), advances even in overlays.
    pub frame: i32,
    rng: Rng,
}

impl Level {
    /// `skip_intro` is TS `opts.skipIntro`.
    pub fn new(run: &mut Run, rng: Rng, skip_intro: bool) -> Level {
        let mut level_rng = rng.fork(&format!("level{}", run.loop_));
        run.level = generate_level(&mut level_rng, run.loop_, run.black_friday);
        run.level_frames = 0;
        run.alarm_on = false;
        run.reset_powers();
        let mall_rng = rng.fork(&format!("mall{}", run.loop_));
        let mut mall = MallWorld::new(run, mall_rng, MallOptions { skip_intro, ..Default::default() });
        install_extras(&mut mall);
        Level { mall, store: None, overlay: None, fade: None, result: None, frame: 0, rng }
    }

    /// Black level 0..4 for the renderer's fade (0 = none, 4 = black).
    pub fn fade_steps(&self) -> i32 {
        match &self.fade {
            None => 0,
            Some(f) => {
                let frac = 1.0f64.min(f.t as f64 / FADE_FRAMES as f64);
                ((if f.dir == FadeDir::Out { frac } else { 1.0 - frac }) * 4.0).ceil() as i32
            }
        }
    }

    pub fn in_store(&self) -> bool {
        self.store.is_some()
    }

    /// Overlays and fades stop the world (all timers pause in the map, pause and continue screens).
    pub fn paused(&self) -> bool {
        self.overlay.is_some()
    }

    pub fn step(&mut self, run: &mut Run, pad: Pad) {
        self.frame += 1;

        if self.fade.is_some() {
            self.step_fade(run);
            return;
        }

        if self.overlay == Some(LevelOverlay::Pause) {
            if pad.pressed & START != 0 {
                self.overlay = None;
                run.sfx(SfxId::Pause);
            }
            return;
        }
        if self.overlay == Some(LevelOverlay::Map) {
            if pad.pressed & (SELECT | START) != 0 {
                self.overlay = None;
                run.sfx(SfxId::Select);
            }
            return;
        }

        let arriving = self.store.is_none() && self.mall.intro.is_some();
        if !arriving {
            if pad.pressed & START != 0 {
                self.overlay = Some(LevelOverlay::Pause);
                run.sfx(SfxId::Pause);
                return;
            }
            if pad.pressed & SELECT != 0 {
                self.overlay = Some(LevelOverlay::Map);
                run.sfx(SfxId::Select);
                return;
            }
        }

        if !arriving {
            run.level_frames += 1;
        }

        if self.store.is_some() {
            self.step_store(run, pad);
        } else {
            self.step_mall(run, pad);
        }
    }

    // ------------------------------------------------------------------ mall
    fn step_mall(&mut self, run: &mut Run, pad: Pad) {
        let m = &mut self.mall;
        m.step(run, pad);
        if let Some(o) = m.outcome {
            self.result = Some(match o {
                Outcome::Continue => LevelResult::Continue,
                Outcome::Gameover => LevelResult::Gameover,
            });
            return;
        }
        if m.exit_triggered {
            m.exit_triggered = false;
            // Level clear: bonuses are paid out here; the tally screen shows them.
            run.add_score(run.time_bonus() + CLEAR_BONUS);
            self.result = Some(LevelResult::Clear);
            return;
        }
        if let Some(id) = m.enter_store {
            m.enter_store = None;
            self.start_fade(FadeDir::Out, Some(FadeSwap::EnterStore(id)));
        }
    }

    // ------------------------------------------------------------------ store
    fn step_store(&mut self, run: &mut Run, pad: Pad) {
        let s = self.store.as_mut().unwrap();
        s.step(run, pad);
        if s.died {
            let id = s.store_id;
            let next = run.lose_life();
            if next == LifeOutcome::Respawn {
                self.start_fade(FadeDir::Out, Some(FadeSwap::LeaveStore(id)));
            } else {
                // The Game shows CONTINUE / GAME OVER; on continue we come back out at the store door.
                self.result = Some(if next == LifeOutcome::Continue { LevelResult::Continue } else { LevelResult::Gameover });
            }
            return;
        }
        if s.exited {
            let id = s.store_id;
            self.start_fade(FadeDir::Out, Some(FadeSwap::LeaveStore(id)));
        }
    }

    fn leave_store(&mut self, id: StoreId) {
        self.store = None;
        self.mall.return_from_store(id);
    }

    // ------------------------------------------------------------------ fades
    fn start_fade(&mut self, dir: FadeDir, swap: Option<FadeSwap>) {
        self.fade = Some(Fade { dir, t: 0, swap });
    }

    fn step_fade(&mut self, run: &mut Run) {
        let f = self.fade.as_mut().unwrap();
        f.t += 1;
        if f.t >= FADE_FRAMES {
            if f.dir == FadeDir::Out {
                let swap = f.swap;
                match swap {
                    Some(FadeSwap::EnterStore(id)) => {
                        let rng = self.rng.fork(&format!("store-{}-{}", id.as_str(), run.level_frames));
                        self.store = Some(StoreWorld::new(run, id, &rng, None));
                    }
                    Some(FadeSwap::LeaveStore(id)) => self.leave_store(id),
                    None => {}
                }
                self.fade = Some(Fade { dir: FadeDir::In, t: 0, swap: None });
            } else {
                self.fade = None;
            }
        }
    }

    // ------------------------------------------------------------------ continue
    /// After CONTINUE (the Run already spent a continue): put the agent back where he fell.
    pub fn resume(&mut self, run: &mut Run) {
        self.result = None;
        self.overlay = None;
        self.fade = None;
        run.reset_powers();
        if let Some(s) = &self.store {
            let id = s.store_id;
            self.leave_store(id);
            self.mall.player.invuln = 120;
        } else {
            self.mall.resume();
        }
        self.mall.outcome = None;
    }

    // ------------------------------------------------------------------ outputs for the renderer / audio
    pub fn music(&self, run: &Run) -> MusicId {
        if let Some(s) = &self.store {
            return s.music();
        }
        let m = &self.mall;
        if let Some(i) = &m.intro {
            if i.phase == IntroPhase::Selfie && i.t < 90 {
                return MusicId::Selfie;
            }
        }
        m.music(run)
    }

    pub fn hud(&self, run: &Run) -> HudData {
        let t = run.active_timed();
        HudData {
            score: run.score,
            packages: run.packages(),
            lives: run.lives,
            timed: t.map(|t| HudTimed { name: t.name, frac: if t.total > 0 { t.left as f64 / t.total as f64 } else { 0.0 } }),
            armor: run.power.armor.is_some(),
            radar: run.power.radar,
            alarm: run.alarm_on,
            floor: if self.store.is_some() { None } else { Some(self.mall.hud_floor()) },
            marquee: self.store.as_ref().map(|s| store_def(s.store_id).name),
            frame: self.frame,
        }
    }

    pub fn map_data(&self, run: &Run) -> MapData {
        let mut statuses = [store_status(&run.level, STORES[0].id); 13];
        for s in STORES.iter() {
            statuses[s.id as usize] = store_status(&run.level, s.id);
        }
        let p = &self.mall.player;
        MapData {
            frame: self.frame,
            cars: self.mall.cars.iter().map(|c| MapCar { shaft: c.id, y: c.y }).collect(),
            player: MapPlayer { x: p.x, y: p.y, in_store: self.store.as_ref().map(|s| s.store_id) },
            statuses,
            radar: run.power.radar,
            inventory: run.inventory_line(),
            black_friday: run.black_friday,
        }
    }

    /// Data for the level-clear tally (the bonuses were already added to the score).
    pub fn clear_data(&self, run: &Run) -> ClearData {
        let secs = run.level_seconds();
        ClearData {
            packages: run.packages(),
            time_bonus: 0.max(300 - secs) * POINTS.time_per_second,
            clear_bonus: CLEAR_BONUS,
            loop_n: run.loop_,
            score: run.score,
        }
    }
}
