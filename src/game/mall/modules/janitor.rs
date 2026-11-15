//! The 1F janitor and his wet patches. Port of `modules/janitor.ts`.

use super::util::sgn;
use crate::engine::rng::Rng;
use crate::game::mall::types::{PlayerMode, SpyMode};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

/// 1F is floor index 4.
pub const JANITOR_FLOOR: i32 = 4;
/// The janitor patrols this x range only, and a patch is always centred within [PATCH_MIN_C, JANITOR_MAX_X], so its
/// edges stay in [12, 364]: the first shaft opening on 1F (B) starts at 392, so a wet patch can NEVER reach a shaft.
pub const JANITOR_MIN_X: f64 = 24.0;
pub const JANITOR_MAX_X: f64 = 340.0;
pub const PATCH_W: f64 = 48.0;
pub const PATCH_MIN_C: f64 = 36.0;
pub const PATCH_FRAMES: i32 = 600;
const JANITOR_SPEED: f64 = 0.4;
const MOP_FRAMES: i32 = 96;
/// The patch is mopped this far in front of him.
const MOP_REACH: f64 = 20.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum JanitorMode {
    Walk,
    Mop,
}

impl JanitorMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            JanitorMode::Walk => "walk",
            JanitorMode::Mop => "mop",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Janitor {
    pub x: f64,
    pub floor: i32,
    /// 1 or -1.
    pub face: i32,
    pub mode: JanitorMode,
    /// Frames in the current mode.
    pub t: i32,
    pub anim: i32,
    /// Frame (w.frame) at or after which he mops next (once no patch is left).
    pub next_mop: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct WetPatch {
    /// Centre x.
    pub x: f64,
    /// Frames left.
    pub t: i32,
}

/// Where the patch lands for a janitor standing at x facing `face` (always inside the safe zone).
pub fn patch_centre(x: f64, face: i32) -> f64 {
    PATCH_MIN_C.max(JANITOR_MAX_X.min(x + face as f64 * MOP_REACH))
}

#[derive(Clone, Copy, Debug)]
struct SpySlide {
    prev_x: f64,
    sliding: bool,
    dir: i32,
    /// Hit a wall: do not start again until it has left the patch.
    blocked: bool,
}

/// The janitor on 1F and his wet patches: anyone entering a patch slides at walking speed until off it.
pub struct JanitorModule {
    pub janitor: Janitor,
    pub patch: Option<WetPatch>,
    rng: Rng,
    agent_sliding: bool,
    agent_blocked: bool,
    /// We set kick = true for a kick-landing on the patch (clear it again when the slide ends).
    agent_kick: bool,
    /// Per-spy slide records keyed by spy id (TS: WeakMap keyed by the spy object).
    spy_slide: Vec<(i32, SpySlide)>,
}

impl JanitorModule {
    pub fn new(w: &MallWorld) -> JanitorModule {
        let mut rng = w.rng.fork("janitor");
        let x = rng.between((JANITOR_MIN_X + 40.0) as i32, (JANITOR_MAX_X - 40.0) as i32) as f64;
        let face = if rng.chance(0.5) { 1 } else { -1 };
        let next_mop = rng.between(240, 600);
        JanitorModule {
            janitor: Janitor { x, floor: JANITOR_FLOOR, face, mode: JanitorMode::Walk, t: 0, anim: 0, next_mop },
            patch: None,
            rng,
            agent_sliding: false,
            agent_blocked: false,
            agent_kick: false,
            spy_slide: Vec::new(),
        }
    }

    /// Is x on the current patch?
    pub fn on_patch(&self, x: f64) -> bool {
        self.patch.map_or(false, |p| (x - p.x).abs() < PATCH_W / 2.0)
    }

    pub fn step(&mut self, w: &mut MallWorld, run: &Run) {
        self.step_janitor(w);
        self.step_agent(w);
        self.step_spies(w, run);
    }

    fn step_janitor(&mut self, w: &MallWorld) {
        {
            let j = &mut self.janitor;
            j.t += 1;
            j.anim += 1;
        }
        if let Some(p) = self.patch.as_mut() {
            p.t -= 1;
            if p.t <= 0 {
                self.patch = None;
                self.janitor.next_mop = w.frame + self.rng.between(300, 720);
            }
        }
        if self.janitor.mode == JanitorMode::Mop {
            if self.janitor.t >= MOP_FRAMES {
                let j = &mut self.janitor;
                self.patch = Some(WetPatch { x: patch_centre(j.x, j.face), t: PATCH_FRAMES });
                j.mode = JanitorMode::Walk;
                j.t = 0;
                // walk away from the fresh patch
                j.face = -j.face;
            }
            return;
        }
        if self.patch.is_none() && w.frame >= self.janitor.next_mop {
            self.janitor.mode = JanitorMode::Mop;
            self.janitor.t = 0;
            return;
        }
        if self.janitor.t > 60 && self.rng.chance(0.004) {
            self.janitor.face = -self.janitor.face;
            self.janitor.t = 0;
        }
        let j = &mut self.janitor;
        j.x += j.face as f64 * JANITOR_SPEED;
        if j.x <= JANITOR_MIN_X {
            j.x = JANITOR_MIN_X;
            j.face = 1;
        } else if j.x >= JANITOR_MAX_X {
            j.x = JANITOR_MAX_X;
            j.face = -1;
        }
    }

    fn end_agent_slide(&mut self, w: &mut MallWorld) {
        let p = &mut w.player;
        if self.agent_sliding {
            p.slide = 0;
            if p.mode == PlayerMode::Ground {
                p.kick = false; // a grounded agent who is not sliding has no kick
            }
        }
        self.agent_sliding = false;
        self.agent_kick = false;
    }

    fn step_agent(&mut self, w: &mut MallWorld) {
        let alive = w.player_alive();
        let mode = w.player.mode;
        if !alive || (mode != PlayerMode::Ground && mode != PlayerMode::Air) {
            self.end_agent_slide(w);
            self.agent_blocked = false;
            return;
        }
        if mode == PlayerMode::Air {
            return; // the core carries the slide through a jump
        }
        // grounded
        let here = w.player.floor == Some(JANITOR_FLOOR) && w.player.roof.is_none() && self.on_patch(w.player.x);
        if self.agent_sliding {
            if !here {
                self.end_agent_slide(w);
                self.agent_blocked = false;
            } else if w.player.slide == 0 {
                // the core stopped us at a wall: stay put until we leave the patch
                self.agent_sliding = false;
                self.agent_blocked = true;
                w.player.kick = false;
                self.agent_kick = false;
            }
            return;
        }
        if !here {
            self.agent_blocked = false;
            return;
        }
        if self.agent_blocked {
            return;
        }
        let p = &mut w.player;
        let s = sgn(p.vx);
        let dir = if s != 0 { s } else { p.face };
        p.slide = dir;
        p.face = dir;
        p.ducking = false;
        self.agent_sliding = true;
        if p.landed_kick {
            // a jump-kick landing on the patch keeps kicking while sliding
            p.kick = true;
            self.agent_kick = true;
        }
    }

    fn step_spies(&mut self, w: &mut MallWorld, run: &Run) {
        let speed = w.spy_speed(run);
        // forget records of spies that are gone (the TS WeakMap does this by garbage collection)
        self.spy_slide.retain(|(id, _)| w.spies.iter().any(|s| s.id == *id));
        for si in 0..w.spies.len() {
            let (sid, sx, sy, smode, sfloor, sface) = {
                let s = &w.spies[si];
                (s.id, s.x, s.y, s.mode, s.floor, s.face)
            };
            let ri = match self.spy_slide.iter().position(|(id, _)| *id == sid) {
                Some(i) => i,
                None => {
                    self.spy_slide.push((sid, SpySlide { prev_x: sx, sliding: false, dir: 1, blocked: false }));
                    self.spy_slide.len() - 1
                }
            };
            let eligible = smode != SpyMode::Dying && smode != SpyMode::Emerge && sfloor == JANITOR_FLOOR;
            let here = eligible && self.on_patch(sx);
            let rec = &mut self.spy_slide[ri].1;
            if !here {
                rec.sliding = false;
                rec.blocked = false;
            } else {
                if !rec.sliding && !rec.blocked {
                    rec.sliding = true;
                    let s = sgn(sx - rec.prev_x);
                    rec.dir = if s != 0 { s } else { sface };
                }
                if rec.sliding {
                    // the spy AI already moved him this frame: replace that step by the slide (walking speed, no stopping or turning)
                    let nx = w.try_move_x(rec.prev_x, sy, rec.dir as f64 * speed, true, false);
                    w.spies[si].face = rec.dir;
                    if nx == rec.prev_x {
                        rec.sliding = false;
                        rec.blocked = true;
                        w.spies[si].x = rec.prev_x;
                    } else {
                        w.spies[si].x = nx;
                        w.spies[si].anim += 1;
                    }
                }
            }
            rec.prev_x = w.spies[si].x;
        }
    }

    pub fn on_respawn(&mut self, w: &mut MallWorld) {
        self.agent_sliding = false;
        self.agent_blocked = false;
        self.agent_kick = false;
        w.player.slide = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::layout::{SHAFTS, WALL_L};
    use crate::game::mall::geometry::{fy, shaft_near};
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::spies::new_spy;
    use crate::game::mall::testutil::*;
    use crate::game::mall::types::{Bullet, BulletOwner, DeathCause, KilledBy, PlayerMode, SpyMode};

    const FLOOR: i32 = JANITOR_FLOOR; // 1F

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.5e-5
    }

    /// A rig on 1F with a fresh wet patch centred on `c` and nothing else going on.
    fn wet_rig(c: f64, start_x: f64) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(FLOOR).x(start_x), false);
        calm_janitor(&mut r);
        park_cop(&mut r, 1, 60.0, -1);
        r.x().janitor.janitor.x = 30.0; // far from the scene
        r.x().janitor.patch = Some(WetPatch { x: c, t: PATCH_FRAMES });
        place(&mut r, FLOOR, start_x);
        r
    }

    fn jan(r: &XRig) -> Janitor {
        r.x_ref().janitor.janitor
    }

    #[test]
    fn his_wet_patch_is_48_px_wide_and_can_never_reach_a_shaft_opening_wherever_he_stands_static_proof() {
        assert_eq!(PATCH_W, 48.0);
        let serving: Vec<_> = SHAFTS.iter().filter(|s| FLOOR >= s.top && FLOOR <= s.bottom).collect();
        assert!(serving.len() > 0);
        let mut x = JANITOR_MIN_X;
        while x <= JANITOR_MAX_X {
            for face in [-1, 1] {
                let c = patch_centre(x, face);
                let left = c - PATCH_W / 2.0;
                let right = c + PATCH_W / 2.0;
                assert!(left >= WALL_L + 4.0);
                for s in serving.iter() {
                    assert!(right < s.x - 8.0);
                }
                // not even the safety margin around the openings
                assert!(shaft_near(left, FLOOR, 8.0).is_none());
                assert!(shaft_near(right, FLOOR, 8.0).is_none());
            }
            x += 0.5;
        }
    }

    #[test]
    fn simulated_for_a_long_time_he_stays_in_24_340_and_no_patch_ever_touches_a_shaft_opening() {
        for seed in [1u32, 2, 3] {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(0).x(100.0), false);
            park_cop(&mut r, 1, 60.0, -1);
            let mut patches = 0;
            let mut last_patch_t: Option<i32> = None;
            for _ in 0..12000 {
                r.hold(0, 1);
                let j = jan(&r);
                assert!(j.x >= JANITOR_MIN_X);
                assert!(j.x <= JANITOR_MAX_X);
                if let Some(p) = r.x_ref().janitor.patch {
                    // a new patch object starts at t = PATCH_FRAMES - 1 after its first tick; detect it by t increasing
                    if last_patch_t.map_or(true, |lt| p.t > lt) {
                        patches += 1;
                    }
                    last_patch_t = Some(p.t);
                    assert!(shaft_near(p.x - PATCH_W / 2.0, FLOOR, 8.0).is_none());
                    assert!(shaft_near(p.x + PATCH_W / 2.0, FLOOR, 8.0).is_none());
                } else {
                    last_patch_t = None;
                }
            }
            assert!(patches >= 3);
        }
    }

    #[test]
    fn he_stops_to_mop_then_leaves_a_patch_that_lasts_about_10_s_600_frames_and_only_one_at_a_time() {
        let mut r = make_xrig(RigOpts::new().floor(0).x(100.0), false);
        park_cop(&mut r, 1, 60.0, -1);
        r.x().janitor.janitor.next_mop = 0;
        r.hold(0, 1);
        assert_eq!(jan(&r).mode, JanitorMode::Mop);
        let x0 = jan(&r).x;
        r.hold(0, 40);
        assert_eq!(jan(&r).x, x0); // standing still while he mops
        assert!(r.x_ref().janitor.patch.is_none());
        while r.x_ref().janitor.patch.is_none() {
            r.hold(0, 1);
        }
        let patch = r.x_ref().janitor.patch.unwrap();
        assert_eq!(patch.t, PATCH_FRAMES);
        assert!((patch.x - jan(&r).x).abs() <= PATCH_W);
        let mut alive = 0;
        while r.x_ref().janitor.patch.is_some() {
            r.hold(0, 1);
            alive += 1;
            r.x().janitor.janitor.next_mop = 0; // he wants to mop again but must wait until the patch is gone
            assert_ne!(jan(&r).mode, JanitorMode::Mop);
        }
        assert!(alive >= PATCH_FRAMES - 1);
        assert!(alive <= PATCH_FRAMES + 1);
    }

    #[test]
    fn he_is_harmless_bullets_pass_through_him_and_he_does_not_hurt_the_agent() {
        let mut r = make_xrig(RigOpts::new().floor(FLOOR).x(100.0), false);
        park_cop(&mut r, 1, 60.0, -1);
        calm_janitor(&mut r);
        r.x().janitor.janitor.x = 250.0;
        let jx = 250.0;
        r.w.bullets.push(Bullet { x: jx - 12.0, y: fy(FLOOR) - 16.0, vx: 4.0, vy: 0.0, owner: BulletOwner::Player, age: 0 });
        r.w.bullets.push(Bullet { x: jx + 12.0, y: fy(FLOOR) - 16.0, vx: -2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 12);
        assert_eq!(r.w.bullets.len(), 2); // neither was consumed
        assert!(r.w.bullets.iter().any(|b| b.owner == BulletOwner::Player && b.x > jx + 4.0));
        assert!(r.w.bullets.iter().any(|b| b.owner == BulletOwner::Spy && b.x < jx - 4.0));
        r.w.bullets.clear();
        place(&mut r, FLOOR, jx);
        r.w.player.invuln = 0;
        r.hold(0, 60);
        assert!(r.causes.is_empty());
    }

    // ---- the wet patch slides the agent

    #[test]
    fn entering_it_he_slides_at_walking_speed_and_cannot_stop_or_turn_until_he_is_off_it() {
        let mut r = wet_rig(255.0, 205.0);
        // walk right into the patch (it spans 231..279)
        r.hold(RIGHT, 32);
        assert!(r.w.player.x > 231.0);
        assert_eq!(r.w.player.slide, 1);
        // now hold LEFT (turn) and nothing (stop): he keeps going right at 1 px/frame
        let mut x = r.w.player.x;
        for i in 0..12 {
            r.hold(if i % 2 == 1 { LEFT } else { 0 }, 1);
            assert!(close(r.w.player.x - x, 1.0));
            assert_eq!(r.w.player.face, 1);
            x = r.w.player.x;
        }
        // off the patch he is free again
        let mut n = 0;
        while r.w.player.slide != 0 && n < 100 {
            r.hold(LEFT, 1);
            n += 1;
        }
        assert_eq!(r.w.player.slide, 0);
        assert!(r.w.player.x > 278.0);
        r.hold(RIGHT, 5);
        assert!(r.w.player.x > 283.0);
        r.hold(LEFT, 2);
        assert_eq!(r.w.player.face, -1);
    }

    #[test]
    fn sliding_works_from_the_right_too_and_stops_at_the_patch_edge() {
        let mut r = wet_rig(255.0, 300.0);
        r.hold(LEFT, 30);
        assert_eq!(r.w.player.slide, -1);
        let mut n = 0;
        while r.w.player.slide != 0 && n < 100 {
            r.hold(RIGHT, 1); // cannot turn
            n += 1;
        }
        assert_eq!(r.w.player.slide, 0);
        assert!(r.w.player.x <= 231.0);
        assert!(r.w.player.x > 225.0);
    }

    #[test]
    fn jumping_is_still_allowed_while_sliding() {
        let mut r = wet_rig(255.0, 205.0);
        r.hold(RIGHT, 38);
        assert_eq!(r.w.player.slide, 1);
        r.hold(B, 1);
        assert_eq!(r.w.player.mode, PlayerMode::Air);
        assert!(r.w.player.kick); // moving jump = jump-kick
    }

    #[test]
    fn shooting_is_still_allowed_while_sliding() {
        let mut r = wet_rig(255.0, 205.0);
        r.hold(RIGHT, 38);
        assert_eq!(r.w.player.slide, 1);
        r.hold(A, 1);
        assert!(r.w.bullets.iter().any(|b| b.owner == BulletOwner::Player));
    }

    #[test]
    fn a_standing_agent_is_carried_off_if_a_patch_appears_under_him() {
        let mut r = make_xrig(RigOpts::new().floor(FLOOR).x(200.0), false);
        calm_janitor(&mut r);
        park_cop(&mut r, 1, 60.0, -1);
        r.x().janitor.janitor.x = 30.0;
        r.hold(0, 5);
        assert_eq!(r.w.player.slide, 0);
        r.x().janitor.patch = Some(WetPatch { x: 200.0, t: PATCH_FRAMES });
        r.hold(0, 5);
        assert_ne!(r.w.player.slide, 0);
        r.hold(0, 40);
        assert_eq!(r.w.player.slide, 0);
        assert!(r.w.player.x >= 224.0);
    }

    #[test]
    fn a_jump_kick_landing_on_the_patch_keeps_kicking_while_sliding_and_kills_a_spy_for_300_slide() {
        let mut r = wet_rig(255.0, 215.0);
        r.run.score = 0;
        let mut sp = new_spy(&mut r.w, 278.0, FLOOR, SpyMode::Walk, None);
        sp.face = -1;
        sp.fire_cd = 99999;
        sp.wander_t = 99999;
        sp.wander_dir = 0;
        let id = sp.id;
        r.w.spies.push(sp);
        r.hold(RIGHT | B, 1);
        assert!(r.w.player.kick);
        let mut landed = false;
        let mut i = 0;
        while i < 40 && r.w.spy_by_id(id).map_or(false, |s| s.mode != SpyMode::Dying) {
            r.hold(RIGHT, 1);
            if !landed && r.w.player.mode == PlayerMode::Ground {
                landed = true;
                assert_eq!(r.w.player.slide, 1);
                assert!(r.w.player.kick); // kept kicking after the landing
            }
            i += 1;
        }
        assert!(landed);
        let s = r.w.spy_by_id(id).unwrap();
        assert_eq!(s.mode, SpyMode::Dying);
        assert_eq!(s.killed_by, Some(KilledBy::Slide));
        assert_eq!(r.run.score, 300);
        assert!(r.causes.is_empty());
    }

    #[test]
    fn without_the_kick_standing_jump_landing_on_the_patch_does_not_make_the_slide_a_kick() {
        let mut r = wet_rig(255.0, 255.0);
        r.hold(B, 1);
        let mut i = 0;
        while i < 40 && r.w.player.mode == PlayerMode::Air {
            r.hold(0, 1);
            i += 1;
        }
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert_ne!(r.w.player.slide, 0);
        assert!(!r.w.player.kick);
    }

    #[test]
    fn the_kick_ends_when_he_slides_off_the_patch() {
        let mut r = wet_rig(255.0, 215.0);
        r.hold(RIGHT | B, 1);
        for _ in 0..80 {
            r.hold(RIGHT, 1);
        }
        assert!(r.w.player.x > 279.0);
        assert_eq!(r.w.player.slide, 0);
        assert!(!r.w.player.kick);
    }

    #[test]
    fn sliding_into_a_wall_stops_him_there_and_he_is_not_stuck() {
        let mut r = wet_rig(36.0, 70.0); // patch 12..60 against the left wall
        r.hold(LEFT, 80);
        assert!(r.w.player.x >= 12.0);
        assert!(r.w.player.x < 30.0);
        r.hold(RIGHT, 120);
        assert!(r.w.player.x > 60.0);
    }

    #[test]
    fn boarding_an_escalator_or_dying_while_sliding_clears_the_slide() {
        let mut r = wet_rig(255.0, 205.0);
        r.hold(RIGHT, 30);
        assert_eq!(r.w.player.slide, 1);
        {
            let rig = &mut r.rig;
            rig.w.hurt_player(&mut rig.run, DeathCause::Shot, false);
        }
        r.hold(0, 2);
        assert_eq!(r.w.player.slide, 0);
    }

    // ---- the wet patch slides spies too

    #[test]
    fn a_spy_that_walks_onto_it_keeps_going_in_the_same_direction_at_walking_speed_and_cannot_turn_back() {
        let mut r = wet_rig(255.0, 400.0);
        r.w.player.invuln = 99999;
        let mut sp = new_spy(&mut r.w, 150.0, FLOOR, SpyMode::Walk, None);
        sp.face = 1;
        sp.fire_cd = 99999;
        let id = sp.id;
        r.w.spies.push(sp);
        r.w.next_spy = 1_000_000_000;
        // the agent stands to the right: the spy walks toward him
        place(&mut r, FLOOR, 330.0);
        let sx = |r: &XRig| r.w.spy_by_id(id).unwrap().x;
        let mut prev = sx(&r);
        let mut slid = 0;
        let mut i = 0;
        while i < 400 && sx(&r) < 295.0 {
            r.hold(0, 1);
            let x = sx(&r);
            if x > 233.0 && x < 277.0 {
                // on the patch: moves right every frame, at walking speed, even if the agent teleports behind him
                if i % 7 == 0 {
                    place(&mut r, FLOOR, 20.0);
                }
                assert!(close(x - prev, r.w.spy_speed(&r.run)));
                slid += 1;
            }
            prev = x;
            i += 1;
        }
        assert!(slid > 30);
        assert!(sx(&r) > 278.0);
    }
}
