//! Shared world-space collision geometry. Sprite coordinates and physical feet are distinct.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}
impl Rect {
    pub fn new(x: i32, y: i32, w: i32, h: i32) -> Self {
        Self { x, y, w, h }
    }
    pub fn right(self) -> i32 {
        self.x + self.w
    }
    pub fn bottom(self) -> i32 {
        self.y + self.h
    }
    pub fn overlaps(self, b: Self) -> bool {
        self.x < b.right() && self.right() > b.x && self.y < b.bottom() && self.bottom() > b.y
    }
    pub fn gap(self, b: Self) -> i32 {
        (b.x - self.right()).max(self.x - b.right()).max(0)
            + (b.y - self.bottom()).max(self.y - b.bottom()).max(0)
    }
}
pub const CAR_HEIGHT: i32 = 28;
pub fn room_feet(x: i32, y: i32) -> Rect {
    Rect::new(x + 3, y + 10, 10, 6)
}
pub fn room_body(x: i32, y: i32) -> Rect {
    Rect::new(x + 3, y + 2, 10, 14)
}
pub fn mall_body(x: i32, feet: i32, duck: bool) -> Rect {
    let h = if duck { 11 } else { 22 };
    Rect::new(x + 3, feet - h, 10, h)
}
pub fn bolt(x: i32, y: i32) -> Rect {
    Rect::new(x, y, 3, 2)
}
/// A moving platform catches a descending body only when their surfaces actually cross.
pub fn crosses_surface(old_feet: i32, new_feet: i32, old_surface: i32, new_surface: i32) -> bool {
    old_feet <= old_surface
        && new_feet >= new_surface
        && (new_feet - old_feet) >= (new_surface - old_surface)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn touching_edges_are_not_penetration() {
        assert!(!Rect::new(0, 0, 10, 10).overlaps(Rect::new(10, 0, 10, 10)));
        assert!(Rect::new(0, 0, 10, 10).overlaps(Rect::new(9, 0, 10, 10)));
    }
    #[test]
    fn moving_roof_can_catch_a_stationary_foot() {
        assert!(crosses_surface(60, 60, 61, 60));
        assert!(!crosses_surface(70, 72, 60, 59));
    }
}
