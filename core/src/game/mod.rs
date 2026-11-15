//! Game flow: scenes, session (score/lives/continues/loops), transitions and audio hints.
//! Pure rules: no rendering, no browser. The renderer reads this state; the shell plays `take_sfx()`.
pub mod elevator;
pub mod level;
pub mod mall;
pub mod powerups;
pub mod rooms;
pub mod store;

use crate::audio::{Sfx, Song};
use crate::copy;
use crate::flickersoft::Splash;
use crate::input::*;
use crate::rng::Rng;
use crate::stores::{self, StoreId};
use level::{setup_stores, slot, StoreState};
use mall::{Cause, Ctx, Ev, Mall, PState};
use powerups::{PowerKind, Powers};
use store::{SCtx, SEv, StoreRoom, StoreSong};

pub const START_LIVES: i32 = 3;
pub const CONTINUES: u32 = 3;
pub const EXTRA_LIFE_AT: i32 = 20_000;
pub const FADE_FRAMES: i32 = 14;
pub const CONTINUE_SECONDS: i32 = 9;

#[derive(Clone, Debug)]
pub struct Session {
    pub score: i32,
    pub hi: i32,
    pub lives: i32,
    pub continues: u32,
    pub loop_n: u32,
    pub packages: u32,
    pub bf: bool,
    pub extra_given: bool,
    pub egg_done: bool,
    pub jokes: Vec<usize>,
    pub strip: bool,
}

impl Session {
    pub fn new(hi: i32, bf: bool) -> Session {
        Session {
            score: 0,
            hi,
            lives: START_LIVES,
            continues: CONTINUES,
            loop_n: 1,
            packages: 0,
            bf,
            extra_given: false,
            egg_done: false,
            jokes: vec![],
            strip: false,
        }
    }
    /// Add (or subtract) points; grants the one extra life at 20,000. Returns true if a life was granted.
    pub fn add_score(&mut self, pts: i32) -> bool {
        self.score = (self.score + pts).max(0);
        if self.score > self.hi {
            self.hi = self.score;
        }
        if !self.extra_given && self.score >= EXTRA_LIFE_AT {
            self.extra_given = true;
            self.lives += 1;
            return true;
        }
        false
    }
}

/// Per-loop difficulty (each loop: spies ~10% faster, ~15% more frequent spawns and shots, alarm ~20 s sooner; all capped).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Difficulty {
    pub spy_speed: f32,
    pub spawn_rate: f32,
    pub shot_rate: f32,
    pub alarm_secs: i32,
}
pub fn difficulty(loop_n: u32) -> Difficulty {
    let n = loop_n as f32 - 1.0;
    Difficulty {
        spy_speed: (1.0 + 0.10 * n).min(1.6),
        spawn_rate: (1.0 + 0.15 * n).min(2.2),
        shot_rate: (1.0 + 0.15 * n).min(2.2),
        alarm_secs: (150 - 20 * loop_n as i32 + 20).max(60),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Overlay {
    None,
    Map,
    Pause,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Next {
    StartGame,
    EnterStore(StoreId),
    ExitStore,
    NextLevel,
    ToTitle,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ClearPhase {
    Drive,
    Tally,
    News,
    Post,
}

#[derive(Clone, Debug)]
pub struct ClearState {
    pub phase: ClearPhase,
    pub t: i32,
    pub time_bonus: i32,
    pub headline: usize,
    pub post: usize,
    pub secs: i32,
}

#[derive(Clone, Debug)]
pub enum Scene {
    Splash,
    Title,
    Mall,
    Store,
    Clear(ClearState),
    Continue { t: i32, from_store: bool },
    GameOver { t: i32 },
}

#[derive(Clone, Debug)]
pub struct Title {
    pub t: i32,
    pub konami: Konami,
    pub bf: bool,
    pub bf_t: i32,
}

pub struct Game {
    pub scene: Scene,
    pub overlay: Overlay,
    pub rng: Rng,
    pub seed: u64,
    pub s: Session,
    pub powers: Powers,
    pub stores: Vec<StoreState>,
    pub mall: Mall,
    pub room: Option<StoreRoom>,
    pub splash: Splash,
    pub title: Title,
    pub clear: Option<ClearState>,
    pub fade: i32,
    fade_in: i32,
    pending: Option<Next>,
    pub toast: Option<(String, i32)>,
    sfx: Vec<Sfx>,
    pub frame: u64,
    pub store_name_scroll: i32,
    pub cur_store: Option<StoreId>,
    pub debug: bool,
    pub hi_session: i32,
}

fn mall_ctx<'a>(
    powers: &'a mut Powers,
    stores: &'a [StoreState],
    s: &Session,
    rng: &'a mut Rng,
) -> Ctx<'a> {
    Ctx { powers, stores, loop_n: s.loop_n, bf: s.bf, packages: s.packages, rng }
}

impl Game {
    /// `skip_splash`: start at the title (debug mode).
    pub fn new(seed: u64, skip_splash: bool) -> Game {
        let mut rng = Rng::new(seed);
        let stores = setup_stores(&mut rng, false);
        let mall = Mall::new(&mut rng, 1);
        Game {
            scene: if skip_splash { Scene::Title } else { Scene::Splash },
            overlay: Overlay::None,
            rng,
            seed,
            s: Session::new(0, false),
            powers: Powers::new(),
            stores,
            mall,
            room: None,
            splash: Splash::new(),
            title: Title { t: 0, konami: Konami::new(), bf: false, bf_t: 0 },
            clear: None,
            fade: 0,
            fade_in: 0,
            pending: None,
            toast: None,
            sfx: vec![],
            frame: 0,
            store_name_scroll: 0,
            cur_store: None,
            debug: skip_splash,
            hi_session: 0,
        }
    }

    pub fn toast(&mut self, text: &str) {
        self.toast = Some((text.to_string(), 90));
    }
    pub fn take_sfx(&mut self) -> Vec<Sfx> {
        std::mem::take(&mut self.sfx)
    }
    fn sfx(&mut self, s: Sfx) {
        self.sfx.push(s);
    }
    pub fn in_transition(&self) -> bool {
        self.pending.is_some() || self.fade_in > 0
    }
    /// 0.0 = fully visible, 1.0 = black.
    pub fn fade_level(&self) -> f32 {
        if self.pending.is_some() {
            1.0 - self.fade as f32 / FADE_FRAMES as f32
        } else if self.fade_in > 0 {
            self.fade_in as f32 / FADE_FRAMES as f32
        } else {
            0.0
        }
    }
    fn begin(&mut self, n: Next) {
        if self.pending.is_none() {
            self.pending = Some(n);
            self.fade = FADE_FRAMES;
        }
    }

    // ------------------------------------------------------------------ session helpers
    fn add_score(&mut self, pts: i32) {
        if self.s.add_score(pts) {
            self.sfx(Sfx::PowerUp);
        }
        self.hi_session = self.hi_session.max(self.s.hi);
    }
    fn grant(&mut self, k: PowerKind) {
        if self.powers.grant(k) {
            self.s.lives += 1;
            self.sfx(Sfx::PowerUp);
        }
    }
    pub fn new_level(&mut self) {
        self.stores = setup_stores(&mut self.rng, self.s.bf);
        self.s.packages = 0;
        self.mall = Mall::new(&mut self.rng, self.s.loop_n);
        self.room = None;
        self.cur_store = None;
        self.powers = Powers { radar: false, ..Powers::new() };
        self.overlay = Overlay::None;
    }
    pub fn start_game(&mut self) {
        let hi = self.hi_session;
        let bf = self.title.bf;
        self.s = Session::new(hi, bf);
        self.s.hi = hi;
        self.new_level();
        self.scene = Scene::Mall;
    }

    // ------------------------------------------------------------------ the step
    pub fn step(&mut self, pad: PadState) {
        self.frame += 1;
        if let Some(t) = self.toast.as_mut() {
            t.1 -= 1;
        }
        if self.toast.as_ref().map_or(false, |t| t.1 <= 0) {
            self.toast = None;
        }
        // fades
        if let Some(n) = self.pending {
            self.fade -= 1;
            if self.fade <= 0 {
                self.pending = None;
                self.fade_in = FADE_FRAMES;
                self.do_transition(n);
            }
            return;
        }
        if self.fade_in > 0 {
            self.fade_in -= 1;
        }
        match self.scene.clone() {
            Scene::Splash => self.step_splash(pad),
            Scene::Title => self.step_title(pad),
            Scene::Mall | Scene::Store => self.step_play(pad),
            Scene::Clear(c) => self.step_clear(c, pad),
            Scene::Continue { t, from_store } => self.step_continue(t, from_store, pad),
            Scene::GameOver { t } => self.step_game_over(t, pad),
        }
    }

    fn do_transition(&mut self, n: Next) {
        match n {
            Next::StartGame => self.start_game(),
            Next::ToTitle => {
                self.scene = Scene::Title;
                self.title.t = 0;
                self.title.bf = false;
            }
            Next::EnterStore(id) => {
                let st_idx = self.stores.iter().position(|s| s.id == id).unwrap();
                let egg = id == StoreId::GameStonk && !self.s.egg_done;
                let mut c = SCtx { powers: &mut self.powers, rng: &mut self.rng, loop_n: self.s.loop_n, packages: self.s.packages };
                let room = StoreRoom::enter(id, &self.stores[st_idx], &mut c, egg);
                self.stores[st_idx].visited = true;
                self.room = Some(room);
                self.cur_store = Some(id);
                self.scene = Scene::Store;
                self.store_name_scroll = 0;
            }
            Next::ExitStore => {
                if let Some(id) = self.cur_store.take() {
                    let sl = slot(id);
                    self.mall.p.x = sl.door_x() as f32;
                    self.mall.p.floor = sl.floor;
                    self.mall.p.st = PState::Walk;
                    self.mall.p.z = 0.0;
                    self.mall.p.inv = self.mall.p.inv.max(30);
                    self.mall.p.safe_x = self.mall.p.x;
                    self.mall.p.safe_floor = sl.floor;
                    self.mall.spies.clear();
                    self.mall.bullets.clear();
                }
                self.room = None;
                self.scene = Scene::Mall;
            }
            Next::NextLevel => {
                self.s.loop_n += 1;
                self.new_level();
                self.clear = None;
                self.scene = Scene::Mall;
            }
        }
    }

    // ------------------------------------------------------------------ splash & title
    fn step_splash(&mut self, pad: PadState) {
        self.splash.step(pad.any_pressed());
        if self.splash.jingle_now() {
            self.sfx(Sfx::Select);
        }
        if self.splash.done() {
            self.scene = Scene::Title;
            self.title.t = 0;
        }
    }
    pub fn splash_song(&self) -> Option<Song> {
        match self.scene {
            Scene::Splash if self.splash.t >= crate::flickersoft::SETTLE_AT => Some(Song::FlickerJingle),
            _ => None,
        }
    }

    fn step_title(&mut self, pad: PadState) {
        self.title.t += 1;
        if self.title.bf_t > 0 {
            self.title.bf_t -= 1;
        }
        if self.title.konami.feed(pad.pressed) {
            self.title.bf = true;
            self.title.bf_t = 180;
            self.sfx(Sfx::PowerUp);
        }
        if pad.pressed(START) && self.title.t > 10 {
            self.sfx(Sfx::Select);
            self.begin(Next::StartGame);
        }
    }

    // ------------------------------------------------------------------ playing
    fn step_play(&mut self, pad: PadState) {
        // overlays
        if pad.pressed(SELECT) && !self.is_dying() {
            self.overlay = if self.overlay == Overlay::Map { Overlay::None } else { Overlay::Map };
            self.sfx(Sfx::Pause);
            return;
        }
        if pad.pressed(START) && !self.is_dying() {
            self.overlay = if self.overlay == Overlay::Pause { Overlay::None } else { Overlay::Pause };
            self.sfx(Sfx::Pause);
            return;
        }
        if self.overlay != Overlay::None {
            return; // everything is paused: no timers tick
        }
        self.powers.tick();
        match self.scene {
            Scene::Mall => self.step_mall(pad),
            Scene::Store => self.step_store(pad),
            _ => {}
        }
    }

    fn is_dying(&self) -> bool {
        match self.scene {
            Scene::Mall => matches!(self.mall.p.st, PState::Dying(_)),
            Scene::Store => self.room.as_ref().map_or(false, |r| matches!(r.st, store::PSt::Dying(_))),
            _ => false,
        }
    }

    fn step_mall(&mut self, pad: PadState) {
        let evs = {
            let mut ctx = mall_ctx(&mut self.powers, &self.stores, &self.s, &mut self.rng);
            self.mall.step(pad, &mut ctx);
            std::mem::take(&mut self.mall.ev)
        };
        self.handle_mall_events(evs);
    }

    fn handle_mall_events(&mut self, evs: Vec<Ev>) {
        for e in evs {
            match e {
                Ev::Sfx(s) => self.sfx(s),
                Ev::Score(n) => self.add_score(n),
                Ev::ExtraLife => {
                    self.s.lives += 1;
                }
                Ev::Power(k) => self.grant(k),
                Ev::PhotoStrip => self.s.strip = true,
                Ev::EnterStore(id) => self.begin(Next::EnterStore(id)),
                Ev::LevelClear => self.level_clear(),
                Ev::Died(c) => self.player_died(c),
            }
        }
    }

    fn player_died(&mut self, _cause: Cause) {
        self.powers.on_death();
        self.s.lives -= 1;
        if self.s.lives > 0 {
            match self.scene {
                Scene::Store => {
                    if let Some(r) = self.room.as_mut() {
                        r.respawn();
                    }
                }
                _ => self.mall.respawn(),
            }
        } else {
            let from_store = matches!(self.scene, Scene::Store);
            if self.s.continues > 0 {
                self.scene = Scene::Continue { t: CONTINUE_SECONDS * 60, from_store };
            } else {
                self.scene = Scene::GameOver { t: 0 };
            }
        }
    }

    fn step_store(&mut self, pad: PadState) {
        self.store_name_scroll += 1;
        let Some(id) = self.cur_store else { return };
        let idx = self.stores.iter().position(|s| s.id == id).unwrap();
        let mut sevs = vec![];
        if let Some(room) = self.room.as_mut() {
            let mut c = SCtx { powers: &mut self.powers, rng: &mut self.rng, loop_n: self.s.loop_n, packages: self.s.packages };
            room.step(pad, &mut self.stores[idx], &mut c);
            sevs = std::mem::take(&mut room.ev);
        }
        // the level clock keeps running in stores
        {
            let mut ctx = mall_ctx(&mut self.powers, &self.stores, &self.s, &mut self.rng);
            self.mall.idle_tick(&mut ctx);
            let evs = std::mem::take(&mut self.mall.ev);
            for e in evs {
                if let Ev::Sfx(s) = e {
                    self.sfx.push(s);
                }
            }
        }
        for e in sevs {
            match e {
                SEv::Sfx(s) => self.sfx(s),
                SEv::Score(n) => self.add_score(n),
                SEv::Package => {
                    self.s.packages += 1;
                    self.add_score(500);
                }
                SEv::Power(k) => {
                    self.grant(k);
                    self.add_score(50);
                }
                SEv::Joke(i) => {
                    self.s.jokes.push(i);
                }
                SEv::EggDone => self.s.egg_done = true,
                SEv::ExtraLife => self.s.lives += 1,
                SEv::Died => {
                    self.player_died(Cause::Bullet);
                    return;
                }
                SEv::Exit => {
                    self.begin(Next::ExitStore);
                    return;
                }
            }
        }
    }

    // ------------------------------------------------------------------ level clear
    fn level_clear(&mut self) {
        if !matches!(self.scene, Scene::Mall) {
            return;
        }
        let secs = self.mall.t / 60;
        let time_bonus = ((300 - secs).max(0)) * 10;
        self.add_score(time_bonus + 1000);
        self.sfx(Sfx::Door);
        self.scene = Scene::Clear(ClearState {
            phase: ClearPhase::Drive,
            t: 0,
            time_bonus,
            headline: self.rng.index(copy::HEADLINES.len()),
            post: self.rng.index(copy::CLEAR_POSTS.len()),
            secs,
        });
        self.overlay = Overlay::None;
    }

    fn step_clear(&mut self, mut c: ClearState, pad: PadState) {
        c.t += 1;
        let skip = pad.pressed(START);
        let limit = match c.phase {
            ClearPhase::Drive => 260,
            ClearPhase::Tally => 360,
            ClearPhase::News => 420,
            ClearPhase::Post => 480,
        };
        if skip || c.t >= limit {
            c.t = 0;
            match c.phase {
                ClearPhase::Drive => c.phase = ClearPhase::Tally,
                ClearPhase::Tally => c.phase = ClearPhase::News,
                ClearPhase::News => c.phase = ClearPhase::Post,
                ClearPhase::Post => {
                    self.scene = Scene::Clear(c);
                    self.begin(Next::NextLevel);
                    return;
                }
            }
        }
        if c.phase == ClearPhase::Tally && c.t > 0 && c.t % 40 == 0 {
            self.sfx(Sfx::Beep);
        }
        self.scene = Scene::Clear(c);
    }

    // ------------------------------------------------------------------ continue / game over
    fn step_continue(&mut self, t: i32, from_store: bool, pad: PadState) {
        if pad.pressed(START) {
            self.s.lives = START_LIVES;
            self.s.continues -= 1;
            self.powers.reset_all();
            if from_store {
                if let Some(r) = self.room.as_mut() {
                    r.respawn();
                }
                self.scene = Scene::Store;
            } else {
                self.mall.respawn();
                self.scene = Scene::Mall;
            }
            self.sfx(Sfx::PowerUp);
            return;
        }
        if t % 60 == 0 && t > 0 {
            self.sfx(Sfx::Beep);
        }
        if t <= 1 {
            self.scene = Scene::GameOver { t: 0 };
        } else {
            self.scene = Scene::Continue { t: t - 1, from_store };
        }
    }

    pub fn continue_seconds(&self) -> i32 {
        match self.scene {
            Scene::Continue { t, .. } => (t + 59) / 60,
            _ => 0,
        }
    }

    fn step_game_over(&mut self, t: i32, pad: PadState) {
        if t == 0 {
            self.sfx(Sfx::PaChime);
        }
        let t = t + 1;
        let title_at = 760;
        if (pad.pressed(START) && t > 330) || t >= title_at {
            self.hi_session = self.hi_session.max(self.s.score);
            self.scene = Scene::GameOver { t };
            self.begin(Next::ToTitle);
            return;
        }
        self.scene = Scene::GameOver { t };
    }

    // ------------------------------------------------------------------ audio hints
    pub fn song(&self) -> Option<Song> {
        match &self.scene {
            Scene::Splash => self.splash_song(),
            Scene::Title => Some(Song::Title),
            Scene::Mall => {
                if matches!(self.mall.p.st, PState::Inside(_) | PState::Roof(_)) && self.mall.control {
                    Some(Song::Elevator)
                } else if self.mall.alarm {
                    Some(Song::Alarm)
                } else {
                    Some(Song::Mall)
                }
            }
            Scene::Store => {
                let id = self.cur_store?;
                Some(match self.room.as_ref().map(|r| r.song_hint()) {
                    Some(StoreSong::Booth) => Song::ListeningBooth,
                    Some(StoreSong::ItemGet) => Song::ItemGet,
                    _ => Song::Store(id),
                })
            }
            Scene::Clear(c) => Some(match c.phase {
                ClearPhase::Drive => Song::LevelClear,
                _ => Song::Tally,
            }),
            Scene::Continue { .. } => None,
            Scene::GameOver { t } => (*t > 200 && *t < 600).then_some(Song::GameOver),
        }
    }
    pub fn music_volume(&self) -> f32 {
        if self.overlay == Overlay::Pause {
            0.3
        } else {
            1.0
        }
    }
    /// Looping elevator hum while riding a moving car.
    pub fn hum(&self) -> bool {
        matches!(self.scene, Scene::Mall) && self.overlay == Overlay::None && self.mall.hum
    }

    // ------------------------------------------------------------------ misc queries for the renderer
    pub fn has_radar(&self) -> bool {
        self.powers.radar
    }
    pub fn packages_left(&self) -> u32 {
        6 - self.s.packages.min(6)
    }
    pub fn store_state(&self, id: StoreId) -> &StoreState {
        self.stores.iter().find(|s| s.id == id).unwrap()
    }
    pub fn current_store_name(&self) -> &'static str {
        self.cur_store.map(|i| stores::info(i).name).unwrap_or("")
    }
}
