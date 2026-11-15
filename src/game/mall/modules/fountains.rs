//! The mall fountains. Port of `modules/fountains.ts`.

use super::fx::{ShotCandidate, ShotHit};
use super::util::sweep_dist;
use crate::audio_ids::SfxId;
use crate::content::layout::{FeatureKind, FEATURES};
use crate::engine::rng::Rng;
use crate::game::mall::geometry::fy;
use crate::game::mall::types::{Bullet, BulletOwner, Pickup, PickupKind};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

pub const FOUNTAIN_H: f64 = 24.0;
pub const FOUNTAIN_COOLDOWN: i32 = 900;
/// One spray in twenty includes a gold coin (an extra life).
pub const GOLD_CHANCE: f64 = 1.0 / 20.0;
pub const COIN_LIFE: i32 = 60 * 12;
/// Frames the water jet animation shows after a spray.
pub const SPRAY_FRAMES: i32 = 40;

#[derive(Clone, Copy, Debug)]
pub struct Fountain {
    pub floor: i32,
    /// Left edge and width.
    pub x: f64,
    pub w: f64,
    /// Frames of cool-down left (0 = ready).
    pub cool: i32,
    /// Frames of spray animation left.
    pub spray: i32,
}

/// The mall fountains (3F, 1F): a player shot sprays 3 to 5 bouncing coins, then it cools down for about 15 s.
pub struct FountainsModule {
    pub fountains: Vec<Fountain>,
    rng: Rng,
}

impl FountainsModule {
    pub fn new(w: &MallWorld) -> FountainsModule {
        let rng = w.rng.fork("fountains");
        let mut fountains = Vec::new();
        for f in FEATURES.iter() {
            if f.kind == FeatureKind::Fountain {
                fountains.push(Fountain { floor: f.floor, x: f.x, w: f.w, cool: 0, spray: 0 });
            }
        }
        FountainsModule { fountains, rng }
    }

    pub fn shot_candidate(&self, b: &Bullet) -> Option<ShotCandidate> {
        if b.owner != BulletOwner::Player {
            return None;
        }
        let mut best: Option<usize> = None;
        let mut best_d = f64::INFINITY;
        for (i, f) in self.fountains.iter().enumerate() {
            if f.cool > 0 {
                continue; // while cooling, bullets pass through the (dry) basin
            }
            let fyv = fy(f.floor);
            if b.y < fyv - FOUNTAIN_H || b.y > fyv {
                continue;
            }
            if let Some(d) = sweep_dist(b, f.x, f.x + f.w) {
                if d < best_d {
                    best_d = d;
                    best = Some(i);
                }
            }
        }
        best.map(|index| ShotCandidate { dist: best_d, hit: ShotHit::Fountain { index } })
    }

    /// 3 to 5 coins worth 50 each fly out of the basin; one spray in twenty includes a gold coin (extra life).
    pub fn spray_coins(&mut self, w: &mut MallWorld, run: &mut Run, index: usize) {
        let f = self.fountains[index];
        let n = self.rng.between(3, 5);
        let gold = if self.rng.chance(GOLD_CHANCE) { self.rng.int(n) } else { -1 };
        let cx = f.x + f.w / 2.0;
        let fyv = fy(f.floor);
        for i in 0..n {
            // Fan the coins out evenly with a little jitter. The arc is low on purpose: the ceiling is only 40 px above the
            // floor and the core's pickup physics would land a coin that rose past the slab on the floor above.
            let t = if n == 1 { 0.0 } else { i as f64 / (n - 1) as f64 - 0.5 };
            let vx = t * 2.4 + self.rng.range(-0.3, 0.3);
            let vy = -self.rng.range(1.7, 2.3);
            w.spawn_pickup(Pickup {
                x: cx + t * 8.0,
                y: fyv - FOUNTAIN_H,
                kind: if i == gold { PickupKind::Goldcoin } else { PickupKind::Coin },
                power: None,
                vx,
                vy,
                on_ground: false,
                life: COIN_LIFE,
            });
        }
        self.fountains[index].cool = FOUNTAIN_COOLDOWN;
        self.fountains[index].spray = SPRAY_FRAMES;
        run.sfx(SfxId::Splash);
    }

    pub fn step(&mut self) {
        for f in self.fountains.iter_mut() {
            if f.cool > 0 {
                f.cool -= 1;
            }
            if f.spray > 0 {
                f.spray -= 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::num::round_i;
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::testutil::*;

    fn f3() -> crate::content::layout::Feature {
        *FEATURES.iter().find(|f| f.kind == FeatureKind::Fountain && f.floor == 2).unwrap() // 3F x 312
    }
    fn f1() -> crate::content::layout::Feature {
        *FEATURES.iter().find(|f| f.kind == FeatureKind::Fountain && f.floor == 4).unwrap() // 1F x 330
    }

    fn rig(floor: i32, x: f64) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(floor).x(x), false);
        calm_janitor(&mut r);
        park_cop(&mut r, if floor == 1 { 4 } else { 1 }, 60.0, -1);
        park_walkers(&mut r, 700.0, 740.0);
        place(&mut r, floor, x);
        r
    }

    /// Fire one standing shot to the left (from the right of the basin: the lamps hang to its left) and let it fly.
    fn shoot_fountain(r: &mut XRig) {
        r.w.player.shoot_cd = 0;
        r.w.player.face = -1;
        r.hold(A, 1);
        r.hold(0, 14);
    }

    fn cool(r: &XRig, i: usize) -> i32 {
        r.x_ref().fountains.fountains[i].cool
    }

    fn spray(r: &mut XRig, i: usize) {
        r.with_x(|ex, w, run| ex.fountains.spray_coins(w, run, i));
    }

    #[test]
    fn there_are_two_on_3f_and_1f() {
        let r = make_xrig(RigOpts::new(), false);
        let fl: Vec<i32> = r.x_ref().fountains.fountains.iter().map(|f| f.floor).collect();
        assert_eq!(fl, vec![2, 4]);
    }

    #[test]
    fn a_shot_sprays_3_to_5_coins_worth_50_each_upward_and_sideways_with_a_splash() {
        let mut counts: Vec<usize> = Vec::new();
        for seed in 1..=40u32 {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(2).x(380.0), false);
            park_cop(&mut r, 1, 60.0, -1);
            park_walkers(&mut r, 700.0, 740.0);
            place(&mut r, 2, 380.0);
            r.sfx.clear();
            r.run.score = 0;
            shoot_fountain(&mut r);
            let coins: Vec<&Pickup> = r.w.pickups.iter().filter(|k| k.kind == PickupKind::Coin || k.kind == PickupKind::Goldcoin).collect();
            assert!(coins.len() >= 3);
            assert!(coins.len() <= 5);
            if !counts.contains(&coins.len()) {
                counts.push(coins.len());
            }
            assert!(r.sfx_has(SfxId::Splash));
            assert_eq!(r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Player).count(), 0); // the shot was swallowed
            let mut vxs: Vec<i32> = Vec::new();
            for k in coins.iter() {
                let v = round_i(k.vx * 10.0);
                if !vxs.contains(&v) {
                    vxs.push(v);
                }
            }
            assert!(vxs.len() > 1); // sideways spread
        }
        counts.sort();
        assert_eq!(counts, vec![3, 4, 5]);
    }

    #[test]
    fn coins_leave_the_basin_moving_upward_and_sideways() {
        let mut r = rig(2, 380.0);
        spray(&mut r, 0);
        let coins = &r.w.pickups;
        assert!(coins.len() >= 3);
        assert!(coins.iter().all(|k| k.vy < 0.0 && !k.on_ground));
        assert!(coins.iter().map(|k| k.vx).fold(f64::NEG_INFINITY, f64::max) > 0.5);
        assert!(coins.iter().map(|k| k.vx).fold(f64::INFINITY, f64::min) < -0.5);
    }

    #[test]
    fn the_coins_fly_up_bounce_on_the_floor_and_are_worth_50_each_when_picked_up() {
        let mut r = rig(2, 380.0);
        r.run.score = 0;
        shoot_fountain(&mut r);
        let n = r.w.pickups.iter().filter(|k| k.kind != PickupKind::Power).count();
        assert!(n >= 3);
        // the arc stays below the 40 px ceiling
        let mut top = f64::INFINITY;
        for _ in 0..60 {
            r.hold(0, 1);
            for k in r.w.pickups.iter() {
                top = top.min(k.y);
            }
        }
        assert!(top > fy(2) - 32.0);
        r.hold(0, 60);
        assert!(r.sfx_has(SfxId::Bounce)); // the core bounces coins
        // walk through them: each is worth 50 (a gold coin is a life instead)
        let gold = r.w.pickups.iter().filter(|k| k.kind == PickupKind::Goldcoin).count();
        let xs: Vec<f64> = r.w.pickups.iter().map(|k| k.x).collect();
        for x in xs {
            place(&mut r, 2, x);
            r.hold(0, 1);
        }
        assert_eq!(r.w.pickups.len(), 0);
        assert_eq!(r.run.score, 50 * (n - gold) as i32);
        assert!(n >= 3);
    }

    #[test]
    fn then_it_cools_down_for_15_s_shots_pass_through_until_it_is_ready_again() {
        assert_eq!(FOUNTAIN_COOLDOWN, 900);
        let mut r = rig(2, 380.0);
        shoot_fountain(&mut r);
        assert!(cool(&r, 0) > FOUNTAIN_COOLDOWN - 20);
        r.w.pickups.clear();
        r.hold(0, 400);
        // a shot while it cools passes through the basin and flies on
        r.w.player.shoot_cd = 0;
        r.hold(A, 1);
        r.hold(0, 4);
        assert_eq!(r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Player).count(), 1);
        r.hold(0, 40);
        assert_eq!(r.w.pickups.len(), 0);
        // still cooling shortly before the end
        let n = cool(&r, 0) - 30;
        r.hold(0, n);
        assert!(cool(&r, 0) > 0);
        r.w.player.shoot_cd = 0;
        r.w.bullets.clear();
        r.hold(A, 1);
        r.hold(0, 14);
        assert_eq!(r.w.pickups.len(), 0);
        // ready again after 900 frames
        r.hold(0, 30);
        assert_eq!(cool(&r, 0), 0);
        shoot_fountain(&mut r);
        assert!(r.w.pickups.len() >= 3);
    }

    #[test]
    fn the_two_fountains_cool_down_separately_the_1f_one_works_too() {
        let mut r = rig(2, 380.0);
        shoot_fountain(&mut r);
        assert!(cool(&r, 0) > 0);
        assert_eq!(cool(&r, 1), 0);
        let mut q = rig(4, 381.0);
        shoot_fountain(&mut q);
        assert!(cool(&q, 1) > 0);
        assert!(q.w.pickups.len() >= 3);
        assert!(f3().x < f1().x + 100.0);
    }

    #[test]
    fn a_ducking_shot_hits_the_basin_too_a_spys_bullet_does_not() {
        let mut r = rig(2, 380.0);
        r.w.bullets.push(Bullet { x: f3().x + 70.0, y: fy(2) - 8.0, vx: -4.0, vy: 0.0, owner: BulletOwner::Player, age: 0 });
        r.hold(0, 8);
        assert!(r.w.pickups.len() >= 3);
        let mut q = rig(2, 380.0);
        q.w.bullets.push(Bullet { x: f3().x + 70.0, y: fy(2) - 8.0, vx: -2.0, vy: 0.0, owner: BulletOwner::Spy, age: 0 });
        q.hold(0, 30);
        assert_eq!(q.w.pickups.len(), 0);
        assert_eq!(cool(&q, 0), 0);
    }

    #[test]
    fn one_spray_in_twenty_includes_a_gold_coin_extra_life() {
        assert_eq!(GOLD_CHANCE, 1.0 / 20.0);
        let mut r = rig(2, 380.0);
        let mut sprays = 0;
        let mut with_gold = 0;
        let mut gold_coins = 0;
        for _ in 0..3000 {
            r.w.pickups.clear();
            r.x().fountains.fountains[0].cool = 0;
            spray(&mut r, 0);
            sprays += 1;
            let g = r.w.pickups.iter().filter(|k| k.kind == PickupKind::Goldcoin).count();
            gold_coins += g;
            if g > 0 {
                with_gold += 1;
            }
            assert!(g <= 1);
        }
        let rate = with_gold as f64 / sprays as f64;
        assert!(rate > 0.035);
        assert!(rate < 0.068);
        assert_eq!(gold_coins, with_gold);
    }

    #[test]
    fn across_many_seeds_the_first_spray_is_gold_about_1_time_in_20() {
        let mut gold = 0;
        let n = 800;
        for seed in 1..=n as u32 {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(2).x(380.0), false);
            park_cop(&mut r, 1, 60.0, -1);
            park_walkers(&mut r, 700.0, 740.0);
            place(&mut r, 2, 380.0);
            shoot_fountain(&mut r);
            if r.w.pickups.iter().any(|k| k.kind == PickupKind::Goldcoin) {
                gold += 1;
            }
        }
        assert!(gold as f64 / n as f64 > 0.02);
        assert!((gold as f64 / n as f64) < 0.09);
    }

    #[test]
    fn a_gold_coin_gives_an_extra_life() {
        let mut r = rig(2, 380.0);
        for _ in 0..400 {
            r.w.pickups.clear();
            r.x().fountains.fountains[0].cool = 0;
            spray(&mut r, 0);
            if r.w.pickups.iter().any(|k| k.kind == PickupKind::Goldcoin) {
                break;
            }
        }
        let gi = r.w.pickups.iter().position(|k| k.kind == PickupKind::Goldcoin).expect("a gold coin");
        let lives = r.run.lives;
        {
            let gold = &mut r.w.pickups[gi];
            gold.on_ground = true;
            gold.y = fy(2);
            gold.vx = 0.0;
            gold.vy = 0.0;
        }
        let gx = r.w.pickups[gi].x;
        place(&mut r, 2, gx);
        r.hold(0, 2);
        assert_eq!(r.run.lives, lives + 1);
    }
}
