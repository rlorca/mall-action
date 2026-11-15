//! The mall cop. Port of `modules/cop.ts`.

use super::fx::{FxKind, FxModule, ShotCandidate, ShotHit};
use super::util::{floor_segments, segment_at, sgn, sweep_dist};
use crate::audio_ids::SfxId;
use crate::content::copy::SHOUTS;
use crate::engine::rng::Rng;
use crate::game::mall::geometry::fy;
use crate::game::mall::types::{Bullet, BulletOwner, PlayerMode};
use crate::game::mall::world::MallWorld;
use crate::game::run::{Run, POINTS};

/// The shopping floors he patrols: 4F, 3F, 2F, 1F.
pub const COP_FLOORS: [i32; 4] = [1, 2, 3, 4];
pub const COP_HALF_W: f64 = 11.0;
pub const COP_H: f64 = 24.0;
/// He notices a shot fired in front of him within this distance (same floor, facing the agent).
pub const COP_SIGHT: f64 = 128.0;
pub const CHASE_FRAMES: i32 = 600;
pub const FREEZE_FRAMES: i32 = 180;
pub const PATROL_SPEED: f64 = 0.6;
pub const CHASE_SPEED: f64 = 1.45;
/// After arresting (or losing) him he wanders off and ignores shots for this long.
pub const CALM_FRAMES: i32 = 300;
const WHISTLE_FRAMES: i32 = 44;
/// Catch distance (x) and how high the agent's feet may be above the Segway.
const CATCH_DX: f64 = 14.0;
const CATCH_ABOVE: f64 = 18.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CopMode {
    Patrol,
    Chase,
    Calm,
}

impl CopMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            CopMode::Patrol => "patrol",
            CopMode::Chase => "chase",
            CopMode::Calm => "calm",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Cop {
    pub x: f64,
    pub floor: i32,
    /// 1 or -1.
    pub face: i32,
    pub mode: CopMode,
    /// Frames in the current mode.
    pub t: i32,
    /// Frames of chase left.
    pub chase_t: i32,
    pub anim: i32,
    /// Frames of the whistle pose still to show.
    pub whistle_t: i32,
    /// Frames standing still (patrol pauses).
    pub pause_t: i32,
    /// Frame (w.frame) at or after which he may change floor (when nobody is looking).
    pub next_hop: i32,
    /// Frames during which a shot in front of him is ignored (just calmed down).
    pub ignore_t: i32,
}

/// The neutral mall cop on his Segway: whistles and chases if provoked, freezes the agent for 3 s and fines him 500.
pub struct CopModule {
    pub cop: Cop,
    rng: Rng,
    seg_cache: Vec<Option<Vec<(f64, f64)>>>,
}

impl CopModule {
    pub fn new(w: &MallWorld) -> CopModule {
        let mut m = CopModule { cop: Cop { x: 0.0, floor: 0, face: 1, mode: CopMode::Patrol, t: 0, chase_t: 0, anim: 0, whistle_t: 0, pause_t: 0, next_hop: 0, ignore_t: 0 }, rng: w.rng.fork("cop"), seg_cache: vec![None; 6] };
        let floor = *m.rng.pick(&COP_FLOORS);
        let segs = m.segments(floor);
        let seg = *m.rng.pick(&segs);
        let x = m.rng.range(seg.0, seg.1);
        let face = if m.rng.chance(0.5) { 1 } else { -1 };
        let next_hop = m.rng.between(1500, 3000);
        m.cop = Cop { x, floor, face, mode: CopMode::Patrol, t: 0, chase_t: 0, anim: 0, whistle_t: 0, pause_t: 0, next_hop, ignore_t: 0 };
        m
    }

    /// The free stretches of a floor between the shaft openings and the walls (he never uses the shafts).
    pub fn segments(&mut self, floor: i32) -> Vec<(f64, f64)> {
        let i = floor as usize;
        if self.seg_cache[i].is_none() {
            self.seg_cache[i] = Some(floor_segments(floor, COP_HALF_W, 4.0, 16.0));
        }
        self.seg_cache[i].clone().unwrap()
    }

    pub fn y(&self) -> f64 {
        fy(self.cop.floor)
    }

    pub fn shot_candidate(&self, b: &Bullet) -> Option<ShotCandidate> {
        let c = &self.cop;
        if b.y < self.y() - COP_H || b.y > self.y() {
            return None;
        }
        let d = sweep_dist(b, c.x - COP_HALF_W, c.x + COP_HALF_W)?;
        Some(ShotCandidate { dist: d, hit: ShotHit::Cop })
    }

    /// Apply a helmet hit (bullet consumed by the router afterwards).
    pub fn resolve_hit(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule, dist: f64, b: &Bullet) {
        run.sfx(SfxId::HelmetPing);
        fx.add(FxKind::Spark, b.x + sgn(b.vx) as f64 * dist.min(b.vx.abs()), b.y, 10);
        if b.owner == BulletOwner::Player && self.cop.mode == CopMode::Patrol {
            self.provoke(w, run);
        }
    }

    /// Blow the whistle and give chase.
    pub fn provoke(&mut self, w: &mut MallWorld, run: &mut Run) {
        let y = self.y();
        let c = &mut self.cop;
        c.mode = CopMode::Chase;
        c.t = 0;
        c.chase_t = CHASE_FRAMES;
        c.whistle_t = WHISTLE_FRAMES;
        c.pause_t = 0;
        let s = sgn(w.player.x - c.x);
        c.face = if s != 0 { s } else { c.face };
        run.sfx(SfxId::Whistle);
        w.say(c.x, y - 28.0, SHOUTS.cop, 110);
    }

    /// The agent fired this frame (the core sets shoot_pose to 8 exactly then, even for a 3-way spread).
    fn fired_this_frame(w: &MallWorld) -> bool {
        w.player.shoot_pose == 8 && (w.player.mode == PlayerMode::Ground || w.player.mode == PlayerMode::Air)
    }

    pub fn step(&mut self, w: &mut MallWorld, run: &mut Run) {
        {
            let c = &mut self.cop;
            c.t += 1;
            c.anim += 1;
            if c.whistle_t > 0 {
                c.whistle_t -= 1;
            }
            if c.ignore_t > 0 {
                c.ignore_t -= 1;
            }
        }

        // ---- provoked by a shot fired in front of him?
        let c = self.cop;
        let p = &w.player;
        if c.mode == CopMode::Patrol
            && c.ignore_t <= 0
            && w.player_visible()
            && Self::fired_this_frame(w)
            && (p.floor == Some(c.floor) || (p.mode == PlayerMode::Air && w.player_floor() == c.floor))
        {
            let dx = p.x - c.x;
            if dx.abs() <= COP_SIGHT && sgn(dx) == c.face {
                self.provoke(w, run);
            }
        }

        match self.cop.mode {
            CopMode::Patrol => self.patrol(w),
            CopMode::Chase => self.chase(w, run),
            CopMode::Calm => self.calm(),
        }
    }

    fn move_(&mut self, dir: i32, speed: f64) -> bool {
        let floor = self.cop.floor;
        let segs = self.segments(floor);
        let (lo, hi) = segment_at(&segs, self.cop.x);
        let nx = self.cop.x + dir as f64 * speed;
        if nx < lo || nx > hi {
            self.cop.x = lo.max(hi.min(nx));
            return false;
        }
        self.cop.x = nx;
        true
    }

    fn patrol(&mut self, w: &MallWorld) {
        if self.cop.pause_t > 0 {
            self.cop.pause_t -= 1;
            return;
        }
        self.maybe_hop(w);
        let face = self.cop.face;
        if !self.move_(face, PATROL_SPEED) {
            self.cop.face = -self.cop.face;
            self.cop.pause_t = self.rng.between(20, 80);
        } else if self.rng.chance(0.004) {
            self.cop.pause_t = self.rng.between(40, 140);
            if self.rng.chance(0.4) {
                self.cop.face = -self.cop.face;
            }
        }
    }

    /// Now and then he moves on to another floor, but only when nobody is watching.
    fn maybe_hop(&mut self, w: &MallWorld) {
        if w.frame < self.cop.next_hop {
            return;
        }
        let px = w.player.x;
        let pf = w.player_floor();
        let watched = |floor: i32, x: f64| -> bool { ((floor - pf) as f64).abs() <= 1.0 && (x - px).abs() < 300.0 };
        if watched(self.cop.floor, self.cop.x) {
            self.cop.next_hop = w.frame + 120;
            return;
        }
        for _tries in 0..8 {
            let floor = *self.rng.pick(&COP_FLOORS);
            if floor == self.cop.floor {
                continue;
            }
            let segs = self.segments(floor);
            let seg = *self.rng.pick(&segs);
            let x = self.rng.range(seg.0, seg.1);
            if watched(floor, x) {
                continue;
            }
            self.cop.floor = floor;
            self.cop.x = x;
            self.cop.face = if self.rng.chance(0.5) { 1 } else { -1 };
            break;
        }
        self.cop.next_hop = w.frame + self.rng.between(1500, 3000);
    }

    fn chase(&mut self, w: &mut MallWorld, run: &mut Run) {
        self.cop.chase_t -= 1;
        if self.cop.chase_t <= 0 || !w.player_alive() {
            self.calm_down(w);
            return;
        }
        let dx = w.player.x - self.cop.x;
        if self.cop.whistle_t <= 0 {
            if dx.abs() > 2.0 {
                self.cop.face = sgn(dx);
                let face = self.cop.face;
                self.move_(face, CHASE_SPEED);
            }
        } else if dx.abs() > 2.0 {
            self.cop.face = sgn(dx); // the whistle stops him for a moment
        }
        // caught?
        let p = &w.player;
        let catchable = w.player_visible() && (p.mode == PlayerMode::Ground || p.mode == PlayerMode::Air) && p.frozen <= 0;
        if catchable && (p.x - self.cop.x).abs() < CATCH_DX && p.y > self.y() - CATCH_ABOVE && p.y <= self.y() + 4.0 {
            self.arrest(w, run);
        }
    }

    /// Frozen for 3 s and fined 500 points: NOT a life.
    pub fn arrest(&mut self, w: &mut MallWorld, run: &mut Run) {
        w.player.frozen = FREEZE_FRAMES;
        w.player.vx = 0.0;
        run.add_score(POINTS.caught_by_cop);
        let (px, py) = (w.player.x, w.player.y);
        w.popup(px, py - 30.0, &POINTS.caught_by_cop.to_string(), Some(0x16));
        w.show_banner(SHOUTS.detained, 150, None, Some(0x28));
        run.sfx(SfxId::Whistle);
        w.add_shake(3);
        self.calm_down(w);
    }

    fn calm_down(&mut self, w: &MallWorld) {
        let c = &mut self.cop;
        c.mode = CopMode::Calm;
        c.t = 0;
        c.chase_t = 0;
        c.ignore_t = CALM_FRAMES;
        // wander off, away from the agent
        let s = sgn(c.x - w.player.x);
        c.face = if s != 0 { s } else { c.face };
    }

    fn calm(&mut self) {
        let face = self.cop.face;
        if !self.move_(face, PATROL_SPEED) {
            self.cop.face = -self.cop.face;
        }
        if self.cop.t >= CALM_FRAMES {
            self.cop.mode = CopMode::Patrol;
            self.cop.t = 0;
            self.cop.pause_t = 0;
        }
    }

    /// The agent died: the cop calms down and wanders off.
    pub fn on_respawn(&mut self, w: &MallWorld) {
        if self.cop.mode == CopMode::Chase {
            self.calm_down(w);
        }
        self.cop.whistle_t = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::mall::geometry::shaft_near;
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::testutil::*;

    const F: i32 = 1; // 4F

    /// Agent at x on 4F, the cop parked at `cop_x` facing `face` (default: facing left, toward an agent on his left).
    fn rig(x: f64, cop_x: f64, face: i32) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(F).x(x), false);
        calm_janitor(&mut r);
        park_walkers(&mut r, 300.0, 500.0);
        park_cop(&mut r, F, cop_x, face);
        place(&mut r, F, x);
        r.run.score = 2000;
        r
    }

    fn cop(r: &XRig) -> Cop {
        r.x_ref().cop.cop
    }

    fn player_bullets(r: &XRig) -> usize {
        r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Player).count()
    }

    #[test]
    fn is_neutral_patrols_his_floor_and_ignores_the_agent_while_nothing_is_shot() {
        let mut r = rig(250.0, 300.0, -1);
        r.x().cop.cop.pause_t = 0;
        r.hold(0, 600);
        assert_eq!(cop(&r).mode, CopMode::Patrol);
        assert_eq!(r.w.player.frozen, 0);
        assert_eq!(r.run.score, 2000);
    }

    #[test]
    fn a_shot_in_front_of_him_same_floor_he_faces_the_agent_within_128_px_makes_him_blow_the_whistle_and_chase() {
        assert_eq!(COP_SIGHT, 128.0);
        let mut r = rig(250.0, 300.0, -1);
        r.sfx.clear();
        r.hold(A, 1);
        let c = cop(&r);
        assert_eq!(c.mode, CopMode::Chase);
        assert!(c.chase_t >= CHASE_FRAMES - 2);
        assert!(r.sfx_has(SfxId::Whistle));
        assert!(r.w.bubbles.iter().any(|b| b.text == SHOUTS.cop));
        assert_eq!(SHOUTS.cop, "HEY! STOP RIGHT THERE!");
    }

    #[test]
    fn a_shot_behind_him_out_of_range_or_on_another_floor_does_not_bother_him_the_bullets_fly_away_from_him() {
        fn calm(r: &mut XRig) {
            r.w.player.face = -1; // shooting AWAY from the cop so no bullet ever reaches his helmet
            r.hold(A, 1);
            r.hold(0, 60);
            assert_eq!(cop(r).mode, CopMode::Patrol);
            assert!(!r.sfx_has(SfxId::Whistle));
        }
        // he faces away from the agent
        calm(&mut rig(250.0, 300.0, 1));
        // too far (> 128 px)
        assert!(360.0 - 215.0 > COP_SIGHT);
        calm(&mut rig(215.0, 360.0, -1));
        // another floor
        let mut c = make_xrig(RigOpts::new().floor(2).x(250.0), false);
        park_cop(&mut c, F, 300.0, -1);
        calm(&mut c);
        // right at the edge of his sight it works
        let mut d = rig(300.0 - COP_SIGHT + 2.0, 300.0, -1);
        d.hold(A, 1);
        assert_eq!(cop(&d).mode, CopMode::Chase);
    }

    #[test]
    fn a_bullet_that_actually_hits_his_helmet_makes_him_angry_even_from_behind() {
        let mut r = rig(250.0, 300.0, 1); // facing away, the agent shoots straight at his back
        r.hold(A, 1);
        assert_eq!(cop(&r).mode, CopMode::Patrol); // not yet: the bullet is still in the air
        r.hold(0, 14);
        assert_eq!(cop(&r).mode, CopMode::Chase);
        assert!(r.sfx_has(SfxId::HelmetPing));
        assert!(r.sfx_has(SfxId::Whistle));
    }

    #[test]
    fn he_chases_for_about_10_s_then_calms_down_and_wanders_off_agent_out_of_reach() {
        let mut r = rig(120.0, 220.0, -1); // the agent is on the far side of shaft A: the cop never crosses a shaft
        r.hold(A, 1);
        assert_eq!(cop(&r).mode, CopMode::Chase);
        let mut frames = 1;
        while cop(&r).mode == CopMode::Chase && frames < 1000 {
            r.hold(0, 1);
            frames += 1;
        }
        assert!(frames >= CHASE_FRAMES - 3);
        assert!(frames <= CHASE_FRAMES + 3);
        assert_eq!(cop(&r).mode, CopMode::Calm);
        assert_eq!(r.w.player.frozen, 0);
        assert_eq!(r.run.score, 2000);
        assert!(cop(&r).x >= 207.0 - 0.001); // stayed in his corridor segment (A's opening ends at 192)
    }

    #[test]
    fn catching_the_agent_freezes_him_for_3_s_and_costs_500_points_not_a_life() {
        assert_eq!(POINTS.caught_by_cop, -500);
        let mut r = rig(250.0, 300.0, -1);
        r.hold(A, 1);
        let mut caught = false;
        let mut i = 0;
        while i < 400 && !caught {
            r.hold(0, 1);
            if r.w.player.frozen > 0 {
                caught = true;
            }
            i += 1;
        }
        assert!(caught);
        assert!(r.w.player.frozen >= FREEZE_FRAMES - 1);
        assert_eq!(FREEZE_FRAMES, 180);
        assert_eq!(r.run.score, 1500);
        assert_eq!(r.run.lives, 3);
        assert!(r.causes.is_empty());
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert_eq!(r.w.banner.as_ref().map(|b| b.text.as_str()), Some(SHOUTS.detained));
        assert_eq!(SHOUTS.detained, "DETAINED! -500");
        assert_eq!(cop(&r).mode, CopMode::Calm);
        // frozen: pressing right does nothing for ~3 s
        let x0 = r.w.player.x;
        r.hold(RIGHT, 150);
        assert_eq!(r.w.player.x, x0);
        r.hold(RIGHT, 60);
        assert!(r.w.player.x > x0 + 20.0);
        // and he does not keep arresting him: the cop wanders off
        assert_eq!(r.run.score, 1500);
        assert!((cop(&r).x - r.w.player.x).abs() > 20.0);
    }

    #[test]
    fn after_an_arrest_he_ignores_shots_for_a_while_then_patrols_and_can_be_provoked_again() {
        let mut r = rig(250.0, 300.0, -1);
        r.hold(A, 1);
        while cop(&r).mode == CopMode::Chase {
            r.hold(0, 1);
        }
        assert_eq!(cop(&r).mode, CopMode::Calm);
        // walk back in front of him and shoot while he is calming down
        r.hold(0, FREEZE_FRAMES + 5);
        let px = r.w.player.x;
        {
            let c = &mut r.x().cop.cop;
            c.pause_t = 1_000_000_000;
            c.face = if px < c.x { -1 } else { 1 };
        }
        r.hold(A, 1);
        assert_eq!(cop(&r).mode, CopMode::Calm);
        r.hold(0, CALM_FRAMES);
        assert_eq!(cop(&r).mode, CopMode::Patrol);
        {
            let c = &mut r.x().cop.cop;
            c.pause_t = 1_000_000_000;
            c.face = if px < c.x { -1 } else { 1 };
            c.x = (px + 60.0).max(215.0).min(370.0) * 1.0;
            c.face = if px < c.x { -1 } else { 1 };
        }
        r.w.player.shoot_cd = 0;
        r.hold(A, 1);
        assert_eq!(cop(&r).mode, CopMode::Chase);
    }

    #[test]
    fn bullets_ping_off_his_helmet_consumed_spark_sound_he_cannot_be_hurt_spy_bullets_too() {
        let mut r = rig(250.0, 300.0, 1); // facing away
        r.sfx.clear();
        r.hold(A, 1);
        r.hold(0, 12);
        assert_eq!(player_bullets(&r), 0);
        assert!(r.sfx_has(SfxId::HelmetPing));
        assert!(r.x_ref().fx.items.iter().any(|f| f.kind == FxKind::Spark));
        // a spy's bullet pings as well and does not provoke him
        let mut q = rig(250.0, 300.0, -1);
        q.x().cop.cop.ignore_t = 0;
        q.x().cop.cop.mode = CopMode::Patrol;
        q.w.bullets.push(Bullet { x: 340.0, y: fy(F) - 16.0, vx: -2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        q.sfx.clear();
        q.hold(0, 30);
        assert!(q.sfx_has(SfxId::HelmetPing));
        assert_eq!(cop(&q).mode, CopMode::Patrol);
        assert!(q.causes.is_empty());
    }

    #[test]
    fn he_never_uses_the_shafts_and_changes_floors_only_out_of_sight_over_a_long_time() {
        let mut floors: Vec<i32> = Vec::new();
        for seed in [1u32, 2, 3, 4] {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(5).x(700.0), false); // agent far away on the parking level
            calm_janitor(&mut r);
            for _ in 0..30000 {
                r.hold(0, 1);
                let c = cop(&r);
                if !floors.contains(&c.floor) {
                    floors.push(c.floor);
                }
                assert!(COP_FLOORS.contains(&c.floor));
                assert!(shaft_near(c.x, c.floor, COP_HALF_W).is_none());
                assert!(c.x >= 24.0);
                assert!(c.x <= 744.0);
            }
        }
        assert!(floors.len() >= 3);
    }

    #[test]
    fn he_never_hops_floors_while_the_agent_can_see_him() {
        let mut r = make_xrig(RigOpts::new().floor(F).x(300.0), false);
        calm_janitor(&mut r);
        park_cop(&mut r, F, 250.0, -1);
        r.x().cop.cop.pause_t = 0;
        r.x().cop.cop.next_hop = 0;
        for _ in 0..5000 {
            r.hold(0, 1);
            assert_eq!(cop(&r).floor, F);
        }
    }

    #[test]
    fn he_never_blocks_the_agent_walking_through_a_patrolling_cop_is_free() {
        let mut r = rig(240.0, 300.0, -1);
        r.hold(RIGHT, 100);
        assert_eq!(r.w.player.x, 340.0);
        assert_eq!(r.w.player.frozen, 0);
        assert_eq!(cop(&r).mode, CopMode::Patrol);
    }

    #[test]
    fn dying_calms_him_down() {
        let mut r = rig(250.0, 300.0, -1);
        r.hold(A, 1);
        assert_eq!(cop(&r).mode, CopMode::Chase);
        r.w.respawn();
        assert_eq!(cop(&r).mode, CopMode::Calm);
    }
}
