//! Spies (spec 5.5): they step out of open stores' doors and out of elevator cars, walk toward the agent,
//! stop ~40 px away, TELEGRAPH a shot with a clear aiming pose (~0.5 s) and then fire. They wander, wait in
//! shaft openings (so a falling car can crush them), slide on wet floors and die in many entertaining ways.
//!
//! Hook contract (see `mod.rs`): `step(&mut Ctx)` after the player and the cars moved, `draw` under the agent,
//! `draw_top` for the speech bubbles, `clear` on every respawn.
//!
//! Fairness rules, all measured in frames at 60 Hz:
//! * the first spy appears ~300 frames into the level, never more than `difficulty().spy_cap` at once;
//! * a spy never shoots within 120 frames of appearing and never twice within `difficulty().shot_interval()`
//!   (>= 60 frames); every shot is preceded by `AIM_FRAMES` (30) of an unmistakable aiming pose with a "!";
//! * HIGH shots fly at head height (a ducking agent is missed), LOW shots at knee height (a jumping agent is
//!   missed); a standing agent is hit by both. Player shots at chest height miss a ducking spy; ducking
//!   (low) shots hit him. A spy ducks an incoming volley with 10% chance, decided once per volley.

use crate::art;
use crate::art::storefront::door_rect;
use crate::copy;
use crate::events::Sfx;
use crate::layout::{door_x, floor_y, store_x, SHAFTS, SHAFT_W, WALL_L, WALL_R};
use crate::pixel::{Fb, Rect};
use crate::run::{Difficulty, RunState, PTS_SPY_SHOT, PTS_SPY_SPECIAL};
use crate::types::{Floor, PowerUp, StoreId, StoreRole};

use super::bubble::{self, Bubble};
use super::bullets::Owner;
use super::camera::Camera;
use super::state::{Ctx, DeathCause, Drop, DropKind, EffectKind, PlayerView};
use super::world::Opening;

/// Level frames before the first spy walks out (5 s).
pub const FIRST_SPY_FRAMES: u32 = 300;
/// Door-opening animation length (the spy is untouchable for the first `APPEAR_SAFE` frames).
pub const APPEAR_FRAMES: u32 = 30;
pub const APPEAR_SAFE: u32 = 12;
/// A spy stepping out of a car (shorter: the doors are already open).
pub const EMERGE_FRAMES: u32 = 14;
pub const SPAWN_MIN_DIST: i32 = 64;
pub const SPAWN_MAX_DIST: i32 = 200;
/// A spy notices the agent within this many px on the same floor.
pub const SIGHT: i32 = 160;
/// ...and stops this far from him.
pub const STOP_DIST: i32 = 40;
/// Longest shot range.
pub const SHOOT_RANGE: i32 = 150;
/// The aiming pose is held this long before the shot (0.5 s).
pub const AIM_FRAMES: u32 = 30;
/// No shot sooner than this after appearing (2 s).
pub const FIRST_SHOT_DELAY: u32 = 120;
pub const DODGE_CHANCE: f32 = 0.10;
pub const DUCK_FRAMES: u32 = 24;
/// Death animation (0.4 s).
pub const DIE_FRAMES: u32 = 24;
/// Walking speed in 1/1000 px per frame at difficulty 1 (the agent walks 1000).
pub const SPY_SPEED_MILLI: f32 = 700.0;
pub const DROP_CHANCE: f32 = 0.05;
pub const LAST_WORDS_CHANCE: f32 = 0.35;
/// Height of the high / low bullet above the spy's feet (a standing agent's chest is 15, ducking 6).
pub const HIGH_SHOT_DY: i32 = 17;
pub const LOW_SHOT_DY: i32 = 5;
/// Spies that wander this far from the agent (or two floors away) quietly leave the mall.
const CULL_FLOORS: i32 = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpyState {
    /// Stepping out of a store door / car.
    Appear { t: u32 },
    Walk,
    /// Standing in a shaft opening.
    Wait { t: u32 },
    /// Telegraphing a shot.
    Aim { t: u32, low: bool },
    /// Ducking an incoming volley.
    Duck { t: u32 },
    /// Skidding on a wet patch.
    Slide,
    Dying { t: u32 },
}

#[derive(Clone, Debug)]
pub struct Spy {
    pub id: u32,
    pub x: i32,
    pub floor: Floor,
    pub dir: i32,
    pub state: SpyState,
    pub age: u32,
    /// Frames until the next aim starts.
    pub shot_cd: u32,
    pub shots: u32,
    /// The store whose door is open for him.
    pub door: Option<StoreId>,
    /// The car (index into `SHAFTS`) he is stepping out of.
    pub car: Option<usize>,
    /// Flattened (crushed) rather than shot.
    pub flat: bool,
    pub moved: bool,
    /// Frames since he last took a step (drives the walk animation).
    pub idle: u32,
    xacc: i32,
    pub goal: i32,
    pub pause: u32,
    /// Volley groups already decided: (group, ducks).
    dodge_seen: Vec<(u32, bool)>,
    gone: bool,
}

impl Spy {
    pub fn alive(&self) -> bool {
        !matches!(self.state, SpyState::Dying { .. })
    }

    pub fn ducking(&self) -> bool {
        matches!(self.state, SpyState::Duck { .. })
    }

    pub fn feet(&self) -> i32 {
        floor_y(self.floor)
    }

    /// Hit rectangle: tall when standing, half height while ducking.
    pub fn body(&self) -> Rect {
        let h = if self.ducking() { 12 } else { 22 };
        Rect::new(self.x - 4, self.feet() - h, 8, h)
    }

    fn touchable(&self) -> bool {
        match self.state {
            SpyState::Appear { t } => t >= if self.car.is_some() { 4 } else { APPEAR_SAFE },
            SpyState::Dying { .. } => false,
            _ => true,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum How {
    Shot,
    Kick,
    Crush,
    Lamp,
    Bomb,
    Fall,
}

#[derive(Clone, Debug)]
pub struct Spies {
    pub spies: Vec<Spy>,
    pub bubbles: Vec<Bubble>,
    /// Frames until the next spawn attempt.
    pub spawn_cd: u32,
    /// False: nobody spawns (tests, debug).
    pub enabled: bool,
    next_id: u32,
    prev_dir: [i8; 3],
    /// Spies currently holding each car open.
    held: [u32; 3],
    /// Total spies that have appeared (for tests / pacing).
    pub spawned: u32,
}

impl Default for Spies {
    fn default() -> Self {
        Spies::new()
    }
}

fn fidx(f: Floor) -> i32 {
    f.index() as i32
}

/// The shaft column (index, opening state) that world x falls in on `floor`, with `margin` px of slack.
fn column(ctx_core: &super::state::Core, floor: Floor, x: i32, margin: i32) -> Option<(usize, Opening)> {
    for (i, s) in SHAFTS.iter().enumerate() {
        if s.serves(floor) && x >= s.x - margin && x < s.x + SHAFT_W + margin {
            if let Some(o) = ctx_core.opening(s.id, floor) {
                return Some((i, o));
            }
        }
    }
    None
}

fn in_column(i: usize, x: i32) -> bool {
    x >= SHAFTS[i].x && x < SHAFTS[i].x + SHAFT_W
}

impl Spies {
    pub fn new() -> Spies {
        Spies { spies: Vec::new(), bubbles: Vec::new(), spawn_cd: FIRST_SPY_FRAMES, enabled: true, next_id: 1, prev_dir: [0; 3], held: [0; 3], spawned: 0 }
    }

    pub fn clear(&mut self) {
        self.spies.clear();
        self.bubbles.clear();
        self.spawn_cd = FIRST_SPY_FRAMES / 2;
        self.prev_dir = [0; 3];
        // (the cars are released by the next step's occupant sync once the spies are gone)
    }

    pub fn alive_count(&self) -> usize {
        self.spies.iter().filter(|s| s.alive()).count()
    }

    /// The agent as the spies see him: the floor he stands on, or None while hidden / riding / dying / arriving.
    pub fn visible_floor(pv: &PlayerView) -> Option<Floor> {
        if !pv.hittable() || pv.frozen || pv.riding.is_some() || pv.on_escalator || pv.on_roof || pv.in_arrival {
            return None;
        }
        if (pv.y - floor_y(pv.floor)).abs() > 30 {
            return None;
        }
        Some(pv.floor)
    }

    /// Place a spy directly (tests, debug): walking, with its first-shot delay running.
    pub fn add_walking(&mut self, floor: Floor, x: i32, dir: i32) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.spawned += 1;
        self.spies.push(Spy {
            id,
            x,
            floor,
            dir,
            state: SpyState::Walk,
            age: 0,
            shot_cd: FIRST_SHOT_DELAY - 30,
            shots: 0,
            door: None,
            car: None,
            flat: false,
            moved: false,
            idle: 99,
            xacc: 0,
            goal: x,
            pause: 0,
            dodge_seen: Vec::new(),
            gone: false,
        });
        id
    }

    pub fn spawn_interval(ctx: &mut Ctx) -> u32 {
        let d = ctx.run.difficulty();
        let mut f = 1.0 / d.spawn_rate.max(0.2);
        if ctx.run.alarm {
            f *= 0.6;
        }
        let base = 300 + ctx.run.rng.below(180);
        ((base as f32 * f) as u32).max(90)
    }

    fn can_spawn_more(&self, run: &RunState) -> bool {
        self.alive_count() < run.difficulty().spy_cap
    }

    /// Candidate doors: open stores (untaken targets and power-up shops) on the agent's floor or one away,
    /// 64..200 px from him.
    pub fn spawn_candidates(run: &RunState, pv: &PlayerView) -> Vec<StoreId> {
        StoreId::ALL
            .iter()
            .copied()
            .filter(|id| match id.role() {
                StoreRole::Target => !run.store_cleared(*id),
                StoreRole::PowerShop => true,
                StoreRole::Closed => false,
            })
            .filter(|id| (fidx(id.info().floor) - fidx(pv.floor)).abs() <= 1)
            .filter(|id| {
                let d = (door_x(*id) - pv.x).abs();
                (SPAWN_MIN_DIST..=SPAWN_MAX_DIST).contains(&d)
            })
            .collect()
    }

    fn try_spawn(&mut self, ctx: &mut Ctx, pv: &PlayerView) {
        if !self.can_spawn_more(ctx.run) {
            self.spawn_cd = 30;
            return;
        }
        let cands = Spies::spawn_candidates(ctx.run, pv);
        // not on top of another spy at the same door
        let cands: Vec<StoreId> = cands
            .into_iter()
            .filter(|id| !self.spies.iter().any(|s| s.alive() && s.door == Some(*id)))
            .collect();
        if cands.is_empty() {
            self.spawn_cd = 30;
            return;
        }
        let id = *ctx.run.rng.pick(&cands);
        let floor = id.info().floor;
        let x = door_x(id);
        let dir = if pv.x >= x { 1 } else { -1 };
        let sid = self.add_walking(floor, x, dir);
        let sp = self.spies.iter_mut().find(|s| s.id == sid).unwrap();
        sp.state = SpyState::Appear { t: 0 };
        sp.door = Some(id);
        sp.shot_cd = FIRST_SHOT_DELAY - AIM_FRAMES + ctx.run.rng.below(30);
        self.spawn_cd = Spies::spawn_interval(ctx);
    }

    /// A car that just stopped near the agent sometimes lets a spy out (he says one of the elevator lines).
    fn detect_car_stops(&mut self, ctx: &mut Ctx, pv: &PlayerView) {
        for i in 0..3 {
            let cv = ctx.core.car_view(SHAFTS[i].id);
            if !self.enabled {
                self.prev_dir[i] = cv.dir;
                continue;
            }
            let stopped = self.prev_dir[i] != 0 && cv.dir == 0;
            self.prev_dir[i] = cv.dir;
            if !stopped || cv.occupied || pv.riding.is_some() {
                continue;
            }
            let Some(level) = cv.level else { continue };
            if (fidx(level) - fidx(pv.floor)).abs() > 1 {
                continue;
            }
            let d = (SHAFTS[i].center_x() - pv.x).abs();
            if !(SPAWN_MIN_DIST..=SPAWN_MAX_DIST + 40).contains(&d) || !self.can_spawn_more(ctx.run) {
                continue;
            }
            if !ctx.run.rng.chance(0.3) {
                continue;
            }
            let x = SHAFTS[i].center_x();
            let dir = if pv.x >= x { 1 } else { -1 };
            let sid = self.add_walking(level, x, dir);
            let line = *ctx.run.rng.pick(&copy::ELEVATOR_LINES);
            let cd = FIRST_SHOT_DELAY - AIM_FRAMES + ctx.run.rng.below(30);
            let sp = self.spies.iter_mut().find(|s| s.id == sid).unwrap();
            sp.state = SpyState::Appear { t: 0 };
            sp.car = Some(i);
            sp.shot_cd = cd;
            let mut b = Bubble::new(x, floor_y(level) - 26, line, 110);
            b.follow = Some(sid);
            self.bubbles.push(b);
        }
    }

    pub fn step(&mut self, ctx: &mut Ctx) {
        bubble::step_all(&mut self.bubbles);
        let pv = ctx.core.player_view();
        self.detect_car_stops(ctx, &pv);
        if self.enabled && ctx.core.arrival.is_none() && !pv.dying && pv.riding.is_none() {
            self.spawn_cd = self.spawn_cd.saturating_sub(1);
            if self.spawn_cd == 0 {
                self.try_spawn(ctx, &pv);
            }
        }
        let diff = ctx.run.difficulty();
        {
            let Spies { spies, bubbles, .. } = self;
            for sp in spies.iter_mut() {
                step_spy(sp, ctx, &pv, &diff, bubbles);
            }
        }
        // spies far away or on distant floors quietly leave
        for sp in self.spies.iter_mut() {
            if sp.alive() && sp.age > 600 && ((fidx(sp.floor) - fidx(pv.floor)).abs() >= CULL_FLOORS || ((sp.x - pv.x).abs() > 380 && sp.age > 1200)) {
                sp.gone = true;
            }
        }
        self.spies.retain(|s| !s.gone);
        // bubbles follow their speaker
        for b in self.bubbles.iter_mut() {
            if let Some(id) = b.follow {
                if let Some(sp) = self.spies.iter().find(|s| s.id == id) {
                    b.x = sp.x;
                    b.y = sp.feet() - 26;
                } else {
                    b.follow = None;
                }
            }
        }
        // cars with a spy stepping out must not leave
        for i in 0..3 {
            let n = self.spies.iter().filter(|s| s.car == Some(i)).count() as u32;
            if n != self.held[i] {
                let cur = ctx.core.cars[i].extra_occupants;
                ctx.core.set_car_occupants(SHAFTS[i].id, (cur + n).saturating_sub(self.held[i]));
                self.held[i] = n;
            }
        }
    }

    // ------------------------------------------------------------------------------------------ drawing

    pub fn draw(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, tick: u32) {
        for sp in &self.spies {
            draw_spy(sp, fb, cam, tick);
        }
    }

    /// Speech bubbles, painted above everything else.
    pub fn draw_top(&self, fb: &mut Fb, cam: &Camera, _run: &RunState, _tick: u32) {
        bubble::draw_all(&self.bubbles, fb, cam);
    }
}

// ---------------------------------------------------------------------------------------------- one spy

fn kill(sp: &mut Spy, ctx: &mut Ctx, bubbles: &mut Vec<Bubble>, pts: i32, how: How) {
    if !sp.alive() {
        return;
    }
    sp.state = SpyState::Dying { t: 0 };
    sp.door = None;
    sp.car = None;
    sp.flat = how == How::Crush;
    if pts != 0 {
        ctx.run.add_score(pts, ctx.out);
    }
    let (x, fy) = (sp.x, sp.feet());
    match how {
        How::Shot => ctx.out.sfx(Sfx::Splat),
        How::Kick => ctx.out.sfx(Sfx::Kick),
        How::Crush => {
            ctx.out.sfx(Sfx::Crush);
            ctx.core.request_shake(18);
        }
        How::Lamp => ctx.out.sfx(Sfx::Splat),
        How::Bomb => {
            ctx.out.sfx(Sfx::Smoke);
            ctx.core.add_effect(EffectKind::Puff, x, fy - 12);
        }
        How::Fall => {}
    }
    if how == How::Fall {
        return;
    }
    if ctx.run.rng.chance(DROP_CHANCE) {
        let item = random_drop(ctx);
        ctx.core.drops.push(Drop { floor: sp.floor, x, y: fy, kind: DropKind::Power(item) });
    }
    if ctx.run.rng.chance(LAST_WORDS_CHANCE) {
        let line = *ctx.run.rng.pick(&copy::LAST_WORDS);
        bubbles.push(Bubble::new(x, fy - 26, line, 80));
    }
}

/// Half the drops are food (Cinnabomb / Juice / Pretzel), the rest the other power-ups.
pub fn random_drop(ctx: &mut Ctx) -> PowerUp {
    if ctx.run.rng.chance(0.5) {
        *ctx.run.rng.pick(&[PowerUp::Cinnabomb, PowerUp::OrangeJuliOoze, PowerUp::SoftPretzel])
    } else {
        *ctx.run.rng.pick(&[PowerUp::RapidFire, PowerUp::SpreadShot, PowerUp::ArmorVest, PowerUp::Sneakers, PowerUp::Radar, PowerUp::OneUp])
    }
}

/// Can the spy step to `nx`? Not into a pit, not through a wall.
fn can_step(ctx: &Ctx, sp: &Spy, nx: i32) -> bool {
    if nx < WALL_L + 6 || nx > WALL_R - 6 {
        return false;
    }
    if let Some((i, Opening::PitBelow)) = column(ctx.core, sp.floor, nx, 3) {
        // already inside that column's slack (just left a car): allow walking away only
        let cur_in = column(ctx.core, sp.floor, sp.x, 3).map_or(false, |(j, _)| j == i);
        return cur_in && (nx - SHAFTS[i].center_x()).abs() > (sp.x - SHAFTS[i].center_x()).abs();
    }
    true
}

/// Walk at `milli`/1000 px per frame. Returns false only when something blocks him (a pit, a wall).
fn walk_px(sp: &mut Spy, ctx: &Ctx, dir: i32, milli: i32) -> bool {
    sp.xacc += milli;
    let n = sp.xacc / 1000;
    sp.xacc -= n * 1000;
    for _ in 0..n {
        if can_step(ctx, sp, sp.x + dir) {
            sp.x += dir;
            sp.moved = true;
            sp.idle = 0;
        } else {
            return false;
        }
    }
    true
}

fn step_spy(sp: &mut Spy, ctx: &mut Ctx, pv: &PlayerView, diff: &Difficulty, bubbles: &mut Vec<Bubble>) {
    sp.age += 1;
    sp.moved = false;
    sp.idle = sp.idle.saturating_add(1);
    sp.shot_cd = sp.shot_cd.saturating_sub(1);
    let fy = sp.feet();

    // ---- dying: play out, then vanish
    if let SpyState::Dying { t } = sp.state {
        if t + 1 >= DIE_FRAMES {
            sp.gone = true;
        } else {
            sp.state = SpyState::Dying { t: t + 1 };
        }
        return;
    }

    // ---- environment: a pit under his feet, a falling lamp or rolling ball, a car coming down
    if let Some((i, o)) = column(ctx.core, sp.floor, sp.x, 0) {
        if in_column(i, sp.x) {
            match o {
                Opening::PitBelow => {
                    kill(sp, ctx, bubbles, 0, How::Fall);
                    return;
                }
                Opening::GrateAbove => {
                    let cv = ctx.core.car_view(SHAFTS[i].id);
                    if cv.dir > 0 && cv.rect.intersects(&sp.body()) && sp.touchable() {
                        kill(sp, ctx, bubbles, PTS_SPY_SPECIAL, How::Crush);
                        return;
                    }
                }
                Opening::CarHere => {}
            }
        }
    }
    if sp.touchable() {
        let body = sp.body();
        let lethal = ctx.core.lethal.iter().any(|l| l.floor == sp.floor && l.rect.intersects(&body));
        if lethal {
            kill(sp, ctx, bubbles, PTS_SPY_SPECIAL, How::Lamp);
            return;
        }
        // ---- the agent's bullets
        if ctx.core.bullets.take_hit(body, Owner::Player).is_some() {
            kill(sp, ctx, bubbles, PTS_SPY_SHOT, How::Shot);
            return;
        }
        // ---- touching the agent
        let near = !pv.dying && !pv.hidden && !pv.in_arrival && pv.riding.is_none() && !pv.on_escalator && pv.floor == sp.floor;
        if near && body.intersects(&pv.hitbox) {
            if pv.kicking {
                let pts = if pv.sliding { PTS_SPY_SPECIAL } else { PTS_SPY_SHOT };
                kill(sp, ctx, bubbles, pts, How::Kick);
                return;
            }
            if ctx.run.power.is_invincible() {
                kill(sp, ctx, bubbles, PTS_SPY_SHOT, How::Bomb);
                return;
            }
            ctx.kill_player(DeathCause::Spy);
        }
    }

    // ---- incoming volleys: duck with 10% chance, decided once per volley
    if !matches!(sp.state, SpyState::Appear { .. } | SpyState::Slide) {
        let mut duck = false;
        for b in ctx.core.bullets.list.iter().filter(|b| b.owner == Owner::Player && b.floor == sp.floor) {
            let d = sp.x - b.x();
            let toward = (b.vx16 > 0 && d > 0) || (b.vx16 < 0 && d < 0);
            if toward && (4..=56).contains(&d.abs()) && !sp.dodge_seen.iter().any(|(g, _)| *g == b.group) {
                let ducks = ctx.run.rng.chance(DODGE_CHANCE);
                sp.dodge_seen.push((b.group, ducks));
                duck |= ducks;
            }
        }
        if sp.dodge_seen.len() > 8 {
            sp.dodge_seen.remove(0);
        }
        if duck {
            sp.state = SpyState::Duck { t: 0 };
            sp.shot_cd = sp.shot_cd.max(AIM_FRAMES + 10);
        }
    }

    let milli = (SPY_SPEED_MILLI * diff.spy_speed * Difficulty::alarm_speed_mul(ctx.run.alarm)) as i32;
    let seen = Spies::visible_floor(pv) == Some(sp.floor) && (pv.x - sp.x).abs() <= SIGHT;
    let to_player = if pv.x >= sp.x { 1 } else { -1 };

    // ---- the wet floor takes everyone
    if matches!(sp.state, SpyState::Walk | SpyState::Wait { .. } | SpyState::Slide) {
        let on_wet = ctx.core.wet_at(sp.floor, sp.x);
        match (sp.state, on_wet) {
            (SpyState::Slide, false) => sp.state = SpyState::Walk,
            (SpyState::Walk | SpyState::Wait { .. }, true) => sp.state = SpyState::Slide,
            _ => {}
        }
    }

    match sp.state {
        SpyState::Appear { t } => {
            let len = if sp.car.is_some() { EMERGE_FRAMES } else { APPEAR_FRAMES };
            if t + 1 >= len {
                sp.state = SpyState::Walk;
                sp.car = None;
            } else {
                sp.state = SpyState::Appear { t: t + 1 };
            }
        }
        SpyState::Duck { t } => {
            if t + 1 >= DUCK_FRAMES {
                sp.state = SpyState::Walk;
            } else {
                sp.state = SpyState::Duck { t: t + 1 };
            }
        }
        SpyState::Slide => {
            // cannot stop or turn until off the patch; he slides at walking speed
            let d = sp.dir;
            if !walk_px(sp, ctx, d, milli) {
                sp.state = SpyState::Walk;
            }
        }
        SpyState::Aim { t, low } => {
            if !seen {
                // the agent hid / left: stand down, no shot
                sp.state = SpyState::Walk;
                sp.shot_cd = sp.shot_cd.max(40);
            } else if t + 1 >= AIM_FRAMES {
                let dy = if low { LOW_SHOT_DY } else { HIGH_SHOT_DY };
                ctx.core.bullets.fire_enemy(sp.x + sp.dir * 10, fy - dy, sp.dir, sp.floor);
                ctx.out.sfx(Sfx::EnemyShot);
                sp.shots += 1;
                sp.state = SpyState::Walk;
                // next volley: the full interval counted from this shot, with +-20% jitter, never under a second
                let iv = diff.shot_interval();
                let j = ctx.run.rng.range(-(iv as i32) / 5, (iv as i32) / 5);
                let next = ((iv as i32 + j).max(crate::run::MIN_SHOT_INTERVAL as i32)) as u32;
                sp.shot_cd = next.saturating_sub(AIM_FRAMES).max(crate::run::MIN_SHOT_INTERVAL - AIM_FRAMES);
            } else {
                if t < 8 {
                    sp.dir = to_player;
                }
                sp.state = SpyState::Aim { t: t + 1, low };
            }
        }
        SpyState::Wait { t } => {
            let still_grate = column(ctx.core, sp.floor, sp.x, 0).map_or(false, |(_, o)| o == Opening::GrateAbove);
            if seen || t > 240 || !still_grate {
                sp.state = SpyState::Walk;
                sp.pause = 0;
                sp.goal = sp.x;
            } else {
                sp.state = SpyState::Wait { t: t + 1 };
            }
        }
        SpyState::Walk => walk_logic(sp, ctx, pv, milli, seen, to_player, bubbles),
        SpyState::Dying { .. } => {}
    }

    // the door closes behind him once he has stepped clear
    if let Some(id) = sp.door {
        if !matches!(sp.state, SpyState::Appear { .. }) && (sp.x - door_x(id)).abs() > 14 {
            sp.door = None;
        }
    }
}

fn walk_logic(sp: &mut Spy, ctx: &mut Ctx, pv: &PlayerView, milli: i32, seen: bool, to_player: i32, _bubbles: &mut Vec<Bubble>) {
    // standing in a doorway of a car that is level: step out of the way first
    if let Some((i, Opening::CarHere)) = column(ctx.core, sp.floor, sp.x, 0) {
        if !seen && in_column(i, sp.x) {
            let c = SHAFTS[i].center_x();
            let d = if sp.x >= c { 1 } else { -1 };
            sp.dir = d;
            walk_px(sp, ctx, d, milli);
            return;
        }
    }
    if seen {
        sp.dir = to_player;
        let dist = (pv.x - sp.x).abs();
        let aim_ok = sp.shot_cd == 0 && dist <= SHOOT_RANGE && dist >= 16;
        if aim_ok {
            let low = ctx.run.rng.chance(0.5);
            sp.state = SpyState::Aim { t: 0, low };
            return;
        }
        if dist > STOP_DIST {
            walk_px(sp, ctx, to_player, milli);
        }
        return;
    }
    // ---- wander
    if sp.pause > 0 {
        sp.pause -= 1;
        return;
    }
    if (sp.goal - sp.x).abs() <= 1 {
        // arrived: wait if this is a grate, else pick a new goal
        if let Some((i, Opening::GrateAbove)) = column(ctx.core, sp.floor, sp.x, 0) {
            if in_column(i, sp.x) {
                let len = ctx.run.rng.below(120);
                sp.state = SpyState::Wait { t: len / 2 };
                return;
            }
        }
        sp.pause = 20 + ctx.run.rng.below(70);
        // sometimes go and wait in a shaft opening where a car above could come down
        let grates: Vec<i32> = SHAFTS
            .iter()
            .enumerate()
            .filter(|(i, s)| s.serves(sp.floor) && ctx.core.opening(SHAFTS[*i].id, sp.floor) == Some(Opening::GrateAbove))
            .map(|(_, s)| s.center_x())
            .filter(|cx| (cx - sp.x).abs() <= 220)
            .collect();
        if !grates.is_empty() && ctx.run.rng.chance(0.35) {
            sp.goal = *ctx.run.rng.pick(&grates);
        } else {
            let lo = (sp.x - 90).max(WALL_L + 10);
            let hi = (sp.x + 90).min(WALL_R - 10);
            sp.goal = ctx.run.rng.range(lo, hi);
        }
        return;
    }
    let d = if sp.goal > sp.x { 1 } else { -1 };
    sp.dir = d;
    if !walk_px(sp, ctx, d, milli) {
        // blocked (pit / wall): give up on this goal
        sp.goal = sp.x;
        sp.pause = 30;
    }
}

// ----------------------------------------------------------------------------------------------- drawing

fn draw_spy(sp: &Spy, fb: &mut Fb, cam: &Camera, tick: u32) {
    let fy = sp.feet();
    let flip = sp.dir < 0;
    let (sx, sy) = (cam.sx(sp.x - 8), cam.sy(fy - 24));
    // an open store door behind a spy who is stepping out
    if let Some(id) = sp.door {
        let d = door_rect(store_x(id), fy);
        let open = match sp.state {
            SpyState::Appear { t } => (t * 20 / 8).min(20) as i32,
            _ => 20,
        };
        let (dx, dy) = (cam.sx(d.x + 2), cam.sy(d.y + 2));
        let cx = dx + d.w / 2 - 2;
        fb.rect(cx - open / 2, dy, open, d.h - 2, crate::pixel::pal::BLACK);
        fb.rect(cx - open / 2, dy, open, 1, crate::pixel::pal::DGRAY);
    }
    let (name, frame) = match sp.state {
        SpyState::Appear { .. } => ("spy_stand", 0),
        SpyState::Walk => {
            if sp.idle < 3 {
                ("spy_walk", ((sp.age / 7) % 4) as usize)
            } else {
                ("spy_stand", 0)
            }
        }
        SpyState::Wait { .. } => ("spy_stand", 0),
        SpyState::Slide => ("spy_walk", 1),
        SpyState::Aim { low, .. } => (if low { "spy_aim_low" } else { "spy_aim" }, 0),
        SpyState::Duck { .. } => ("spy_duck", 0),
        SpyState::Dying { t } => ("spy_die", if sp.flat { 2 } else { ((t / 8) as usize).min(2) }),
    };
    // fade in while stepping out of the door
    if let SpyState::Appear { t } = sp.state {
        if sp.car.is_none() && t < 8 {
            return;
        }
    }
    fb.blit(art::get(name), frame, sx, sy, flip);
    // the telegraph: a blinking "!" over his head so the shot is never a surprise
    if let SpyState::Aim { t, .. } = sp.state {
        if (t / 3) % 2 == 0 || t > 20 {
            let (bx, by) = (cam.sx(sp.x - 3), cam.sy(fy - 35));
            fb.rect(bx - 1, by - 1, 9, 11, crate::pixel::pal::WHITE);
            fb.rect(bx, by, 7, 9, crate::pixel::pal::RED);
            fb.text(bx + 1, by + 1, "!", crate::pixel::pal::WHITE);
        }
    }
    let _ = tick;
}

#[cfg(test)]
mod tests {}
