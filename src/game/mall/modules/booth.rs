//! The 3F photo booth. Port of `modules/booth.ts`.

use crate::audio_ids::SfxId;
use crate::content::layout::{FeatureKind, FEATURES};
use crate::engine::pad::{DOWN, LEFT, RIGHT};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

pub const BOOTH_FRAMES: i32 = 300;
pub const BOOTH_W: f64 = 24.0;
/// The photo strip pops up for this long; its 4 frames appear one after the other.
pub const STRIP_FRAMES: i32 = 200;
pub const STRIP_CELLS: i32 = 4;
const REACH: f64 = 12.0;
/// Ignore the exit keys for the first few frames so the Up press that went in cannot also pop him out.
const MIN_INSIDE: i32 = 12;

#[derive(Clone, Copy, Debug)]
pub struct PhotoStrip {
    /// World position of the agent when he came out (the strip pops up above his head).
    pub x: f64,
    pub y: f64,
    /// Frames since it popped up / total.
    pub t: i32,
    pub total: i32,
}

/// The photo booth on 3F: Up hides the agent for up to 5 s; spies ignore him.
pub struct BoothModule {
    /// Left edge and floor of the booth.
    pub x: f64,
    pub floor: i32,
    /// Frames the agent has been inside (0 = nobody inside).
    pub inside: i32,
    pub strip: Option<PhotoStrip>,
}

impl BoothModule {
    pub fn new() -> BoothModule {
        let f = FEATURES.iter().find(|k| k.kind == FeatureKind::Booth).unwrap();
        BoothModule { x: f.x, floor: f.floor, inside: 0, strip: None }
    }

    /// Is somebody in the booth (curtain closed)?
    pub fn occupied(&self) -> bool {
        self.inside > 0
    }

    pub fn interact(&mut self, w: &mut MallWorld, run: &mut Run, dir: i32) -> bool {
        if dir != -1 {
            return false;
        }
        let p = &w.player;
        if p.floor != Some(self.floor) || (p.x - (self.x + BOOTH_W / 2.0)).abs() > REACH {
            return false;
        }
        w.player.x = self.x + BOOTH_W / 2.0;
        w.hide_player(BOOTH_FRAMES);
        self.inside = 1;
        run.sfx(SfxId::Door);
        true
    }

    pub fn step(&mut self, w: &mut MallWorld, run: &mut Run) {
        if let Some(s) = self.strip.as_mut() {
            s.t += 1;
            if s.t >= s.total {
                self.strip = None;
            }
        }
        if self.inside == 0 {
            return;
        }
        if w.player.mode == crate::game::mall::types::PlayerMode::Hidden {
            self.inside += 1;
            if self.inside > MIN_INSIDE && w.pad.held & (DOWN | LEFT | RIGHT) != 0 {
                w.unhide_player();
            }
            if w.player.mode == crate::game::mall::types::PlayerMode::Hidden {
                return;
            }
        }
        // He is out (pressed a key, the 5 s ran out, or the world took him out of the booth)
        let normal = w.player.mode == crate::game::mall::types::PlayerMode::Ground && w.player_alive();
        self.inside = 0;
        if normal && !run.photo_strip {
            run.photo_strip = true;
            run.sfx(SfxId::Camera);
            self.strip = Some(PhotoStrip { x: w.player.x, y: w.player.y, t: 0, total: STRIP_FRAMES });
        }
    }

    pub fn on_respawn(&mut self) {
        self.inside = 0;
        self.strip = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::spies::new_spy;
    use crate::game::mall::testutil::*;
    use crate::game::mall::types::{BulletOwner, PlayerMode, SpyMode};

    fn booth_feature() -> crate::content::layout::Feature {
        *FEATURES.iter().find(|f| f.kind == FeatureKind::Booth).unwrap()
    }

    const FLOOR: i32 = 2; // 3F

    fn rig() -> XRig {
        let booth = booth_feature();
        let mut r = make_xrig(RigOpts::new().floor(FLOOR).x(100.0), false);
        calm_janitor(&mut r);
        park_cop(&mut r, 1, 60.0, -1);
        park_walkers(&mut r, 300.0, 500.0);
        place(&mut r, FLOOR, booth.x + 12.0);
        r
    }

    fn enter(r: &mut XRig) {
        r.tap(UP);
    }

    #[test]
    fn is_on_3f() {
        assert_eq!(booth_feature().floor, 2);
    }

    #[test]
    fn up_hides_the_agent_spies_ignore_him() {
        let booth = booth_feature();
        let mut r = rig();
        enter(&mut r);
        assert_eq!(r.w.player.mode, PlayerMode::Hidden);
        assert!(r.x_ref().booth.occupied());
        assert!(!r.w.player_visible());
        // a spy that would love to shoot him (long past its first-shot delay)
        r.w.next_spy = 1_000_000_000;
        let mut s = new_spy(&mut r.w, booth.x + 90.0, FLOOR, SpyMode::Walk, None);
        s.age = 1000;
        s.fire_cd = 0;
        let id = s.id;
        r.w.spies.push(s);
        for _ in 0..100 {
            r.hold(0, 1);
            assert_ne!(r.w.spy_by_id(id).map(|k| k.mode), Some(SpyMode::Aim));
        }
        assert_eq!(r.w.bullets.iter().filter(|b| b.owner == BulletOwner::Spy).count(), 0);
        assert!(r.causes.is_empty());
    }

    #[test]
    fn he_stays_hidden_for_at_most_5_s() {
        assert_eq!(BOOTH_FRAMES, 300);
        let mut r = rig();
        enter(&mut r);
        let mut frames = 0;
        while r.w.player.mode == PlayerMode::Hidden && frames < 1000 {
            r.hold(0, 1);
            frames += 1;
        }
        assert!(frames <= 300);
        assert!(frames > 290);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert!(!r.x_ref().booth.occupied());
    }

    #[test]
    fn down_left_or_right_gets_him_out_early_up_and_shoot_do_not() {
        for (btn, out) in [(DOWN, true), (LEFT, true), (RIGHT, true), (UP, false), (A, false)] {
            let mut r = rig();
            enter(&mut r);
            r.hold(0, 20);
            assert_eq!(r.w.player.mode, PlayerMode::Hidden);
            r.hold(btn, 3);
            assert_eq!(r.w.player.mode == PlayerMode::Hidden, !out);
        }
    }

    #[test]
    fn the_key_that_went_in_cannot_also_pop_him_straight_back_out() {
        let mut r = rig();
        r.hold(UP | RIGHT, 1);
        r.hold(RIGHT, 3);
        assert_eq!(r.w.player.mode, PlayerMode::Hidden);
        r.hold(RIGHT, 20);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
    }

    #[test]
    fn the_first_time_he_comes_out_each_game_a_4_frame_photo_strip_pops_up_and_joins_the_inventory_never_again() {
        let booth = booth_feature();
        assert_eq!(STRIP_CELLS, 4);
        let mut r = rig();
        assert!(!r.run.photo_strip);
        enter(&mut r);
        r.hold(0, 20);
        r.sfx.clear();
        r.hold(LEFT, 2);
        assert!(r.run.photo_strip);
        assert!(r.run.inventory_line().contains("PHOTO STRIP"));
        assert!(r.sfx_has(SfxId::Camera));
        let strip = r.x_ref().booth.strip.unwrap();
        assert_eq!(strip.total, STRIP_FRAMES);
        r.hold(0, STRIP_FRAMES + 5);
        assert!(r.x_ref().booth.strip.is_none());
        // second visit
        place(&mut r, FLOOR, booth.x + 12.0);
        enter(&mut r);
        r.hold(0, 20);
        r.sfx.clear();
        r.hold(LEFT, 2);
        assert!(r.x_ref().booth.strip.is_none());
        assert!(!r.sfx_has(SfxId::Camera));
        assert_eq!(r.run.inventory.iter().filter(|i| i.as_str() == "PHOTO STRIP").count(), 0);
    }

    #[test]
    fn timing_out_inside_the_booth_also_counts_as_coming_out() {
        let mut r = rig();
        enter(&mut r);
        r.hold(0, 305);
        assert!(r.run.photo_strip);
        assert!(r.x_ref().booth.strip.is_some());
    }

    #[test]
    fn only_works_at_the_booth() {
        let booth = booth_feature();
        let mut r = rig();
        place(&mut r, FLOOR, booth.x + 80.0);
        r.tap(UP);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        place(&mut r, 1, booth.x + 12.0);
        r.tap(UP);
        assert_eq!(r.w.player.mode, PlayerMode::Ground);
        assert!(crate::game::mall::geometry::fy(FLOOR) > 0.0);
    }
}
