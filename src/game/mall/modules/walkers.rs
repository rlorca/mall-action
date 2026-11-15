//! Mall walkers. Port of `modules/walkers.ts`.

use super::fx::{FxKind, FxModule, ShotCandidate, ShotHit};
use super::util::{sgn, sweep_dist};
use crate::audio_ids::SfxId;
use crate::content::copy::SHOUTS;
use crate::game::mall::geometry::fy;
use crate::game::mall::types::{Bullet, BulletOwner, PlayerMode, PLAYER_HALF_W};
use crate::game::mall::world::MallWorld;
use crate::game::run::{Run, POINTS};

/// 2F is floor index 3.
pub const WALKER_FLOOR: i32 = 3;
pub const WALKER_HALF_W: f64 = 6.0;
pub const WALKER_H: f64 = 24.0;

#[derive(Clone, Copy, Debug)]
pub struct WalkerDef {
    pub min: f64,
    pub max: f64,
    pub speed: f64,
}

/// Two retirees, each with its own stretch of 2F (clear of the shaft openings at 168, 392 and 600) and speed.
pub const WALKER_DEFS: [WalkerDef; 2] = [WalkerDef { min: 208.0, max: 384.0, speed: 0.55 }, WalkerDef { min: 436.0, max: 592.0, speed: 0.8 }];
const ANGRY_FRAMES: i32 = 44;

#[derive(Clone, Copy, Debug)]
pub struct Walker {
    pub id: i32,
    pub x: f64,
    /// Feet y (the floor they walk on).
    pub y: f64,
    pub floor: i32,
    /// 1 or -1.
    pub face: i32,
    /// The stretch he paces and his speed (px/frame).
    pub min: f64,
    pub max: f64,
    pub speed: f64,
    pub anim: i32,
    /// Frames left of standing still and fuming after being shot (no points beyond the first hit, but the bubble stays).
    pub angry_t: i32,
    /// Position change this frame (carries the agent along).
    pub dx: f64,
}

/// Mall walkers: retirees in tracksuits power-walking set stretches on 2F. They never die, block every bullet and push the agent.
pub struct WalkersModule {
    pub walkers: Vec<Walker>,
}

impl WalkersModule {
    pub fn new(w: &MallWorld) -> WalkersModule {
        let mut rng = w.rng.fork("walkers");
        let mut walkers = Vec::new();
        for (id, d) in WALKER_DEFS.iter().enumerate() {
            let x = rng.range(d.min, d.max);
            let face = if rng.chance(0.5) { 1 } else { -1 };
            let anim = rng.between(0, 40);
            walkers.push(Walker { id: id as i32, x, y: fy(WALKER_FLOOR), floor: WALKER_FLOOR, face, min: d.min, max: d.max, speed: d.speed, anim, angry_t: 0, dx: 0.0 });
        }
        WalkersModule { walkers }
    }

    pub fn shot_candidate(&self, b: &Bullet) -> Option<ShotCandidate> {
        let fyv = fy(WALKER_FLOOR);
        if b.y < fyv - WALKER_H || b.y > fyv {
            return None;
        }
        let mut best: Option<usize> = None;
        let mut best_d = f64::INFINITY;
        for (i, k) in self.walkers.iter().enumerate() {
            if let Some(d) = sweep_dist(b, k.x - WALKER_HALF_W, k.x + WALKER_HALF_W) {
                if d < best_d {
                    best_d = d;
                    best = Some(i);
                }
            }
        }
        best.map(|index| ShotCandidate { dist: best_d, hit: ShotHit::Walker { index } })
    }

    /// Apply a walker hit: both sides' bullets are stopped; only the agent's cost him.
    pub fn resolve_hit(&mut self, w: &mut MallWorld, run: &mut Run, fx: &mut FxModule, index: usize, dist: f64, b: &Bullet) {
        fx.add(FxKind::Spark, b.x + sgn(b.vx) as f64 * dist.min(b.vx.abs()), b.y, 8);
        if b.owner != BulletOwner::Player {
            return;
        }
        run.add_score(POINTS.walker_shot);
        let (kx, ky) = (self.walkers[index].x, self.walkers[index].y);
        w.popup(kx, ky, &POINTS.walker_shot.to_string(), Some(0x16));
        w.say(kx, ky - 26.0, SHOUTS.walker, 70);
        run.sfx(SfxId::Blip);
        let k = &mut self.walkers[index];
        k.angry_t = ANGRY_FRAMES;
        k.face = if b.vx > 0.0 { -1 } else { 1 }; // turns to scold the shooter
    }

    pub fn step(&mut self, w: &mut MallWorld) {
        let pushable = w.player_alive() && w.player.mode == PlayerMode::Ground && w.player.floor == Some(WALKER_FLOOR) && w.player.roof.is_none();
        for ki in 0..self.walkers.len() {
            let k = &mut self.walkers[ki];
            let x0 = k.x;
            if k.angry_t > 0 {
                k.angry_t -= 1;
            } else {
                k.x += k.face as f64 * k.speed;
                k.anim += 1;
                if k.x <= k.min {
                    k.x = k.min;
                    k.face = 1;
                } else if k.x >= k.max {
                    k.x = k.max;
                    k.face = -1;
                }
            }
            k.dx = k.x - x0;
            if pushable {
                self.push(w, ki);
            }
        }
    }

    /// Touching a walker just pushes the agent along (never into a pit: `for_spy` movement honours the shaft rules).
    fn push(&mut self, w: &mut MallWorld, ki: usize) {
        let k = &mut self.walkers[ki];
        let reach = WALKER_HALF_W + PLAYER_HALF_W;
        let d = w.player.x - k.x;
        if d.abs() >= reach {
            return;
        }
        let s = sgn(d);
        let dir = if s != 0 { s } else { k.face };
        let want = k.x + dir as f64 * reach;
        let nx = w.try_move_x(w.player.x, w.player.y, want - w.player.x, true, false);
        if (nx - want).abs() > 0.01 {
            // pinned against a wall or a shaft: the walker turns back instead of crushing him
            k.face = -dir;
        }
        w.player.x = nx;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::mall::geometry::{fy, shaft_near};
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::spies::new_spy;
    use crate::game::mall::testutil::*;
    use crate::game::mall::types::{BulletOwner, SpyMode};

    const F: i32 = WALKER_FLOOR; // 2F

    fn rig(x: f64) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(F).x(x), false);
        park_cop(&mut r, 1, 60.0, -1);
        calm_janitor(&mut r);
        park_walkers(&mut r, 300.0, 500.0);
        r.run.score = 1000;
        r
    }

    fn standing_spy(r: &mut XRig, x: f64) -> i32 {
        let mut s = new_spy(&mut r.w, x, F, SpyMode::Walk, None);
        s.fire_cd = 99999;
        s.wander_t = 99999;
        s.wander_dir = 0;
        let id = s.id;
        r.w.spies.push(s);
        id
    }

    fn player_bullets(r: &XRig) -> usize {
        r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Player).count()
    }

    #[test]
    fn there_are_two_on_2f_with_different_speeds_and_stretches_clear_of_every_shaft_opening() {
        let r = make_xrig(RigOpts::new(), false);
        assert_eq!(r.x_ref().walkers.walkers.len(), 2);
        assert!(r.x_ref().walkers.walkers.iter().all(|k| k.floor == F));
        assert_ne!(WALKER_DEFS[0].speed, WALKER_DEFS[1].speed);
        assert_ne!(WALKER_DEFS[0].max - WALKER_DEFS[0].min, WALKER_DEFS[1].max - WALKER_DEFS[1].min);
        for d in WALKER_DEFS.iter() {
            let mut x = d.min;
            while x <= d.max {
                assert!(shaft_near(x, F, 7.0).is_none());
                x += 1.0;
            }
        }
    }

    #[test]
    fn they_power_walk_back_and_forth_over_a_long_time_staying_in_their_stretches_and_off_the_shafts() {
        let mut r = make_xrig(RigOpts::new().floor(0).x(100.0), false);
        park_cop(&mut r, 1, 60.0, -1);
        let mut travelled = [0.0f64; 2];
        let mut last: Vec<f64> = r.x_ref().walkers.walkers.iter().map(|k| k.x).collect();
        let mut dirs: Vec<(usize, i32)> = Vec::new();
        for _ in 0..6000 {
            r.hold(0, 1);
            for (i, k) in r.x_ref().walkers.walkers.iter().enumerate() {
                assert!(k.x >= k.min);
                assert!(k.x <= k.max);
                assert!(shaft_near(k.x, F, 6.0).is_none());
                travelled[i] += (k.x - last[i]).abs();
                if !dirs.contains(&(i, k.face)) {
                    dirs.push((i, k.face));
                }
                last[i] = k.x;
            }
        }
        assert!(travelled[0] > 1500.0);
        assert!(travelled[1] > travelled[0]); // the second one is faster
        assert_eq!(dirs.len(), 4); // both turned around at least once
    }

    #[test]
    fn they_block_the_agents_bullets_from_the_left_so_a_spy_behind_them_is_safe() {
        let mut r = rig(250.0);
        let s = standing_spy(&mut r, 340.0);
        r.hold(A, 1);
        let seen = r.hold_watch(0, 40, s);
        assert_ne!(seen.map(|k| k.mode), Some(SpyMode::Dying));
        assert_eq!(player_bullets(&r), 0);
        // control: without the walker the same shot kills the spy
        let mut c = make_xrig(RigOpts::new().floor(F).x(250.0), false);
        park_cop(&mut c, 1, 60.0, -1);
        park_walkers(&mut c, 700.0, 720.0);
        let mut s2 = new_spy(&mut c.w, 340.0, F, SpyMode::Walk, None);
        s2.fire_cd = 99999;
        s2.volley_t = 999;
        let id2 = s2.id;
        c.w.spies.push(s2);
        c.hold(A, 1);
        let seen2 = c.hold_watch(0, 40, id2);
        assert_eq!(seen2.map(|k| k.mode), Some(SpyMode::Dying));
    }

    #[test]
    fn they_block_bullets_from_the_right_too() {
        let mut r = rig(360.0);
        let s = standing_spy(&mut r, 250.0);
        r.w.player.face = -1;
        r.hold(LEFT, 1);
        r.w.player.x = 360.0;
        r.hold(A, 1);
        let seen = r.hold_watch(0, 40, s);
        assert_ne!(seen.map(|k| k.mode), Some(SpyMode::Dying));
        assert_eq!(player_bullets(&r), 0);
    }

    #[test]
    fn they_stop_the_spies_bullets_as_well_at_no_cost_to_the_agent() {
        let mut r = rig(250.0);
        r.run.score = 1000;
        r.w.bullets.push(Bullet { x: 340.0, y: fy(F) - 16.0, vx: -2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.w.bullets.push(Bullet { x: 260.0, y: fy(F) - 16.0, vx: 2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        r.hold(0, 60);
        assert!(r.causes.is_empty());
        assert_eq!(r.w.bullets.len(), 0);
        assert_eq!(r.run.score, 1000);
        assert!(!r.w.bubbles.iter().any(|b| b.text == SHOUTS.walker));
    }

    #[test]
    fn shooting_one_costs_200_points_and_shows_a_hey_bubble_they_never_die() {
        assert_eq!(POINTS.walker_shot, -200);
        let mut r = rig(250.0);
        r.sfx.clear();
        r.hold(A, 1);
        r.hold(0, 40);
        assert_eq!(r.run.score, 800);
        assert!(r.w.bubbles.iter().any(|b| b.text == "HEY!"));
        assert_eq!(r.x_ref().walkers.walkers.len(), 2);
        // keep shooting him: still there, just poorer
        for _ in 0..6 {
            r.hold(A, 20);
            r.hold(0, 20);
        }
        assert_eq!(r.x_ref().walkers.walkers.len(), 2);
        assert!(r.run.score < 800);
        assert!(r.run.score >= 0);
    }

    #[test]
    fn the_score_never_goes_below_zero() {
        let mut r = rig(250.0);
        r.run.score = 100;
        r.hold(A, 1);
        r.hold(0, 40);
        assert_eq!(r.run.score, 0);
    }

    #[test]
    fn touching_one_only_pushes_the_agent_along_nobody_dies() {
        let mut r = make_xrig(RigOpts::new().floor(F).x(470.0), false);
        park_cop(&mut r, 1, 60.0, -1);
        calm_janitor(&mut r);
        {
            let b = &mut r.x().walkers.walkers[1];
            b.x = 500.0;
            b.face = -1; // coming toward the agent
        }
        r.w.player.invuln = 0;
        let x0 = r.w.player.x;
        r.hold(RIGHT, 70);
        assert!(r.w.player.x < x0); // pushed back although he is walking right
        let bx = r.x_ref().walkers.walkers[1].x;
        assert!((r.w.player.x - (bx - 11.0)).abs() < 0.5e-3);
        assert!(r.causes.is_empty());
        assert_eq!(r.w.player.mode, crate::game::mall::types::PlayerMode::Ground);
    }

    #[test]
    fn he_can_get_past_by_jumping_over_a_walker() {
        let mut r = rig(284.0);
        r.hold(RIGHT | B, 1);
        for _ in 0..40 {
            r.hold(RIGHT, 1);
        }
        assert!(r.w.player.x >= 311.0);
    }

    #[test]
    fn they_are_never_in_the_way_on_other_floors() {
        let mut r = make_xrig(RigOpts::new().floor(1).x(300.0), false);
        park_cop(&mut r, 4, 60.0, -1);
        park_walkers(&mut r, 300.0, 500.0);
        r.hold(RIGHT, 20);
        assert_eq!(r.w.player.x, 320.0);
    }
}
