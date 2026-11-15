//! Directory kiosks. Port of `modules/kiosks.ts`.

use crate::audio_ids::SfxId;
use crate::content::layout::{FeatureKind, FEATURES};
use crate::content::stores::{StoreId, DOOR_W, DOOR_X, STORES};
use crate::game::levelstate::{store_status, StoreStatus};
use crate::game::mall::world::MallWorld;
use crate::game::run::Run;

/// The directory map stays up about 4 s; each kiosk then needs about 20 s to cool down.
pub const PANEL_FRAMES: i32 = 240;
pub const KIOSK_COOLDOWN: i32 = 1200;
pub const KIOSK_W: f64 = 24.0;
/// The agent may stand this far from the kiosk's centre to use it.
const REACH: f64 = 14.0;

#[derive(Clone, Copy, Debug)]
pub struct Kiosk {
    pub floor: i32,
    /// Left edge.
    pub x: f64,
    /// Frame (w.frame) at which it can be used again.
    pub ready_at: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct KioskPanel {
    /// Index into `kiosks`.
    pub kiosk: usize,
    /// The nearest store that still holds a package, or None when all six are found.
    pub target: Option<StoreId>,
    /// Frames left / total.
    pub t: i32,
    pub total: i32,
}

/// The store with a package left that is nearest to a kiosk: fewest floors away first, then nearest in x.
pub fn nearest_package_store(run: &Run, floor: i32, cx: f64) -> Option<StoreId> {
    let mut best: Option<(StoreId, i32, f64)> = None;
    for s in STORES.iter() {
        if store_status(&run.level, s.id) != StoreStatus::Package {
            continue;
        }
        let df = (s.floor - floor).abs();
        let dx = (s.x + DOOR_X + DOOR_W / 2.0 - cx).abs();
        if best.map_or(true, |b| df < b.1 || (df == b.1 && dx < b.2)) {
            best = Some((s.id, df, dx));
        }
    }
    best.map(|b| b.0)
}

/// Directory kiosks (one per shopping floor): Up shows the nearest remaining package store.
pub struct KiosksModule {
    pub kiosks: Vec<Kiosk>,
    pub panel: Option<KioskPanel>,
}

impl KiosksModule {
    pub fn new() -> KiosksModule {
        let mut kiosks = Vec::new();
        for f in FEATURES.iter() {
            if f.kind == FeatureKind::Kiosk {
                kiosks.push(Kiosk { floor: f.floor, x: f.x, ready_at: 0 });
            }
        }
        KiosksModule { kiosks, panel: None }
    }

    /// Is the kiosk's screen on (somebody just used it)?
    pub fn screen_on(&self, index: usize) -> bool {
        self.panel.map_or(false, |p| p.kiosk == index)
    }

    pub fn step(&mut self) {
        if let Some(p) = self.panel.as_mut() {
            p.t -= 1;
            if p.t <= 0 {
                self.panel = None;
            }
        }
    }

    pub fn interact(&mut self, w: &mut MallWorld, run: &mut Run, dir: i32) -> bool {
        if dir != -1 {
            return false;
        }
        let p = &w.player;
        let floor = match p.floor {
            Some(f) => f,
            None => return false,
        };
        let i = match self.kiosks.iter().position(|k| k.floor == floor && (p.x - (k.x + KIOSK_W / 2.0)).abs() <= REACH) {
            Some(i) => i,
            None => return false,
        };
        let k = self.kiosks[i];
        if w.frame < k.ready_at {
            run.sfx(SfxId::Buzzer);
            return true;
        }
        self.kiosks[i].ready_at = w.frame + PANEL_FRAMES + KIOSK_COOLDOWN;
        self.panel = Some(KioskPanel { kiosk: i, target: nearest_package_store(run, k.floor, k.x + KIOSK_W / 2.0), t: PANEL_FRAMES, total: PANEL_FRAMES });
        run.sfx(SfxId::Select);
        true
    }

    pub fn on_respawn(&mut self) {
        self.panel = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::mall::modules::testrig::*;
    use crate::game::mall::testutil::*;

    fn kiosk_feature(floor: i32) -> crate::content::layout::Feature {
        *FEATURES.iter().find(|f| f.kind == FeatureKind::Kiosk && f.floor == floor).unwrap()
    }

    fn rig(floor: i32) -> XRig {
        let mut r = make_xrig(RigOpts::new().floor(floor).x(100.0), false);
        calm_janitor(&mut r);
        park_cop(&mut r, if floor == 1 { 4 } else { 1 }, 60.0, -1);
        park_walkers(&mut r, 300.0, 500.0);
        let k = kiosk_feature(floor);
        place(&mut r, floor, k.x + 12.0);
        r
    }

    fn set_taken(r: &mut XRig, id: StoreId) {
        r.run.level.store_mut(id).unwrap().package_taken = true;
    }

    fn ready_at(r: &XRig, floor: i32) -> i32 {
        r.x_ref().kiosks.kiosks.iter().find(|q| q.floor == floor).unwrap().ready_at
    }

    #[test]
    fn there_is_one_on_each_shopping_floor() {
        let r = make_xrig(RigOpts::new(), false);
        let mut floors: Vec<i32> = r.x_ref().kiosks.kiosks.iter().map(|k| k.floor).collect();
        floors.sort();
        assert_eq!(floors, vec![1, 2, 3, 4]);
    }

    #[test]
    fn up_at_a_kiosk_shows_a_map_panel_for_about_4_s_highlighting_the_nearest_remaining_package_store() {
        let mut r = rig(2); // 3F, x = 650: its own floor has KGB Toys
        r.tap(UP);
        let panel = r.x_ref().kiosks.panel.unwrap();
        assert_eq!(panel.target, Some(StoreId::Kgbtoys));
        assert_eq!(panel.total, PANEL_FRAMES);
        assert_eq!(PANEL_FRAMES, 240);
        let idx = r.x_ref().kiosks.kiosks.iter().position(|k| k.floor == 2).unwrap();
        assert!(r.x_ref().kiosks.screen_on(idx));
        r.hold(0, PANEL_FRAMES - 5);
        assert!(r.x_ref().kiosks.panel.is_some());
        r.hold(0, 10);
        assert!(r.x_ref().kiosks.panel.is_none());
    }

    #[test]
    fn nearest_is_by_floors_away_first_then_by_distance_along_the_floor_cleared_stores_are_skipped() {
        let mut r = rig(2);
        let cx = kiosk_feature(2).x + 12.0;
        assert_eq!(nearest_package_store(&r.run, 2, cx), Some(StoreId::Kgbtoys));
        set_taken(&mut r, StoreId::Kgbtoys);
        // one floor up (4F: forever12, radioshock) or down (2F: sambaddy, hotspy): hot spy's door is the closest in x
        assert_eq!(nearest_package_store(&r.run, 2, cx), Some(StoreId::Hotspy));
        set_taken(&mut r, StoreId::Hotspy);
        assert_eq!(nearest_package_store(&r.run, 2, cx), Some(StoreId::Radioshock));
        set_taken(&mut r, StoreId::Radioshock);
        let n = nearest_package_store(&r.run, 2, cx);
        assert!([Some(StoreId::Forever12), Some(StoreId::Sambaddy)].contains(&n));
        set_taken(&mut r, StoreId::Forever12);
        set_taken(&mut r, StoreId::Sambaddy);
        assert_eq!(nearest_package_store(&r.run, 2, cx), Some(StoreId::Footlock)); // two floors away
        set_taken(&mut r, StoreId::Footlock);
        assert_eq!(nearest_package_store(&r.run, 2, cx), None);
        // the real panel shows "nothing left" too
        r.tap(UP);
        assert_eq!(r.x_ref().kiosks.panel.unwrap().target, None);
    }

    #[test]
    fn from_the_1f_kiosk_the_nearest_package_is_foot_lockpicker_on_the_same_floor() {
        let mut r = rig(4);
        r.tap(UP);
        assert_eq!(r.x_ref().kiosks.panel.unwrap().target, Some(StoreId::Footlock));
    }

    #[test]
    fn after_the_panel_the_kiosk_needs_20_s_a_second_use_does_nothing_but_a_buzzer() {
        assert_eq!(KIOSK_COOLDOWN, 1200);
        let mut r = rig(2);
        r.tap(UP);
        r.hold(0, PANEL_FRAMES + 10);
        assert!(r.x_ref().kiosks.panel.is_none());
        r.sfx.clear();
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_none());
        assert!(r.sfx_has(SfxId::Buzzer));
        // just before the cooldown ends: still a buzzer
        let n = ready_at(&r, 2) - r.w.frame - 2;
        r.hold(0, n);
        r.sfx.clear();
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_none());
        assert!(r.sfx_has(SfxId::Buzzer));
        // ready again
        r.hold(0, 4);
        r.sfx.clear();
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_some());
        assert!(!r.sfx_has(SfxId::Buzzer));
        assert!(ready_at(&r, 2) - r.w.frame > PANEL_FRAMES + KIOSK_COOLDOWN - 5);
    }

    #[test]
    fn each_kiosk_has_its_own_cooldown_down_and_standing_away_from_it_do_nothing() {
        let mut r = rig(2);
        r.tap(DOWN);
        assert!(r.x_ref().kiosks.panel.is_none());
        place(&mut r, 2, 600.0 - 40.0);
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_none());
        place(&mut r, 2, kiosk_feature(2).x + 12.0);
        r.tap(UP);
        assert!(r.x_ref().kiosks.panel.is_some());
        // another floor's kiosk is untouched
        assert_eq!(ready_at(&r, 1), 0);
    }
}
