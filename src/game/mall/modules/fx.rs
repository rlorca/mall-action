//! Short cosmetic effects and the shot candidate types the router in `mod.rs` works with. Port of `modules/fx.ts`.

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum FxKind {
    Spark,
    Glass,
}

impl FxKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            FxKind::Spark => "spark",
            FxKind::Glass => "glass",
        }
    }
}

/// Short cosmetic effects the renderer draws (bullet sparks, glass bursts). Deterministic frame counters only.
#[derive(Clone, Copy, Debug)]
pub struct Fx {
    pub kind: FxKind,
    pub x: f64,
    pub y: f64,
    pub t: i32,
    pub total: i32,
}

#[derive(Default)]
pub struct FxModule {
    pub items: Vec<Fx>,
}

impl FxModule {
    pub fn new() -> FxModule {
        FxModule { items: Vec::new() }
    }

    /// `add(kind, x, y, frames = kind === 'glass' ? 28 : 12)`.
    pub fn add(&mut self, kind: FxKind, x: f64, y: f64, frames: i32) {
        self.items.push(Fx { kind, x, y, t: frames, total: frames });
    }

    /// `add(kind, x, y)` with the default frame count.
    pub fn add_default(&mut self, kind: FxKind, x: f64, y: f64) {
        self.add(kind, x, y, if kind == FxKind::Glass { 28 } else { 12 });
    }

    pub fn step(&mut self) {
        let mut i = self.items.len();
        while i > 0 {
            i -= 1;
            self.items[i].t -= 1;
            if self.items[i].t <= 0 {
                self.items.remove(i);
            }
        }
    }

    pub fn on_respawn(&mut self) {
        self.items.clear();
    }
}

/// What a candidate shot target is, and what happens to it when the shot lands (see `MallExtras::on_bullet`).
#[derive(Clone, Copy, Debug)]
pub enum ShotHit {
    /// Release lamp `index`, rolling (if a disco ball) in direction `dir`.
    Lamp { index: usize, dir: i32 },
    /// Hit walker `index`.
    Walker { index: usize },
    /// The cop's helmet.
    Cop,
    /// Spray fountain `index`.
    Fountain { index: usize },
}

/// A thing a bullet can hit this frame. The shot router picks the NEAREST candidate along the bullet's path across all
/// sources, so a walker standing under a lamp takes the shot, not whichever source happens to be registered first.
#[derive(Clone, Copy, Debug)]
pub struct ShotCandidate {
    /// Distance along x from the bullet to the target (0 = already inside).
    pub dist: f64,
    pub hit: ShotHit,
}
