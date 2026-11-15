//! A mall rig with the extras installed. Port of `modules/testrig.ts`.

use super::cop::CopMode;
use super::install_extras;
use super::MallExtras;
use crate::game::mall::testutil::{make_rig, Rig, RigOpts};

/// A `Rig` with `install_extras` applied. Spies are off by default so a scenario only sees what it sets up.
/// (TS: `XRig extends Rig { x }`; here the extras live at `rig.w.extras`, use `x()` / `x_ref()`.)
pub struct XRig {
    pub rig: Rig,
}

impl std::ops::Deref for XRig {
    type Target = Rig;
    fn deref(&self) -> &Rig {
        &self.rig
    }
}

impl std::ops::DerefMut for XRig {
    fn deref_mut(&mut self) -> &mut Rig {
        &mut self.rig
    }
}

impl XRig {
    /// The installed extras (TS `r.x`).
    pub fn x(&mut self) -> &mut MallExtras {
        self.rig.w.extras.as_mut().unwrap()
    }

    pub fn x_ref(&self) -> &MallExtras {
        self.rig.w.extras.as_ref().unwrap()
    }

    /// Run `f` with the extras and the world and the run borrowed at the same time.
    pub fn with_x<R>(&mut self, f: impl FnOnce(&mut MallExtras, &mut crate::game::mall::world::MallWorld, &mut crate::game::run::Run) -> R) -> R {
        let rig = &mut self.rig;
        let mut ex = rig.w.extras.take().unwrap();
        let r = f(&mut ex, &mut rig.w, &mut rig.run);
        rig.w.extras = Some(ex);
        r
    }
}

/// `spies`: let the mall spawn spies (TS `spies: true`).
pub fn make_xrig(opts: RigOpts, spies: bool) -> XRig {
    let mut rig = make_rig(opts);
    install_extras(&mut rig.w);
    if !spies {
        rig.w.next_spy = 1_000_000_000;
    }
    XRig { rig }
}

/// Park the cop on a floor at x, facing `face`, out of the way of a scenario (no floor hopping).
pub fn park_cop(r: &mut XRig, floor: i32, x: f64, face: i32) {
    let c = &mut r.x().cop.cop;
    c.floor = floor;
    c.x = x;
    c.face = face;
    c.mode = CopMode::Patrol;
    c.pause_t = 1_000_000_000;
    c.next_hop = 1_000_000_000;
    c.ignore_t = 0;
}

/// Freeze both walkers (speed 0) at the given x positions.
pub fn park_walkers(r: &mut XRig, x0: f64, x1: f64) {
    let ws = &mut r.x().walkers.walkers;
    ws[0].x = x0;
    ws[0].speed = 0.0;
    ws[1].x = x1;
    ws[1].speed = 0.0;
}

/// Move the janitor's schedule out of the way (no patch appears unless the scenario creates one).
pub fn calm_janitor(r: &mut XRig) {
    r.x().janitor.janitor.next_mop = 1_000_000_000;
}
