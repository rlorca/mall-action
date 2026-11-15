//! Top-level game state machine: splash -> title -> mall <-> store -> level clear -> next loop, plus the map and
//! pause overlays, the continue screen and game over. Rules live in the scene modules; this file only routes
//! between them, owns fades / pause / screen shake and composites the HUD.
//!
//! Frozen time: while an overlay, a fade or a non-gameplay screen is open NOTHING steps, so `run.frames`, the
//! power-up timers, the mall and the store all stand still. Each live gameplay frame (mall or store, but not
//! during the arrival sequence) does `run.frames += 1; run.power.step()`.

use crate::events::{Event, Out, Sfx, Track};
use crate::input::{PadState, SELECT, START};
use crate::layout;
use crate::mall::{Mall, MallOutcome};
use crate::pixel::{pal, Fb, H, HUD_H, W};
use crate::run::RunState;
use crate::screens::continue_screen::{ContinueOutcome, ContinueScreen};
use crate::screens::game_over::GameOver;
use crate::screens::hud::{self, HudData};
use crate::screens::level_clear::LevelClear;
use crate::screens::splash::SplashScreen;
use crate::screens::title::{Title, TitleOutcome};
use crate::screens::{map, pause};
use crate::store::{self, StoreOutcome, StoreRoom};
use crate::types::{Floor, PowerUp, StoreId, StoreRole};
use crate::ui;

/// Frames of one fade half (out, then in): about 0.27 s each.
pub const FADE_FRAMES: u32 = 16;
/// Frames the screen shakes after a heavy hit.
pub const SHAKE_FRAMES: u32 = 8;

#[derive(Clone, Copy, Debug, Default)]
pub struct GameOptions {
    /// Skip the studio splash (debug).
    pub skip_splash: bool,
}

/// Where the player was when the lives ran out.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Where {
    Mall,
    Store(StoreId),
}

enum Scene {
    Splash(SplashScreen),
    Title(Title),
    Mall,
    Store(StoreId),
    LevelClear(Box<LevelClear>),
    Continue(Box<ContinueScreen>, Where),
    GameOver(Box<GameOver>),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Overlay {
    None,
    Map,
    Pause,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FadeAction {
    EnterStore(StoreId),
    ExitStore(StoreId),
    /// Fade in only (a fresh level).
    Nothing,
}

#[derive(Clone, Copy, Debug)]
struct Fade {
    t: u32,
    going_out: bool,
    action: FadeAction,
}

/// Test hooks: let state-machine tests drive the Game without depending on what the scene modules do.
#[derive(Default)]
pub(crate) struct Inject {
    /// Ignore the real results of every scene (they count as "nothing happened") unless injected below.
    pub hold: bool,
    pub mall: Option<MallOutcome>,
    pub store: Option<StoreOutcome>,
    pub cont: Option<ContinueOutcome>,
    pub level_clear_done: Option<bool>,
    pub game_over_done: Option<bool>,
    pub title: Option<TitleOutcome>,
    pub splash_done: Option<bool>,
    pub arrival: Option<bool>,
}

fn pick<T: Copy>(real: T, none: T, hold: bool, inj: &mut Option<T>) -> T {
    inj.take().unwrap_or(if hold { none } else { real })
}

pub struct Game {
    seed: u64,
    games_started: u32,
    tick: u32,
    /// Session high score (survives games).
    high: u32,
    scene: Scene,
    run: RunState,
    mall: Option<Mall>,
    store: Option<StoreRoom>,
    overlay: Overlay,
    fade: Option<Fade>,
    /// Last drawn gameplay frame, the backdrop of the game-over shutters.
    backdrop: Option<Box<Fb>>,
    shake: u32,
    /// The mall's elevator muzak is on.
    elev: bool,
    events: Vec<Event>,
    inject: Inject,
}

impl Game {
    pub fn new(seed: u64, opts: GameOptions) -> Game {
        let scene = if opts.skip_splash { Scene::Title(Title::new(0)) } else { Scene::Splash(SplashScreen::new()) };
        Game {
            seed,
            games_started: 0,
            tick: 0,
            high: 0,
            scene,
            run: RunState::new(seed, false),
            mall: None,
            store: None,
            overlay: Overlay::None,
            fade: None,
            backdrop: None,
            shake: 0,
            elev: false,
            events: Vec::new(),
            inject: Inject::default(),
        }
    }

    pub fn scene_name(&self) -> &'static str {
        match self.scene {
            Scene::Splash(_) => "splash",
            Scene::Title(_) => "title",
            Scene::Mall => "mall",
            Scene::Store(_) => "store",
            Scene::LevelClear(_) => "level_clear",
            Scene::Continue(..) => "continue",
            Scene::GameOver(_) => "game_over",
        }
    }

    pub fn overlay_name(&self) -> &'static str {
        match self.overlay {
            Overlay::None => "none",
            Overlay::Map => "map",
            Overlay::Pause => "pause",
        }
    }

    pub fn high_score(&self) -> u32 {
        self.high.max(self.run.high_score)
    }

    /// Read-only view for the shell and tests.
    pub fn run(&self) -> &RunState {
        &self.run
    }

    fn in_arrival(&self) -> bool {
        self.inject.arrival.unwrap_or_else(|| self.mall.as_ref().is_some_and(|m| m.in_arrival()))
    }

    // ---------------------------------------------------------------------------------------------------
    // Stepping
    // ---------------------------------------------------------------------------------------------------

    /// Advance exactly one 60 Hz simulation frame.
    pub fn step(&mut self, pad: PadState) {
        self.tick = self.tick.wrapping_add(1);
        let mut out = Out::new();
        self.step_scene(pad, &mut out);
        self.high = self.high.max(self.run.high_score);
        for e in &out.events {
            if let Event::Sfx(Sfx::Crush | Sfx::LampFall | Sfx::Death | Sfx::Thud) = e {
                self.shake = SHAKE_FRAMES;
            }
        }
        self.events.extend(out.take());
    }

    fn step_scene(&mut self, pad: PadState, out: &mut Out) {
        let hold = self.inject.hold;
        match &mut self.scene {
            Scene::Splash(s) => {
                let done = pick(s.step(pad, out), false, hold, &mut self.inject.splash_done);
                if done {
                    self.scene = Scene::Title(Title::new(self.high));
                }
            }
            Scene::Title(t) => {
                let o = pick(t.step(pad, out), TitleOutcome::None, hold, &mut self.inject.title);
                if let TitleOutcome::Start { black_friday } = o {
                    self.new_game(black_friday, out);
                }
            }
            Scene::LevelClear(l) => {
                if pick(l.step(pad, out), false, hold, &mut self.inject.level_clear_done) {
                    self.next_loop(out);
                }
            }
            Scene::Continue(c, w) => {
                let w = *w;
                match pick(c.step(pad, out), ContinueOutcome::None, hold, &mut self.inject.cont) {
                    ContinueOutcome::None => {}
                    ContinueOutcome::Continue => self.do_continue(w, out),
                    ContinueOutcome::Expired => self.game_over(),
                }
            }
            Scene::GameOver(g) => {
                if pick(g.step(pad, out), false, hold, &mut self.inject.game_over_done) {
                    self.back_to_title();
                }
            }
            Scene::Mall | Scene::Store(_) => self.step_play(pad, out),
        }
    }

    fn step_play(&mut self, pad: PadState, out: &mut Out) {
        // fades: nothing else moves
        if let Some(mut f) = self.fade {
            f.t += 1;
            if f.t >= FADE_FRAMES {
                if f.going_out {
                    self.run_fade_action(f.action, out);
                    f.going_out = false;
                    f.t = 0;
                    self.fade = Some(f);
                } else {
                    self.fade = None;
                }
            } else {
                self.fade = Some(f);
            }
            return;
        }
        // overlays: nothing else moves
        match self.overlay {
            Overlay::Map => {
                if pad.just_pressed(SELECT) || pad.just_pressed(START) {
                    self.overlay = Overlay::None;
                    out.sfx(Sfx::MenuBlip);
                }
                return;
            }
            Overlay::Pause => {
                if pad.just_pressed(START) {
                    self.overlay = Overlay::None;
                    out.sfx(Sfx::Pause);
                    out.events.push(Event::MusicVolume(1.0));
                }
                return;
            }
            Overlay::None => {}
        }
        let arrival = self.in_arrival();
        if !arrival {
            if pad.just_pressed(SELECT) {
                self.overlay = Overlay::Map;
                out.sfx(Sfx::MenuBlip);
                return;
            }
            if pad.just_pressed(START) {
                self.overlay = Overlay::Pause;
                out.sfx(Sfx::Pause);
                out.events.push(Event::MusicVolume(0.35));
                return;
            }
            self.run.frames = self.run.frames.saturating_add(1);
            self.run.power.step();
        }
        if self.shake > 0 {
            self.shake -= 1;
        }
        let hold = self.inject.hold;
        match self.scene {
            Scene::Mall => {
                let real = self.mall.as_mut().map_or(MallOutcome::None, |m| m.step(pad, &mut self.run, out));
                let o = pick(real, MallOutcome::None, hold, &mut self.inject.mall);
                self.mall_elevator_music(out);
                match o {
                    MallOutcome::None => {}
                    MallOutcome::EnterStore(id) => self.start_fade(FadeAction::EnterStore(id)),
                    MallOutcome::LevelClear => self.level_clear(out),
                    MallOutcome::OutOfLives => self.fall(Where::Mall, out),
                }
            }
            Scene::Store(id) => {
                let real = self.store.as_mut().map_or(StoreOutcome::None, |s| s.step(pad, &mut self.run, out));
                match pick(real, StoreOutcome::None, hold, &mut self.inject.store) {
                    StoreOutcome::None => {}
                    StoreOutcome::Exit => self.start_fade(FadeAction::ExitStore(id)),
                    StoreOutcome::OutOfLives => self.fall(Where::Store(id), out),
                }
            }
            _ => {}
        }
    }

    fn mall_track(&self) -> Track {
        if self.run.alarm {
            Track::Alarm
        } else {
            Track::MallAmbient
        }
    }

    /// The mall plays its own tracks; the Game adds the elevator muzak while a car carries the player.
    fn mall_elevator_music(&mut self, out: &mut Out) {
        let riding = self.mall.as_ref().is_some_and(|m| m.riding_elevator());
        if riding != self.elev {
            self.elev = riding;
            if riding {
                out.music(Track::Elevator);
                out.events.push(Event::Hum(true));
            } else {
                out.music(self.mall_track());
                out.events.push(Event::Hum(false));
            }
        }
    }

    fn start_fade(&mut self, action: FadeAction) {
        self.fade = Some(Fade { t: 0, going_out: true, action });
    }

    fn run_fade_action(&mut self, action: FadeAction, out: &mut Out) {
        match action {
            FadeAction::EnterStore(id) => self.enter_store(id, out),
            FadeAction::ExitStore(id) => self.leave_store(id, out),
            FadeAction::Nothing => {}
        }
    }

    fn enter_store(&mut self, id: StoreId, out: &mut Out) {
        self.store = Some(StoreRoom::new(id, &mut self.run, out));
        self.scene = Scene::Store(id);
    }

    fn leave_store(&mut self, id: StoreId, out: &mut Out) {
        self.store = None;
        if let Some(m) = self.mall.as_mut() {
            m.return_from_store(id);
        }
        self.scene = Scene::Mall;
        self.elev = false;
        out.music(self.mall_track());
    }

    fn level_clear(&mut self, out: &mut Out) {
        let (t, c) = self.run.award_level_clear(out);
        self.scene = Scene::LevelClear(Box::new(LevelClear::new(self.run.packages_found(), t, c, self.run.loop_no, self.run.seed)));
        self.store = None;
        self.overlay = Overlay::None;
        self.fade = None;
        out.events.push(Event::MusicVolume(1.0));
    }

    fn next_loop(&mut self, out: &mut Out) {
        self.run.start_next_loop();
        store::setup_level(&mut self.run);
        self.mall = Some(Mall::new(&mut self.run, out));
        self.store = None;
        self.elev = false;
        self.scene = Scene::Mall;
        self.fade = Some(Fade { t: 0, going_out: false, action: FadeAction::Nothing });
    }

    fn new_game(&mut self, black_friday: bool, out: &mut Out) {
        let seed = self.seed.wrapping_add((self.games_started as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15));
        self.games_started += 1;
        self.run = RunState::new(seed, black_friday);
        self.run.high_score = self.high;
        store::setup_level(&mut self.run);
        self.mall = Some(Mall::new(&mut self.run, out));
        self.store = None;
        self.overlay = Overlay::None;
        self.fade = None;
        self.shake = 0;
        self.elev = false;
        self.backdrop = None;
        self.scene = Scene::Mall;
        out.events.push(Event::MusicVolume(1.0));
    }

    fn back_to_title(&mut self) {
        self.mall = None;
        self.store = None;
        self.overlay = Overlay::None;
        self.fade = None;
        self.backdrop = None;
        self.elev = false;
        self.scene = Scene::Title(Title::new(self.high_score()));
    }

    /// The player is out of lives: continue screen if a continue is left, otherwise game over.
    fn fall(&mut self, w: Where, out: &mut Out) {
        self.capture_backdrop();
        out.events.push(Event::MusicVolume(1.0));
        if self.run.can_continue() {
            self.scene = Scene::Continue(Box::new(ContinueScreen::new(self.run.continues_left)), w);
        } else {
            self.game_over();
        }
    }

    fn game_over(&mut self) {
        self.scene = Scene::GameOver(Box::new(GameOver::new(self.run.score, self.high_score())));
    }

    fn capture_backdrop(&mut self) {
        let mut fb = Fb::new();
        self.draw_gameplay(&mut fb);
        self.backdrop = Some(Box::new(fb));
    }

    fn do_continue(&mut self, w: Where, out: &mut Out) {
        self.run.use_continue();
        self.elev = false;
        match w {
            Where::Mall => {
                if let Some(m) = self.mall.as_mut() {
                    m.revive_after_continue(&mut self.run);
                }
                self.scene = Scene::Mall;
                out.music(self.mall_track());
            }
            Where::Store(id) => self.enter_store(id, out),
        }
        self.fade = Some(Fade { t: 0, going_out: false, action: FadeAction::Nothing });
    }

    // ---------------------------------------------------------------------------------------------------
    // Drawing
    // ---------------------------------------------------------------------------------------------------

    pub fn draw(&self, fb: &mut Fb) {
        match &self.scene {
            Scene::Splash(s) => s.draw(fb),
            Scene::Title(t) => t.draw(fb),
            Scene::LevelClear(l) => l.draw(fb),
            Scene::Continue(c, _) => c.draw(fb),
            Scene::GameOver(g) => g.draw(fb, self.backdrop.as_deref()),
            Scene::Mall | Scene::Store(_) => {
                match self.overlay {
                    Overlay::Map => {
                        let info = self.mall.as_ref().map(|m| m.map_info()).unwrap_or(crate::mall::MapInfo { player_floor: Floor::Roof, player_x: 0, car_floor_pos: [0.0; 3] });
                        let in_store = if let Scene::Store(id) = self.scene { Some(id) } else { None };
                        map::draw(fb, &self.run, &info, in_store, self.tick);
                    }
                    Overlay::Pause => {
                        self.draw_gameplay(fb);
                        pause::draw_over(fb, self.tick);
                    }
                    Overlay::None => self.draw_gameplay(fb),
                }
                if let Some(f) = self.fade {
                    let level = if f.going_out { ui::fade_level(f.t, FADE_FRAMES) } else { 4 - ui::fade_level(f.t, FADE_FRAMES) };
                    ui::fade_black(fb, level);
                }
            }
        }
    }

    /// Scene + screen shake + HUD (no overlays, no fades).
    fn draw_gameplay(&self, fb: &mut Fb) {
        if self.shake > 0 {
            let mut tmp = Fb::new();
            self.draw_scene(&mut tmp);
            const OFFS: [(i32, i32); 4] = [(2, 1), (-2, 0), (1, -2), (-1, 2)];
            let (dx, dy) = OFFS[(self.tick as usize) % 4];
            let k = if self.shake < 4 { 1 } else { 2 };
            let (dx, dy) = (dx * k / 2, dy * k / 2);
            fb.clear(pal::BLACK);
            for y in HUD_H..H as i32 {
                for x in 0..W as i32 {
                    let (sx, sy) = (x - dx, y - dy);
                    if sx >= 0 && sx < W as i32 && sy >= HUD_H && sy < H as i32 {
                        fb.px[y as usize * W + x as usize] = tmp.px[sy as usize * W + sx as usize];
                    }
                }
            }
        } else {
            self.draw_scene(fb);
        }
        self.draw_hud(fb);
    }

    fn draw_scene(&self, fb: &mut Fb) {
        match self.scene {
            Scene::Mall => {
                if let Some(m) = &self.mall {
                    m.draw(fb, &self.run, self.tick);
                }
            }
            Scene::Store(_) => {
                if let Some(s) = &self.store {
                    s.draw(fb, &self.run, self.tick);
                }
            }
            _ => {}
        }
    }

    fn draw_hud(&self, fb: &mut Fb) {
        let floor = self.mall.as_ref().map_or(Floor::Roof, |m| m.hud_floor());
        let marquee = if let Scene::Store(id) = self.scene { Some(id.info().name) } else { None };
        hud::draw(fb, &HudData::from_run(&self.run, floor, marquee, self.tick));
    }

    /// Events (sfx / music) produced since the last call.
    pub fn drain_events(&mut self) -> Vec<Event> {
        std::mem::take(&mut self.events)
    }

    // ---------------------------------------------------------------------------------------------------
    // Debug / playtest
    // ---------------------------------------------------------------------------------------------------

    /// One-line JSON-ish snapshot for automated playtests (deterministic).
    pub fn debug_state(&self) -> String {
        let esc = |s: String| s.replace('\\', "\\\\").replace('"', "'");
        let floor = self.mall.as_ref().map_or("-", |m| m.hud_floor().label());
        let (mall, store) = (
            esc(self.mall.as_ref().map(|m| m.debug_state()).unwrap_or_default()),
            esc(self.store.as_ref().map(|s| s.debug_state()).unwrap_or_default()),
        );
        let fade = self.fade.map_or(-1, |f| if f.going_out { f.t as i32 } else { 100 + f.t as i32 });
        format!(
            "{{\"scene\":\"{}\",\"overlay\":\"{}\",\"floor\":\"{}\",\"score\":{},\"high\":{},\"lives\":{},\"packages\":{},\"loop\":{},\"continues\":{},\"frames\":{},\"alarm\":{},\"fade\":{},\"tick\":{},\"mall\":\"{}\",\"store\":\"{}\"}}",
            self.scene_name(),
            self.overlay_name(),
            floor,
            self.run.score,
            self.high_score(),
            self.run.lives,
            self.run.packages_found(),
            self.run.loop_no,
            self.run.continues_left,
            self.run.frames,
            self.run.alarm,
            fade,
            self.tick,
            mall,
            store
        )
    }

    /// Automated-playtest commands (see the doc list in the task): packages, package N, kill, lives N, loop N,
    /// warp F X, store N, clear, alarm, power NAME, score N, time N, title. Returns "ok ..." or "error: ...".
    pub fn debug_cmd(&mut self, cmd: &str) -> String {
        let mut out = Out::new();
        let r = self.debug_cmd_inner(cmd, &mut out);
        self.events.extend(out.take());
        match r {
            Ok(s) => format!("ok {s}"),
            Err(e) => format!("error: {e}"),
        }
    }

    fn debug_cmd_inner(&mut self, cmd: &str, out: &mut Out) -> Result<String, String> {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        let num = |i: usize| -> Result<i64, String> {
            parts.get(i).ok_or_else(|| format!("{} needs a number", parts[0]))?.parse::<i64>().map_err(|e| e.to_string())
        };
        let Some(&name) = parts.first() else { return Err("empty command".into()) };
        let targets: Vec<StoreId> = StoreId::ALL.iter().copied().filter(|s| s.role() == StoreRole::Target).collect();
        match name {
            "packages" => {
                for id in &targets {
                    self.run.take_package(*id, out);
                }
                Ok(format!("packages {}", self.run.packages_found()))
            }
            "package" => {
                let n = num(1)?;
                let id = *targets.get(n as usize).ok_or("package index 0-5")?;
                self.run.take_package(id, out);
                Ok(format!("package {} ({})", n, id.info().name))
            }
            "kill" => {
                if let Some(s) = self.store.as_mut().filter(|_| matches!(self.scene, Scene::Store(_))) {
                    s.debug_kill();
                } else if let Some(m) = self.mall.as_mut() {
                    m.debug_kill();
                } else {
                    return Err("not in a level".into());
                }
                Ok("kill".into())
            }
            "lives" => {
                self.run.lives = num(1)?.clamp(0, 99) as u32;
                Ok(format!("lives {}", self.run.lives))
            }
            "loop" => {
                self.run.loop_no = num(1)?.clamp(1, 999) as u32;
                Ok(format!("loop {}", self.run.loop_no))
            }
            "warp" => {
                let f = Floor::from_index(num(1)?.max(0) as usize).ok_or("floor 0-5")?;
                let x = num(2)? as i32;
                if self.mall.is_none() {
                    return Err("not in a level".into());
                }
                if matches!(self.scene, Scene::Store(_)) {
                    self.store = None;
                    self.scene = Scene::Mall;
                }
                self.mall.as_mut().unwrap().debug_teleport(f, x.clamp(layout::WALL_L, layout::WALL_R));
                Ok(format!("warp {} {}", f.label(), x))
            }
            "store" => {
                let id = *StoreId::ALL.get(num(1)?.max(0) as usize).ok_or("store index 0-12")?;
                if !id.is_open() {
                    return Err(format!("{} is closed", id.info().name));
                }
                if self.mall.is_none() {
                    return Err("not in a level".into());
                }
                self.overlay = Overlay::None;
                self.fade = None;
                self.enter_store(id, out);
                Ok(format!("store {}", id.info().name))
            }
            "clear" => {
                if self.mall.is_none() {
                    return Err("not in a level".into());
                }
                self.level_clear(out);
                Ok("clear".into())
            }
            "alarm" => {
                self.run.alarm = true;
                out.music(Track::Alarm);
                Ok("alarm".into())
            }
            "power" => {
                let want = norm(&parts[1..].join(""));
                let p = PowerUp::ALL
                    .iter()
                    .copied()
                    .find(|p| norm(p.name()) == want || norm(&format!("{p:?}")) == want)
                    .ok_or_else(|| format!("unknown power-up '{}'", parts[1..].join(" ")))?;
                if self.run.power.grant(p) == crate::powerup::Granted::ExtraLife {
                    self.run.extra_life(out);
                }
                Ok(format!("power {}", p.name()))
            }
            "score" => {
                let n = num(1)?.clamp(0, 99_999_999) as u32;
                self.run.score = n;
                if n > self.run.high_score {
                    self.run.high_score = n;
                }
                Ok(format!("score {n}"))
            }
            "time" => {
                self.run.frames = num(1)?.clamp(0, u32::MAX as i64) as u32;
                Ok(format!("time {}", self.run.frames))
            }
            "title" => {
                self.back_to_title();
                Ok("title".into())
            }
            other => Err(format!("unknown command '{other}'")),
        }
    }
}

fn norm(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric()).map(|c| c.to_ascii_uppercase()).collect()
}

#[cfg(test)]
mod tests;
