//! NPCs, lights and street furniture of the mall, plugged into `MallWorld` (brief 5.6 / 5.7). Port of `modules/index.ts`.
//!
//! `install_extras(w)` creates every module and stores the typed state on `w.extras`; the renderer
//! (`render/mall_actors_view`) only READS this state. Every field is public and mutable so tests can set up a
//! scene directly (put a lamp in `falling`, a patch under the agent, the cop on a floor...).
//!
//! The TS `MallModule` plug-in list (`fx, router, lamps, janitor, walkers, cop, kiosks, booth, fountains`) becomes
//! this concrete struct whose hooks run the modules in exactly that registration order:
//! * `step`: fx, lamps, janitor, walkers, cop, kiosks, booth, fountains (the router has no step),
//! * `interact`: kiosks, booth,
//! * `on_bullet`: the shot router (lamps, walkers, cop, fountains; nearest candidate wins, first registered on ties),
//! * `on_respawn`: fx, lamps, janitor, cop, kiosks, booth.

pub mod booth;
pub mod cop;
pub mod fountains;
pub mod fx;
pub mod janitor;
pub mod kiosks;
pub mod lamps;
pub mod testrig;
pub mod util;
pub mod walkers;

use self::booth::BoothModule;
use self::cop::CopModule;
use self::fountains::FountainsModule;
use self::fx::{FxModule, ShotCandidate, ShotHit};
use self::janitor::JanitorModule;
use self::kiosks::KiosksModule;
use self::lamps::LampsModule;
use self::walkers::WalkersModule;
use super::types::Bullet;
use super::world::MallWorld;
use crate::game::run::Run;

pub struct MallExtras {
    pub installed: bool,
    /// Short cosmetic effects: bullet sparks and glass bursts (`fx.items`).
    pub fx: FxModule,
    /// Hanging lamps and 2F disco balls (`lamps.lamps`) and the darkened corridor sections (`lamps.dark`).
    pub lamps: LampsModule,
    /// The janitor on 1F (`janitor.janitor`) and the current wet patch (`janitor.patch`, None when dry).
    pub janitor: JanitorModule,
    /// The two mall walkers on 2F (`walkers.walkers`).
    pub walkers: WalkersModule,
    /// The mall cop (`cop.cop`).
    pub cop: CopModule,
    /// Directory kiosks (`kiosks.kiosks`) and the map panel being shown (`kiosks.panel`).
    pub kiosks: KiosksModule,
    /// The 3F photo booth (`booth.occupied()`) and the photo strip popup (`booth.strip`).
    pub booth: BoothModule,
    /// The fountains (`fountains.fountains`).
    pub fountains: FountainsModule,
}

/// Create the extras on the world (idempotent: a second call returns the same, untouched extras).
pub fn install_extras(w: &mut MallWorld) -> &mut MallExtras {
    if w.extras.is_none() {
        let fx = FxModule::new();
        let lamps = LampsModule::new();
        let janitor = JanitorModule::new(w);
        let walkers = WalkersModule::new(w);
        let cop = CopModule::new(w);
        let kiosks = KiosksModule::new();
        let booth = BoothModule::new();
        let fountains = FountainsModule::new(w);
        w.extras = Some(Box::new(MallExtras { installed: true, fx, lamps, janitor, walkers, cop, kiosks, booth, fountains }));
    }
    w.extras.as_mut().unwrap()
}

impl MallExtras {
    /// Runs once per frame after the player, cars and spies have moved. Order matters only for state that reads the
    /// same frame's results: shots are routed first (during the bullet step), then the world's NPCs.
    pub fn step(&mut self, w: &mut MallWorld, run: &mut Run) {
        self.fx.step();
        self.lamps.step(w, run, &mut self.fx);
        self.janitor.step(w, run);
        self.walkers.step(w);
        self.cop.step(w, run);
        self.kiosks.step();
        self.booth.step(w, run);
        self.fountains.step();
    }

    /// The player pressed Up (-1) or Down (+1) while standing on a floor; true if handled (kiosk, photo booth).
    pub fn interact(&mut self, w: &mut MallWorld, run: &mut Run, dir: i32) -> bool {
        if self.kiosks.interact(w, run, dir) {
            return true;
        }
        self.booth.interact(w, run, dir)
    }

    /// Called for every live bullet before it moves; true consumes it (blocked / absorbed).
    pub fn on_bullet(&mut self, w: &mut MallWorld, run: &mut Run, b: &Bullet) -> bool {
        let mut best: Option<ShotCandidate> = None;
        for c in [self.lamps.shot_candidate(b), self.walkers.shot_candidate(b), self.cop.shot_candidate(b), self.fountains.shot_candidate(b)] {
            if let Some(c) = c {
                if best.map_or(true, |bb| c.dist < bb.dist) {
                    best = Some(c);
                }
            }
        }
        let c = match best {
            Some(c) => c,
            None => return false,
        };
        match c.hit {
            ShotHit::Lamp { index, dir } => self.lamps.release(run, index, dir),
            ShotHit::Walker { index } => self.walkers.resolve_hit(w, run, &mut self.fx, index, c.dist, b),
            ShotHit::Cop => self.cop.resolve_hit(w, run, &mut self.fx, c.dist, b),
            ShotHit::Fountain { index } => self.fountains.spray_coins(w, run, index),
        }
        true
    }

    /// The world respawned the player: clear temporary effects (frozen, darkness...).
    pub fn on_respawn(&mut self, w: &mut MallWorld) {
        self.fx.on_respawn();
        self.lamps.on_respawn();
        self.janitor.on_respawn(w);
        self.cop.on_respawn(w);
        self.kiosks.on_respawn();
        self.booth.on_respawn();
    }
}

#[cfg(test)]
mod tests {
    use super::testrig::*;
    use super::*;
    use crate::content::layout::{FeatureKind, FEATURES, LEVEL_W};
    use crate::engine::pad::*;
    use crate::engine::rng::Rng;
    use crate::game::mall::geometry::fy;
    use crate::game::mall::testutil::*;
    use crate::game::mall::types::PlayerMode;

    const BUTTONS: [u32; 13] = [0, LEFT, RIGHT, UP, DOWN, A, B, LEFT | B, RIGHT | B, RIGHT | A, LEFT | A, UP | A, DOWN | A];

    /// A compact, comparable picture of everything the extras expose.
    fn snapshot(r: &XRig) -> String {
        let x = r.x_ref();
        format!(
            "{:?}",
            (
                r.w.frame,
                r.run.score,
                r.run.lives,
                (r.w.player.x, r.w.player.y, r.w.player.mode.as_str(), r.w.player.slide, r.w.player.frozen),
                x.lamps.lamps.iter().map(|l| (l.mode.as_str(), l.x, l.y)).collect::<Vec<_>>(),
                &x.lamps.dark,
                x.janitor.janitor,
                x.janitor.patch,
                (
                    &x.walkers.walkers,
                    x.cop.cop,
                    &x.kiosks.kiosks,
                    x.kiosks.panel,
                    x.booth.inside,
                    x.booth.strip,
                    &x.fountains.fountains,
                    &x.fx.items,
                    r.w.pickups.iter().map(|k| (k.kind.as_str(), k.x, k.y)).collect::<Vec<_>>(),
                ),
            )
        )
    }

    fn fuzz(seed: u32, frames: i32) -> XRig {
        let mut r = make_xrig(RigOpts::new().seed(seed).floor(1).x(200.0), true);
        r.run.lives = 9999;
        let mut rng = Rng::new(seed.wrapping_mul(7919));
        let mut spots: Vec<(i32, f64)> = Vec::new();
        for f in FEATURES.iter() {
            if f.kind == FeatureKind::Kiosk || f.kind == FeatureKind::Booth || f.kind == FeatureKind::Fountain {
                spots.push((f.floor, f.x + f.w / 2.0 + rng.between(-30, 30) as f64));
            }
        }
        for i in 0..frames {
            if i % 400 == 0 && r.w.player.mode == PlayerMode::Ground {
                let (fl, px) = *rng.pick(&spots);
                place(&mut r, fl, px);
            }
            let held = if i % 20 == 0 { *rng.pick(&BUTTONS) } else { r.held };
            r.hold(held, 1);
        }
        r
    }

    #[test]
    fn registers_every_module_once_is_idempotent_and_exposes_the_typed_state() {
        let mut r = make_rig(RigOpts::new());
        assert!(r.w.extras.is_none());
        {
            let x = install_extras(&mut r.w);
            assert!(x.installed);
            assert_eq!(x.lamps.lamps.len(), 13);
            assert_eq!(x.walkers.walkers.len(), 2);
            assert_eq!(x.kiosks.kiosks.len(), 4);
            assert_eq!(x.fountains.fountains.len(), 2);
            assert_eq!(x.cop.cop.mode, cop::CopMode::Patrol);
            assert_eq!(x.janitor.janitor.floor, 4);
            x.cop.cop.pause_t = 4242; // marker: a second install must not rebuild the extras
        }
        assert!(r.w.extras.is_some());
        assert_eq!(install_extras(&mut r.w).cop.cop.pause_t, 4242);
    }

    #[test]
    fn is_deterministic_same_seed_and_inputs_give_the_same_extras_different_seeds_differ() {
        let a = snapshot(&fuzz(5, 3000));
        let b = snapshot(&fuzz(5, 3000));
        assert_eq!(a, b);
        assert_ne!(snapshot(&fuzz(6, 3000)), a);
    }

    #[test]
    fn uses_its_own_random_streams_the_spies_behave_exactly_as_without_the_extras() {
        let run = |with_extras: bool| -> String {
            let opts = RigOpts::new().seed(42).floor(1).x(300.0);
            let mut r: Rig = if with_extras { make_xrig(opts, true).rig } else { make_rig(opts) };
            r.w.player.invuln = 99999;
            for f in 0..2000 {
                r.hold(if f % 90 < 45 { RIGHT } else { LEFT }, 1);
                r.w.bullets.clear();
            }
            let spies: Vec<(i32, i32, &str)> = r.w.spies.iter().map(|s| (s.id, crate::engine::num::round_i(s.x), s.mode.as_str())).collect();
            format!("{:?}", (r.w.player.x, spies, r.w.cars.iter().map(|c| c.y).collect::<Vec<f64>>()))
        };
        // The cop / janitor / walkers live on other floors than floor 1 only by chance, but none of them touches spies.
        assert_eq!(run(true), run(false));
    }

    #[test]
    fn survives_long_random_play_near_every_gadget_no_nan_nobody_leaves_the_mall_slides_and_freezes_always_end() {
        for seed in [1u32, 2, 3] {
            let mut r = make_xrig(RigOpts::new().seed(seed).floor(1).x(200.0), true);
            r.run.lives = 9999;
            let mut rng = Rng::new(seed.wrapping_mul(104729));
            let mut spots: Vec<(i32, f64)> = Vec::new();
            for f in FEATURES.iter() {
                if f.kind == FeatureKind::Kiosk || f.kind == FeatureKind::Booth || f.kind == FeatureKind::Fountain {
                    spots.push((f.floor, f.x + f.w / 2.0 + rng.between(-30, 30) as f64));
                }
            }
            spots.push((4, 250.0));
            let mut slide_frames = 0;
            let mut freeze_max = 0;
            for i in 0..20000 {
                if i % 300 == 0 && r.w.player.mode == PlayerMode::Ground {
                    let (fl, px) = *rng.pick(&spots);
                    place(&mut r, fl, px);
                    if fl == 4 && i % 600 == 0 {
                        r.x().janitor.patch = Some(janitor::WetPatch { x: 250.0, t: 600 });
                    }
                }
                let held = if i % 15 == 0 { *rng.pick(&BUTTONS) } else { r.held };
                r.hold(held, 1);
                let p = &r.w.player;
                assert!(p.x.is_finite() && p.y.is_finite());
                assert!(p.x > 0.0);
                assert!(p.x < LEVEL_W);
                freeze_max = freeze_max.max(p.frozen);
                if p.mode == PlayerMode::Ground && p.slide != 0 {
                    slide_frames += 1;
                    assert!(r.x_ref().janitor.patch.is_some());
                    assert!(r.x_ref().janitor.on_patch(p.x));
                }
                for k in r.x_ref().walkers.walkers.iter() {
                    assert!(k.x.is_finite());
                }
                assert!(r.x_ref().cop.cop.x.is_finite());
                assert!(r.x_ref().janitor.janitor.x.is_finite());
                for l in r.x_ref().lamps.lamps.iter() {
                    assert!(l.x.is_finite() && l.y.is_finite());
                }
                for k in r.w.pickups.iter() {
                    assert!(k.x.is_finite() && k.y.is_finite());
                }
            }
            assert!(freeze_max <= 180);
            assert!(slide_frames > 0);
            assert_eq!(fy(1), 160.0);
        }
    }
}
