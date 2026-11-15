//! Hanging lamps and 2F disco balls. Port of `modules/lamps.ts`.

use super::fx::{FxKind, FxModule, ShotCandidate, ShotHit};
use super::util::{sgn, sweep_dist};
use crate::audio_ids::SfxId;
use crate::content::layout::{LAMPS, LAMP_HALF_W};
use crate::game::mall::geometry::{fy, opening_state, shaft_at_x};
use crate::game::mall::types::{Bullet, BulletOwner, DeathCause, KilledBy, OpeningState, PlayerMode, SpyMode, PLAYER_HALF_W, SPY_HALF_W, SPY_H};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

/// Floor index of 2F, whose fixtures are disco balls instead of lamps.
pub const DISCO_FLOOR: i32 = 3;
/// A hanging fixture's lowest point sits this far above the floor (shade bottom / ball bottom).
pub const HANG_BOTTOM: f64 = 22.0;
/// The cord/shade can be hit by a bullet whose y is within [floorY - HIT_TOP, floorY - HIT_BOTTOM]: a standing shot (y - 16) hits, a ducking one (y - 8) does not.
pub const HIT_TOP: f64 = 40.0;
pub const HIT_BOTTOM: f64 = 14.0;
pub const FALL_GRAVITY: f64 = 0.4;
/// Darkness around a shattered lamp: about +-48 px for about 2 s.
pub const DARK_HALF_W: f64 = 48.0;
pub const DARK_FRAMES: i32 = 120;
pub const DISCO_SPEED: f64 = 1.6;
/// Height of the fixture body that crushes (lamp shade 10, disco ball 12).
const BODY_H: f64 = 10.0;
/// A falling fixture only crushes once its lowest point has dropped to chest height (this far above the floor).
const CRUSH_FROM: f64 = 14.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LampKind {
    Lamp,
    Disco,
}

impl LampKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            LampKind::Lamp => "lamp",
            LampKind::Disco => "disco",
        }
    }
}

/// hung -> falling -> (lamp) broken | (disco) rolling -> broken (hit a wall) | fell (rolled into a pit).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LampMode {
    Hung,
    Falling,
    Rolling,
    Broken,
    Fell,
}

impl LampMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            LampMode::Hung => "hung",
            LampMode::Falling => "falling",
            LampMode::Rolling => "rolling",
            LampMode::Broken => "broken",
            LampMode::Fell => "fell",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Lamp {
    pub id: i32,
    pub kind: LampKind,
    pub floor: i32,
    /// Centre x (a rolling disco ball moves it).
    pub x: f64,
    pub home_x: f64,
    /// y of the fixture's lowest point.
    pub y: f64,
    pub vy: f64,
    /// Roll direction while rolling: -1, 0 or 1.
    pub dir: i32,
    pub mode: LampMode,
    /// Frames in the current mode.
    pub t: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct DarkZone {
    pub floor: i32,
    pub x: f64,
    /// Frames left / total (the view fades the last frames).
    pub t: i32,
    pub total: i32,
}

/// Hanging lamps (4F, 3F, 1F) and disco balls (2F): shoot to drop; they kill, shatter and darken the corridor.
pub struct LampsModule {
    pub lamps: Vec<Lamp>,
    pub dark: Vec<DarkZone>,
}

impl LampsModule {
    pub fn new() -> LampsModule {
        let mut lamps = Vec::new();
        let mut id = 0;
        for (floor, xs) in LAMPS.iter() {
            for x in xs.iter() {
                lamps.push(Lamp {
                    id,
                    kind: if *floor == DISCO_FLOOR { LampKind::Disco } else { LampKind::Lamp },
                    floor: *floor,
                    x: *x,
                    home_x: *x,
                    y: fy(*floor) - HANG_BOTTOM,
                    vy: 0.0,
                    dir: 0,
                    mode: LampMode::Hung,
                    t: 0,
                });
                id += 1;
            }
        }
        LampsModule { lamps, dark: Vec::new() }
    }

    /// Is a bullet at height `y` inside the lamp's cord/shade hit zone?
    pub fn hit_zone(l: &Lamp, b_y: f64) -> bool {
        let fyv = fy(l.floor);
        b_y >= fyv - HIT_TOP && b_y <= fyv - HIT_BOTTOM
    }

    pub fn shot_candidate(&self, b: &Bullet) -> Option<ShotCandidate> {
        if b.owner != BulletOwner::Player {
            return None; // spy bullets pass
        }
        let mut best: Option<usize> = None;
        let mut best_d = f64::INFINITY;
        for (i, l) in self.lamps.iter().enumerate() {
            if l.mode != LampMode::Hung || !Self::hit_zone(l, b.y) {
                continue;
            }
            if let Some(d) = sweep_dist(b, l.x - LAMP_HALF_W, l.x + LAMP_HALF_W) {
                if d < best_d {
                    best_d = d;
                    best = Some(i);
                }
            }
        }
        best.map(|index| {
            let s = sgn(b.vx);
            ShotCandidate { dist: best_d, hit: ShotHit::Lamp { index, dir: if s != 0 { s } else { 1 } } }
        })
    }

    /// Cut the cord: the fixture starts to fall (a disco ball will roll in `dir` afterwards).
    pub fn release(&mut self, run: &mut Run, index: usize, dir: i32) {
        let l = &mut self.lamps[index];
        if l.mode != LampMode::Hung {
            return;
        }
        l.mode = LampMode::Falling;
        l.t = 0;
        l.vy = 0.0;
        l.dir = dir;
        run.sfx(SfxId::LampFall);
    }

    pub fn step(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule) {
        let mut i = self.dark.len();
        while i > 0 {
            i -= 1;
            self.dark[i].t -= 1;
            if self.dark[i].t <= 0 {
                self.dark.remove(i);
            }
        }
        for li in 0..self.lamps.len() {
            match self.lamps[li].mode {
                LampMode::Falling => self.step_falling(w, run, fx, li),
                LampMode::Rolling => self.step_rolling(w, run, fx, li),
                LampMode::Fell => {
                    let l = &mut self.lamps[li];
                    l.vy += FALL_GRAVITY;
                    l.y += l.vy;
                    l.t += 1;
                }
                _ => self.lamps[li].t += 1,
            }
        }
    }

    fn step_falling(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule, li: usize) {
        let fyv;
        {
            let l = &mut self.lamps[li];
            l.t += 1;
            l.vy += FALL_GRAVITY;
            l.y += l.vy;
            fyv = fy(l.floor);
            if l.y >= fyv {
                l.y = fyv;
            }
        }
        self.crush(w, run, li);
        if self.lamps[li].y < fyv {
            return;
        }
        // reached the floor
        if self.lamps[li].kind == LampKind::Lamp {
            self.shatter(w, run, fx, li, true);
        } else {
            let l = &mut self.lamps[li];
            l.mode = LampMode::Rolling;
            l.t = 0;
            l.vy = 0.0;
            run.sfx(SfxId::DiscoRoll);
            w.add_shake(3);
        }
    }

    fn step_rolling(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule, li: usize) {
        self.lamps[li].t += 1;
        if self.lamps[li].t % 24 == 0 {
            run.sfx(SfxId::DiscoRoll);
        }
        let l = self.lamps[li];
        let fyv = fy(l.floor);
        let nx = w.try_move_x(l.x, fyv, l.dir as f64 * DISCO_SPEED, false, false);
        if nx == l.x {
            // a wall (or a car in the doorway): the ball stops and shatters
            self.shatter(w, run, fx, li, false);
            return;
        }
        self.lamps[li].x = nx;
        // a pit (shaft opening whose car is away): it drops out of sight
        if let Some(s) = shaft_at_x(nx, l.floor) {
            if opening_state(w.car(s.id), l.floor) == OpeningState::Pit {
                let l = &mut self.lamps[li];
                l.mode = LampMode::Fell;
                l.t = 0;
                l.vy = 0.0;
                return;
            }
        }
        self.crush(w, run, li);
    }

    fn shatter(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule, li: usize, darken: bool) {
        let (floor, x) = {
            let l = &mut self.lamps[li];
            l.mode = LampMode::Broken;
            l.t = 0;
            l.vy = 0.0;
            l.dir = 0;
            (l.floor, l.x)
        };
        run.sfx(SfxId::Glass);
        w.add_shake(if darken { 6 } else { 4 });
        fx.add_default(FxKind::Glass, x, fy(floor) - 4.0);
        if darken {
            self.dark.push(DarkZone { floor, x, t: DARK_FRAMES, total: DARK_FRAMES });
        }
    }

    /// Kill whatever the falling lamp / rolling ball is on top of.
    fn crush(&mut self, w: &mut MallWorld, run: &mut Run, li: usize) {
        let l = self.lamps[li];
        if l.mode == LampMode::Falling && l.y < fy(l.floor) - CRUSH_FROM {
            return; // still on its way down from the ceiling
        }
        let half = LAMP_HALF_W + SPY_HALF_W - 1.0;
        let top = l.y - BODY_H;
        for si in 0..w.spies.len() {
            let s = &w.spies[si];
            if s.mode == SpyMode::Dying || s.mode == SpyMode::Emerge {
                continue;
            }
            if (s.x - l.x).abs() >= half {
                continue;
            }
            if s.y < top || s.y - SPY_H > l.y {
                continue;
            }
            w.kill_spy(run, si, if l.kind == LampKind::Disco { KilledBy::Disco } else { KilledBy::Lamp });
        }
        let p = &w.player;
        if w.player_alive() && p.mode != PlayerMode::Hidden && p.mode != PlayerMode::Ride && p.mode != PlayerMode::Escalator && w.player_visible() {
            if (p.x - l.x).abs() < LAMP_HALF_W + PLAYER_HALF_W - 1.0 && p.y >= top && w.hitbox_top() <= l.y {
                w.hurt_player(run, if l.kind == LampKind::Disco { DeathCause::Disco } else { DeathCause::Lamp }, false);
            }
        }
    }

    /// The agent died: a falling lamp lands and goes out at once, a rolling ball is gone, darkness ends.
    pub fn on_respawn(&mut self) {
        self.dark.clear();
        for l in self.lamps.iter_mut() {
            if l.mode == LampMode::Falling || l.mode == LampMode::Rolling {
                l.mode = LampMode::Broken;
                l.y = fy(l.floor);
                l.t = 0;
                l.vy = 0.0;
                l.dir = 0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::layout::ShaftId;
    use crate::engine::pad::{A, RIGHT};
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::spies::new_spy;
    use crate::game::mall::testutil::*;

    fn lamp_at(r: &XRig, floor: i32, x: f64) -> usize {
        r.x_ref().lamps.lamps.iter().position(|l| l.floor == floor && l.home_x == x).unwrap()
    }

    fn lamp(r: &XRig, i: usize) -> Lamp {
        r.x_ref().lamps.lamps[i]
    }

    /// Fire one player bullet from the left (dir +1) or right (dir -1) of a target at height y.
    fn shoot_at(r: &mut XRig, floor: i32, from: f64, dir: i32, y: Option<f64>) {
        place(r, floor, from);
        r.w.player.face = dir;
        let y = y.unwrap_or(fy(floor) - 16.0);
        r.w.bullets.push(Bullet { x: from + dir as f64 * 9.0, y, vx: dir as f64 * 4.0, vy: 0.0, owner: BulletOwner::Player, age: 0 });
    }

    /// Step until `cond` holds (or `max` frames pass).
    fn until(r: &mut XRig, cond: impl Fn(&XRig) -> bool, max: i32) -> i32 {
        let mut n = 0;
        while !cond(r) && n < max {
            r.hold(0, 1);
            n += 1;
        }
        n
    }

    fn quiet(r: &mut XRig) {
        park_cop(r, 1, 60.0, -1);
        r.x().cop.cop.floor = 1;
        park_walkers(r, 300.0, 500.0);
    }

    fn player_bullets(r: &XRig) -> usize {
        r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Player).count()
    }

    #[test]
    fn there_is_one_fixture_per_lamps_entry_lamps_on_4f_3f_1f_disco_balls_on_2f() {
        let r = make_xrig(RigOpts::new(), false);
        let total: usize = LAMPS.iter().map(|(_, xs)| xs.len()).sum();
        assert_eq!(r.x_ref().lamps.lamps.len(), total);
        for l in r.x_ref().lamps.lamps.iter() {
            assert_eq!(l.mode, LampMode::Hung);
            assert_eq!(l.kind, if l.floor == DISCO_FLOOR { LampKind::Disco } else { LampKind::Lamp });
        }
        let mut discos: Vec<i32> = r.x_ref().lamps.lamps.iter().filter(|l| l.kind == LampKind::Disco).map(|l| l.floor).collect();
        discos.dedup();
        assert_eq!(discos, vec![3]);
    }

    #[test]
    fn a_standing_shot_drops_a_lamp_a_ducking_shot_and_a_spy_bullet_pass_underneath() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(300.0), false);
        quiet(&mut r);
        let l = lamp_at(&r, 1, 374.0);
        // ducking height (y - 8)
        shoot_at(&mut r, 1, 330.0, 1, Some(fy(1) - 8.0));
        r.hold(0, 20);
        assert_eq!(lamp(&r, l).mode, LampMode::Hung);
        // a spy's bullet at chest height
        r.w.bullets.clear();
        r.w.bullets.push(Bullet { x: 400.0, y: fy(1) - 16.0, vx: -2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 20);
        assert_eq!(lamp(&r, l).mode, LampMode::Hung);
        // standing shot (y - 16)
        r.w.bullets.clear();
        shoot_at(&mut r, 1, 330.0, 1, None);
        r.sfx.clear();
        until(&mut r, |r| lamp(r, l).mode != LampMode::Hung, 30);
        assert_ne!(lamp(&r, l).mode, LampMode::Hung);
        assert!(r.sfx_has(SfxId::LampFall));
        assert_eq!(player_bullets(&r), 0); // consumed
    }

    #[test]
    fn a_real_shot_from_the_pistol_hits_a_lamp_cord_and_shade_reach_chest_height() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(300.0), false);
        quiet(&mut r);
        place(&mut r, 1, 330.0);
        r.hold(RIGHT, 1); // face right
        r.hold(A, 14);
        r.hold(0, 14);
        assert_ne!(lamp(&r, lamp_at(&r, 1, 374.0)).mode, LampMode::Hung);
    }

    #[test]
    fn a_falling_lamp_shatters_on_the_floor_with_glass_shake_and_2_s_of_darkness_about_48_px_wide() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(100.0), false);
        quiet(&mut r);
        let l = lamp_at(&r, 1, 374.0);
        shoot_at(&mut r, 1, 340.0, 1, None);
        until(&mut r, |r| lamp(r, l).mode == LampMode::Falling, 30);
        assert_eq!(lamp(&r, l).mode, LampMode::Falling);
        let mut frames = 0;
        r.sfx.clear();
        while lamp(&r, l).mode == LampMode::Falling && frames < 60 {
            r.hold(0, 1);
            frames += 1;
        }
        assert_eq!(lamp(&r, l).mode, LampMode::Broken);
        assert!(frames < 25);
        assert_eq!(lamp(&r, l).y, fy(1));
        assert!(r.sfx_has(SfxId::Glass));
        assert!(r.w.shake > 0);
        assert!(r.x_ref().fx.items.iter().any(|f| f.kind == FxKind::Glass));
        assert_eq!(r.x_ref().lamps.dark.len(), 1);
        let d = r.x_ref().lamps.dark[0];
        assert_eq!((d.floor, d.x, d.total), (1, 374.0, DARK_FRAMES));
        assert!(d.t >= DARK_FRAMES - 1);
        assert_eq!(DARK_HALF_W, 48.0);
        r.hold(0, DARK_FRAMES - 4);
        assert_eq!(r.x_ref().lamps.dark.len(), 1);
        r.hold(0, 6);
        assert_eq!(r.x_ref().lamps.dark.len(), 0);
        assert_eq!(DARK_FRAMES, 120);
    }

    #[test]
    fn a_destroyed_lamp_stays_destroyed_for_the_level_more_shots_pass_through() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(100.0), false);
        quiet(&mut r);
        let l = lamp_at(&r, 1, 374.0);
        shoot_at(&mut r, 1, 340.0, 1, None);
        until(&mut r, |r| lamp(r, l).mode == LampMode::Broken, 60);
        assert_eq!(lamp(&r, l).mode, LampMode::Broken);
        r.hold(0, DARK_FRAMES + 5);
        r.w.bullets.clear();
        shoot_at(&mut r, 1, 340.0, 1, None);
        r.hold(0, 2);
        assert_eq!(player_bullets(&r), 1); // flies on, not consumed
        r.hold(0, 60);
        assert_eq!(lamp(&r, l).mode, LampMode::Broken);
        assert_eq!(r.x_ref().lamps.dark.len(), 0);
    }

    #[test]
    fn a_falling_lamp_kills_a_spy_underneath_300_points_killed_by_lamp() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(100.0), false);
        quiet(&mut r);
        let mut s = new_spy(&mut r.w, 374.0, 1, SpyMode::Walk, None);
        s.fire_cd = 99999;
        let id = s.id;
        r.w.spies.push(s);
        r.run.score = 0;
        shoot_at(&mut r, 1, 340.0, 1, None);
        let seen = r.hold_watch(0, 40, id).unwrap();
        assert_eq!(seen.mode, SpyMode::Dying);
        assert_eq!(seen.killed_by, Some(KilledBy::Lamp));
        assert_eq!(lamp(&r, lamp_at(&r, 1, 374.0)).mode, LampMode::Broken);
        assert_eq!(r.run.score, 300);
    }

    #[test]
    fn a_spy_beside_the_lamp_not_underneath_survives() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(100.0), false);
        quiet(&mut r);
        let mut s = new_spy(&mut r.w, 374.0 + 20.0, 1, SpyMode::Walk, None);
        s.fire_cd = 99999;
        s.wander_t = 9999;
        s.wander_dir = 0;
        let id = s.id;
        r.w.spies.push(s);
        shoot_at(&mut r, 1, 340.0, 1, None);
        let seen = r.hold_watch(0, 40, id).unwrap();
        assert_ne!(seen.mode, SpyMode::Dying);
    }

    #[test]
    fn a_falling_lamp_kills_the_agent_underneath_and_armour_does_not_help() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(374.0), false);
        quiet(&mut r);
        r.run.give_power(crate::content::powerups::PowerId::Armor);
        place(&mut r, 1, 374.0);
        let l = lamp_at(&r, 1, 374.0);
        r.with_x(|ex, _w, run| ex.lamps.release(run, l, 1));
        r.hold(0, 3);
        assert!(r.causes.is_empty()); // he is not hit the instant the cord is cut: the lamp has to come down first
        r.hold(0, 9);
        assert!(r.w.shake > 0); // falling lamps shake the screen
        r.hold(0, 12);
        assert_eq!(r.causes, vec!["lamp".to_string()]);
        assert_eq!(r.run.power.armor, Some(crate::content::powerups::PowerId::Armor));
        assert_eq!(r.w.player.mode, PlayerMode::Dying);
    }

    #[test]
    fn a_lamp_that_falls_beside_the_agent_does_not_hurt_him() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(374.0), false);
        quiet(&mut r);
        place(&mut r, 1, 374.0 + 20.0);
        let l = lamp_at(&r, 1, 374.0);
        r.with_x(|ex, _w, run| ex.lamps.release(run, l, 1));
        r.hold(0, 30);
        assert!(r.causes.is_empty());
    }

    #[test]
    fn respawning_ends_the_darkness() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(100.0), false);
        quiet(&mut r);
        shoot_at(&mut r, 1, 340.0, 1, None);
        until(&mut r, |r| r.x_ref().lamps.dark.len() == 1, 60);
        assert_eq!(r.x_ref().lamps.dark.len(), 1);
        r.w.respawn();
        assert_eq!(r.x_ref().lamps.dark.len(), 0);
    }

    // ---- disco balls (2F)

    #[test]
    fn drop_then_roll_in_the_direction_of_the_shot_until_a_wall_flattening_a_spy_on_the_way_300() {
        let mut r = make_xrig(RigOpts::new().floor(3).x(100.0), false);
        quiet(&mut r);
        let d = lamp_at(&r, 3, 556.0);
        let mut sp = new_spy(&mut r.w, 640.0, 3, SpyMode::Walk, None);
        sp.fire_cd = 99999;
        sp.wander_dir = 0;
        sp.wander_t = 99999;
        let id = sp.id;
        r.w.spies.push(sp);
        {
            let c = r.w.car_mut(ShaftId::C);
            c.y = fy(3); // car C level: the doorway is open but the ball rolls straight through
            c.prev_y = c.y;
        }
        r.run.score = 0;
        shoot_at(&mut r, 3, 520.0, 1, None);
        r.sfx.clear();
        until(&mut r, |r| lamp(r, d).mode == LampMode::Falling, 30);
        assert_eq!(lamp(&r, d).mode, LampMode::Falling);
        assert!(r.sfx_has(SfxId::LampFall));
        until(&mut r, |r| lamp(r, d).mode == LampMode::Rolling, 60);
        assert_eq!(lamp(&r, d).mode, LampMode::Rolling);
        assert_eq!(lamp(&r, d).dir, 1);
        assert!(r.sfx_has(SfxId::DiscoRoll));
        let x0 = lamp(&r, d).x;
        r.hold(0, 10);
        assert!((lamp(&r, d).x - x0 - 10.0 * DISCO_SPEED).abs() < 0.5e-5);
        let mut killed_by = None;
        let mut i = 0;
        while i < 400 && lamp(&r, d).mode == LampMode::Rolling {
            r.hold(0, 1);
            if let Some(s) = r.w.spy_by_id(id) {
                killed_by = s.killed_by;
            }
            i += 1;
        }
        assert_eq!(killed_by, Some(KilledBy::Disco));
        assert_eq!(r.run.score, 300);
        assert_eq!(lamp(&r, d).mode, LampMode::Broken); // hit the right wall
        assert!(lamp(&r, d).x > 740.0);
        assert!(r.sfx_has(SfxId::Glass));
    }

    #[test]
    fn rolls_left_when_shot_from_the_right_and_drops_out_of_sight_into_a_pit_the_car_is_away() {
        let mut r = make_xrig(RigOpts::new().floor(3).x(100.0), false);
        quiet(&mut r);
        set_car(&mut r, ShaftId::B, 5); // shaft B (392..416): its car is two floors below 2F -> an open pit
        let d = lamp_at(&r, 3, 556.0);
        shoot_at(&mut r, 3, 600.0, -1, None);
        until(&mut r, |r| lamp(r, d).mode == LampMode::Fell, 400);
        assert_eq!(lamp(&r, d).mode, LampMode::Fell);
        assert_eq!(lamp(&r, d).dir, -1);
        assert!(lamp(&r, d).x < 416.0);
        assert!(lamp(&r, d).x > 392.0);
        let y0 = lamp(&r, d).y;
        r.hold(0, 30);
        assert!(lamp(&r, d).y > y0 + 50.0); // falling out of sight
    }

    #[test]
    fn rolls_over_a_grate_car_above_instead_of_falling() {
        let mut r = make_xrig(RigOpts::new().floor(3).x(100.0), false);
        quiet(&mut r);
        set_car(&mut r, ShaftId::B, 1); // car above 2F: a grate
        let d = lamp_at(&r, 3, 556.0);
        shoot_at(&mut r, 3, 600.0, -1, None);
        until(&mut r, |r| lamp(r, d).mode == LampMode::Rolling, 100);
        assert_eq!(lamp(&r, d).mode, LampMode::Rolling);
        let mut saw_over_grate = false;
        let mut n = 0;
        loop {
            let l = lamp(&r, d);
            if l.x < 405.0 && l.x > 400.0 {
                saw_over_grate = true;
            }
            if l.mode != LampMode::Rolling || n >= 600 {
                break;
            }
            r.hold(0, 1);
            n += 1;
        }
        assert!(saw_over_grate);
        assert_ne!(lamp(&r, d).mode, LampMode::Fell);
    }

    #[test]
    fn the_ball_at_x_700_rolling_left_drops_into_the_pit_of_the_automatic_shaft_c_when_its_car_is_on_1f() {
        let mut r = make_xrig(RigOpts::new().floor(3).x(100.0), false);
        quiet(&mut r);
        set_car(&mut r, ShaftId::C, 4);
        r.w.car_mut(ShaftId::C).wait = 1_000_000_000; // the timer must not bring the car back mid-test
        let d = lamp_at(&r, 3, 700.0);
        shoot_at(&mut r, 3, 740.0, -1, None);
        until(&mut r, |r| lamp(r, d).mode == LampMode::Fell, 200);
        assert_eq!(lamp(&r, d).mode, LampMode::Fell);
        assert!(lamp(&r, d).x < 620.0); // its centre is over the opening (600..624)
        assert!(lamp(&r, d).x > 600.0);
    }

    #[test]
    fn flattens_the_agent_standing_in_its_way_but_he_can_jump_over_it() {
        let mut r = make_xrig(RigOpts::new().floor(3).x(520.0), false);
        quiet(&mut r);
        let d = lamp_at(&r, 3, 556.0);
        place(&mut r, 3, 520.0);
        r.with_x(|ex, _w, run| ex.lamps.release(run, d, -1));
        let mut i = 0;
        while i < 80 && r.causes.is_empty() {
            r.hold(0, 1);
            i += 1;
        }
        assert_eq!(r.causes, vec!["disco".to_string()]);
        // jumping: feet above the 12 px ball
        let mut r2 = make_xrig(RigOpts::new().floor(3).x(520.0), false);
        quiet(&mut r2);
        let d2 = lamp_at(&r2, 3, 556.0);
        r2.with_x(|ex, _w, run| ex.lamps.release(run, d2, -1));
        let mut i = 0;
        while i < 40 && lamp(&r2, d2).mode != LampMode::Rolling {
            r2.hold(0, 1);
            i += 1;
        }
        let dx = lamp(&r2, d2).x;
        place(&mut r2, 3, dx - 20.0);
        r2.hold(B, 1);
        for _ in 0..24 {
            r2.hold(0, 1);
            assert!(r2.causes.is_empty());
        }
    }
}
